// Server-authorised plan lookup + admin workflow for region correction requests.

import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { isValidCountryCode } from "./country-names";
import type { PlanKey, RegionalPlanPrice } from "./regional-pricing";

/**
 * Read the caller's authorised pricing region from account_regions and return
 * the plan configuration. Rejects unknown plan keys. Client input is limited
 * to planKey only — country, currency, amount, and pricing region are all
 * derived server-side.
 */
export const getAuthorisedPlanForUser = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { planKey: PlanKey }) => {
    const allowed: PlanKey[] = ["free", "pro_monthly", "pro_annual", "business_monthly", "business_annual"];
    if (!data?.planKey || !allowed.includes(data.planKey)) {
      throw new Error("Unknown plan.");
    }
    return { planKey: data.planKey };
  })
  .handler(async ({ data, context }): Promise<{
    planKey: PlanKey;
    pricingRegion: string;
    price: RegionalPlanPrice;
  }> => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { getRegionalPlanPrices } = await import("./regional-pricing");
    const { data: region, error } = await supabaseAdmin
      .from("account_regions")
      .select("pricing_region")
      .eq("owner_id", context.userId)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!region) throw new Error("Account region has not been resolved yet.");

    const prices = getRegionalPlanPrices(region.pricing_region as never);
    const price = prices[data.planKey];
    if (!price) throw new Error("Plan is not available in this region.");
    return { planKey: data.planKey, pricingRegion: region.pricing_region, price };
  });

/** True iff the current authenticated user has the 'admin' role. */
export const currentUserIsAdmin = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<boolean> => {
    const { data, error } = await context.supabase.rpc("has_role", {
      _user_id: context.userId,
      _role: "admin",
    });
    if (error) return false;
    return Boolean(data);
  });

/** Admin: list all correction requests, most recent first. */
export const adminListRegionCorrectionRequests = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data: isAdmin } = await context.supabase.rpc("has_role", {
      _user_id: context.userId, _role: "admin",
    });
    if (!isAdmin) throw new Error("Forbidden");

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data, error } = await supabaseAdmin
      .from("region_correction_requests")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(200);
    if (error) throw new Error(error.message);
    return data ?? [];
  });

/** Admin: approve a request. Updates region + audit log. */
export const adminApproveRegionCorrection = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { requestId: string; adminNotes?: string }) => {
    if (!data?.requestId || typeof data.requestId !== "string") throw new Error("requestId required.");
    return { requestId: data.requestId, adminNotes: data.adminNotes?.trim() || null };
  })
  .handler(async ({ data, context }) => {
    const { data: isAdmin } = await context.supabase.rpc("has_role", {
      _user_id: context.userId, _role: "admin",
    });
    if (!isAdmin) throw new Error("Forbidden");

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { getRegionForCountry } = await import("./regions");
    const { writeRegionAudit } = await import("./account-region.server");

    const { data: req, error: reqErr } = await supabaseAdmin
      .from("region_correction_requests")
      .select("*")
      .eq("id", data.requestId)
      .maybeSingle();
    if (reqErr) throw new Error(reqErr.message);
    if (!req) throw new Error("Request not found.");
    if (req.status !== "pending") throw new Error("Request is not pending.");
    if (!isValidCountryCode(req.requested_country_code)) {
      throw new Error("Requested country is not a valid ISO code.");
    }

    const region = getRegionForCountry(req.requested_country_code);

    const { data: existing } = await supabaseAdmin
      .from("account_regions")
      .select("*")
      .eq("owner_id", req.owner_id)
      .maybeSingle();

    const row = {
      owner_id: req.owner_id,
      country_code: region.countryCode,
      country_name: region.countryName,
      currency_code: region.currencyCode,
      currency_symbol: region.currencySymbol,
      currency_name: region.currencyName,
      pricing_region: region.pricingRegion,
      detection_source: "admin_correction",
      confidence: "high",
      is_locked: true,
      detected_at: existing?.detected_at ?? new Date().toISOString(),
      confirmed_at: new Date().toISOString(),
    };

    const { error: upErr } = await supabaseAdmin
      .from("account_regions")
      .upsert(row, { onConflict: "owner_id" });
    if (upErr) throw new Error(upErr.message);

    await writeRegionAudit(supabaseAdmin, {
      ownerId: req.owner_id,
      previous: existing ? {
        country_code: existing.country_code,
        currency_code: existing.currency_code,
        pricing_region: existing.pricing_region,
      } : null,
      next: {
        country_code: row.country_code,
        currency_code: row.currency_code,
        pricing_region: row.pricing_region,
      },
      changeSource: "admin_correction",
      reason: data.adminNotes ?? req.reason,
      changedBy: context.userId,
    });

    const { error: statusErr } = await supabaseAdmin
      .from("region_correction_requests")
      .update({
        status: "approved",
        admin_notes: data.adminNotes,
        reviewed_by: context.userId,
        reviewed_at: new Date().toISOString(),
      })
      .eq("id", data.requestId);
    if (statusErr) throw new Error(statusErr.message);

    return { ok: true };
  });

/** Admin: reject a request. Region is left unchanged. */
export const adminRejectRegionCorrection = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { requestId: string; adminNotes?: string }) => {
    if (!data?.requestId) throw new Error("requestId required.");
    return { requestId: data.requestId, adminNotes: data.adminNotes?.trim() || null };
  })
  .handler(async ({ data, context }) => {
    const { data: isAdmin } = await context.supabase.rpc("has_role", {
      _user_id: context.userId, _role: "admin",
    });
    if (!isAdmin) throw new Error("Forbidden");

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: req, error } = await supabaseAdmin
      .from("region_correction_requests")
      .select("id, status")
      .eq("id", data.requestId)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!req) throw new Error("Request not found.");
    if (req.status !== "pending") throw new Error("Request is not pending.");

    const { error: updErr } = await supabaseAdmin
      .from("region_correction_requests")
      .update({
        status: "rejected",
        admin_notes: data.adminNotes,
        reviewed_by: context.userId,
        reviewed_at: new Date().toISOString(),
      })
      .eq("id", data.requestId);
    if (updErr) throw new Error(updErr.message);
    return { ok: true };
  });
