/**
 * Read-side server functions for Google Trends intelligence.
 * All queries hit real database rows — no fabrication.
 * Return types are declared explicitly so TanStack Start's serialization
 * checker sees concrete JSON-safe shapes.
 */
import { createServerFn } from "@tanstack/react-start";

async function db() {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return supabaseAdmin as any;
}

export interface TrendRegion {
  id: string; geo_code: string; name: string; region_type: string; enabled: boolean;
}
export interface TrendingSearch {
  id: string;
  keyword: string;
  slug: string;
  rank: number | null;
  traffic: string | null;
  traffic_value: number | null;
  snapshot_at: string;
  topic_id: string | null;
  region_id: string;
  articles: Array<{ title: string; url: string; source: string; snippet?: string; imageUrl?: string }>;
  trend_regions: { name: string; geo_code: string } | null;
  topics: { id: string; slug: string; name: string } | null;
}
export interface InterestPoint { ts: string; value: number; region_id: string; trend_regions: { name: string; geo_code: string } | null }
export interface RelatedQueryRow { query: string; query_type: string; value: number | null; region_id: string; snapshot_at: string }
export interface RelatedTopicRow { related_name: string; related_slug: string; related_type: string | null; relation_kind: string; strength: number | null; region_id: string; snapshot_at: string }
export interface TrendScoreRow {
  score: number; confidence: number; search_interest: number; news_coverage: number;
  mention_volume: number; growth_velocity: number; source_diversity: number; freshness: number;
  window_end: string;
}
export interface TopicRow { id: string; name: string; slug: string; category: string | null; state_id: string | null; updated_at: string }
export interface TopicDetail {
  topic: TopicRow & { created_at: string };
  interestOverTime: InterestPoint[];
  relatedQueries: RelatedQueryRow[];
  relatedTopics: RelatedTopicRow[];
  snapshots: TrendingSearch[];
  trendScore: TrendScoreRow | null;
}
export interface TrendsStats {
  totalSnapshots: number;
  trendsLast24h: number;
  activeRegions: number;
  lastSyncAt: string | null;
}

export const listTrendRegions = createServerFn({ method: "GET" }).handler(async (): Promise<TrendRegion[]> => {
  const supabase = await db();
  const { data, error } = await supabase.from("trend_regions")
    .select("id, geo_code, name, region_type, enabled").order("region_type");
  if (error) throw error;
  return (data ?? []) as TrendRegion[];
});

async function loadRegionIdByCode(code: string): Promise<string | null> {
  const supabase = await db();
  const { data } = await supabase.from("trend_regions").select("id").eq("geo_code", code).maybeSingle();
  return data?.id ?? null;
}

export const listTrendingSearches = createServerFn({ method: "GET" })
  .inputValidator((input: unknown) => {
    const i = (input ?? {}) as { regionCode?: string; limit?: number; window?: "24h" | "7d" };
    return { regionCode: i.regionCode, limit: Math.min(Math.max(i.limit ?? 30, 1), 100), window: i.window ?? "24h" as "24h" | "7d" };
  })
  .handler(async ({ data }): Promise<TrendingSearch[]> => {
    const supabase = await db();
    let regionId: string | null = null;
    if (data.regionCode) {
      regionId = await loadRegionIdByCode(data.regionCode);
      if (!regionId) return [];
    }
    const cutoffH = data.window === "7d" ? 24 * 7 : 24;
    const cutoff = new Date(Date.now() - cutoffH * 3600 * 1000).toISOString();
    let q = supabase.from("google_trends")
      .select("id, keyword, slug, rank, traffic, traffic_value, snapshot_at, topic_id, region_id, articles, trend_regions:region_id(name, geo_code), topics:topic_id(id, slug, name)")
      .gte("snapshot_at", cutoff)
      .order("snapshot_at", { ascending: false })
      .limit(data.limit * 3);
    if (regionId) q = q.eq("region_id", regionId);
    const { data: rows, error } = await q;
    if (error) throw error;

    const seen = new Set<string>();
    const out: TrendingSearch[] = [];
    for (const row of (rows ?? []) as TrendingSearch[]) {
      const k = `${row.region_id}:${row.keyword.toLowerCase()}`;
      if (seen.has(k)) continue;
      seen.add(k);
      out.push(row);
      if (out.length >= data.limit) break;
    }
    return out;
  });

export const risingSearches = createServerFn({ method: "GET" })
  .inputValidator((input: unknown) => {
    const i = (input ?? {}) as { regionCode?: string; limit?: number };
    return { regionCode: i.regionCode, limit: Math.min(Math.max(i.limit ?? 15, 1), 50) };
  })
  .handler(async ({ data }): Promise<TrendingSearch[]> => {
    const supabase = await db();
    let regionId: string | null = null;
    if (data.regionCode) {
      regionId = await loadRegionIdByCode(data.regionCode);
      if (!regionId) return [];
    }
    const cutoff = new Date(Date.now() - 6 * 3600 * 1000).toISOString();
    let q = supabase.from("google_trends")
      .select("id, keyword, slug, rank, traffic, traffic_value, snapshot_at, topic_id, region_id, articles, trend_regions:region_id(name, geo_code), topics:topic_id(id, slug, name)")
      .gte("snapshot_at", cutoff)
      .order("traffic_value", { ascending: false, nullsFirst: false })
      .limit(data.limit * 3);
    if (regionId) q = q.eq("region_id", regionId);
    const { data: rows, error } = await q;
    if (error) throw error;

    const seen = new Set<string>();
    const out: TrendingSearch[] = [];
    for (const row of (rows ?? []) as TrendingSearch[]) {
      const k = `${row.region_id}:${row.keyword.toLowerCase()}`;
      if (seen.has(k)) continue;
      seen.add(k);
      out.push(row);
      if (out.length >= data.limit) break;
    }
    return out;
  });

