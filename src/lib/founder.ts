// Founding Member Beta — pure, client-safe rules and pricing.
//
// The offer is limited to the first 100 successful paid Pro subscriptions.
// Nothing in this module decides eligibility on its own: slot counting and
// allocation are always server-authoritative (see founder.server.ts). This
// file only describes the offer so the UI and the server agree on wording,
// amounts and lookup keys.

import type { PricingRegion, CurrencyCode } from "./regions";
import {
  STRIPE_BILLING_CURRENCIES,
  getRegionalPlanPrices,
  type PaidInterval,
} from "./regional-pricing";

/** Hard programme cap. Mirrored by the database function of the same value. */
export const FOUNDER_SLOT_LIMIT = 100;

/** Founder plans always grant Pro entitlements — never a separate tier. */
export const FOUNDER_TIER = "pro" as const;

export type FounderSlotStatus = "pending" | "active" | "released" | "refunded" | "canceled";

/** A slot in one of these states is occupying one of the 100 places. */
export const FOUNDER_HELD_STATUSES: FounderSlotStatus[] = ["pending", "active"];

export interface FounderRegionPrices {
  currency: CurrencyCode;
  monthly: number;
  annual: number;
}

/**
 * Founder pricing per region, in integer minor units. Only currencies with
 * real Stripe recurring prices are listed; every other region is billed at
 * the INTERNATIONAL (US$) founder rate, exactly like standard pricing.
 */
export const FOUNDER_PRO_PRICES: Partial<Record<PricingRegion, FounderRegionPrices>> = {
  NZ: { currency: "NZD", monthly: 1900, annual: 19000 },
  AU: { currency: "AUD", monthly: 1900, annual: 19000 },
  US: { currency: "USD", monthly: 1200, annual: 12000 },
  CA: { currency: "CAD", monthly: 1700, annual: 17000 },
  GB: { currency: "GBP", monthly: 1000, annual: 10000 },
  EU: { currency: "EUR", monthly: 1100, annual: 11000 },
  INTERNATIONAL: { currency: "USD", monthly: 1200, annual: 12000 },
};

export interface FounderPlan {
  tier: "pro";
  interval: PaidInterval;
  /** Region the founder price is actually charged in. */
  billingRegion: PricingRegion;
  currency: CurrencyCode;
  /** Founder amount in minor units. */
  amountMinor: number;
  /** Standard Pro amount in the same currency, for the struck-through price. */
  standardAmountMinor: number;
  /** Percentage saved against standard Pro, rounded. */
  discountPercent: number;
  /** Stripe lookup key, e.g. `founder_pro_nzd_monthly`. */
  stripeLookupKey: string;
  /** True when the account's local currency has no Stripe price yet. */
  usesFallbackCurrency: boolean;
}

/**
 * Resolve the single authorised founder plan for a pricing region.
 * Mirrors `resolveBillablePlan` so region/currency can never be chosen by the
 * browser.
 */
export function resolveFounderPlan(
  pricingRegion: PricingRegion,
  interval: PaidInterval,
): FounderPlan {
  const localPrices = getRegionalPlanPrices(pricingRegion);
  const localCurrency = localPrices.pro_monthly.currency;
  const supported =
    STRIPE_BILLING_CURRENCIES.includes(localCurrency) && Boolean(FOUNDER_PRO_PRICES[pricingRegion]);
  const billingRegion: PricingRegion = supported ? pricingRegion : "INTERNATIONAL";
  const founder = FOUNDER_PRO_PRICES[billingRegion]!;
  const standard = getRegionalPlanPrices(billingRegion);

  const amountMinor = interval === "annual" ? founder.annual : founder.monthly;
  const standardAmountMinor =
    interval === "annual" ? standard.pro_annual.amountMinor : standard.pro_monthly.amountMinor;

  return {
    tier: FOUNDER_TIER,
    interval,
    billingRegion,
    currency: founder.currency,
    amountMinor,
    standardAmountMinor,
    discountPercent:
      standardAmountMinor > 0 ? Math.round((1 - amountMinor / standardAmountMinor) * 100) : 0,
    stripeLookupKey: `founder_pro_${founder.currency.toLowerCase()}_${interval}`,
    usesFallbackCurrency: !supported,
  };
}

