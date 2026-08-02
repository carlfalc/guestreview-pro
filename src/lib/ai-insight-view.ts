// AI Weekly Insights — pure presentation logic.
//
// Kept free of React so the dashboard, the report and the tests all agree on
// exactly which state a card is in and what wording the owner sees. Nothing
// here recalculates a Reputation Health™ score.
import {
  AI_DISCLAIMER,
  STALE_AFTER_MS,
  cardStateFor,
  insightLimitsFor,
  type InsightCardState,
  type InsightOutput,
} from "@/lib/ai-insights";
import type { PlanTierKey } from "@/lib/entitlements";

/* -------------------------------------------------------------------------- */
/* Card state                                                                 */
/* -------------------------------------------------------------------------- */

export type AiCardState =
  | "loading"
  | "no_access"
  | "no_business"
  | InsightCardState
  | "rate_limited";

export interface InsightLike {
  id: string;
  status: string;
  generatedAt: string | null;
  output: InsightOutput | null;
}

export interface AccessLike {
  plan: PlanTierKey;
  canGenerate: boolean;
  perBusinessPerWeek: number;
  remainingThisWeek: number;
  businessesCovered: number | "all";
}

export function resolveCardState(args: {
  loading: boolean;
  hasBusiness: boolean;
  access: AccessLike | null;
  insight: InsightLike | null;
  now?: number;
}): AiCardState {
  if (args.loading) return "loading";
  if (!args.hasBusiness) return "no_business";
  if (!args.access || !args.access.canGenerate) return "no_access";

  const base = cardStateFor(args.insight, args.now ?? Date.now());
  if (base === "generating" || base === "failed" || base === "insufficient_data") return base;
  if (base === "not_generated" && args.access.remainingThisWeek <= 0) return "rate_limited";
  return base;
}

/** Whether the generate/regenerate button may be pressed in this state. */
export function canGenerateNow(state: AiCardState, access: AccessLike | null): boolean {
  if (!access || !access.canGenerate) return false;
  if (access.remainingThisWeek <= 0) return false;
  return (
    state === "not_generated" ||
    state === "ready" ||
    state === "stale" ||
    state === "failed" ||
    state === "insufficient_data"
  );
}

/** Business selection is only offered on plans that cover every location. */
export function canSelectBusiness(access: AccessLike | null): boolean {
  return access?.businessesCovered === "all";
}

export function allowanceLabel(access: AccessLike | null): string {
  if (!access || !access.canGenerate) return "Available on Pro and Business plans";
  const { remainingThisWeek, perBusinessPerWeek } = access;
  if (remainingThisWeek <= 0) {
    return `You've used all ${perBusinessPerWeek} summaries for this business this week.`;
  }
  return `${remainingThisWeek} of ${perBusinessPerWeek} summaries left this week`;
}

/* -------------------------------------------------------------------------- */
/* Freshness                                                                  */
/* -------------------------------------------------------------------------- */

const HOUR = 60 * 60 * 1000;
const DAY = 24 * HOUR;

export function freshnessLabel(generatedAt: string | null, now = Date.now()): string {
  if (!generatedAt) return "Not generated yet";
  const at = Date.parse(generatedAt);
  if (Number.isNaN(at)) return "Not generated yet";
  const age = now - at;
  if (age > STALE_AFTER_MS) return "Out of date — generate a fresh summary";
  if (age < HOUR) return "Generated in the last hour";
  if (age < DAY) return `Generated ${Math.max(1, Math.round(age / HOUR))} hours ago`;
  const days = Math.round(age / DAY);
  return days <= 1 ? "Generated yesterday" : `Generated ${days} days ago`;
}

export function formatGeneratedDate(generatedAt: string | null): string {
  if (!generatedAt) return "—";
  const at = new Date(generatedAt);
  if (Number.isNaN(at.getTime())) return "—";
  return at.toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" });
}

export function formatPeriod(start: string, end: string): string {
  const opts: Intl.DateTimeFormatOptions = { day: "numeric", month: "short" };
  const s = new Date(start);
  const e = new Date(end);
  if (Number.isNaN(s.getTime()) || Number.isNaN(e.getTime())) return "—";
  return `${s.toLocaleDateString(undefined, opts)} – ${e.toLocaleDateString(undefined, opts)}`;
}

/* -------------------------------------------------------------------------- */
/* Customer-facing messages                                                   */
/* -------------------------------------------------------------------------- */

