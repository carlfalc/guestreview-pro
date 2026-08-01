import { describe, it, expect } from "vitest";
import {
  computeHealthScore,
  checkPreconditions,
  MIN_SCANS_FOR_ACTIVITY,
  type HealthInput,
  type ScanFact,
} from "@/lib/health-score";

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
  scansCount: 42,
  placementPlanId: "p1",
  placementPlanItemId: "i1",
  placementKey: "table",
  businessGoal: "reviews",
  campaign: "summer",
  locationId: "l1",
};

function scan(i: number, clicked: boolean): ScanFact {
  return {
    qrCodeId: "q1",
    placementPlanId: "p1",
    placementPlanItemId: "i1",
    placementKey: "table",
    businessGoal: "reviews",
    campaign: "summer",
    locationId: "l1",
    destinationClicked: clicked,
    createdAt: new Date(Date.now() - i * 1000).toISOString(),
  };
}

const base: HealthInput = {
  business,
  qrCodes: [qr],
  plans: [
    { id: "p1", status: "generated", itemCount: 4, generatedItemCount: 4, checklistTotal: 4, checklistDone: 2 },
  ],
  scans: [],
  eventDataAvailable: true,
};

describe("preconditions", () => {
  it("blocks when there is no business", () => {
    const res = checkPreconditions({ ...base, business: null });
    expect(res.find((p) => p.key === "business_exists")?.passed).toBe(false);
  });

  it("blocks when destinations do not resolve", () => {
    const res = checkPreconditions({
      ...base,
      qrCodes: [{ ...qr, destinationResolves: false }],
    });
    expect(res.find((p) => p.key === "destinations_resolve")?.passed).toBe(false);
  });

  it("treats an explicitly partial plan as non-blocking", () => {
    const res = checkPreconditions({
      ...base,
      plans: [{ ...base.plans[0], status: "partially_generated", generatedItemCount: 2 }],
    });
    const p = res.find((k) => k.key === "plan_generation_complete")!;
    expect(p.passed).toBe(true);
    expect(p.blocking).toBe(false);
  });

  it("blocks when event data quality is unknown", () => {
    const res = checkPreconditions({ ...base, eventDataAvailable: false });
    expect(res.find((p) => p.key === "event_data_quality_known")?.passed).toBe(false);
  });
});

describe("low activity handling", () => {
  it("never scores a new business as failing", () => {
    const r = computeHealthScore(base);
    expect(r.overall).toBeNull();
    expect(r.headline).toBe("Not enough data yet");
    expect(r.message).not.toMatch(/fail|risk|poor/i);
    expect(r.dimensions.find((d) => d.key === "activity")?.state).toBe("insufficient_data");
  });

  it("withholds a click rate below the threshold", () => {
    const r = computeHealthScore({ ...base, scans: [scan(1, false), scan(2, false)] });
    expect(r.totals.clickRate).toBeNull();
    expect(r.overall).toBeNull();
  });

  it("does not use scans_count for conversion when events exist", () => {
    const r = computeHealthScore({ ...base, scans: [scan(1, true)] });
    expect(r.totals.scans).toBe(1);
    expect(r.totals.fallbackScansCount).toBe(0);
  });
});

describe("scoring with real activity", () => {
  const scans = Array.from({ length: MIN_SCANS_FOR_ACTIVITY + 10 }, (_, i) => scan(i, i % 2 === 0));
  const r = computeHealthScore({ ...base, scans });

  it("produces an overall score", () => {
    expect(r.overall).not.toBeNull();
    expect(r.overall!).toBeGreaterThan(0);
  });

  it("aggregates every placement dimension from events", () => {
    expect(r.byPlacement[0].key).toBe("table");
    expect(r.byGoal[0].key).toBe("reviews");
    expect(r.byCampaign[0].key).toBe("summer");
    expect(r.byLocation[0].key).toBe("l1");
    expect(r.byPlan[0].key).toBe("p1");
    expect(r.byPlanItem[0].key).toBe("i1");
    expect(r.byPlacement[0].clickRate).not.toBeNull();
  });

  it("keeps the five dimensions separate", () => {
    expect(r.dimensions.map((d) => d.key)).toEqual([
      "setup",
      "technical",
      "rollout",
      "activity",
      "clickThrough",
    ]);
  });
});
