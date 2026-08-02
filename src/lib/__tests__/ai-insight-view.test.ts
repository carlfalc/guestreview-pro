import { describe, it, expect } from "vitest";
import {
  allowanceLabel,
  canGenerateNow,
  canSelectBusiness,
  customerFacingError,
  formatPeriod,
  freshnessLabel,
  resolveCardState,
  shouldSubmitFeedback,
  statusLabel,
  toHistoryRows,
  upgradePlanFor,
  type AccessLike,
} from "@/lib/ai-insight-view";
import type { InsightOutput } from "@/lib/ai-insights";

const NOW = Date.parse("2026-03-10T12:00:00.000Z");
const ago = (ms: number) => new Date(NOW - ms).toISOString();
const DAY = 24 * 60 * 60 * 1000;

const proAccess: AccessLike = {
  plan: "pro",
  canGenerate: true,
  perBusinessPerWeek: 3,
  remainingThisWeek: 3,
  businessesCovered: 1,
};
const businessAccess: AccessLike = { ...proAccess, plan: "business", businessesCovered: "all" };
const freeAccess: AccessLike = {
  plan: "free",
  canGenerate: false,
  perBusinessPerWeek: 0,
  remainingThisWeek: 0,
  businessesCovered: 0,
};

const output: InsightOutput = {
  headline: "Scans are up on last week",
  executiveSummary: "Steady week.",
  topWin: { title: "Table tents", explanation: "Most scans." },
  mainOpportunity: { title: "Counter card", explanation: "Fewest scans." },
  recommendedActions: [
    { title: "Reprint counter card", reason: "Faded", effort: "low", expectedImpact: "medium" },
  ],
  closingNote: "Keep going.",
  confidenceDisclaimer: "Based on a small sample.",
};

describe("AI insight card state", () => {
  it("shows a loading state first", () => {
    expect(
      resolveCardState({ loading: true, hasBusiness: true, access: proAccess, insight: null }),
    ).toBe("loading");
  });

  it("paywalls free accounts", () => {
    expect(
      resolveCardState({
        loading: false,
        hasBusiness: true,
        access: freeAccess,
        insight: null,
        now: NOW,
      }),
    ).toBe("no_access");
    expect(canGenerateNow("not_generated", freeAccess)).toBe(false);
    expect(upgradePlanFor("free")).toBe("pro");
  });

  it("lets Pro generate for one business without a selector", () => {
    expect(
      resolveCardState({
        loading: false,
        hasBusiness: true,
        access: proAccess,
        insight: null,
        now: NOW,
      }),
    ).toBe("not_generated");
    expect(canGenerateNow("not_generated", proAccess)).toBe(true);
    expect(canSelectBusiness(proAccess)).toBe(false);
  });

  it("offers business selection on the Business plan", () => {
    expect(canSelectBusiness(businessAccess)).toBe(true);
    expect(upgradePlanFor("pro")).toBe("business");
  });

  it("reports insufficient data, generating and failed states", () => {
    const base = { loading: false, hasBusiness: true, access: proAccess, now: NOW };
    expect(
      resolveCardState({
        ...base,
        insight: { id: "1", status: "insufficient_data", generatedAt: ago(DAY), output: null },
      }),
    ).toBe("insufficient_data");
    expect(
      resolveCardState({
        ...base,
        insight: { id: "1", status: "generating", generatedAt: null, output: null },
      }),
    ).toBe("generating");
    expect(
      resolveCardState({
        ...base,
        insight: { id: "1", status: "failed", generatedAt: ago(DAY), output: null },
      }),
    ).toBe("failed");
  });

  it("marks a fresh generation ready and an old one stale", () => {
    const base = { loading: false, hasBusiness: true, access: proAccess, now: NOW };
    expect(
      resolveCardState({
        ...base,
        insight: { id: "1", status: "completed", generatedAt: ago(DAY), output },
      }),
    ).toBe("ready");
    expect(
      resolveCardState({
        ...base,
        insight: { id: "1", status: "completed", generatedAt: ago(9 * DAY), output },
      }),
    ).toBe("stale");
  });

  it("shows the rate-limited state when the weekly allowance is spent", () => {
    const spent = { ...proAccess, remainingThisWeek: 0 };
    expect(
      resolveCardState({
        loading: false,
        hasBusiness: true,
        access: spent,
        insight: null,
        now: NOW,
      }),
    ).toBe("rate_limited");
    expect(canGenerateNow("ready", spent)).toBe(false);
    expect(allowanceLabel(spent)).toContain("used all 3");
  });

  it("hides itself until a business exists", () => {
    expect(
      resolveCardState({ loading: false, hasBusiness: false, access: proAccess, insight: null }),
    ).toBe("no_business");
  });
});

