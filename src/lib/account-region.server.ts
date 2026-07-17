// Server-only helpers for detecting and persisting account regions.
// Runs inside server-function handlers; must never be imported from
// client-reachable module scope.

import { getRegionForCountry, INTERNATIONAL_FALLBACK, type RegionConfig } from "./regions";
import type { SupabaseClient } from "@supabase/supabase-js";

export type DetectionSource =
  | "stripe_billing"
  | "business_address"
  | "registration"
  | "profile"
  | "ip_geolocation"
  | "browser_locale"
  | "admin_correction"
  | "fallback";

export type Confidence = "high" | "medium" | "low";

export interface DetectionResult {
  region: RegionConfig;
  source: DetectionSource;
  confidence: Confidence;
}

/**
 * Report which supported country header (if any) was present on the request.
 * Values are safe to log for admins/dev — full IPs are NEVER read here.
 */
export function ipHeaderDiagnostic(request: Request | undefined): {
  header: string | null;
  country: string | null;
} {
  if (!request) return { header: null, country: null };
  const candidates: Array<[string, string | null]> = [
    ["cf-ipcountry", request.headers.get("cf-ipcountry")],
    ["x-vercel-ip-country", request.headers.get("x-vercel-ip-country")],
    ["x-country-code", request.headers.get("x-country-code")],
  ];
  for (const [h, v] of candidates) {
    if (!v) continue;
    const up = v.toUpperCase();
    if (/^[A-Z]{2}$/.test(up) && up !== "XX" && up !== "T1") {
      return { header: h, country: up };
    }
  }
  return { header: null, country: null };
}

/** Country code from trusted edge headers, or null. Deployed platforms (Cloudflare/Vercel)
 *  inject their own header — no fallback fetch is performed. */
export function ipCountryFromRequest(request: Request | undefined): string | null {
  return ipHeaderDiagnostic(request).country;
}

export function browserLocaleCountry(request: Request | undefined): string | null {
  if (!request) return null;
  const al = request.headers.get("accept-language");
  if (!al) return null;
  const match = al.split(",")[0]?.match(/[a-z]{2,3}[-_]([A-Z]{2})/i);
  if (match?.[1]) return match[1].toUpperCase();
  return null;
}

/**
 * Country-detection priority for initial resolution. Trusted signals only.
 * Locked existing records are handled by the caller — this function only
 * computes what the *initial* region should be.
 */
export async function detectAccountCountry(
  supabase: SupabaseClient,
  ownerId: string,
  request: Request | undefined,
): Promise<DetectionResult> {
  // 1. Verified Stripe billing country (present when Stripe webhook wrote it earlier)
  const { data: existing } = await supabase
    .from("account_regions")
    .select("stripe_billing_country")
    .eq("owner_id", ownerId)
    .maybeSingle();
  if (existing?.stripe_billing_country) {
    return {
      region: getRegionForCountry(existing.stripe_billing_country),
      source: "stripe_billing",
      confidence: "high",
    };
  }

  // 2. Verified business address country
  const { data: biz } = await supabase
    .from("businesses")
    .select("country_code")
    .eq("owner_id", ownerId)
    .not("country_code", "is", null)
    .order("created_at", { ascending: true })
    .limit(1);
  const bizCountry = biz?.[0]?.country_code;
  if (bizCountry) {
    return {
      region: getRegionForCountry(bizCountry),
      source: "business_address",
      confidence: "high",
    };
  }

  // 3. Registration-country snapshot (captured at first authenticated session)
  const { data: profile } = await supabase
    .from("profiles")
    .select("registration_country_code")
    .eq("id", ownerId)
    .maybeSingle();
  if (profile?.registration_country_code) {
    return {
      region: getRegionForCountry(profile.registration_country_code),
      source: "registration",
      confidence: "medium",
    };
  }

  // 4. Trusted server-side IP geolocation
  const ipCountry = ipCountryFromRequest(request);
  if (ipCountry) {
    return {
      region: getRegionForCountry(ipCountry),
      source: "ip_geolocation",
      confidence: "medium",
    };
  }

  // 5. Browser locale
  const locale = browserLocaleCountry(request);
  if (locale) {
    return {
      region: getRegionForCountry(locale),
      source: "browser_locale",
      confidence: "low",
    };
  }

  // 6. International fallback
  return {
    region: INTERNATIONAL_FALLBACK,
    source: "fallback",
    confidence: "low",
  };
}

export function toAccountRegionRow(
  ownerId: string,
  det: DetectionResult,
) {
  return {
    owner_id: ownerId,
    country_code: det.region.countryCode,
    country_name: det.region.countryName,
    currency_code: det.region.currencyCode,
    currency_symbol: det.region.currencySymbol,
    currency_name: det.region.currencyName,
    pricing_region: det.region.pricingRegion,
    detection_source: det.source,
    confidence: det.confidence,
    is_locked: true,
    detected_at: new Date().toISOString(),
  };
}

