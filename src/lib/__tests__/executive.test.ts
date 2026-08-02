import { describe, it, expect } from "vitest";
import {
  buildEmailPreview,
  buildRecommendations,
  confidenceFor,
  friendlyDimension,
  rankPlacements,
  ratingFor,
  totalsForWindow,
  trendFor,
} from "@/lib/executive";
import { computeHealthScore, type HealthInput, type ScanFact } from "@/lib/health-score";

const business = {
  id: "b1",
  name: "Glasshouse",
  hasGoogleReviewUrl: true,
  hasLogo: true,
  hasBrandColours: true,
  hasAddress: true,
  hasWelcomeMessage: true,
};

const qr = {
  id: "q1",
  label: "Table tent",
  status: "active",
  destinationResolves: true,
  scansCount: 0,
  placementPlanId: "p1",
  placementPlanItemId: "i1",
  placementKey: "table",
  businessGoal: "reviews",
  campaign: "summer",
  locationId: "l1",
};

function scan(agoMs: number, clicked: boolean): ScanFact {
  return {
    qrCodeId: "q1",
    placementPlanId: "p1",
    placementPlanItemId: "i1",
    placementKey: "table",
    businessGoal: "reviews",
    campaign: "summer",
    locationId: "l1",
    destinationClicked: clicked,
    createdAt: new Date(Date.now() - agoMs).toISOString(),
  };
}

const base: HealthInput = {
  business,
  qrCodes: [qr],
  plans: [
    {
      id: "p1",
      status: "generated",
      itemCount: 4,
      generatedItemCount: 4,
      checklistTotal: 4,
      checklistDone: 2,
    },
  ],
  scans: [],
  eventDataAvailable: true,
};

describe("ratings and confidence", () => {
  it("never rates a business with no score", () => {
    expect(ratingFor(null)).toBeNull();
  });

  it("uses scan volume for confidence", () => {
    expect(confidenceFor(0, true)).toBe("Low");
    expect(confidenceFor(30, true)).toBe("Medium");
    expect(confidenceFor(150, true)).toBe("High");
    expect(confidenceFor(150, false)).toBe("Low");
  });
});

describe("trends", () => {
  it("reports unknown when there is no comparison", () => {
    expect(trendFor(10, null).direction).toBe("unknown");
  });

  it("detects an increase", () => {
    const t = trendFor(20, 10);
    expect(t.direction).toBe("up");
    expect(t.delta).toBe(10);
  });
});

describe("period totals", () => {
  it("windows scans and withholds a rate below the threshold", () => {
    const now = Date.now();
    const scans = [scan(1000, true), scan(20 * 86400000, true)];
    const t = totalsForWindow(scans, now - 7 * 86400000, now + 1);
    expect(t.scans).toBe(1);
    expect(t.clickRate).toBeNull();
  });
});

describe("recommendations and summary language", () => {
  const scans = Array.from({ length: 60 }, (_, i) => scan(i * 60000, i % 3 === 0));
  const health = computeHealthScore({ ...base, scans });

  it("never describes a quiet new business as failing", () => {
    const quiet = computeHealthScore(base);
    const email = buildEmailPreview({
      businessName: "Glasshouse",
      health: quiet,
      rating: ratingFor(quiet.overall),
      trend: trendFor(quiet.overall, null),
      snapshot: {
        periodDays: 7,
        current: { scans: 0, clicks: 0, clickRate: null },
        previous: { scans: 0, clicks: 0, clickRate: null },
        scanTrend: trendFor(0, null),
        clickTrend: trendFor(0, null),
        clickRateTrend: trendFor(null, null),
        bestPlacement: null,
        weakestPlacement: null,
        activePlacementPlans: 1,
        rolloutCompletion: 50,
        openRecommendations: 0,
        marketingPackCompletion: null,
        newQrCodes: 1,
        businessesMonitored: 1,
      },
      recommendations: [],
    });
    expect(email.subject).toContain("Glasshouse");
    expect(`${email.topSuccess} ${email.biggestOpportunity}`).not.toMatch(/fail|risk|poor|bad/i);
  });

  it("produces actionable recommendations with impact and effort", () => {
    const recs = buildRecommendations({ health });
    expect(recs.length).toBeGreaterThan(0);
    for (const r of recs) {
      expect(r.action.length).toBeGreaterThan(0);
      expect(["Low", "Medium", "High"]).toContain(r.impact);
      expect(["Low", "Medium", "High"]).toContain(r.effort);
    }
  });

  it("hides dismissed recommendations and respects snoozes", () => {
    const all = buildRecommendations({ health });
    const key = all[0]!.key;
    expect(
      buildRecommendations({
        health,
        actions: [{ key, action: "dismissed", snoozeUntil: null }],
      }).map((r) => r.key),
    ).not.toContain(key);
    const snoozed = buildRecommendations({
      health,
      actions: [
        { key, action: "snoozed", snoozeUntil: new Date(Date.now() + 86400000).toISOString() },
      ],
    });
    expect(snoozed.find((r) => r.key === key)?.status).toBe("snoozed");
    const expired = buildRecommendations({
      health,
      actions: [{ key, action: "snoozed", snoozeUntil: new Date(Date.now() - 1000).toISOString() }],
    });
    expect(expired.find((r) => r.key === key)?.status).toBe("open");
  });

  it("ranks the strongest placement", () => {
    const { best } = rankPlacements(health.byPlacement);
    expect(best?.key).toBe("table");
  });

  it("uses business-friendly dimension names", () => {
    const d = friendlyDimension(health.dimensions.find((x) => x.key === "clickThrough")!);
    expect(d.label).toBe("Customer Engagement");
    expect(d.whyItMatters.length).toBeGreaterThan(20);
  });
});
