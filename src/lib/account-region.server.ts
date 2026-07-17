// Server-only helpers for detecting and persisting account regions.
// Runs inside server-function handlers; must never be imported from
// client-reachable module scope.

import { getRegionForCountry, INTERNATIONAL_FALLBACK, type RegionConfig } from "./regions";
import type { SupabaseClient } from "@supabase/supabase-js";

export type DetectionSource =
  | "stripe_billing"
  | "business_address"
  | "profile"
  | "ip_geolocation"
  | "browser_locale"
  | "fallback";

export type Confidence = "high" | "medium" | "low";

export interface DetectionResult {
  region: RegionConfig;
  source: DetectionSource;
  confidence: Confidence;
}

/** Trusted server-side IP geolocation via Cloudflare's CF-IPCountry header
 *  (present in Workers). Falls back to a bogus fetch if unavailable. */
export function ipCountryFromRequest(request: Request | undefined): string | null {
  if (!request) return null;
  const cf = request.headers.get("cf-ipcountry");
  if (cf && /^[A-Z]{2}$/i.test(cf) && cf.toUpperCase() !== "XX" && cf.toUpperCase() !== "T1") {
    return cf.toUpperCase();
  }
  const alt = request.headers.get("x-vercel-ip-country") ?? request.headers.get("x-country-code");
  if (alt && /^[A-Z]{2}$/i.test(alt)) return alt.toUpperCase();
  return null;
}

export function browserLocaleCountry(request: Request | undefined): string | null {
  if (!request) return null;
  const al = request.headers.get("accept-language");
  if (!al) return null;
  // e.g. "en-NZ,en;q=0.9"
  const match = al.split(",")[0]?.match(/[a-z]{2,3}[-_]([A-Z]{2})/i);
  if (match?.[1]) return match[1].toUpperCase();
  return null;
}

/**
 * Country-detection priority.
 * Trusted signals only: DB reads under service_role, request headers.
 */
export async function detectAccountCountry(
  supabase: SupabaseClient,
  ownerId: string,
  request: Request | undefined,
): Promise<DetectionResult> {
  // 1. Verified Stripe billing country (once available)
  const { data: existing } = await supabase
    .from("account_regions")
    .select("stripe_billing_country, is_locked, country_code")
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

  // 3. Account registration profile country (if the field exists)
  //    profiles table has no country column today; skipped.

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

  // 6. Default fallback
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
