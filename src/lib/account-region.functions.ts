// Client-callable server functions for the account region system.
// resolveAccountRegion + getAccountRegion require an authenticated user.

import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { getRequest } from "@tanstack/react-start/server";

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

function rowToDto(row: {
  country_code: string; country_name: string; currency_code: string;
  currency_symbol: string; currency_name: string; pricing_region: string;
  detection_source: string; confidence: string; is_locked: boolean;
  detected_at: string; confirmed_at: string | null; stripe_billing_country: string | null;
}): AccountRegionDTO {
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
 * Detect and persist the caller's account region. Idempotent:
 * - If a row already exists AND is locked, returns it unchanged.
 * - Otherwise runs the detection priority chain and writes a new row.
 */
export const resolveAccountRegion = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<AccountRegionDTO> => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { detectAccountCountry, toAccountRegionRow } = await import("./account-region.server");

    // Bail out early if a locked row already exists.
    const { data: existing } = await supabaseAdmin
      .from("account_regions")
      .select("*")
      .eq("owner_id", context.userId)
      .maybeSingle();
    if (existing && existing.is_locked) return rowToDto(existing);

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
    if (!/^[A-Z]{2}$/.test(cc)) throw new Error("Requested country is required.");
    if (reason.length < 5) throw new Error("Please provide a reason (min 5 characters).");
    return {
      requestedCountryCode: cc,
      reason,
      supportingInformation: data.supportingInformation?.trim() || null,
    };
  })
  .handler(async ({ data, context }) => {
    // Look up current country (may be null if no region row yet).
    const { data: region } = await context.supabase
      .from("account_regions")
      .select("country_code")
      .eq("owner_id", context.userId)
      .maybeSingle();

    const { error } = await context.supabase
      .from("region_correction_requests")
      .insert({
        owner_id: context.userId,
        current_country_code: region?.country_code ?? null,
        requested_country_code: data.requestedCountryCode,
        reason: data.reason,
        supporting_information: data.supportingInformation,
      });
    if (error) throw new Error(error.message);
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
