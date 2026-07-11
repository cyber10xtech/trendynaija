/**
 * Social Intelligence ingestion orchestrator.
 *
 * For each enabled social source:
 *   1. Open ingestion_jobs row (running)
 *   2. Provider.fetchTrending() → NormalizedSocialSignal[]
 *   3. Dedupe by content_hash
 *   4. Extract hashtags/mentions; merge into existing topics via token overlap
 *   5. Insert social_signals, upsert hashtag usage
 *   6. Snapshot hashtag ranks (once per sweep)
 *   7. Feed trend_scores.social_activity for merged topics
 *   8. Emit provider_logs, close job
 *
 * Never fabricates content. Only ingests what a provider returns from
 * its own public endpoints.
 */
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { resolveSocialProvider, type SocialSourceRow } from "./registry.server";
import { recordHashtagUsage, snapshotHashtagRanks } from "./hashtags.server";
import { tokenize } from "@/lib/news/hashing.server";
import type { NormalizedSocialSignal } from "@/lib/providers/contracts";

export interface SocialIngestReport {
  sourceKey: string;
  sourceName: string;
  fetched: number;
  inserted: number;
  duplicates: number;
  topicsMerged: number;
  topicsCreated: number;
  hashtagsSeen: number;
  latencyMs: number;
  error?: string;
}

async function sha256Hex(s: string): Promise<string> {
  const buf = new TextEncoder().encode(s);
  const hash = await crypto.subtle.digest("SHA-256", buf);
  return Array.from(new Uint8Array(hash)).map((b) => b.toString(16).padStart(2, "0")).join("");
}

interface TopicCandidate { id: string; tokens: Set<string>; category: string | null }

async function loadTopicCandidates(): Promise<TopicCandidate[]> {
  const { data } = await supabaseAdmin
    .from("topics")
    .select("id, name, category")
    .order("updated_at", { ascending: false })
    .limit(1000);
  return (data ?? []).map((t) => ({ id: t.id, tokens: new Set(tokenize(t.name)), category: t.category }));
}

function matchTopic(text: string, candidates: TopicCandidate[]): TopicCandidate | null {
  const tokens = new Set(tokenize(text).slice(0, 20));
  if (tokens.size === 0) return null;
  let best: { cand: TopicCandidate; score: number } | null = null;
  for (const c of candidates) {
    if (c.tokens.size === 0) continue;
    let overlap = 0;
    for (const t of tokens) if (c.tokens.has(t)) overlap++;
    const score = overlap / Math.max(c.tokens.size, tokens.size);
    if (score > 0.35 && (!best || score > best.score)) best = { cand: c, score };
  }
  return best?.cand ?? null;
}

function slugify(name: string): string {
  return name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "").slice(0, 80);
}

