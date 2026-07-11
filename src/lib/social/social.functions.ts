/**
 * Public server-fn API for social intelligence — used by dashboard + hashtags UI.
 */
import { createServerFn } from "@tanstack/react-start";
import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";

function publicClient() {
  return createClient<Database>(
    process.env.SUPABASE_URL!,
    process.env.SUPABASE_PUBLISHABLE_KEY!,
    { auth: { storage: undefined, persistSession: false, autoRefreshToken: false } },
  );
}

export const listTrendingHashtags = createServerFn({ method: "GET" })
  .inputValidator((i: unknown) => {
    const o = (i ?? {}) as { limit?: number };
    return { limit: Math.max(1, Math.min(100, o.limit ?? 30)) };
  })
  .handler(async ({ data }) => {
    const sb = publicClient();
    const { data: rows } = await sb
      .from("hashtags")
      .select("id, tag, usage_count, current_rank, previous_rank, rank_change, velocity, growth_rate, momentum, last_seen_at, first_seen_at")
      .not("current_rank", "is", null)
      .order("current_rank", { ascending: true })
      .limit(data.limit);
    return rows ?? [];
  });

export const listRecentSocialSignals = createServerFn({ method: "GET" })
  .inputValidator((i: unknown) => {
    const o = (i ?? {}) as { limit?: number; hashtag?: string; topicId?: string; sourceKey?: string };
    return {
      limit: Math.max(1, Math.min(100, o.limit ?? 30)),
      hashtag: o.hashtag?.toLowerCase().replace(/^#+/, "") ?? null,
      topicId: o.topicId ?? null,
      sourceKey: o.sourceKey ?? null,
    };
  })
  .handler(async ({ data }) => {
    const sb = publicClient();
    let q = sb.from("social_signals")
      .select("id, url, author, published_at, text, hashtags, engagement, topic_id, source_id, location, sources!inner(key,name)")
      .order("published_at", { ascending: false, nullsFirst: false })
      .limit(data.limit);
    if (data.hashtag) q = q.contains("hashtags", [data.hashtag]);
    if (data.topicId) q = q.eq("topic_id", data.topicId);
    if (data.sourceKey) q = q.eq("sources.key", data.sourceKey);
    const { data: rows } = await q;
    return rows ?? [];
  });

export const socialSourceBreakdown = createServerFn({ method: "GET" })
  .handler(async () => {
    const sb = publicClient();
    const { data: rows } = await sb
      .from("social_signals")
      .select("source_id, sources!inner(key,name)")
      .gte("published_at", new Date(Date.now() - 7 * 24 * 3_600_000).toISOString())
      .limit(2000);
    const map = new Map<string, { key: string; name: string; count: number }>();
    for (const r of rows ?? []) {
      const src = (Array.isArray(r.sources) ? r.sources[0] : r.sources) as { key: string; name: string } | null;
      if (!src) continue;
      const cur = map.get(src.key);
      if (cur) cur.count++;
      else map.set(src.key, { key: src.key, name: src.name, count: 1 });
    }
    return Array.from(map.values()).sort((a, b) => b.count - a.count);
  });

export const socialActivityTimeline = createServerFn({ method: "GET" })
  .inputValidator((i: unknown) => {
    const o = (i ?? {}) as { hours?: number };
    return { hours: Math.max(6, Math.min(24 * 30, o.hours ?? 72)) };
  })
  .handler(async ({ data }) => {
    const sb = publicClient();
    const since = new Date(Date.now() - data.hours * 3_600_000).toISOString();
    const { data: rows } = await sb
      .from("social_signals")
      .select("published_at")
      .gte("published_at", since)
      .order("published_at", { ascending: true })
      .limit(5000);
    // Bucket per hour
    const bucketMs = 3_600_000;
    const start = Math.floor(Date.parse(since) / bucketMs) * bucketMs;
    const buckets = new Map<number, number>();
    for (const r of rows ?? []) {
      if (!r.published_at) continue;
      const b = Math.floor(Date.parse(r.published_at) / bucketMs) * bucketMs;
      buckets.set(b, (buckets.get(b) ?? 0) + 1);
    }
    const out: { t: string; count: number }[] = [];
    for (let t = start; t <= Date.now(); t += bucketMs) {
      out.push({ t: new Date(t).toISOString(), count: buckets.get(t) ?? 0 });
    }
    return out;
  });

export const socialStats = createServerFn({ method: "GET" })
  .handler(async () => {
    const sb = publicClient();
    const since24 = new Date(Date.now() - 24 * 3_600_000).toISOString();
    const [signalsHead, signals24, hashtagsHead, sourcesHead] = await Promise.all([
      sb.from("social_signals").select("id", { count: "exact", head: true }),
      sb.from("social_signals").select("id", { count: "exact", head: true }).gte("published_at", since24),
      sb.from("hashtags").select("id", { count: "exact", head: true }).not("current_rank", "is", null),
      sb.from("sources").select("id", { count: "exact", head: true }).eq("kind", "social").eq("enabled", true),
    ]);
    return {
      totalSignals: signalsHead.count ?? 0,
      signalsLast24h: signals24.count ?? 0,
      rankedHashtags: hashtagsHead.count ?? 0,
      enabledProviders: sourcesHead.count ?? 0,
    };
  });

export const searchSocial = createServerFn({ method: "GET" })
  .inputValidator((i: unknown) => {
    const o = (i ?? {}) as { q?: string; limit?: number };
    if (!o.q || o.q.trim().length < 2) return { q: "", limit: 30 };
    return { q: o.q.trim(), limit: Math.max(1, Math.min(50, o.limit ?? 30)) };
  })
  .handler(async ({ data }) => {
    if (!data.q) return { signals: [], hashtags: [] };
    const sb = publicClient();
    const bareTag = data.q.replace(/^#+/, "").toLowerCase();
    const [{ data: signals }, { data: hashtags }] = await Promise.all([
      sb.from("social_signals")
        .select("id, url, author, published_at, text, hashtags, engagement, sources!inner(name,key)")
        .ilike("text", `%${data.q}%`)
        .order("published_at", { ascending: false, nullsFirst: false })
        .limit(data.limit),
      sb.from("hashtags")
        .select("id, tag, usage_count, current_rank, rank_change")
        .ilike("tag", `%${bareTag}%`)
        .order("usage_count", { ascending: false })
        .limit(15),
    ]);
    return { signals: signals ?? [], hashtags: hashtags ?? [] };
  });
