// AI Copy Assistant — shared types, format-aware limits, safety heuristics.
// Kept client-safe so the panel, the server function, and validation share one source of truth.

import type { BusinessFormat } from "@/lib/qr-formats";

export const TONES = [
  "Professional", "Premium", "Luxury", "Friendly", "Casual",
  "Warm", "Boutique", "Modern", "Playful", "Direct", "Family-friendly",
] as const;
export type Tone = (typeof TONES)[number];

export const LENGTHS = ["Extra short", "Short", "Standard", "Detailed"] as const;
export type Length = (typeof LENGTHS)[number];

export const PLACEMENTS = [
  "Circular sticker", "Square sticker", "Counter card", "Table tent", "Poster",
  "Hotel room card", "Reception sign", "Window decal", "Email signature",
  "Website badge", "Social post",
] as const;
export type Placement = (typeof PLACEMENTS)[number];

export const BUSINESS_TYPES = [
  "Hotel", "Motel", "Restaurant", "Cafe", "Bar", "Retail",
  "Tourism", "Medical", "Beauty", "Real estate", "General business",
] as const;
export type BusinessType = (typeof BUSINESS_TYPES)[number];

/** Recommended character maxima keyed by placement. */
export type CopyLimits = { headline: number; supportingText: number; ctaText: number; footerText: number };

const LIMITS_BY_PLACEMENT: Record<Placement, CopyLimits> = {
  "Circular sticker":  { headline: 20, supportingText: 45,  ctaText: 16, footerText: 25 },
  "Square sticker":    { headline: 22, supportingText: 50,  ctaText: 16, footerText: 28 },
  "Window decal":      { headline: 26, supportingText: 60,  ctaText: 18, footerText: 32 },
  "Counter card":      { headline: 40, supportingText: 100, ctaText: 22, footerText: 50 },
  "Table tent":        { headline: 40, supportingText: 100, ctaText: 22, footerText: 50 },
  "Hotel room card":   { headline: 42, supportingText: 110, ctaText: 22, footerText: 55 },
  "Reception sign":    { headline: 50, supportingText: 140, ctaText: 26, footerText: 70 },
  "Poster":            { headline: 55, supportingText: 160, ctaText: 28, footerText: 80 },
  "Email signature":   { headline: 55, supportingText: 120, ctaText: 24, footerText: 60 },
  "Website badge":     { headline: 30, supportingText: 60,  ctaText: 18, footerText: 30 },
  "Social post":       { headline: 60, supportingText: 220, ctaText: 24, footerText: 60 },
};

/** Infer a Placement from a BusinessFormat so callers don't need to guess. */
export function placementFromFormat(f: BusinessFormat | null | undefined): Placement {
  if (!f) return "Poster";
  if (f.shape === "circular") return "Circular sticker";
  if (f.category === "sticker") return f.shape === "square" ? "Square sticker" : "Window decal";
  if (f.folded) return "Table tent";
  if (f.category === "counter") return "Counter card";
  if (f.category === "hotel") return f.id.includes("reception") ? "Reception sign" : "Hotel room card";
  if (f.category === "poster") return "Poster";
  if (f.category === "digital") {
    if (f.id.includes("email")) return "Email signature";
    if (f.id.includes("badge")) return "Website badge";
    return "Social post";
  }
  return "Poster";
}

export function limitsFor(placement: Placement): CopyLimits {
  return LIMITS_BY_PLACEMENT[placement] ?? LIMITS_BY_PLACEMENT["Poster"];
}

// ---------- Structured response shape ----------

export type Alternative = {
  headline: string;
  supportingText: string;
  ctaText: string;
  footerText: string;
  tone: string;
  rationale: string;
  characterCounts: { headline: number; supportingText: number; ctaText: number; footerText: number };
};

export type SafetyFlags = {
  reviewGatingDetected: boolean;
  incentiveDetected: boolean;
  fakeReviewDetected: boolean;
};

export type CopyResponse = {
  alternatives: Alternative[];
  safety: SafetyFlags;
};

// ---------- Client-side safety heuristics ----------
// Server enforces the same rules; these give the panel instant feedback and
// double-check the model's own flags.

const GATING_PATTERNS = [
  /only\s+(if|when)\s+you.{0,20}(happy|satisfied|loved|great)/i,
  /(happy|satisfied)\s+customers?\s+only/i,
  /if\s+you.{0,20}(loved|enjoyed).{0,30}leave/i,
  /(unhappy|dissatisfied|complaint).{0,30}(email|call|dm|contact)/i,
];
const INCENTIVE_PATTERNS = [
  /(discount|free|gift|voucher|coupon|reward|prize)\s.{0,30}(review|rating|stars)/i,
  /(review|rating)\s.{0,30}(for a|and get|to receive)\s.{0,20}(discount|free|gift|voucher)/i,
  /five\s*stars?\s*(for|and get)/i,
];
const FAKE_PATTERNS = [
  /"?[^"]{5,80}"?\s*[-–—]\s*(a\s+)?(happy|satisfied|repeat)\s+customer/i,
  /wrote\s+us\s+a\s+glowing/i,
  /google\s+recommends\s+us/i,
];

export function detectSafetyIssues(input: { headline?: string; supportingText?: string; ctaText?: string; footerText?: string }): SafetyFlags {
  const text = [input.headline, input.supportingText, input.ctaText, input.footerText].filter(Boolean).join(" \n ");
  const any = (arr: RegExp[]) => arr.some((r) => r.test(text));
  return {
    reviewGatingDetected: any(GATING_PATTERNS),
    incentiveDetected: any(INCENTIVE_PATTERNS),
    fakeReviewDetected: any(FAKE_PATTERNS),
  };
}

export function alternativeIsSafe(a: Alternative): boolean {
  const f = detectSafetyIssues(a);
  return !f.reviewGatingDetected && !f.incentiveDetected && !f.fakeReviewDetected;
}

// ---------- Prompt building ----------

export type BusinessAiPreferences = {
  defaultTone?: Tone;
  targetAudience?: string;
  preferredWords?: string[];
  bannedWords?: string[];
  businessDescription?: string;
  localArea?: string;
  signaturePhrase?: string;
  defaultLanguage?: string;
};

export type GenerateInput = {
  businessName: string;
  businessType: BusinessType;
  packType?: string;
  formatId?: string | null;
  placement: Placement;
  tone: Tone;
  length: Length;
  audience?: string;
  language?: string;
  existingWording?: { headline?: string; supportingText?: string; ctaText?: string; footerText?: string };
  keyMessage?: string;
  businessDescription?: string;
  preferences?: BusinessAiPreferences;
  alternativesCount?: number; // default 3
};

/** Compact human-readable summary stored in `ai_copy_generations.input_summary`. */
export function summariseInput(i: GenerateInput): string {
  return [
    i.businessType, i.placement, i.tone, i.length, i.language ?? "en",
    i.keyMessage ? `msg=${i.keyMessage.slice(0, 60)}` : null,
  ].filter(Boolean).join(" · ");
}
