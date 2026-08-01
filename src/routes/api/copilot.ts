/**
 * AI Copilot streaming endpoint.
 *
 * Raw HTTP route (AI SDK UI transport contract). Authenticates the caller from
 * the Authorization bearer token, verifies the conversation belongs to that
 * user, retrieves grounded evidence from Trendy Naija's intelligence store,
 * streams the answer, and persists both messages.
 */
import { createFileRoute } from "@tanstack/react-router";
import { createClient } from "@supabase/supabase-js";
import { convertToModelMessages, streamText, type UIMessage } from "ai";
import type { Database } from "@/integrations/supabase/types";

interface Body {
  messages?: UIMessage[];
  conversationId?: string;
}

function textOf(message: UIMessage): string {
  return (message.parts ?? [])
    .map((p) => (p.type === "text" ? (p as { text: string }).text : ""))
    .join("")
    .trim();
}

export const Route = createFileRoute("/api/copilot")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const token = (request.headers.get("authorization") ?? "").replace(/^Bearer\s+/i, "");
        if (!token) return new Response("Unauthorized", { status: 401 });

        const url = process.env.SUPABASE_URL;
        const publishable = process.env.SUPABASE_PUBLISHABLE_KEY ?? process.env.SUPABASE_ANON_KEY;
        if (!url || !publishable) return new Response("Backend not configured", { status: 500 });

        const userClient = createClient<Database>(url, publishable, {
          auth: { persistSession: false, autoRefreshToken: false },
          global: { headers: { Authorization: `Bearer ${token}` } },
        });
        const { data: userData, error: userErr } = await userClient.auth.getUser(token);
        if (userErr || !userData.user) return new Response("Unauthorized", { status: 401 });
        const userId = userData.user.id;

        const body = (await request.json()) as Body;
        const messages = body.messages;
        const conversationId = body.conversationId;
        if (!Array.isArray(messages) || messages.length === 0) {
          return new Response("Messages are required", { status: 400 });
        }
        if (!conversationId) return new Response("conversationId is required", { status: 400 });

        const { data: conv } = await userClient
          .from("copilot_conversations")
          .select("id, title, message_count")
          .eq("id", conversationId)
          .eq("user_id", userId)
          .maybeSingle();
        if (!conv) return new Response("Conversation not found", { status: 404 });

        const apiKey = process.env.LOVABLE_API_KEY;
        if (!apiKey) return new Response("AI is not configured", { status: 500 });

        const last = messages[messages.length - 1];
        const question = textOf(last);

        const { buildEvidence, copilotSystemPrompt } = await import("@/lib/copilot/retrieval.server");
        const evidence = await buildEvidence(question);
        const system = copilotSystemPrompt(evidence);

        // Persist the user turn immediately so a dropped stream never loses it.
        if (last.role === "user") {
          const { error: insertErr } = await userClient.from("copilot_messages").insert({
            conversation_id: conversationId,
            user_id: userId,
            role: "user",
            ai_message_id: last.id,
            content: question,
            parts: last.parts as never,
          });
          if (insertErr) console.error("[copilot] failed to persist user message", insertErr.message);
        }

        const { createLovableAiGatewayProvider, COPILOT_MODEL } = await import("@/lib/ai-gateway.server");
        const gateway = createLovableAiGatewayProvider(apiKey);

        try {
          const result = streamText({
            model: gateway(COPILOT_MODEL),
            system,
            messages: await convertToModelMessages(messages),
            providerOptions: { lovable: { reasoningEffort: "none" } },
          });

          return result.toUIMessageStreamResponse({
            originalMessages: messages,
            onFinish: async ({ responseMessage }) => {
              const answer = textOf(responseMessage);
              const { error: aErr } = await userClient.from("copilot_messages").insert({
                conversation_id: conversationId,
                user_id: userId,
                role: "assistant",
                ai_message_id: responseMessage.id,
                content: answer,
                parts: responseMessage.parts as never,
                evidence: evidence.citations as never,
                model: COPILOT_MODEL,
              });
              if (aErr) console.error("[copilot] failed to persist assistant message", aErr.message);

              // Auto-title the thread from the first exchange.
              let title = conv.title;
              if (!conv.message_count || conv.title === "New conversation") {
                title = await generateTitle(question, apiKey).catch(() => question.slice(0, 60));
              }
              const { error: uErr } = await userClient
                .from("copilot_conversations")
                .update({
                  title,
                  message_count: (conv.message_count ?? 0) + 2,
                  last_message_at: new Date().toISOString(),
                })
                .eq("id", conversationId);
              if (uErr) console.error("[copilot] failed to update conversation", uErr.message);
            },
          });
        } catch (e) {
          const msg = e instanceof Error ? e.message : String(e);
          const status = /429|rate/i.test(msg) ? 429 : /402|credit/i.test(msg) ? 402 : 500;
          return new Response(JSON.stringify({ error: msg }), {
            status,
            headers: { "content-type": "application/json" },
          });
        }
      },
    },
  },
});

async function generateTitle(question: string, apiKey: string): Promise<string> {
  const res = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
    method: "POST",
    headers: { "Lovable-API-Key": apiKey, "Content-Type": "application/json" },
    body: JSON.stringify({
      model: "openai/gpt-5.6-sol",
      reasoning_effort: "none",
      messages: [
        { role: "system", content: "Write a 3-6 word title for this analyst question. Title case, no quotes, no punctuation at the end." },
        { role: "user", content: question.slice(0, 400) },
      ],
    }),
  });
  if (!res.ok) throw new Error(`title_${res.status}`);
  const json = (await res.json()) as { choices?: Array<{ message?: { content?: string } }> };
  const title = json.choices?.[0]?.message?.content?.trim().replace(/^["']|["']$/g, "");
  if (!title) throw new Error("empty_title");
  return title.slice(0, 120);
}
