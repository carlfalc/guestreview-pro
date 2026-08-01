import { describe, it, expect } from "vitest";
import { getAttribution } from "@/lib/attribution";
import { sanitiseEventProperties } from "@/lib/analytics";

describe("attribution capture", () => {
  it("returns an empty object outside the browser", () => {
    expect(getAttribution()).toEqual({});
  });

  it("survives the analytics property sanitiser", () => {
    const safe = sanitiseEventProperties({
      source: "google",
      medium: "cpc",
      campaign: "reviews-2026",
      referrer: "google.com",
      landing: "/resources",
      cta: "signup",
    });
    expect(safe).toEqual({
      source: "google",
      medium: "cpc",
      campaign: "reviews-2026",
      referrer: "google.com",
      landing: "/resources",
      cta: "signup",
    });
  });

  it("still drops anything that looks personal", () => {
    const safe = sanitiseEventProperties({
      email: "a@b.com",
      landing_url: "https://example.com/x",
      landing: "/pricing",
    });
    expect(safe).toEqual({ landing: "/pricing" });
  });
});
