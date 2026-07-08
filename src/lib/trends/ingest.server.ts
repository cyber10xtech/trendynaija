/**
 * Google Trends ingestion orchestrator.
 *
 * For each enabled trend_region:
 *   1. Open ingestion_jobs row.
 *   2. Fetch daily trending searches.
 *   3. Normalize each keyword into a topic (fuzzy-match via slug/token overlap).
 *   4. Insert google_trends snapshot rows.
 *   5. Optionally enrich with interest-over-time + related queries/topics when `deep`.
 *   6. Update trend_scores.search_interest for each involved topic.
 *   7. Update provider health + close job with counts.
 */
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import {
  fetchTrendingDaily,
  fetchInterestOverTime,
  fetchRelatedQueries,
  fetchRelatedTopics,
  healthCheck,
  slugify,
  type GTrendingItem,
} from "./google-trends.server";

// Loose Supabase client alias — new tables aren't in types.ts yet.
// Types will regenerate automatically after the next build/deploy.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const db = supabaseAdmin as any;

export interface TrendsIngestReport {
  regionCode: string;
  regionName: string;
  fetched: number;
  inserted: number;
  topicsCreated: number;
  topicsMerged: number;
  interestPointsInserted: number;
  relatedQueriesInserted: number;
  relatedTopicsInserted: number;
  latencyMs: number;
  error?: string;
}

async function log(sourceId: string, jobId: string | null, level: "info" | "warn" | "error", message: string, metadata: Record<string, unknown> = {}) {
  await supabaseAdmin.from("provider_logs").insert({
    source_id: sourceId, job_id: jobId, level, message, metadata: metadata as never,
  });
}

async function getGoogleSource(): Promise<{ id: string; retry_count: number } | null> {
  const { data } = await supabaseAdmin.from("sources").select("id, retry_count").eq("key", "google_trends").maybeSingle();
  return data ?? null;
}

interface Region { id: string; geo_code: string; name: string; state_id: string | null }

async function loadRegions(regionCode?: string): Promise<Region[]> {
  const { data, error } = await db.from("trend_regions")
    .select("id, geo_code, name, state_id, enabled")
    .eq("enabled", true);
  if (error) throw error;
  const rows = (data ?? []) as Array<Region & { enabled: boolean }>;
  return rows.filter((r) => (regionCode ? r.geo_code === regionCode : true))
    .map((r) => ({ id: r.id, geo_code: r.geo_code, name: r.name, state_id: r.state_id }));
}

function tokens(s: string): Set<string> {
  return new Set(s.toLowerCase().normalize("NFKD").replace(/[^a-z0-9\s]/g, " ").split(/\s+/).filter((w) => w.length >= 3));
}
function jaccard(a: Set<string>, b: Set<string>): number {
  if (a.size === 0 && b.size === 0) return 0;
  let inter = 0; for (const w of a) if (b.has(w)) inter++;
  const union = a.size + b.size - inter;
  return union === 0 ? 0 : inter / union;
}

/**
 * Normalize a Google keyword → topic. Try exact slug within the region's state,
 * then token-overlap fuzzy match, otherwise create a new topic.
 */
async function upsertTopic(keyword: string, stateId: string | null): Promise<{ id: string; created: boolean; merged: boolean }> {
  const slug = slugify(keyword);
  if (!slug) throw new Error("empty slug for keyword: " + keyword);

  const { data: bySlug } = await supabaseAdmin
    .from("topics").select("id, name, slug, state_id").eq("slug", slug).limit(10);
  const exact = (bySlug ?? []).find((t) => (t.state_id ?? null) === stateId);
  if (exact) return { id: exact.id, created: false, merged: false };

  const firstToken = keyword.split(/\s+/)[0];
  if (firstToken && firstToken.length >= 3) {
    const { data: candidates } = await supabaseAdmin
      .from("topics").select("id, name, slug, state_id").ilike("name", `%${firstToken}%`).limit(25);
    const kwTokens = tokens(keyword);
    const best = (candidates ?? []).find((c) => (c.state_id ?? null) === stateId && jaccard(tokens(c.name), kwTokens) >= 0.6);
    if (best) return { id: best.id, created: false, merged: true };
  }

  const { data: inserted, error } = await supabaseAdmin
    .from("topics").insert({ name: keyword, slug, state_id: stateId }).select("id").single();
  if (error) throw error;
  return { id: inserted.id, created: true, merged: false };
}

