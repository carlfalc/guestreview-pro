// Executive overview server functions — aggregation only, no AI calls.
import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { isPeriodDays, type ExecutiveOverview } from "@/lib/executive";

const DAY = 24 * 60 * 60 * 1000;

export type { ExecutiveOverview };

export const getExecutiveOverview = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data?: { businessId?: string; periodDays?: number }) => ({
    businessId:
      typeof data?.businessId === "string" && /^[0-9a-f-]{36}$/i.test(data.businessId)
        ? data.businessId
        : null,
    periodDays: isPeriodDays(data?.periodDays) ? data.periodDays : 7,
  }))
  .handler(async ({ data, context }): Promise<ExecutiveOverview> => {
    const { buildExecutiveOverview } = await import("@/lib/executive.server");
    return buildExecutiveOverview({
      supabase: context.supabase,
      userId: context.userId,
      businessId: data.businessId,
      periodDays: data.periodDays,
    });
  });

export const setRecommendationAction = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { businessId: string; key: string; action: string }) => {
    const action = String(data?.action ?? "");
    if (!["completed", "snoozed", "dismissed", "reopen"].includes(action)) {
      throw new Error("Unsupported action");
    }
    const key = String(data?.key ?? "").trim();
    if (!key || key.length > 120) throw new Error("Invalid recommendation");
    if (!/^[0-9a-f-]{36}$/i.test(String(data?.businessId ?? ""))) {
      throw new Error("Invalid business");
    }
    return { businessId: data.businessId, key, action };
  })
  .handler(async ({ data, context }): Promise<{ ok: true }> => {
    const { supabase, userId } = context;

    const { data: owned } = await supabase
      .from("businesses")
      .select("id")
      .eq("owner_id", userId)
      .eq("id", data.businessId)
      .maybeSingle();
    if (!owned) throw new Error("Business not found");

    if (data.action === "reopen") {
      const { error } = await supabase
        .from("recommendation_actions")
        .delete()
        .eq("owner_id", userId)
        .eq("business_id", data.businessId)
        .eq("recommendation_key", data.key);
      if (error) throw new Error(error.message);
      return { ok: true };
    }

    const snoozeUntil =
      data.action === "snoozed" ? new Date(Date.now() + 7 * DAY).toISOString() : null;

    const { error } = await supabase.from("recommendation_actions").upsert(
      {
        owner_id: userId,
        business_id: data.businessId,
        recommendation_key: data.key,
        action: data.action,
        snooze_until: snoozeUntil,
      },
      { onConflict: "owner_id,business_id,recommendation_key" },
    );
    if (error) throw new Error(error.message);
    return { ok: true };
  });
