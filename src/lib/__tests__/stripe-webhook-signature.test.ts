import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { verifyWebhook, automaticTaxEnabled } from "@/lib/stripe.server";

const SECRET = "whsec_test_secret_value";

async function sign(body: string, secret: string, timestamp: number) {
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const signed = await crypto.subtle.sign(
    "HMAC",
    key,
    new TextEncoder().encode(`${timestamp}.${body}`),
  );
  return Array.from(new Uint8Array(signed))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

function req(body: string, header: string) {
  return new Request("https://app.test/api/public/payments/webhook?env=sandbox", {
    method: "POST",
    headers: { "stripe-signature": header },
    body,
  });
}

beforeEach(() => {
  vi.stubEnv("PAYMENTS_SANDBOX_WEBHOOK_SECRET", SECRET);
});
afterEach(() => vi.unstubAllEnvs());

describe("webhook signature verification", () => {
  const body = JSON.stringify({ id: "evt_1", type: "invoice.paid", data: { object: {} } });

  it("accepts a correctly signed payload", async () => {
    const t = Math.floor(Date.now() / 1000);
    const event = await verifyWebhook(req(body, `t=${t},v1=${await sign(body, SECRET, t)}`), "sandbox");
    expect(event.id).toBe("evt_1");
  });

  it("rejects a forged signature", async () => {
    const t = Math.floor(Date.now() / 1000);
    await expect(verifyWebhook(req(body, `t=${t},v1=deadbeef`), "sandbox")).rejects.toThrow(
      /Invalid webhook signature/,
    );
  });

  it("rejects a signature made with a different secret", async () => {
    const t = Math.floor(Date.now() / 1000);
    const sig = await sign(body, "whsec_other_secret", t);
    await expect(verifyWebhook(req(body, `t=${t},v1=${sig}`), "sandbox")).rejects.toThrow(
      /Invalid webhook signature/,
    );
  });

  it("rejects a tampered body", async () => {
    const t = Math.floor(Date.now() / 1000);
    const sig = await sign(body, SECRET, t);
    const tampered = JSON.stringify({ id: "evt_1", type: "invoice.paid", data: { object: { hacked: true } } });
    await expect(verifyWebhook(req(tampered, `t=${t},v1=${sig}`), "sandbox")).rejects.toThrow(
      /Invalid webhook signature/,
    );
  });

  it("rejects a replayed (stale) timestamp", async () => {
    const t = Math.floor(Date.now() / 1000) - 3600;
    const sig = await sign(body, SECRET, t);
    await expect(verifyWebhook(req(body, `t=${t},v1=${sig}`), "sandbox")).rejects.toThrow(
      /timestamp too old/,
    );
  });

  it("rejects a missing or malformed signature header", async () => {
    await expect(verifyWebhook(req(body, ""), "sandbox")).rejects.toThrow(/Missing signature/);
    await expect(verifyWebhook(req(body, "garbage"), "sandbox")).rejects.toThrow(/Invalid signature format/);
  });

  it("accepts one valid v1 among several (secret rotation)", async () => {
    const t = Math.floor(Date.now() / 1000);
    const good = await sign(body, SECRET, t);
    const event = await verifyWebhook(req(body, `t=${t},v1=abc123,v1=${good}`), "sandbox");
    expect(event.type).toBe("invoice.paid");
  });
});

describe("automatic tax", () => {
  it("is off unless explicitly enabled", () => {
    vi.stubEnv("STRIPE_AUTOMATIC_TAX_ENABLED", "");
    expect(automaticTaxEnabled()).toBe(false);
    vi.stubEnv("STRIPE_AUTOMATIC_TAX_ENABLED", "1");
    expect(automaticTaxEnabled()).toBe(false);
    vi.stubEnv("STRIPE_AUTOMATIC_TAX_ENABLED", "yes");
    expect(automaticTaxEnabled()).toBe(false);
  });
  it("is on only for the exact trusted value", () => {
    vi.stubEnv("STRIPE_AUTOMATIC_TAX_ENABLED", "true");
    expect(automaticTaxEnabled()).toBe(true);
    vi.stubEnv("STRIPE_AUTOMATIC_TAX_ENABLED", " TRUE ");
    expect(automaticTaxEnabled()).toBe(true);
  });
});
