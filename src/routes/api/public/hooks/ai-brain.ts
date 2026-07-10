/**
 * Public hook that pg_cron triggers to run the AI Brain sweep.
 * Bypasses the auth gate at /api/public/* but validates the anon apikey.
 */
import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/api/public/hooks/ai-brain")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const apiKey = request.headers.get("apikey") ?? request.headers.get("x-api-key");
        const accepted = [
          process.env.SUPABASE_PUBLISHABLE_KEY,
          process.env.SUPABASE_ANON_KEY,
          process.env.VITE_SUPABASE_PUBLISHABLE_KEY,
        ].filter((v): v is string => !!v);
        if (!accepted.includes(apiKey ?? "")) {
          return new Response(JSON.stringify({ error: "unauthorized" }), {
            status: 401,
            headers: { "content-type": "application/json" },
          });
        }
        const body = (await request.json().catch(() => ({}))) as {
          skipBriefs?: boolean;
          skipPredictions?: boolean;
          skipNarratives?: boolean;
        };
        const { runBrain } = await import("@/lib/ai/brain/run.server");
        const report = await runBrain(body);
        return new Response(JSON.stringify({ ok: true, report }), {
          headers: { "content-type": "application/json" },
        });
      },
    },
  },
});
