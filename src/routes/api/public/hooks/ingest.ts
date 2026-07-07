/**
 * Public HTTP hook that pg_cron / external schedulers call to trigger
 * a news ingestion sweep. Under /api/public/* so it bypasses auth on
 * published sites — the handler authenticates with the Supabase anon
 * key that pg_cron sends in the `apikey` header.
 */
import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/api/public/hooks/ingest")({
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
          sourceKey?: string;
          summarize?: boolean;
        };

        const { runIngestion, summarizeStaleClusters } = await import(
          "@/lib/news/ingest.server"
        );
        const reports = await runIngestion({ sourceKey: body.sourceKey });
        const summarized = body.summarize === false ? 0 : await summarizeStaleClusters(10);

        return new Response(
          JSON.stringify({ ok: true, reports, clustersSummarized: summarized }),
          { headers: { "content-type": "application/json" } },
        );
      },
    },
  },
});
