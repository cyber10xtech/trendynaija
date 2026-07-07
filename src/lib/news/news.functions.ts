/**
 * Read-side server functions for the News layer. Public — anyone can read
 * ingested articles and clusters. Admin-only mutations live in
 * news.admin.functions.ts.
 */
import { createServerFn } from "@tanstack/react-start";

interface ClusterSummary {
  id: string;
  title: string;
  summary: string | null;
  category: string | null;
  image_url: string | null;
  article_count: number;
  last_seen_at: string | null;
  first_seen_at: string | null;
}

async function serverClient() {
  const { createClient } = await import("@supabase/supabase-js");
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  void createClient;
  return supabaseAdmin;
}

export const listLatestClusters = createServerFn({ method: "GET" })
  .inputValidator((input: unknown) => {
    const i = (input ?? {}) as { limit?: number; category?: string };
    return { limit: Math.min(Math.max(i.limit ?? 20, 1), 100), category: i.category };
  })
  .handler(async ({ data }) => {
    const supabase = await serverClient();
    let q = supabase
      .from("article_clusters")
      .select(
        "id, title, summary, category, image_url, article_count, last_seen_at, first_seen_at",
      )
      .order("last_seen_at", { ascending: false })
      .limit(data.limit);
    if (data.category) q = q.eq("category", data.category);
    const { data: rows, error } = await q;
    if (error) throw error;
    return (rows ?? []) as ClusterSummary[];
  });

export const getClusterDetail = createServerFn({ method: "GET" })
  .inputValidator((input: unknown) => {
    const i = input as { id: string };
    if (!i?.id) throw new Error("id required");
    return { id: i.id };
  })
  .handler(async ({ data }) => {
    const supabase = await serverClient();
    const { data: cluster, error } = await supabase
      .from("article_clusters")
      .select("id, title, summary, category, image_url, article_count, last_seen_at, first_seen_at, canonical_article_id")
      .eq("id", data.id)
      .maybeSingle();
    if (error) throw error;
    if (!cluster) return null;

    const { data: articles } = await supabase
      .from("news_articles")
      .select("id, title, url, author, published_at, image_url, category, summary, source_id, sources(name, key)")
      .eq("cluster_id", data.id)
      .order("published_at", { ascending: false });

    const { data: summary } = await supabase
      .from("ai_summaries")
      .select("short_summary, detailed_summary, bullet_points, topics, entities, categories, confidence, model, updated_at")
      .eq("subject_type", "cluster")
      .eq("subject_id", data.id)
      .order("updated_at", { ascending: false })
      .maybeSingle();

    return { cluster, articles: articles ?? [], summary };
  });

export const listArticles = createServerFn({ method: "GET" })
  .inputValidator((input: unknown) => {
    const i = (input ?? {}) as {
      limit?: number;
      offset?: number;
      category?: string;
      sourceId?: string;
      q?: string;
      from?: string;
      to?: string;
    };
    return {
      limit: Math.min(Math.max(i.limit ?? 30, 1), 100),
      offset: Math.max(i.offset ?? 0, 0),
      category: i.category,
      sourceId: i.sourceId,
      q: i.q?.trim() || undefined,
      from: i.from,
      to: i.to,
    };
  })
  .handler(async ({ data }) => {
    const supabase = await serverClient();
    let q = supabase
      .from("news_articles")
      .select(
        "id, title, url, author, published_at, image_url, category, summary, cluster_id, source_id, sources(name, key)",
        { count: "exact" },
      )
      .order("published_at", { ascending: false, nullsFirst: false })
      .range(data.offset, data.offset + data.limit - 1);
    if (data.category) q = q.eq("category", data.category);
    if (data.sourceId) q = q.eq("source_id", data.sourceId);
    if (data.q) q = q.ilike("title", `%${data.q}%`);
    if (data.from) q = q.gte("published_at", data.from);
    if (data.to) q = q.lte("published_at", data.to);
    const { data: rows, error, count } = await q;
    if (error) throw error;
    return { articles: rows ?? [], total: count ?? 0 };
  });

