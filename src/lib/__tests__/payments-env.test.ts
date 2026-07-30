import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import {
  resolvePaymentsEnvironment,
  resolveAppUrl,
  buildReturnUrl,
  isProductionHost,
  requestHost,
} from "@/lib/payments-env.server";

const ORIGINAL = { ...process.env };

beforeEach(() => {
  delete process.env.PAYMENTS_ENV;
  delete process.env.APP_URL;
  delete process.env.STRIPE_AUTOMATIC_TAX_ENABLED;
});
afterEach(() => {
  process.env = { ...ORIGINAL };
  vi.unstubAllEnvs();
});

describe("payment environment isolation", () => {
  it("uses live only for known production hosts", () => {
    expect(resolvePaymentsEnvironment("www.guestreviewpro.com")).toBe("live");
    expect(resolvePaymentsEnvironment("googlereviewpro.com")).toBe("live");
    expect(resolvePaymentsEnvironment("google-reviews-app.lovable.app")).toBe("live");
  });

  it("uses sandbox for preview, dev and localhost", () => {
    expect(resolvePaymentsEnvironment("id-preview--abc.lovable.app")).toBe("sandbox");
    expect(resolvePaymentsEnvironment("project--abc-dev.lovable.app")).toBe("sandbox");
    expect(resolvePaymentsEnvironment("localhost:8080")).toBe("sandbox");
    expect(resolvePaymentsEnvironment(null)).toBe("sandbox");
  });

  it("honours an explicit trusted PAYMENTS_ENV", () => {
    vi.stubEnv("PAYMENTS_ENV", "live");
    expect(resolvePaymentsEnvironment("localhost")).toBe("live");
    vi.stubEnv("PAYMENTS_ENV", "sandbox");
    expect(resolvePaymentsEnvironment("www.guestreviewpro.com")).toBe("sandbox");
  });

  it("ignores a junk PAYMENTS_ENV rather than trusting it", () => {
    vi.stubEnv("PAYMENTS_ENV", "LIVE-please");
    expect(resolvePaymentsEnvironment("localhost")).toBe("sandbox");
    expect(resolvePaymentsEnvironment("www.guestreviewpro.com")).toBe("live");
  });

  it("never treats a look-alike host as production", () => {
    expect(isProductionHost("guestreviewpro.com.evil.net")).toBe(false);
    expect(isProductionHost("evil.com/www.guestreviewpro.com")).toBe(false);
    expect(resolvePaymentsEnvironment("guestreviewpro.com.evil.net")).toBe("sandbox");
  });
});

describe("return URL locking", () => {
  const host = "www.guestreviewpro.com";

  it("allows only allow-listed paths", () => {
    expect(buildReturnUrl("/billing", host)).toBe("https://www.guestreviewpro.com/billing");
    expect(buildReturnUrl("/dashboard", host)).toBe("https://www.guestreviewpro.com/dashboard");
    expect(buildReturnUrl("/billing/success", host)).toBe("https://www.guestreviewpro.com/billing/success");
    expect(buildReturnUrl("/billing/cancel", host)).toBe("https://www.guestreviewpro.com/billing/cancel");
  });

  it("rejects external origins and falls back to /billing", () => {
    const attacks = [
      "https://evil.com/steal",
      "//evil.com",
      "http://evil.com",
      "https://www.guestreviewpro.com@evil.com/billing",
      "javascript:alert(1)",
      "data:text/html,<script>",
      "/billing/../../admin",
      "/billing?next=https://evil.com",
      "\\\\evil.com",
      "",
      "   ",
    ];
    for (const attack of attacks) {
      const url = buildReturnUrl(attack, host);
      expect(url).toBe("https://www.guestreviewpro.com/billing");
      expect(new URL(url).host).toBe("www.guestreviewpro.com");
    }
  });

  it("keeps the Stripe session template intact", () => {
    const url = buildReturnUrl("/billing", host, {
      checkout: "complete",
      session_id: "{CHECKOUT_SESSION_ID}",
    });
    expect(url).toBe(
      "https://www.guestreviewpro.com/billing?checkout=complete&session_id={CHECKOUT_SESSION_ID}",
    );
  });

  it("never derives the origin from a client value", () => {
    vi.stubEnv("APP_URL", "https://www.guestreviewpro.com");
    expect(buildReturnUrl("/billing", "evil.com")).toBe("https://www.guestreviewpro.com/billing");
  });

  it("ignores a non-http APP_URL", () => {
    vi.stubEnv("APP_URL", "javascript:alert(1)");
    expect(resolveAppUrl("www.guestreviewpro.com")).toBe("https://www.guestreviewpro.com");
  });
});

describe("requestHost", () => {
  it("prefers x-forwarded-host", () => {
    const req = new Request("https://internal.local/x", {
      headers: { "x-forwarded-host": "www.guestreviewpro.com, other" },
    });
    expect(requestHost(req)).toBe("www.guestreviewpro.com");
  });
  it("falls back to the URL host", () => {
    expect(requestHost(new Request("https://example.test/x"))).toBe("example.test");
  });
  it("handles a missing request", () => {
    expect(requestHost(null)).toBeNull();
  });
});
