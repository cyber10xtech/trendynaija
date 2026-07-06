/**
 * News Engine — accepts normalized articles, deduplicates them,
 * groups them into clusters, and hands them to the AI pipeline
 * for summarization. Framework only; no fake articles.
 */

import type { NormalizedItem } from "@/lib/providers/contracts";

export interface ArticleCluster {
  id: string;
  title: string;
  summary?: string;
  items: NormalizedItem[];
  firstSeenAt: string;
  lastSeenAt: string;
}

export interface DeduplicationStrategy {
  hash(item: NormalizedItem): string;
}

export interface ClusteringStrategy {
  cluster(items: NormalizedItem[]): Promise<ArticleCluster[]>;
}

export class NewsEngine {
  constructor(
    private dedupe: DeduplicationStrategy,
    private clusterer: ClusteringStrategy,
  ) {}

  async process(incoming: NormalizedItem[]): Promise<ArticleCluster[]> {
    const seen = new Map<string, NormalizedItem>();
    for (const item of incoming) {
      const key = this.dedupe.hash(item);
      if (!seen.has(key)) seen.set(key, item);
    }
    return this.clusterer.cluster(Array.from(seen.values()));
  }
}
