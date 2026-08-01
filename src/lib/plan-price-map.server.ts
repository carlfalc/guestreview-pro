/**
 * Trusted Stripe price -> plan resolution.
 *
 * A subscription's plan is NEVER inferred from a price-ID prefix. Every
 * Stripe price must match an exact row in `regional_plan_prices` for the
 * active environment. Unknown prices are a billing configuration error, not
 * a silent downgrade to Free.
 */
import type { SupabaseClient } from "@supabase/supabase-js";
import type { StripeEnv } from "./stripe.server";

export interface TrustedPlanPrice {
  stripePriceId: string | null;
  stripeLookupKey: string;
  planKey: "pro" | "business";
  billingInterval: "monthly" | "annual";
  currencyCode: string;
  pricingRegion: string;
  amountMinor: number;
  environment: StripeEnv;
}

export class UnknownStripePriceError extends Error {
  constructor(
    readonly detail: { priceId?: string | null; lookupKey?: string | null; environment: StripeEnv },
  ) {
    super(
      `BILLING_CONFIG_ERROR: Stripe price is not in the trusted plan mapping ` +
        `(price=${detail.priceId ?? "unknown"}, lookup_key=${detail.lookupKey ?? "unknown"}, env=${detail.environment}).`,
    );
    this.name = "UnknownStripePriceError";
  }
}

function mapRow(row: Record<string, unknown>): TrustedPlanPrice {
  return {
    stripePriceId: (row.stripe_price_id as string | null) ?? null,
    stripeLookupKey: row.stripe_lookup_key as string,
    planKey: row.plan_key as "pro" | "business",
    billingInterval: row.billing_interval as "monthly" | "annual",
    currencyCode: row.currency_code as string,
    pricingRegion: row.pricing_region as string,
    amountMinor: row.amount_minor as number,
    environment: row.environment as StripeEnv,
  };
}

/** Look up by Stripe lookup key (used before checkout). */
export async function findTrustedPriceByLookupKey(
  admin: SupabaseClient,
  lookupKey: string,
  environment: StripeEnv,
): Promise<TrustedPlanPrice | null> {
  const { data, error } = await admin
    .from("regional_plan_prices")
    .select("*")
    .eq("stripe_lookup_key", lookupKey)
    .eq("environment", environment)
    .eq("active", true)
    .maybeSingle();
  if (error) throw new Error(error.message);
  return data ? mapRow(data as Record<string, unknown>) : null;
}

/**
 * Resolve a Stripe price object (from a webhook) to a trusted plan.
 * Tries the concrete price ID first, then the lookup key, then the legacy
 * `lovable_external_id` metadata. Throws when nothing matches.
 */
export async function resolveTrustedPlanForPrice(
  admin: SupabaseClient,
  price:
    | {
        id?: string | null;
        lookup_key?: string | null;
        currency?: string | null;
        unit_amount?: number | null;
        metadata?: Record<string, string> | null;
      }
    | null
    | undefined,
  environment: StripeEnv,
): Promise<TrustedPlanPrice> {
  const priceId = price?.id ?? null;
  const lookupKey = price?.lookup_key ?? price?.metadata?.lovable_external_id ?? null;

  let row: TrustedPlanPrice | null = null;

  if (priceId) {
    const { data, error } = await admin
      .from("regional_plan_prices")
      .select("*")
      .eq("stripe_price_id", priceId)
      .eq("environment", environment)
      .eq("active", true)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (data) row = mapRow(data as Record<string, unknown>);
  }

  if (!row && lookupKey) {
    row = await findTrustedPriceByLookupKey(admin, lookupKey, environment);
  }

  if (!row) throw new UnknownStripePriceError({ priceId, lookupKey, environment });

  // Validate what Stripe actually charged against the trusted mapping.
  const currency = (price?.currency ?? "").toUpperCase();
  if (currency && currency !== row.currencyCode) {
    throw new UnknownStripePriceError({ priceId, lookupKey, environment });
  }
  if (typeof price?.unit_amount === "number" && price.unit_amount !== row.amountMinor) {
    throw new UnknownStripePriceError({ priceId, lookupKey, environment });
  }

  return row;
}

/**
 * Record the concrete Stripe price ID against a trusted mapping row the first
 * time we see it, so later lookups resolve by ID directly.
 */
export async function backfillStripePriceId(
  admin: SupabaseClient,
  lookupKey: string,
  environment: StripeEnv,
  stripePriceId: string,
): Promise<void> {
  await admin
    .from("regional_plan_prices")
    .update({ stripe_price_id: stripePriceId })
    .eq("stripe_lookup_key", lookupKey)
    .eq("environment", environment)
    .is("stripe_price_id", null);
}
