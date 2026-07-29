// Client-callable billing surface. Only tier + interval come from the browser:
// currency, amount, pricing region and the Stripe price ID are all derived
// server-side from the locked account_regions row.
import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import type { PlanTier, PaidInterval } from "./regional-pricing";
import type { PlanTierKey, PlanEntitlements, UsageCounts } from "./entitlements";
import type { AccountSubscription, StripeEnvName } from "./entitlements.server";

const TIERS: PlanTier[] = ["pro", "business"];
const INTERVALS: PaidInterval[] = ["monthly", "annual"];

function validEnv(env: unknown): StripeEnvName {
  if (env !== "sandbox" && env !== "live") throw new Error("Invalid payment environment.");
  return env;
}

export interface AccountBillingState {
  plan: PlanTierKey;
  entitlements: PlanEntitlements;
  usage: UsageCounts;
  subscription: AccountSubscription | null;
}

/** Authoritative plan + entitlements + usage for the signed-in account. */
export const getMyBillingState = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { environment: StripeEnvName }) => ({ environment: validEnv(data?.environment) }))
  .handler(async ({ data, context }): Promise<AccountBillingState> => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { getAccountEntitlements } = await import("./entitlements.server");
    const state = await getAccountEntitlements(
      supabaseAdmin as never,
      context.userId,
      data.environment,
    );
    return {
      plan: state.plan,
      entitlements: state.entitlements,
      usage: state.usage,
      subscription: state.subscription,
    };
  });

export interface CheckoutResult {
  clientSecret?: string;
  /** Set when the account already pays — the UI sends them to the portal. */
  alreadySubscribed?: boolean;
  error?: string;
}

export const createSubscriptionCheckout = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: {
    tier: PlanTier;
    interval: PaidInterval;
    returnUrl: string;
    environment: StripeEnvName;
  }) => {
    if (!TIERS.includes(data?.tier)) throw new Error("Unknown plan.");
    if (!INTERVALS.includes(data?.interval)) throw new Error("Unknown billing interval.");
    if (typeof data.returnUrl !== "string" || !/^https?:\/\//.test(data.returnUrl)) {
      throw new Error("Invalid return URL.");
    }
    return {
      tier: data.tier,
      interval: data.interval,
      returnUrl: data.returnUrl,
      environment: validEnv(data.environment),
    };
  })
  .handler(async ({ data, context }): Promise<CheckoutResult> => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { createStripeClient, getStripeErrorMessage, automaticTaxEnabled } = await import("./stripe.server");
    const { resolveBillablePlan } = await import("./regional-pricing");
    const { loadSubscription } = await import("./entitlements.server");
    const { effectivePlan } = await import("./entitlements");
    const { getOrCreateStripeCustomer } = await import("./stripe-customer.server");

    const admin = supabaseAdmin as never;

    // 1. Locked pricing region — never a client-supplied country/currency.
    const { data: region, error: regionError } = await supabaseAdmin
      .from("account_regions")
      .select("pricing_region, country_code")
      .eq("owner_id", context.userId)
      .maybeSingle();
    if (regionError) return { error: regionError.message };
    if (!region) return { error: "Your billing region has not been resolved yet. Reload and try again." };

    // 2. Refuse a second active subscription.
    const existing = await loadSubscription(admin, context.userId, data.environment);
    if (existing && effectivePlan(existing) !== "free" && existing.status !== "canceled") {
      return { alreadySubscribed: true };
    }

    const plan = resolveBillablePlan(
      region.pricing_region as never,
      data.tier,
      data.interval,
    );

    try {
      const stripe = createStripeClient(data.environment);

      const prices = await stripe.prices.list({ lookup_keys: [plan.stripeLookupKey], limit: 1 });
      if (!prices.data.length) {
        return { error: `No price is configured for ${plan.stripeLookupKey}.` };
      }
      const stripePrice = prices.data[0];

      const customerId = await getOrCreateStripeCustomer({
        stripe,
        admin,
        supabase: context.supabase,
        ownerId: context.userId,
        environment: data.environment,
        countryCode: region.country_code as string,
        pricingRegion: region.pricing_region as string,
      });

      const session = await stripe.checkout.sessions.create({
        mode: "subscription",
        ui_mode: "embedded_page",
        return_url: data.returnUrl,
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
        },
        subscription_data: {
          metadata: {
            userId: context.userId,
            owner_id: context.userId,
            plan_key: plan.tier,
            billing_interval: plan.interval,
            pricing_region: plan.billingRegion,
          },
        },
      });

      return { clientSecret: session.client_secret ?? "" };
    } catch (error) {
      return { error: getStripeErrorMessage(error) };
    }
  });

export const createCustomerPortalSession = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { returnUrl: string; environment: StripeEnvName }) => {
    if (typeof data?.returnUrl !== "string" || !/^https?:\/\//.test(data.returnUrl)) {
      throw new Error("Invalid return URL.");
    }
    return { returnUrl: data.returnUrl, environment: validEnv(data.environment) };
  })
  .handler(async ({ data, context }): Promise<{ url?: string; error?: string }> => {
    // RLS-scoped read: a caller can only ever reach their own customer id.
    const { data: sub, error } = await context.supabase
      .from("subscriptions")
      .select("stripe_customer_id")
      .eq("owner_id", context.userId)
      .eq("environment", data.environment)
      .maybeSingle();
    if (error) return { error: error.message };
    if (!sub?.stripe_customer_id) return { error: "No billing account found for this user." };

    const { createStripeClient, getStripeErrorMessage } = await import("./stripe.server");
    try {
      const stripe = createStripeClient(data.environment);
      const portal = await stripe.billingPortal.sessions.create({
        customer: sub.stripe_customer_id,
        return_url: data.returnUrl,
      });
      return { url: portal.url };
    } catch (e) {
      return { error: getStripeErrorMessage(e) };
    }
  });

/** Invoice history for the billing page. */
export const getMyInvoices = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { environment: StripeEnvName }) => ({ environment: validEnv(data?.environment) }))
  .handler(async ({ data, context }) => {
    const { data: sub } = await context.supabase
      .from("subscriptions")
      .select("stripe_customer_id")
      .eq("owner_id", context.userId)
      .eq("environment", data.environment)
      .maybeSingle();
    if (!sub?.stripe_customer_id) return { invoices: [] as Array<Record<string, unknown>> };

    const { createStripeClient } = await import("./stripe.server");
    try {
      const stripe = createStripeClient(data.environment);
      const list = await stripe.invoices.list({ customer: sub.stripe_customer_id, limit: 12 });
      return {
        invoices: list.data.map((inv) => ({
          id: inv.id ?? "",
          status: inv.status ?? null,
          amountPaid: inv.amount_paid ?? 0,
          currency: (inv.currency ?? "usd").toUpperCase(),
          created: inv.created ? new Date(inv.created * 1000).toISOString() : null,
          hostedInvoiceUrl: inv.hosted_invoice_url ?? null,
        })),
      };
    } catch {
      return { invoices: [] as Array<Record<string, unknown>> };
    }
  });
