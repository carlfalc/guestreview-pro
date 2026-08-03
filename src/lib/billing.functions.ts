// Client-callable billing surface.
//
// The browser may only choose tier + interval and an allow-listed return path.
// Currency, amount, pricing region, Stripe price ID, the payment environment
// and the final return URL are all derived server-side.
import { createServerFn } from "@tanstack/react-start";
import { getRequest } from "@tanstack/react-start/server";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import type { PlanTier, PaidInterval } from "./regional-pricing";
import type { PlanTierKey, PlanEntitlements, UsageCounts } from "./entitlements";
import type { AccountSubscription, StripeEnvName } from "./entitlements.server";

const TIERS: PlanTier[] = ["pro", "business"];
const INTERVALS: PaidInterval[] = ["monthly", "annual"];

/** Trusted environment + host for the current request. Never client input. */
async function trustedContext(): Promise<{ environment: StripeEnvName; host: string | null }> {
  const { resolvePaymentsEnvironment, requestHost } = await import("./payments-env.server");
  let host: string | null = null;
  try {
    host = requestHost(getRequest());
  } catch {
    host = null;
  }
  return { environment: resolvePaymentsEnvironment(host), host };
}

export interface AccountBillingState {
  plan: PlanTierKey;
  entitlements: PlanEntitlements;
  usage: UsageCounts;
  subscription: AccountSubscription | null;
  /** Which Stripe environment the server actually used. Display only. */
  environment: StripeEnvName;
}

/** Authoritative plan + entitlements + usage for the signed-in account. */
export const getMyBillingState = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<AccountBillingState> => {
    const { environment } = await trustedContext();
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { getAccountEntitlements } = await import("./entitlements.server");
    const state = await getAccountEntitlements(supabaseAdmin as never, context.userId, environment);
    return {
      plan: state.plan,
      entitlements: state.entitlements,
      usage: state.usage,
      subscription: state.subscription,
      environment,
    };
  });

export interface CheckoutResult {
  clientSecret?: string;
  /** Set when the account already pays — the UI sends them to the portal. */
  alreadySubscribed?: boolean;
  /**
   * The founder offer was requested but is no longer available to this
   * account. No session is created and nothing is charged — the UI must ask
   * the customer to confirm standard pricing first.
   */
  founderUnavailable?: boolean;
  founderUnavailableReason?: string;
  /** True when the session that was created uses the locked founder price. */
  founderApplied?: boolean;
  error?: string;
}

