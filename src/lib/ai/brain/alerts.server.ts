/**
 * Alert Engine + Prediction service.
 *
 * Deterministic detection using lifecycle + velocity metrics we already
 * store. Predictions are AI-estimated and always tagged with a model +
 * confidence range so consumers know they are experimental.
 */
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { callAI } from "./client.server";

export interface AlertReport { fired: number; skipped: number }

async function alertExists(topicId: string, alertType: string, withinMs: number): Promise<boolean> {
  const since = new Date(Date.now() - withinMs).toISOString();
  const { data } = await supabaseAdmin
    .from("trend_alerts")
    .select("id")
    .eq("topic_id", topicId).eq("alert_type", alertType)
    .gte("fired_at", since).limit(1).maybeSingle();
  return !!data;
}

export async function detectAlerts(): Promise<AlertReport> {
  const report: AlertReport = { fired: 0, skipped: 0 };
  const { data: topics } = await supabaseAdmin
    .from("topics")
    .select("id, name, lifecycle_state, velocity, acceleration, momentum, category")
    .in("lifecycle_state", ["emerging", "growing", "trending", "peak"])
    .order("momentum", { ascending: false })
    .limit(80);
  if (!topics) return report;

  for (const t of topics) {
    const vel = Number(t.velocity ?? 0);
    const acc = Number(t.acceleration ?? 0);
    const mom = Number(t.momentum ?? 0);

    let fired = false;
    if (t.lifecycle_state === "emerging" && mom > 0.15 && !(await alertExists(t.id as string, "breaking", 6 * 3_600_000))) {
      await supabaseAdmin.from("trend_alerts").insert({
        alert_type: "breaking", severity: "high", topic_id: t.id,
        title: `Breaking: ${t.name}`,
        message: `${t.name} is emerging fast with rising momentum.`,
        metadata: { velocity: vel, acceleration: acc, momentum: mom, category: t.category } as never,
      });
      fired = true;
    } else if (vel > 0.2 && acc > 0.05 && !(await alertExists(t.id as string, "exploding", 3 * 3_600_000))) {
      await supabaseAdmin.from("trend_alerts").insert({
        alert_type: "exploding", severity: "high", topic_id: t.id,
        title: `Exploding: ${t.name}`,
        message: `${t.name} is accelerating rapidly across sources.`,
        metadata: { velocity: vel, acceleration: acc, momentum: mom } as never,
      });
      fired = true;
    } else if (acc > 0.1 && !(await alertExists(t.id as string, "spike", 3 * 3_600_000))) {
      await supabaseAdmin.from("trend_alerts").insert({
        alert_type: "spike", severity: "medium", topic_id: t.id,
        title: `Unusual spike: ${t.name}`,
        message: `${t.name} shows a sharp uptick in coverage.`,
        metadata: { velocity: vel, acceleration: acc, momentum: mom } as never,
      });
      fired = true;
    }

    if (fired) report.fired++; else report.skipped++;
  }
  return report;
}

const PREDICTION_SYSTEM = `You are Trendy Naija's forecasting analyst. Given a topic and its
recent trajectory metrics, produce an experimental forecast. Return strict JSON:
{
 "probabilityContinuedGrowth": 0..1,
 "expectedLifespanHours": integer,
 "nationalSpreadProbability": 0..1,
 "confidenceLow": 0..1,
 "confidenceHigh": 0..1,
 "rationale": "one-sentence justification grounded in the metrics provided"
}
Predictions are estimates — always keep confidenceLow < confidenceHigh.`;

export interface PredictionReport { created: number; skipped: number }

export async function predictTopTrends(limit = 15): Promise<PredictionReport> {
  const report: PredictionReport = { created: 0, skipped: 0 };
  const { data: topics } = await supabaseAdmin
    .from("topics")
    .select("id, name, category, lifecycle_state, velocity, acceleration, momentum")
    .in("lifecycle_state", ["emerging", "growing", "trending"])
    .order("momentum", { ascending: false })
    .limit(limit);
  if (!topics) return report;

  const staleAfter = new Date(Date.now() - 6 * 3_600_000).toISOString();

  for (const t of topics) {
    // Skip if fresh prediction exists
    const { data: recent } = await supabaseAdmin
      .from("trend_predictions").select("id")
      .eq("topic_id", t.id).gte("created_at", staleAfter).limit(1).maybeSingle();
    if (recent) { report.skipped++; continue; }

    const user = `Topic: ${t.name} (${t.category ?? "uncategorized"})
Lifecycle: ${t.lifecycle_state}
Velocity: ${t.velocity}
Acceleration: ${t.acceleration}
Momentum: ${t.momentum}`;
    const ai = await callAI<{
      probabilityContinuedGrowth: number; expectedLifespanHours: number;
      nationalSpreadProbability: number; confidenceLow: number; confidenceHigh: number;
      rationale: string;
    }>({
      kind: "trend_prediction", subjectType: "topic", subjectId: t.id as string,
      system: PREDICTION_SYSTEM, user,
    });
    if (!ai.ok || !ai.data) { report.skipped++; continue; }
    const expires = new Date(Date.now() + Math.max(3, Math.min(72, ai.data.expectedLifespanHours ?? 24)) * 3_600_000).toISOString();
    await supabaseAdmin.from("trend_predictions").insert({
      topic_id: t.id, prediction_type: "continued_growth",
      probability: Math.max(0, Math.min(1, ai.data.probabilityContinuedGrowth ?? 0)),
      expected_lifespan_hours: Math.max(1, Math.round(ai.data.expectedLifespanHours ?? 24)),
      national_spread_probability: Math.max(0, Math.min(1, ai.data.nationalSpreadProbability ?? 0)),
      confidence_low: Math.max(0, Math.min(1, ai.data.confidenceLow ?? 0.2)),
      confidence_high: Math.max(0, Math.min(1, ai.data.confidenceHigh ?? 0.6)),
      rationale: ai.data.rationale, model: ai.model, expires_at: expires,
    });
    report.created++;
  }
  return report;
}
