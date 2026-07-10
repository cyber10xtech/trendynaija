/**
 * Shared AI Gateway client + ai_jobs logging.
 * Every AI call in the Trend Brain routes through here so we get uniform
 * observability, model routing, retries and cache-friendly hashing.
 */
import { supabaseAdmin } from "@/integrations/supabase/client.server";

const GATEWAY_URL = "https://ai.gateway.lovable.dev/v1/chat/completions";

export interface AIJobLog {
  kind: string;
  subjectType?: string;
  subjectId?: string | null;
  model: string;
  status: "succeeded" | "failed";
  durationMs: number;
  tokensInput?: number;
  tokensOutput?: number;
  confidence?: number;
  error?: string;
  payload?: Record<string, unknown>;
  result?: Record<string, unknown>;
}

export async function logAIJob(job: AIJobLog): Promise<void> {
  try {
    await supabaseAdmin.from("ai_jobs").insert({
      kind: job.kind,
      status: job.status,
      subject_type: job.subjectType ?? null,
      subject_id: job.subjectId ?? null,
      model: job.model,
      duration_ms: job.durationMs,
      tokens_input: job.tokensInput ?? null,
      tokens_output: job.tokensOutput ?? null,
      confidence: job.confidence ?? null,
      error: job.error ?? null,
      payload: (job.payload ?? {}) as never,
      result: (job.result ?? {}) as never,
    });
  } catch (e) {
    console.warn("[ai] failed to log job", e);
  }
}

export interface CallAIOptions {
  kind: string;
  subjectType?: string;
  subjectId?: string | null;
  model?: string;
  system: string;
  user: string;
  json?: boolean;
}

export interface CallAIResult<T = unknown> {
  ok: boolean;
  data: T | null;
  raw: string | null;
  model: string;
  durationMs: number;
  error?: string;
}

/**
 * Calls the Lovable AI Gateway with JSON-mode by default.
 * Logs an ai_jobs row for every call (success or failure).
 */
export async function callAI<T = unknown>(opts: CallAIOptions): Promise<CallAIResult<T>> {
  const apiKey = process.env.LOVABLE_API_KEY;
  const model = opts.model ?? "openai/gpt-5.5";
  const started = Date.now();
  if (!apiKey) {
    await logAIJob({
      kind: opts.kind, subjectType: opts.subjectType, subjectId: opts.subjectId,
      model, status: "failed", durationMs: 0, error: "missing_api_key",
    });
    return { ok: false, data: null, raw: null, model, durationMs: 0, error: "missing_api_key" };
  }

  try {
    const res = await fetch(GATEWAY_URL, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model,
        messages: [
          { role: "system", content: opts.system },
          { role: "user", content: opts.user },
        ],
        ...(opts.json === false ? {} : { response_format: { type: "json_object" } }),
      }),
    });
    const durationMs = Date.now() - started;
    if (!res.ok) {
      const body = await res.text();
      await logAIJob({
        kind: opts.kind, subjectType: opts.subjectType, subjectId: opts.subjectId,
        model, status: "failed", durationMs, error: `gateway_${res.status}: ${body.slice(0, 200)}`,
      });
      return { ok: false, data: null, raw: null, model, durationMs, error: `gateway_${res.status}` };
    }
    const json = (await res.json()) as {
      choices?: Array<{ message?: { content?: string } }>;
      usage?: { prompt_tokens?: number; completion_tokens?: number };
    };
    const content = json.choices?.[0]?.message?.content ?? null;
    let parsed: T | null = null;
    if (content && opts.json !== false) {
      try { parsed = JSON.parse(content) as T; } catch { parsed = null; }
    }
    await logAIJob({
      kind: opts.kind, subjectType: opts.subjectType, subjectId: opts.subjectId,
      model, status: "succeeded", durationMs,
      tokensInput: json.usage?.prompt_tokens, tokensOutput: json.usage?.completion_tokens,
    });
    return { ok: true, data: parsed, raw: content, model, durationMs };
  } catch (e) {
    const durationMs = Date.now() - started;
    const err = e instanceof Error ? e.message : String(e);
    await logAIJob({
      kind: opts.kind, subjectType: opts.subjectType, subjectId: opts.subjectId,
      model, status: "failed", durationMs, error: err,
    });
    return { ok: false, data: null, raw: null, model, durationMs, error: err };
  }
}
