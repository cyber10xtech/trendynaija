/**
 * Regional Trend Engine — computes per-region trend aggregates.
 *
 * For each state (and each LGA we have signal density for), aggregates
 * counts + growth from news, social and Google Trends in configured time
 * windows, then computes a regional trend_score using the same signal-blend
 * philosophy as the global Trend Engine.
 *
 * Never fabricates numbers. If a region has no signals in a window it is
 * skipped so heatmaps show emptiness, not fake activity.
 */
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { defaultWeights } from "@/lib/trend/engine";

export type WindowKey = "24h" | "7d" | "30d" | "90d";
const WINDOW_MS: Record<WindowKey, number> = {
  "24h": 24 * 3_600_000,
  "7d":  7 * 24 * 3_600_000,
  "30d": 30 * 24 * 3_600_000,
  "90d": 90 * 24 * 3_600_000,
};
const ALL_WINDOWS: WindowKey[] = ["24h", "7d", "30d", "90d"];

export interface AggregatorReport {
  windows: WindowKey[];
  statesProcessed: number;
  lgasProcessed: number;
  topicRowsWritten: number;
  regionRowsWritten: number;
  durationMs: number;
}

interface Counts {
  news: number;
  social: number;
  hashtags: number;
  search: number;
  signalCount: number;
  distinctSources: number;
}

const admin = supabaseAdmin as unknown as {
  from: (t: string) => {
    upsert: (rows: unknown[], opts: unknown) => Promise<{ error: unknown }>;
  };
};

async function upsertStats(rows: Array<Record<string, unknown>>) {
  if (rows.length === 0) return 0;
  const { error } = await admin
    .from("regional_trend_stats")
    .upsert(rows, { onConflict: "state_id,lga_id,topic_id,scope,time_window", ignoreDuplicates: false });
  if (error) return 0;
  return rows.length;
}

function computeScore(c: Counts): number {
  const w = defaultWeights;
  // Normalize counts using log-scale so a few big regions don't dominate
  const n = (x: number) => Math.min(1, Math.log10(1 + x) / 2);
  return (
    n(c.social + c.news + c.search + c.hashtags) * (w.mentionVolume + w.freshness) +
    n(c.news) * w.newsCoverage +
    n(c.social) * w.socialActivity +
    n(c.search) * w.searchInterest +
    n(c.distinctSources) * w.sourceDiversity
  );
}

