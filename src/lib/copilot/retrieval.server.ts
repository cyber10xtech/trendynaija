/**
 * Grounded retrieval for the AI Copilot.
 *
 * The Copilot never answers from model memory. Every question is answered
 * from evidence blocks pulled out of Trendy Naija's own intelligence store:
 * topics, article clusters, news articles, social signals, hashtags,
 * regional stats, daily briefs and alerts. Each block carries a citation tag
 * the model must reference.
 */
import { supabaseAdmin } from "@/integrations/supabase/client.server";

export interface Citation {
  tag: string;
  label: string;
  kind: "topic" | "cluster" | "article" | "signal" | "hashtag" | "region" | "brief" | "alert";
  ref: string;
  url?: string | null;
}

export interface EvidencePack {
  blocks: string[];
  citations: Citation[];
}

function keywords(q: string): string[] {
  const stop = new Set([
    "what", "which", "where", "when", "about", "trending", "nigeria", "naija",
    "today", "there", "these", "those", "have", "does", "with", "from", "this",
    "that", "tell", "show", "give", "please", "into", "most", "them", "they",
  ]);
  return q
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s]/gu, " ")
    .split(/\s+/)
    .filter((w) => w.length > 3 && !stop.has(w))
    .slice(0, 5);
}

export async function buildEvidence(question: string): Promise<EvidencePack> {
  const kws = keywords(question);
  const primary = kws[0];
  const blocks: string[] = [];
  const citations: Citation[] = [];

  const topicsQ = primary
    ? supabaseAdmin
        .from("topics")
        .select("id, name, slug, category, lifecycle_state, velocity, momentum")
        .ilike("name", `%${primary}%`)
        .limit(8)
    : supabaseAdmin
        .from("topics")
        .select("id, name, slug, category, lifecycle_state, velocity, momentum")
        .order("momentum", { ascending: false })
        .limit(8);

  const clustersQ = primary
    ? supabaseAdmin
        .from("article_clusters")
        .select("id, title, summary, category, article_count, last_seen_at")
        .ilike("title", `%${primary}%`)
        .limit(8)
    : supabaseAdmin
        .from("article_clusters")
        .select("id, title, summary, category, article_count, last_seen_at")
        .order("last_seen_at", { ascending: false })
        .limit(8);

  const articlesQ = primary
    ? supabaseAdmin
        .from("news_articles")
        .select("id, title, url, summary, category, published_at, sources(name)")
        .ilike("title", `%${primary}%`)
        .order("published_at", { ascending: false })
        .limit(10)
    : supabaseAdmin
        .from("news_articles")
        .select("id, title, url, summary, category, published_at, sources(name)")
        .order("published_at", { ascending: false })
        .limit(10);

  const today = new Date().toISOString().slice(0, 10);

  const [topics, clusters, articles, hashtags, briefs, alerts, regions, signals] = await Promise.all([
    topicsQ,
    clustersQ,
    articlesQ,
    supabaseAdmin
      .from("hashtags")
      .select("id, tag, usage_count, current_rank, rank_change, momentum, category")
      .order("momentum", { ascending: false })
      .limit(10),
    supabaseAdmin
      .from("daily_briefs")
      .select("id, title, summary, scope, category, brief_date")
      .lte("brief_date", today)
      .order("brief_date", { ascending: false })
      .limit(4),
    supabaseAdmin
      .from("trend_alerts")
      .select("id, title, message, alert_type, severity, fired_at")
      .eq("resolved", false)
      .order("fired_at", { ascending: false })
      .limit(6),
    supabaseAdmin
      .from("regional_trend_stats")
      .select("id, trend_score, signal_count, news_count, social_count, growth, states(name)")
      .eq("scope", "state")
      .eq("time_window", "24h")
      .order("trend_score", { ascending: false })
      .limit(8),
    supabaseAdmin
      .from("social_signals")
      .select("id, text, url, published_at, sources(name)")
      .order("published_at", { ascending: false })
      .limit(8),
  ]);

  (topics.data ?? []).forEach((t, i) => {
    const tag = `T${i + 1}`;
    blocks.push(
      `[${tag}] TOPIC "${t.name}" · category ${t.category ?? "—"} · lifecycle ${t.lifecycle_state} · velocity ${Number(t.velocity ?? 0).toFixed(2)} · momentum ${Number(t.momentum ?? 0).toFixed(2)}`,
    );
    citations.push({ tag, label: t.name, kind: "topic", ref: t.slug });
  });

  (clusters.data ?? []).forEach((c, i) => {
    const tag = `C${i + 1}`;
    blocks.push(
      `[${tag}] STORY CLUSTER "${c.title}" · ${c.article_count} articles · ${c.category ?? "—"} · last seen ${c.last_seen_at ?? "?"}\n${(c.summary ?? "").slice(0, 500)}`,
    );
    citations.push({ tag, label: c.title, kind: "cluster", ref: c.id });
  });

  (articles.data ?? []).forEach((a, i) => {
    const tag = `A${i + 1}`;
    const src = (a as unknown as { sources?: { name?: string } }).sources?.name ?? "source";
    blocks.push(
      `[${tag}] ARTICLE "${a.title}" · ${src} · ${a.published_at ?? "?"}\n${(a.summary ?? "").slice(0, 350)}`,
    );
    citations.push({ tag, label: a.title, kind: "article", ref: a.id, url: a.url });
  });

  (hashtags.data ?? []).forEach((h, i) => {
    const tag = `H${i + 1}`;
    blocks.push(
      `[${tag}] HASHTAG ${h.tag} · uses ${h.usage_count} · rank ${h.current_rank ?? "—"} (change ${h.rank_change}) · momentum ${Number(h.momentum ?? 0).toFixed(2)}`,
    );
    citations.push({ tag, label: h.tag, kind: "hashtag", ref: h.id });
  });

  (regions.data ?? []).forEach((r, i) => {
    const tag = `R${i + 1}`;
    const name = (r as unknown as { states?: { name?: string } }).states?.name ?? "state";
    blocks.push(
      `[${tag}] REGION ${name} (24h) · trend score ${Number(r.trend_score).toFixed(2)} · ${r.signal_count} signals · ${r.news_count} news · ${r.social_count} social · growth ${Number(r.growth ?? 0).toFixed(2)}`,
    );
    citations.push({ tag, label: name, kind: "region", ref: r.id });
  });

  (briefs.data ?? []).forEach((b, i) => {
    const tag = `B${i + 1}`;
    blocks.push(`[${tag}] DAILY BRIEF (${b.scope}${b.category ? `/${b.category}` : ""}, ${b.brief_date}) "${b.title}"\n${(b.summary ?? "").slice(0, 600)}`);
    citations.push({ tag, label: b.title, kind: "brief", ref: b.id });
  });

  (alerts.data ?? []).forEach((a, i) => {
    const tag = `X${i + 1}`;
    blocks.push(`[${tag}] OPEN ALERT (${a.alert_type}/${a.severity}) "${a.title}" — ${(a.message ?? "").slice(0, 220)}`);
    citations.push({ tag, label: a.title, kind: "alert", ref: a.id });
  });

  (signals.data ?? []).forEach((s, i) => {
    const tag = `S${i + 1}`;
    const src = (s as unknown as { sources?: { name?: string } }).sources?.name ?? "social";
    blocks.push(`[${tag}] SOCIAL SIGNAL (${src}, ${s.published_at ?? "?"}) ${s.text.slice(0, 260)}`);
    citations.push({ tag, label: `${src} signal`, kind: "signal", ref: s.id, url: s.url });
  });

  return { blocks, citations };
}

export function copilotSystemPrompt(evidence: EvidencePack): string {
  const hasEvidence = evidence.blocks.length > 0;
  return `You are the Trendy Naija AI Copilot — an analyst for a Nigerian trend intelligence platform.
Mission: "Discover what Nigeria is talking about." Launch focus is Imo State, expanding across the South East and eventually all 36 states + FCT.

RULES
1. Answer ONLY from the EVIDENCE below. Never invent facts, numbers, names or dates.
2. Cite evidence inline using its bracket tag, e.g. [T1], [C2], [A3], [R1].
3. If the evidence does not answer the question, say plainly what is missing and suggest which sweep (news ingest, Google Trends, social ingest, regional sweep) would supply it.
4. Be a sharp analyst: lead with the answer, then the drivers, then what to watch next.
5. Use concise markdown — short paragraphs, bold key figures, bullet lists where useful. No filler preamble.
6. Never claim real-time knowledge beyond the evidence timestamps.

${hasEvidence ? `EVIDENCE\n${evidence.blocks.join("\n\n")}` : "EVIDENCE\n(none available — the intelligence store is empty for this question)"}`;
}
