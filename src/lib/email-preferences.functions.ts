// Email preference + delivery-history server functions.
// All reads and writes are scoped to the signed-in account by RLS.
import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import {
  COMMON_TIMEZONES,
  formatLocalTime,
  isSupportedTimezone,
  maskEmail,
  parseLocalTime,
} from "@/lib/email-schedule";
import { allowedBusinessIds, emailEntitlementsFor } from "@/lib/email-entitlements";
import type { EmailEntitlements } from "@/lib/email-entitlements";
import type { PlanTierKey } from "@/lib/entitlements";
import type { DomainStatus } from "@/lib/email-throttle";
import type { LooseClient } from "@/lib/loose-types";

export interface EmailPreferencesRow {
  weeklyReportEnabled: boolean;
  weekday: number;
  localTime: string;
  timezone: string;
  businessIds: string[];
  productUpdatesEnabled: boolean;
  portfolioDigestEnabled: boolean;
  portfolioWeekday: number;
  portfolioLocalTime: string;
  portfolioBusinessIds: string[];
  reportFormat: "full" | "summary";
  unsubscribedAt: string | null;
  productUpdatesConsentAt: string | null;
}

export interface EmailSettings {
  plan: PlanTierKey;
  entitlements: EmailEntitlements;
  preferences: EmailPreferencesRow;
  businesses: Array<{ id: string; name: string }>;
  email: string | null;
  emailConfirmed: boolean;
  timezones: string[];
  suppressed: boolean;
  domainStatus: DomainStatus;
  domainMessage: string | null;
}

export const DEFAULT_PREFERENCES: EmailPreferencesRow = {
  weeklyReportEnabled: true,
  weekday: 1,
  localTime: "08:00",
  timezone: "UTC",
  businessIds: [],
  productUpdatesEnabled: false,
  portfolioDigestEnabled: false,
  portfolioWeekday: 1,
  portfolioLocalTime: "09:00",
  portfolioBusinessIds: [],
  reportFormat: "full",
  unsubscribedAt: null,
  productUpdatesConsentAt: null,
};

function rowToPreferences(row: Record<string, unknown> | null): EmailPreferencesRow {
  if (!row) return { ...DEFAULT_PREFERENCES };
  const ids = Array.isArray(row.business_ids) ? (row.business_ids as unknown[]) : [];
  return {
    weeklyReportEnabled: Boolean(row.weekly_report_enabled),
    weekday: Number(row.weekday ?? 1),
    localTime: formatLocalTime(parseLocalTime(String(row.local_time ?? "08:00"))),
    timezone: String(row.timezone ?? "UTC"),
    businessIds: ids.filter((v): v is string => typeof v === "string"),
    productUpdatesEnabled: Boolean(row.product_updates_enabled),
    portfolioDigestEnabled: Boolean(row.portfolio_digest_enabled),
    portfolioWeekday: Number(row.portfolio_weekday ?? row.weekday ?? 1),
    portfolioLocalTime: formatLocalTime(
      parseLocalTime(String(row.portfolio_local_time ?? row.local_time ?? "09:00")),
    ),
    portfolioBusinessIds: (Array.isArray(row.portfolio_business_ids)
      ? (row.portfolio_business_ids as unknown[])
      : []
    ).filter((v): v is string => typeof v === "string"),
    reportFormat: row.report_format === "summary" ? "summary" : "full",
    unsubscribedAt: (row.unsubscribed_at as string | null) ?? null,
    productUpdatesConsentAt: (row.product_updates_consent_at as string | null) ?? null,
  };
}

/** Load everything the /settings/email page needs. */
export const loadEmailSettings = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<EmailSettings> => {
    const supabase = context.supabase as unknown as LooseClient;
    const userId = context.userId;
    const { accountPlanFor } = await import("@/lib/email-plan.server");
    const plan = await accountPlanFor(userId);

    const [{ data: prefRow }, { data: businessRows }] = await Promise.all([
      supabase.from("email_preferences").select("*").eq("owner_id", userId).maybeSingle(),
      supabase
        .from("businesses")
        .select("id, name")
        .eq("owner_id", userId)
        .eq("status", "active")
        .order("created_at", { ascending: true }),
    ]);

    const businesses = ((businessRows ?? []) as Array<{ id: string; name: string }>).map((b) => ({
      id: b.id,
      name: b.name,
    }));
    const preferences = rowToPreferences(prefRow as Record<string, unknown> | null);
    if (preferences.businessIds.length === 0 && businesses[0]) {
      preferences.businessIds = [businesses[0].id];
    }

    const { domainStatusFrom } = await import("@/lib/email-throttle");
    const domainStatus = domainStatusFrom(process.env["EMAIL_DOMAIN_STATUS"]);

    const claims = context.claims as Record<string, unknown> | undefined;
    const email = typeof claims?.email === "string" ? claims.email : null;

    let suppressed = false;
    if (email) {
      const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
      const { data } = await (supabaseAdmin as unknown as LooseClient)
        .from("email_suppressions")
        .select("email")
        .eq("email", email.toLowerCase())
        .limit(1);
      suppressed = Array.isArray(data) && data.length > 0;
    }

    return {
      plan,
      entitlements: emailEntitlementsFor(plan),
      preferences,
      businesses,
      email,
      emailConfirmed: Boolean(
        (claims as { email_verified?: boolean } | undefined)?.email_verified ?? true,
      ),
      timezones: [...COMMON_TIMEZONES],
      suppressed,
      domainStatus,
      domainMessage:
        domainStatus === "active" ? null : "Email delivery is waiting for DNS verification.",
    };
  });

