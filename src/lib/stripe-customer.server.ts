// Stripe Customer resolution. Exactly one Stripe Customer per account.
import type Stripe from "stripe";
import type { SupabaseClient } from "@supabase/supabase-js";

export interface CustomerContext {
  stripe: Stripe;
  admin: unknown;
  supabase: SupabaseClient<never, never, never>;
  ownerId: string;
  environment: "sandbox" | "live";
  countryCode: string;
  pricingRegion: string;
}

/**
 * Reuse the stored customer, otherwise search Stripe by owner metadata,
 * otherwise create one. The subscriptions row is upserted on owner_id, so two
 * concurrent calls converge on a single stored id.
 */
export async function getOrCreateStripeCustomer(ctx: CustomerContext): Promise<string> {
  const admin = ctx.admin as SupabaseClient;

  const { data: existing } = await admin
    .from("subscriptions")
    .select("stripe_customer_id")
    .eq("owner_id", ctx.ownerId)
    .eq("environment", ctx.environment)
    .maybeSingle();
  const storedId = (existing as { stripe_customer_id?: string } | null)?.stripe_customer_id;
  if (storedId) return storedId;

  if (!/^[a-zA-Z0-9_-]+$/.test(ctx.ownerId)) throw new Error("Invalid owner id");

  // Email is read server-side from the verified session — never from input.
  const { data: userData } = await ctx.supabase.auth.getUser();
  const email = userData?.user?.email ?? undefined;

  const found = await ctx.stripe.customers.search({
    query: `metadata['owner_id']:'${ctx.ownerId}'`,
    limit: 1,
  });

  const customerId = found.data.length
    ? found.data[0].id
    : (
        await ctx.stripe.customers.create({
          ...(email ? { email } : {}),
          metadata: {
            owner_id: ctx.ownerId,
            userId: ctx.ownerId,
            account_country: ctx.countryCode,
            pricing_region: ctx.pricingRegion,
          },
        })
      ).id;

  await admin.from("subscriptions").upsert(
    {
      owner_id: ctx.ownerId,
      environment: ctx.environment,
      stripe_customer_id: customerId,
      plan_key: "free",
      status: "free",
      pricing_region: ctx.pricingRegion,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "owner_id" },
  );

  // Re-read: a concurrent request may have won the upsert with another id.
  const { data: settled } = await admin
    .from("subscriptions")
    .select("stripe_customer_id")
    .eq("owner_id", ctx.ownerId)
    .maybeSingle();
  return (settled as { stripe_customer_id?: string } | null)?.stripe_customer_id ?? customerId;
}