/**
 * Maps every failure the server can report — plus browser-side failures — to
 * wording a business owner can act on. Provider names, model IDs, stack traces
 * and raw gateway payloads never reach this layer.
 */
export function customerFacingError(code: string, serverMessage?: string): string {
  switch (code) {
    case "plan_required":
      return "AI Weekly Insights are included with Pro and Business plans.";
    case "business_not_covered":
      return "Your plan covers weekly insights for one business. Upgrade to Business for every location.";
    case "in_progress":
      return "A summary is already being prepared for this business. Give it a moment.";
    case "weekly_limit":
      return "You've used this week's summaries for this business. Fresh allowance starts next week.";
    case "hourly_limit":
      return "You've generated a lot of summaries in a short time. Please try again shortly.";
    case "insufficient_data":
      return "Not enough activity yet to write a reliable weekly summary.";
    case "unauthorized":
    case "not_found":
      return "That business is no longer available on your account.";
    case "network":
      return "We couldn't reach GuestReview Pro. Check your connection and try again.";
    case "generation_failed":
    default:
      return serverMessage && !looksTechnical(serverMessage)
        ? serverMessage
        : "We couldn't write your summary just now. Please try again.";
  }
}

function looksTechnical(message: string): boolean {
  return /\b(gpt|openai|gateway|http|json|token|stack|undefined|null|error:|\{|\})\b/i.test(
    message,
  );
}

export const FEEDBACK_REASONS = [
  { key: "too_generic", label: "Too generic" },
  { key: "incorrect_emphasis", label: "Incorrect emphasis" },
  { key: "missing_context", label: "Missing context" },
  { key: "too_long", label: "Too long" },
  { key: "other", label: "Other" },
] as const;

export type FeedbackReasonKey = (typeof FEEDBACK_REASONS)[number]["key"];

/**
 * Feedback is a single opinion per insight. Re-submitting the same verdict is
 * a no-op; explicitly changing it through is allowed.
 */
export function shouldSubmitFeedback(
  existing: { helpful: boolean; reason: string | null } | null,
  next: { helpful: boolean; reason: string | null },
): boolean {
  if (!existing) return true;
  if (existing.helpful !== next.helpful) return true;
  return (existing.reason ?? null) !== (next.reason ?? null);
}

/* -------------------------------------------------------------------------- */
/* History                                                                    */
/* -------------------------------------------------------------------------- */

export interface HistoryRow {
  id: string;
  generated: string;
  period: string;
  score: number | null;
  movement: string;
  headline: string;
  status: string;
  statusLabel: string;
  canOpen: boolean;
}

const STATUS_LABELS: Record<string, string> = {
  completed: "Ready",
  generating: "Preparing",
  pending: "Preparing",
  failed: "Couldn't be produced",
  insufficient_data: "Not enough data yet",
};

export function statusLabel(status: string): string {
  return STATUS_LABELS[status] ?? "Unavailable";
}

export function toHistoryRows(
  insights: Array<{
    id: string;
    status: string;
    generatedAt: string | null;
    createdAt: string;
    periodStart: string;
    periodEnd: string;
    output: InsightOutput | null;
    payload: { reputationHealth?: { score: number | null; movement?: { label: string } } } | null;
  }>,
): HistoryRow[] {
  return insights.map((i) => ({
    id: i.id,
    generated: formatGeneratedDate(i.generatedAt ?? i.createdAt),
    period: formatPeriod(i.periodStart, i.periodEnd),
    score: i.payload?.reputationHealth?.score ?? null,
    movement: i.payload?.reputationHealth?.movement?.label ?? "No comparison yet",
    headline: i.output?.headline ?? statusLabel(i.status),
    status: i.status,
    statusLabel: statusLabel(i.status),
    canOpen: i.status === "completed" && Boolean(i.output),
  }));
}

/* -------------------------------------------------------------------------- */
/* Paywall copy                                                               */
/* -------------------------------------------------------------------------- */

export const PAYWALL_TITLE = "Unlock AI Weekly Insights";
export const PAYWALL_BODY =
  "Get a concise weekly summary of what improved, what needs attention and what to do next.";

export function upgradePlanFor(plan: PlanTierKey): "pro" | "business" {
  return insightLimitsFor(plan).canGenerate ? "business" : "pro";
}

export { AI_DISCLAIMER };
