// Admin-only visibility into Stripe webhook processing.
//
// Every function re-verifies the admin role through the caller's own RLS
// client before touching the service-role client.
import { createServerFn } from "@tanstack/react-start";
import { getRequest } from "@tanstack/react-start/server";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import type { StripeEnvName } from "./entitlements.server";
import type { LooseClient } from "@/lib/loose-types";

export interface WebhookEventRow {
  id: string;
  stripe_event_id: string;
  event_type: string;
  environment: string | null;
  livemode: boolean;
  processing_status: string;
  retry_count: number | null;
  error_message: string | null;
  received_at: string;
  last_attempt_at: string | null;
  processed_at: string | null;
}

export interface WebhookHealth {
  environment: StripeEnvName;
  failed: number;
  stuck: number;
  processedLast24h: number;
  events: WebhookEventRow[];
}

async function assertAdmin(context: {
  supabase: { rpc: (n: string, a: unknown) => Promise<{ data: unknown }> };
  userId: string;
}) {
  const { data } = await context.supabase.rpc("has_role", {
    _user_id: context.userId,
    _role: "admin",
  });
  if (!data) throw new Error("Forbidden");
}

async function trustedEnvironment(): Promise<StripeEnvName> {
  const { resolvePaymentsEnvironment, requestHost } = await import("./payments-env.server");
  let host: string | null = null;
  try {
    host = requestHost(getRequest());
  } catch {
    host = null;
  }
  return resolvePaymentsEnvironment(host);
}

/**
 * Failed and stuck webhook deliveries for the current payment environment,
 * newest first. Read-only.
 */
export const adminListFailedWebhookEvents = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<WebhookHealth> => {
    await assertAdmin(context as never);
    const environment = await trustedEnvironment();
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const staleBefore = new Date(Date.now() - 10 * 60 * 1000).toISOString();
    const since24h = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();

    const { data, error } = await (supabaseAdmin as never as LooseClient)
      .from("stripe_webhook_events")
      .select(
        "id, stripe_event_id, event_type, environment, livemode, processing_status, retry_count, error_message, received_at, last_attempt_at, processed_at",
      )
      .eq("environment", environment)
      .in("processing_status", ["failed", "processing", "received"])
      .order("received_at", { ascending: false })
      .limit(100);
    if (error) throw new Error(error.message);

    const rows = (data ?? []) as WebhookEventRow[];
    const failed = rows.filter((r) => r.processing_status === "failed").length;
    const stuck = rows.filter(
      (r) => r.processing_status !== "failed" && (r.last_attempt_at ?? r.received_at) < staleBefore,
    ).length;

    const { count } = await (supabaseAdmin as never as LooseClient)
      .from("stripe_webhook_events")
      .select("id", { count: "exact", head: true })
      .eq("environment", environment)
      .eq("processing_status", "processed")
      .gte("processed_at", since24h);

    return {
      environment,
      failed,
      stuck,
      processedLast24h: count ?? 0,
      events: rows,
    };
  });

/**
 * Re-queue one failed event so the next Stripe retry (or a manual resend from
 * the Stripe dashboard) is processed again. Does not replay the payload
 * itself — Stripe remains the source of truth.
 */
export const adminRequeueWebhookEvent = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { stripeEventId: string }) => {
    const id = (data?.stripeEventId ?? "").trim();
    if (!id || id.length > 120 || !/^[A-Za-z0-9_]+$/.test(id)) {
      throw new Error("Invalid event id");
    }
    return { stripeEventId: id };
  })
  .handler(async ({ data, context }): Promise<{ ok: true }> => {
    await assertAdmin(context as never);
    const environment = await trustedEnvironment();
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { error } = await (supabaseAdmin as never as LooseClient)
      .from("stripe_webhook_events")
      .update({ processing_status: "received", error_message: null })
      .eq("stripe_event_id", data.stripeEventId)
      .eq("environment", environment);
    if (error) throw new Error(error.message);
    return { ok: true };
  });
