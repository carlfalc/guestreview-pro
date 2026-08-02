// Which emails each plan receives. Pure data — safe to import anywhere.
import type { PlanTierKey } from "./entitlements";

export interface EmailEntitlements {
  /** Automated weekly Reputation Health™ report. */
  weeklyReport: boolean;
  /** How many businesses may receive their own weekly report. */
  weeklyReportBusinessesMax: number;
  /** Cross-business portfolio digest. */
  portfolioDigest: boolean;
  /** Email preview + test sends. */
  preview: boolean;
  /** Delivery history in settings. */
  deliveryHistory: boolean;
  /** Per-business delivery preferences. */
  perBusinessPreferences: boolean;
}

export const EMAIL_ENTITLEMENTS: Record<PlanTierKey, EmailEntitlements> = {
  free: {
    weeklyReport: false,
    weeklyReportBusinessesMax: 0,
    portfolioDigest: false,
    preview: false,
    deliveryHistory: false,
    perBusinessPreferences: false,
  },
  pro: {
    weeklyReport: true,
    weeklyReportBusinessesMax: 1,
    portfolioDigest: false,
    preview: true,
    deliveryHistory: true,
    perBusinessPreferences: false,
  },
  business: {
    weeklyReport: true,
    weeklyReportBusinessesMax: 10,
    portfolioDigest: true,
    preview: true,
    deliveryHistory: true,
    perBusinessPreferences: true,
  },
};

export function emailEntitlementsFor(plan: PlanTierKey): EmailEntitlements {
  return EMAIL_ENTITLEMENTS[plan] ?? EMAIL_ENTITLEMENTS.free;
}

export const EMAIL_PAYWALL_COPY =
  "Upgrade to receive your weekly Reputation Health™ report automatically.";

export const AI_SUMMARY_DISCLAIMER =
  "AI-generated summary based on verified GuestReview Pro activity data.";

/** Free accounts still receive account-critical mail. */
export function canReceiveWeeklyReport(plan: PlanTierKey): boolean {
  return emailEntitlementsFor(plan).weeklyReport;
}

export function canReceivePortfolioDigest(plan: PlanTierKey): boolean {
  return emailEntitlementsFor(plan).portfolioDigest;
}

/** Trim a requested business selection down to what the plan allows. */
export function allowedBusinessIds(plan: PlanTierKey, requested: string[]): string[] {
  const max = emailEntitlementsFor(plan).weeklyReportBusinessesMax;
  return requested.slice(0, Math.max(0, max));
}