async function upsertTrendScore(topicId: string, stateId: string | null, searchInterest: number) {
  const now = new Date();
  const start = new Date(now.getTime() - 24 * 60 * 60 * 1000).toISOString();
  const end = now.toISOString();
  const confidence = Math.min(1, searchInterest / 100);

  const { data: existing } = await supabaseAdmin
    .from("trend_scores")
    .select("id, search_interest, score, mention_volume, news_coverage, growth_velocity, source_diversity, freshness")
    .eq("topic_id", topicId)
    .gte("window_end", start)
    .order("window_end", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (existing) {
    const newInterest = Math.max(existing.search_interest ?? 0, searchInterest);
    const score = (existing.mention_volume ?? 0) * 0.25 + (existing.growth_velocity ?? 0) * 0.25 +
                  (existing.source_diversity ?? 0) * 0.15 + (existing.news_coverage ?? 0) * 0.15 +
                  newInterest * 0.15 + 1 * 0.05;
    await supabaseAdmin.from("trend_scores").update({
      search_interest: newInterest, freshness: 1, confidence, score,
      window_end: end, updated_at: end,
    }).eq("id", existing.id);
  } else {
    const score = searchInterest * 0.15 + 1 * 0.05;
    await supabaseAdmin.from("trend_scores").insert({
      topic_id: topicId, state_id: stateId,
      window_start: start, window_end: end,
      search_interest: searchInterest, freshness: 1, confidence, score,
    });
  }
}

async function insertSnapshot(region: Region, item: GTrendingItem, rank: number, topicId: string): Promise<boolean> {
  const slug = slugify(item.keyword);
  const { error } = await db.from("google_trends").insert({
    region_id: region.id, keyword: item.keyword, slug, rank,
    traffic: item.traffic, traffic_value: item.trafficValue, topic_id: topicId,
    articles: item.articles, raw: { pubDate: item.pubDate },
  });
  if (error) { console.warn("[trends] snapshot insert error", error); return false; }
  return true;
}

export async function runTrendsIngestion(opts: { regionCode?: string; deep?: boolean } = {}): Promise<TrendsIngestReport[]> {
  const source = await getGoogleSource();
  if (!source) throw new Error("google_trends source row missing — run migration");

  const hc = await healthCheck();
  await supabaseAdmin.from("sources").update({
    status: hc.ok ? "healthy" : "down",
    last_error: hc.ok ? null : hc.message ?? "unknown",
  }).eq("id", source.id);

  const regions = await loadRegions(opts.regionCode);
  const reports: TrendsIngestReport[] = [];

  for (const region of regions) {
    const started = Date.now();
    const { data: job } = await supabaseAdmin.from("ingestion_jobs").insert({
      source_id: source.id, status: "running", started_at: new Date().toISOString(),
      metadata: { regionCode: region.geo_code, deep: !!opts.deep } as never,
    }).select("id").single();
    const jobId = job?.id ?? null;

    const report: TrendsIngestReport = {
      regionCode: region.geo_code, regionName: region.name,
      fetched: 0, inserted: 0, topicsCreated: 0, topicsMerged: 0,
      interestPointsInserted: 0, relatedQueriesInserted: 0, relatedTopicsInserted: 0, latencyMs: 0,
    };

    try {
      const items = await fetchTrendingDaily(region.geo_code);
      report.fetched = items.length;
      if (items.length === 0) {
        await log(source.id, jobId, "warn", `no items from Google Trends for ${region.geo_code}`);
      }

      for (let i = 0; i < items.length; i++) {
        const item = items[i];
        try {
          const { id: topicId, created, merged } = await upsertTopic(item.keyword, region.state_id);
          if (created) report.topicsCreated++;
          if (merged) report.topicsMerged++;
          if (await insertSnapshot(region, item, i + 1, topicId)) report.inserted++;

          const searchInterest = Math.max(0, 100 - i * (100 / Math.max(items.length, 1)));
          await upsertTrendScore(topicId, region.state_id, searchInterest);

          if (opts.deep) {
            try {
              const iot = await fetchInterestOverTime(item.keyword, region.geo_code, "now 7-d");
              if (iot.length) {
                const rows = iot.map((p) => ({
                  topic_id: topicId, keyword: item.keyword, region_id: region.id,
                  ts: p.ts, value: p.value, source: "google_trends",
                }));
                const { error } = await db.from("interest_over_time").upsert(rows, {
                  onConflict: "keyword,region_id,ts,source",
                });
                if (!error) report.interestPointsInserted += rows.length;
              }
              const rq = await fetchRelatedQueries(item.keyword, region.geo_code);
              if (rq.length) {
                const rows = rq.map((qq) => ({
                  topic_id: topicId, keyword: item.keyword, region_id: region.id,
                  query: qq.query, query_type: qq.type, value: qq.value,
                }));
                const { error } = await db.from("related_queries").insert(rows);
                if (!error) report.relatedQueriesInserted += rows.length;
              }
              const rt = await fetchRelatedTopics(item.keyword, region.geo_code);
              if (rt.length) {
                const rows = rt.map((t) => ({
                  topic_id: topicId, keyword: item.keyword, region_id: region.id,
                  related_name: t.name, related_slug: t.slug, related_type: t.type,
                  relation_kind: t.relationKind, strength: t.strength,
                }));
                const { error } = await db.from("related_topics").insert(rows);
                if (!error) report.relatedTopicsInserted += rows.length;
              }
            } catch (e) {
              await log(source.id, jobId, "warn", `deep enrichment failed for "${item.keyword}": ${(e as Error).message}`);
            }
          }
        } catch (e) {
          await log(source.id, jobId, "warn", `item failed "${item.keyword}": ${(e as Error).message}`);
        }
      }

      await supabaseAdmin.from("sources").update({
        last_sync_at: new Date().toISOString(),
        status: report.fetched > 0 ? "healthy" : "degraded",
        last_error: null, retry_count: 0,
      }).eq("id", source.id);

      report.latencyMs = Date.now() - started;
      if (jobId) await supabaseAdmin.from("ingestion_jobs").update({
        status: "succeeded", finished_at: new Date().toISOString(),
        items_ingested: report.inserted,
        metadata: { ...report } as never,
      }).eq("id", jobId);

      await log(source.id, jobId, "info",
        `${region.name}: ${report.fetched} fetched · ${report.inserted} inserted · ${report.topicsCreated} new topics · ${report.topicsMerged} merged`,
        report as unknown as Record<string, unknown>);
    } catch (e) {
      report.error = (e as Error).message;
      report.latencyMs = Date.now() - started;
      await supabaseAdmin.from("sources").update({
        status: "down", last_error: report.error,
        retry_count: (source.retry_count ?? 0) + 1,
      }).eq("id", source.id);
      if (jobId) await supabaseAdmin.from("ingestion_jobs").update({
        status: "failed", finished_at: new Date().toISOString(), error_message: report.error,
        metadata: { ...report } as never,
      }).eq("id", jobId);
      await log(source.id, jobId, "error", `region ${region.geo_code} failed: ${report.error}`);
    }
    reports.push(report);
  }

  return reports;
}
