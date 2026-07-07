/**
 * News ingestion orchestrator. Called by the /api/public/hooks/ingest route.
 *
 * For each enabled news source:
 *   1. Open ingestion_jobs row (status=running).
 *   2. Fetch RSS via rss.server.
 *   3. Normalize + categorize + dedup + upsert news_articles.
 *   4. Assign each new article to a cluster (find or create).
 *   5. Update provider health + last_sync_at.
 *   6. Emit provider_logs and close job with counts.
 *
 * AI summarization runs in a second pass (summarizeStaleClusters) so a
 * gateway outage never blocks ingestion.
 */
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { fetchAndParseFeed, type RawFeedItem } from "./rss.server";
import { classifyCategory } from "./categorize.server";
import { contentHash, tokenize } from "./hashing.server";
import { findMatchingCluster, type ClusterCandidate } from "./cluster.server";
import { summarizeCluster } from "./ai.server";

export interface IngestReport {
  sourceKey: string;
  sourceName: string;
  fetched: number;
  inserted: number;
  duplicates: number;
  clustersCreated: number;
  clustersUpdated: number;
  latencyMs: number;
  error?: string;
}

interface SourceRow {
  id: string;
  key: string;
  name: string;
  base_url: string | null;
  enabled: boolean;
  retry_count: number;
}

async function logProvider(
  sourceId: string,
  jobId: string | null,
  level: "info" | "warn" | "error",
  message: string,
  metadata: Record<string, unknown> = {},
) {
  await supabaseAdmin.from("provider_logs").insert({
    source_id: sourceId,
    job_id: jobId,
    level,
    message,
    metadata: metadata as never,
  });
}

function parseDate(v?: string | null): string | null {
  if (!v) return null;
  const t = Date.parse(v);
  return Number.isFinite(t) ? new Date(t).toISOString() : null;
}

async function loadRecentClusterCandidates(): Promise<ClusterCandidate[]> {
  const cutoff = new Date(Date.now() - 48 * 60 * 60 * 1000).toISOString();
  const { data, error } = await supabaseAdmin
    .from("article_clusters")
    .select("id, title, last_seen_at")
    .gte("last_seen_at", cutoff)
    .order("last_seen_at", { ascending: false })
    .limit(500);
  if (error) throw error;
  return (data ?? [])
    .filter((c): c is { id: string; title: string; last_seen_at: string } => !!c.last_seen_at)
    .map((c) => ({
      id: c.id,
      title: c.title,
      tokens: new Set(tokenize(c.title)),
      lastSeenAt: c.last_seen_at,
    }));
}

