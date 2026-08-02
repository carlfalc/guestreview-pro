// Beta feedback surface. Users submit their own feedback; admins list and
// triage it. All writes are scoped to the authenticated caller by RLS.
import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { sanitisePath } from "./analytics";
import type { LooseClient } from "@/lib/loose-types";

export const FEEDBACK_CATEGORIES = ["bug", "idea", "confusing", "praise", "other"] as const;
export type FeedbackCategory = (typeof FEEDBACK_CATEGORIES)[number];

export const FEEDBACK_STATUSES = ["new", "triaged", "resolved", "wont_fix"] as const;
export type FeedbackStatus = (typeof FEEDBACK_STATUSES)[number];

export interface FeedbackRow {
  id: string;
  category: string;
  message: string;
  path: string | null;
  rating: number | null;
  status: string;
  admin_notes: string | null;
  created_at: string;
}

function isCategory(v: string): v is FeedbackCategory {
  return (FEEDBACK_CATEGORIES as readonly string[]).includes(v);
}

/** Submit one piece of beta feedback. */
export const submitBetaFeedback = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    (data: { category: string; message: string; rating?: number | null; path?: string }) => {
      const category = String(data?.category ?? "other");
      if (!isCategory(category)) throw new Error("Invalid category");
      const message = String(data?.message ?? "").trim();
      if (message.length < 3) throw new Error("Please add a little more detail.");
      if (message.length > 4000) throw new Error("Feedback is too long.");
      const rawRating = data?.rating;
      const rating =
        typeof rawRating === "number" &&
        Number.isInteger(rawRating) &&
        rawRating >= 1 &&
        rawRating <= 5
          ? rawRating
          : null;
      return { category, message, rating, path: sanitisePath(data?.path) };
    },
  )
  .handler(async ({ data, context }): Promise<{ ok: true }> => {
    const { error } = await context.supabase.from("beta_feedback").insert({
      owner_id: context.userId,
      category: data.category,
      message: data.message,
      rating: data.rating,
      path: data.path,
    });
    if (error) throw new Error(error.message);
    return { ok: true };
  });

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

/** Newest beta feedback, admin only. */
export const adminListFeedback = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<FeedbackRow[]> => {
    await assertAdmin(context as never);
    const { data, error } = await (context.supabase as never as LooseClient)
      .from("beta_feedback")
      .select("id, category, message, path, rating, status, admin_notes, created_at")
      .order("created_at", { ascending: false })
      .limit(100);
    if (error) throw new Error(error.message);
    return (data ?? []) as FeedbackRow[];
  });

/** Move a feedback item through triage. Admin only. */
export const adminSetFeedbackStatus = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { id: string; status: string }) => {
    const id = String(data?.id ?? "");
    if (!/^[0-9a-f-]{36}$/i.test(id)) throw new Error("Invalid id");
    const status = String(data?.status ?? "");
    if (!(FEEDBACK_STATUSES as readonly string[]).includes(status))
      throw new Error("Invalid status");
    return { id, status };
  })
  .handler(async ({ data, context }): Promise<{ ok: true }> => {
    await assertAdmin(context as never);
    const { error } = await (context.supabase as never as LooseClient)
      .from("beta_feedback")
      .update({ status: data.status })
      .eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export interface BetaHealth {
  since: string;
  signups: number;
  totalAccounts: number;
  businesses: number;
  activeQrCodes: number;
  scans: number;
  scanClickThrough: number;
  packs: number;
  paidAccounts: number;
  checkoutsStarted: number;
  checkoutsCompleted: number;
  webhookFailures: number;
  feedbackNew: number;
  feedbackTotal: number;
  pendingRegionRequests: number;
}

/** One-glance beta health summary. Admin only; enforced inside the RPC too. */
export const adminBetaHealth = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<BetaHealth> => {
    await assertAdmin(context as never);
    const { data, error } = await context.supabase.rpc("admin_beta_health", {});
    if (error) throw new Error(error.message);
    const h = (data ?? {}) as Partial<BetaHealth>;
    return {
      since: String(h.since ?? ""),
      signups: Number(h.signups ?? 0),
      totalAccounts: Number(h.totalAccounts ?? 0),
      businesses: Number(h.businesses ?? 0),
      activeQrCodes: Number(h.activeQrCodes ?? 0),
      scans: Number(h.scans ?? 0),
      scanClickThrough: Number(h.scanClickThrough ?? 0),
      packs: Number(h.packs ?? 0),
      paidAccounts: Number(h.paidAccounts ?? 0),
      checkoutsStarted: Number(h.checkoutsStarted ?? 0),
      checkoutsCompleted: Number(h.checkoutsCompleted ?? 0),
      webhookFailures: Number(h.webhookFailures ?? 0),
      feedbackNew: Number(h.feedbackNew ?? 0),
      feedbackTotal: Number(h.feedbackTotal ?? 0),
      pendingRegionRequests: Number(h.pendingRegionRequests ?? 0),
    };
  });
