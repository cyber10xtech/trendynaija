/**
 * Daily AI Brief service.
 *
 * Builds category-scoped and overall daily briefs grounded in real
 * article_clusters + trending topics from the last 24 hours.
 * Stored in daily_briefs (unique per date/scope/category) for history.
 */
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { NEWS_CATEGORIES } from "@/lib/news/categories";
import { callAI } from "./client.server";

const CATEGORY_BRIEFS: readonly string[] = [
  "Politics", "Business", "Sports", "Entertainment", "Technology",
  "Education", "Health",
];

const SYSTEM = `You are Trendy Naija's daily editor. Given real cluster headlines and
trending topics for today in Nigeria (or a specific state/category), produce a strict
JSON daily brief:
{
 "title": "brief title",
 "summary": "2-3 sentence executive summary",
 "sections": [{ "heading": "string", "body": "1-2 sentence paragraph grounded in the evidence" }],
 "topTopics": ["topic name", ...]
}
Only reference facts present in the evidence. Do not invent quotes or numbers.`;

async function gatherEvidence(opts: { category?: string; scope: string }) {
  const since = new Date(Date.now() - 24 * 3_600_000).toISOString();
  let clusterQ = supabaseAdmin
    .from("article_clusters")
    .select("title, summary, category, article_count")
    .gte("last_seen_at", since)
    .order("article_count", { ascending: false })
    .limit(15);
  if (opts.category) clusterQ = clusterQ.eq("category", opts.category);
  const { data: clusters } = await clusterQ;

  const { data: topics } = await supabaseAdmin
    .from("topics")
    .select("name, category, lifecycle_state, momentum")
    .in("lifecycle_state", ["emerging", "growing", "trending", "peak"])
    .order("momentum", { ascending: false })
    .limit(15);

  return { clusters: clusters ?? [], topics: topics ?? [] };
}

async function buildBrief(scope: string, category: string | null): Promise<boolean> {
  const { clusters, topics } = await gatherEvidence({ category: category ?? undefined, scope });
  if (clusters.length === 0 && topics.length === 0) return false;

  const user = [
    `Scope: ${scope}${category ? ` · Category: ${category}` : ""}`,
    "",
    "Top clusters:",
    ...clusters.map((c, i) => `${i + 1}. ${c.title} — ${c.summary ?? ""} [${c.article_count} articles]`),
    "",
    "Trending topics:",
    ...topics.map((t) => `- ${t.name} (${t.lifecycle_state}, momentum ${Number(t.momentum ?? 0).toFixed(2)})`),
  ].join("\n");

  const ai = await callAI<{
    title: string; summary: string;
    sections: Array<{ heading: string; body: string }>;
    topTopics: string[];
  }>({
    kind: "daily_brief", system: SYSTEM, user,
    subjectType: "brief", subjectId: null,
  });
  if (!ai.ok || !ai.data) return false;

  const today = new Date().toISOString().slice(0, 10);
  await supabaseAdmin.from("daily_briefs").upsert(
    {
      brief_date: today, scope, category,
      title: ai.data.title, summary: ai.data.summary,
      sections: (ai.data.sections ?? []) as never,
      top_topics: (ai.data.topTopics ?? []) as never,
      model: ai.model,
    } as never,
    { onConflict: "brief_date,scope,category" } as never,
  );
  return true;
}

export interface DailyBriefReport { generated: number; skipped: number }

export async function generateDailyBriefs(): Promise<DailyBriefReport> {
  const report: DailyBriefReport = { generated: 0, skipped: 0 };
  // Overall Nigeria + Imo
  for (const scope of ["nigeria", "imo"]) {
    (await buildBrief(scope, null)) ? report.generated++ : report.skipped++;
  }
  // Category briefs (Nigeria scope)
  for (const cat of CATEGORY_BRIEFS) {
    if (!NEWS_CATEGORIES.includes(cat as typeof NEWS_CATEGORIES[number])) continue;
    (await buildBrief("nigeria", cat)) ? report.generated++ : report.skipped++;
  }
  return report;
}
