/**
 * Admin-only mutations for Google Trends.
 */
import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

async function assertAdmin(userId: string) {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data, error } = await supabaseAdmin.rpc("has_role", { _user_id: userId, _role: "admin" });
  if (error) throw error;
  if (!data) throw new Error("Forbidden: admin role required");
}

export const syncGoogleTrends = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => {
    const i = (input ?? {}) as { regionCode?: string; deep?: boolean };
    return { regionCode: i.regionCode, deep: !!i.deep };
  })
  .handler(async ({ data, context }) => {
    await assertAdmin(context.userId);
    const { runTrendsIngestion } = await import("@/lib/trends/ingest.server");
    const reports = await runTrendsIngestion(data);
    return { reports };
  });

export const toggleTrendRegion = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => {
    const i = input as { regionId: string; enabled: boolean };
    if (!i?.regionId) throw new Error("regionId required");
    return { regionId: i.regionId, enabled: !!i.enabled };
  })
  .handler(async ({ data, context }) => {
    await assertAdmin(context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin.from("trend_regions" as never)
      .update({ enabled: data.enabled } as never).eq("id", data.regionId);
    if (error) throw error;
    return { ok: true };
  });
