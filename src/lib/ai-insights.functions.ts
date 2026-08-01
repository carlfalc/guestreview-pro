// AI Weekly Insights — server functions.
//
// The deterministic Reputation Health™ engine stays authoritative. This layer
// only narrates verified figures: it never recalculates a score, and the model
// is given a fixed payload with an explicit instruction to use nothing else.
import { createServerFn } from "@tanstack/react-start";
import { getRequest } from "@tanstack/react-start/server";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import {
  AI_DISCLAIMER,
  INSUFFICIENT_MESSAGE,
  buildInsightPayload,
  checkInsightAllowance,
  checkInsightSufficiency,
  detectInsightSafetyIssues,
  insightLimitsFor,
  validateInsightOutput,
  type InsightOutput,
  type InsightPayload,
} from "@/lib/ai-insights";
import type { PlanTierKey } from "@/lib/entitlements";

const GATEWAY_URL = "https://ai.gateway.lovable.dev/v1/chat/completions";
const DEFAULT_MODEL = "openai/gpt-5.5";
const PROVIDER = "lovable-ai";
const DAY = 24 * 60 * 60 * 1000;

const SYSTEM_PROMPT = `You are a plain-spoken business analyst writing a weekly summary for the owner of a local business that collects Google reviews with QR codes.

ABSOLUTE RULES — never break these:
- Use ONLY the figures in the supplied JSON payload. Never invent, estimate or extrapolate a number.
- NEVER mention review counts, star ratings, review text, customer sentiment, revenue, sales or competitors. You do not have that data.
- NEVER claim causation. Say "performance improved after this change", never "this caused".
- NEVER guarantee or promise a future result.
- NEVER recalculate, re-score, re-rate or contradict the supplied Reputation Health score, rating, trend or dimension states.
- When a figure is null or a state is "insufficient_data", say "not enough data yet" — never describe it as failure, risk or poor performance.
- Write for a busy non-technical owner: no jargon, no developer terms, no marketing hype. British English.
- Be honest and specific. Keep the executive summary to at most 150 words.
- Recommend at most 3 actions, drawn from the payload's outstanding recommendations wherever possible.

OUTPUT — return ONE JSON object matching exactly:
{
  "headline": "short sentence, max 100 characters",
  "executiveSummary": "2-4 short paragraphs, max 150 words total",
  "topWin": { "title": "short", "explanation": "why it matters, referencing a supplied figure" },
  "mainOpportunity": { "title": "short", "explanation": "what is holding performance back" },
  "recommendedActions": [ { "title": "short", "reason": "why", "effort": "low|medium|high", "expectedImpact": "low|medium|high" } ],
  "closingNote": "one encouraging, non-promissory sentence",
  "confidenceDisclaimer": "one sentence describing how reliable this week's data is"
}
Return JSON only.`;

/* -------------------------------------------------------------------------- */
/* Types                                                                      */
/* -------------------------------------------------------------------------- */

export interface StoredInsight {
  id: string;
  businessId: string;
  periodStart: string;
  periodEnd: string;
  status: string;
  model: string | null;
  provider: string;
  errorMessage: string | null;
  generatedAt: string | null;
  createdAt: string;
  output: InsightOutput | null;
  payload: InsightPayload | null;
  feedback: { helpful: boolean; reason: string | null; comment: string | null } | null;
}

export interface InsightAccess {
  plan: PlanTierKey;
  canGenerate: boolean;
  perBusinessPerWeek: number;
  remainingThisWeek: number;
  businessesCovered: number | "all";
}

/* -------------------------------------------------------------------------- */
/* Helpers                                                                    */
/* -------------------------------------------------------------------------- */

async function accountPlan(userId: string): Promise<PlanTierKey> {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { resolvePaymentsEnvironment, requestHost } = await import("./payments-env.server");
  let host: string | null = null;
  try {
    host = requestHost(getRequest());
  } catch {
    host = null;
  }
  const { getAccountPlan } = await import("./entitlements.server");
  return getAccountPlan(supabaseAdmin as never, userId, resolvePaymentsEnvironment(host));
}

const isUuid = (v: unknown): v is string => typeof v === "string" && /^[0-9a-f-]{36}$/i.test(v);

