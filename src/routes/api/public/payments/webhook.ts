// Stripe subscription webhook. Public by design (Stripe cannot send a session
// token); every request is authenticated by HMAC signature verification.
//
// Environment safety: the `?env=` query parameter selects which signing secret
// verifies the request. A forged value therefore cannot produce a valid
// signature, and `event.livemode` is additionally cross-checked against it.
//
// Retry safety: events are claimed atomically in the database. Only one worker
// can hold an event at a time; a genuinely failed event stays retryable and a
// non-2xx response is returned so Stripe redelivers it.
import { createFileRoute } from "@tanstack/react-router";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { type StripeEnv, verifyWebhook } from "@/lib/stripe.server";
import {
  resolveTrustedPlanForPrice,
  backfillStripePriceId,
  UnknownStripePriceError,
} from "@/lib/plan-price-map.server";

let _admin: SupabaseClient | null = null;
function admin(): SupabaseClient {
  if (!_admin) {
    _admin = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
  }
  return _admin as SupabaseClient;
}

const iso = (unix?: number | null) => (unix ? new Date(unix * 1000).toISOString() : null);

/** Trim provider text so no payload detail or secret can reach the log. */
function safeMessage(e: unknown): string {
  const raw = e instanceof Error ? e.message : String(e);
  return raw.replace(/sk_[A-Za-z0-9_]+|whsec_[A-Za-z0-9_]+/g, "[redacted]").slice(0, 900);
}

/** Thrown when the event is understood but should NOT be retried. */
class PermanentEventError extends Error {}

function intervalFromPrice(price: { recurring?: { interval?: string } | null } | null | undefined) {
  const i = price?.recurring?.interval;
  if (i === "year") return "annual";
  if (i === "month") return "monthly";
  return null;
}

type ClaimOutcome = "claimed" | "processed" | "locked";

async function claimEvent(
  event: { id: string; type: string; livemode?: boolean },
  env: StripeEnv,
): Promise<ClaimOutcome> {
  const { data, error } = await admin().rpc("claim_stripe_webhook_event", {
    p_event_id: event.id,
    p_event_type: event.type,
    p_environment: env,
    p_livemode: env === "live",
  });
  if (error) throw new Error(error.message);
  return (data as ClaimOutcome) ?? "locked";
}

async function finishEvent(eventId: string, status: "processed" | "failed", message?: string) {
  await admin().rpc("finish_stripe_webhook_event", {
    p_event_id: eventId,
    p_status: status,
    p_error: message ?? null,
  });
}

async function ownerIdFor(subscription: any, env: StripeEnv): Promise<string | null> {
  const fromMeta = subscription?.metadata?.owner_id || subscription?.metadata?.userId;
  if (fromMeta) return fromMeta as string;
  const customer =
    typeof subscription?.customer === "string" ? subscription.customer : subscription?.customer?.id;
  if (!customer) return null;
  const { data } = await admin()
    .from("subscriptions")
    .select("owner_id")
    .eq("stripe_customer_id", customer)
    .eq("environment", env)
    .maybeSingle();
  return (data as { owner_id?: string } | null)?.owner_id ?? null;
}

async function upsertSubscription(subscription: any, env: StripeEnv) {
  const ownerId = await ownerIdFor(subscription, env);
  if (!ownerId) {
    // No owner mapping yet — retrying will not help until checkout completes.
    throw new PermanentEventError(
      `Unable to map Stripe subscription ${subscription?.id ?? "unknown"} to an account.`,
    );
  }

  const item = subscription.items?.data?.[0];
  const price = item?.price;
  const periodStart = item?.current_period_start ?? subscription.current_period_start;
  const periodEnd = item?.current_period_end ?? subscription.current_period_end;
  const cancelled = subscription.status === "canceled";

  // Trusted mapping. Unknown price => throw, event is marked failed, and the
  // account keeps its previous entitlement until an administrator fixes it.
  let planKey: "free" | "pro" | "business" = "free";
  let trustedRegion: string | null = null;
  if (!cancelled) {
    const trusted = await resolveTrustedPlanForPrice(admin(), price, env);
    planKey = trusted.planKey;
    trustedRegion = trusted.pricingRegion;
    if (price?.id && !trusted.stripePriceId) {
      await backfillStripePriceId(admin(), trusted.stripeLookupKey, env, price.id);
    }
  }

  await admin()
    .from("subscriptions")
    .upsert(
      {
        owner_id: ownerId,
        environment: env,
        stripe_customer_id:
          typeof subscription.customer === "string" ? subscription.customer : subscription.customer?.id,
        stripe_subscription_id: subscription.id,
        stripe_price_id: price?.lookup_key ?? price?.id ?? null,
        plan_key: planKey,
        status: subscription.status,
        billing_interval: intervalFromPrice(price),
        currency_code: (price?.currency ?? "").toUpperCase() || null,
        amount_minor: price?.unit_amount ?? null,
        pricing_region: subscription.metadata?.pricing_region ?? trustedRegion,
        current_period_start: iso(periodStart),
        current_period_end: iso(periodEnd),
        cancel_at_period_end: Boolean(subscription.cancel_at_period_end),
        canceled_at: iso(subscription.canceled_at),
        updated_at: new Date().toISOString(),
      },
      { onConflict: "owner_id" },
    );

  if (planKey !== "free" && ["active", "trialing"].includes(subscription.status)) {
    const { onSubscriptionActivated } = await import("@/lib/upgrade-notifications.server");
    await onSubscriptionActivated(admin(), ownerId, planKey);
  }
}