export const createSubscriptionCheckout = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    (data: {
      tier: PlanTier;
      interval: PaidInterval;
      returnPath?: string;
      founder?: boolean;
      acceptStandardIfSoldOut?: boolean;
    }) => {
      if (!TIERS.includes(data?.tier)) throw new Error("Unknown plan.");
      if (!INTERVALS.includes(data?.interval)) throw new Error("Unknown billing interval.");
      return {
        tier: data.tier,
        interval: data.interval,
        returnPath: typeof data?.returnPath === "string" ? data.returnPath : undefined,
        founder: data?.founder === true,
        acceptStandardIfSoldOut: data?.acceptStandardIfSoldOut === true,
      };
    },
  )
  .handler(async ({ data, context }): Promise<CheckoutResult> => {
    const { environment, host } = await trustedContext();
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { createStripeClient, getStripeErrorMessage, automaticTaxEnabled } =
      await import("./stripe.server");
    const { resolveBillablePlan } = await import("./regional-pricing");
    const { loadSubscription } = await import("./entitlements.server");
    const { effectivePlan } = await import("./entitlements");
    const { getOrCreateStripeCustomer } = await import("./stripe-customer.server");
    const { buildReturnUrl } = await import("./payments-env.server");
    const { findTrustedPriceByLookupKey, backfillStripePriceId } =
      await import("./plan-price-map.server");

    const admin = supabaseAdmin as never;

    // 1. Locked pricing region — never a client-supplied country/currency.
    const { data: region, error: regionError } = await supabaseAdmin
      .from("account_regions")
      .select("pricing_region, country_code")
      .eq("owner_id", context.userId)
      .maybeSingle();
    if (regionError) return { error: regionError.message };
    if (!region)
      return { error: "Your billing region has not been resolved yet. Reload and try again." };

    // 2. Refuse a second active subscription.
    const existing = await loadSubscription(admin, context.userId, environment);
    if (existing && effectivePlan(existing) !== "free" && existing.status !== "canceled") {
      return { alreadySubscribed: true };
    }

    // 3. Founder pricing — server-resolved only, and only for Pro.
    let founderApplied = false;
    let lookupKey: string;
    if (data.founder && data.tier === "pro") {
      const { founderOfferEligible } = await import("./founder.server");
      const { resolveFounderPlan } = await import("./founder");
      const eligibility = await founderOfferEligible(admin, context.userId);
      if (eligibility.eligible) {
        founderApplied = true;
        lookupKey = resolveFounderPlan(region.pricing_region as never, data.interval)
          .stripeLookupKey;
      } else if (!data.acceptStandardIfSoldOut) {
        // Sold out (or already used) — never silently charge standard pricing.
        return {
          founderUnavailable: true,
          ...(eligibility.reason ? { founderUnavailableReason: eligibility.reason } : {}),
        };
      } else {
        lookupKey = resolveBillablePlan(
          region.pricing_region as never,
          data.tier,
          data.interval,
        ).stripeLookupKey;
      }
    } else {
      lookupKey = resolveBillablePlan(
        region.pricing_region as never,
        data.tier,
        data.interval,
      ).stripeLookupKey;
    }

    const plan = {
      ...resolveBillablePlan(region.pricing_region as never, data.tier, data.interval),
      stripeLookupKey: lookupKey,
    };

    // 4. The price must exist in the trusted mapping for THIS environment.
    const trusted = await findTrustedPriceByLookupKey(
      supabaseAdmin as never,
      plan.stripeLookupKey,
      environment,
    );
    if (!trusted) {
      return {
        error: `This plan is not available for purchase right now. (${plan.stripeLookupKey})`,
      };
    }


    try {
      const stripe = createStripeClient(environment);

      const prices = await stripe.prices.list({ lookup_keys: [plan.stripeLookupKey], limit: 1 });
      if (!prices.data.length) {
        return { error: `No price is configured for ${plan.stripeLookupKey}.` };
      }
      const stripePrice = prices.data[0];

      // 4. Validate what Stripe returned against the trusted mapping.
      if (
        (stripePrice.currency ?? "").toUpperCase() !== trusted.currencyCode ||
        (stripePrice.unit_amount ?? -1) !== trusted.amountMinor
      ) {
        return { error: "Plan pricing is misconfigured. Please contact support." };
      }
      if (!trusted.stripePriceId) {
        await backfillStripePriceId(
          supabaseAdmin as never,
          trusted.stripeLookupKey,
          environment,
          stripePrice.id,
        );
      }

      const customerId = await getOrCreateStripeCustomer({
        stripe,
        admin,
        supabase: context.supabase,
        ownerId: context.userId,
        environment,
        countryCode: region.country_code as string,
        pricingRegion: region.pricing_region as string,
      });

      const session = await stripe.checkout.sessions.create({
        mode: "subscription",
        ui_mode: "embedded_page",
        return_url: buildReturnUrl(data.returnPath ?? "/billing", host, {
          checkout: "complete",
          session_id: "{CHECKOUT_SESSION_ID}",
        }),
        customer: customerId,
        line_items: [{ price: stripePrice.id, quantity: 1 }],
        billing_address_collection: "required",
        ...(automaticTaxEnabled() ? { automatic_tax: { enabled: true } } : {}),
        metadata: {
          userId: context.userId,
          owner_id: context.userId,
          plan_key: plan.tier,
          billing_interval: plan.interval,
          pricing_region: plan.billingRegion,
          founder: founderApplied ? "true" : "false",
          founder_lookup_key: founderApplied ? plan.stripeLookupKey : "",
        },
        subscription_data: {
          metadata: {
            userId: context.userId,
            owner_id: context.userId,
            plan_key: plan.tier,
            billing_interval: plan.interval,
            pricing_region: plan.billingRegion,
            founder: founderApplied ? "true" : "false",
            founder_lookup_key: founderApplied ? plan.stripeLookupKey : "",
          },
        },
      });


      // Record the attempt so an abandoned checkout can be recovered later.
      // Best-effort: a failure here must never block a paying customer.
      try {
        const attempts = (
          supabaseAdmin as unknown as {
            from: (table: string) => { insert: (row: Record<string, unknown>) => Promise<unknown> };
          }
        ).from("checkout_attempts");
        await attempts.insert({
          owner_id: context.userId,
          environment,
          plan_key: plan.tier,
          billing_interval: plan.interval,
          currency_code: trusted.currencyCode,
          amount_minor: trusted.amountMinor,
          stripe_session_id: session.id,
          status: "started",
        });
      } catch (e) {
        console.error("checkout_attempts insert failed:", e);
      }

      return { clientSecret: session.client_secret ?? "", founderApplied };
    } catch (error) {
      return { error: getStripeErrorMessage(error) };
    }
  });