function rowToInsight(row: Record<string, unknown>): StoredInsight {
  let output: InsightOutput | null = null;
  try {
    output = row.generated_output ? validateInsightOutput(row.generated_output) : null;
  } catch {
    output = null;
  }
  return {
    id: String(row.id),
    businessId: String(row.business_id),
    periodStart: String(row.period_start),
    periodEnd: String(row.period_end),
    status: String(row.generation_status),
    model: (row.model as string | null) ?? null,
    provider: (row.provider as string | null) ?? PROVIDER,
    errorMessage: (row.error_message as string | null) ?? null,
    generatedAt: (row.generated_at as string | null) ?? null,
    createdAt: String(row.created_at),
    output,
    payload: (row.input_payload as InsightPayload | null) ?? null,
    feedback: null,
  };
}

async function callGateway(payload: InsightPayload): Promise<InsightOutput> {
  const key = process.env['LOVABLE_API_KEY'];
  if (!key) throw new Error("AI service is not configured");

  const res = await fetch(GATEWAY_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${key}` },
    body: JSON.stringify({
      model: DEFAULT_MODEL,
      messages: [
        { role: "system", content: SYSTEM_PROMPT },
        {
          role: "user",
          content: `Write this week's summary using ONLY the JSON below.\n\n${JSON.stringify(payload)}`,
        },
      ],
      response_format: { type: "json_object" },
    }),
  });

  if (res.status === 429) throw new Error("rate_limit_upstream");
  if (res.status === 402) throw new Error("credits_exhausted");
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`AI provider error (${res.status}): ${text.slice(0, 200)}`);
  }
  const raw = await res.json();
  const content: string = raw?.choices?.[0]?.message?.content ?? "";
  let parsed: unknown;
  try {
    parsed = JSON.parse(content);
  } catch {
    throw new Error("invalid_response_format");
  }
  return validateInsightOutput(parsed);
}

function friendlyError(message: string): string {
  if (message === "rate_limit_upstream")
    return "The AI service is busy right now. Please try again in a minute.";
  if (message === "credits_exhausted")
    return "AI capacity has run out for now. Please try again later.";
  if (message === "invalid_response_format" || message.startsWith("unsafe:"))
    return "The summary couldn't be produced reliably this time. Please try again.";
  return "We couldn't generate your summary just now. Please try again.";
}

/* -------------------------------------------------------------------------- */
/* Read                                                                       */
/* -------------------------------------------------------------------------- */

export const getInsightAccess = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data?: { businessId?: string }) => ({
    businessId: isUuid(data?.businessId) ? data!.businessId! : null,
  }))
  .handler(async ({ data, context }): Promise<InsightAccess> => {
    const { supabase, userId } = context;
    const plan = await accountPlan(userId);
    const limits = insightLimitsFor(plan);

    let used = 0;
    if (data.businessId) {
      const { count } = await supabase
        .from("weekly_ai_insights")
        .select("id", { head: true, count: "exact" })
        .eq("owner_id", userId)
        .eq("business_id", data.businessId)
        .gte("created_at", new Date(Date.now() - 7 * DAY).toISOString());
      used = count ?? 0;
    }
    return {
      plan,
      canGenerate: limits.canGenerate,
      perBusinessPerWeek: limits.perBusinessPerWeek,
      remainingThisWeek: Math.max(0, limits.perBusinessPerWeek - used),
      businessesCovered: limits.businessesCovered,
    };
  });

