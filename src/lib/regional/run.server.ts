/**
 * Regional Intelligence orchestrator. Runs resolution → aggregation → alerts
 * in a single sweep. Cheap deterministic stages first so we still produce
 * results if a later stage fails.
 */
import { resolveRecent, type ResolutionReport } from "./geo-resolver.server";
import { rebuildRegionalStats, type AggregatorReport, type WindowKey } from "./aggregator.server";
import { detectRegionalAlerts, type RegionAlertReport } from "./alerts.server";

export interface RegionalRunReport {
  resolution: ResolutionReport;
  aggregation: AggregatorReport;
  alerts: RegionAlertReport;
  durationMs: number;
}

export async function runRegionalIntelligence(opts: { windows?: WindowKey[]; resolutionLimit?: number } = {}): Promise<RegionalRunReport> {
  const started = Date.now();
  const resolution = await resolveRecent(opts.resolutionLimit ?? 300);
  const aggregation = await rebuildRegionalStats({ windows: opts.windows });
  const alerts = await detectRegionalAlerts();
  return { resolution, aggregation, alerts, durationMs: Date.now() - started };
}
