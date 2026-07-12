/**
 * Geographic Resolution service.
 *
 * Resolves state and LGA from evidence attached to any subject: news article,
 * social signal, google_trends region, provider metadata, entity extraction.
 *
 * Never guesses. Every returned resolution carries a confidence score and a
 * source label so downstream aggregation can filter low-quality matches.
 */
import { supabaseAdmin } from "@/integrations/supabase/client.server";

export type ResolutionSource =
  | "provider_state"          // provider explicitly set state_id
  | "gtrends_region"          // Google Trends region mapping
  | "state_name_match"        // state name mentioned in text
  | "state_capital_match"     // state capital mentioned
  | "lga_name_match"          // LGA name mentioned
  | "existing_link"           // pre-existing topic/article state_id
  | "inferred";

export interface ResolvedLocation {
  stateId?: string | null;
  lgaId?: string | null;
  confidence: number;
  source: ResolutionSource;
  evidence?: Record<string, unknown>;
}

interface GeoCacheEntry {
  states: Array<{ id: string; name: string; code: string; capital: string | null; region: string | null; is_active: boolean }>;
  lgas: Array<{ id: string; name: string; code: string; state_id: string }>;
  stateByCode: Map<string, string>;
  stateByName: Map<string, string>;
  stateByCapital: Map<string, string>;
  lgaByName: Map<string, { id: string; state_id: string }>;
  loadedAt: number;
}

let cache: GeoCacheEntry | null = null;
const CACHE_TTL_MS = 5 * 60 * 1000;

export async function loadGeography(force = false): Promise<GeoCacheEntry> {
  if (!force && cache && Date.now() - cache.loadedAt < CACHE_TTL_MS) return cache;
  const [{ data: states }, { data: lgas }] = await Promise.all([
    supabaseAdmin.from("states").select("id, name, code, capital, region, is_active"),
    supabaseAdmin.from("lgas").select("id, name, code, state_id"),
  ]);
  const stateByCode = new Map<string, string>();
  const stateByName = new Map<string, string>();
  const stateByCapital = new Map<string, string>();
  for (const s of states ?? []) {
    stateByCode.set(s.code.toUpperCase(), s.id);
    stateByName.set(s.name.toLowerCase(), s.id);
    if (s.capital) stateByCapital.set(s.capital.toLowerCase(), s.id);
  }
  const lgaByName = new Map<string, { id: string; state_id: string }>();
  for (const l of lgas ?? []) lgaByName.set(l.name.toLowerCase(), { id: l.id, state_id: l.state_id });
  cache = {
    states: states ?? [],
    lgas: lgas ?? [],
    stateByCode,
    stateByName,
    stateByCapital,
    lgaByName,
    loadedAt: Date.now(),
  };
  return cache;
}

/** Non-destructive text scan for Nigerian state/capital/LGA mentions. */
export async function resolveFromText(text: string | null | undefined): Promise<ResolvedLocation[]> {
  if (!text) return [];
  const geo = await loadGeography();
  const lc = ` ${text.toLowerCase()} `;
  const found = new Map<string, ResolvedLocation>();

  const push = (r: ResolvedLocation) => {
    const key = `${r.stateId ?? ""}|${r.lgaId ?? ""}`;
    const prev = found.get(key);
    if (!prev || r.confidence > prev.confidence) found.set(key, r);
  };

  // LGA mentions (most specific first)
  for (const [name, entry] of geo.lgaByName) {
    if (name.length < 4) continue;
    if (lc.includes(` ${name} `) || lc.includes(` ${name},`) || lc.includes(` ${name}.`)) {
      push({ stateId: entry.state_id, lgaId: entry.id, confidence: 0.9, source: "lga_name_match", evidence: { term: name } });
    }
  }
  // State names
  for (const [name, stateId] of geo.stateByName) {
    if (name.length < 3) continue;
    if (lc.includes(` ${name} `) || lc.includes(` ${name},`) || lc.includes(` ${name}.`) || lc.includes(` ${name} state`)) {
      push({ stateId, confidence: 0.85, source: "state_name_match", evidence: { term: name } });
    }
  }
  // Capitals
  for (const [cap, stateId] of geo.stateByCapital) {
    if (cap.length < 4) continue;
    if (lc.includes(` ${cap} `) || lc.includes(` ${cap},`) || lc.includes(` ${cap}.`)) {
      push({ stateId, confidence: 0.7, source: "state_capital_match", evidence: { term: cap } });
    }
  }
  return Array.from(found.values());
}

export async function resolveFromGeoCode(geoCode: string | null | undefined): Promise<ResolvedLocation | null> {
  if (!geoCode) return null;
  const geo = await loadGeography();
  // Handles "NG", "NG-IM" (ISO subdivision), and bare state codes.
  const parts = geoCode.split("-");
  if (parts.length === 2) {
    const stateId = geo.stateByCode.get(parts[1].toUpperCase());
    if (stateId) return { stateId, confidence: 1, source: "gtrends_region", evidence: { geoCode } };
  } else if (parts[0] === "NG") {
    return { confidence: 1, source: "gtrends_region", evidence: { geoCode: "NG", national: true } };
  }
  return null;
}