export const listWeeklyInsights = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data?: { businessId?: string; limit?: number }) => ({
    businessId: isUuid(data?.businessId) ? data!.businessId! : null,
    limit: Math.min(Math.max(Number(data?.limit ?? 8) || 8, 1), 20),
  }))
  .handler(async ({ data, context }): Promise<StoredInsight[]> => {
    const { supabase, userId } = context;
    if (!data.businessId) return [];

    const { data: rows, error } = await supabase
      .from("weekly_ai_insights")
      .select("*")
      .eq("owner_id", userId)
      .eq("business_id", data.businessId)
      .order("created_at", { ascending: false })
      .limit(data.limit);
    if (error) throw new Error(error.message);

    const insights = (rows ?? []).map((r) => rowToInsight(r as Record<string, unknown>));
    if (insights.length === 0) return insights;

    const { data: feedbackRows } = await supabase
      .from("weekly_ai_insight_feedback")
      .select("insight_id, helpful, reason, comment")
      .eq("owner_id", userId)
      .in(
        "insight_id",
        insights.map((i) => i.id),
      );
    const byId = new Map(
      (feedbackRows ?? []).map((f) => [
        String((f as Record<string, unknown>).insight_id),
        {
          helpful: Boolean((f as Record<string, unknown>).helpful),
          reason: ((f as Record<string, unknown>).reason as string | null) ?? null,
          comment: ((f as Record<string, unknown>).comment as string | null) ?? null,
        },
      ]),
    );
    for (const i of insights) i.feedback = byId.get(i.id) ?? null;
    return insights;
  });

/* -------------------------------------------------------------------------- */
/* Generate                                                                   */
/* -------------------------------------------------------------------------- */

export const generateWeeklyInsight = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { businessId: string; periodDays?: number }) => {
    if (!isUuid(data?.businessId)) throw new Error("Invalid business");
    const days = Number(data?.periodDays ?? 7);
    return { businessId: data.businessId, periodDays: [7, 30, 90].includes(days) ? days : 7 };
  })
  .handler(
    async ({
      data,
      context,
    }): Promise<
      | { ok: true; insight: StoredInsight }
      | { ok: false; code: string; message: string; actions?: string[] }
    > => {
      const { supabase, userId } = context;

      // Ownership.
      const { data: business } = await supabase
        .from("businesses")
        .select("id, name, industry, created_at")
        .eq("owner_id", userId)
        .eq("id", data.businessId)
        .maybeSingle();
      if (!business) throw new Error("Business not found");

      const plan = await accountPlan(userId);
      const limits = insightLimitsFor(plan);

      // Plan coverage: single-business plans cover the earliest business only.
      let businessCovered = true;
      if (limits.canGenerate && limits.businessesCovered !== "all") {
        const { data: firstRows } = await supabase
          .from("businesses")
          .select("id")
          .eq("owner_id", userId)
          .eq("status", "active")
          .order("created_at", { ascending: true })
          .limit(1);
        const primary = (firstRows ?? [])[0]?.id as string | undefined;
        businessCovered = !primary || primary === data.businessId;
      }

      const weekAgo = new Date(Date.now() - 7 * DAY).toISOString();
      const hourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString();
      const [{ count: weeklyCount }, { count: hourlyCount }, { count: inFlight }] =
        await Promise.all([
          supabase
            .from("weekly_ai_insights")
            .select("id", { head: true, count: "exact" })
            .eq("owner_id", userId)
            .eq("business_id", data.businessId)
            .gte("created_at", weekAgo),
          supabase
            .from("weekly_ai_insights")
            .select("id", { head: true, count: "exact" })
            .eq("owner_id", userId)
            .gte("created_at", hourAgo),
          supabase
            .from("weekly_ai_insights")
            .select("id", { head: true, count: "exact" })
            .eq("business_id", data.businessId)
            .in("generation_status", ["pending", "generating"]),
        ]);

      const allowance = checkInsightAllowance({
        plan,
        weeklyCount: weeklyCount ?? 0,
        hourlyCount: hourlyCount ?? 0,
        businessCovered,
        inProgress: (inFlight ?? 0) > 0,
      });
      if (!allowance.allowed) {
        return { ok: false, code: allowance.code, message: allowance.message };
      }

      // Verified facts — same builder the dashboard uses.
      const { buildExecutiveOverview } = await import("@/lib/executive.server");
      const overview = await buildExecutiveOverview({
        supabase,
        userId,
        businessId: data.businessId,
        periodDays: data.periodDays,
      });

      const periodEnd = new Date();
      const periodStart = new Date(periodEnd.getTime() - data.periodDays * DAY);
      const previousScore =
        overview.trend.delta !== null && overview.health.overall !== null
          ? overview.health.overall - overview.trend.delta
          : null;

      const payload = buildInsightPayload({
        businessName: business.name as string,
        industry: (business.industry as string | null) ?? null,
        periodStart: periodStart.toISOString(),
        periodEnd: periodEnd.toISOString(),
        periodDays: data.periodDays,
        health: overview.health,
        previousScore,
        trend: overview.trend,
        rating: overview.rating,
        confidence: overview.confidence,
        snapshot: overview.snapshot,
        recommendations: overview.recommendations,
      });

      const sufficiency = checkInsightSufficiency(payload, overview.health);

      const baseRow = {
        owner_id: userId,
        business_id: data.businessId,
        period_start: periodStart.toISOString(),
        period_end: periodEnd.toISOString(),
        input_payload: payload as unknown as Record<string, unknown>,
        provider: PROVIDER,
        model: DEFAULT_MODEL,
      };

      if (!sufficiency.sufficient) {
        await supabase.from("weekly_ai_insights").insert({
          ...baseRow,
          generation_status: "insufficient_data",
          error_message: sufficiency.message,
          generated_at: new Date().toISOString(),
        });
        return {
          ok: false,
          code: "insufficient_data",
          message: sufficiency.message,
          actions: sufficiency.actions,
        };
      }

      // Claim the in-flight slot so a second click can't double-spend.
      const { data: claimed, error: claimError } = await supabase
        .from("weekly_ai_insights")
        .insert({ ...baseRow, generation_status: "generating" })
        .select("*")
        .single();
      if (claimError || !claimed) {
        return {
          ok: false,
          code: "in_progress",
          message: "An insight is already being generated for this business. Give it a moment.",
        };
      }
      const insightId = String((claimed as Record<string, unknown>).id);

      try {
        const output = await callGateway(payload);
        const issues = detectInsightSafetyIssues(output);
        if (issues.length > 0) throw new Error(`unsafe:${issues.join(",")}`);

        const { data: done, error } = await supabase
          .from("weekly_ai_insights")
          .update({
            generated_output: output as unknown as Record<string, unknown>,
            generation_status: "completed",
            generated_at: new Date().toISOString(),
            error_message: null,
          })
          .eq("id", insightId)
          .select("*")
          .single();
        if (error) throw new Error(error.message);
        return { ok: true, insight: rowToInsight(done as Record<string, unknown>) };
      } catch (err) {
        const message = err instanceof Error ? err.message : "unknown";
        await supabase
          .from("weekly_ai_insights")
          .update({
            generation_status: "failed",
            error_message: friendlyError(message),
            generated_at: new Date().toISOString(),
          })
          .eq("id", insightId);
        return { ok: false, code: "generation_failed", message: friendlyError(message) };
      }
    },
  );

