// Central, server-authoritative entitlement model.
// Pure data + pure functions — safe to import anywhere, including tests.

export type PlanTierKey = "free" | "pro" | "business";

export const UNLIMITED = Number.POSITIVE_INFINITY;

export interface PlanEntitlements {
  planKey: PlanTierKey;
  businessesMax: number;
  activeQrCodesMax: number;
  advancedAnalytics: boolean;
  campaigns: boolean;
  aiCopy: "none" | "limited" | "full";
  marketingPacks: "basic" | "premium";
  removeBranding: boolean;
  teamMembersMax: number;
  whiteLabel: boolean;
  prioritySupport: boolean;
}

export const PLAN_ENTITLEMENTS: Record<PlanTierKey, PlanEntitlements> = {
  free: {
    planKey: "free",
    businessesMax: 1,
    activeQrCodesMax: 1,
    advancedAnalytics: false,
    campaigns: false,
    aiCopy: "limited",
    marketingPacks: "basic",
    removeBranding: false,
    teamMembersMax: 1,
    whiteLabel: false,
    prioritySupport: false,
  },
  pro: {
    planKey: "pro",
    businessesMax: 1,
    activeQrCodesMax: UNLIMITED,
    advancedAnalytics: true,
    campaigns: true,
    aiCopy: "full",
    marketingPacks: "premium",
    removeBranding: true,
    teamMembersMax: 1,
    whiteLabel: false,
    prioritySupport: true,
  },
  business: {
    planKey: "business",
    businessesMax: 10,
    activeQrCodesMax: UNLIMITED,
    advancedAnalytics: true,
    campaigns: true,
    aiCopy: "full",
    marketingPacks: "premium",
    removeBranding: true,
    teamMembersMax: 10,
    whiteLabel: true,
    prioritySupport: true,
  },
};

/** Subscription statuses that grant the paid plan's entitlements. */
export const ENTITLING_STATUSES = ["active", "trialing", "past_due"] as const;

export interface SubscriptionSnapshot {
  planKey: PlanTierKey;
  status: string;
  currentPeriodEnd: string | null;
}

/** Resolve the effective plan from a raw subscription row. */
export function effectivePlan(sub: SubscriptionSnapshot | null | undefined): PlanTierKey {
  if (!sub || sub.planKey === "free") return "free";
  const periodLive = !sub.currentPeriodEnd || new Date(sub.currentPeriodEnd).getTime() > Date.now();
  if ((ENTITLING_STATUSES as readonly string[]).includes(sub.status) && periodLive) {
    return sub.planKey;
  }
  // Cancelled but still inside the paid period keeps access until it ends.
  if (sub.status === "canceled" && sub.currentPeriodEnd && periodLive) return sub.planKey;
  return "free";
}

export function entitlementsFor(plan: PlanTierKey): PlanEntitlements {
  return PLAN_ENTITLEMENTS[plan] ?? PLAN_ENTITLEMENTS.free;
}

export interface UsageCounts {
  businesses: number;
  activeQrCodes: number;
}

export function canCreateBusinessWith(plan: PlanTierKey, usage: UsageCounts): boolean {
  return usage.businesses < entitlementsFor(plan).businessesMax;
}

export function canCreateQrCodeWith(plan: PlanTierKey, usage: UsageCounts): boolean {
  return usage.activeQrCodes < entitlementsFor(plan).activeQrCodesMax;
}

export interface OverLimitOptions {
  /**
   * IDs the account owner chose to keep manageable. Honoured first; any
   * remaining allowance is filled oldest-first.
   */
  preferredIds?: Array<string | null | undefined>;
}

/**
 * Accounts that drop below their previous allowance keep everything live:
 * nothing is deleted, deactivated or stopped from redirecting. Records inside
 * the allowance stay fully editable; the rest are flagged "over limit" and
 * become read-only in management until the account upgrades. The owner picks
 * which records keep the allowance via `preferredIds`; otherwise the oldest win.
 */
export function markOverLimit<T extends { id: string; created_at: string; status: string }>(
  rows: T[],
  max: number,
  options: OverLimitOptions = {},
): Array<T & { overLimit: boolean }> {
  const preferred = (options.preferredIds ?? []).filter(Boolean) as string[];
  const active = rows.filter((r) => r.status === "active");
  const byAge = [...active].sort(
    (a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime(),
  );
  const keep = new Set<string>();
  for (const id of preferred) {
    if (keep.size >= max) break;
    if (active.some((r) => r.id === id)) keep.add(id);
  }
  for (const row of byAge) {
    if (keep.size >= max) break;
    keep.add(row.id);
  }
  return rows.map((row) => ({
    ...row,
    overLimit: row.status === "active" && !keep.has(row.id),
  }));
}

/** QR-code specific wrapper kept for existing call sites. */
export function markLegacyOverLimit<T extends { id: string; created_at: string; status: string }>(
  qrCodes: T[],
  plan: PlanTierKey,
  options: OverLimitOptions = {},
): Array<T & { legacyOverLimit: boolean }> {
  return markOverLimit(qrCodes, entitlementsFor(plan).activeQrCodesMax, options).map(
    ({ overLimit, ...rest }) => ({ ...(rest as unknown as T), legacyOverLimit: overLimit }),
  );
}

export function markBusinessesOverLimit<
  T extends { id: string; created_at: string; status: string },
>(
  businesses: T[],
  plan: PlanTierKey,
  options: OverLimitOptions = {},
): Array<T & { overLimit: boolean }> {
  return markOverLimit(businesses, entitlementsFor(plan).businessesMax, options);
}

export const UPGRADE_COPY = {
  qrLimit: {
    title: "You've launched your first QR code.",
    body: "Upgrade to Pro to create unlimited QR codes, track campaigns and unlock advanced analytics.",
  },
  businessLimit: {
    title: "You're managing your first business.",
    body: "Upgrade to Business to manage up to 10 businesses with portfolio reporting and team accounts.",
  },
  advancedAnalytics: {
    title: "Your QR is getting attention.",
    body: "Upgrade to Pro to see device, location and campaign breakdowns behind every scan.",
  },
  campaigns: {
    title: "Track what actually drives reviews.",
    body: "Campaign tracking is part of Pro — tag each placement and compare performance.",
  },
  aiCopy: {
    title: "Let the AI copy assistant write it for you.",
    body: "Pro unlocks unlimited on-brand headlines, support text and calls to action.",
  },
  branding: {
    title: "Make it entirely yours.",
    body: "Pro removes GuestReview Pro branding from every printed asset.",
  },
  premiumPacks: {
    title: "Unlock the full marketing pack library.",
    body: "Pro includes unlimited packs and premium print-ready exports.",
  },
} as const;

export type UpgradeReason = keyof typeof UPGRADE_COPY;
