// Print Store pricing, margin rules and cart maths.
//
// Everything here is pure so it can be unit tested and reused by both the
// browser (display) and the server (authoritative totals). The server is the
// only caller allowed to see supplier cost.

import type { PricingRegion, CurrencyCode } from "./regions";
import { REGIONAL_PLAN_PRICES } from "./regional-pricing";
import type { PlanTierKey } from "./entitlements";
import type { ShippingClass } from "./print-catalogue";

/** Catalogue prices are authored in NZD minor units and adjusted per region. */
export const PRINT_BASE_CURRENCY: CurrencyCode = "NZD";

export interface MarginRules {
  /** Flat markup added to supplier cost before percentage markup. */
  fixedMarkupMinor: number;
  /** Percentage markup applied on top of supplier cost. */
  percentMarkup: number;
  /** A product may not be published below this gross margin percentage. */
  minMarginPercent: number;
  /** Default discount applied to a bundle's component retail prices. */
  bundleDiscountPercent: number;
  /** Plan-based print discounts. Configurable, never below min margin. */
  planDiscountPercent: Record<PlanTierKey, number>;
}

export const DEFAULT_MARGIN_RULES: MarginRules = {
  fixedMarkupMinor: 300,
  percentMarkup: 70,
  minMarginPercent: 35,
  bundleDiscountPercent: 10,
  planDiscountPercent: { free: 0, pro: 5, business: 10 },
};

/**
 * Region adjustment applied to the NZD base price. Deliberately hand-set per
 * market — there is no live FX feed, and print freight differs by region.
 */
export const PRINT_REGION_FACTORS: Record<PricingRegion, number> = {
  NZ: 1,
  AU: 0.95,
  US: 0.62,
  CA: 0.85,
  GB: 0.5,
  EU: 0.58,
  SG: 0.82,
  HK: 4.8,
  JP: 92,
  KR: 830,
  IN: 52,
  ZA: 11.5,
  AE: 2.3,
  SA: 2.35,
  CH: 0.55,
  NO: 6.6,
  SE: 6.6,
  DK: 4.3,
  PL: 2.5,
  BR: 3.4,
  MX: 11.5,
  MY: 2.9,
  TH: 22,
  PH: 35,
  ID: 9800,
  INTERNATIONAL: 0.62,
};

/** Currencies without a minor unit — amounts must stay whole. */
const ZERO_DECIMAL: CurrencyCode[] = ["JPY", "KRW", "IDR"];

export function printCurrencyFor(region: PricingRegion): CurrencyCode {
  return REGIONAL_PLAN_PRICES[region].pro_monthly.currency;
}

export function isZeroDecimal(currency: CurrencyCode): boolean {
  return ZERO_DECIMAL.includes(currency);
}

/**
 * Convert an NZD base amount into the region's currency and round it to a
 * tidy retail figure (nearest 0.50 for decimal currencies, nearest 100 units
 * for zero-decimal currencies).
 */
export function convertBaseMinor(baseMinor: number, region: PricingRegion): number {
  const currency = printCurrencyFor(region);
  const raw = baseMinor * (PRINT_REGION_FACTORS[region] ?? 1);
  if (isZeroDecimal(currency)) return Math.max(0, Math.round(raw / 100) * 100);
  return Math.max(0, Math.round(raw / 50) * 50);
}

// ---------------------------------------------------------------- margins

export interface MarginBreakdown {
  retailMinor: number;
  costMinor: number;
  marginMinor: number;
  marginPercent: number;
}

export function marginFor(retailMinor: number, costMinor: number): MarginBreakdown {
  const marginMinor = retailMinor - costMinor;
  const marginPercent = retailMinor > 0 ? (marginMinor / retailMinor) * 100 : 0;
  return {
    retailMinor,
    costMinor,
    marginMinor,
    marginPercent: Math.round(marginPercent * 10) / 10,
  };
}