export const getTopicDetail = createServerFn({ method: "GET" })
  .inputValidator((input: unknown) => {
    const i = input as { slug?: string; id?: string };
    if (!i?.slug && !i?.id) throw new Error("slug or id required");
    return { slug: i.slug, id: i.id };
  })
  .handler(async ({ data }): Promise<TopicDetail | null> => {
    const supabase = await db();
    const base = supabase.from("topics").select("id, name, slug, category, state_id, created_at, updated_at");
    const { data: topic, error } = data.id
      ? await base.eq("id", data.id).maybeSingle()
      : await base.eq("slug", data.slug!).order("created_at", { ascending: true }).limit(1).maybeSingle();
    if (error) throw error;
    if (!topic) return null;

    const [iot, related, relatedTopics, latestSnapshots, score] = await Promise.all([
      supabase.from("interest_over_time")
        .select("ts, value, region_id, trend_regions:region_id(name, geo_code)")
        .eq("topic_id", topic.id).order("ts", { ascending: true }).limit(200),
      supabase.from("related_queries")
        .select("query, query_type, value, region_id, snapshot_at")
        .eq("topic_id", topic.id).order("snapshot_at", { ascending: false }).limit(100),
      supabase.from("related_topics")
        .select("related_name, related_slug, related_type, relation_kind, strength, region_id, snapshot_at")
        .eq("topic_id", topic.id).order("snapshot_at", { ascending: false }).limit(100),
      supabase.from("google_trends")
        .select("id, keyword, slug, rank, traffic, traffic_value, snapshot_at, topic_id, region_id, articles, trend_regions:region_id(name, geo_code), topics:topic_id(id, slug, name)")
        .eq("topic_id", topic.id).order("snapshot_at", { ascending: false }).limit(20),
      supabase.from("trend_scores")
        .select("score, confidence, search_interest, news_coverage, mention_volume, growth_velocity, source_diversity, freshness, window_end")
        .eq("topic_id", topic.id).order("window_end", { ascending: false }).limit(1).maybeSingle(),
    ]);

    return {
      topic: topic as TopicRow & { created_at: string },
      interestOverTime: (iot.data ?? []) as InterestPoint[],
      relatedQueries: (related.data ?? []) as RelatedQueryRow[],
      relatedTopics: (relatedTopics.data ?? []) as RelatedTopicRow[],
      snapshots: (latestSnapshots.data ?? []) as TrendingSearch[],
      trendScore: (score.data ?? null) as TrendScoreRow | null,
    };
  });

export const listTopics = createServerFn({ method: "GET" })
  .inputValidator((input: unknown) => {
    const i = (input ?? {}) as { q?: string; limit?: number; category?: string };
    return { q: i.q?.trim() || undefined, limit: Math.min(Math.max(i.limit ?? 50, 1), 200), category: i.category };
  })
  .handler(async ({ data }): Promise<TopicRow[]> => {
    const supabase = await db();
    let q = supabase.from("topics")
      .select("id, name, slug, category, state_id, updated_at")
      .order("updated_at", { ascending: false })
      .limit(data.limit);
    if (data.q) q = q.ilike("name", `%${data.q}%`);
    if (data.category) q = q.eq("category", data.category);
    const { data: rows, error } = await q;
    if (error) throw error;
    return (rows ?? []) as TopicRow[];
  });

export const trendsDashboardStats = createServerFn({ method: "GET" }).handler(async (): Promise<TrendsStats> => {
  const supabase = await db();
  const day = new Date(Date.now() - 24 * 3600 * 1000).toISOString();
  const [{ count: totalSnapshots }, { count: topics24h }, { count: regions }, latestSnapshot] = await Promise.all([
    supabase.from("google_trends").select("*", { count: "exact", head: true }),
    supabase.from("google_trends").select("*", { count: "exact", head: true }).gte("snapshot_at", day),
    supabase.from("trend_regions").select("*", { count: "exact", head: true }).eq("enabled", true),
    supabase.from("google_trends").select("snapshot_at").order("snapshot_at", { ascending: false }).limit(1).maybeSingle(),
  ]);
  return {
    totalSnapshots: totalSnapshots ?? 0,
    trendsLast24h: topics24h ?? 0,
    activeRegions: regions ?? 0,
    lastSyncAt: latestSnapshot.data?.snapshot_at ?? null,
  };
});
