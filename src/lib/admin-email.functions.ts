// Admin email health: queue state, failures, suppressions and throttle budget.
import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import type { LooseClient } from "@/lib/loose-types";
import type { DomainStatus } from "@/lib/email-throttle";

export interface EmailHealthRow {
  id: string;
  emailType: string;
  recipient: string;
  status: string;
  attempts: number;
  error: string | null;
  createdAt: string;
}

export interface EmailHealth {
  domainStatus: DomainStatus;
  maxPerHour: number;
  maxPerDay: number;
  sentLastHour: number;
  sentLastDay: number;
  remainingToday: number;
  paused: boolean;
  byStatus: Record<string, number>;
  recentFailures: EmailHealthRow[];
  suppressions: number;
  lastSentAt: string | null;
}

async function assertAdmin(supabase: LooseClient, userId: string) {
  const { data } = await supabase.rpc("has_role", { _user_id: userId, _role: "admin" });
  if (data !== true) throw new Error("Forbidden");
}

export const loadEmailHealth = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<EmailHealth> => {
    await assertAdmin(context.supabase as unknown as LooseClient, context.userId);

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const db = supabaseAdmin as unknown as LooseClient;
    const { currentThrottleConfig, throttleCounts } = await import("@/lib/email-dispatch.server");

    const config = currentThrottleConfig();
    const counts = await throttleCounts(db);

    const statuses = ["queued", "sending", "sent", "delivered", "failed", "bounced"];
    const byStatus: Record<string, number> = {};
    await Promise.all(
      statuses.map(async (status) => {
        const { count } = await db
          .from("email_deliveries")
          .select("id", { count: "exact", head: true })
          .eq("status", status);
        byStatus[status] = typeof count === "number" ? count : 0;
      }),
    );

    const { data: failures } = await db
      .from("email_deliveries")
      .select("id, email_type, recipient_email, status, attempt_count, error_message, created_at")
      .in("status", ["failed", "bounced"])
      .order("created_at", { ascending: false })
      .limit(20);

    const { count: suppressions } = await db
      .from("email_suppressions")
      .select("id", { count: "exact", head: true });

    const { data: lastSent } = await db
      .from("email_deliveries")
      .select("sent_at")
      .not("sent_at", "is", null)
      .order("sent_at", { ascending: false })
      .limit(1);

    return {
      domainStatus: config.domainStatus,
      maxPerHour: config.maxPerHour,
      maxPerDay: config.maxPerDay,
      sentLastHour: counts.sentLastHour,
      sentLastDay: counts.sentLastDay,
      remainingToday: Math.max(0, config.maxPerDay - counts.sentLastDay),
      paused: config.paused,
      byStatus,
      suppressions: typeof suppressions === "number" ? suppressions : 0,
      lastSentAt:
        (Array.isArray(lastSent) ? (lastSent[0] as { sent_at?: string } | undefined) : undefined)
          ?.sent_at ?? null,
      recentFailures: ((failures ?? []) as Array<Record<string, unknown>>).map((row) => ({
        id: String(row.id),
        emailType: String(row.email_type ?? ""),
        recipient: String(row.recipient_email ?? ""),
        status: String(row.status ?? ""),
        attempts: Number(row.attempt_count ?? 0),
        error: (row.error_message as string | null) ?? null,
        createdAt: String(row.created_at ?? ""),
      })),
    };
  });