/** Rebuilds regional_trend_stats for every state × window and hot LGAs. */
export async function rebuildRegionalStats(opts: { windows?: WindowKey[] } = {}): Promise<AggregatorReport> {
  const started = Date.now();
  const windows = opts.windows ?? ALL_WINDOWS;
  const now = new Date();
  const nowIso = now.toISOString();

  const report: AggregatorReport = {
    windows,
    statesProcessed: 0,
    lgasProcessed: 0,
    topicRowsWritten: 0,
    regionRowsWritten: 0,
    durationMs: 0,
  };

  const { data: states } = await supabaseAdmin.from("states").select("id, name");

  for (const win of windows) {
    const windowStart = new Date(now.getTime() - WINDOW_MS[win]).toISOString();

    // ---- STATE aggregates ----
    for (const s of states ?? []) {
      report.statesProcessed++;

      // News in state (via news_articles.state_id OR article_locations)
      const { data: newsRows } = await supabaseAdmin
        .from("news_articles")
        .select("id, cluster_id, source_id, published_at")
        .eq("state_id", s.id)
        .gte("published_at", windowStart);
      const newsCount = newsRows?.length ?? 0;
      const distinctSources = new Set((newsRows ?? []).map((r) => r.source_id)).size;

      // Social signals in state
      const { count: socialCount } = await supabaseAdmin
        .from("social_signals")
        .select("id", { count: "exact", head: true })
        .eq("state_id", s.id)
        .gte("published_at", windowStart);

      // Hashtags active in state (via hashtag.state_id)
      const { count: hashtagCount } = await supabaseAdmin
        .from("hashtags")
        .select("id", { count: "exact", head: true })
        .eq("state_id", s.id);

      // Search interest via trend_scores.search_interest averaged for topics tagged to state
      const { data: trendRows } = await supabaseAdmin
        .from("trend_scores")
        .select("search_interest")
        .eq("state_id", s.id)
        .gte("window_end", windowStart);
      const searchInterest = trendRows && trendRows.length
        ? trendRows.reduce((a, r) => a + Number(r.search_interest ?? 0), 0) / trendRows.length
        : 0;

      const counts: Counts = {
        news: newsCount,
        social: Number(socialCount ?? 0),
        hashtags: Number(hashtagCount ?? 0),
        search: searchInterest,
        signalCount: newsCount + Number(socialCount ?? 0),
        distinctSources,
      };
      const score = computeScore(counts);
      const total = counts.signalCount;
      if (total === 0 && searchInterest === 0 && counts.hashtags === 0) continue;

      // Growth = compare with previous equal window
      const prevStart = new Date(now.getTime() - 2 * WINDOW_MS[win]).toISOString();
      const { count: prevSocial } = await supabaseAdmin
        .from("social_signals")
        .select("id", { count: "exact", head: true })
        .eq("state_id", s.id)
        .gte("published_at", prevStart)
        .lt("published_at", windowStart);
      const growth = prevSocial && prevSocial > 0 ? (Number(socialCount ?? 0) - prevSocial) / prevSocial : 0;

      const confidence = Math.min(1, Math.log10(1 + total) / 2);

      const wrote = await upsertStats([{
        state_id: s.id,
        lga_id: null,
        topic_id: null,
        scope: "state",
        time_window: win,
        window_start: windowStart,
        window_end: nowIso,
        trend_score: score,
        growth,
        sentiment: 0,
        signal_count: total,
        news_count: counts.news,
        social_count: counts.social,
        search_interest: searchInterest,
        confidence,
        freshness: 1,
      }]);
      report.regionRowsWritten += wrote;

      // ---- per-topic within state ----
      // Get topics active in this state via topic_locations
      const { data: topicLocs } = await (supabaseAdmin as unknown as {
        from: (t: string) => { select: (s: string) => { eq: (c: string, v: string) => Promise<{ data: Array<{ topic_id: string; confidence: number }> | null }> } };
      }).from("topic_locations").select("topic_id, confidence").eq("state_id", s.id);

      const topicIds = Array.from(new Set((topicLocs ?? []).map((r) => r.topic_id))).slice(0, 30);
      const topicRows: Array<Record<string, unknown>> = [];
      for (const topicId of topicIds) {
        // Count articles and signals for this topic in this state
        const { count: tNews } = await supabaseAdmin
          .from("news_articles").select("id", { count: "exact", head: true })
          .eq("state_id", s.id).eq("topic_id", topicId).gte("published_at", windowStart);
        const { count: tSocial } = await supabaseAdmin
          .from("social_signals").select("id", { count: "exact", head: true })
          .eq("state_id", s.id).eq("topic_id", topicId).gte("published_at", windowStart);
        const tTotal = Number(tNews ?? 0) + Number(tSocial ?? 0);
        if (tTotal === 0) continue;
        const tCounts: Counts = {
          news: Number(tNews ?? 0), social: Number(tSocial ?? 0),
          hashtags: 0, search: 0, signalCount: tTotal, distinctSources: 1,
        };
        topicRows.push({
          state_id: s.id, lga_id: null, topic_id: topicId,
          scope: "state_topic", time_window: win,
          window_start: windowStart, window_end: nowIso,
          trend_score: computeScore(tCounts), growth: 0, sentiment: 0,
          signal_count: tTotal, news_count: tCounts.news, social_count: tCounts.social,
          search_interest: 0, confidence: Math.min(1, tTotal / 20), freshness: 1,
        });
      }
      report.topicRowsWritten += await upsertStats(topicRows);
    }

    // ---- LGA aggregates (only where we have signal_locations activity) ----
    const { data: lgaLocs } = await (supabaseAdmin as unknown as {
      from: (t: string) => { select: (s: string) => { not: (c: string, o: string, v: string | null) => Promise<{ data: Array<{ lga_id: string }> | null }> } };
    }).from("signal_locations").select("lga_id").not("lga_id", "is", null);
    const lgaCounts = new Map<string, number>();
    for (const r of lgaLocs ?? []) if (r.lga_id) lgaCounts.set(r.lga_id, (lgaCounts.get(r.lga_id) ?? 0) + 1);
    for (const [lgaId, count] of lgaCounts) {
      if (count < 3) continue; // require minimum evidence
      report.lgasProcessed++;
      report.regionRowsWritten += await upsertStats([{
        state_id: null, lga_id: lgaId, topic_id: null,
        scope: "lga", time_window: win,
        window_start: windowStart, window_end: nowIso,
        trend_score: computeScore({ news: 0, social: count, hashtags: 0, search: 0, signalCount: count, distinctSources: 1 }),
        growth: 0, sentiment: 0,
        signal_count: count, news_count: 0, social_count: count, search_interest: 0,
        confidence: Math.min(1, count / 20), freshness: 1,
      }]);
    }
  }

  report.durationMs = Date.now() - started;
  return report;
}
