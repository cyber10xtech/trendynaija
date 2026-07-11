/**
 * Hashtag Engine — tracks usage, ranks, velocity and history.
 *
 * On each ingest sweep:
 *  1. Upsert each hashtag seen (usage_count += 1, last_seen_at = now).
 *  2. Snapshot every active hashtag (past 7d) with its current usage/rank.
 *  3. Compute new current_rank, previous_rank, rank_change, velocity
 *     (usage delta vs previous snapshot) and growth_rate (%).
 *
 * No fabricated data. Ranks reflect real ingested public posts only.
 */
import { supabaseAdmin } from "@/integrations/supabase/client.server";

export interface HashtagObservation {
  tag: string;
  stateId?: string | null;
}

/**
 * Increment usage_count for each observed hashtag; create rows on first sight.
 * Uses select+update to remain compatible with existing unique index.
 */
export async function recordHashtagUsage(observations: HashtagObservation[]): Promise<number> {
  if (observations.length === 0) return 0;
  const counts = new Map<string, { tag: string; stateId: string | null; count: number }>();
  for (const o of observations) {
    const tag = o.tag.toLowerCase().replace(/^#+/, "");
    if (!tag) continue;
    const key = `${tag}::${o.stateId ?? "null"}`;
    const cur = counts.get(key);
    if (cur) cur.count += 1;
    else counts.set(key, { tag, stateId: o.stateId ?? null, count: 1 });
  }

  let touched = 0;
  const nowIso = new Date().toISOString();
  for (const { tag, stateId, count } of counts.values()) {
    // Try to find an existing row
    const q = supabaseAdmin.from("hashtags").select("id, usage_count").eq("tag", tag);
    const { data: existing } = stateId ? await q.eq("state_id", stateId).maybeSingle() : await q.is("state_id", null).maybeSingle();

    if (existing) {
      await supabaseAdmin
        .from("hashtags")
        .update({
          usage_count: (existing.usage_count ?? 0) + count,
          last_seen_at: nowIso,
        } as never)
        .eq("id", existing.id);
    } else {
      await supabaseAdmin.from("hashtags").insert({
        tag,
        state_id: stateId,
        usage_count: count,
        first_seen_at: nowIso,
        last_seen_at: nowIso,
      } as never);
    }
    touched++;
  }
  return touched;
}

/**
 * Snapshot ranks + compute velocity / growth for all hashtags active in
 * the past 7 days. Runs after each ingest sweep.
 */
export async function snapshotHashtagRanks(): Promise<{ ranked: number }> {
  const since = new Date(Date.now() - 7 * 24 * 3_600_000).toISOString();
  const { data: active } = await supabaseAdmin
    .from("hashtags")
    .select("id, tag, usage_count, current_rank")
    .gte("last_seen_at", since)
    .order("usage_count", { ascending: false })
    .limit(2000);
  if (!active || active.length === 0) return { ranked: 0 };

  // Previous snapshot lookup for growth calc
  const ids = active.map((h) => h.id);
  const { data: prevSnaps } = await supabaseAdmin
    .from("hashtag_snapshots")
    .select("hashtag_id, usage_count, captured_at")
    .in("hashtag_id", ids)
    .order("captured_at", { ascending: false })
    .limit(2000);
  const latestPrev = new Map<string, number>();
  for (const s of prevSnaps ?? []) {
    if (!latestPrev.has(s.hashtag_id)) latestPrev.set(s.hashtag_id, s.usage_count ?? 0);
  }

  const now = new Date().toISOString();
  const snapshotRows: Array<{ hashtag_id: string; captured_at: string; usage_count: number; rank: number; velocity: number; growth_rate: number }> = [];
  let rank = 0;
  for (const h of active) {
    rank++;
    const prevUsage = latestPrev.get(h.id) ?? 0;
    const velocity = (h.usage_count ?? 0) - prevUsage;
    const growthRate = prevUsage > 0 ? velocity / prevUsage : (h.usage_count ?? 0) > 0 ? 1 : 0;

    await supabaseAdmin
      .from("hashtags")
      .update({
        previous_rank: h.current_rank ?? null,
        current_rank: rank,
        rank_change: h.current_rank ? h.current_rank - rank : 0,
        velocity,
        growth_rate: Math.max(-1, Math.min(10, growthRate)),
        momentum: velocity * (1 + Math.max(0, growthRate)),
      } as never)
      .eq("id", h.id);

    snapshotRows.push({
      hashtag_id: h.id,
      captured_at: now,
      usage_count: h.usage_count ?? 0,
      rank,
      velocity,
      growth_rate: growthRate,
    });
  }
  if (snapshotRows.length) {
    // batch in chunks of 500
    for (let i = 0; i < snapshotRows.length; i += 500) {
      await supabaseAdmin.from("hashtag_snapshots").insert(snapshotRows.slice(i, i + 500) as never);
    }
  }
  return { ranked: rank };
}

/** Top trending hashtags for the UI (public read). */
export async function fetchTrendingHashtags(limit = 20) {
  const { data } = await supabaseAdmin
    .from("hashtags")
    .select("id, tag, usage_count, current_rank, previous_rank, rank_change, velocity, growth_rate, momentum, last_seen_at")
    .order("current_rank", { ascending: true, nullsFirst: false })
    .limit(limit);
  return data ?? [];
}
