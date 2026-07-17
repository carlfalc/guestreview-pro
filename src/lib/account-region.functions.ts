// Client-callable server functions for the account region system.

import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { getRequest } from "@tanstack/react-start/server";
import { isValidCountryCode } from "./country-names";

export interface AccountRegionDTO {
  countryCode: string;
  countryName: string;
  currencyCode: string;
  currencySymbol: string;
  currencyName: string;
  pricingRegion: string;
  detectionSource: string;
  confidence: string;
  isLocked: boolean;
  detectedAt: string;
  confirmedAt: string | null;
  stripeBillingCountry: string | null;
}

interface AccountRegionRow {
  country_code: string; country_name: string; currency_code: string;
  currency_symbol: string; currency_name: string; pricing_region: string;
  detection_source: string; confidence: string; is_locked: boolean;
  detected_at: string; confirmed_at: string | null; stripe_billing_country: string | null;
}

function rowToDto(row: AccountRegionRow): AccountRegionDTO {
  return {
    countryCode: row.country_code,
    countryName: row.country_name,
    currencyCode: row.currency_code,
    currencySymbol: row.currency_symbol,
    currencyName: row.currency_name,
    pricingRegion: row.pricing_region,
    detectionSource: row.detection_source,
    confidence: row.confidence,
    isLocked: row.is_locked,
    detectedAt: row.detected_at,
    confirmedAt: row.confirmed_at,
    stripeBillingCountry: row.stripe_billing_country,
  };
}

/** Fetch the caller's account_regions row. Returns null when none exists yet. */
export const getAccountRegion = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<AccountRegionDTO | null> => {
    const { data, error } = await context.supabase
      .from("account_regions")
      .select("*")
      .eq("owner_id", context.userId)
      .maybeSingle();
    if (error) throw new Error(error.message);
    return data ? rowToDto(data) : null;
  });

/**
 * Initial detection: creates the caller's account_regions row if it does not
 * exist yet. If a row already exists (locked or not), the ordinary user flow
 * returns it unchanged. Locked rows may ONLY be modified via:
 *   - applyVerifiedBillingRegion (Stripe webhook)
 *   - approveRegionCorrectionRequest (admin)
 *
 * Also captures a registration-country snapshot on the profile at first run.
 */
export const resolveAccountRegion = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<AccountRegionDTO> => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const {
      detectAccountCountry,
      toAccountRegionRow,
      writeRegionAudit,
    } = await import("./account-region.server");

    // If a row already exists, respect it — ordinary detection cannot mutate
    // an existing region (locked semantics).
    const { data: existing } = await supabaseAdmin
      .from("account_regions")
      .select("*")
      .eq("owner_id", context.userId)
      .maybeSingle();
    if (existing) return rowToDto(existing);

    let request: Request | undefined;
    try { request = getRequest(); } catch { request = undefined; }

    const detection = await detectAccountCountry(supabaseAdmin, context.userId, request);
    const row = toAccountRegionRow(context.userId, detection);

    const { data: upserted, error } = await supabaseAdmin
      .from("account_regions")
      .upsert(row, { onConflict: "owner_id" })
      .select("*")
      .single();
    if (error) throw new Error(error.message);

    await writeRegionAudit(supabaseAdmin, {
      ownerId: context.userId,
      previous: null,
      next: {
        country_code: row.country_code,
        currency_code: row.currency_code,
        pricing_region: row.pricing_region,
      },
      changeSource: "initial_detection",
      reason: `Initial detection via ${detection.source}`,
      changedBy: null,
    });

    // Registration snapshot (one-time). Cannot be edited by the user thanks
    // to the protect_registration_country trigger.
    const { data: profile } = await supabaseAdmin
      .from("profiles")
      .select("registration_country_code")
      .eq("id", context.userId)
      .maybeSingle();
    if (!profile?.registration_country_code) {
      await supabaseAdmin
        .from("profiles")
        .update({
          registration_country_code: detection.region.countryCode,
          registration_country_source: detection.source === "business_address"
            ? "business_address"
            : detection.source === "ip_geolocation"
              ? "ip_geolocation"
              : "browser_locale",
          registration_country_recorded_at: new Date().toISOString(),
        })
        .eq("id", context.userId);
    }

    return rowToDto(upserted);
  });

/** Submit a country-correction request. Currency is NOT changed here. */
export const createRegionCorrectionRequest = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: {
    requestedCountryCode: string;
    reason: string;
    supportingInformation?: string;
  }) => {
    const cc = String(data?.requestedCountryCode ?? "").trim().toUpperCase();
    const reason = String(data?.reason ?? "").trim();
    if (!isValidCountryCode(cc)) throw new Error("Requested country is not a valid ISO code.");
    if (reason.length < 5) throw new Error("Please provide a reason (min 5 characters).");
    return {
      requestedCountryCode: cc,
      reason,
      supportingInformation: data.supportingInformation?.trim() || null,
    };
  })
  .handler(async ({ data, context }) => {
    const { data: region } = await context.supabase
      .from("account_regions")
      .select("country_code")
      .eq("owner_id", context.userId)
      .maybeSingle();

    if (region?.country_code === data.requestedCountryCode) {
      throw new Error("Requested country is the same as your current billing country.");
    }

    // Prevent duplicate pending requests (also enforced by partial unique index).
    const { data: existingPending } = await context.supabase
      .from("region_correction_requests")
      .select("id")
      .eq("owner_id", context.userId)
      .eq("status", "pending")
      .maybeSingle();
    if (existingPending) {
      throw new Error("You already have a billing-region correction awaiting review.");
    }

    const { error } = await context.supabase
      .from("region_correction_requests")
      .insert({
        owner_id: context.userId,
        current_country_code: region?.country_code ?? null,
        requested_country_code: data.requestedCountryCode,
        reason: data.reason,
        supporting_information: data.supportingInformation,
      });
    if (error) {
      if (/rcr_one_pending_per_owner/i.test(error.message)) {
        throw new Error("You already have a billing-region correction awaiting review.");
      }
      throw new Error(error.message);
    }
    return { ok: true };
  });

/** List the caller's own correction requests (most recent first). */
export const listMyRegionCorrectionRequests = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase
      .from("region_correction_requests")
      .select("id, current_country_code, requested_country_code, reason, status, created_at, reviewed_at")
      .eq("owner_id", context.userId)
      .order("created_at", { ascending: false });
    if (error) throw new Error(error.message);
    return data ?? [];
  });

/** Region audit trail for the current user (own account only, redacted). */
export const listMyRegionAuditLog = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase
      .from("account_region_audit_log")
      .select("id, previous_country_code, new_country_code, previous_currency_code, new_currency_code, change_source, reason, created_at")
      .eq("owner_id", context.userId)
      .order("created_at", { ascending: false })
      .limit(50);
    if (error) throw new Error(error.message);
    return data ?? [];
  });
