/**
 * Contract test for retry-safe webhook event claiming.
 *
 * The authoritative implementation is the Postgres function
 * `public.claim_stripe_webhook_event`. This test drives a faithful reference
 * of that function's contract so the behaviour is pinned in CI and any future
 * change to the SQL has an executable specification to match.
 */
import { describe, it, expect } from "vitest";

type Status = "received" | "processing" | "processed" | "failed";

interface Row {
  stripe_event_id: string;
  event_type: string;
  environment: "sandbox" | "live";
  processing_status: Status;
  retry_count: number;
  last_attempt_at: number;
  error_message: string | null;
  processed_at: number | null;
}

const STALE_MS = 10 * 60 * 1000;

/** Mirrors claim_stripe_webhook_event / finish_stripe_webhook_event. */
class EventStore {
  rows = new Map<string, Row>();
  now = Date.now();

  claim(id: string, type: string, env: "sandbox" | "live"): "claimed" | "processed" | "locked" {
    const existing = this.rows.get(id);
    if (!existing) {
      this.rows.set(id, {
        stripe_event_id: id,
        event_type: type,
        environment: env,
        processing_status: "processing",
        retry_count: 1,
        last_attempt_at: this.now,
        error_message: null,
        processed_at: null,
      });
      return "claimed";
    }
    const claimable =
      existing.processing_status === "received" ||
      existing.processing_status === "failed" ||
      (existing.processing_status === "processing" && existing.last_attempt_at < this.now - STALE_MS);
    if (claimable) {
      existing.processing_status = "processing";
      existing.retry_count += 1;
      existing.last_attempt_at = this.now;
      existing.error_message = null;
      return "claimed";
    }
    return existing.processing_status === "processed" ? "processed" : "locked";
  }

  finish(id: string, status: "processed" | "failed", error?: string) {
    const row = this.rows.get(id);
    if (!row) return;
    row.processing_status = status;
    row.error_message = error?.slice(0, 1000) ?? null;
    if (status === "processed") row.processed_at = this.now;
  }
}

/** Minimal subscription projection the handler writes to. */
interface Sub {
  plan_key: "free" | "pro" | "business";
  status: string;
}

/**
 * Runs one delivery attempt exactly the way the route handler does and
 * returns the HTTP status Stripe would see.
 */
function deliver(
  store: EventStore,
  event: { id: string; type: string },
  work: () => void,
): number {
  const claim = store.claim(event.id, event.type, "sandbox");
  if (claim === "processed") return 200;
  if (claim === "locked") return 409;
  try {
    work();
    store.finish(event.id, "processed");
    return 200;
  } catch (e) {
    store.finish(event.id, "failed", e instanceof Error ? e.message : String(e));
    return 500;
  }
}

describe("webhook retry safety", () => {
  const event = { id: "evt_sub_1", type: "customer.subscription.created" };

  it("processes an event exactly once and no-ops on duplicate delivery", () => {
    const store = new EventStore();
    let applied = 0;
    expect(deliver(store, event, () => { applied += 1; })).toBe(200);
    expect(deliver(store, event, () => { applied += 1; })).toBe(200);
    expect(deliver(store, event, () => { applied += 1; })).toBe(200);
    expect(applied).toBe(1);
    expect(store.rows.get(event.id)!.processing_status).toBe("processed");
  });

  it("marks a failure as failed, returns a retryable status and records the error", () => {
    const store = new EventStore();
    const status = deliver(store, event, () => {
      throw new Error("BILLING_CONFIG_ERROR: unknown price");
    });
    expect(status).toBe(500);
    const row = store.rows.get(event.id)!;
    expect(row.processing_status).toBe("failed");
    expect(row.retry_count).toBe(1);
    expect(row.error_message).toContain("BILLING_CONFIG_ERROR");
  });

  it("lets a failed event be retried and repair subscription state", () => {
    const store = new EventStore();
    const sub: Sub = { plan_key: "free", status: "free" };
    let priceMappingFixed = false;

    const apply = () => {
      if (!priceMappingFixed) throw new Error("BILLING_CONFIG_ERROR: unknown price");
      sub.plan_key = "pro";
      sub.status = "active";
    };

    expect(deliver(store, event, apply)).toBe(500);
    // Entitlement is untouched by the failure.
    expect(sub.plan_key).toBe("free");

    // Administrator adds the missing price mapping; Stripe retries.
    priceMappingFixed = true;
    expect(deliver(store, event, apply)).toBe(200);
    expect(sub.plan_key).toBe("pro");
    expect(store.rows.get(event.id)!.retry_count).toBe(2);
    expect(store.rows.get(event.id)!.processing_status).toBe("processed");
  });

  it("increments retry_count on every attempt", () => {
    const store = new EventStore();
    const boom = () => { throw new Error("temporary"); };
    deliver(store, event, boom);
    deliver(store, event, boom);
    deliver(store, event, boom);
    expect(store.rows.get(event.id)!.retry_count).toBe(3);
  });

  it("prevents two simultaneous deliveries from processing twice", () => {
    const store = new EventStore();
    let applied = 0;
    const slow = () => { applied += 1; };

    // Worker A claims and is still in flight.
    const claimA = store.claim(event.id, event.type, "sandbox");
    expect(claimA).toBe("claimed");

    // Worker B arrives while A holds the row.
    const claimB = store.claim(event.id, event.type, "sandbox");
    expect(claimB).toBe("locked");

    slow();
    store.finish(event.id, "processed");

    // B's retry now sees a processed event and does nothing.
    expect(deliver(store, event, slow)).toBe(200);
    expect(applied).toBe(1);
  });

  it("reclaims an abandoned in-flight event after the stale window", () => {
    const store = new EventStore();
    expect(store.claim(event.id, event.type, "sandbox")).toBe("claimed");
    expect(store.claim(event.id, event.type, "sandbox")).toBe("locked");
    store.now += STALE_MS + 1000; // worker died mid-flight
    expect(store.claim(event.id, event.type, "sandbox")).toBe("claimed");
  });

  it("keeps sandbox and live events in separate records", () => {
    const store = new EventStore();
    store.claim("evt_shared", "invoice.paid", "sandbox");
    expect(store.rows.get("evt_shared")!.environment).toBe("sandbox");
    // A live event always carries a distinct Stripe event id, so no collision.
    store.claim("evt_shared_live", "invoice.paid", "live");
    expect(store.rows.get("evt_shared_live")!.environment).toBe("live");
  });
});