async function ingestSource(source: SourceRow): Promise<IngestReport> {
  const report: IngestReport = {
    sourceKey: source.key,
    sourceName: source.name,
    fetched: 0,
    inserted: 0,
    duplicates: 0,
    clustersCreated: 0,
    clustersUpdated: 0,
    latencyMs: 0,
  };

  if (!source.base_url) {
    report.error = "No base_url configured";
    return report;
  }

  const { data: jobRow, error: jobErr } = await supabaseAdmin
    .from("ingestion_jobs")
    .insert({ source_id: source.id, status: "running", started_at: new Date().toISOString() })
    .select("id")
    .single();
  if (jobErr) throw jobErr;
  const jobId = jobRow.id as string;

  const startedAt = Date.now();
  try {
    const { items, latencyMs } = await fetchAndParseFeed(source.base_url);
    report.fetched = items.length;
    report.latencyMs = latencyMs;

    const candidates = await loadRecentClusterCandidates();
    const newlyCreated = new Map<string, ClusterCandidate>();

    for (const item of items) {
      if (!item.title || !item.link) continue;
      const publishedAt = parseDate(item.publishedAt);
      const hash = contentHash({ title: item.title, url: item.link });

      const { data: existing } = await supabaseAdmin
        .from("news_articles")
        .select("id")
        .or(`content_hash.eq.${hash},url.eq.${item.link}`)
        .maybeSingle();
      if (existing) {
        report.duplicates++;
        continue;
      }

      const category = classifyCategory({
        title: item.title,
        content: item.content ?? item.description,
        categories: item.categories,
      });

      // Cluster resolution
      const allCandidates = [...candidates, ...newlyCreated.values()];
      const matched = findMatchingCluster(
        { title: item.title, publishedAt },
        allCandidates,
      );

      let clusterId: string;
      const nowIso = new Date().toISOString();
      if (matched) {
        clusterId = matched.id;
        const { data: cc } = await supabaseAdmin
          .from("article_clusters")
          .select("article_count")
          .eq("id", matched.id)
          .single();
        await supabaseAdmin
          .from("article_clusters")
          .update({
            last_seen_at: publishedAt ?? nowIso,
            article_count: (cc?.article_count ?? 0) + 1,
          })
          .eq("id", matched.id);
        report.clustersUpdated++;
      } else {
        const { data: newCluster, error: cErr } = await supabaseAdmin
          .from("article_clusters")
          .insert({
            title: item.title,
            first_seen_at: publishedAt ?? nowIso,
            last_seen_at: publishedAt ?? nowIso,
            article_count: 1,
            category,
            image_url: item.imageUrl ?? null,
          })
          .select("id, last_seen_at, title")
          .single();
        if (cErr) throw cErr;
        clusterId = newCluster.id;
        newlyCreated.set(clusterId, {
          id: clusterId,
          title: newCluster.title,
          tokens: new Set(tokenize(newCluster.title)),
          lastSeenAt: newCluster.last_seen_at ?? nowIso,
        });
        report.clustersCreated++;
      }

      const { data: inserted, error: insErr } = await supabaseAdmin
        .from("news_articles")
        .insert({
          source_id: source.id,
          cluster_id: clusterId,
          external_id: item.guid ?? item.link,
          url: item.link,
          title: item.title,
          author: item.author ?? null,
          content: item.content ?? null,
          summary: item.description ?? null,
          image_url: item.imageUrl ?? null,
          language: "en",
          published_at: publishedAt,
          content_hash: hash,
          category,
        })
        .select("id")
        .single();
      if (insErr) {
        // race dedup — treat as duplicate
        report.duplicates++;
        continue;
      }
      report.inserted++;

      // Set canonical article on first insert if none set
      await supabaseAdmin
        .from("article_clusters")
        .update({ canonical_article_id: inserted.id })
        .eq("id", clusterId)
        .is("canonical_article_id", null);
    }

    await supabaseAdmin
      .from("sources")
      .update({
        status: "healthy",
        last_sync_at: new Date().toISOString(),
        last_error: null,
        retry_count: 0,
      })
      .eq("id", source.id);

    await supabaseAdmin
      .from("ingestion_jobs")
      .update({
        status: "succeeded",
        finished_at: new Date().toISOString(),
        items_ingested: report.inserted,
        metadata: {
          fetched: report.fetched,
          duplicates: report.duplicates,
          clustersCreated: report.clustersCreated,
          clustersUpdated: report.clustersUpdated,
          latencyMs: report.latencyMs,
          durationMs: Date.now() - startedAt,
        } as never,
      })
      .eq("id", jobId);

    await logProvider(source.id, jobId, "info", `Ingested ${report.inserted} articles`, {
      ...report,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    report.error = message;
    await supabaseAdmin
      .from("sources")
      .update({
        status: "down",
        last_error: message,
        retry_count: (source.retry_count ?? 0) + 1,
      })
      .eq("id", source.id);
    await supabaseAdmin
      .from("ingestion_jobs")
      .update({
        status: "failed",
        finished_at: new Date().toISOString(),
        error_message: message,
        retry_count: (source.retry_count ?? 0) + 1,
      })
      .eq("id", jobId);
    await logProvider(source.id, jobId, "error", `Ingestion failed: ${message}`);
  }

  return report;
}

export async function runIngestion(options?: { sourceKey?: string }): Promise<IngestReport[]> {
  const q = supabaseAdmin
    .from("sources")
    .select("id, key, name, base_url, enabled, retry_count")
    .eq("kind", "news")
    .eq("enabled", true);
  if (options?.sourceKey) q.eq("key", options.sourceKey);
  const { data, error } = await q;
  if (error) throw error;

  const reports: IngestReport[] = [];
  for (const src of data ?? []) {
    reports.push(await ingestSource(src as SourceRow));
  }
  return reports;
}

/**
 * Second-pass AI summarization for clusters that changed recently
 * and don't have an AI summary yet.
 */
export async function summarizeStaleClusters(limit = 10): Promise<number> {
  const { data: clusters } = await supabaseAdmin
    .from("article_clusters")
    .select("id, title, last_seen_at, article_count")
    .order("last_seen_at", { ascending: false })
    .limit(50);
  if (!clusters) return 0;

  // Filter to clusters without an existing summary
  const ids = clusters.map((c) => c.id);
  const { data: existing } = await supabaseAdmin
    .from("ai_summaries")
    .select("subject_id")
    .eq("subject_type", "cluster")
    .in("subject_id", ids);
  const done = new Set((existing ?? []).map((r) => r.subject_id));

  const pending = clusters.filter((c) => !done.has(c.id)).slice(0, limit);
  let count = 0;

  for (const cluster of pending) {
    const { data: articles } = await supabaseAdmin
      .from("news_articles")
      .select("title, content, url, source_id, sources!inner(name)")
      .eq("cluster_id", cluster.id)
      .order("published_at", { ascending: false })
      .limit(6);
    if (!articles || articles.length === 0) continue;

    const result = await summarizeCluster(
      articles.map((a: {
        title: string;
        content: string | null;
        url: string;
        sources: { name: string } | { name: string }[] | null;
      }) => ({
        title: a.title,
        content: a.content,
        url: a.url,
        source: Array.isArray(a.sources) ? a.sources[0]?.name : a.sources?.name,
      })),
    );
    if (!result) continue;

    await supabaseAdmin.from("ai_summaries").insert({
      subject_type: "cluster",
      subject_id: cluster.id,
      model: "openai/gpt-5.5",
      summary: result.detailedSummary,
      short_summary: result.shortSummary,
      detailed_summary: result.detailedSummary,
      bullet_points: result.keyPoints as never,
      topics: result.topics as never,
      entities: result.entities as never,
      categories: result.categories as never,
      confidence: result.confidence,
    });

    const primaryCategory = result.categories[0];
    if (primaryCategory) {
      await supabaseAdmin
        .from("article_clusters")
        .update({
          summary: result.shortSummary,
          category: primaryCategory,
        })
        .eq("id", cluster.id);
    } else {
      await supabaseAdmin
        .from("article_clusters")
        .update({ summary: result.shortSummary })
        .eq("id", cluster.id);
    }
    count++;
  }
  return count;
}

export type { RawFeedItem };
