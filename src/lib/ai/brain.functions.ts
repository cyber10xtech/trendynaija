/**
 * Read-side + AI Search server functions for the Trend Brain.
 * All queries hit real database rows — never fabricates.
 */
import { createServerFn } from "@tanstack/react-start";

async function db() {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return supabaseAdmin as any;
}

export interface BrainOverview {
  emergingCount: number;
  trendingCount: number;
  alertsLast24h: number;
  narrativesActive: number;
  predictionsFresh: number;
  briefsToday: number;
  aiJobsLast24h: number;
}

export const getBrainOverview = createServerFn({ method: "GET" }).handler(async (): Promise<BrainOverview> => {
  const supabase = await db();
  const since = new Date(Date.now() - 24 * 3_600_000).toISOString();
  const today = new Date().toISOString().slice(0, 10);
  const [emerging, trending, alerts, narratives, predictions, briefs, aiJobs] = await Promise.all([
    supabase.from("topics").select("id", { count: "exact", head: true }).eq("lifecycle_state", "emerging"),
    supabase.from("topics").select("id", { count: "exact", head: true }).eq("lifecycle_state", "trending"),
    supabase.from("trend_alerts").select("id", { count: "exact", head: true }).gte("fired_at", since),
    supabase.from("narratives").select("id", { count: "exact", head: true }).neq("lifecycle_state", "dormant"),
    supabase.from("trend_predictions").select("id", { count: "exact", head: true }).gte("created_at", since),
    supabase.from("daily_briefs").select("id", { count: "exact", head: true }).eq("brief_date", today),
    supabase.from("ai_jobs").select("id", { count: "exact", head: true }).gte("created_at", since),
  ]);
  return {
    emergingCount: emerging.count ?? 0,
    trendingCount: trending.count ?? 0,
    alertsLast24h: alerts.count ?? 0,
    narrativesActive: narratives.count ?? 0,
    predictionsFresh: predictions.count ?? 0,
    briefsToday: briefs.count ?? 0,
    aiJobsLast24h: aiJobs.count ?? 0,
  };
});

export const listAlerts = createServerFn({ method: "GET" })
  .inputValidator((i: unknown) => ({ limit: Math.min(Math.max(((i ?? {}) as { limit?: number }).limit ?? 20, 1), 100) }))
  .handler(async ({ data }) => {
    const supabase = await db();
    const { data: rows } = await supabase
      .from("trend_alerts")
      .select("id, alert_type, severity, title, message, fired_at, resolved, topic_id, topics(name, slug)")
      .order("fired_at", { ascending: false }).limit(data.limit);
    return (rows ?? []) as Array<{
      id: string; alert_type: string; severity: string; title: string;
      message: string | null; fired_at: string; resolved: boolean;
      topic_id: string | null; topics: { name: string; slug: string } | null;
    }>;
  });

export const listNarratives = createServerFn({ method: "GET" })
  .inputValidator((i: unknown) => ({ limit: Math.min(Math.max(((i ?? {}) as { limit?: number }).limit ?? 20, 1), 100) }))
  .handler(async ({ data }) => {
    const supabase = await db();
    const { data: rows } = await supabase
      .from("narratives")
      .select("id, slug, title, description, summary, lifecycle_state, confidence, topic_count, last_evolved_at")
      .order("last_evolved_at", { ascending: false }).limit(data.limit);
    return (rows ?? []) as Array<{
      id: string; slug: string; title: string; description: string | null; summary: string | null;
      lifecycle_state: string; confidence: number; topic_count: number; last_evolved_at: string;
    }>;
  });

export const listEmergingTopics = createServerFn({ method: "GET" })
  .inputValidator((i: unknown) => ({ limit: Math.min(Math.max(((i ?? {}) as { limit?: number }).limit ?? 12, 1), 100) }))
  .handler(async ({ data }) => {
    const supabase = await db();
    const { data: rows } = await supabase
      .from("topics")
      .select("id, name, slug, category, lifecycle_state, velocity, acceleration, momentum, updated_at")
      .in("lifecycle_state", ["emerging", "growing", "trending"])
      .order("momentum", { ascending: false })
      .limit(data.limit);
    return (rows ?? []) as Array<{
      id: string; name: string; slug: string; category: string | null; lifecycle_state: string;
      velocity: number; acceleration: number; momentum: number; updated_at: string;
    }>;
  });

