// Server-only delivery layer: claim → send → record.
//
// Every production email goes through dispatchEmail so that idempotency,
// suppression, throttling and status recording are impossible to skip.
import type { LooseClient } from "./loose-types";
import {
  batchSize as throttleBatchSize,
  evaluateThrottle,
  throttleConfigFromEnv,
  throttleMessage,
  type ThrottleConfig,
  type ThrottleCounts,
} from "./email-throttle";
import { classifyFailure, nextAttemptAt, shouldRetry, MAX_ATTEMPTS } from "./email-schedule";
import { TEMPLATES } from "./email-templates/registry";

export type DispatchKind = "scheduled" | "triggered" | "test";

export interface DispatchInput {
  templateKey: string;
  to: string;
  ownerId?: string | null;
  businessId?: string | null;
  periodStart?: string | null;
  idempotencyKey: string;
  templateData: Record<string, unknown>;
  kind: DispatchKind;
}

export type DispatchResult =
  | { status: "sent"; deliveryId: string }
  | { status: "duplicate" }
  | { status: "suppressed" }
  | { status: "throttled"; reason: string }
  | { status: "failed"; error: string; willRetry: boolean };

async function admin(): Promise<LooseClient> {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  return supabaseAdmin as unknown as LooseClient;
}

export function currentThrottleConfig(): ThrottleConfig {
  return throttleConfigFromEnv(process.env as Record<string, string | undefined>);
}

/** Sends counted against the throttle windows (anything that left the app). */
export async function throttleCounts(db: LooseClient, now = new Date()): Promise<ThrottleCounts> {
  const hourAgo = new Date(now.getTime() - 60 * 60 * 1000).toISOString();
  const dayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000).toISOString();
  const countSince = async (since: string) => {
    const { count } = await db
      .from("email_deliveries")
      .select("id", { count: "exact", head: true })
      .in("status", ["sent", "delivered", "bounced"])
      .gte("sent_at", since);
    return typeof count === "number" ? count : 0;
  };
  const [sentLastHour, sentLastDay] = await Promise.all([countSince(hourAgo), countSince(dayAgo)]);
  return { sentLastHour, sentLastDay };
}

export async function remainingBatch(db: LooseClient, requested = 10): Promise<number> {
  return throttleBatchSize(currentThrottleConfig(), await throttleCounts(db), requested);
}

async function isSuppressed(db: LooseClient, email: string): Promise<boolean> {
  const { data } = await db
    .from("email_suppressions")
    .select("email")
    .eq("email", email.toLowerCase())
    .limit(1);
  return Array.isArray(data) && data.length > 0;
}

/**
 * Dispatch one email. The unique idempotency key is the concurrency lock: two
 * workers racing on the same report both try to insert, exactly one wins.
 */
export async function dispatchEmail(input: DispatchInput): Promise<DispatchResult> {
  const db = await admin();
  const template = TEMPLATES[input.templateKey];
  if (!template) return { status: "failed", error: "template_missing", willRetry: false };

  const recipient = input.to.trim().toLowerCase();
  const subject =
    typeof template.subject === "function"
      ? template.subject(input.templateData)
      : template.subject;

  // Validate + sanitise before anything is persisted or sent.
  let templateData: Record<string, unknown>;
  try {
    templateData = template.validate ? template.validate(input.templateData) : input.templateData;
  } catch (error) {
    return { status: "failed", error: (error as Error).message, willRetry: false };
  }

  if (await isSuppressed(db, recipient)) return { status: "suppressed" };

  // Claim: unique idempotency_key rejects duplicates and concurrent workers.
  const { data: claimed, error: claimError } = await db
    .from("email_deliveries")
    .insert({
      owner_id: input.ownerId ?? null,
      business_id: input.businessId ?? null,
      email_type: input.templateKey,
      recipient_email: recipient,
      subject,
      status: "queued",
      idempotency_key: input.idempotencyKey,
      period_start: input.periodStart ?? null,
      scheduled_for: new Date().toISOString(),
      metadata: { kind: input.kind },
    })
    .select("id, attempt_count")
    .single();

  if (claimError || !claimed) {
    // Already queued or completed by someone else — never send twice.
    const { data: existing } = await db
      .from("email_deliveries")
      .select("id, status, attempt_count")
      .eq("idempotency_key", input.idempotencyKey)
      .maybeSingle();
    const row = existing as { id: string; status: string; attempt_count: number } | null;
    if (!row) return { status: "failed", error: "claim_failed", willRetry: true };
    if (row.status !== "failed") return { status: "duplicate" };
    if (row.attempt_count >= MAX_ATTEMPTS) return { status: "duplicate" };
    return sendClaimed(db, row.id, row.attempt_count, input, templateData, recipient);
  }

  const claimRow = claimed as { id: string; attempt_count: number };
  return sendClaimed(db, claimRow.id, claimRow.attempt_count, input, templateData, recipient);
}

