import { describe, it, expect } from "vitest";
import {
  recommendPlacements,
  placementsForIndustry,
  blueprintsForIndustry,
  packFormatsFor,
  buildChecklist,
  checklistProgress,
  matchIndustry,
  defaultPlanName,
} from "@/lib/placement-recommendations";

describe("industry matching", () => {
  it("maps free-text industries onto known keys", () => {
    expect(matchIndustry("Restaurant")).toBe("restaurant");
    expect(matchIndustry("Boutique Hotel")).toBe("hotel");
    expect(matchIndustry("")).toBeNull();
  });
});

describe("recommendations", () => {
  it("returns ordered recommendations for the ticked placements", () => {
    const recs = recommendPlacements({
      industry: "restaurant",
      goals: ["reviews"],
      placementKeys: ["table", "entrance", "counter"],
    });
    expect(recs).toHaveLength(3);
    expect(recs.map((r) => r.order)).toEqual([1, 2, 3]);
    expect(recs[0].score).toBeGreaterThanOrEqual(recs[2].score);
    for (const r of recs) {
      expect(r.formatId).toBeTruthy();
      expect(r.minQrSizeMm).toBeGreaterThan(0);
      expect(r.ctaText.length).toBeGreaterThan(0);
    }
  });

  it("falls back to industry defaults when nothing is ticked", () => {
    const recs = recommendPlacements({ industry: "hotel", goals: ["reviews"], limit: 5 });
    expect(recs.length).toBeGreaterThan(0);
    expect(recs.length).toBeLessThanOrEqual(5);
  });

  it("flags placements that already have a live QR code", () => {
    const recs = recommendPlacements({
      industry: "cafe",
      goals: ["reviews"],
      placementKeys: ["counter"],
      existingPlacementKeys: ["counter"],
    });
    expect(recs[0].duplicateOfExisting).toBe(true);
  });

  it("keeps custom placements the owner typed in", () => {
    const recs = recommendPlacements({
      industry: "retail",
      goals: ["reviews"],
      placementKeys: ["custom_delivery_bag"],
      customPlacements: [{ key: "custom_delivery_bag", name: "Delivery bag" }],
    });
    const custom = recs.find((r) => r.placementKey === "custom_delivery_bag");
    expect(custom?.custom).toBe(true);
    expect(custom?.placementName).toBe("Delivery bag");
  });

  it("only offers placements valid for the industry", () => {
    for (const p of placementsForIndustry("salon")) {
      expect(p.industries).toContain("salon");
    }
  });

  it("exposes blueprints for common industries", () => {
    expect(blueprintsForIndustry("restaurant").length).toBeGreaterThan(0);
  });
});

describe("pack + checklist derivation", () => {
  const recs = recommendPlacements({
    industry: "restaurant",
    goals: ["reviews"],
    placementKeys: ["table", "entrance", "counter"],
  });

  it("de-duplicates formats for the marketing pack", () => {
    const formats = packFormatsFor(recs);
    expect(new Set(formats).size).toBe(formats.length);
  });

  it("builds a rollout checklist that starts at zero", () => {
    const items = buildChecklist(recs);
    expect(items.length).toBeGreaterThanOrEqual(recs.length);
    expect(checklistProgress(items)).toBe(0);
    const half = items.map((c, i) => ({ ...c, done: i < Math.floor(items.length / 2) }));
    expect(checklistProgress(half)).toBeGreaterThan(0);
  });

  it("names plans from the business and primary goal", () => {
    expect(defaultPlanName("Glasshouse", ["reviews"])).toContain("Glasshouse");
  });
});
