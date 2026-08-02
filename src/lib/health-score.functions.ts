// Reputation Health™ — server aggregation.
//
// The heavy lifting lives in health-facts.server.ts so the executive dashboard
// and this endpoint always read the exact same facts.
import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { computeHealthScore, type HealthScore } from "@/lib/health-score";

export const getReviewHealthScore = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data?: { businessId?: string }) => ({
    businessId:
      typeof data?.businessId === "string" && /^[0-9a-f-]{36}$/i.test(data.businessId)
        ? data.businessId
        : null,
  }))
  .handler(async ({ data, context }): Promise<HealthScore> => {
    const { loadHealthFacts } = await import("@/lib/health-facts.server");
    const facts = await loadHealthFacts(context.supabase, context.userId, data.businessId);
    return computeHealthScore(facts.input);
  });

export interface HealthBusinessOption {
  id: string;
  name: string;
}

export const listHealthBusinesses = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<HealthBusinessOption[]> => {
    const { data } = await context.supabase
      .from("businesses")
      .select("id, name")
      .eq("owner_id", context.userId)
      .eq("status", "active")
      .order("created_at", { ascending: true });
    return (data ?? []).map((b) => ({ id: b.id, name: b.name }));
  });
