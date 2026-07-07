/**
 * Deterministic content hashing + normalization for dedup.
 */
import { createHash } from "node:crypto";

const STOPWORDS = new Set([
  "the","a","an","and","or","but","of","for","to","in","on","at","by","with","from","as","is","are","was","were","be","been","being","it","its","this","that","these","those","he","she","they","them","his","her","their","we","our","you","your","i","me","my","not","no","so","if","than","then","just","also","up","down","out","over","after","before","about","into","onto","off","new","says","said","today","yesterday",
]);

export function normalizeTitle(title: string): string {
  return title
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function tokenize(text: string): string[] {
  return normalizeTitle(text)
    .split(" ")
    .filter((t) => t.length > 2 && !STOPWORDS.has(t));
}

export function contentHash(input: { title: string; url?: string }): string {
  const norm = normalizeTitle(input.title);
  const urlKey = input.url ? new URL(input.url).pathname.toLowerCase().replace(/\/$/, "") : "";
  return createHash("sha256").update(`${norm}|${urlKey}`).digest("hex");
}

export function jaccardSimilarity(a: Set<string>, b: Set<string>): number {
  if (a.size === 0 || b.size === 0) return 0;
  let inter = 0;
  for (const t of a) if (b.has(t)) inter++;
  const union = a.size + b.size - inter;
  return union === 0 ? 0 : inter / union;
}
