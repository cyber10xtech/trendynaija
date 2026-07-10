/**
 * AI Brain orchestrator — runs every intelligence stage in the right order.
 * Cheap deterministic stages first (velocity, graph, alerts) so we still
 * produce insight when AI budget is exhausted.
 */
import { recomputeAllVelocities } from "./velocity.server";
import { rebuildGraphFromSummaries } from "./graph.server";
import { detectAlerts, predictTopTrends } from "./alerts.server";
import { detectNarratives } from "./narratives.server";
import { generateDailyBriefs } from "./brief.server";
import { explainTopicTrend } from "./explain.server";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

export interface BrainRunReport {
  velocitiesUpdated: number;
  graph: { summariesProcessed: number; entitiesUpserted: number; entityLinks: number; topicLinks: number };
  alerts: { fired: number; skipped: number };
  narratives: { clustersEvaluated: number; narrativesCreated: number; narrativesUpdated: number };
  predictions: { created: number; skipped: number };
  briefs: { generated: number; skipped: number };
  explanations: number;
  durationMs: number;
}

export interface BrainRunOptions {
  skipBriefs?: boolean;
  skipPredictions?: boolean;
  skipNarratives?: boolean;
  explainLimit?: number;
}

export async function runBrain(opts: BrainRunOptions = {}): Promise<BrainRunReport> {
  const started = Date.now();

  const velocitiesUpdated = await recomputeAllVelocities();
  const graph = await rebuildGraphFromSummaries();
  const alerts = await detectAlerts();
  const narratives = opts.skipNarratives ? { clustersEvaluated: 0, narrativesCreated: 0, narrativesUpdated: 0 } : await detectNarratives();
  const predictions = opts.skipPredictions ? { created: 0, skipped: 0 } : await predictTopTrends(10);
  const briefs = opts.skipBriefs ? { generated: 0, skipped: 0 } : await generateDailyBriefs();

  // Explain top N trending topics missing explanations
  const explainLimit = opts.explainLimit ?? 10;
  const { data: topTrending } = await supabaseAdmin
    .from("topics")
    .select("id")
    .in("lifecycle_state", ["emerging", "growing", "trending"])
    .order("momentum", { ascending: false })
    .limit(explainLimit);
  let explanations = 0;
  for (const t of topTrending ?? []) {
    // Skip if we have a fresh topic explanation
    const since = new Date(Date.now() - 6 * 3_600_000).toISOString();
    const { data: existing } = await supabaseAdmin
      .from("ai_summaries").select("id")
      .eq("subject_type", "topic").eq("subject_id", t.id)
      .gte("created_at", since).limit(1).maybeSingle();
    if (existing) continue;
    const r = await explainTopicTrend(t.id as string);
    if (r) explanations++;
  }

  return { velocitiesUpdated, graph, alerts, narratives, predictions, briefs, explanations, durationMs: Date.now() - started };
}
