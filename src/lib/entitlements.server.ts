// Server-only account/plan/entitlement resolution. Never imported by the client.
import type { SupabaseClient } from "@supabase/supabase-js";
import {
  effectivePlan,
  entitlementsFor,
  canCreateBusinessWith,
  canCreateQrCodeWith,
  type PlanTierKey,
  type PlanEntitlements,
  type UsageCounts,
} from "./entitlements";

export type StripeEnvName = "sandbox" | "live";

export interface AccountSubscription {
  planKey: PlanTierKey;
  status: string;
  billingInterval: "monthly" | "annual" | null;
  currencyCode: string | null;
  amountMinor: number | null;
  pricingRegion: string | null;
  currentPeriodEnd: string | null;
  currentPeriodStart: string | null;
  cancelAtPeriodEnd: boolean;
  canceledAt: string | null;
  lastPaymentStatus: string | null;
  stripeCustomerId: string | null;
  stripeSubscriptionId: string | null;
  environment: StripeEnvName;
}

type AdminClient = SupabaseClient<never, never, never>;

/** Load the raw subscription row for an owner (service-role client). */
export async function loadSubscription(
  admin: AdminClient,
  ownerId: string,
  environment: StripeEnvName,
): Promise<AccountSubscription | null> {
  const { data, error } = await (admin as unknown as SupabaseClient)
    .from("subscriptions")
    .select("*")
    .eq("owner_id", ownerId)
    .eq("environment", environment)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) return null;
  const row = data as Record<string, unknown>;
  return {
    planKey: (row.plan_key as PlanTierKey) ?? "free",
    status: (row.status as string) ?? "free",
    billingInterval: (row.billing_interval as "monthly" | "annual" | null) ?? null,
    currencyCode: (row.currency_code as string | null) ?? null,
    amountMinor: (row.amount_minor as number | null) ?? null,
    pricingRegion: (row.pricing_region as string | null) ?? null,
    currentPeriodEnd: (row.current_period_end as string | null) ?? null,
    currentPeriodStart: (row.current_period_start as string | null) ?? null,
    cancelAtPeriodEnd: Boolean(row.cancel_at_period_end),
    canceledAt: (row.canceled_at as string | null) ?? null,
    lastPaymentStatus: (row.last_payment_status as string | null) ?? null,
    stripeCustomerId: (row.stripe_customer_id as string | null) ?? null,
    stripeSubscriptionId: (row.stripe_subscription_id as string | null) ?? null,
    environment,
  };
}

/** Authoritative plan for an account — database state only. */
export async function getAccountPlan(
  admin: AdminClient,
  ownerId: string,
  environment: StripeEnvName,
): Promise<PlanTierKey> {
  const sub = await loadSubscription(admin, ownerId, environment);
  return effectivePlan(sub);
}

export async function getAccountUsage(
  admin: AdminClient,
  ownerId: string,
): Promise<UsageCounts> {
  const client = admin as unknown as SupabaseClient;
  const [biz, qr] = await Promise.all([
    client.from("businesses").select("id", { count: "exact", head: true })
      .eq("owner_id", ownerId).eq("status", "active"),
    client.from("qr_codes").select("id", { count: "exact", head: true })
      .eq("owner_id", ownerId).eq("status", "active"),
  ]);
  return { businesses: biz.count ?? 0, activeQrCodes: qr.count ?? 0 };
}

export interface AccountEntitlementState {
  plan: PlanTierKey;
  entitlements: PlanEntitlements;
  usage: UsageCounts;
  subscription: AccountSubscription | null;
  canCreateBusiness: boolean;
  canCreateQrCode: boolean;
}

export async function getAccountEntitlements(
  admin: AdminClient,
  ownerId: string,
  environment: StripeEnvName,
): Promise<AccountEntitlementState> {
  const [subscription, usage] = await Promise.all([
    loadSubscription(admin, ownerId, environment),
    getAccountUsage(admin, ownerId),
  ]);
  const plan = effectivePlan(subscription);
  return {
    plan,
    entitlements: entitlementsFor(plan),
    usage,
    subscription,
    canCreateBusiness: canCreateBusinessWith(plan, usage),
    canCreateQrCode: canCreateQrCodeWith(plan, usage),
  };
}

export async function canCreateBusiness(admin: AdminClient, ownerId: string, env: StripeEnvName) {
  return (await getAccountEntitlements(admin, ownerId, env)).canCreateBusiness;
}
export async function canCreateQrCode(admin: AdminClient, ownerId: string, env: StripeEnvName) {
  return (await getAccountEntitlements(admin, ownerId, env)).canCreateQrCode;
}
export async function canUseAdvancedAnalytics(admin: AdminClient, ownerId: string, env: StripeEnvName) {
  return entitlementsFor(await getAccountPlan(admin, ownerId, env)).advancedAnalytics;
}
export async function canUseCampaigns(admin: AdminClient, ownerId: string, env: StripeEnvName) {
  return entitlementsFor(await getAccountPlan(admin, ownerId, env)).campaigns;
}
export async function canUseAiCopy(admin: AdminClient, ownerId: string, env: StripeEnvName) {
  return entitlementsFor(await getAccountPlan(admin, ownerId, env)).aiCopy !== "none";
}
export async function canRemoveBranding(admin: AdminClient, ownerId: string, env: StripeEnvName) {
  return entitlementsFor(await getAccountPlan(admin, ownerId, env)).removeBranding;
}
