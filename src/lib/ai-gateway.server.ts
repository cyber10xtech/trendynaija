/**
 * Lovable AI Gateway provider for the Vercel AI SDK.
 * Server-only: reads LOVABLE_API_KEY and must never be imported by client code.
 */
import { createOpenAICompatible } from "@ai-sdk/openai-compatible";

export function createLovableAiGatewayProvider(apiKey: string) {
  return createOpenAICompatible({
    name: "lovable",
    baseURL: "https://ai.gateway.lovable.dev/v1",
    headers: { "Lovable-API-Key": apiKey },
    supportsStructuredOutputs: true,
  });
}

export const COPILOT_MODEL = "openai/gpt-5.6-sol";
