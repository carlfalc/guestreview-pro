// Authoritative regional plan prices (integer minor units).
// Prices are deliberately set per market — no live FX conversion.

import type { PricingRegion, CurrencyCode } from "./regions";

export type PlanKey = "free" | "pro_monthly" | "pro_annual" | "business_monthly" | "business_annual";
export type BillingInterval = "one_time" | "monthly" | "annual";

export interface RegionalPlanPrice {
  currency: CurrencyCode;
  amountMinor: number;
  interval: BillingInterval;
  /** Stripe price ID (populated at Stripe checkout stage). */
  stripePriceId?: string | null;
  stripeTestPriceId?: string | null;
  stripeProductId?: string | null;
}

export type PlanPriceMap = Record<PlanKey, RegionalPlanPrice>;

function plans(currency: CurrencyCode, prices: Record<PlanKey, number>): PlanPriceMap {
  return {
    free:              { currency, amountMinor: prices.free,              interval: "one_time" },
    pro_monthly:       { currency, amountMinor: prices.pro_monthly,       interval: "monthly" },
    pro_annual:        { currency, amountMinor: prices.pro_annual,        interval: "annual" },
    business_monthly:  { currency, amountMinor: prices.business_monthly,  interval: "monthly" },
    business_annual:   { currency, amountMinor: prices.business_annual,   interval: "annual" },
  };
}

/**
 * Region → plan → price. Amounts are in minor units for the region's
 * currency. Zero-decimal currencies (JPY, KRW, IDR) still use integers,
 * but no cents component (see formatRegionalPrice).
 */
export const REGIONAL_PLAN_PRICES: Record<PricingRegion, PlanPriceMap> = {
  NZ: plans("NZD", { free: 0, pro_monthly: 1900, pro_annual: 19000, business_monthly: 4900, business_annual: 49000 }),
  AU: plans("AUD", { free: 0, pro_monthly: 1900, pro_annual: 19000, business_monthly: 4900, business_annual: 49000 }),
  US: plans("USD", { free: 0, pro_monthly: 1500, pro_annual: 15000, business_monthly: 3900, business_annual: 39000 }),
  CA: plans("CAD", { free: 0, pro_monthly: 2000, pro_annual: 20000, business_monthly: 5200, business_annual: 52000 }),
  GB: plans("GBP", { free: 0, pro_monthly: 1200, pro_annual: 12000, business_monthly: 3200, business_annual: 32000 }),
  EU: plans("EUR", { free: 0, pro_monthly: 1400, pro_annual: 14000, business_monthly: 3600, business_annual: 36000 }),
  SG: plans("SGD", { free: 0, pro_monthly: 2000, pro_annual: 20000, business_monthly: 5200, business_annual: 52000 }),
  HK: plans("HKD", { free: 0, pro_monthly: 12000, pro_annual: 120000, business_monthly: 30000, business_annual: 300000 }),
  JP: plans("JPY", { free: 0, pro_monthly: 2200, pro_annual: 22000, business_monthly: 5800, business_annual: 58000 }),
  KR: plans("KRW", { free: 0, pro_monthly: 20000, pro_annual: 200000, business_monthly: 55000, business_annual: 550000 }),
  IN: plans("INR", { free: 0, pro_monthly: 79900, pro_annual: 799000, business_monthly: 199900, business_annual: 1999000 }),
  ZA: plans("ZAR", { free: 0, pro_monthly: 19900, pro_annual: 199000, business_monthly: 49900, business_annual: 499000 }),
  AE: plans("AED", { free: 0, pro_monthly: 5500, pro_annual: 55000, business_monthly: 14500, business_annual: 145000 }),
  SA: plans("SAR", { free: 0, pro_monthly: 5500, pro_annual: 55000, business_monthly: 14500, business_annual: 145000 }),
  CH: plans("CHF", { free: 0, pro_monthly: 1400, pro_annual: 14000, business_monthly: 3600, business_annual: 36000 }),
  NO: plans("NOK", { free: 0, pro_monthly: 16900, pro_annual: 169000, business_monthly: 44900, business_annual: 449000 }),
  SE: plans("SEK", { free: 0, pro_monthly: 16900, pro_annual: 169000, business_monthly: 44900, business_annual: 449000 }),
  DK: plans("DKK", { free: 0, pro_monthly: 10900, pro_annual: 109000, business_monthly: 27900, business_annual: 279000 }),
  PL: plans("PLN", { free: 0, pro_monthly: 6900, pro_annual: 69000, business_monthly: 17900, business_annual: 179000 }),
  BR: plans("BRL", { free: 0, pro_monthly: 8900, pro_annual: 89000, business_monthly: 22900, business_annual: 229000 }),
  MX: plans("MXN", { free: 0, pro_monthly: 29900, pro_annual: 299000, business_monthly: 79900, business_annual: 799000 }),
  MY: plans("MYR", { free: 0, pro_monthly: 6900, pro_annual: 69000, business_monthly: 17900, business_annual: 179000 }),
  TH: plans("THB", { free: 0, pro_monthly: 55000, pro_annual: 550000, business_monthly: 149000, business_annual: 1490000 }),
  PH: plans("PHP", { free: 0, pro_monthly: 85000, pro_annual: 850000, business_monthly: 219900, business_annual: 2199000 }),
  ID: plans("IDR", { free: 0, pro_monthly: 250000, pro_annual: 2500000, business_monthly: 650000, business_annual: 6500000 }),
  INTERNATIONAL: plans("USD", { free: 0, pro_monthly: 1500, pro_annual: 15000, business_monthly: 3900, business_annual: 39000 }),
};

export const PLAN_ORDER: PlanKey[] = ["free", "pro_monthly", "pro_annual", "business_monthly", "business_annual"];

export interface PlanFeatureRow {
  key: "free" | "pro" | "business";
  name: string;
  tagline: string;
  features: string[];
}

export const PLAN_FEATURES: PlanFeatureRow[] = [
  {
    key: "free",
    name: "Free",
    tagline: "Get started with reviews.",
    features: [
      "1 business",
      "Up to 3 QR codes",
      "Basic analytics",
      "Basic marketing packs",
      "GuestReview Pro branding",
      "Limited AI copy generations",
    ],
  },
  {
    key: "pro",
    name: "Pro",
    tagline: "For growing venues.",
    features: [
      "1 business",
      "Unlimited QR codes",
      "Unlimited marketing packs",
      "Advanced analytics",
      "AI copy assistant",
      "Premium exports",
      "Remove GuestReview Pro branding",
      "Campaign tracking",
      "Priority support",
    ],
  },
  {
    key: "business",
    name: "Business",
    tagline: "For multi-location operators.",
    features: [
      "Up to 10 businesses",
      "Multi-location management",
      "Team accounts",
      "Portfolio reporting",
      "White-label exports",
      "Advanced campaign analytics",
      "Priority support",
    ],
  },
];

export function getRegionalPlanPrices(region: PricingRegion): PlanPriceMap {
  return REGIONAL_PLAN_PRICES[region] ?? REGIONAL_PLAN_PRICES.INTERNATIONAL;
}

/**
 * Server-side authorisation helper: returns the price config for a plan
 * ONLY in the caller's authorised pricing region. Refuses arbitrary region
 * IDs from the client.
 */
export function getAuthorisedRegionalPlan(
  authorisedRegion: PricingRegion,
  planKey: PlanKey,
): RegionalPlanPrice | null {
  const map = REGIONAL_PLAN_PRICES[authorisedRegion];
  if (!map) return null;
  return map[planKey] ?? null;
}