async function findOrCreateTopicForHashtag(tag: string, candidates: TopicCandidate[]): Promise<{ id: string; created: boolean } | null> {
  const clean = tag.toLowerCase().replace(/^#+/, "");
  if (clean.length < 3) return null;
  const existing = matchTopic(clean, candidates);
  if (existing) return { id: existing.id, created: false };
  const slug = slugify(`tag-${clean}`);
  const { data } = await supabaseAdmin
    .from("topics")
    .insert({ slug, name: `#${clean}`, category: "social" } as never)
    .select("id")
    .maybeSingle();
  if (!data) return null;
  candidates.push({ id: data.id, tokens: new Set([clean]), category: "social" });
  return { id: data.id, created: true };
}

async function bumpTopicSocialActivity(topicIds: string[]): Promise<void> {
  if (topicIds.length === 0) return;
  const now = new Date();
  const windowStart = new Date(now.getTime() - 24 * 3_600_000).toISOString();
  const windowEnd = now.toISOString();
  for (const topicId of topicIds) {
    const { data: existing } = await supabaseAdmin
      .from("trend_scores")
      .select("id, social_activity, mention_volume, score")
      .eq("topic_id", topicId)
      .gte("window_end", windowStart)
      .order("window_end", { ascending: false })
      .maybeSingle();
    if (existing) {
      const social = (existing.social_activity ?? 0) + 1;
      const mention = (existing.mention_volume ?? 0) + 1;
      await supabaseAdmin
        .from("trend_scores")
        .update({
          social_activity: social,
          mention_volume: mention,
          score: (existing.score ?? 0) + 0.05,
        } as never)
        .eq("id", existing.id);
    } else {
      await supabaseAdmin.from("trend_scores").insert({
        topic_id: topicId,
        social_activity: 1,
        mention_volume: 1,
        score: 0.05,
        confidence: 0.4,
        window_start: windowStart,
        window_end: windowEnd,
      } as never);
    }
  }
}

async function logProvider(sourceId: string, jobId: string | null, level: "info" | "warn" | "error", message: string, metadata: Record<string, unknown> = {}) {
  await supabaseAdmin.from("provider_logs").insert({
    source_id: sourceId, job_id: jobId, level, message, metadata: metadata as never,
  });
}

async function ingestSource(row: SocialSourceRow): Promise<SocialIngestReport> {
  const report: SocialIngestReport = {
    sourceKey: row.key, sourceName: row.name,
    fetched: 0, inserted: 0, duplicates: 0,
    topicsMerged: 0, topicsCreated: 0, hashtagsSeen: 0, latencyMs: 0,
  };

  const provider = resolveSocialProvider(row);
  if (!provider) { report.error = "No provider factory for key " + row.key; return report; }

  const { data: jobRow } = await supabaseAdmin
    .from("ingestion_jobs")
    .insert({ source_id: row.id, status: "running", started_at: new Date().toISOString() } as never)
    .select("id").single();
  const jobId = jobRow?.id as string | null;

  const started = Date.now();
  try {
    const signals = await provider.fetchTrending({ limit: 50 });
    report.fetched = signals.length;
    report.latencyMs = Date.now() - started;

    const topics = await loadTopicCandidates();
    const topicsToBump = new Set<string>();
    const hashtagObs: { tag: string }[] = [];

    for (const s of signals) {
      await ingestSignal(s, row.id, topics, topicsToBump, hashtagObs, report);
    }

    report.hashtagsSeen = hashtagObs.length;
    await recordHashtagUsage(hashtagObs);
    await bumpTopicSocialActivity(Array.from(topicsToBump));

    await supabaseAdmin.from("sources").update({
      status: "healthy", last_sync_at: new Date().toISOString(), last_error: null, retry_count: 0,
    } as never).eq("id", row.id);

    if (jobId) {
      await supabaseAdmin.from("ingestion_jobs").update({
        status: "succeeded", finished_at: new Date().toISOString(),
        items_ingested: report.inserted,
        metadata: {
          fetched: report.fetched, duplicates: report.duplicates,
          topicsMerged: report.topicsMerged, topicsCreated: report.topicsCreated,
          hashtagsSeen: report.hashtagsSeen, latencyMs: report.latencyMs,
          durationMs: Date.now() - started,
        } as never,
      } as never).eq("id", jobId);
      await logProvider(row.id, jobId, "info", `Ingested ${report.inserted} social signals`, { ...report });
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    report.error = message;
    await supabaseAdmin.from("sources").update({
      status: "down", last_error: message, retry_count: (row.retry_count ?? 0) + 1,
    } as never).eq("id", row.id);
    if (jobId) {
      await supabaseAdmin.from("ingestion_jobs").update({
        status: "failed", finished_at: new Date().toISOString(), error_message: message,
      } as never).eq("id", jobId);
      await logProvider(row.id, jobId, "error", `Social ingest failed: ${message}`);
    }
  }

  return report;
}

async function ingestSignal(
  s: NormalizedSocialSignal,
  sourceId: string,
  topics: TopicCandidate[],
  topicsToBump: Set<string>,
  hashtagObs: { tag: string }[],
  report: SocialIngestReport,
): Promise<void> {
  if (!s.text || !s.externalId) return;
  const hash = await sha256Hex(`${sourceId}:${s.externalId}`);
  const { data: existing } = await supabaseAdmin
    .from("social_signals").select("id").eq("content_hash", hash).maybeSingle();
  if (existing) { report.duplicates++; return; }

  // Topic merge: prefer text match, then any hashtag match
  let topicId: string | null = null;
  const match = matchTopic(s.text, topics);
  if (match) { topicId = match.id; report.topicsMerged++; }
  else if (s.hashtags.length > 0) {
    const first = await findOrCreateTopicForHashtag(s.hashtags[0], topics);
    if (first) { topicId = first.id; if (first.created) report.topicsCreated++; else report.topicsMerged++; }
  }
  if (topicId) topicsToBump.add(topicId);

  for (const h of s.hashtags) hashtagObs.push({ tag: h });

  const { error: insErr } = await supabaseAdmin.from("social_signals").insert({
    source_id: sourceId,
    external_id: s.externalId,
    url: s.url ?? null,
    author: s.author ?? null,
    published_at: s.publishedAt ?? null,
    language: s.language ?? "en",
    text: s.text,
    hashtags: s.hashtags,
    mentions: s.mentions,
    entities: s.entities as never,
    location: s.location ?? null,
    engagement: s.engagement as never,
    topic_id: topicId,
    category: s.category ?? null,
    confidence: s.confidence ?? 0.5,
    content_hash: hash,
    raw: (s.raw ?? {}) as never,
  } as never);
  if (insErr) { report.duplicates++; return; }
  report.inserted++;
}

export async function runSocialIngestion(opts?: { sourceKey?: string }): Promise<{ reports: SocialIngestReport[]; ranked: number }> {
  const q = supabaseAdmin.from("sources")
    .select("id, key, name, base_url, enabled, retry_count")
    .eq("kind", "social").eq("enabled", true);
  if (opts?.sourceKey) q.eq("key", opts.sourceKey);
  const { data } = await q;

  const reports: SocialIngestReport[] = [];
  for (const row of (data ?? []) as SocialSourceRow[]) {
    reports.push(await ingestSource(row));
  }
  const { ranked } = await snapshotHashtagRanks();
  return { reports, ranked };
}
