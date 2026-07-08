/**
 * pg_cron hook for Google Trends ingestion.
 * Body: { regionCode?: string; deep?: boolean }
 */
import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/api/public/hooks/trends-ingest")({
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
        const body = (await request.json().catch(() => ({}))) as { regionCode?: string; deep?: boolean };
        const { runTrendsIngestion } = await import("@/lib/trends/ingest.server");
        const reports = await runTrendsIngestion(body);
        return new Response(JSON.stringify({ ok: true, reports }), {
          headers: { "content-type": "application/json" },
        });
      },
    },
  },
});
