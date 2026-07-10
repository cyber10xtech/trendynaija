/**
 * Trend Velocity + Lifecycle service.
 *
 * Computes deterministic velocity, acceleration, momentum and lifecycle
 * state from stored trend_scores / google_trends history. No AI calls —
 * pure math over real data.
 *
 * Lifecycle: emerging → growing → trending → peak → declining → dormant
 */
import { supabaseAdmin } from "@/integrations/supabase/client.server";

type LifecycleState = "emerging" | "growing" | "trending" | "peak" | "declining" | "dormant";

interface Metrics {
  velocity: number;      // score delta per hour, normalized to [0,1]
  acceleration: number;  // change in velocity, normalized to [-1,1]
  momentum: number;      // weighted sum of last N scores, normalized [0,1]
  ageHours: number;
  freshness: number;     // 1 = brand new, 0 = stale
}

function classify(m: Metrics, current: number, prev: number): LifecycleState {
  if (current < 0.05 && m.momentum < 0.05) return "dormant";
  if (m.ageHours < 6 && m.velocity > 0.05) return "emerging";
  if (current > 0.7 && m.velocity < 0.02 && m.acceleration < 0) return "peak";
  if (m.velocity < -0.02 || (current < prev * 0.7 && m.ageHours > 12)) return "declining";
  if (m.velocity > 0.08 && m.acceleration > 0) return "trending";
  if (m.velocity > 0.02) return "growing";
  return "dormant";
}

export interface TopicVelocityResult {
  topicId: string;
  lifecycleState: LifecycleState;
  velocity: number;
  acceleration: number;
  momentum: number;
  changed: boolean;
}

export async function computeTopicVelocity(topicId: string): Promise<TopicVelocityResult | null> {
  const since = new Date(Date.now() - 72 * 60 * 60 * 1000).toISOString();
  const { data: history } = await supabaseAdmin
    .from("trend_scores")
    .select("score, search_interest, window_end")
    .eq("topic_id", topicId)
    .gte("window_end", since)
    .order("window_end", { ascending: true });

  if (!history || history.length === 0) return null;

  const points = history.map((h) => ({
    t: new Date(h.window_end).getTime(),
    v: Math.max(Number(h.score ?? 0), Number(h.search_interest ?? 0) / 100),
  }));

  const now = Date.now();
  const first = points[0];
  const last = points[points.length - 1];
  const ageHours = Math.max(0.1, (now - first.t) / 3_600_000);
  const spanHours = Math.max(0.1, (last.t - first.t) / 3_600_000);
  const velocity = spanHours > 0 ? (last.v - first.v) / spanHours : 0;

  // Acceleration: slope of last third vs first third
  const third = Math.max(1, Math.floor(points.length / 3));
  const earlyAvg = points.slice(0, third).reduce((s, p) => s + p.v, 0) / third;
  const lateAvg = points.slice(-third).reduce((s, p) => s + p.v, 0) / third;
  const acceleration = lateAvg - earlyAvg;

  // Momentum: exponentially weighted mean, most recent weighted highest
  let wSum = 0, num = 0;
  points.forEach((p, i) => {
    const w = Math.exp((i - points.length + 1) / 5);
    wSum += w; num += p.v * w;
  });
  const momentum = wSum > 0 ? num / wSum : 0;

  const freshness = Math.max(0, 1 - (now - last.t) / (24 * 3_600_000));
  const prevValue = points[Math.max(0, points.length - 2)].v;

  const state = classify(
    { velocity, acceleration, momentum, ageHours, freshness },
    last.v,
    prevValue,
  );

  // Fetch current stored state
  const { data: topic } = await supabaseAdmin
    .from("topics")
    .select("lifecycle_state")
    .eq("id", topicId)
    .maybeSingle();
  const prevState = (topic?.lifecycle_state ?? "dormant") as LifecycleState;
  const changed = prevState !== state;

  await supabaseAdmin
    .from("topics")
    .update({
      lifecycle_state: state,
      velocity: Number(velocity.toFixed(6)),
      acceleration: Number(acceleration.toFixed(6)),
      momentum: Number(momentum.toFixed(6)),
      ...(changed ? { last_lifecycle_change_at: new Date().toISOString() } : {}),
    })
    .eq("id", topicId);

  return {
    topicId,
    lifecycleState: state,
    velocity: Number(velocity.toFixed(6)),
    acceleration: Number(acceleration.toFixed(6)),
    momentum: Number(momentum.toFixed(6)),
    changed,
  };
}

/**
 * Recomputes velocity for every topic that has recent trend_scores.
 */
export async function recomputeAllVelocities(limit = 500): Promise<number> {
  const since = new Date(Date.now() - 72 * 60 * 60 * 1000).toISOString();
  const { data: rows } = await supabaseAdmin
    .from("trend_scores")
    .select("topic_id")
    .gte("window_end", since)
    .limit(5000);
  const ids = Array.from(new Set((rows ?? []).map((r) => r.topic_id).filter(Boolean))) as string[];
  let count = 0;
  for (const id of ids.slice(0, limit)) {
    const r = await computeTopicVelocity(id);
    if (r) count++;
  }
  return count;
}
