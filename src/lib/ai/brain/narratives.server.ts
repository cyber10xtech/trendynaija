/**
 * Narrative Detection service.
 *
 * A narrative is a recurring story arc that links multiple topics
 * (e.g. Fuel Price Increase → Inflation → Transport → Food Prices).
 * We seed candidates from strongly connected topic clusters (topic_relations)
 * and let AI name + describe the narrative from grounded topic names.
 */
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { callAI } from "./client.server";

function slugify(s: string): string {
  return s.toLowerCase().normalize("NFKD").replace(/[^\p{L}\p{N}]+/gu, "-").replace(/^-+|-+$/g, "").slice(0, 96);
}

async function findClusters(minStrength = 0.15, maxNodes = 8): Promise<string[][]> {
  const { data: rels } = await supabaseAdmin
    .from("topic_relations")
    .select("topic_a_id, topic_b_id, strength")
    .gte("strength", minStrength)
    .limit(1000);
  if (!rels || rels.length === 0) return [];

  const adj = new Map<string, Set<string>>();
  for (const r of rels) {
    const a = r.topic_a_id as string, b = r.topic_b_id as string;
    if (!adj.has(a)) adj.set(a, new Set());
    if (!adj.has(b)) adj.set(b, new Set());
    adj.get(a)!.add(b);
    adj.get(b)!.add(a);
  }
  const seen = new Set<string>();
  const clusters: string[][] = [];
  for (const start of adj.keys()) {
    if (seen.has(start)) continue;
    const stack = [start];
    const group: string[] = [];
    while (stack.length && group.length < maxNodes) {
      const n = stack.pop()!;
      if (seen.has(n)) continue;
      seen.add(n); group.push(n);
      for (const nb of adj.get(n) ?? []) if (!seen.has(nb)) stack.push(nb);
    }
    if (group.length >= 2) clusters.push(group);
  }
  return clusters;
}

const SYSTEM = `You are Trendy Naija's narrative editor. Given a set of related trending topics
in Nigeria, decide whether they form a single evolving NARRATIVE (recurring story arc across
multiple sources). Return strict JSON:
{
 "isNarrative": boolean,
 "title": "short narrative title (max 8 words)",
 "description": "one-sentence description",
 "summary": "2-3 sentence grounded summary of the evolving story",
 "lifecycleState": "emerging" | "growing" | "peak" | "declining",
 "confidence": 0..1
}
If the topics are unrelated, set isNarrative=false. Never invent facts. Base everything on the topic names provided.`;

export interface NarrativeBuildReport {
  clustersEvaluated: number;
  narrativesCreated: number;
  narrativesUpdated: number;
}

export async function detectNarratives(): Promise<NarrativeBuildReport> {
  const report: NarrativeBuildReport = { clustersEvaluated: 0, narrativesCreated: 0, narrativesUpdated: 0 };
  const clusters = await findClusters();
  for (const topicIds of clusters.slice(0, 15)) {
    const { data: topics } = await supabaseAdmin
      .from("topics").select("id, name, category").in("id", topicIds);
    if (!topics || topics.length < 2) continue;
    report.clustersEvaluated++;

    const userMsg = `Topics: ${topics.map((t) => `${t.name}${t.category ? ` (${t.category})` : ""}`).join(" · ")}`;
    const ai = await callAI<{
      isNarrative: boolean; title: string; description: string; summary: string;
      lifecycleState: string; confidence: number;
    }>({
      kind: "narrative_detection",
      system: SYSTEM,
      user: userMsg,
    });
    if (!ai.ok || !ai.data || !ai.data.isNarrative || !ai.data.title) continue;
    const slug = slugify(ai.data.title);
    if (!slug) continue;

    const { data: existing } = await supabaseAdmin
      .from("narratives").select("id").eq("slug", slug).maybeSingle();

    let narrativeId: string;
    if (existing) {
      narrativeId = existing.id as string;
      await supabaseAdmin.from("narratives").update({
        title: ai.data.title,
        description: ai.data.description,
        summary: ai.data.summary,
        lifecycle_state: ai.data.lifecycleState ?? "emerging",
        confidence: ai.data.confidence ?? 0.5,
        topic_count: topics.length,
        last_evolved_at: new Date().toISOString(),
        model: ai.model,
      }).eq("id", narrativeId);
      report.narrativesUpdated++;
    } else {
      const { data: ins } = await supabaseAdmin.from("narratives").insert({
        slug, title: ai.data.title,
        description: ai.data.description, summary: ai.data.summary,
        lifecycle_state: ai.data.lifecycleState ?? "emerging",
        confidence: ai.data.confidence ?? 0.5,
        topic_count: topics.length, model: ai.model,
      }).select("id").maybeSingle();
      if (!ins) continue;
      narrativeId = ins.id as string;
      report.narrativesCreated++;
    }

    // Link topics
    for (let i = 0; i < topics.length; i++) {
      await supabaseAdmin.from("narrative_topics").upsert(
        { narrative_id: narrativeId, topic_id: topics[i].id, position: i } as never,
        { onConflict: "narrative_id,topic_id" } as never,
      );
    }
  }
  return report;
}
