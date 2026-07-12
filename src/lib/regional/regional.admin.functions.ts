/**
 * Admin-only regional intelligence controls. Trigger sweeps and generate
 * AI insights on demand. Every function verifies the caller has the admin role.
 */
import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

async function assertAdmin(userId: string) {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data, error } = await supabaseAdmin.rpc("has_role", { _user_id: userId, _role: "admin" });
  if (error) throw error;
  if (!data) throw new Error("Forbidden: admin role required");
}

export const runRegionalIntelNow = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertAdmin(context.userId);
    const { runRegionalIntelligence } = await import("./run.server");
    return await runRegionalIntelligence();
  });

export const generateStateInsightNow = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => {
    const v = i as { stateId: string };
    if (!v?.stateId) throw new Error("stateId required");
    return { stateId: v.stateId };
  })
  .handler(async ({ data, context }) => {
    await assertAdmin(context.userId);
    const { generateStateInsight } = await import("./ai.server");
    return await generateStateInsight(data.stateId);
  });

export const compareRegionsInsight = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => {
    const v = i as { stateIds: string[] };
    if (!Array.isArray(v?.stateIds) || v.stateIds.length < 2) throw new Error("provide 2+ stateIds");
    return { stateIds: v.stateIds };
  })
  .handler(async ({ data, context }) => {
    await assertAdmin(context.userId);
    const { generateComparison } = await import("./ai.server");
    return await generateComparison(data.stateIds);
  });
