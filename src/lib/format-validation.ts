// Reusable print / QR validation engine for marketing-pack formats.
// Runs deterministic geometric + content checks and, on demand, a live QR decode.

import jsQR from "jsqr";
import type { BusinessFormat } from "@/lib/qr-formats";
import { safeArea } from "@/lib/qr-formats";
import type { FormatContent } from "@/lib/format-render";
import { renderFormatSvg, svgToPng, circularSafeRadius } from "@/lib/format-render";
import type { QrDesign } from "@/lib/qr-design";

export type ValidationLevel = "pass" | "warning" | "error";
export type ValidationCategory = "qr" | "text" | "image" | "print" | "content";

export type ValidationResult = {
  id: string;
  formatId: string | null;
  category: ValidationCategory;
  level: ValidationLevel;
  title: string;
  message: string;
  suggestedFix?: string;
};

export type ValidationInput = {
  format: BusinessFormat;
  content: FormatContent;
  qrData: string;
  destinationUrl?: string | null;
  destinationType?: string | null;
  reviewUrl?: string | null;
};

/** Estimate the QR square drawn on artwork (mm for print, px for digital). */
export function qrDrawSize(format: BusinessFormat, content: FormatContent): number {
  const isFolded = format.folded === true;
  const displayH = isFolded ? format.height / 2 : format.height;
  const qrScale = clamp(content.qrScale ?? 0.45, 0.3, 0.7);
  return Math.max(
    Math.min(format.width * qrScale, displayH * qrScale),
    Math.min(format.minQrSize, Math.min(format.width, displayH) * 0.7),
  );
}

/** Distance from format centre to the QR centre (approx, matches renderer). */
function qrCentreOffset(format: BusinessFormat, content: FormatContent, qr: number): { dx: number; dy: number } {
  const displayH = (format.folded ? format.height / 2 : format.height);
  const isCircular = format.shape === "circular";
  const inset = format.medium === "print" ? 4 : 40;
  const qrAlign = content.qrAlign ?? "center";
  const dx = (qrAlign === "left" ? -(format.width / 2 - inset - qr / 2)
    : qrAlign === "right" ? (format.width / 2 - inset - qr / 2)
    : 0) + (content.qrOffsetX ?? 0) * format.width;
  const dy = (displayH * (isCircular ? 0.32 : 0.28) + qr / 2) - format.height / 2
    + (content.qrOffsetY ?? 0) * displayH;
  return { dx, dy };
}