export interface SavePreferencesInput {
  weeklyReportEnabled: boolean;
  weekday: number;
  localTime: string;
  timezone: string;
  businessIds: string[];
  productUpdatesEnabled: boolean;
  portfolioDigestEnabled: boolean;
  portfolioWeekday?: number;
  portfolioLocalTime?: string;
  portfolioBusinessIds?: string[];
  reportFormat: string;
}

/** Save email preferences. Plan limits are enforced here, never in the browser. */
export const saveEmailPreferences = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: SavePreferencesInput) => {
    const weekday = Number(data?.weekday);
    if (!Number.isInteger(weekday) || weekday < 0 || weekday > 6) {
      throw new Error("Choose a valid delivery day.");
    }
    const timezone = String(data?.timezone ?? "UTC");
    if (!isSupportedTimezone(timezone)) throw new Error("Choose a supported timezone.");
    const localTime = formatLocalTime(parseLocalTime(String(data?.localTime ?? "08:00")));
    const businessIds = Array.isArray(data?.businessIds)
      ? data.businessIds.filter((v) => typeof v === "string").slice(0, 20)
      : [];
    return {
      weeklyReportEnabled: Boolean(data?.weeklyReportEnabled),
      weekday,
      localTime,
      timezone,
      businessIds,
      productUpdatesEnabled: Boolean(data?.productUpdatesEnabled),
      portfolioDigestEnabled: Boolean(data?.portfolioDigestEnabled),
      portfolioWeekday: Number.isInteger(Number(data?.portfolioWeekday))
        ? Math.min(6, Math.max(0, Number(data?.portfolioWeekday)))
        : weekday,
      portfolioLocalTime: formatLocalTime(
        parseLocalTime(String(data?.portfolioLocalTime ?? "09:00")),
      ),
      portfolioBusinessIds: Array.isArray(data?.portfolioBusinessIds)
        ? data.portfolioBusinessIds.filter((v) => typeof v === "string").slice(0, 20)
        : [],
      reportFormat: data?.reportFormat === "summary" ? "summary" : "full",
    };
  })
  .handler(async ({ data, context }): Promise<{ ok: true; preferences: EmailPreferencesRow }> => {
    const supabase = context.supabase as unknown as LooseClient;
    const userId = context.userId;
    const { accountPlanFor } = await import("@/lib/email-plan.server");
    const plan = await accountPlanFor(userId);
    const ent = emailEntitlementsFor(plan);

    // Only businesses the caller actually owns, capped by plan.
    const { data: ownedRows } = await supabase
      .from("businesses")
      .select("id")
      .eq("owner_id", userId)
      .eq("status", "active");
    const owned = new Set(((ownedRows ?? []) as Array<{ id: string }>).map((b) => b.id));
    const businessIds = allowedBusinessIds(
      plan,
      data.businessIds.filter((id) => owned.has(id)),
    );

    const { data: existing } = await supabase
      .from("email_preferences")
      .select("product_updates_enabled, product_updates_consent_at")
      .eq("owner_id", userId)
      .maybeSingle();
    const previousConsent = Boolean(
      (existing as { product_updates_enabled?: boolean } | null)?.product_updates_enabled,
    );

    const payload = {
      owner_id: userId,
      weekly_report_enabled: ent.weeklyReport ? data.weeklyReportEnabled : false,
      weekday: data.weekday,
      local_time: `${data.localTime}:00`,
      timezone: data.timezone,
      business_ids: businessIds,
      product_updates_enabled: data.productUpdatesEnabled,
      product_updates_consent_at: data.productUpdatesEnabled
        ? previousConsent
          ? ((existing as { product_updates_consent_at?: string } | null)
              ?.product_updates_consent_at ?? new Date().toISOString())
          : new Date().toISOString()
        : null,
      product_updates_consent_source: data.productUpdatesEnabled ? "settings" : null,
      portfolio_digest_enabled: ent.portfolioDigest ? data.portfolioDigestEnabled : false,
      portfolio_weekday: data.portfolioWeekday,
      portfolio_local_time: `${data.portfolioLocalTime}:00`,
      portfolio_business_ids: ent.portfolioDigest
        ? data.portfolioBusinessIds.filter((id) => owned.has(id)).slice(0, 10)
        : [],
      report_format: data.reportFormat,
      unsubscribed_at: null,
    };

    const { data: saved, error } = await supabase
      .from("email_preferences")
      .upsert(payload, { onConflict: "owner_id" })
      .select("*")
      .single();
    if (error) throw new Error("Could not save your email preferences.");

    return { ok: true, preferences: rowToPreferences(saved as Record<string, unknown>) };
  });

