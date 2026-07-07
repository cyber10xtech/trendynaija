/**
 * RSS/Atom fetch + parse. Server-only.
 */
import { XMLParser } from "fast-xml-parser";

export interface RawFeedItem {
  guid?: string;
  link?: string;
  title?: string;
  description?: string;
  content?: string;
  author?: string;
  categories?: string[];
  publishedAt?: string;
  imageUrl?: string;
}

const parser = new XMLParser({
  ignoreAttributes: false,
  attributeNamePrefix: "@_",
  trimValues: true,
});

function pickText(v: unknown): string | undefined {
  if (v == null) return undefined;
  if (typeof v === "string") return v;
  if (typeof v === "object") {
    const obj = v as Record<string, unknown>;
    if (typeof obj["#text"] === "string") return obj["#text"] as string;
    if (typeof obj["@_href"] === "string") return obj["@_href"] as string;
  }
  return undefined;
}

function stripHtml(s: string): string {
  return s
    .replace(/<script[\s\S]*?<\/script>/gi, "")
    .replace(/<style[\s\S]*?<\/style>/gi, "")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/\s+/g, " ")
    .trim();
}

function extractImage(item: Record<string, unknown>, htmlContent?: string): string | undefined {
  const enc = item["enclosure"] as Record<string, unknown> | undefined;
  if (enc && typeof enc["@_url"] === "string") return enc["@_url"] as string;
  const media = (item["media:content"] ?? item["media:thumbnail"]) as
    | Record<string, unknown>
    | undefined;
  if (media && typeof media["@_url"] === "string") return media["@_url"] as string;
  if (htmlContent) {
    const m = htmlContent.match(/<img[^>]+src=["']([^"']+)["']/i);
    if (m) return m[1];
  }
  return undefined;
}

function toArray<T>(v: T | T[] | undefined): T[] {
  if (v == null) return [];
  return Array.isArray(v) ? v : [v];
}

export async function fetchAndParseFeed(url: string, timeoutMs = 15000): Promise<{
  items: RawFeedItem[];
  latencyMs: number;
}> {
  const started = Date.now();
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(url, {
      signal: controller.signal,
      headers: {
        "User-Agent": "TrendyNaijaBot/1.0 (+https://trendynaija.ng)",
        Accept: "application/rss+xml, application/atom+xml, application/xml, text/xml;q=0.9, */*;q=0.5",
      },
      redirect: "follow",
    });
    if (!res.ok) throw new Error(`HTTP ${res.status} fetching ${url}`);
    const text = await res.text();
    const parsed = parser.parse(text) as Record<string, unknown>;

    const rss = parsed["rss"] as Record<string, unknown> | undefined;
    const channel = rss?.["channel"] as Record<string, unknown> | undefined;
    const feed = parsed["feed"] as Record<string, unknown> | undefined;

    let rawItems: Record<string, unknown>[] = [];
    if (channel) rawItems = toArray(channel["item"] as unknown) as Record<string, unknown>[];
    else if (feed) rawItems = toArray(feed["entry"] as unknown) as Record<string, unknown>[];

    const items: RawFeedItem[] = rawItems.map((it) => {
      const rawContent =
        pickText(it["content:encoded"]) ??
        pickText(it["content"]) ??
        pickText(it["description"]) ??
        pickText(it["summary"]);
      const content = rawContent ? stripHtml(rawContent) : undefined;
      const description = pickText(it["description"]) ?? pickText(it["summary"]);
      const link = pickText(it["link"]);
      const authorRaw = pickText(it["dc:creator"]) ?? pickText(it["author"]);
      const categoriesRaw = toArray(it["category"] as unknown);
      const categories = categoriesRaw
        .map((c) => pickText(c))
        .filter((c): c is string => !!c);
      return {
        guid: pickText(it["guid"]) ?? link,
        link,
        title: pickText(it["title"]),
        description: description ? stripHtml(description) : undefined,
        content,
        author: authorRaw ? stripHtml(authorRaw) : undefined,
        categories,
        publishedAt:
          pickText(it["pubDate"]) ??
          pickText(it["published"]) ??
          pickText(it["updated"]) ??
          pickText(it["dc:date"]),
        imageUrl: extractImage(it, rawContent),
      };
    });

    return { items, latencyMs: Date.now() - started };
  } finally {
    clearTimeout(timer);
  }
}