export const listPredictions = createServerFn({ method: "GET" })
  .inputValidator((i: unknown) => ({ limit: Math.min(Math.max(((i ?? {}) as { limit?: number }).limit ?? 20, 1), 100) }))
  .handler(async ({ data }) => {
    const supabase = await db();
    const { data: rows } = await supabase
      .from("trend_predictions")
      .select("id, probability, expected_lifespan_hours, national_spread_probability, confidence_low, confidence_high, rationale, model, created_at, topics(id, name, slug)")
      .order("created_at", { ascending: false }).limit(data.limit);
    return (rows ?? []) as Array<{
      id: string; probability: number; expected_lifespan_hours: number | null;
      national_spread_probability: number | null; confidence_low: number | null;
      confidence_high: number | null; rationale: string | null; model: string | null;
      created_at: string; topics: { id: string; name: string; slug: string } | null;
    }>;
  });

export const listTopEntities = createServerFn({ method: "GET" })
  .inputValidator((i: unknown) => ({ limit: Math.min(Math.max(((i ?? {}) as { limit?: number }).limit ?? 30, 1), 200) }))
  .handler(async ({ data }) => {
    const supabase = await db();
    const { data: rows } = await supabase
      .from("entities")
      .select("id, name, slug, entity_type, mention_count, last_seen_at")
      .order("mention_count", { ascending: false }).limit(data.limit);
    return (rows ?? []) as Array<{
      id: string; name: string; slug: string; entity_type: string; mention_count: number; last_seen_at: string | null;
    }>;
  });

export const listTopicRelations = createServerFn({ method: "GET" })
  .inputValidator((i: unknown) => ({ limit: Math.min(Math.max(((i ?? {}) as { limit?: number }).limit ?? 30, 1), 200) }))
  .handler(async ({ data }) => {
    const supabase = await db();
    const { data: rows } = await supabase
      .from("topic_relations")
      .select("id, strength, confidence, evidence_count, a:topic_a_id(name, slug), b:topic_b_id(name, slug)")
      .order("strength", { ascending: false }).limit(data.limit);
    return (rows ?? []) as Array<{
      id: string; strength: number; confidence: number; evidence_count: number;
      a: { name: string; slug: string } | null; b: { name: string; slug: string } | null;
    }>;
  });

export const listTodayBriefs = createServerFn({ method: "GET" }).handler(async () => {
  const supabase = await db();
  const today = new Date().toISOString().slice(0, 10);
  const { data: rows } = await supabase
    .from("daily_briefs").select("id, scope, category, title, summary, sections, top_topics, updated_at, model")
    .eq("brief_date", today).order("scope");
  return (rows ?? []) as Array<{
    id: string; scope: string; category: string | null; title: string; summary: string;
    sections: Array<{ heading: string; body: string }>; top_topics: string[]; updated_at: string; model: string | null;
  }>;
});

export const listAIJobs = createServerFn({ method: "GET" })
  .inputValidator((i: unknown) => ({ limit: Math.min(Math.max(((i ?? {}) as { limit?: number }).limit ?? 50, 1), 200) }))
  .handler(async ({ data }) => {
    const supabase = await db();
    const { data: rows } = await supabase
      .from("ai_jobs")
      .select("id, kind, status, model, duration_ms, tokens_input, tokens_output, confidence, error, created_at")
      .order("created_at", { ascending: false }).limit(data.limit);
    return (rows ?? []) as Array<{
      id: string; kind: string; status: string; model: string | null;
      duration_ms: number | null; tokens_input: number | null; tokens_output: number | null;
      confidence: number | null; error: string | null; created_at: string;
    }>;
  });

export const aiSearch = createServerFn({ method: "POST" })
  .inputValidator((i: unknown) => {
    const q = ((i ?? {}) as { question?: string }).question?.trim();
    if (!q) throw new Error("question required");
    return { question: q.slice(0, 400) };
  })
  .handler(async ({ data }) => {
    const { answerQuery } = await import("@/lib/ai/brain/search.server");
    return await answerQuery(data.question);
  });
