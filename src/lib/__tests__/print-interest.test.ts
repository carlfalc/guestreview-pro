import { describe, expect, it } from "vitest";
import {
  PRINT_INTEREST_PRODUCTS,
  PRINT_INTEREST_SOURCES,
  demandThresholds,
  isPrintInterestSource,
  normalisePrintInterestSource,
  printInterestCsv,
  summarisePrintDemand,
} from "../print-interest";

const rows = [
  {
    id: "1",
    owner_id: "a",
    email: "a@example.com",
    country_code: "GB",
    products: ["circular_sticker", "counter_card"],
    quantity_band: "50_99",
    materials: ["vinyl"],
    source: "marketing_pack",
    status: "new",
    notes: null,
    created_at: "2026-01-01T00:00:00.000Z",
  },
  {
    id: "2",
    owner_id: "b",
    email: "b@example.com",
    country_code: "US",
    products: ["circular_sticker"],
    quantity_band: "10_49",
    materials: [],
    source: "dashboard",
    status: "contacted",
    notes: "Wants gloss",
    created_at: "2026-01-02T00:00:00.000Z",
  },
];

describe("print interest sources", () => {
  it("accepts every catalogued source", () => {
    for (const s of PRINT_INTEREST_SOURCES) expect(isPrintInterestSource(s)).toBe(true);
  });

  it("falls back to unknown for junk", () => {
    expect(normalisePrintInterestSource("nope")).toBe("unknown");
    expect(normalisePrintInterestSource(undefined)).toBe("unknown");
  });
});

describe("summarisePrintDemand", () => {
  it("counts signups, products and countries", () => {
    const s = summarisePrintDemand(rows as never);
    expect(s.total).toBe(2);
    const sticker = s.products.find((p) => p.key === "circular_sticker");
    expect(sticker?.count).toBe(2);
    expect(s.countries.find((c) => c.code === "GB")?.count).toBe(1);
  });

  it("returns an empty, non-throwing shape with no rows", () => {
    const s = summarisePrintDemand([]);
    expect(s.total).toBe(0);
    expect(s.products.every((p) => p.count === 0)).toBe(true);
  });

  it("only reports products from the known catalogue", () => {
    const keys = new Set(PRINT_INTEREST_PRODUCTS.map((p) => p.key));
    for (const p of summarisePrintDemand(rows as never).products) expect(keys.has(p.key)).toBe(true);
  });
});

describe("demandThresholds", () => {
  it("does not recommend building at low demand", () => {
    expect(demandThresholds(3).shouldBuild).toBe(false);
  });

  it("recommends building once demand is proven", () => {
    expect(demandThresholds(500).shouldBuild).toBe(true);
  });
});

describe("printInterestCsv", () => {
  it("emits a header row plus one row per record", () => {
    const lines = printInterestCsv(rows as never).trim().split("\n");
    expect(lines).toHaveLength(3);
    expect(lines[0]).toContain("email");
  });

  it("escapes values containing separators", () => {
    const csv = printInterestCsv([
      { ...rows[0], notes: 'a,b "quoted"' },
    ] as never);
    expect(csv).toContain('"');
  });
});
