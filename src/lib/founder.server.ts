// Founding Member Beta — server-authoritative slot handling.
//
// Every count, allocation and release goes through SECURITY DEFINER database
// functions that take an advisory lock, so two customers racing for the last
// place can never both win. Nothing here trusts client input.

import type { SupabaseClient } from "@supabase/supabase-js";
import type { PaidInterval } from "./regional-pricing";
import type { FounderSlotStatus } from "./founder";

export interface FounderSlotRow {
  id: string;
  ownerId: string;
  slotNumber: number;
  status: FounderSlotStatus;
  billingInterval: PaidInterval;
  pricingRegion: string;
  founderPriceId: string | null;
  stripeCustomerId: string | null;
  stripeSubscriptionId: string | null;
  activatedAt: string | null;
  releasedAt: string | null;
  releaseReason: string | null;
  createdAt: string | null;
}

/* eslint-disable @typescript-eslint/no-explicit-any -- admin client is untyped here */
type Admin = SupabaseClient<any, any, any>;

function mapSlot(row: Record<string, unknown>): FounderSlotRow {
  return {
    id: row.id as string,
    ownerId: row.owner_id as string,
    slotNumber: row.slot_number as number,
    status: row.status as FounderSlotStatus,
    billingInterval: row.billing_interval as PaidInterval,
    pricingRegion: row.pricing_region as string,
    founderPriceId: (row.founder_price_id as string | null) ?? null,
    stripeCustomerId: (row.stripe_customer_id as string | null) ?? null,
    stripeSubscriptionId: (row.stripe_subscription_id as string | null) ?? null,
    activatedAt: (row.activated_at as string | null) ?? null,
    releasedAt: (row.released_at as string | null) ?? null,
    releaseReason: (row.release_reason as string | null) ?? null,
    createdAt: (row.created_at as string | null) ?? null,
  };
}

/** Authoritative number of founder places still available. */
export async function founderSlotsRemaining(admin: Admin): Promise<number> {
  const { data, error } = await admin.rpc("founder_slots_remaining");
  if (error) throw new Error(error.message);
  return typeof data === "number" ? data : 0;
}

export async function getFounderSlot(
  admin: Admin,
  ownerId: string,
): Promise<FounderSlotRow | null> {
  const { data, error } = await admin
    .from("founding_member_slots")
    .select("*")
    .eq("owner_id", ownerId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  return data ? mapSlot(data as Record<string, unknown>) : null;
}

export async function getFounderSlotBySubscription(
  admin: Admin,
  stripeSubscriptionId: string,
): Promise<FounderSlotRow | null> {
  const { data, error } = await admin
    .from("founding_member_slots")
    .select("*")
    .eq("stripe_subscription_id", stripeSubscriptionId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  return data ? mapSlot(data as Record<string, unknown>) : null;
}

export async function getFounderSlotByCustomer(
  admin: Admin,
  stripeCustomerId: string,
): Promise<FounderSlotRow | null> {
  const { data, error } = await admin
    .from("founding_member_slots")
    .select("*")
    .eq("stripe_customer_id", stripeCustomerId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  return data ? mapSlot(data as Record<string, unknown>) : null;
}

/**
 * Can this account still buy the founder offer?
 * False when the programme is full, or when the account has ever held a slot
 * (one founder offer per owner — a returning customer pays standard pricing).
 */
export async function founderOfferEligible(
  admin: Admin,
  ownerId: string,
): Promise<{ eligible: boolean; remaining: number; reason?: string }> {
  const remaining = await founderSlotsRemaining(admin);
  const existing = await getFounderSlot(admin, ownerId);
  if (existing) {
    if (existing.status === "active" || existing.status === "pending") {
      return { eligible: false, remaining, reason: "already_founder" };
    }
    return { eligible: false, remaining, reason: "slot_released" };
  }
  if (remaining <= 0) return { eligible: false, remaining, reason: "sold_out" };
  return { eligible: true, remaining };
}

export interface AllocateInput {
  ownerId: string;
  pricingRegion: string;
  billingInterval: PaidInterval;
  founderPriceId?: string | null;
  stripeCustomerId?: string | null;
  stripeSubscriptionId?: string | null;
  environment: "sandbox" | "live";
  stripeEventId?: string | null;
}

/**
 * Allocate (or confirm) a founder place after a payment succeeded.
 * Returns the slot number, or null when the programme is full or the account
 * has already used its one founder offer.
 */
export async function allocateFounderSlot(
  admin: Admin,
  input: AllocateInput,
): Promise<number | null> {
  const { data, error } = await admin.rpc("allocate_founder_slot", {
    p_owner_id: input.ownerId,
    p_pricing_region: input.pricingRegion,
    p_billing_interval: input.billingInterval,
    p_founder_price_id: input.founderPriceId ?? null,
    p_stripe_customer_id: input.stripeCustomerId ?? null,
    p_stripe_subscription_id: input.stripeSubscriptionId ?? null,
    p_environment: input.environment,
    p_stripe_event_id: input.stripeEventId ?? null,
  });
  if (error) throw new Error(error.message);
  return typeof data === "number" ? data : null;
}

/** Release a held place. Returns true when a place was actually freed. */
export async function releaseFounderSlot(
  admin: Admin,
  input: {
    ownerId: string;
    status: "released" | "refunded" | "canceled";
    reason?: string | null;
    source?: string;
    actorId?: string | null;
    stripeEventId?: string | null;
  },
): Promise<boolean> {
  const { data, error } = await admin.rpc("release_founder_slot", {
    p_owner_id: input.ownerId,
    p_status: input.status,
    p_reason: input.reason ?? null,
    p_source: input.source ?? "system",
    p_actor_id: input.actorId ?? null,
    p_stripe_event_id: input.stripeEventId ?? null,
  });
  if (error) throw new Error(error.message);
  return data === true;
}

export async function restoreFounderSlot(
  admin: Admin,
  ownerId: string,
  reason?: string | null,
  actorId?: string | null,
): Promise<number | null> {
  const { data, error } = await admin.rpc("restore_founder_slot", {
    p_owner_id: ownerId,
    p_reason: reason ?? null,
    p_actor_id: actorId ?? null,
  });
  if (error) throw new Error(error.message);
  return typeof data === "number" ? data : null;
}
