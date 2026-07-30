// Stripe subscription webhook. Public by design (Stripe cannot send a session
// token); every request is authenticated by HMAC signature verification.
import { createFileRoute } from "@tanstack/react-router";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { type StripeEnv, verifyWebhook } from "@/lib/stripe.server";

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

function planKeyFromPrice(price: any): "pro" | "business" | "free" {
  const key: string =
    price?.lookup_key || price?.metadata?.lovable_external_id || price?.id || "";
  if (key.startsWith("business")) return "business";
  if (key.startsWith("pro")) return "pro";
  return "free";
}

function intervalFromPrice(price: any): "monthly" | "annual" | null {
  const i = price?.recurring?.interval;
  if (i === "year") return "annual";
  if (i === "month") return "monthly";
  return null;
}

/** Records the event id first; a duplicate delivery is a no-op. */
async function claimEvent(event: { id: string; type: string }, env: StripeEnv) {
  const { error } = await admin()
    .from("stripe_webhook_events")
    .insert({
      stripe_event_id: event.id,
      event_type: event.type,
      livemode: env === "live",
    });
  if (error) {
    // Unique violation = already processed.
    if ((error as { code?: string }).code === "23505") return false;
    throw new Error(error.message);
  }
  return true;
}

async function finishEvent(eventId: string, status: "processed" | "failed", message?: string) {
  await admin()
    .from("stripe_webhook_events")
    .update({
      processing_status: status,
      error_message: message ?? null,
      processed_at: new Date().toISOString(),
    })
    .eq("stripe_event_id", eventId);
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
    console.error("Stripe webhook: unable to map subscription to an owner", subscription?.id);
    return;
  }
  const item = subscription.items?.data?.[0];
  const price = item?.price;
  const periodStart = item?.current_period_start ?? subscription.current_period_start;
  const periodEnd = item?.current_period_end ?? subscription.current_period_end;
  const cancelled = subscription.status === "canceled";

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
        plan_key: cancelled ? "free" : planKeyFromPrice(price),
        status: subscription.status,
        billing_interval: intervalFromPrice(price),
        currency_code: (price?.currency ?? "").toUpperCase() || null,
        amount_minor: price?.unit_amount ?? null,
        pricing_region: subscription.metadata?.pricing_region ?? null,
        current_period_start: iso(periodStart),
        current_period_end: iso(periodEnd),
        cancel_at_period_end: Boolean(subscription.cancel_at_period_end),
        canceled_at: iso(subscription.canceled_at),
        updated_at: new Date().toISOString(),
      },
      { onConflict: "owner_id" },
    );
}

async function markPayment(invoice: any, env: StripeEnv, status: "paid" | "failed") {
  const customer = typeof invoice.customer === "string" ? invoice.customer : invoice.customer?.id;
  if (!customer) return;
  await admin()
    .from("subscriptions")
    .update({ last_payment_status: status, updated_at: new Date().toISOString() })
    .eq("stripe_customer_id", customer)
    .eq("environment", env);
}

async function handle(request: Request, env: StripeEnv) {
  const event = await verifyWebhook(request, env);
  const fresh = await claimEvent(event as { id: string; type: string }, env);
  if (!fresh) return;

  switch (event.type) {
    case "customer.subscription.created":
    case "customer.subscription.updated":
    case "customer.subscription.deleted":
      await upsertSubscription(event.data.object, env);
      break;
    case "invoice.payment_succeeded":
    case "invoice.paid":
      await markPayment(event.data.object, env, "paid");
      break;
    case "invoice.payment_failed":
      await markPayment(event.data.object, env, "failed");
      break;
    case "checkout.session.completed": {
      const session = event.data.object as any;
      if (session.subscription) {
        const { createStripeClient } = await import("@/lib/stripe.server");
        const stripe = createStripeClient(env);
        const sub = await stripe.subscriptions.retrieve(
          typeof session.subscription === "string" ? session.subscription : session.subscription.id,
        );
        await upsertSubscription(
          { ...(sub as unknown as Record<string, unknown>), metadata: { ...(sub as any).metadata, ...session.metadata } },
          env,
        );
      }
      break;
    }
    default:
      console.log("Unhandled Stripe event:", event.type);
  }
}

export const Route = createFileRoute("/api/public/payments/webhook")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const raw = new URL(request.url).searchParams.get("env");
        if (raw !== "sandbox" && raw !== "live") {
          console.error("Stripe webhook: invalid env parameter", raw);
          return Response.json({ received: true, ignored: "invalid env" });
        }
        try {
          await handle(request, raw);
          return Response.json({ received: true });
        } catch (e) {
          console.error("Stripe webhook error:", e);
          return new Response("Webhook error", { status: 400 });
        }
      },
    },
  },
});
