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
  const periodLive =
    !sub.currentPeriodEnd || new Date(sub.currentPeriodEnd).getTime() > Date.now();
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

/**
 * Existing accounts may already exceed the Free allowance. Nothing is deleted
 * or deactivated: the oldest QR codes stay fully manageable up to the limit,
 * and the rest are flagged "legacy over limit" — still redirecting publicly,
 * read-only in management until the account upgrades.
 */
export function markLegacyOverLimit<T extends { id: string; created_at: string; status: string }>(
  qrCodes: T[],
  plan: PlanTierKey,
): Array<T & { legacyOverLimit: boolean }> {
  const max = entitlementsFor(plan).activeQrCodesMax;
  const ordered = [...qrCodes].sort(
    (a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime(),
  );
  let activeSeen = 0;
  const flags = new Map<string, boolean>();
  for (const qr of ordered) {
    if (qr.status !== "active") {
      flags.set(qr.id, false);
      continue;
    }
    activeSeen += 1;
    flags.set(qr.id, activeSeen > max);
  }
  return qrCodes.map((qr) => ({ ...qr, legacyOverLimit: flags.get(qr.id) ?? false }));
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
