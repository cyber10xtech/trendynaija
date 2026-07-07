/**
 * Article clustering. Groups related articles by:
 *   - Exact content_hash match  (URL + normalized title)
 *   - Title Jaccard similarity above threshold within a 48h window
 *
 * Semantic clustering can plug in later via the AI pipeline.
 */
import { jaccardSimilarity, tokenize } from "./hashing.server";

export interface ClusterCandidate {
  id: string;
  title: string;
  tokens: Set<string>;
  lastSeenAt: string;
}

export interface ClusterMatchInput {
  title: string;
  publishedAt?: string | null;
}

const SIMILARITY_THRESHOLD = 0.55;
const WINDOW_MS = 48 * 60 * 60 * 1000;

export function findMatchingCluster(
  input: ClusterMatchInput,
  candidates: ClusterCandidate[],
  now: number = Date.now(),
): ClusterCandidate | null {
  const pubTs = input.publishedAt ? Date.parse(input.publishedAt) : now;
  const tokens = new Set(tokenize(input.title));
  if (tokens.size === 0) return null;

  let best: { cand: ClusterCandidate; score: number } | null = null;
  for (const c of candidates) {
    const cTs = Date.parse(c.lastSeenAt);
    if (Number.isFinite(cTs) && Math.abs(pubTs - cTs) > WINDOW_MS) continue;
    const score = jaccardSimilarity(tokens, c.tokens);
    if (score >= SIMILARITY_THRESHOLD && (!best || score > best.score)) {
      best = { cand: c, score };
    }
  }
  return best?.cand ?? null;
}