/** Run all deterministic (non-decode) validations for a single format. */
export function runFormatValidations(input: ValidationInput): ValidationResult[] {
  const { format, content } = input;
  const out: ValidationResult[] = [];
  const isCircular = format.shape === "circular";
  const isPrint = format.medium === "print";
  const qr = qrDrawSize(format, content);

  // --- QR ---
  if (qr < format.minQrSize) {
    out.push(err("qr-min-size", format.id, "qr",
      "QR is smaller than the recommended minimum",
      `The rendered QR is ${qr.toFixed(1)} ${isPrint ? "mm" : "px"} — this format needs at least ${format.minQrSize}.`,
      "Increase QR scale in the per-format override or reduce logo size."));
  }
  if (isCircular) {
    const safeR = circularSafeRadius(format.width);
    const { dx, dy } = qrCentreOffset(format, content, qr);
    const halfDiag = (qr / 2) * Math.SQRT2;
    const dist = Math.hypot(dx, dy) + halfDiag;
    if (dist > safeR) {
      out.push(err("qr-safe-circle", format.id, "qr",
        "QR crosses the circular safe area",
        `The QR extends ${(dist - safeR).toFixed(1)} mm past the safe circle. Content near the cut may be trimmed.`,
        "Reduce QR scale or move the QR toward the centre."));
    }
    // Trim collision
    if (Math.hypot(dx, dy) + qr / 2 > format.width / 2) {
      out.push(err("qr-trim-circle", format.id, "qr",
        "QR extends past the circular trim",
        "Part of the QR would be cut off.",
        "Reduce QR scale or reset offsets to centre."));
    }
  }

  // Contrast (foreground vs background)
  const fg = content.colors?.fg;
  const bg = content.colors?.bg;
  if (fg && bg) {
    const c = contrastRatio(fg, bg);
    if (c < 3) {
      out.push(err("qr-contrast", format.id, "qr",
        "Low background/foreground contrast",
        `Contrast ratio is ${c.toFixed(2)}:1. Scanners struggle below 3:1.`,
        "Darken the text colour or lighten the background."));
    } else if (c < 4.5) {
      out.push(warn("qr-contrast-soft", format.id, "qr",
        "Contrast is borderline for small print",
        `Contrast ratio is ${c.toFixed(2)}:1 — fine on large formats but marginal on small stickers.`,
        "Increase contrast to at least 4.5:1 for reliable scans in low light."));
    }
  }

  // --- Content ---
  if (!content.headline?.trim()) out.push(err("content-headline", format.id, "content", "Missing headline", "Every pack needs a headline.", "Add a headline in the Content tab."));
  if (!content.ctaText?.trim()) out.push(err("content-cta", format.id, "content", "Missing CTA", "Call-to-action text is required.", "Add CTA text."));
  if (!input.qrData) out.push(err("content-destination", format.id, "content", "Missing QR destination", "This QR has no scan destination URL.", "Set the destination on the QR code."));
  if (input.destinationType === "review" && !input.reviewUrl) {
    out.push(err("content-review-url", format.id, "content", "Missing Google review URL", "Review QRs need a Google review URL on the business.", "Add the review URL to the business profile."));
  }

  // --- Text ---
  const headline = (content.headline ?? "").length;
  if (headline > 50) out.push(warn("text-headline-long", format.id, "text", "Headline is long", `${headline} characters — may overflow on small formats.`, "Shorten to under 40 characters."));
  const support = (content.supportText ?? "").length;
  if (support > 120) out.push(warn("text-support-long", format.id, "text", "Supporting text is long", `${support} characters — may crowd the safe area.`, "Shorten to under 100 characters."));

  // --- Print / geometry ---
  if (isPrint) {
    if (format.bleed <= 0 && !/insert|acrylic/i.test(format.material)) {
      out.push(warn("print-no-bleed", format.id, "print", "Bleed is 0", "No bleed defined — safe only if artwork is cut in-house.", "Add 3 mm bleed if printing at a commercial print shop."));
    }
    if (isCircular && !format.bleed) {
      out.push(err("print-circle-no-bleed", format.id, "print", "Circular sticker has no bleed", "Circular dies must have bleed to avoid a white edge.", "Set bleed to 3 mm."));
    }
  }

  // --- Image / logo ---
  if (content.logoUrl) {
    const logoScale = content.logoSize ?? 0.18;
    if (logoScale > 0.28) {
      out.push(warn("logo-large", format.id, "image", "Logo is large", "Large logos can crowd the QR quiet zone.", "Reduce logo size to ≤25%."));
    }
  }
  if (content.backgroundImage && content.backgroundImageOpacity !== undefined && content.backgroundImageOpacity > 0.6) {
    out.push(warn("bg-image-opaque", format.id, "image", "Background image is very opaque", "Dense background images can reduce QR scan reliability.", "Reduce background image opacity to ≤50%."));
  }

  // All-good sentinel is optional — callers filter by level.
  return out;
}

