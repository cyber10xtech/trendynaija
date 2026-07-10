/**
 * Trend Explanation service.
 *
 * For a topic, gathers grounded evidence (news articles + trend snapshots)
 * and asks the AI why it is trending. Every insight is backed by real
 * source rows — nothing is fabricated.
 */
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { callAI } from "./client.server";

export interface TrendExplanation {
  shortExplanation: string;
  detailedExplanation: string;
  keyDrivers: string[];
  supportingSources: Array<{ title: string; url: string; source: string }>;
  confidence: number;
}

const SYSTEM = `You are Trendy Naija's trend analyst. Given a topic and grounded evidence
(article titles, source names, search-trend snapshots), explain WHY this topic is trending
in Nigeria RIGHT NOW. Return strict JSON with keys:
- shortExplanation (one crisp sentence, max 30 words)
- detailedExplanation (3-4 sentences, neutral, grounded)
- keyDrivers (3-5 short bullet strings — concrete drivers, not restated headlines)
- confidence (0..1, based on evidence agreement)
Never invent facts not present in the evidence. If evidence is too thin, say so and return low confidence.
Return ONLY the JSON object.`;

export async function explainTopicTrend(topicId: string): Promise<TrendExplanation | null> {
  const { data: topic } = await supabaseAdmin
    .from("topics").select("id, name, slug, category").eq("id", topicId).maybeSingle();
  if (!topic) return null;

  const since = new Date(Date.now() - 48 * 60 * 60 * 1000).toISOString();

  // Grounded evidence: articles for clusters tagged with this topic name
  const { data: articles } = await supabaseAdmin
    .from("news_articles")
    .select("title, url, published_at, sources(name)")
    .ilike("title", `%${topic.name}%`)
    .gte("published_at", since)
    .order("published_at", { ascending: false })
    .limit(8);

  const { data: snapshots } = await supabaseAdmin
    .from("google_trends")
    .select("keyword, traffic, snapshot_at, articles")
    .eq("topic_id", topicId)
    .gte("snapshot_at", since)
    .order("snapshot_at", { ascending: false })
    .limit(5);

  const supportingSources = (articles ?? []).slice(0, 6).map((a) => ({
    title: a.title as string,
    url: a.url as string,
    source: Array.isArray(a.sources) ? (a.sources[0]?.name ?? "") : ((a.sources as { name?: string } | null)?.name ?? ""),
  }));

  if (supportingSources.length === 0 && (snapshots ?? []).length === 0) return null;

  const evidence = [
    `Topic: ${topic.name} (${topic.category ?? "uncategorized"})`,
    "",
    "Recent headlines:",
    ...supportingSources.map((a, i) => `${i + 1}. ${a.title} — ${a.source}`),
    "",
    "Google Trends snapshots:",
    ...(snapshots ?? []).map((s) => `- "${s.keyword}" · ${s.traffic ?? "?"} · ${s.snapshot_at}`),
  ].join("\n");

  const result = await callAI<{
    shortExplanation: string;
    detailedExplanation: string;
    keyDrivers: string[];
    confidence: number;
  }>({
    kind: "trend_explanation",
    subjectType: "topic",
    subjectId: topicId,
    system: SYSTEM,
    user: evidence,
  });

  if (!result.ok || !result.data) return null;

  const explanation: TrendExplanation = {
    shortExplanation: String(result.data.shortExplanation ?? ""),
    detailedExplanation: String(result.data.detailedExplanation ?? ""),
    keyDrivers: Array.isArray(result.data.keyDrivers) ? result.data.keyDrivers.map(String).slice(0, 5) : [],
    supportingSources,
    confidence: typeof result.data.confidence === "number" ? result.data.confidence : 0.5,
  };

  // Persist as an ai_summary row scoped to the topic
  await supabaseAdmin.from("ai_summaries").insert({
    subject_type: "topic",
    subject_id: topicId,
    model: result.model,
    summary: explanation.detailedExplanation,
    short_summary: explanation.shortExplanation,
    detailed_summary: explanation.detailedExplanation,
    why_trending: explanation.shortExplanation,
    why_trending_detailed: explanation.detailedExplanation,
    key_drivers: explanation.keyDrivers as never,
    confidence: explanation.confidence,
    bullet_points: explanation.keyDrivers as never,
    topics: [topic.name] as never,
    entities: {} as never,
    categories: topic.category ? [topic.category] : ([] as never),
  });

  return explanation;
}
