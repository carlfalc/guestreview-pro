// Server-only side effects that run once when an account becomes paid.
// Entitlements themselves are derived from the subscriptions row, so nothing
// here grants access — this only handles the one-off welcome touchpoints.
import type { SupabaseClient } from "@supabase/supabase-js";

export type PaidPlanKey = "pro" | "business";

const PLAN_LABEL: Record<PaidPlanKey, string> = {
  pro: "GuestReview Pro",
  business: "GuestReview Business",
};

/**
 * Sends the welcome email when app emails are configured for the project.
 * The send helper only exists once an email domain has been verified and the
 * templates scaffolded, so this resolves to a no-op until then.
 */
async function sendWelcomeEmail(email: string, name: string | null, plan: PaidPlanKey) {
  // Resolved through a variable so the bundler does not require the module to
  // exist yet; it appears when app emails are scaffolded.
  const specifier = "@/lib/email-templates/send-email";
  try {
    const mod = (await import(/* @vite-ignore */ specifier).catch(() => null)) as
      | { sendTemplateEmail?: (t: string, to: string, o?: unknown) => Promise<unknown> }
      | null;
    if (!mod?.sendTemplateEmail) return false;
    await mod.sendTemplateEmail("upgrade-welcome", email, {
      templateData: { name: name ?? undefined, planName: PLAN_LABEL[plan] },
      idempotencyKey: `upgrade-welcome-${email}-${plan}`,
    });
    return true;
  } catch (e) {
    console.error("Upgrade welcome email failed:", e);
    return false;
  }
}

/**
 * Idempotent: re-running for the same account and plan does nothing, so
 * repeated `customer.subscription.updated` events never re-send or re-show
 * the checklist.
 */
export async function onSubscriptionActivated(
  admin: SupabaseClient,
  ownerId: string,
  planKey: PaidPlanKey | string,
) {
  if (planKey !== "pro" && planKey !== "business") return;

  const { data } = await admin
    .from("profiles")
    .select("email, full_name, upgrade_welcome_plan_key")
    .eq("id", ownerId)
    .maybeSingle();
  const profile = data as
    | { email: string | null; full_name: string | null; upgrade_welcome_plan_key: string | null }
    | null;
  if (!profile) return;
  if (profile.upgrade_welcome_plan_key === planKey) return; // already welcomed on this plan

  const sent = profile.email
    ? await sendWelcomeEmail(profile.email, profile.full_name, planKey)
    : false;

  await admin
    .from("profiles")
    .update({
      upgrade_welcome_plan_key: planKey,
      upgrade_welcome_email_sent_at: sent ? new Date().toISOString() : null,
      // Re-arm the post-upgrade onboarding checklist for the new plan.
      upgrade_checklist_dismissed_at: null,
    })
    .eq("id", ownerId);
}