/** Every founder lookup key the programme can ever use. */
export function allFounderLookupKeys(): string[] {
  const keys = new Set<string>();
  for (const value of Object.values(FOUNDER_PRO_PRICES)) {
    if (!value) continue;
    keys.add(`founder_pro_${value.currency.toLowerCase()}_monthly`);
    keys.add(`founder_pro_${value.currency.toLowerCase()}_annual`);
  }
  return [...keys].sort();
}

/** True when a Stripe lookup key belongs to the founder programme. */
export function isFounderLookupKey(lookupKey: string | null | undefined): boolean {
  return typeof lookupKey === "string" && /^founder_pro_[a-z]{3}_(monthly|annual)$/.test(lookupKey);
}

/** "Founding Member #042" — always three digits. */
export function formatSlotNumber(slotNumber: number | null | undefined): string {
  if (typeof slotNumber !== "number" || !Number.isFinite(slotNumber)) return "";
  return `#${String(Math.trunc(slotNumber)).padStart(3, "0")}`;
}

export function founderBadgeLabel(slotNumber: number | null | undefined): string {
  const n = formatSlotNumber(slotNumber);
  return n ? `Founding Member ${n}` : "Founding Member";
}

/** Only an active slot keeps founder pricing and the badge. */
export function isFounderActive(slot: { status?: string | null } | null | undefined): boolean {
  return slot?.status === "active";
}

/** The offer is only purchasable while unallocated places remain. */
export function founderOfferAvailable(remaining: number | null | undefined): boolean {
  return typeof remaining === "number" && remaining > 0;
}

export function remainingLabel(remaining: number): string {
  if (remaining <= 0) return "All 100 founder places have been claimed";
  if (remaining === 1) return "1 founder place left";
  return `${remaining} of ${FOUNDER_SLOT_LIMIT} founder places left`;
}

/** Fixed programme wording — reused by pricing, checkout and emails. */
export const FOUNDER_COPY = {
  name: "Founding Member Pro",
  eyebrow: "Founding Member Beta",
  lockWording: "Locked founder pricing while your subscription remains active",
  terms: [
    "Limited to the first 100 successful paid Pro subscriptions.",
    "Your founder price stays locked for as long as your subscription remains continuously active.",
    "If you cancel and later return, standard pricing applies.",
    "A refunded subscription releases the founder place to the next customer.",
    "One founder offer per account. It cannot be combined with any other discount or promotion.",
  ],
  soldOut:
    "The founder places have all been claimed. You can still subscribe to Pro at the standard price for your region.",
} as const;

/** Founder feedback survey, opened 7 days after activation. */
export const FOUNDER_FEEDBACK_DELAY_DAYS = 7;

export const FOUNDER_FEEDBACK_QUESTIONS = [
  { key: "setup_ease", label: "How easy was it to get set up?", type: "scale-1-5" },
  { key: "nearly_stopped", label: "What nearly stopped you from using it?", type: "text" },
  {
    key: "most_important_feature",
    label: "Which feature matters most to you?",
    type: "text",
  },
  {
    key: "recommend_score",
    label: "How likely are you to recommend GuestReview Pro?",
    type: "scale-0-10",
  },
  { key: "missing", label: "What is missing today?", type: "text" },
] as const;

/** True once the founder has been active long enough to be asked for feedback. */
export function founderFeedbackDue(
  activatedAt: string | null | undefined,
  now: Date = new Date(),
): boolean {
  if (!activatedAt) return false;
  const activated = new Date(activatedAt).getTime();
  if (!Number.isFinite(activated)) return false;
  const days = (now.getTime() - activated) / 86_400_000;
  return days >= FOUNDER_FEEDBACK_DELAY_DAYS;
}
