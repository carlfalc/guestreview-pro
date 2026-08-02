// Shared server-only plan resolution for the email subsystem.
import { getRequest } from "@tanstack/react-start/server";
import type { PlanTierKey } from "./entitlements";

/** Resolve the effective plan for an account (server-authoritative). */
export async function accountPlanFor(userId: string): Promise<PlanTierKey> {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { resolvePaymentsEnvironment, requestHost } = await import("./payments-env.server");
  let host: string | null = null;
  try {
    host = requestHost(getRequest());
  } catch {
    host = null;
  }
  const { getAccountPlan } = await import("./entitlements.server");
  return getAccountPlan(supabaseAdmin as never, userId, resolvePaymentsEnvironment(host));
}

/** Same resolution without a request context (used by cron / worker code). */
export async function accountPlanForBackground(
  userId: string,
  host: string | null = null,
): Promise<PlanTierKey> {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { resolvePaymentsEnvironment } = await import("./payments-env.server");
  const { getAccountPlan } = await import("./entitlements.server");
  return getAccountPlan(supabaseAdmin as never, userId, resolvePaymentsEnvironment(host));
}
