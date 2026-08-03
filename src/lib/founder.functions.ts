// Founding Member Beta — client-callable surface.
//
// The browser never supplies slot numbers, prices, regions or eligibility.
// It may only ask "is the offer open?" and "what is my slot?".
import { createServerFn } from "@tanstack/react-start";
import { getRequest } from "@tanstack/react-start/server";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import type { PaidInterval } from "./regional-pricing";
import type { FounderSlotStatus } from "./founder";

export interface FounderOfferDTO {
  /** Places still available across the whole programme. */
  remaining: number;
  limit: number;
  available: boolean;
}

export interface MyFounderStatusDTO extends FounderOfferDTO {
  slot: {
    slotNumber: number;
    status: FounderSlotStatus;
    billingInterval: PaidInterval;
    pricingRegion: string;
    activatedAt: string | null;
    releasedAt: string | null;
    releaseReason: string | null;
  } | null;
  /** True when the account may still purchase the founder offer. */
  eligible: boolean;
  eligibilityReason?: string;
  feedbackSubmitted: boolean;
  feedbackDue: boolean;
}

/**
 * Public, unauthenticated: how many founder places remain.
 * Uses the publishable key with a narrow SECURITY DEFINER counter — no
 * personal or payment data is reachable through it.
 */
export const getFounderOffer = createServerFn({ method: "GET" }).handler(
  async (): Promise<FounderOfferDTO> => {
    const { createClient } = await import("@supabase/supabase-js");
    const { FOUNDER_SLOT_LIMIT } = await import("./founder");
    const key = process.env["SUPABASE_PUBLISHABLE_KEY"];
    const url = process.env["SUPABASE_URL"];
    if (!key || !url) return { remaining: 0, limit: FOUNDER_SLOT_LIMIT, available: false };

    const client = createClient(url, key, {
      auth: { persistSession: false, autoRefreshToken: false },
      global: {
        fetch: (input, init) => {
          const h = new Headers(init?.headers);
          if (key.startsWith("sb_") && h.get("Authorization") === `Bearer ${key}`) {
            h.delete("Authorization");
          }
          h.set("apikey", key);
          return fetch(input, { ...init, headers: h });
        },
      },
    });

    try {
      const { data } = await client.rpc("founder_slots_remaining");
      const remaining = typeof data === "number" ? data : 0;
      return { remaining, limit: FOUNDER_SLOT_LIMIT, available: remaining > 0 };
    } catch {
      return { remaining: 0, limit: FOUNDER_SLOT_LIMIT, available: false };
    }
  },
);

/** The signed-in account's founder place, if any. */
export const getMyFounderStatus = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<MyFounderStatusDTO> => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { founderOfferEligible, getFounderSlot } = await import("./founder.server");
    const { FOUNDER_SLOT_LIMIT, founderFeedbackDue } = await import("./founder");

    const admin = supabaseAdmin as never;
    const slot = await getFounderSlot(admin, context.userId);
    const { eligible, remaining, reason } = await founderOfferEligible(admin, context.userId);

    const { data: feedback } = await context.supabase
      .from("founder_feedback")
      .select("id")
      .eq("owner_id", context.userId)
      .maybeSingle();

    return {
      remaining,
      limit: FOUNDER_SLOT_LIMIT,
      available: remaining > 0,
      eligible,
      ...(reason ? { eligibilityReason: reason } : {}),
      slot: slot
        ? {
            slotNumber: slot.slotNumber,
            status: slot.status,
            billingInterval: slot.billingInterval,
            pricingRegion: slot.pricingRegion,
            activatedAt: slot.activatedAt,
            releasedAt: slot.releasedAt,
            releaseReason: slot.releaseReason,
          }
        : null,
      feedbackSubmitted: Boolean(feedback),
      feedbackDue:
        slot?.status === "active" && !feedback && founderFeedbackDue(slot.activatedAt),
    };
  });

export interface FounderFeedbackInput {
  setupEase?: number | null;
  nearlyStopped?: string | null;
  mostImportantFeature?: string | null;
  recommendScore?: number | null;
  missing?: string | null;
}

const clampInt = (value: unknown, min: number, max: number): number | null => {
  const n = Number(value);
  if (!Number.isFinite(n)) return null;
  return Math.min(max, Math.max(min, Math.round(n)));
};

const text = (value: unknown): string | null => {
  if (typeof value !== "string") return null;
  const trimmed = value.trim().slice(0, 2000);
  return trimmed.length ? trimmed : null;
};

/** Founders-only feedback channel, separate from general beta feedback. */
export const submitFounderFeedback = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: FounderFeedbackInput) => ({
    setupEase: clampInt(data?.setupEase, 1, 5),
    nearlyStopped: text(data?.nearlyStopped),
    mostImportantFeature: text(data?.mostImportantFeature),
    recommendScore: clampInt(data?.recommendScore, 0, 10),
    missing: text(data?.missing),
  }))
  .handler(async ({ data, context }): Promise<{ ok: boolean; error?: string }> => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { getFounderSlot } = await import("./founder.server");
    const slot = await getFounderSlot(supabaseAdmin as never, context.userId);
    if (!slot) return { ok: false, error: "This feedback channel is for founding members." };

    const { error } = await context.supabase.from("founder_feedback").upsert(
      {
        owner_id: context.userId,
        slot_number: slot.slotNumber,
        setup_ease: data.setupEase,
        nearly_stopped: data.nearlyStopped,
        most_important_feature: data.mostImportantFeature,
        recommend_score: data.recommendScore,
        missing: data.missing,
        status: "new",
      },
      { onConflict: "owner_id" },
    );
    if (error) return { ok: false, error: error.message };
    return { ok: true };
  });
