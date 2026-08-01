/**
 * Public server functions for the Regional Intelligence dashboard.
 * All reads are authenticated via requireSupabaseAuth. Return types are
 * declared explicitly so TanStack's serialization checker is happy.
 */
import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

type Window = "24h" | "7d" | "30d" | "90d";

export interface StateRow {
  id: string;
  code: string;
  name: string;
  region: string | null;
  capital: string | null;
  is_active: boolean;
}

export interface RegionalStat {
  state_id: string | null;
  lga_id?: string | null;
  topic_id?: string | null;
  trend_score: number;
  growth?: number;
  sentiment?: number;
  signal_count: number;
  news_count: number;
  social_count: number;
  confidence?: number;
  updated_at?: string;
}

export interface TopicRef {
  id: string;
  name: string;
  slug: string;
  category?: string | null;
  lifecycle_state?: string;
}

export interface TopicStat {
  topic_id: string | null;
  trend_score: number;
  signal_count: number;
  news_count: number;
  social_count: number;
  topic: TopicRef | null;
}

export interface AlertRow {
  id: string;
  alert_type: string;
  severity: string;
  title: string;
  message: string | null;
  fired_at: string;
  resolved: boolean;
  state_id: string | null;
  topic_id: string | null;
}

export interface NewsRef {
  id: string;
  title: string;
  url: string;
  published_at: string;
  image_url: string | null;
  sources: { name: string } | null;
}

export interface SignalRef {
  id: string;
  text: string;
  url: string | null;
  published_at: string;
  author: string | null;
  sources: { name: string } | null;
}

export const listRegionsSummary = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<Array<StateRow & { stats: RegionalStat | null }>> => {
    const { supabase } = context;
    const { data: states } = await supabase
      .from("states")
      .select("id, code, name, region, capital, is_active")
      .order("name");
    const ids = (states ?? []).map((s) => s.id);
    if (ids.length === 0) return [];
    const { data: stats } = await supabase
      .from("regional_trend_stats")
      .select("state_id, trend_score, signal_count, growth, news_count, social_count")
      .in("state_id", ids)
      .eq("scope", "state")
      .eq("time_window", "24h");
    const map = new Map<string, RegionalStat>(
      (stats ?? []).map((r) => [r.state_id as string, r as RegionalStat]),
    );
    return (states ?? []).map((s) => ({ ...s, stats: map.get(s.id) ?? null }));
  });

export const getStateOverview = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => {
    const v = i as { stateId: string; window?: Window };
    if (!v?.stateId) throw new Error("stateId required");
    return { stateId: v.stateId, window: (v.window ?? "24h") as Window };
  })
  .handler(async ({ data, context }): Promise<{
    state: StateRow | null;
    summary: RegionalStat | null;
    topTopics: TopicStat[];
    news: NewsRef[];
    signals: SignalRef[];
    alerts: AlertRow[];
  }> => {
    const { supabase } = context;
    const { stateId, window } = data;
    const { data: state } = await supabase
      .from("states")
      .select("id, code, name, region, capital, is_active")
      .eq("id", stateId)
      .maybeSingle();
    const { data: stats } = await supabase
      .from("regional_trend_stats")
      .select("*")
      .eq("state_id", stateId)
      .eq("scope", "state")
      .eq("time_window", window);
    const { data: topicStats } = await supabase
      .from("regional_trend_stats")
      .select("topic_id, trend_score, signal_count, news_count, social_count")
      .eq("state_id", stateId)
      .eq("scope", "state_topic")
      .eq("time_window", window)
      .order("trend_score", { ascending: false })
      .limit(20);
    const topicIds = (topicStats ?? []).map((r) => r.topic_id as string).filter(Boolean);
    const { data: topics } = topicIds.length
      ? await supabase.from("topics").select("id, name, slug, category, lifecycle_state").in("id", topicIds)
      : { data: [] as TopicRef[] };
    const tmap = new Map((topics ?? []).map((t) => [t.id, t as TopicRef]));
    const topTopics: TopicStat[] = (topicStats ?? []).map((s) => ({
      topic_id: s.topic_id,
      trend_score: s.trend_score,
      signal_count: s.signal_count,
      news_count: s.news_count,
      social_count: s.social_count,
      topic: s.topic_id ? tmap.get(s.topic_id) ?? null : null,
    }));

    const { data: news } = await supabase
      .from("news_articles")
      .select("id, title, url, published_at, image_url, sources(name)")
      .eq("state_id", stateId)
      .order("published_at", { ascending: false })
      .limit(10);
    const { data: signals } = await supabase
      .from("social_signals")
      .select("id, text, url, published_at, author, sources(name)")
      .eq("state_id", stateId)
      .order("published_at", { ascending: false })
      .limit(10);
    const { data: alerts } = await supabase
      .from("region_alerts")
      .select("id, alert_type, severity, title, message, fired_at, resolved, state_id, topic_id")
      .eq("state_id", stateId)
      .order("fired_at", { ascending: false })
      .limit(10);

    return {
      state: (state ?? null) as StateRow | null,
      summary: ((stats ?? [])[0] ?? null) as RegionalStat | null,
      topTopics,
      news: (news ?? []) as unknown as NewsRef[],
      signals: (signals ?? []) as unknown as SignalRef[],
      alerts: (alerts ?? []) as AlertRow[],
    };
  });