export interface DeliveryRow {
  id: string;
  emailType: string;
  recipient: string;
  subject: string;
  status: string;
  createdAt: string;
  sentAt: string | null;
  deliveredAt: string | null;
  failedAt: string | null;
  errorMessage: string | null;
}

/** Recent delivery history for the signed-in account (masked recipients). */
export const loadEmailDeliveries = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<DeliveryRow[]> => {
    const supabase = context.supabase as unknown as LooseClient;
    const { data } = await supabase
      .from("email_deliveries")
      .select(
        "id, email_type, recipient_email, subject, status, created_at, sent_at, delivered_at, failed_at, error_message",
      )
      .eq("owner_id", context.userId)
      .order("created_at", { ascending: false })
      .limit(50);

    return ((data ?? []) as Array<Record<string, unknown>>).map((row) => ({
      id: String(row.id),
      emailType: String(row.email_type),
      recipient: maskEmail(String(row.recipient_email ?? "")),
      subject: String(row.subject ?? ""),
      status: String(row.status ?? "queued"),
      createdAt: String(row.created_at),
      sentAt: (row.sent_at as string | null) ?? null,
      deliveredAt: (row.delivered_at as string | null) ?? null,
      failedAt: (row.failed_at as string | null) ?? null,
      errorMessage: (row.error_message as string | null) ?? null,
    }));
  });

/* -------------------------------------------------------------------------- */
/* Test sends — always to the signed-in user's own address                     */
/* -------------------------------------------------------------------------- */

export type TestSendResult = { ok: boolean; message: string };

/** Max test sends per account per hour, so the new domain isn't hammered. */
export const TEST_SEND_LIMIT_PER_HOUR = 3;

export const sendTestEmail = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { template: string; businessId?: string }) => ({
    template:
      data?.template === "portfolio_digest" ? "portfolio_digest" : "weekly_reputation_health",
    businessId:
      typeof data?.businessId === "string" && /^[0-9a-f-]{36}$/i.test(data.businessId)
        ? data.businessId
        : null,
  }))
  .handler(async ({ data, context }): Promise<TestSendResult> => {
    const claims = context.claims as { email?: string } | undefined;
    const email = typeof claims?.email === "string" ? claims.email : null;
    if (!email) return { ok: false, message: "Your account has no email address." };

    const { accountPlanFor } = await import("@/lib/email-plan.server");
    const plan = await accountPlanFor(context.userId);
    const ent = emailEntitlementsFor(plan);
    if (!ent.preview) {
      return { ok: false, message: "Upgrade to preview and test your report emails." };
    }
    if (data.template === "portfolio_digest" && !ent.portfolioDigest) {
      return { ok: false, message: "The portfolio digest is a Business-plan email." };
    }

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const db = supabaseAdmin as unknown as LooseClient;
    const since = new Date(Date.now() - 60 * 60 * 1000).toISOString();
    const { count } = await db
      .from("email_deliveries")
      .select("id", { count: "exact", head: true })
      .eq("owner_id", context.userId)
      .gte("created_at", since)
      .contains("metadata", { kind: "test" });
    if (typeof count === "number" && count >= TEST_SEND_LIMIT_PER_HOUR) {
      return { ok: false, message: "Test send limit reached — try again in an hour." };
    }

    const supabase = context.supabase as unknown as LooseClient;
    const { data: businessRows } = await supabase
      .from("businesses")
      .select("id")
      .eq("owner_id", context.userId)
      .eq("status", "active")
      .order("created_at", { ascending: true });
    const owned = ((businessRows ?? []) as Array<{ id: string }>).map((b) => b.id);
    if (owned.length === 0) return { ok: false, message: "Add a business first." };

    const now = new Date();
    const endDate = now.toISOString().slice(0, 10);
    const periodStart = new Date(now.getTime() - 7 * 86_400_000).toISOString().slice(0, 10);

    const jobs = await import("@/lib/email-jobs.server");
    const result =
      data.template === "portfolio_digest"
        ? await jobs.sendPortfolioDigest({
            userId: context.userId,
            email,
            businessIds: owned.slice(0, 10),
            periodStart,
            endDate,
            kind: "test",
          })
        : await jobs.sendWeeklyReport({
            userId: context.userId,
            email,
            businessId:
              data.businessId && owned.includes(data.businessId) ? data.businessId : owned[0]!,
            periodStart,
            endDate,
            kind: "test",
          });

    switch (result.status) {
      case "sent":
        return { ok: true, message: `Test email sent to ${maskEmail(email)}.` };
      case "insufficient_data":
        return { ok: false, message: "Not enough activity yet to build that email." };
      case "throttled":
        return { ok: false, message: result.reason };
      case "suppressed":
        return { ok: false, message: "Your address is suppressed, so we can't send to it." };
      default:
        return { ok: false, message: "Could not send the test email just now." };
    }
  });
