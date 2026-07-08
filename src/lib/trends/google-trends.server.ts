/**
 * Google Trends provider — fetches daily trending searches for a geo
 * from Google's public trending RSS feed, plus optional widget-backed
 * interest-over-time / related-queries / related-topics.
 *
 * Only Node/Web fetch — Cloudflare Worker compatible.
 * We never fabricate data; every function returns `[]` when Google
 * doesn't respond with a parseable payload.
 */

export interface GTrendingItem {
  keyword: string;
  traffic: string | null;
  trafficValue: number | null;
  articles: Array<{ title: string; url: string; source: string; pubDate?: string; snippet?: string; imageUrl?: string }>;
  pubDate?: string;
}

export interface GInterestPoint {
  ts: string; // ISO
  value: number;
}

export interface GRelatedQuery {
  query: string;
  value: number | null;
  type: "top" | "rising" | "breakout";
}

export interface GRelatedTopic {
  name: string;
  slug: string;
  type: string | null;
  strength: number | null;
  relationKind: "top" | "rising" | "breakout";
}

const UA =
  "Mozilla/5.0 (compatible; TrendyNaijaBot/1.0; +https://trendynaija.app)";

function decodeEntities(s: string): string {
  return s
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&#39;/g, "'")
    .replace(/&#x27;/g, "'")
    .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(parseInt(n, 10)));
}

function pickTag(xml: string, tag: string): string | undefined {
  const re = new RegExp(`<${tag}[^>]*>([\\s\\S]*?)<\\/${tag}>`, "i");
  const m = xml.match(re);
  if (!m) return undefined;
  return decodeEntities(m[1].replace(/^<!\[CDATA\[|\]\]>$/g, "").trim());
}

function pickAllTags(xml: string, tag: string): string[] {
  const re = new RegExp(`<${tag}[^>]*>([\\s\\S]*?)<\\/${tag}>`, "gi");
  const out: string[] = [];
  let m: RegExpExecArray | null;
  while ((m = re.exec(xml))) {
    out.push(decodeEntities(m[1].replace(/^<!\[CDATA\[|\]\]>$/g, "").trim()));
  }
  return out;
}

function pickItems(xml: string): string[] {
  return xml.split(/<item\b/i).slice(1).map((chunk) => "<item" + chunk.split(/<\/item>/i)[0] + "</item>");
}

/**
 * Parse Google Trends daily RSS.
 * The endpoint returns items with <title>, <ht:approx_traffic>, and
 * <ht:news_item>...</ht:news_item> blocks that each contain
 * <ht:news_item_title>, <ht:news_item_url>, <ht:news_item_source>,
 * <ht:news_item_snippet>, <ht:news_item_picture>.
 */
export function parseDailyTrendsRss(xml: string): GTrendingItem[] {
  const items = pickItems(xml);
  return items.map((raw) => {
    const keyword = pickTag(raw, "title") ?? "";
    const traffic = pickTag(raw, "ht:approx_traffic") ?? null;
    const trafficValue = traffic ? parseTraffic(traffic) : null;
    const pubDate = pickTag(raw, "pubDate");

    const newsBlocks: string[] = [];
    const re = /<ht:news_item>([\s\S]*?)<\/ht:news_item>/gi;
    let m: RegExpExecArray | null;
    while ((m = re.exec(raw))) newsBlocks.push(m[1]);

    const articles = newsBlocks.map((n) => ({
      title: pickTag(n, "ht:news_item_title") ?? "",
      url: pickTag(n, "ht:news_item_url") ?? "",
      source: pickTag(n, "ht:news_item_source") ?? "",
      snippet: pickTag(n, "ht:news_item_snippet") ?? undefined,
      imageUrl: pickTag(n, "ht:news_item_picture") ?? undefined,
    })).filter((a) => a.title && a.url);

    return { keyword, traffic, trafficValue, articles, pubDate };
  }).filter((i) => i.keyword);
}

function parseTraffic(s: string): number | null {
  const m = s.trim().match(/^([\d.]+)\s*([KMB]?)\+?/i);
  if (!m) return null;
  const n = parseFloat(m[1]);
  if (!Number.isFinite(n)) return null;
  const mult = m[2].toUpperCase() === "K" ? 1_000 : m[2].toUpperCase() === "M" ? 1_000_000 : m[2].toUpperCase() === "B" ? 1_000_000_000 : 1;
  return Math.round(n * mult);
}

async function fetchWithTimeout(url: string, opts: RequestInit = {}, ms = 12000): Promise<Response> {
  const ac = new AbortController();
  const t = setTimeout(() => ac.abort(), ms);
  try {
    return await fetch(url, { ...opts, signal: ac.signal, headers: { "user-agent": UA, ...(opts.headers ?? {}) } });
  } finally {
    clearTimeout(t);
  }
}

export async function fetchTrendingDaily(geo: string): Promise<GTrendingItem[]> {
  // Primary: the new endpoint. Fallback: the legacy path.
  const urls = [
    `https://trends.google.com/trending/rss?geo=${encodeURIComponent(geo)}`,
    `https://trends.google.com/trends/trendingsearches/daily/rss?geo=${encodeURIComponent(geo)}`,
  ];
  let lastErr: unknown = null;
  for (const url of urls) {
    try {
      const res = await fetchWithTimeout(url);
      if (!res.ok) { lastErr = new Error(`${url} → ${res.status}`); continue; }
      const xml = await res.text();
      const items = parseDailyTrendsRss(xml);
      if (items.length > 0) return items;
    } catch (e) { lastErr = e; }
  }
  if (lastErr) console.warn("[google-trends] fetchTrendingDaily failed:", lastErr);
  return [];
}

