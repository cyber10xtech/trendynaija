/**
 * AI summarization via the Lovable AI Gateway.
 * Uses the OpenAI-compatible /v1/chat/completions endpoint.
 */

export interface ClusterAIResult {
  shortSummary: string;
  detailedSummary: string;
  keyPoints: string[];
  topics: string[];
  categories: string[];
  entities: { people: string[]; organizations: string[]; locations: string[] };
  confidence: number;
}

const SYSTEM_PROMPT = `You are a Nigerian news intelligence assistant.
You receive one or more news articles that all report on the same event.
Produce a strict JSON object with these keys:
- shortSummary: one crisp sentence (max 30 words)
- detailedSummary: 3-5 sentence neutral summary
- keyPoints: array of exactly 5 concise bullet strings
- topics: array of 3-6 short topic phrases (title case)
- categories: array of 1-2 categories from this fixed list: Politics, Business, Technology, Sports, Entertainment, Education, Health, Crime, Religion, Government, Economy, Lifestyle, Environment, Weather, Infrastructure, Other
- entities: object { people: string[], organizations: string[], locations: string[] } — canonical Nigerian names
- confidence: number between 0 and 1 reflecting agreement across sources
Return ONLY the JSON. No prose, no code fences.`;

export async function summarizeCluster(
  articles: Array<{ title: string; source?: string; content?: string | null; url?: string }>,
): Promise<ClusterAIResult | null> {
  const apiKey = process.env.LOVABLE_API_KEY;
  if (!apiKey) {
    console.warn("[AI] LOVABLE_API_KEY missing; skipping summary");
    return null;
  }

  const context = articles
    .slice(0, 6)
    .map((a, i) => {
      const body = (a.content ?? "").slice(0, 1500);
      return `Article ${i + 1} (${a.source ?? "unknown"}):\nTitle: ${a.title}\n${body}`;
    })
    .join("\n\n---\n\n");

  const res = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: "openai/gpt-5.5",
      messages: [
        { role: "system", content: SYSTEM_PROMPT },
        { role: "user", content: context },
      ],
      response_format: { type: "json_object" },
    }),
  });

  if (!res.ok) {
    const body = await res.text();
    console.error(`[AI] Gateway ${res.status}: ${body}`);
    return null;
  }
  const json = (await res.json()) as {
    choices?: Array<{ message?: { content?: string } }>;
  };
  const content = json.choices?.[0]?.message?.content;
  if (!content) return null;

  try {
    const parsed = JSON.parse(content) as ClusterAIResult;
    return {
      shortSummary: String(parsed.shortSummary ?? ""),
      detailedSummary: String(parsed.detailedSummary ?? ""),
      keyPoints: Array.isArray(parsed.keyPoints) ? parsed.keyPoints.map(String).slice(0, 5) : [],
      topics: Array.isArray(parsed.topics) ? parsed.topics.map(String) : [],
      categories: Array.isArray(parsed.categories) ? parsed.categories.map(String) : [],
      entities: {
        people: parsed.entities?.people?.map(String) ?? [],
        organizations: parsed.entities?.organizations?.map(String) ?? [],
        locations: parsed.entities?.locations?.map(String) ?? [],
      },
      confidence: typeof parsed.confidence === "number" ? parsed.confidence : 0.6,
    };
  } catch (e) {
    console.error("[AI] Failed to parse JSON:", e, content.slice(0, 200));
    return null;
  }
}