export const getLgaOverview = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => {
    const v = i as { lgaId: string; window?: Window };
    if (!v?.lgaId) throw new Error("lgaId required");
    return { lgaId: v.lgaId, window: (v.window ?? "24h") as Window };
  })
  .handler(async ({ data, context }): Promise<{
    lga: { id: string; code: string; name: string; state_id: string; states: { id: string; name: string; code: string } | null } | null;
    stats: RegionalStat[];
  }> => {
    const { supabase } = context;
    const { data: lga } = await supabase
      .from("lgas")
      .select("id, code, name, state_id, states(id, name, code)")
      .eq("id", data.lgaId)
      .maybeSingle();
    const { data: stats } = await supabase
      .from("regional_trend_stats")
      .select("*")
      .eq("lga_id", data.lgaId)
      .eq("time_window", data.window);
    return {
      lga: (lga ?? null) as never,
      stats: (stats ?? []) as RegionalStat[],
    };
  });

export const getHeatmap = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => {
    const v = i as { scope?: "state" | "lga"; window?: Window };
    return { scope: (v?.scope ?? "state") as "state" | "lga", window: (v?.window ?? "24h") as Window };
  })
  .handler(async ({ data, context }): Promise<RegionalStat[]> => {
    const { supabase } = context;
    const { data: rows } = await supabase
      .from("regional_trend_stats")
      .select("state_id, lga_id, trend_score, growth, signal_count, news_count, social_count, confidence, updated_at")
      .eq("scope", data.scope)
      .eq("time_window", data.window)
      .order("trend_score", { ascending: false });
    return (rows ?? []) as RegionalStat[];
  });

export const compareRegions = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => {
    const v = i as { stateIds: string[]; window?: Window };
    if (!Array.isArray(v?.stateIds) || v.stateIds.length < 2) throw new Error("provide 2+ stateIds");
    return { stateIds: v.stateIds.slice(0, 4), window: (v.window ?? "24h") as Window };
  })
  .handler(async ({ data, context }): Promise<{
    states: Array<{ id: string; name: string; code: string; region: string | null; summary: RegionalStat | null }>;
    topics: Array<{ state_id: string | null; topic_id: string | null; trend_score: number; signal_count: number; topic: TopicRef | null }>;
  }> => {
    const { supabase } = context;
    const { data: states } = await supabase.from("states").select("id, name, code, region").in("id", data.stateIds);
    const { data: statsRows } = await supabase
      .from("regional_trend_stats")
      .select("state_id, trend_score, signal_count, news_count, social_count, growth")
      .in("state_id", data.stateIds)
      .eq("scope", "state")
      .eq("time_window", data.window);
    const summaryByState = new Map<string, RegionalStat>(
      (statsRows ?? []).map((r) => [r.state_id as string, r as RegionalStat]),
    );

    const { data: topicRows } = await supabase
      .from("regional_trend_stats")
      .select("state_id, topic_id, trend_score, signal_count")
      .in("state_id", data.stateIds)
      .eq("scope", "state_topic")
      .eq("time_window", data.window);
    const topicIds = Array.from(new Set((topicRows ?? []).map((r) => r.topic_id as string).filter(Boolean)));
    const { data: topics } = topicIds.length
      ? await supabase.from("topics").select("id, name, slug").in("id", topicIds)
      : { data: [] as TopicRef[] };
    const tmap = new Map((topics ?? []).map((t) => [t.id, t as TopicRef]));

    return {
      states: (states ?? []).map((s) => ({ ...s, summary: summaryByState.get(s.id) ?? null })),
      topics: (topicRows ?? []).map((r) => ({
        state_id: r.state_id,
        topic_id: r.topic_id,
        trend_score: r.trend_score,
        signal_count: r.signal_count,
        topic: r.topic_id ? tmap.get(r.topic_id) ?? null : null,
      })),
    };
  });

export const listRegionAlerts = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => {
    const v = i as { stateId?: string };
    return { stateId: v?.stateId };
  })
  .handler(async ({ data, context }): Promise<AlertRow[]> => {
    const { supabase } = context;
    const base = supabase
      .from("region_alerts")
      .select("id, alert_type, severity, title, message, fired_at, resolved, state_id, topic_id");
    const q = data.stateId ? base.eq("state_id", data.stateId) : base;
    const { data: rows } = await q.order("fired_at", { ascending: false }).limit(50);
    return (rows ?? []) as AlertRow[];
  });