/**
 * Google Trends widget flow: /trends/api/explore returns widget descriptors
 * (each with a token + request). We then hit the widget endpoint to get
 * data. Both responses are prefixed with `)]}',\n` which must be stripped.
 * When Google returns 429 / HTML / anything unparseable we return null and
 * the caller records that in provider_logs.
 */
async function callWidget<T>(endpoint: string, req: unknown, token: string): Promise<T | null> {
  const url = `https://trends.google.com/trends/api/widgetdata/${endpoint}?hl=en-US&tz=-60&req=${encodeURIComponent(
    JSON.stringify(req),
  )}&token=${encodeURIComponent(token)}`;
  const res = await fetchWithTimeout(url);
  if (!res.ok) return null;
  const text = await res.text();
  const clean = text.replace(/^\)\]\}',?\s*/, "");
  try { return JSON.parse(clean) as T; } catch { return null; }
}

async function exploreWidgets(keyword: string, geo: string, timeframe = "now 7-d") {
  const req = {
    comparisonItem: [{ keyword, geo, time: timeframe }],
    category: 0,
    property: "",
  };
  const url = `https://trends.google.com/trends/api/explore?hl=en-US&tz=-60&req=${encodeURIComponent(
    JSON.stringify(req),
  )}`;
  const res = await fetchWithTimeout(url);
  if (!res.ok) return null;
  const text = await res.text();
  const clean = text.replace(/^\)\]\}',?\s*/, "");
  try {
    const json = JSON.parse(clean) as { widgets: Array<{ id: string; token: string; request: unknown }> };
    return json.widgets ?? null;
  } catch { return null; }
}

export async function fetchInterestOverTime(keyword: string, geo: string, timeframe = "now 7-d"): Promise<GInterestPoint[]> {
  const widgets = await exploreWidgets(keyword, geo, timeframe);
  if (!widgets) return [];
  const w = widgets.find((x) => x.id === "TIMESERIES");
  if (!w) return [];
  const data = await callWidget<{ default: { timelineData: Array<{ time: string; value: number[] }> } }>(
    "multiline", w.request, w.token,
  );
  if (!data?.default?.timelineData) return [];
  return data.default.timelineData.map((p) => ({
    ts: new Date(parseInt(p.time, 10) * 1000).toISOString(),
    value: p.value?.[0] ?? 0,
  }));
}

export async function fetchRelatedQueries(keyword: string, geo: string): Promise<GRelatedQuery[]> {
  const widgets = await exploreWidgets(keyword, geo);
  if (!widgets) return [];
  const w = widgets.find((x) => x.id === "RELATED_QUERIES");
  if (!w) return [];
  const data = await callWidget<{ default: { rankedList: Array<{ rankedKeyword: Array<{ query: string; value: number; formattedValue?: string }> }> } }>(
    "relatedsearches", w.request, w.token,
  );
  if (!data?.default?.rankedList) return [];
  const [top, rising] = data.default.rankedList;
  const out: GRelatedQuery[] = [];
  for (const r of top?.rankedKeyword ?? []) out.push({ query: r.query, value: r.value, type: "top" });
  for (const r of rising?.rankedKeyword ?? []) {
    const breakout = (r.formattedValue ?? "").toLowerCase().includes("breakout");
    out.push({ query: r.query, value: r.value, type: breakout ? "breakout" : "rising" });
  }
  return out;
}

export async function fetchRelatedTopics(keyword: string, geo: string): Promise<GRelatedTopic[]> {
  const widgets = await exploreWidgets(keyword, geo);
  if (!widgets) return [];
  const w = widgets.find((x) => x.id === "RELATED_TOPICS");
  if (!w) return [];
  const data = await callWidget<{ default: { rankedList: Array<{ rankedKeyword: Array<{ topic: { title: string; type?: string; mid?: string }; value: number; formattedValue?: string }> }> } }>(
    "relatedsearches", w.request, w.token,
  );
  if (!data?.default?.rankedList) return [];
  const [top, rising] = data.default.rankedList;
  const out: GRelatedTopic[] = [];
  const slug = (s: string) => s.toLowerCase().normalize("NFKD").replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
  for (const r of top?.rankedKeyword ?? []) out.push({
    name: r.topic.title, slug: slug(r.topic.title), type: r.topic.type ?? null, strength: r.value, relationKind: "top",
  });
  for (const r of rising?.rankedKeyword ?? []) {
    const breakout = (r.formattedValue ?? "").toLowerCase().includes("breakout");
    out.push({
      name: r.topic.title, slug: slug(r.topic.title), type: r.topic.type ?? null, strength: r.value,
      relationKind: breakout ? "breakout" : "rising",
    });
  }
  return out;
}

export async function healthCheck(): Promise<{ ok: boolean; latencyMs: number; message?: string }> {
  const t0 = Date.now();
  try {
    const res = await fetchWithTimeout("https://trends.google.com/trending/rss?geo=NG", {}, 6000);
    return { ok: res.ok, latencyMs: Date.now() - t0, message: res.ok ? undefined : `HTTP ${res.status}` };
  } catch (e) {
    return { ok: false, latencyMs: Date.now() - t0, message: (e as Error).message };
  }
}

export function slugify(s: string): string {
  return s.toLowerCase().normalize("NFKD").replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 120);
}