/** A product may only be published when it clears the minimum margin. */
export function canPublish(
  retailMinor: number,
  costMinor: number,
  rules: MarginRules = DEFAULT_MARGIN_RULES,
): { ok: boolean; reason?: string; margin: MarginBreakdown } {
  const margin = marginFor(retailMinor, costMinor);
  if (margin.marginPercent < rules.minMarginPercent) {
    return {
      ok: false,
      reason: `Gross margin ${margin.marginPercent}% is below the ${rules.minMarginPercent}% minimum.`,
      margin,
    };
  }
  return { ok: true, margin };
}

/** Suggested retail price from supplier cost, using the configured markups. */
export function suggestedRetailMinor(
  costMinor: number,
  rules: MarginRules = DEFAULT_MARGIN_RULES,
): number {
  return Math.round(costMinor * (1 + rules.percentMarkup / 100) + rules.fixedMarkupMinor);
}

/**
 * Plan discount, capped so the order never falls below the minimum margin.
 * Returns the percentage that may actually be applied.
 */
export function allowedDiscountPercent(
  plan: PlanTierKey,
  subtotalMinor: number,
  costMinor: number,
  rules: MarginRules = DEFAULT_MARGIN_RULES,
): number {
  const requested = rules.planDiscountPercent[plan] ?? 0;
  if (requested <= 0 || subtotalMinor <= 0) return 0;
  // Largest discount that still leaves minMarginPercent of the discounted price.
  const floor = costMinor / (1 - rules.minMarginPercent / 100);
  if (floor >= subtotalMinor) return 0;
  const maxPercent = ((subtotalMinor - floor) / subtotalMinor) * 100;
  return Math.max(0, Math.min(requested, Math.floor(maxPercent * 10) / 10));
}

// ---------------------------------------------------------------- shipping

const SHIPPING_BASE_NZD: Record<ShippingClass, number> = {
  letter: 500,
  parcel: 990,
  tube: 1490,
};

/** Extra pieces beyond the first in the same class. */
const SHIPPING_EXTRA_NZD = 250;

export function estimateShippingMinor(
  lines: Array<{ shippingClass: ShippingClass; quantity: number }>,
  region: PricingRegion,
): number {
  if (!lines.length) return 0;
  const heaviest = lines.reduce<ShippingClass>((acc, line) => {
    const order: ShippingClass[] = ["letter", "parcel", "tube"];
    return order.indexOf(line.shippingClass) > order.indexOf(acc) ? line.shippingClass : acc;
  }, "letter");
  const pieces = lines.reduce((sum, l) => sum + l.quantity, 0);
  const base = SHIPPING_BASE_NZD[heaviest] + Math.max(0, pieces - 1) * SHIPPING_EXTRA_NZD;
  return convertBaseMinor(base, region);
}

// ---------------------------------------------------------------- tax

export interface TaxRule {
  rate: number;
  inclusive: boolean;
  label: string;
}

const DEFAULT_TAX: TaxRule = { rate: 0, inclusive: false, label: "Tax" };

/**
 * Indicative tax only. Stripe Tax remains the authority at payment time when
 * automatic tax is switched on for the deployment.
 */
export const PRINT_TAX_RULES: Partial<Record<PricingRegion, TaxRule>> = {
  NZ: { rate: 15, inclusive: true, label: "GST" },
  AU: { rate: 10, inclusive: true, label: "GST" },
  GB: { rate: 20, inclusive: true, label: "VAT" },
  EU: { rate: 21, inclusive: true, label: "VAT" },
  SG: { rate: 9, inclusive: true, label: "GST" },
  CH: { rate: 8.1, inclusive: true, label: "VAT" },
  NO: { rate: 25, inclusive: true, label: "VAT" },
  SE: { rate: 25, inclusive: true, label: "VAT" },
  DK: { rate: 25, inclusive: true, label: "VAT" },
  PL: { rate: 23, inclusive: true, label: "VAT" },
  ZA: { rate: 15, inclusive: true, label: "VAT" },
  AE: { rate: 5, inclusive: true, label: "VAT" },
  SA: { rate: 15, inclusive: true, label: "VAT" },
  IN: { rate: 18, inclusive: true, label: "GST" },
  JP: { rate: 10, inclusive: true, label: "Consumption tax" },
  MY: { rate: 8, inclusive: true, label: "SST" },
  ID: { rate: 11, inclusive: true, label: "VAT" },
  PH: { rate: 12, inclusive: true, label: "VAT" },
  TH: { rate: 7, inclusive: true, label: "VAT" },
  MX: { rate: 16, inclusive: true, label: "IVA" },
  BR: { rate: 17, inclusive: true, label: "ICMS" },
  KR: { rate: 10, inclusive: true, label: "VAT" },
  HK: { rate: 0, inclusive: false, label: "Tax" },
  US: { rate: 0, inclusive: false, label: "Sales tax" },
  CA: { rate: 0, inclusive: false, label: "GST/HST" },
  INTERNATIONAL: { rate: 0, inclusive: false, label: "Tax" },
};