/** Update payment health without ever touching plan entitlement. */
async function markPayment(
  invoice: any,
  env: StripeEnv,
  status: "paid" | "failed" | "action_required" | "finalization_failed",
) {
  const customer = typeof invoice.customer === "string" ? invoice.customer : invoice.customer?.id;
  if (!customer) return;
  await admin()
    .from("subscriptions")
    .update({
      last_payment_status: status,
      last_invoice_id: typeof invoice.id === "string" ? invoice.id : null,
      updated_at: new Date().toISOString(),
    })
    .eq("stripe_customer_id", customer)
    .eq("environment", env);
}

async function setSubscriptionStatus(subscription: any, env: StripeEnv, status: string) {
  const id = subscription?.id;
  if (!id) return;
  await admin()
    .from("subscriptions")
    .update({ status, updated_at: new Date().toISOString() })
    .eq("stripe_subscription_id", id)
    .eq("environment", env);
}

async function dispatch(event: { type: string; data: { object: any } }, env: StripeEnv) {
  switch (event.type) {
    case "customer.subscription.created":
    case "customer.subscription.updated":
    case "customer.subscription.deleted":
      await upsertSubscription(event.data.object, env);
      break;

    case "customer.subscription.paused":
      await setSubscriptionStatus(event.data.object, env, "paused");
      break;
    case "customer.subscription.resumed":
      await upsertSubscription(event.data.object, env);
      break;

    case "invoice.paid":
    case "invoice.payment_succeeded":
      await markPayment(event.data.object, env, "paid");
      break;
    case "invoice.payment_failed":
      await markPayment(event.data.object, env, "failed");
      break;
    case "invoice.payment_action_required":
      await markPayment(event.data.object, env, "action_required");
      break;
    case "invoice.finalization_failed":
      // Never grants access; recorded so an administrator can see it.
      await markPayment(event.data.object, env, "finalization_failed");
      throw new PermanentEventError(
        `Invoice finalization failed for customer ${
          typeof event.data.object.customer === "string" ? event.data.object.customer : "unknown"
        }.`,
      );

    case "checkout.session.completed": {
      const session = event.data.object;
      if (session.subscription) {
        const { createStripeClient } = await import("@/lib/stripe.server");
        const stripe = createStripeClient(env);
        const sub = await stripe.subscriptions.retrieve(
          typeof session.subscription === "string" ? session.subscription : session.subscription.id,
        );
        await upsertSubscription(
          {
            ...(sub as unknown as Record<string, unknown>),
            metadata: { ...(sub as any).metadata, ...session.metadata },
          },
          env,
        );
      }
      break;
    }

    default:
      console.log("Unhandled Stripe event:", event.type);
  }
}

/** Returns the HTTP status Stripe should see. */
async function handle(request: Request, env: StripeEnv): Promise<number> {
  const event = await verifyWebhook(request, env);

  // A live event must never be processed as sandbox, or vice versa.
  if (typeof event.livemode === "boolean" && event.livemode !== (env === "live")) {
    console.error("Stripe webhook: livemode/environment mismatch", event.id);
    return 400;
  }

  const claim = await claimEvent(event, env);
  if (claim === "processed") return 200; // duplicate delivery: no-op
  if (claim === "locked") return 409; // another worker holds it — Stripe retries

  try {
    await dispatch(event as { type: string; data: { object: any } }, env);
    await finishEvent(event.id, "processed");
    return 200;
  } catch (e) {
    const message = safeMessage(e);
    await finishEvent(event.id, "failed", message);
    if (e instanceof UnknownStripePriceError) {
      console.error("Stripe webhook BILLING CONFIG ERROR:", message);
      return 500; // retryable once an administrator adds the price mapping
    }
    if (e instanceof PermanentEventError) {
      console.error("Stripe webhook permanent failure:", message);
      return 200; // do not ask Stripe to retry something that cannot succeed
    }
    console.error("Stripe webhook error:", message);
    return 500;
  }
}

export const Route = createFileRoute("/api/public/payments/webhook")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const raw = new URL(request.url).searchParams.get("env");
        if (raw !== "sandbox" && raw !== "live") {
          console.error("Stripe webhook: invalid env parameter");
          return Response.json({ received: true, ignored: "invalid env" });
        }
        let status: number;
        try {
          status = await handle(request, raw);
        } catch (e) {
          // Signature failures and unreadable bodies land here.
          console.error("Stripe webhook rejected:", safeMessage(e));
          return new Response("Webhook error", { status: 400 });
        }
        if (status === 200) return Response.json({ received: true });
        return new Response("Webhook processing failed", { status });
      },
    },
  },
});