/** Live QR decode against a rendered PNG. Returns pass/error for the QR itself. */
export async function decodeQrValidation(
  format: BusinessFormat,
  content: FormatContent,
  qrDesign: QrDesign,
  qrData: string,
  logoUrl: string | null,
  brand: string,
  layoutTemplate: string,
): Promise<ValidationResult> {
  try {
    const svg = await renderFormatSvg(format, layoutTemplate as never, content, qrDesign, qrData, logoUrl, brand, { showBoundaries: false, includeBleed: false });
    const blob = await svgToPng(svg, 600, 600);
    const bitmap = await createImageBitmap(blob);
    const canvas = document.createElement("canvas");
    canvas.width = bitmap.width; canvas.height = bitmap.height;
    const ctx = canvas.getContext("2d")!;
    ctx.drawImage(bitmap, 0, 0);
    const data = ctx.getImageData(0, 0, canvas.width, canvas.height);
    const code = jsQR(data.data, data.width, data.height);
    if (code) return pass("qr-decode", format.id, "qr", "QR decodes", "Rendered QR decoded successfully.");
    return err("qr-decode", format.id, "qr", "QR could not be decoded",
      "The rendered QR failed to scan in a virtual decoder.",
      "Increase QR scale, restore quiet zone, reduce logo size, or switch to black-on-white.");
  } catch (e) {
    return err("qr-decode-fail", format.id, "qr", "QR decode failed", (e as Error).message, "Retry the render; if it persists, simplify the QR design.");
  }
}

/** Convenience: run all validations for a pack across every selected format. */
export async function runPackValidations(
  formats: BusinessFormat[],
  resolve: (f: BusinessFormat) => ValidationInput,
  qrDesign: QrDesign,
  logoUrl: string | null,
  brand: string,
  layoutTemplate: string,
  options: { decodeQr?: boolean } = {},
): Promise<ValidationResult[]> {
  const out: ValidationResult[] = [];
  for (const f of formats) {
    const input = resolve(f);
    out.push(...runFormatValidations(input));
    if (options.decodeQr) {
      out.push(await decodeQrValidation(f, input.content, qrDesign, input.qrData, logoUrl, brand, layoutTemplate));
    }
  }
  // Pack-wide checks
  if (formats.length === 0) {
    out.push(err("pack-formats", null, "content", "No formats selected", "Add at least one format.", "Pick formats in the Formats tab."));
  }
  return out;
}

/** Reduce list to a boolean "ready to print" flag. Blocking = errors. */
export function readyToPrint(results: ValidationResult[]): { ready: boolean; blocking: number; warnings: number } {
  const blocking = results.filter((r) => r.level === "error").length;
  const warnings = results.filter((r) => r.level === "warning").length;
  return { ready: blocking === 0, blocking, warnings };
}

// helpers ------------------------------------------------------------------
function pass(id: string, formatId: string | null, category: ValidationCategory, title: string, message: string): ValidationResult {
  return { id, formatId, category, level: "pass", title, message };
}
function warn(id: string, formatId: string | null, category: ValidationCategory, title: string, message: string, suggestedFix?: string): ValidationResult {
  return { id, formatId, category, level: "warning", title, message, suggestedFix };
}
function err(id: string, formatId: string | null, category: ValidationCategory, title: string, message: string, suggestedFix?: string): ValidationResult {
  return { id, formatId, category, level: "error", title, message, suggestedFix };
}
function clamp(v: number, lo: number, hi: number): number { return Math.max(lo, Math.min(hi, v)); }
function hexToRgb(hex: string): [number, number, number] | null {
  const m = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex.trim());
  if (!m) return null;
  return [parseInt(m[1], 16), parseInt(m[2], 16), parseInt(m[3], 16)];
}
function relLuminance([r, g, b]: [number, number, number]): number {
  const s = [r, g, b].map((v) => {
    const x = v / 255;
    return x <= 0.03928 ? x / 12.92 : Math.pow((x + 0.055) / 1.055, 2.4);
  });
  return 0.2126 * s[0] + 0.7152 * s[1] + 0.0722 * s[2];
}
function contrastRatio(a: string, b: string): number {
  const ra = hexToRgb(a); const rb = hexToRgb(b);
  if (!ra || !rb) return 21;
  const la = relLuminance(ra); const lb = relLuminance(rb);
  const [lo, hi] = la < lb ? [la, lb] : [lb, la];
  return (hi + 0.05) / (lo + 0.05);
}
// safeArea import silences "unused" during lint since it's re-exported for tooling.
export const _safeArea = safeArea;