describe("freshness and formatting", () => {
  it("labels recency in owner-friendly language", () => {
    expect(freshnessLabel(null, NOW)).toBe("Not generated yet");
    expect(freshnessLabel(ago(30 * 60 * 1000), NOW)).toBe("Generated in the last hour");
    expect(freshnessLabel(ago(5 * 60 * 60 * 1000), NOW)).toBe("Generated 5 hours ago");
    expect(freshnessLabel(ago(3 * DAY), NOW)).toBe("Generated 3 days ago");
    expect(freshnessLabel(ago(10 * DAY), NOW)).toContain("Out of date");
  });

  it("formats a report period", () => {
    expect(formatPeriod("2026-03-01T00:00:00Z", "2026-03-08T00:00:00Z")).toContain("–");
  });
});

describe("customer-facing errors", () => {
  it("never leaks technical detail", () => {
    expect(customerFacingError("hourly_limit")).toContain("try again shortly");
    expect(customerFacingError("weekly_limit")).toContain("next week");
    expect(customerFacingError("unauthorized")).toContain("no longer available");
    expect(customerFacingError("network")).toContain("connection");
    expect(
      customerFacingError("generation_failed", 'AI provider error (500): {"model":"gpt"}'),
    ).toBe("We couldn't write your summary just now. Please try again.");
  });
});

describe("feedback", () => {
  it("accepts a first verdict", () => {
    expect(shouldSubmitFeedback(null, { helpful: true, reason: null })).toBe(true);
  });

  it("prevents duplicate submissions", () => {
    expect(
      shouldSubmitFeedback({ helpful: true, reason: null }, { helpful: true, reason: null }),
    ).toBe(false);
  });

  it("allows an explicit change of mind", () => {
    expect(
      shouldSubmitFeedback({ helpful: true, reason: null }, { helpful: false, reason: "too_long" }),
    ).toBe(true);
    expect(
      shouldSubmitFeedback(
        { helpful: false, reason: "too_long" },
        { helpful: false, reason: "too_generic" },
      ),
    ).toBe(true);
  });
});

describe("history", () => {
  it("renders one row per generation and keeps old ones", () => {
    const rows = toHistoryRows([
      {
        id: "a",
        status: "completed",
        generatedAt: ago(DAY),
        createdAt: ago(DAY),
        periodStart: ago(8 * DAY),
        periodEnd: ago(DAY),
        output,
        payload: { reputationHealth: { score: 72, movement: { label: "Up 4 points" } } },
      },
      {
        id: "b",
        status: "failed",
        generatedAt: ago(20 * DAY),
        createdAt: ago(20 * DAY),
        periodStart: ago(27 * DAY),
        periodEnd: ago(20 * DAY),
        output: null,
        payload: null,
      },
    ]);
    expect(rows).toHaveLength(2);
    expect(rows[0]!.score).toBe(72);
    expect(rows[0]!.movement).toBe("Up 4 points");
    expect(rows[0]!.canOpen).toBe(true);
    expect(rows[1]!.canOpen).toBe(false);
    expect(rows[1]!.headline).toBe("Couldn't be produced");
    expect(statusLabel("insufficient_data")).toBe("Not enough data yet");
  });
});
