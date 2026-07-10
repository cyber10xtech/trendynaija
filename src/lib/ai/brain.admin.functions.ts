/**
 * Admin-only Trend Brain operations. All gated by has_role('admin').
 */
import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

async function assertAdmin(userId: string) {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data, error } = await supabaseAdmin.rpc("has_role", { _user_id: userId, _role: "admin" });
  if (error) throw error;
  if (!data) throw new Error("Forbidden: admin role required");
}

export const runBrainNow = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => {
    const o = (i ?? {}) as { skipBriefs?: boolean; skipPredictions?: boolean; skipNarratives?: boolean };
    return { skipBriefs: !!o.skipBriefs, skipPredictions: !!o.skipPredictions, skipNarratives: !!o.skipNarratives };
  })
  .handler(async ({ data, context }) => {
    await assertAdmin(context.userId);
    const { runBrain } = await import("@/lib/ai/brain/run.server");
    const report = await runBrain(data);
    return report;
  });

export const rebuildEntityGraph = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertAdmin(context.userId);
    const { rebuildGraphFromSummaries } = await import("@/lib/ai/brain/graph.server");
    return await rebuildGraphFromSummaries(168);
  });

export const recomputeVelocities = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertAdmin(context.userId);
    const { recomputeAllVelocities } = await import("@/lib/ai/brain/velocity.server");
    const n = await recomputeAllVelocities();
    return { updated: n };
  });

export const regenerateBriefs = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertAdmin(context.userId);
    const { generateDailyBriefs } = await import("@/lib/ai/brain/brief.server");
    return await generateDailyBriefs();
  });

export const clearAICache = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => {
    const o = (i ?? {}) as { olderThanHours?: number };
    return { olderThanHours: Math.max(1, Math.min(168, o.olderThanHours ?? 72)) };
  })
  .handler(async ({ data, context }) => {
    await assertAdmin(context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const before = new Date(Date.now() - data.olderThanHours * 3_600_000).toISOString();
    const { count } = await supabaseAdmin.from("ai_jobs").delete({ count: "exact" }).lt("created_at", before);
    return { deleted: count ?? 0 };
  });

export const resolveAlert = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => {
    const o = i as { alertId: string };
    if (!o?.alertId) throw new Error("alertId required");
    return o;
  })
  .handler(async ({ data, context }) => {
    await assertAdmin(context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    await supabaseAdmin.from("trend_alerts")
      .update({ resolved: true, resolved_at: new Date().toISOString() } as never)
      .eq("id", data.alertId);
    return { ok: true };
  });
