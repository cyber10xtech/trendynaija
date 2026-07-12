/**
 * Regional alert engine. Reads regional_trend_stats and emits alerts:
 *   - new_regional_trend: a (state, topic) exceeded a signal threshold for the first time
 *   - regional_spike: growth >= 1.5 in the 24h window
 *   - cross_state_spread: topic present in >=3 states within 24h
 * Never fabricates. Reads only stored data.
 */
import { supabaseAdmin } from "@/integrations/supabase/client.server";

const admin = supabaseAdmin as unknown as {
  from: (t: string) => {
    select: (s: string) => {
      eq: (c: string, v: unknown) => { gte: (c: string, v: unknown) => Promise<{ data: unknown[] | null }> };
      gte: (c: string, v: unknown) => Promise<{ data: unknown[] | null }>;
    };
    insert: (r: unknown[]) => Promise<{ error: unknown }>;
  };
};

export interface RegionAlertReport {
  fired: number;
  scanned: number;
  durationMs: number;
}

export async function detectRegionalAlerts(): Promise<RegionAlertReport> {
  const started = Date.now();
  const report: RegionAlertReport = { fired: 0, scanned: 0, durationMs: 0 };

  const since = new Date(Date.now() - 24 * 3_600_000).toISOString();
  const { data: stats } = await (admin.from("regional_trend_stats").select("state_id, lga_id, topic_id, trend_score, growth, signal_count, scope, time_window") as unknown as { gte: (c: string, v: string) => Promise<{ data: Array<{ state_id: string | null; topic_id: string | null; trend_score: number; growth: number; signal_count: number; scope: string; time_window: string }> | null }> })
    .gte("updated_at", since);
  const rows = stats ?? [];
  report.scanned = rows.length;

  const toInsert: Array<Record<string, unknown>> = [];
  const topicStates = new Map<string, Set<string>>();

  for (const r of rows) {
    if (r.time_window !== "24h") continue;
    if (r.scope === "state_topic" && r.topic_id && r.state_id) {
      const set = topicStates.get(r.topic_id) ?? new Set<string>();
      set.add(r.state_id);
      topicStates.set(r.topic_id, set);
      if (r.growth >= 1.5 && r.signal_count >= 5) {
        toInsert.push({
          alert_type: "regional_spike", severity: "warning",
          title: "Regional spike detected",
          message: `Signal volume more than doubled in the last 24h`,
          topic_id: r.topic_id, state_id: r.state_id,
          metadata: { growth: r.growth, signal_count: r.signal_count },
        });
      }
      if (r.signal_count >= 10 && r.growth === 0) {
        toInsert.push({
          alert_type: "new_regional_trend", severity: "info",
          title: "New regional trend",
          message: `Topic active with ${r.signal_count} signals`,
          topic_id: r.topic_id, state_id: r.state_id,
          metadata: { signal_count: r.signal_count },
        });
      }
    }
  }
  for (const [topicId, states] of topicStates) {
    if (states.size >= 3) {
      toInsert.push({
        alert_type: "cross_state_spread", severity: "warning",
        title: "Cross-state spread",
        message: `Topic active across ${states.size} states in 24h`,
        topic_id: topicId, metadata: { state_count: states.size },
      });
    }
  }

  if (toInsert.length > 0) {
    const { error } = await admin.from("region_alerts").insert(toInsert);
    if (!error) report.fired = toInsert.length;
  }
  report.durationMs = Date.now() - started;
  return report;
}
