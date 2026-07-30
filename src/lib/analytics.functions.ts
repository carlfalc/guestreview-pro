// Server surface for product analytics, onboarding progress and abandoned
// checkout recovery. All writes are scoped to the authenticated caller.
import { createServerFn } from "@tanstack/react-start";
import { getRequest } from "@tanstack/react-start/server";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import {
  isProductEvent,
  sanitiseEventProperties,
  sanitisePath,
  type OnboardingProgress,
  type ProductEventName,
} from "./analytics";
import type { StripeEnvName } from "./entitlements.server";

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
 * Record one product milestone. Silently ignores unknown event names so a
 * stale client can never write junk, and never throws into the UI.
 */
export const trackProductEvent = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { name: string; properties?: unknown; path?: string; sessionId?: string }) => ({
    name: String(data?.name ?? ""),
    properties: sanitiseEventProperties(data?.properties),
    path: sanitisePath(data?.path),
    sessionId:
      typeof data?.sessionId === "string" && /^[A-Za-z0-9_-]{1,64}$/.test(data.sessionId)
        ? data.sessionId
        : null,
  }))
  .handler(async ({ data, context }): Promise<{ ok: boolean }> => {
    if (!isProductEvent(data.name)) return { ok: false };
    const { error } = await context.supabase.from("product_events").insert({
      owner_id: context.userId,
      event_name: data.name,
      properties: data.properties,
      path: data.path,
      session_id: data.sessionId,
    });
    if (error) {
      console.error("product_events insert failed:", error.message);
      return { ok: false };
    }
    return { ok: true };
  });

/** Guided-onboarding state, derived entirely from database rows. */
export const getOnboardingProgress = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<OnboardingProgress> => {
    const { data, error } = await context.supabase.rpc("my_onboarding_progress");
    if (error) throw new Error(error.message);
    const p = (data ?? {}) as Partial<OnboardingProgress>;
    return {
      hasBusiness: Boolean(p.hasBusiness),
      hasQrCode: Boolean(p.hasQrCode),
      hasDownload: Boolean(p.hasDownload),
      hasScan: Boolean(p.hasScan),
      hasPack: Boolean(p.hasPack),
      scanCount: Number(p.scanCount ?? 0),
    };
  });

export interface PendingCheckout {
  id: string;
  planKey: "pro" | "business";
  billingInterval: "monthly" | "annual";
  startedAt: string;
}

/**
 * The most recent checkout the account started but never finished, within the
 * last 7 days. Used for the "finish upgrading" card.
 */
export const getPendingCheckout = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<PendingCheckout | null> => {
    const environment = await trustedEnvironment();
    const since = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();

    const { data, error } = await context.supabase
      .from("checkout_attempts")
      .select("id, plan_key, billing_interval, started_at")
      .eq("owner_id", context.userId)
      .eq("environment", environment)
      .eq("status", "started")
      .gte("started_at", since)
      .order("started_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (error || !data) return null;

    return {
      id: data.id as string,
      planKey: data.plan_key as "pro" | "business",
      billingInterval: data.billing_interval as "monthly" | "annual",
      startedAt: data.started_at as string,
    };
  });

/** Owner dismisses the recovery prompt. RLS restricts this to their own row. */
export const dismissPendingCheckout = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { id: string }) => {
    const id = String(data?.id ?? "");
    if (!/^[0-9a-f-]{36}$/i.test(id)) throw new Error("Invalid id");
    return { id };
  })
  .handler(async ({ data, context }): Promise<{ ok: true }> => {
    await context.supabase
      .from("checkout_attempts")
      .update({ status: "dismissed", abandoned_reason: "dismissed_by_user" })
      .eq("id", data.id)
      .eq("owner_id", context.userId);
    return { ok: true };
  });

export interface FunnelStep {
  step: string;
  stepOrder: number;
  accounts: number;
}

/** Admin-only conversion funnel over a rolling window. */
export const adminConversionFunnel = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data?: { days?: number }) => {
    const days = Number(data?.days ?? 30);
    return { days: [7, 30, 90].includes(days) ? days : 30 };
  })
  .handler(async ({ data, context }): Promise<{ days: number; steps: FunnelStep[] }> => {
    const since = new Date(Date.now() - data.days * 24 * 60 * 60 * 1000).toISOString();
    const { data: rows, error } = await context.supabase.rpc("admin_conversion_funnel", {
      _since: since,
    });
    if (error) throw new Error(error.message);
    const steps = ((rows ?? []) as Array<{ step: string; step_order: number; accounts: number }>).map(
      (r) => ({ step: r.step, stepOrder: Number(r.step_order), accounts: Number(r.accounts) }),
    );
    return { days: data.days, steps };
  });

export type { ProductEventName };
