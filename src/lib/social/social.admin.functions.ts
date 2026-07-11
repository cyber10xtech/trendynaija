/**
 * Admin-only social intelligence controls.
 */
import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

async function assertAdmin(userId: string) {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data, error } = await supabaseAdmin.rpc("has_role", { _user_id: userId, _role: "admin" });
  if (error) throw error;
  if (!data) throw new Error("Forbidden: admin role required");
}

export const runSocialIngestionNow = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => {
    const o = (i ?? {}) as { sourceKey?: string };
    return { sourceKey: o.sourceKey ?? null };
  })
  .handler(async ({ data, context }) => {
    await assertAdmin(context.userId);
    const { runSocialIngestion } = await import("./ingest.server");
    return await runSocialIngestion(data.sourceKey ? { sourceKey: data.sourceKey } : undefined);
  });

export const toggleSocialProvider = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => {
    const o = i as { sourceId: string; enabled: boolean };
    if (!o?.sourceId || typeof o.enabled !== "boolean") throw new Error("sourceId and enabled required");
    return o;
  })
  .handler(async ({ data, context }) => {
    await assertAdmin(context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    await supabaseAdmin.from("sources")
      .update({ enabled: data.enabled, status: data.enabled ? "unknown" : "disabled" } as never)
      .eq("id", data.sourceId);
    return { ok: true };
  });
