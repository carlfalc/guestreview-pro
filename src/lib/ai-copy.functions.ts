// AI Copy Assistant server functions.
// Uses Lovable AI Gateway (no user API key). Authenticates the user, verifies
// business ownership, applies rate + monthly limits, calls the model, validates
// the structured response, screens for review-gating / incentives / fake reviews,
// and logs a generation row scoped by RLS to the caller.

import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import {
  detectSafetyIssues, summariseInput, limitsFor,
  type Alternative, type CopyResponse, type GenerateInput, type Placement,
} from "./ai-copy";

// --- Limits (temporary; wired into UI copy) --------------------------------
export const MONTHLY_LIMIT = 20;
export const HOURLY_LIMIT = 10;

// --- Provider abstraction --------------------------------------------------

const GATEWAY_URL = "https://ai.gateway.lovable.dev/v1/chat/completions";
const DEFAULT_MODEL = "openai/gpt-5.5";

const SYSTEM_PROMPT = `You write short, ethical review-request copy for local businesses.

STRICT RULES — never violate:
- NEVER write fake customer reviews or testimonials, or attribute quotes to real people.
- NEVER practice "review gating": do not tell unhappy customers to contact the business instead of reviewing, and do not ask "only happy customers" for reviews.
- NEVER offer discounts, gifts, vouchers, points, freebies, or any incentive in exchange for a review or rating.
- NEVER imply Google endorses, recommends, or partners with the business.
- NEVER fabricate star ratings or claim a review has been left.
- NEVER use phrases like "leave five stars", "help us maintain our five-star rating", "loved it? leave five stars", "happy customers only", "positive review for a reward".

PREFER neutral wording such as: "Share your experience", "Leave us a Google review", "Your feedback helps us improve", "Tell us how we did".

OUTPUT — return ONE JSON object matching exactly:
{
  "alternatives": [ { "headline": "", "supportingText": "", "ctaText": "", "footerText": "", "tone": "", "rationale": "", "characterCounts": { "headline": 0, "supportingText": 0, "ctaText": 0, "footerText": 0 } } ],
  "safety": { "reviewGatingDetected": false, "incentiveDetected": false, "fakeReviewDetected": false }
}
No prose, no markdown, no comments. characterCounts must equal the actual string lengths.`;

function buildUserPrompt(input: GenerateInput): string {
  const lim = limitsFor(input.placement);
  const p = input.preferences ?? {};
  const lines: string[] = [
    `Business: ${input.businessName} (${input.businessType})`,
    `Placement: ${input.placement}`,
    `Tone: ${input.tone}`,
    `Length preference: ${input.length}`,
    `Language: ${input.language ?? "en"}`,
    `Alternatives to return: ${input.alternativesCount ?? 3}`,
    `Recommended maximum characters — headline ${lim.headline}, supporting text ${lim.supportingText}, CTA ${lim.ctaText}, footer ${lim.footerText}. Stay within these.`,
  ];
  if (input.keyMessage) lines.push(`Key message: ${input.keyMessage}`);
  if (input.audience || p.targetAudience) lines.push(`Target audience: ${input.audience ?? p.targetAudience}`);
  if (input.businessDescription || p.businessDescription) lines.push(`About the business: ${input.businessDescription ?? p.businessDescription}`);
  if (p.localArea) lines.push(`Local area: ${p.localArea}`);
  if (p.signaturePhrase) lines.push(`Signature phrase (may reuse if it fits): ${p.signaturePhrase}`);
  if (p.preferredWords?.length) lines.push(`Preferred vocabulary: ${p.preferredWords.join(", ")}`);
  if (p.bannedWords?.length) lines.push(`Never use these words: ${p.bannedWords.join(", ")}`);
  if (input.existingWording) {
    const e = input.existingWording;
    lines.push(`Existing wording (improve, do not simply repeat):`);
    if (e.headline) lines.push(`  headline: ${e.headline}`);
    if (e.supportingText) lines.push(`  supporting: ${e.supportingText}`);
    if (e.ctaText) lines.push(`  cta: ${e.ctaText}`);
    if (e.footerText) lines.push(`  footer: ${e.footerText}`);
  }
  return lines.join("\n");
}