async function sendClaimed(
  db: LooseClient,
  deliveryId: string,
  attemptCount: number,
  input: DispatchInput,
  templateData: Record<string, unknown>,
  recipient: string,
): Promise<DispatchResult> {
  const now = new Date();
  const decision = evaluateThrottle({
    config: currentThrottleConfig(),
    counts: await throttleCounts(db, now),
    kind: input.kind,
  });

  if (!decision.allowed) {
    const message = throttleMessage(decision.reason);
    console.warn(
      `[email] throttled ${input.templateKey} → ${decision.reason} (${input.idempotencyKey})`,
    );
    await db
      .from("email_deliveries")
      .update({
        status: "queued",
        error_code: decision.reason,
        error_message: message,
        next_attempt_at: new Date(now.getTime() + 30 * 60 * 1000).toISOString(),
      })
      .eq("id", deliveryId);
    return { status: "throttled", reason: message };
  }

  const attempt = attemptCount + 1;
  await db
    .from("email_deliveries")
    .update({ status: "sending", attempt_count: attempt, next_attempt_at: null })
    .eq("id", deliveryId);

  try {
    const { sendTemplateEmail } = await import("./email-templates/send-email");
    const result = await sendTemplateEmail(input.templateKey, recipient, {
      templateData,
      idempotencyKey: input.idempotencyKey,
    });

    if (!result.sent) {
      await db
        .from("email_deliveries")
        .update({
          status: "suppressed",
          error_code: "recipient_suppressed",
          failed_at: new Date().toISOString(),
        })
        .eq("id", deliveryId);
      return { status: "suppressed" };
    }

    await db
      .from("email_deliveries")
      .update({ status: "sent", sent_at: new Date().toISOString(), error_code: null })
      .eq("id", deliveryId);
    return { status: "sent", deliveryId };
  } catch (error) {
    const err = error as { code?: string; status?: number; message?: string };
    const kind = classifyFailure(err.code, err.status);
    const retry = shouldRetry({ kind, attempt });
    const isBounce = err.code === "hard_bounce" || err.code === "invalid_recipient";
    await db
      .from("email_deliveries")
      .update({
        status: isBounce ? "bounced" : "failed",
        error_code: err.code ?? "send_failed",
        error_message: String(err.message ?? "Send failed").slice(0, 1000),
        failed_at: new Date().toISOString(),
        bounced_at: isBounce ? new Date().toISOString() : null,
        next_attempt_at: retry ? nextAttemptAt(attempt, new Date()).toISOString() : null,
      })
      .eq("id", deliveryId);
    console.error(`[email] send failed ${input.templateKey}: ${err.code ?? err.message}`);
    return { status: "failed", error: err.code ?? "send_failed", willRetry: retry };
  }
}

/** Was this exact logical email already handled? */
export async function alreadyDelivered(key: string): Promise<boolean> {
  const db = await admin();
  const { data } = await db
    .from("email_deliveries")
    .select("status")
    .eq("idempotency_key", key)
    .maybeSingle();
  const status = (data as { status?: string } | null)?.status;
  return Boolean(status && status !== "failed");
}

/** Recent send of this template to this address (guide resend protection). */
export async function sentRecently(
  templateKey: string,
  email: string,
  withinHours: number,
): Promise<boolean> {
  const db = await admin();
  const since = new Date(Date.now() - withinHours * 60 * 60 * 1000).toISOString();
  const { data } = await db
    .from("email_deliveries")
    .select("id")
    .eq("email_type", templateKey)
    .eq("recipient_email", email.trim().toLowerCase())
    .in("status", ["queued", "sending", "sent", "delivered"])
    .gte("created_at", since)
    .limit(1);
  return Array.isArray(data) && data.length > 0;
}
