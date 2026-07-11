/**
 * pg_cron hook to trigger a social intelligence ingestion sweep.
 * Auth: Supabase publishable key in `apikey` header.
 */
import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/api/public/hooks/social-ingest")({
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
            status: 401, headers: { "content-type": "application/json" },
          });
        }
        const body = (await request.json().catch(() => ({}))) as { sourceKey?: string };
        const { runSocialIngestion } = await import("@/lib/social/ingest.server");
        const result = await runSocialIngestion(body.sourceKey ? { sourceKey: body.sourceKey } : undefined);
        return new Response(JSON.stringify({ ok: true, ...result }), {
          headers: { "content-type": "application/json" },
        });
      },
    },
  },
});