export function taxRuleFor(region: PricingRegion): TaxRule {
  return PRINT_TAX_RULES[region] ?? DEFAULT_TAX;
}

/** Tax component of a taxable amount, honouring inclusive pricing. */
export function estimateTaxMinor(taxableMinor: number, region: PricingRegion): number {
  const rule = taxRuleFor(region);
  if (rule.rate <= 0 || taxableMinor <= 0) return 0;
  const r = rule.rate / 100;
  return rule.inclusive
    ? Math.round(taxableMinor - taxableMinor / (1 + r))
    : Math.round(taxableMinor * r);
}

// ---------------------------------------------------------------- cart

export interface CartPricingLine {
  quantity: number;
  unitRetailMinor: number;
  unitCostMinor: number;
  shippingClass: ShippingClass;
  bundleId?: string | null;
}

export interface CartTotals {
  currency: CurrencyCode;
  region: PricingRegion;
  subtotalMinor: number;
  discountPercent: number;
  discountMinor: number;
  shippingMinor: number;
  taxMinor: number;
  taxLabel: string;
  taxInclusive: boolean;
  totalMinor: number;
  /** Internal only — never sent to a customer surface. */
  estimatedCostMinor: number;
  estimatedMarginMinor: number;
  estimatedMarginPercent: number;
}

/**
 * Authoritative cart maths. `plan` drives the print discount; the discount is
 * automatically capped so gross margin never drops below the configured floor.
 */
export function computeCartTotals(
  lines: CartPricingLine[],
  region: PricingRegion,
  plan: PlanTierKey,
  rules: MarginRules = DEFAULT_MARGIN_RULES,
): CartTotals {
  const currency = printCurrencyFor(region);
  const subtotalMinor = lines.reduce((s, l) => s + l.unitRetailMinor * l.quantity, 0);
  const costMinor = lines.reduce((s, l) => s + l.unitCostMinor * l.quantity, 0);

  const discountPercent = allowedDiscountPercent(plan, subtotalMinor, costMinor, rules);
  const discountMinor = Math.round((subtotalMinor * discountPercent) / 100);
  const netMinor = subtotalMinor - discountMinor;

  const shippingMinor = estimateShippingMinor(lines, region);
  const rule = taxRuleFor(region);
  const taxMinor = estimateTaxMinor(netMinor + shippingMinor, region);

  // Inclusive regimes already have tax inside the retail price.
  const totalMinor = rule.inclusive
    ? netMinor + shippingMinor
    : netMinor + shippingMinor + taxMinor;

  const marginMinor = netMinor - costMinor;
  return {
    currency,
    region,
    subtotalMinor,
    discountPercent,
    discountMinor,
    shippingMinor,
    taxMinor,
    taxLabel: rule.label,
    taxInclusive: rule.inclusive,
    totalMinor,
    estimatedCostMinor: costMinor,
    estimatedMarginMinor: marginMinor,
    estimatedMarginPercent: netMinor > 0 ? Math.round((marginMinor / netMinor) * 1000) / 10 : 0,
  };
}

/** Customer-safe projection — strips supplier cost and margin. */
export function publicTotals(totals: CartTotals) {
  const {
    estimatedCostMinor: _cost,
    estimatedMarginMinor: _margin,
    estimatedMarginPercent: _pct,
    ...rest
  } = totals;
  return rest;
}
