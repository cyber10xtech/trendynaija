/**
 * Public server functions for the Regional Intelligence dashboard.
 * All reads are authenticated via requireSupabaseAuth. Return types are
 * declared explicitly so TanStack's serialization checker is happy.
 */
import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

type Window = "24h" | "7d" | "30d" | "90d";
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Row = Record<string, any>;

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const untyped = (client: unknown) => client as any;

export const listRegionsSummary = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<Row[]> => {
    const { supabase } = context;
    const { data: states } = await supabase.from("states").select("id, code, name, region, capital, is_active").order("name");
    const ids = (states ?? []).map((s) => s.id);
    if (ids.length === 0) return [];
    const { data: stats } = await untyped(supabase)
      .from("regional_trend_stats")
      .select("state_id, trend_score, signal_count, growth, news_count, social_count")
      .in("state_id", ids).eq("scope", "state").eq("time_window", "24h");
    const map = new Map<string, Row>((stats ?? []).map((r: Row) => [r.state_id as string, r]));
    return (states ?? []).map((s) => ({ ...s, stats: map.get(s.id) ?? null }));
  });

export const getStateOverview = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => {
    const v = i as { stateId: string; window?: Window };
    if (!v?.stateId) throw new Error("stateId required");
    return { stateId: v.stateId, window: (v.window ?? "24h") as Window };
  })
  .handler(async ({ data, context }): Promise<Row> => {
    const { supabase } = context;
    const { stateId, window } = data;
    const { data: state } = await supabase.from("states").select("id, code, name, region, capital, is_active").eq("id", stateId).maybeSingle();
    const { data: stats } = await untyped(supabase).from("regional_trend_stats").select("*")
      .eq("state_id", stateId).eq("scope", "state").eq("time_window", window);
    const { data: topicStats } = await untyped(supabase).from("regional_trend_stats")
      .select("topic_id, trend_score, signal_count, news_count, social_count")
      .eq("state_id", stateId).eq("scope", "state_topic").eq("time_window", window)
      .order("trend_score", { ascending: false }).limit(20);
    const topicIds = ((topicStats ?? []) as Row[]).map((r) => r.topic_id as string).filter(Boolean);
    const { data: topics } = topicIds.length
      ? await supabase.from("topics").select("id, name, slug, category, lifecycle_state").in("id", topicIds)
      : { data: [] as Array<{ id: string; name: string; slug: string; category: string | null; lifecycle_state: string }> };
    const tmap = new Map((topics ?? []).map((t) => [t.id, t]));
    const topTopics = ((topicStats ?? []) as Row[]).map((s) => ({ ...s, topic: tmap.get(s.topic_id as string) ?? null }));

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
    const { data: alerts } = await untyped(supabase).from("region_alerts").select("*")
      .eq("state_id", stateId).order("fired_at", { ascending: false }).limit(10);

    return {
      state: state ?? null,
      summary: ((stats ?? []) as Row[])[0] ?? null,
      topTopics: topTopics as Row[],
      news: (news ?? []) as unknown as Row[],
      signals: (signals ?? []) as unknown as Row[],
      alerts: ((alerts ?? []) as Row[]),
    };
  });

export const getLgaOverview = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => {
    const v = i as { lgaId: string; window?: Window };
    if (!v?.lgaId) throw new Error("lgaId required");
    return { lgaId: v.lgaId, window: (v.window ?? "24h") as Window };
  })
  .handler(async ({ data, context }): Promise<Row> => {
    const { supabase } = context;
    const { data: lga } = await supabase.from("lgas").select("id, code, name, state_id, states(id, name, code)").eq("id", data.lgaId).maybeSingle();
    const { data: stats } = await untyped(supabase).from("regional_trend_stats").select("*")
      .eq("lga_id", data.lgaId).eq("time_window", data.window);
    return { lga: lga ?? null, stats: ((stats ?? []) as Row[]) };
  });

export const getHeatmap = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => {
    const v = i as { scope?: "state" | "lga"; window?: Window };
    return { scope: (v?.scope ?? "state") as "state" | "lga", window: (v?.window ?? "24h") as Window };
  })
  .handler(async ({ data, context }): Promise<Row[]> => {
    const { supabase } = context;
    const { data: rows } = await untyped(supabase).from("regional_trend_stats")
      .select("state_id, lga_id, trend_score, growth, signal_count, news_count, social_count, confidence, updated_at")
      .eq("scope", data.scope).eq("time_window", data.window).order("trend_score", { ascending: false });
    return (rows ?? []) as Row[];
  });

export const compareRegions = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => {
    const v = i as { stateIds: string[]; window?: Window };
    if (!Array.isArray(v?.stateIds) || v.stateIds.length < 2) throw new Error("provide 2+ stateIds");
    return { stateIds: v.stateIds.slice(0, 4), window: (v.window ?? "24h") as Window };
  })
  .handler(async ({ data, context }): Promise<{ states: Row[]; topics: Row[] }> => {
    const { supabase } = context;
    const { data: states } = await supabase.from("states").select("id, name, code, region").in("id", data.stateIds);
    const { data: statsRows } = await untyped(supabase).from("regional_trend_stats")
      .select("state_id, trend_score, signal_count, news_count, social_count, growth")
      .in("state_id", data.stateIds).eq("scope", "state").eq("time_window", data.window);
    const summaryByState = new Map<string, Row>(((statsRows ?? []) as Row[]).map((r) => [r.state_id as string, r]));

    const { data: topicRows } = await untyped(supabase).from("regional_trend_stats")
      .select("state_id, topic_id, trend_score, signal_count")
      .in("state_id", data.stateIds).eq("scope", "state_topic").eq("time_window", data.window);
    const topicIds = Array.from(new Set(((topicRows ?? []) as Row[]).map((r) => r.topic_id as string)));
    const { data: topics } = topicIds.length
      ? await supabase.from("topics").select("id, name, slug").in("id", topicIds)
      : { data: [] as Array<{ id: string; name: string; slug: string }> };
    const tmap = new Map((topics ?? []).map((t) => [t.id, t]));

    return {
      states: (states ?? []).map((s) => ({ ...s, summary: summaryByState.get(s.id) ?? null })) as Row[],
      topics: ((topicRows ?? []) as Row[]).map((r) => ({ ...r, topic: tmap.get(r.topic_id as string) ?? null })),
    };
  });

export const listRegionAlerts = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => {
    const v = i as { stateId?: string };
    return { stateId: v?.stateId };
  })
  .handler(async ({ data, context }): Promise<Row[]> => {
    const { supabase } = context;
    const base = untyped(supabase).from("region_alerts").select("*, states:state_id(name, code), topics:topic_id(name, slug)");
    const q = data.stateId ? base.eq("state_id", data.stateId) : base;
    const { data: rows } = await q.order("fired_at", { ascending: false }).limit(50);
    return (rows ?? []) as Row[];
  });
