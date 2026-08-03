// Founding Member Beta — admin-only monitoring and manual slot management.
//
// Every function re-verifies the admin role through the caller's own RLS
// client before touching the service-role client.
import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import type { FounderSlotStatus } from "./founder";

export interface FounderStats {
  totalSlots: number;
  active: number;
  pending: number;
  released: number;
  refunded: number;
  canceled: number;
  remaining: number;
  monthly: number;
  annual: number;
  revenue: Array<{ currency: string; amount_minor: number; accounts: number }>;
  feedbackCount: number;
}

export interface FounderSlotAdminRow {
  id: string;
  ownerId: string;
  slotNumber: number;
  status: FounderSlotStatus;
  billingInterval: string;
  pricingRegion: string;
  environment: string;
  activatedAt: string | null;
  releasedAt: string | null;
  releaseReason: string | null;
  createdAt: string;
}

export interface FounderSlotEventRow {
  id: string;
  slotNumber: number;
  previousStatus: string | null;
  newStatus: string;
  reason: string | null;
  source: string;
  createdAt: string;
}

async function assertAdmin(context: {
  supabase: { rpc: (n: string, a: unknown) => Promise<{ data: unknown }> };
  userId: string;
}) {
  const { data } = await context.supabase.rpc("has_role", {
    _user_id: context.userId,
    _role: "admin",
  });
  if (data !== true) throw new Error("Forbidden");
}

export const adminFounderStats = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<FounderStats> => {
    await assertAdmin(context as never);
    const { data, error } = await context.supabase.rpc("admin_founder_stats");
    if (error) throw new Error(error.message);
    return data as unknown as FounderStats;
  });

export const adminListFounderSlots = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<FounderSlotAdminRow[]> => {
    await assertAdmin(context as never);
    const { data, error } = await context.supabase
      .from("founding_member_slots")
      .select("*")
      .order("slot_number", { ascending: true })
      .limit(300);
    if (error) throw new Error(error.message);
    return (data ?? []).map((row: Record<string, unknown>) => ({
      id: row.id as string,
      ownerId: row.owner_id as string,
      slotNumber: row.slot_number as number,
      status: row.status as FounderSlotStatus,
      billingInterval: row.billing_interval as string,
      pricingRegion: row.pricing_region as string,
      environment: row.environment as string,
      activatedAt: (row.activated_at as string | null) ?? null,
      releasedAt: (row.released_at as string | null) ?? null,
      releaseReason: (row.release_reason as string | null) ?? null,
      createdAt: row.created_at as string,
    }));
  });

export const adminFounderHistory = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { slotId: string }) => {
    if (typeof data?.slotId !== "string" || !data.slotId) throw new Error("Missing slot.");
    return { slotId: data.slotId };
  })
  .handler(async ({ data, context }): Promise<FounderSlotEventRow[]> => {
    await assertAdmin(context as never);
    const { data: rows, error } = await context.supabase
      .from("founder_slot_events")
      .select("*")
      .eq("slot_id", data.slotId)
      .order("created_at", { ascending: false })
      .limit(100);
    if (error) throw new Error(error.message);
    return (rows ?? []).map((row: Record<string, unknown>) => ({
      id: row.id as string,
      slotNumber: row.slot_number as number,
      previousStatus: (row.previous_status as string | null) ?? null,
      newStatus: row.new_status as string,
      reason: (row.reason as string | null) ?? null,
      source: row.source as string,
      createdAt: row.created_at as string,
    }));
  });

/** Manually free a place (support / abuse handling). Always audited. */
export const adminReleaseFounderSlot = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { ownerId: string; reason?: string }) => {
    if (typeof data?.ownerId !== "string" || !data.ownerId) throw new Error("Missing account.");
    return {
      ownerId: data.ownerId,
      reason: typeof data?.reason === "string" ? data.reason.slice(0, 300) : undefined,
    };
  })
  .handler(async ({ data, context }): Promise<{ released: boolean }> => {
    await assertAdmin(context as never);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { releaseFounderSlot } = await import("./founder.server");
    const released = await releaseFounderSlot(supabaseAdmin as never, {
      ownerId: data.ownerId,
      status: "released",
      reason: data.reason ?? "released by administrator",
      source: "admin",
      actorId: context.userId,
    });
    return { released };
  });

/** Reinstate a place that was released in error. */
export const adminRestoreFounderSlot = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { ownerId: string; reason?: string }) => {
    if (typeof data?.ownerId !== "string" || !data.ownerId) throw new Error("Missing account.");
    return {
      ownerId: data.ownerId,
      reason: typeof data?.reason === "string" ? data.reason.slice(0, 300) : undefined,
    };
  })
  .handler(async ({ data, context }): Promise<{ slotNumber: number | null }> => {
    await assertAdmin(context as never);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { restoreFounderSlot } = await import("./founder.server");
    const slotNumber = await restoreFounderSlot(
      supabaseAdmin as never,
      data.ownerId,
      data.reason ?? null,
      context.userId,
    );
    return { slotNumber };
  });

export interface FounderFeedbackAdminRow {
  id: string;
  slotNumber: number | null;
  setupEase: number | null;
  nearlyStopped: string | null;
  mostImportantFeature: string | null;
  recommendScore: number | null;
  missing: string | null;
  status: string;
  createdAt: string;
}

export const adminListFounderFeedback = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<FounderFeedbackAdminRow[]> => {
    await assertAdmin(context as never);
    const { data, error } = await context.supabase
      .from("founder_feedback")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(200);
    if (error) throw new Error(error.message);
    return (data ?? []).map((row: Record<string, unknown>) => ({
      id: row.id as string,
      slotNumber: (row.slot_number as number | null) ?? null,
      setupEase: (row.setup_ease as number | null) ?? null,
      nearlyStopped: (row.nearly_stopped as string | null) ?? null,
      mostImportantFeature: (row.most_important_feature as string | null) ?? null,
      recommendScore: (row.recommend_score as number | null) ?? null,
      missing: (row.missing as string | null) ?? null,
      status: row.status as string,
      createdAt: row.created_at as string,
    }));
  });
