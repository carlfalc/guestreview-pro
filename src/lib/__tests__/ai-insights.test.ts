import { describe, it, expect } from "vitest";
import {
  MIN_SCANS_FOR_INSIGHT,
  cardStateFor,
  checkInsightAllowance,
  checkInsightSufficiency,
  detectInsightSafetyIssues,
  insightLimitsFor,
  insightToPlainText,
  validateInsightOutput,
  type InsightOutput,
  type InsightPayload,
} from "@/lib/ai-insights";
import type { HealthScore } from "@/lib/health-score";

const NOW = Date.parse("2026-03-10T12:00:00.000Z");
const DAY = 24 * 60 * 60 * 1000;
const ago = (ms: number) => new Date(NOW - ms).toISOString();

const good = {
  headline: "A steady week for scans",
  executiveSummary: "Activity held steady across your placements.",
  topWin: { title: "Table tents", explanation: "They recorded the most scans." },
  mainOpportunity: { title: "Counter card", explanation: "It engaged the fewest people." },
  recommendedActions: [
    {
      title: "Reprint the counter card",
      reason: "It looks faded",
      effort: "low",
      expectedImpact: "medium",
    },
    {
      title: "Add a window sticker",
      reason: "Entrance traffic",
      effort: "low",
      expectedImpact: "medium",
    },
    { title: "Brief the team", reason: "Prompts help", effort: "medium", expectedImpact: "high" },
    { title: "Fourth action", reason: "Should be dropped", effort: "low", expectedImpact: "low" },
  ],
  closingNote: "Keep the placements visible.",
  confidenceDisclaimer: "Based on a modest number of scans.",
};

function payloadWith(scans: number): InsightPayload {
  return { activity: { scans } } as unknown as InsightPayload;
}

function healthWith(blocking: boolean): HealthScore {
  return {
    preconditions: [{ key: "k", label: "l", note: "n", passed: !blocking, blocking: true }],
  } as unknown as HealthScore;
}

describe("output validation", () => {
  it("accepts a well-formed response and caps actions at three", () => {
    const out = validateInsightOutput(good);
    expect(out.recommendedActions).toHaveLength(3);
    expect(out.topWin.title).toBe("Table tents");
  });

  it("rejects malformed responses", () => {
    expect(() => validateInsightOutput(null)).toThrow("invalid_response_format");
    expect(() => validateInsightOutput({ headline: "x" })).toThrow("invalid_response_format");
    expect(() => validateInsightOutput("not json")).toThrow("invalid_response_format");
  });

  it("defaults unknown effort levels rather than failing", () => {
    const out = validateInsightOutput({
      ...good,
      recommendedActions: [{ title: "A", reason: "B", effort: "urgent", expectedImpact: "" }],
    });
    expect(out.recommendedActions[0]!.effort).toBe("medium");
  });

  it("produces plain text for copying", () => {
    const text = insightToPlainText(validateInsightOutput(good), "Glasshouse");
    expect(text).toContain("Glasshouse");
    expect(text).toContain("Top win:");
    expect(text).toContain("AI-generated summary");
  });
});

describe("banned claims", () => {
  const withSummary = (summary: string): InsightOutput => ({
    ...validateInsightOutput(good),
    executiveSummary: summary,
  });

  it("blocks review counts, ratings, revenue, competitors and guarantees", () => {
    expect(detectInsightSafetyIssues(withSummary("You gained 12 new reviews."))).toContain(
      "review_totals",
    );
    expect(detectInsightSafetyIssues(withSummary("Your 4.6 star rating improved."))).toContain(
      "star_rating",
    );
    expect(detectInsightSafetyIssues(withSummary("Revenue 4000 was up."))).toContain("revenue");
    expect(detectInsightSafetyIssues(withSummary("Ahead of competitors."))).toContain("competitor");
    expect(detectInsightSafetyIssues(withSummary("This guarantees more reviews."))).toContain(
      "guarantee",
    );
    expect(detectInsightSafetyIssues(withSummary("This caused the uplift."))).toContain("causal");
  });

  it("passes a compliant summary", () => {
    expect(detectInsightSafetyIssues(validateInsightOutput(good))).toEqual([]);
  });
});

describe("sufficiency gate", () => {
  it("blocks when there are too few scans", () => {
    const r = checkInsightSufficiency(payloadWith(MIN_SCANS_FOR_INSIGHT - 1), healthWith(false));
    expect(r.sufficient).toBe(false);
    expect(r.actions.length).toBeGreaterThan(0);
  });

  it("blocks when a blocking precondition fails", () => {
    expect(checkInsightSufficiency(payloadWith(500), healthWith(true)).sufficient).toBe(false);
  });

  it("allows generation with enough verified activity", () => {
    expect(checkInsightSufficiency(payloadWith(50), healthWith(false)).sufficient).toBe(true);
  });
});

describe("usage limits", () => {
  const base = { weeklyCount: 0, hourlyCount: 0, businessCovered: true, inProgress: false };

  it("keeps free accounts on the preview", () => {
    const r = checkInsightAllowance({ ...base, plan: "free" });
    expect(r.allowed).toBe(false);
    if (!r.allowed) expect(r.code).toBe("plan_required");
    expect(insightLimitsFor("free").canGenerate).toBe(false);
  });

  it("enforces the weekly limit per business", () => {
    const r = checkInsightAllowance({ ...base, plan: "pro", weeklyCount: 3 });
    expect(r.allowed).toBe(false);
    if (!r.allowed) expect(r.code).toBe("weekly_limit");
  });

  it("enforces the hourly account limit", () => {
    const r = checkInsightAllowance({ ...base, plan: "pro", hourlyCount: 10 });
    expect(r.allowed).toBe(false);
    if (!r.allowed) expect(r.code).toBe("hourly_limit");
  });

  it("protects against a second in-flight generation", () => {
    const r = checkInsightAllowance({ ...base, plan: "pro", inProgress: true });
    expect(r.allowed).toBe(false);
    if (!r.allowed) expect(r.code).toBe("in_progress");
  });

  it("restricts Pro to the covered business but lets Business cover all", () => {
    const pro = checkInsightAllowance({ ...base, plan: "pro", businessCovered: false });
    expect(pro.allowed).toBe(false);
    if (!pro.allowed) expect(pro.code).toBe("business_not_covered");
    expect(insightLimitsFor("business").businessesCovered).toBe("all");
    expect(checkInsightAllowance({ ...base, plan: "business" }).allowed).toBe(true);
  });
});

describe("freshness and recorded failures", () => {
  it("treats a recorded failure as failed and old output as stale", () => {
    expect(cardStateFor({ status: "failed", generatedAt: ago(DAY) }, NOW)).toBe("failed");
    expect(cardStateFor({ status: "completed", generatedAt: ago(2 * DAY) }, NOW)).toBe("ready");
    expect(cardStateFor({ status: "completed", generatedAt: ago(8 * DAY) }, NOW)).toBe("stale");
    expect(cardStateFor({ status: "completed", generatedAt: null }, NOW)).toBe("stale");
    expect(cardStateFor(null, NOW)).toBe("not_generated");
  });
});
