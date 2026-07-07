/**
 * Deterministic keyword-based category classifier. Fast, cheap, reliable.
 * The AI stage can override with a stronger classification later.
 */

import { NEWS_CATEGORIES, type NewsCategory } from "./categories";
export { NEWS_CATEGORIES, type NewsCategory };


const RULES: Array<[NewsCategory, RegExp]> = [
  ["Sports", /\b(football|soccer|super eagles|nff|npfl|match|tournament|league|goal|coach|striker|nba|premier league|afcon|olympi|world cup|boxing|athletics)\b/i],
  ["Entertainment", /\b(nollywood|movie|film|actor|actress|album|song|artiste|singer|concert|bbnaija|afrobeats|celebrity|award|premiere)\b/i],
  ["Technology", /\b(technology|tech|startup|fintech|app|software|ai\b|artificial intelligence|internet|broadband|5g|blockchain|crypto|bitcoin|smartphone|google|microsoft|meta|apple)\b/i],
  ["Health", /\b(health|hospital|doctor|patient|disease|outbreak|malaria|cholera|covid|vaccine|nafdac|nhia|medic)\b/i],
  ["Crime", /\b(kidnap|abduct|bandit|robber|robbery|murder|killed|gunmen|arrest|police arrest|ipob|terrorism|attack|assassinat|court sentenc)\b/i],
  ["Religion", /\b(church|mosque|pastor|imam|christian|muslim|cleric|bishop|redeem|catholic|rccg|winners chapel|deeper life)\b/i],
  ["Education", /\b(school|university|jamb|waec|neco|student|lecturer|asuu|polytechnic|scholarship|admission|nysc)\b/i],
  ["Economy", /\b(inflation|gdp|naira|exchange rate|forex|dollar|cbn|monetary|budget|revenue|tax|fiscal|imf|world bank)\b/i],
  ["Business", /\b(business|company|firm|ceo|profit|stock|shares|nse|nsx|acquisition|merger|dangote|mtn|airtel|glo|bank|zenith|gtco)\b/i],
  ["Government", /\b(federal government|ministry|minister|presidency|aso rock|state government|governor|senate|house of reps|national assembly|inec)\b/i],
  ["Politics", /\b(apc|pdp|lp|labour party|election|campaign|politic|party|governorship|senator|honourable|tinubu|atiku|obi|kwankwaso)\b/i],
  ["Weather", /\b(rain|flood|storm|weather|nimet|drought|heatwave)\b/i],
  ["Environment", /\b(environment|climate|pollution|oil spill|deforest|carbon|ecolog|conservation)\b/i],
  ["Infrastructure", /\b(road|bridge|highway|rail|train|airport|seaport|power supply|electricity|dis[cs]o|tcn|nnpc|refinery|construction)\b/i],
  ["Lifestyle", /\b(fashion|beauty|lifestyle|travel|food|recipe|wedding|relationship)\b/i],
];

export function classifyCategory(input: {
  title?: string;
  content?: string;
  categories?: string[];
}): NewsCategory {
  const hay = [input.title ?? "", input.content ?? "", ...(input.categories ?? [])]
    .join(" \n ")
    .slice(0, 4000);
  for (const [cat, re] of RULES) {
    if (re.test(hay)) return cat;
  }
  return "Other";
}