export const getArticle = createServerFn({ method: "GET" })
  .inputValidator((input: unknown) => {
    const i = input as { id: string };
    if (!i?.id) throw new Error("id required");
    return { id: i.id };
  })
  .handler(async ({ data }) => {
    const supabase = await serverClient();
    const { data: article, error } = await supabase
      .from("news_articles")
      .select("*, sources(name, key)")
      .eq("id", data.id)
      .maybeSingle();
    if (error) throw error;
    return article;
  });

export const dashboardStats = createServerFn({ method: "GET" }).handler(async () => {
  const supabase = await serverClient();
  const [{ count: articles }, { count: clusters }, { count: sources }, { data: byCategory }, { data: topCluster }] =
    await Promise.all([
      supabase.from("news_articles").select("*", { count: "exact", head: true }),
      supabase.from("article_clusters").select("*", { count: "exact", head: true }),
      supabase.from("sources").select("*", { count: "exact", head: true }).eq("enabled", true),
      supabase
        .from("news_articles")
        .select("category")
        .not("category", "is", null)
        .limit(2000),
      supabase
        .from("article_clusters")
        .select("id, title, summary, category, image_url, article_count, last_seen_at")
        .order("article_count", { ascending: false })
        .limit(1),
    ]);
  const catCounts = new Map<string, number>();
  for (const row of byCategory ?? []) {
    if (!row.category) continue;
    catCounts.set(row.category, (catCounts.get(row.category) ?? 0) + 1);
  }
  const categories = Array.from(catCounts.entries())
    .map(([name, count]) => ({ name, count }))
    .sort((a, b) => b.count - a.count);
  return {
    articles: articles ?? 0,
    clusters: clusters ?? 0,
    activeSources: sources ?? 0,
    categories,
    breakingCluster: topCluster?.[0] ?? null,
  };
});

export const listProvidersHealth = createServerFn({ method: "GET" }).handler(async () => {
  const supabase = await serverClient();
  const { data, error } = await supabase
    .from("sources")
    .select("id, key, name, kind, status, enabled, last_sync_at, last_error, retry_count, base_url")
    .order("name");
  if (error) throw error;

  const ids = (data ?? []).map((s) => s.id);
  const { data: jobs } = ids.length
    ? await supabase
        .from("ingestion_jobs")
        .select("source_id, status, items_ingested, finished_at, metadata")
        .in("source_id", ids)
        .order("created_at", { ascending: false })
        .limit(200)
    : { data: [] as never[] };

  const lastJobBySource = new Map<string, { itemsIngested: number; latencyMs: number | null; status: string }>();
  const failuresBySource = new Map<string, number>();
  for (const j of jobs ?? []) {
    if (!j.source_id) continue;
    if (j.status === "failed") {
      failuresBySource.set(j.source_id, (failuresBySource.get(j.source_id) ?? 0) + 1);
    }
    if (!lastJobBySource.has(j.source_id)) {
      const meta = (j.metadata ?? {}) as { latencyMs?: number };
      lastJobBySource.set(j.source_id, {
        itemsIngested: j.items_ingested ?? 0,
        latencyMs: meta.latencyMs ?? null,
        status: j.status,
      });
    }
  }
  return (data ?? []).map((s) => ({
    ...s,
    lastJob: lastJobBySource.get(s.id) ?? null,
    failureCount: failuresBySource.get(s.id) ?? 0,
  }));
});

export const listProviderLogs = createServerFn({ method: "GET" })
  .inputValidator((input: unknown) => {
    const i = (input ?? {}) as { sourceId?: string; limit?: number };
    return { sourceId: i.sourceId, limit: Math.min(Math.max(i.limit ?? 30, 1), 200) };
  })
  .handler(async ({ data }) => {
    const supabase = await serverClient();
    let q = supabase
      .from("provider_logs")
      .select("id, source_id, job_id, level, message, metadata, created_at, sources(name, key)")
      .order("created_at", { ascending: false })
      .limit(data.limit);
    if (data.sourceId) q = q.eq("source_id", data.sourceId);
    const { data: rows, error } = await q;
    if (error) throw error;
    return rows ?? [];
  });