/** Aggregate resolutions and pick the strongest state / LGA. */
export function collapse(resolutions: ResolvedLocation[]): { state?: ResolvedLocation; lga?: ResolvedLocation } {
  const byState = new Map<string, ResolvedLocation>();
  const byLga = new Map<string, ResolvedLocation>();
  for (const r of resolutions) {
    if (r.lgaId) {
      const prev = byLga.get(r.lgaId);
      if (!prev || r.confidence > prev.confidence) byLga.set(r.lgaId, r);
    }
    if (r.stateId) {
      const prev = byState.get(r.stateId);
      if (!prev || r.confidence > prev.confidence) byState.set(r.stateId, r);
    }
  }
  const state = Array.from(byState.values()).sort((a, b) => b.confidence - a.confidence)[0];
  const lga = Array.from(byLga.values()).sort((a, b) => b.confidence - a.confidence)[0];
  return { state, lga };
}

// ---------- persistence ----------

type LocSubject = "article" | "signal" | "topic";
const tableFor: Record<LocSubject, string> = {
  article: "article_locations",
  signal: "signal_locations",
  topic: "topic_locations",
};
const fkFor: Record<LocSubject, string> = {
  article: "article_id",
  signal: "signal_id",
  topic: "topic_id",
};

export async function persistLocations(
  subject: LocSubject,
  subjectId: string,
  resolutions: ResolvedLocation[],
): Promise<number> {
  if (resolutions.length === 0) return 0;
  const rows = resolutions
    .filter((r) => r.stateId || r.lgaId)
    .map((r) => ({
      [fkFor[subject]]: subjectId,
      state_id: r.stateId ?? null,
      lga_id: r.lgaId ?? null,
      confidence: r.confidence,
      source: r.source,
      ...(subject === "topic" ? { evidence: r.evidence ?? {}, last_seen_at: new Date().toISOString(), signal_count: 1 } : {}),
    }));
  if (rows.length === 0) return 0;
  const { error } = await (supabaseAdmin as unknown as { from: (t: string) => { upsert: (rows: unknown[], opts: unknown) => Promise<{ error: unknown }> } })
    .from(tableFor[subject])
    .upsert(rows, { onConflict: `${fkFor[subject]},state_id,lga_id`, ignoreDuplicates: false });
  if (error) return 0;
  return rows.length;
}

// ---------- backfill orchestration ----------

export interface ResolutionReport {
  articlesProcessed: number;
  articlesLocated: number;
  signalsProcessed: number;
  signalsLocated: number;
  topicsProcessed: number;
  topicsLocated: number;
  unknownArticles: number;
  unknownSignals: number;
  durationMs: number;
}

/**
 * Resolves locations for recently-ingested content that has no location yet.
 * Uses provider-supplied state_id first, then falls back to text extraction.
 */
export async function resolveRecent(limit = 500): Promise<ResolutionReport> {
  const started = Date.now();
  const report: ResolutionReport = {
    articlesProcessed: 0, articlesLocated: 0,
    signalsProcessed: 0, signalsLocated: 0,
    topicsProcessed: 0, topicsLocated: 0,
    unknownArticles: 0, unknownSignals: 0,
    durationMs: 0,
  };

  // News articles without article_locations
  const { data: articles } = await supabaseAdmin
    .from("news_articles")
    .select("id, title, summary, content, state_id")
    .order("published_at", { ascending: false })
    .limit(limit);

  for (const a of articles ?? []) {
    report.articlesProcessed++;
    const resolutions: ResolvedLocation[] = [];
    if (a.state_id) resolutions.push({ stateId: a.state_id, confidence: 0.95, source: "provider_state" });
    const text = [a.title, a.summary, a.content].filter(Boolean).join(" ");
    resolutions.push(...(await resolveFromText(text)));
    if (resolutions.length === 0) { report.unknownArticles++; continue; }
    const n = await persistLocations("article", a.id, resolutions);
    if (n > 0) report.articlesLocated++;
  }

  // Social signals
  const { data: signals } = await supabaseAdmin
    .from("social_signals")
    .select("id, text, state_id, location")
    .order("published_at", { ascending: false })
    .limit(limit);
  for (const s of signals ?? []) {
    report.signalsProcessed++;
    const resolutions: ResolvedLocation[] = [];
    if (s.state_id) resolutions.push({ stateId: s.state_id, confidence: 0.9, source: "provider_state" });
    const text = [s.text, s.location].filter(Boolean).join(" ");
    resolutions.push(...(await resolveFromText(text)));
    if (resolutions.length === 0) { report.unknownSignals++; continue; }
    const n = await persistLocations("signal", s.id, resolutions);
    if (n > 0) report.signalsLocated++;
  }

  // Topic-level rollups: for each topic, aggregate its articles' and signals' locations
  const { data: topics } = await supabaseAdmin
    .from("topics")
    .select("id, name, state_id")
    .order("updated_at", { ascending: false })
    .limit(limit);
  for (const t of topics ?? []) {
    report.topicsProcessed++;
    const resolutions: ResolvedLocation[] = [];
    if (t.state_id) resolutions.push({ stateId: t.state_id, confidence: 0.95, source: "existing_link" });
    resolutions.push(...(await resolveFromText(t.name)));
    if (resolutions.length === 0) continue;
    const n = await persistLocations("topic", t.id, resolutions);
    if (n > 0) report.topicsLocated++;
  }

  report.durationMs = Date.now() - started;
  return report;
}
