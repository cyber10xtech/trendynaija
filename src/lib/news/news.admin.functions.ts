/**
 * Admin-only mutations for provider management.
 * Uses requireSupabaseAuth + has_role('admin') check.
 */
import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

async function assertAdmin(userId: string) {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data, error } = await supabaseAdmin.rpc("has_role", {
    _user_id: userId,
    _role: "admin",
  });
  if (error) throw error;
  if (!data) throw new Error("Forbidden: admin role required");
}

export const syncProvider = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => {
    const i = input as { sourceKey: string };
    if (!i?.sourceKey) throw new Error("sourceKey required");
    return { sourceKey: i.sourceKey };
  })
  .handler(async ({ data, context }) => {
    await assertAdmin(context.userId);
    const { runIngestion } = await import("@/lib/news/ingest.server");
    const reports = await runIngestion({ sourceKey: data.sourceKey });
    return { reports };
  });

export const toggleProvider = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => {
    const i = input as { sourceId: string; enabled: boolean };
    if (!i?.sourceId) throw new Error("sourceId required");
    return { sourceId: i.sourceId, enabled: !!i.enabled };
  })
  .handler(async ({ data, context }) => {
    await assertAdmin(context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin
      .from("sources")
      .update({ enabled: data.enabled, status: data.enabled ? "unknown" : "disabled" })
      .eq("id", data.sourceId);
    if (error) throw error;
    return { ok: true };
  });

export const retryFailedJobs = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertAdmin(context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: failed } = await supabaseAdmin
      .from("ingestion_jobs")
      .select("source_id")
      .eq("status", "failed")
      .order("created_at", { ascending: false })
      .limit(50);
    const seen = new Set<string>();
    const keys: string[] = [];
    for (const row of failed ?? []) {
      if (!row.source_id || seen.has(row.source_id)) continue;
      seen.add(row.source_id);
      const { data: src } = await supabaseAdmin
        .from("sources")
        .select("key")
        .eq("id", row.source_id)
        .maybeSingle();
      if (src?.key) keys.push(src.key);
    }
    const { runIngestion } = await import("@/lib/news/ingest.server");
    const reports = [];
    for (const key of keys) {
      reports.push(...(await runIngestion({ sourceKey: key })));
    }
    return { reports, retried: keys.length };
  });

export const summarizeNow = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertAdmin(context.userId);
    const { summarizeStaleClusters } = await import("@/lib/news/ingest.server");
    const count = await summarizeStaleClusters(10);
    return { summarized: count };
  });