/* -------------------------------------------------------------------------- */
/* Feedback and deletion                                                      */
/* -------------------------------------------------------------------------- */

export const submitInsightFeedback = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { insightId: string; helpful: boolean; reason?: string; comment?: string }) => {
    if (!isUuid(data?.insightId)) throw new Error("Invalid insight");
    const allowed = ["too_generic", "incorrect_emphasis", "missing_context", "too_long", "other"];
    const reason = typeof data.reason === "string" && allowed.includes(data.reason) ? data.reason : null;
    return {
      insightId: data.insightId,
      helpful: Boolean(data.helpful),
      reason,
      comment: typeof data.comment === "string" ? data.comment.trim().slice(0, 1000) : null,
    };
  })
  .handler(async ({ data, context }): Promise<{ ok: true }> => {
    const { supabase, userId } = context;
    const { error } = await supabase.from("weekly_ai_insight_feedback").upsert(
      {
        insight_id: data.insightId,
        owner_id: userId,
        helpful: data.helpful,
        reason: data.reason,
        comment: data.comment,
      },
      { onConflict: "insight_id,owner_id" },
    );
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const deleteWeeklyInsight = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { insightId: string }) => {
    if (!isUuid(data?.insightId)) throw new Error("Invalid insight");
    return { insightId: data.insightId };
  })
  .handler(async ({ data, context }): Promise<{ ok: true }> => {
    const { supabase, userId } = context;
    const { error } = await supabase
      .from("weekly_ai_insights")
      .delete()
      .eq("id", data.insightId)
      .eq("owner_id", userId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export { AI_DISCLAIMER, INSUFFICIENT_MESSAGE };
