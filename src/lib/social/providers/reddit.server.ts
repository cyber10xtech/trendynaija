/**
 * Reddit Public Listings Provider.
 *
 * Uses Reddit's public JSON endpoints (e.g. /r/Nigeria/hot.json). These
 * endpoints are publicly available for read-only listing data and are
 * covered by Reddit's Public Content Policy for read-only usage with a
 * descriptive User-Agent. No login/OAuth is required for public reads.
 *
 * We ingest ONLY:
 *  - Post title + selftext (public)
 *  - Author username (public handle only)
 *  - Score / num_comments / upvote ratio (public engagement metrics)
 *  - Permalink + subreddit
 * We never fetch private subreddits, removed content, or user PII.
 */
import type { NormalizedSocialSignal, SocialProvider, ProviderHealth } from "@/lib/providers/contracts";
import { extractHashtagsAndMentions } from "@/lib/providers/contracts";

interface RedditChild {
  kind: string;
  data: {
    id: string;
    name: string;
    title: string;
    selftext?: string;
    author?: string;
    permalink?: string;
    url?: string;
    subreddit?: string;
    created_utc?: number;
    score?: number;
    ups?: number;
    num_comments?: number;
    upvote_ratio?: number;
    over_18?: boolean;
    stickied?: boolean;
    is_video?: boolean;
    link_flair_text?: string | null;
  };
}

interface RedditListing {
  data: { children: RedditChild[] };
}

const USER_AGENT = "TrendyNaija/1.0 (+https://trendynaija.lovable.app; public-trend-intelligence)";

async function fetchListing(url: string): Promise<{ items: NormalizedSocialSignal[]; latencyMs: number; rateLimits: { remaining?: number; resetAt?: string } }> {
  const started = Date.now();
  const res = await fetch(url, {
    headers: { "User-Agent": USER_AGENT, Accept: "application/json" },
    redirect: "follow",
  });
  const latencyMs = Date.now() - started;
  const remainingHeader = res.headers.get("x-ratelimit-remaining");
  const resetHeader = res.headers.get("x-ratelimit-reset");
  const rateLimits = {
    remaining: remainingHeader ? Math.floor(Number(remainingHeader)) : undefined,
    resetAt: resetHeader ? new Date(Date.now() + Number(resetHeader) * 1000).toISOString() : undefined,
  };
  if (!res.ok) throw new Error(`reddit ${res.status}`);
  const body = (await res.json()) as RedditListing;
  const items = (body.data?.children ?? [])
    .filter((c) => c?.kind === "t3" && c.data && !c.data.stickied && !c.data.over_18)
    .map((c) => normalizeChild(c));
  return { items, latencyMs, rateLimits };
}

function normalizeChild(c: RedditChild): NormalizedSocialSignal {
  const d = c.data;
  const raw = [d.title, d.selftext ?? ""].filter(Boolean).join("\n\n");
  const { hashtags, mentions } = extractHashtagsAndMentions(raw);
  return {
    externalId: d.name,
    url: d.permalink ? `https://www.reddit.com${d.permalink}` : d.url,
    text: raw.slice(0, 4000),
    author: d.author,
    publishedAt: d.created_utc ? new Date(d.created_utc * 1000).toISOString() : undefined,
    language: "en",
    hashtags,
    mentions,
    entities: [],
    location: d.subreddit ? `r/${d.subreddit}` : undefined,
    engagement: {
      score: d.score ?? d.ups,
      likes: d.ups,
      comments: d.num_comments,
    },
    category: d.link_flair_text ?? undefined,
    confidence: 0.7,
    raw: d,
  };
}

export function createRedditProvider(opts: { key: string; displayName: string; url: string }): SocialProvider {
  return {
    key: opts.key,
    kind: "social",
    displayName: opts.displayName,
    retryPolicy: { maxAttempts: 3, backoffMs: 2000 },

    async healthCheck(): Promise<ProviderHealth> {
      try {
        const { latencyMs, rateLimits } = await fetchListing(opts.url + (opts.url.includes("?") ? "&limit=1" : "?limit=1"));
        return { status: "healthy", latencyMs, checkedAt: new Date().toISOString(), rateLimits };
      } catch (e) {
        return { status: "down", message: e instanceof Error ? e.message : String(e), checkedAt: new Date().toISOString() };
      }
    },

    async fetchTrending({ limit } = {}) {
      const { items } = await fetchListing(opts.url);
      return typeof limit === "number" ? items.slice(0, limit) : items;
    },

    async fetchRecent({ limit } = {}) {
      const recentUrl = opts.url.replace("/hot.json", "/new.json");
      const { items } = await fetchListing(recentUrl);
      return typeof limit === "number" ? items.slice(0, limit) : items;
    },

    normalize(raw: unknown) {
      return normalizeChild(raw as RedditChild);
    },

    mapEntities(text: string) {
      return extractHashtagsAndMentions(text);
    },
  };
}

export async function fetchRedditListing(url: string) {
  return fetchListing(url);
}