/**
 * Write an audit-log entry recording a change to an account_regions row.
 * Uses service role — caller is responsible for authorization.
 */
export async function writeRegionAudit(
  supabaseAdmin: SupabaseClient,
  entry: {
    ownerId: string;
    previous: {
      country_code: string | null;
      currency_code: string | null;
      pricing_region: string | null;
    } | null;
    next: {
      country_code: string;
      currency_code: string;
      pricing_region: string;
    };
    changeSource:
      | "initial_detection"
      | "admin_correction"
      | "stripe_verified"
      | "manual_support"
      | "system_backfill";
    reason?: string | null;
    changedBy?: string | null;
    stripeEventId?: string | null;
  },
): Promise<void> {
  await supabaseAdmin.from("account_region_audit_log").insert({
    owner_id: entry.ownerId,
    previous_country_code: entry.previous?.country_code ?? null,
    new_country_code: entry.next.country_code,
    previous_currency_code: entry.previous?.currency_code ?? null,
    new_currency_code: entry.next.currency_code,
    previous_pricing_region: entry.previous?.pricing_region ?? null,
    new_pricing_region: entry.next.pricing_region,
    change_source: entry.changeSource,
    reason: entry.reason ?? null,
    changed_by: entry.changedBy ?? null,
    stripe_event_id: entry.stripeEventId ?? null,
  });
}

/**
 * Apply a Stripe-verified billing country to an owner's account_regions row.
 * TRUSTED FLOW ONLY — must be called from a verified Stripe webhook handler
 * or an admin path that has already authorized the change.
 *
 * Rules:
 * - Never silently mutates the currency of an existing paid subscription.
 *   (Subscription state check is a placeholder until subscriptions exist;
 *   callers must pass allowCurrencyChange=true when this has been confirmed.)
 * - Always writes an audit entry.
 */
export async function applyVerifiedBillingRegion(
  supabaseAdmin: SupabaseClient,
  args: {
    ownerId: string;
    stripeBillingCountry: string;
    reason?: string;
    stripeCustomerId?: string | null;
    stripeEventId?: string | null;
    changedBy?: string | null;
    /** True once caller has confirmed there is no active subscription in
     *  a conflicting currency. Defaults to false — safe. */
    allowCurrencyChange?: boolean;
  },
): Promise<
  | { ok: true; conflict: false }
  | { ok: false; conflict: true; reason: string }
> {
  const cc = String(args.stripeBillingCountry ?? "").toUpperCase();
  if (!/^[A-Z]{2}$/.test(cc)) {
    return { ok: false, conflict: true, reason: "Invalid ISO country code." };
  }
  const region = getRegionForCountry(cc);

  const { data: existing } = await supabaseAdmin
    .from("account_regions")
    .select("*")
    .eq("owner_id", args.ownerId)
    .maybeSingle();

  const currencyWouldChange =
    existing && existing.currency_code !== region.currencyCode;

  if (currencyWouldChange && args.allowCurrencyChange !== true) {
    // Flag for review — do not silently switch currency of a running account.
    return {
      ok: false,
      conflict: true,
      reason:
        "Stripe billing country would change the account currency. An administrator must approve this change.",
    };
  }

  const row = {
    owner_id: args.ownerId,
    country_code: region.countryCode,
    country_name: region.countryName,
    currency_code: region.currencyCode,
    currency_symbol: region.currencySymbol,
    currency_name: region.currencyName,
    pricing_region: region.pricingRegion,
    detection_source: "stripe_billing",
    confidence: "high",
    is_locked: true,
    detected_at: existing?.detected_at ?? new Date().toISOString(),
    confirmed_at: new Date().toISOString(),
    stripe_billing_country: cc,
  };

  const { error } = await supabaseAdmin
    .from("account_regions")
    .upsert(row, { onConflict: "owner_id" });
  if (error) throw new Error(error.message);

  await writeRegionAudit(supabaseAdmin, {
    ownerId: args.ownerId,
    previous: existing
      ? {
          country_code: existing.country_code,
          currency_code: existing.currency_code,
          pricing_region: existing.pricing_region,
        }
      : null,
    next: {
      country_code: row.country_code,
      currency_code: row.currency_code,
      pricing_region: row.pricing_region,
    },
    changeSource: "stripe_verified",
    reason: args.reason ?? "Verified Stripe billing address",
    changedBy: args.changedBy ?? null,
    stripeEventId: args.stripeEventId ?? null,
  });

  return { ok: true, conflict: false };
}
