/**
 * Provider contracts for Trendy Naija.
 *
 * Every external ingestion source (news outlets, social platforms, search
 * trend APIs, video platforms, forums) implements one of these interfaces.
 * This lets us plug in new providers without touching the trend engine,
 * news engine, or AI pipeline.
 */

export type ProviderKind =
  | "news"
  | "social"
  | "search_trend"
  | "video"
  | "forum"
  | "other";

export interface ProviderHealth {
  status: "healthy" | "degraded" | "down" | "unknown" | "disabled";
  latencyMs?: number;
  message?: string;
  checkedAt: string;
}

export interface NormalizedItem {
  externalId: string;
  url?: string;
  title: string;
  content?: string;
  author?: string;
  publishedAt?: string;
  language?: string;
  imageUrl?: string;
  raw: unknown;
}

export interface BaseProvider {
  readonly key: string;
  readonly kind: ProviderKind;
  readonly displayName: string;
  healthCheck(): Promise<ProviderHealth>;
  normalize(raw: unknown): NormalizedItem;
}

export interface NewsProvider extends BaseProvider {
  kind: "news";
  fetchLatest(opts?: { limit?: number; stateCode?: string }): Promise<NormalizedItem[]>;
}

export interface SocialProvider extends BaseProvider {
  kind: "social";
  fetchTrending(opts?: { limit?: number; stateCode?: string }): Promise<NormalizedItem[]>;
}

export interface SearchTrendProvider extends BaseProvider {
  kind: "search_trend";
  fetchTrending(opts?: { geo?: string; limit?: number }): Promise<NormalizedItem[]>;
}

export interface VideoProvider extends BaseProvider {
  kind: "video";
  fetchTrending(opts?: { limit?: number; stateCode?: string }): Promise<NormalizedItem[]>;
}

export interface ForumProvider extends BaseProvider {
  kind: "forum";
  fetchLatest(opts?: { limit?: number }): Promise<NormalizedItem[]>;
}

export type AnyProvider =
  | NewsProvider
  | SocialProvider
  | SearchTrendProvider
  | VideoProvider
  | ForumProvider;
