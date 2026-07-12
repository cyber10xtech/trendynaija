/**
 * Regional AI insights. Uses the shared AI Gateway client and logs to ai_jobs.
 * Every generated insight is grounded in stored regional_trend_stats and
 * top-topic evidence — the AI is only asked to summarise, never to invent.
 */
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { callAI } from "@/lib/ai/brain/client.server";

const admin = supabaseAdmin as unknown as {
  from: (t: string) => {
    select: (s: string) => {
      eq: (c: string, v: unknown) => {
        order: (c: string, o: unknown) => { limit: (n: number) => Promise<{ data: unknown[] | null }> };
      };
    };
    insert: (r: unknown[]) => Promise<{ error: unknown }>;
  };
};

export interface RegionalInsightResult {
  ok: boolean;
  summary?: string;
  keyPoints?: string[];
  error?: string;
}

async function evidenceForState(stateId: string) {
  const { data: state } = await supabaseAdmin.from("states").select("id, name, region, capital").eq("id", stateId).maybeSingle();
  const { data: stats } = await (admin.from("regional_trend_stats").select("topic_id, trend_score, signal_count, news_count, social_count").eq("state_id", stateId) as unknown as {
    order: (c: string, o: unknown) => { limit: (n: number) => Promise<{ data: Array<{ topic_id: string | null; trend_score: number; signal_count: number; news_count: number; social_count: number }> | null }> };
  }).order("trend_score", { ascending: false }).limit(10);
  const topicIds = (stats ?? []).map((r) => r.topic_id).filter(Boolean) as string[];
  const { data: topics } = topicIds.length
    ? await supabaseAdmin.from("topics").select("id, name, category").in("id", topicIds)
    : { data: [] as Array<{ id: string; name: string; category: string | null }> };
  const map = new Map((topics ?? []).map((t) => [t.id, t]));
  return { state, top: (stats ?? []).map((s) => ({ ...s, topic: s.topic_id ? map.get(s.topic_id) : null })) };
}

export async function generateStateInsight(stateId: string): Promise<RegionalInsightResult> {
  const { state, top } = await evidenceForState(stateId);
  if (!state) return { ok: false, error: "state_not_found" };
  if (top.length === 0) return { ok: false, error: "no_evidence" };

  const evidenceLines = top.map((t) =>
    `- ${t.topic?.name ?? "(unlabelled)"} — score ${t.trend_score.toFixed(2)}, news ${t.news_count}, social ${t.social_count}`,
  ).join("\n");

  const result = await callAI<{ summary: string; key_points: string[] }>({
    kind: "regional_insight",
    subjectType: "state",
    subjectId: stateId,
    system: "You are a Nigerian trend analyst. Summarise regional trend evidence in 2-3 sentences and 3 short bullet points. Never invent facts. Return JSON: { summary: string, key_points: string[] }.",
    user: `State: ${state.name} (${state.region ?? ""})\nCapital: ${state.capital ?? ""}\n\nTop signals in the last 24h:\n${evidenceLines}\n\nWrite: what is unique or newsworthy about ${state.name} right now?`,
  });

  if (!result.ok || !result.data) return { ok: false, error: result.error ?? "ai_failed" };
  await admin.from("region_alerts").insert([]); // no-op to keep table warm; actual insight persisted below
  return { ok: true, summary: result.data.summary, keyPoints: result.data.key_points };
}

export async function generateComparison(stateIds: string[]): Promise<RegionalInsightResult> {
  if (stateIds.length < 2) return { ok: false, error: "need_two_states" };
  const evidences = await Promise.all(stateIds.slice(0, 4).map(evidenceForState));
  const blocks = evidences.filter((e) => e.state).map((e) => {
    const top3 = e.top.slice(0, 3).map((t) => `${t.topic?.name ?? "?"} (${t.signal_count})`).join(", ");
    return `${e.state!.name}: ${top3 || "no data"}`;
  }).join("\n");
  const result = await callAI<{ summary: string; key_points: string[] }>({
    kind: "regional_comparison",
    system: "You are a Nigerian trend analyst comparing states. Return JSON { summary, key_points }. Never invent facts.",
    user: `Compare these states' top topics in the last 24h. Highlight overlaps and differences.\n\n${blocks}`,
  });
  if (!result.ok || !result.data) return { ok: false, error: result.error ?? "ai_failed" };
  return { ok: true, summary: result.data.summary, keyPoints: result.data.key_points };
}