async function callGateway(input: GenerateInput): Promise<CopyResponse> {
  const key = process.env.LOVABLE_API_KEY;
  if (!key) throw new Error("AI service is not configured");

  const res = await fetch(GATEWAY_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${key}` },
    body: JSON.stringify({
      model: DEFAULT_MODEL,
      messages: [
        { role: "system", content: SYSTEM_PROMPT },
        { role: "user", content: buildUserPrompt(input) },
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
  try { parsed = JSON.parse(content); }
  catch { throw new Error("invalid_response_format"); }
  return validateResponse(parsed);
}

function validateResponse(v: unknown): CopyResponse {
  if (!v || typeof v !== "object") throw new Error("invalid_response_format");
  const o = v as Record<string, unknown>;
  const alt = Array.isArray(o.alternatives) ? o.alternatives : null;
  if (!alt || alt.length === 0) throw new Error("invalid_response_format");
  const alternatives: Alternative[] = alt.slice(0, 5).map((a): Alternative => {
    const x = (a ?? {}) as Record<string, unknown>;
    const s = (k: string): string => (typeof x[k] === "string" ? (x[k] as string) : "");
    const headline = s("headline"), supportingText = s("supportingText"), ctaText = s("ctaText"), footerText = s("footerText");
    return {
      headline, supportingText, ctaText, footerText,
      tone: s("tone"), rationale: s("rationale"),
      characterCounts: {
        headline: headline.length,
        supportingText: supportingText.length,
        ctaText: ctaText.length,
        footerText: footerText.length,
      },
    };
  });
  const safetyRaw = (o.safety ?? {}) as Record<string, unknown>;
  return {
    alternatives,
    safety: {
      reviewGatingDetected: !!safetyRaw.reviewGatingDetected,
      incentiveDetected: !!safetyRaw.incentiveDetected,
      fakeReviewDetected: !!safetyRaw.fakeReviewDetected,
    },
  };
}

// --- Public server functions ----------------------------------------------

export const generateMarketingCopy = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { businessId?: string | null; packId?: string | null; input: GenerateInput }) => data)
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const input = data.input;

    if (!input?.businessName || !input?.placement || !input?.tone) throw new Error("Missing required fields");
    if ((input.businessName ?? "").length > 200) throw new Error("Business name too long");
    if ((input.keyMessage ?? "").length > 600) throw new Error("Key message too long");
    if ((input.businessDescription ?? "").length > 800) throw new Error("Business description too long");

    // Ownership check (RLS also enforces this, belt-and-braces).
    if (data.businessId) {
      const { data: b, error } = await supabase.from("businesses").select("id, owner_id").eq("id", data.businessId).maybeSingle();
      if (error || !b || b.owner_id !== userId) throw new Error("Business not found");
    }

    // Rate limits (RLS ensures scope).
    const nowIso = new Date().toISOString();
    const monthStart = new Date(); monthStart.setUTCDate(1); monthStart.setUTCHours(0, 0, 0, 0);
    const hourStart = new Date(Date.now() - 60 * 60 * 1000).toISOString();

    const [{ count: monthCount }, { count: hourCount }] = await Promise.all([
      supabase.from("ai_copy_generations").select("id", { head: true, count: "exact" }).gte("created_at", monthStart.toISOString()),
      supabase.from("ai_copy_generations").select("id", { head: true, count: "exact" }).gte("created_at", hourStart),
    ]);
    if ((monthCount ?? 0) >= MONTHLY_LIMIT) throw new Error("monthly_limit_reached");
    if ((hourCount ?? 0) >= HOURLY_LIMIT) throw new Error("rate_limit_reached");

    // Call gateway with a single upstream retry on transient 5xx.
    let result: CopyResponse;
    try { result = await callGateway(input); }
    catch (e) {
      const msg = (e as Error).message;
      if (msg === "invalid_response_format") throw e;
      if (msg === "rate_limit_upstream") { await new Promise((r) => setTimeout(r, 400)); result = await callGateway(input); }
      else throw e;
    }

    // Client-side style safety pass — merge with model self-report.
    const merged = { ...result.safety };
    for (const a of result.alternatives) {
      const f = detectSafetyIssues(a);
      merged.reviewGatingDetected = merged.reviewGatingDetected || f.reviewGatingDetected;
      merged.incentiveDetected = merged.incentiveDetected || f.incentiveDetected;
      merged.fakeReviewDetected = merged.fakeReviewDetected || f.fakeReviewDetected;
    }
    result.safety = merged;

    // Log (never store the raw prompt/system text — only summary + generated output).
    const { data: row } = await supabase.from("ai_copy_generations").insert({
      owner_id: userId,
      business_id: data.businessId ?? null,
      marketing_pack_id: data.packId ?? null,
      format_id: input.formatId ?? null,
      placement: input.placement,
      tone: input.tone,
      language: input.language ?? "en",
      input_summary: summariseInput(input),
      generated_output: result as unknown as never,
    }).select("id").maybeSingle();

    return { result, generationId: row?.id ?? null, createdAt: nowIso };
  });

export const markGenerationSelection = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { generationId: string; alternativeIndex: number | null }) => d)
  .handler(async ({ data, context }) => {
    await context.supabase.from("ai_copy_generations")
      .update({ selected_alternative: data.alternativeIndex }).eq("id", data.generationId);
    return { ok: true };
  });
