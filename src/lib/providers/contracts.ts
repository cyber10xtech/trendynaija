/**
 * Provider contracts for Trendy Naija.
 *
 * Every external ingestion source (news, social, search-trend, video, forum)
 * implements one of these interfaces. The Trend Engine + AI Pipeline talk
 * only to these contracts, never to concrete implementations.
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
  rateLimits?: RateLimitInfo;
}

export interface RateLimitInfo {
  remaining?: number;
  limit?: number;
  resetAt?: string;
}

export interface RetryPolicy {
  maxAttempts: number;
  backoffMs: number;
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

/**
 * Normalized shape for a public social post/comment.
 * Trendy Naija stores ONLY the fields required for trend intelligence.
 * We never persist private content or content obtained in violation of ToS.
 */
export interface NormalizedSocialSignal {
  externalId: string;
  url?: string;
  text: string;
  author?: string;
  publishedAt?: string;
  language?: string;
  hashtags: string[];
  mentions: string[];
  entities: Array<{ name: string; type?: "person" | "org" | "location" | "event" | "brand" | "other" }>;
  location?: string;
  engagement: { likes?: number; shares?: number; comments?: number; views?: number; score?: number };
  category?: string;
  confidence?: number;
  raw: unknown;
}

export interface BaseProvider {
  readonly key: string;
  readonly kind: ProviderKind;
  readonly displayName: string;
  readonly retryPolicy?: RetryPolicy;
  healthCheck(): Promise<ProviderHealth>;
  normalize(raw: unknown): NormalizedItem | NormalizedSocialSignal;
}

export interface NewsProvider extends BaseProvider {
  kind: "news";
  fetchLatest(opts?: { limit?: number; stateCode?: string }): Promise<NormalizedItem[]>;
}

export interface SocialProvider extends BaseProvider {
  kind: "social";
  fetchTrending(opts?: { limit?: number; stateCode?: string }): Promise<NormalizedSocialSignal[]>;
  fetchRecent(opts?: { limit?: number; stateCode?: string }): Promise<NormalizedSocialSignal[]>;
  mapEntities?(text: string): { hashtags: string[]; mentions: string[] };
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

/** Shared regex-based extraction used across social providers. */
export function extractHashtagsAndMentions(text: string): { hashtags: string[]; mentions: string[] } {
  const hashtags = Array.from(new Set(
    (text.match(/#[\p{L}0-9_]{2,}/gu) ?? []).map((h) => h.toLowerCase()),
  ));
  const mentions = Array.from(new Set(
    (text.match(/(?<![\w/])@[\p{L}0-9_]{2,}/gu) ?? []).map((m) => m.toLowerCase()),
  ));
  return { hashtags, mentions };
}
