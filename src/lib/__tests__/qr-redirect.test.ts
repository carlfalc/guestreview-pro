// QR redirect regression protection.
//
// These tests lock in the two failure modes that broke printed codes before:
//   1. QR codes encoding a Lovable preview origin (login wall on scan).
//   2. Destination resolution falling back to unsafe or empty URLs.
import { describe, expect, it, afterEach, vi } from "vitest";
import { buildScanUrl, getPublicBaseUrl, PUBLIC_SITE_URL } from "../public-url";
import { isValidDestinationUrl, resolveQrDestination } from "../resolve-qr-destination";

function setHost(hostname: string, origin = `https://${hostname}`) {
  vi.stubGlobal("window", { location: { hostname, origin } });
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("scan URL never points at a login-walled origin", () => {
  it("falls back to the canonical domain on the Lovable preview host", () => {
    setHost("id-preview--b8a4e22d.lovable.app");
    expect(buildScanUrl("abc123")).toBe(`${PUBLIC_SITE_URL}/r/abc123`);
  });

  it("falls back to the canonical domain on any *.lovable.app host", () => {
    setHost("google-reviews-app.lovable.app");
    expect(getPublicBaseUrl()).toBe(PUBLIC_SITE_URL);
  });

  it("uses the canonical domain during SSR (no window)", () => {
    vi.stubGlobal("window", undefined);
    expect(buildScanUrl("xyz")).toBe(`${PUBLIC_SITE_URL}/r/xyz`);
  });

  it("keeps a real custom domain as-is", () => {
    setHost("www.guestreviewpro.com");
    expect(buildScanUrl("abc")).toBe("https://www.guestreviewpro.com/r/abc");
    setHost("googlereviewpro.com");
    expect(buildScanUrl("abc")).toBe("https://googlereviewpro.com/r/abc");
  });

  it("keeps localhost for offline testing", () => {
    setHost("localhost", "http://localhost:8080");
    expect(buildScanUrl("abc")).toBe("http://localhost:8080/r/abc");
  });

  it("returns an empty string without a short code", () => {
    setHost("www.guestreviewpro.com");
    expect(buildScanUrl(null)).toBe("");
    expect(buildScanUrl("")).toBe("");
  });
});

describe("destination resolution precedence", () => {
  it("prefers the QR destination over the business default", () => {
    expect(
      resolveQrDestination({
        destinationType: "google_review",
        destinationUrl: "https://g.page/r/qr-specific/review",
        businessGoogleReviewUrl: "https://g.page/r/business/review",
      }),
    ).toEqual({ url: "https://g.page/r/qr-specific/review", source: "qr" });
  });

  it("falls back to the business review URL", () => {
    expect(
      resolveQrDestination({
        destinationType: "google_review",
        destinationUrl: "   ",
        businessGoogleReviewUrl: "https://g.page/r/business/review",
      }),
    ).toEqual({ url: "https://g.page/r/business/review", source: "business" });
  });

  it("ignores placeholder literals stored by older rows", () => {
    for (const bad of ["null", "undefined", "none", "NULL"]) {
      expect(
        resolveQrDestination({
          destinationType: "google_review",
          destinationUrl: bad,
          businessGoogleReviewUrl: bad,
        }),
      ).toEqual({ url: null, source: null });
    }
  });

  it("never falls back to the business URL for non-review QR types", () => {
    expect(
      resolveQrDestination({
        destinationType: "custom_url",
        destinationUrl: null,
        businessGoogleReviewUrl: "https://g.page/r/business/review",
      }),
    ).toEqual({ url: null, source: null });
  });
});

describe("destination safety", () => {
  it("rejects dangerous schemes and relative paths", () => {
    for (const bad of [
      "javascript:alert(1)",
      "JavaScript:alert(1)",
      "data:text/html;base64,PHN2Zz4=",
      "vbscript:msgbox",
      "/dashboard",
      "./review",
      "../review",
      "not a url",
      "",
      null,
      undefined,
    ]) {
      expect(isValidDestinationUrl(bad as string)).toBe(false);
    }
  });

  it("accepts https URLs", () => {
    expect(isValidDestinationUrl("https://search.google.com/local/writereview?placeid=x")).toBe(true);
  });

  it("rejects plain http off localhost", () => {
    setHost("www.guestreviewpro.com");
    expect(isValidDestinationUrl("http://example.com")).toBe(false);
  });
});