export const createCustomerPortalSession = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data?: { returnPath?: string }) => ({
    returnPath: typeof data?.returnPath === "string" ? data.returnPath : undefined,
  }))
  .handler(async ({ data, context }): Promise<{ url?: string; error?: string }> => {
    const { environment, host } = await trustedContext();
    const { buildReturnUrl } = await import("./payments-env.server");

    // RLS-scoped read: a caller can only ever reach their own customer id.
    const { data: sub, error } = await context.supabase
      .from("subscriptions")
      .select("stripe_customer_id")
      .eq("owner_id", context.userId)
      .eq("environment", environment)
      .maybeSingle();
    if (error) return { error: error.message };
    if (!sub?.stripe_customer_id) return { error: "No billing account found for this user." };

    const { createStripeClient, getStripeErrorMessage } = await import("./stripe.server");
    try {
      const stripe = createStripeClient(environment);
      const portal = await stripe.billingPortal.sessions.create({
        customer: sub.stripe_customer_id,
        return_url: buildReturnUrl(data?.returnPath ?? "/billing", host),
      });
      return { url: portal.url };
    } catch (e) {
      return { error: getStripeErrorMessage(e) };
    }
  });

export interface InvoiceDTO {
  id: string;
  status: string | null;
  amountPaid: number;
  currency: string;
  created: string | null;
  hostedInvoiceUrl: string | null;
}

/** Invoice history for the billing page. */
export const getMyInvoices = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<{ invoices: InvoiceDTO[] }> => {
    const { environment } = await trustedContext();
    const { data: sub } = await context.supabase
      .from("subscriptions")
      .select("stripe_customer_id")
      .eq("owner_id", context.userId)
      .eq("environment", environment)
      .maybeSingle();
    if (!sub?.stripe_customer_id) return { invoices: [] };

    const { createStripeClient } = await import("./stripe.server");
    try {
      const stripe = createStripeClient(environment);
      const list = await stripe.invoices.list({ customer: sub.stripe_customer_id, limit: 12 });
      return {
        invoices: list.data.map((inv) => ({
          id: inv.id ?? "",
          status: (inv.status as string | null) ?? null,
          amountPaid: inv.amount_paid ?? 0,
          currency: (inv.currency ?? "usd").toUpperCase(),
          created: inv.created ? new Date(inv.created * 1000).toISOString() : null,
          hostedInvoiceUrl: inv.hosted_invoice_url ?? null,
        })),
      };
    } catch {
      return { invoices: [] };
    }
  });
