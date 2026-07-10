/**
 * AI Search — natural language questions answered from stored intelligence.
 *
 * Never fabricates. Retrieves grounded evidence from the DB (topics,
 * clusters, summaries) using simple keyword search, then asks the model
 * to answer using only that evidence. Returns citations.
 */
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { callAI } from "./client.server";

export interface AISearchAnswer {
  answer: string;
  citations: Array<{ label: string; kind: "topic" | "cluster" | "brief"; ref: string }>;
  confidence: number;
  usedEvidence: boolean;
}

const SYSTEM = `You are Trendy Naija's grounded search assistant. Answer the user's
question about Nigerian trends USING ONLY the evidence blocks provided.
- If evidence is insufficient, say so clearly and set confidence low.
- Cite by [T#], [C#], [B#] tokens as they appear in the evidence.
Return strict JSON:
{ "answer": "...", "confidence": 0..1 }
No prose outside JSON.`;

function extractKeywords(q: string): string[] {
  return q.toLowerCase()
    .replace(/[^\p{L}\p{N}\s]/gu, " ")
    .split(/\s+/)
    .filter((w) => w.length > 3)
    .slice(0, 6);
}

export async function answerQuery(question: string): Promise<AISearchAnswer> {
  const kws = extractKeywords(question);
  const like = kws.length ? kws.map((k) => `%${k}%`).join("") : "%%";

  const topicsQ = kws.length
    ? supabaseAdmin.from("topics").select("id, name, category, lifecycle_state").ilike("name", `%${kws[0]}%`).limit(6)
    : supabaseAdmin.from("topics").select("id, name, category, lifecycle_state").order("momentum", { ascending: false }).limit(6);
  const { data: topics } = await topicsQ;

  const clustersQ = kws.length
    ? supabaseAdmin.from("article_clusters").select("id, title, summary, category").ilike("title", `%${kws[0]}%`).limit(6)
    : supabaseAdmin.from("article_clusters").select("id, title, summary, category").order("last_seen_at", { ascending: false }).limit(6);
  const { data: clusters } = await clustersQ;

  const today = new Date().toISOString().slice(0, 10);
  const { data: briefs } = await supabaseAdmin
    .from("daily_briefs").select("id, title, summary, scope, category")
    .eq("brief_date", today).limit(6);

  void like;
  const evidence: string[] = [];
  const citations: AISearchAnswer["citations"] = [];
  (topics ?? []).forEach((t, i) => {
    const tag = `T${i + 1}`;
    evidence.push(`[${tag}] Topic: ${t.name} (${t.category ?? "—"}, ${t.lifecycle_state})`);
    citations.push({ label: `${tag} · ${t.name}`, kind: "topic", ref: t.id as string });
  });
  (clusters ?? []).forEach((c, i) => {
    const tag = `C${i + 1}`;
    evidence.push(`[${tag}] Cluster: ${c.title}${c.summary ? ` — ${c.summary}` : ""}`);
    citations.push({ label: `${tag} · ${c.title}`, kind: "cluster", ref: c.id as string });
  });
  (briefs ?? []).forEach((b, i) => {
    const tag = `B${i + 1}`;
    evidence.push(`[${tag}] Brief (${b.scope}${b.category ? `/${b.category}` : ""}): ${b.title} — ${b.summary}`);
    citations.push({ label: `${tag} · ${b.title}`, kind: "brief", ref: b.id as string });
  });

  if (evidence.length === 0) {
    return { answer: "I don't have enough data on that yet — try again once more sources have been ingested.", citations: [], confidence: 0, usedEvidence: false };
  }

  const user = `Question: ${question}\n\nEvidence:\n${evidence.join("\n")}`;
  const ai = await callAI<{ answer: string; confidence: number }>({
    kind: "ai_search", system: SYSTEM, user,
  });
  if (!ai.ok || !ai.data) {
    return { answer: "The AI service is temporarily unavailable.", citations, confidence: 0, usedEvidence: true };
  }
  return {
    answer: String(ai.data.answer ?? ""),
    citations,
    confidence: Number(ai.data.confidence ?? 0.5),
    usedEvidence: true,
  };
}
