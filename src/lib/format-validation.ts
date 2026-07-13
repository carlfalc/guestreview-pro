// Reusable print / QR validation engine for marketing-pack formats.
// Runs deterministic geometric + content checks and, on demand, a live QR decode.

import jsQR from "jsqr";
import type { BusinessFormat } from "@/lib/qr-formats";
import { safeArea } from "@/lib/qr-formats";
import type { FormatContent } from "@/lib/format-render";
import { renderFormatSvg, svgToPng, circularSafeRadius } from "@/lib/format-render";
import type { QrDesign } from "@/lib/qr-design";
import { contrastRatio as qrContrast } from "@/lib/qr-design";

export type ValidationLevel = "pass" | "warning" | "error";
export type ValidationCategory = "qr" | "text" | "image" | "print" | "content";
/** UI navigation hint — used by the panel's "Go to setting" button. */
export type ValidationTarget = "content" | "formats" | "design" | "preview" | "override" | "qr" | "business";

export type ValidationResult = {
  id: string;
  formatId: string | null;
  formatName?: string | null;
  element?: string; // "qr" | "logo" | "headline" | ...
  category: ValidationCategory;
  level: ValidationLevel;
  title: string;
  message: string;
  suggestedFix?: string;
  target?: ValidationTarget;
};

export type ValidationInput = {
  format: BusinessFormat;
  content: FormatContent;
  qrDesign: QrDesign;
  qrData: string;
  destinationUrl?: string | null;
  destinationType?: string | null;
  reviewUrl?: string | null;
};

/** Estimate rendered text width in the same coordinate system as renderFormatSvg. */
function estimateTextWidth(s: string, fontSize: number): number {
  return (s?.length ?? 0) * fontSize * 0.55;
}

/** Bounding box in absolute canvas coordinates (mm for print, px for digital). */
export type ElementBox = { key: string; label: string; x: number; y: number; w: number; h: number };

/**
 * Compute geometric bounds of every drawn element, mirroring the layout logic
 * inside renderFormatSvg. Coordinates are absolute within the total canvas
 * (including bleed offsets).
 */
export function computeElementBounds(format: BusinessFormat, content: FormatContent): ElementBox[] {
  const bleed = format.bleed;
  const offX = bleed, offY = bleed;
  const isCircular = format.shape === "circular";
  const isFolded = format.folded === true;
  const displayH = isFolded ? format.height / 2 : format.height;
  const inset = format.medium === "print" ? 4 : 40;

  // QR
  const qrScale = clamp(content.qrScale ?? 0.45, 0.3, 0.7);
  const qrSize = Math.max(
    Math.min(format.width * qrScale, displayH * qrScale),
    Math.min(format.minQrSize, Math.min(format.width, displayH) * 0.7),
  );
  const qrAlign = content.qrAlign ?? "center";
  const qrOffsetXPx = (content.qrOffsetX ?? 0) * format.width;
  const qrOffsetYPx = (content.qrOffsetY ?? 0) * displayH;
  const qrX = (qrAlign === "left" ? offX + inset
    : qrAlign === "right" ? offX + format.width - qrSize - inset
    : offX + (format.width - qrSize) / 2) + qrOffsetXPx;
  const qrY = offY + displayH * (isCircular ? 0.32 : 0.28) + qrOffsetYPx;

  const cx = offX + format.width / 2;
  const textAlign = content.textAlign ?? "center";
  const tx = textAlign === "left" ? offX + inset
    : textAlign === "right" ? offX + format.width - inset
    : cx;

  const boxes: ElementBox[] = [];
  boxes.push({ key: "qr", label: "QR code", x: qrX, y: qrY, w: qrSize, h: qrSize });

  // Logo
  if (content.logoUrl) {
    const logoScale = clamp(content.logoSize ?? 0.18, 0.08, 0.35);
    const logoSize = Math.min(format.width * logoScale, displayH * (logoScale * 0.78));
    const logoX = tx - (textAlign === "center" ? logoSize / 2 : textAlign === "right" ? logoSize : 0);
    const logoY = offY + displayH * 0.08;
    boxes.push({ key: "logo", label: "Logo", x: logoX, y: logoY, w: logoSize, h: logoSize });
  }

  // Business name
  if (content.businessName) {
    const font = Math.max(displayH * 0.045, format.medium === "print" ? 4 : 24);
    const w = estimateTextWidth(content.businessName, font);
    const y = offY + displayH * 0.22 - font;
    const x = tx - (textAlign === "center" ? w / 2 : textAlign === "right" ? w : 0);
    boxes.push({ key: "businessName", label: "Business name", x, y, w, h: font * 1.2 });
  }

  // Stars
  const starStyle = content.starStyle ?? (content.showStars === false ? "hidden" : "solid");
  const showStars = starStyle !== "hidden" && content.showStars !== false;
  const starsY = qrY + qrSize + displayH * 0.05;
  const starSize = Math.max(displayH * 0.03, format.medium === "print" ? 4 : 22);
  if (showStars) {
    const starGap = starSize * 1.2;
    const starsW = starGap * 5;
    boxes.push({ key: "stars", label: "Stars", x: cx - starsW / 2, y: starsY - starSize / 2, w: starsW, h: starSize });
  }

  // Headline
  const headlineY = starsY + (showStars ? starSize * 1.6 : 0);
  const headlineFont = Math.max(displayH * 0.055, format.medium === "print" ? 5 : 28);
  if (content.headline) {
    const w = estimateTextWidth(content.headline, headlineFont);
    const x = tx - (textAlign === "center" ? w / 2 : textAlign === "right" ? w : 0);
    boxes.push({ key: "headline", label: "Headline", x, y: headlineY - headlineFont, w, h: headlineFont * 1.2 });
  }

  // Support text
  const supportFont = Math.max(displayH * 0.028, format.medium === "print" ? 2.8 : 16);
  if (content.supportText) {
    const w = estimateTextWidth(content.supportText, supportFont);
    const y = headlineY + supportFont * 1.6 - supportFont;
    const x = tx - (textAlign === "center" ? w / 2 : textAlign === "right" ? w : 0);
    boxes.push({ key: "supportText", label: "Supporting text", x, y, w, h: supportFont * 1.2 });
  }

  // Google badge
  if (content.showGoogleBadge) {
    const gbFont = Math.max(displayH * 0.02, format.medium === "print" ? 2 : 12);
    const w = estimateTextWidth("on Google Reviews", gbFont);
    const y = headlineY + supportFont * 1.6 + gbFont * 2 - gbFont;
    const x = tx - w / 2;
    boxes.push({ key: "googleBadge", label: "Google badge", x, y, w, h: gbFont * 1.2 });
  }

  // CTA pill
  const ctaFont = Math.max(displayH * 0.032, format.medium === "print" ? 3 : 18);
  const ctaPadX = ctaFont * 1.2;
  const ctaW = estimateTextWidth(content.ctaText, ctaFont) + ctaPadX * 2;
  const ctaH = ctaFont * 2.4;
  const footerFont = Math.max(displayH * 0.022, format.medium === "print" ? 2.2 : 13);
  const footerLine = content.footerText ? footerFont * 1.8 : 0;
  const ctaY = offY + displayH - ctaH - displayH * 0.06 - footerLine;
  const ctaX = tx - (textAlign === "center" ? ctaW / 2 : textAlign === "right" ? ctaW : 0);
  if (content.ctaText) {
    boxes.push({ key: "cta", label: "CTA", x: ctaX, y: ctaY, w: ctaW, h: ctaH });
  }

  // Footer
  if (content.footerText) {
    const w = estimateTextWidth(content.footerText, footerFont);
    const y = offY + displayH - displayH * 0.03 - footerFont;
    const x = tx - (textAlign === "center" ? w / 2 : textAlign === "right" ? w : 0);
    boxes.push({ key: "footer", label: "Footer", x, y, w, h: footerFont * 1.2 });
  }

  return boxes;
}

function farthestCornerFromCentre(b: ElementBox, cx: number, cy: number): number {
  const dxs = [b.x, b.x + b.w];
  const dys = [b.y, b.y + b.h];
  let d = 0;
  for (const x of dxs) for (const y of dys) d = Math.max(d, Math.hypot(x - cx, y - cy));
  return d;
}

// --- Contrast ---------------------------------------------------------------

/** Effective QR contrast — uses actual QR colours, not artwork text. */
export function qrEffectiveContrast(design: QrDesign): { ratio: number; note: string } {
  const bg = design.transparentBg ? "#ffffff" : design.bg;
  if (design.colorMode === "gradient") {
    const c1 = qrContrast(design.fg, bg);
    const c2 = qrContrast(design.fg2, bg);
    const worst = Math.min(c1, c2);
    return { ratio: worst, note: `gradient (${c1.toFixed(2)} / ${c2.toFixed(2)})` };
  }
  return { ratio: qrContrast(design.fg, bg), note: "solid" };
}

/** Run all deterministic (non-decode) validations for a single format. */
export function runFormatValidations(input: ValidationInput): ValidationResult[] {
  const { format, content, qrDesign } = input;
  const out: ValidationResult[] = [];
  const isCircular = format.shape === "circular";
  const isPrint = format.medium === "print";
  const isFolded = format.folded === true;
  const displayH = isFolded ? format.height / 2 : format.height;
  const bleed = format.bleed;
  const cx = bleed + format.width / 2;
  const cy = bleed + displayH / 2;

  const boxes = computeElementBounds(format, content);
  const qrBox = boxes.find((b) => b.key === "qr")!;

  // --- QR size ---
  const qrDim = Math.min(qrBox.w, qrBox.h);
  if (qrDim < format.minQrSize) {
    out.push(mkErr("qr-min-size", format, "qr",
      "QR is smaller than the recommended minimum",
      `The rendered QR is ${qrDim.toFixed(1)} ${isPrint ? "mm" : "px"} — this format needs at least ${format.minQrSize}.`,
      "Increase QR scale in the per-format override or reduce logo size.",
      { element: "qr", target: "override" }));
  }

  // --- QR contrast (uses actual QR colours) ---
  const { ratio, note } = qrEffectiveContrast(qrDesign);
  if (ratio < 3) {
    out.push(mkErr("qr-contrast", format, "qr",
      "QR contrast is too low",
      `QR foreground vs background contrast is ${ratio.toFixed(2)}:1 (${note}). Scanners fail below 3:1.`,
      "Set the QR colours to black on white, or increase contrast to at least 4.5:1.",
      { element: "qr", target: "qr" }));
  } else if (ratio < 4.5) {
    out.push(mkWarn("qr-contrast-soft", format, "qr",
      "QR contrast is borderline",
      `QR contrast is ${ratio.toFixed(2)}:1 (${note}) — fine on large formats but risky on small stickers or dim lighting.`,
      "Aim for 4.5:1 or higher between QR foreground and background.",
      { element: "qr", target: "qr" }));
  }

  // --- Circular geometry ---
  if (isCircular) {
    const safeR = circularSafeRadius(format.width);
    const trimR = format.width / 2;

    for (const b of boxes) {
      const far = farthestCornerFromCentre(b, cx, cy);
      if (far > trimR) {
        out.push(mkErr(`geom-trim-${b.key}`, format, categoryForElement(b.key),
          `${b.label} crosses the trim`,
          `${b.label} extends ${(far - trimR).toFixed(1)} mm past the cut edge and will be trimmed.`,
          "Reduce size, move inward, or reset offsets.",
          { element: b.key, target: b.key === "qr" ? "override" : "override" }));
      } else if (far > safeR) {
        out.push(mkWarn(`geom-safe-${b.key}`, format, categoryForElement(b.key),
          `${b.label} crosses the circular safe area`,
          `${b.label} extends ${(far - safeR).toFixed(1)} mm past the safe circle. Content near the die-cut may look pinched.`,
          "Reduce size or move inward — keep essential artwork inside the safe circle.",
          { element: b.key, target: "override" }));
      }
    }

    // Border vs QR quiet zone
    const borderStyle = content.borderStyle ?? "none";
    if (borderStyle !== "none") {
      const strokeW = borderStyle === "thin" ? 0.4
        : borderStyle === "thick" ? 1.2
        : borderStyle === "keyline-white" || borderStyle === "keyline-black" ? 0.3
        : 0.8;
      const innerR = trimR - strokeW;
      const qrFar = farthestCornerFromCentre(qrBox, cx, cy);
      // Quiet zone ≈ 4 QR modules ≈ 10% of QR size, minimum 2mm
      const quiet = Math.max(qrDim * 0.1, 2);
      if (qrFar + quiet > innerR) {
        out.push(mkWarn("qr-border-collision", format, "qr",
          "Border collides with QR quiet zone",
          "The decorative border is inside the QR's minimum quiet zone.",
          "Reduce border thickness, remove the border, or reduce QR scale.",
          { element: "qr", target: "override" }));
      }
    }
  } else {
    // Rectangular safe area
    const sa = safeArea(format);
    const saLeft = bleed + (format.width - sa.w) / 2;
    const saTop = bleed + (format.height - sa.h) / 2;
    const saRight = saLeft + sa.w;
    const saBottom = saTop + sa.h;
    for (const b of boxes) {
      const outside = b.x < saLeft - 0.5 || b.y < saTop - 0.5 || b.x + b.w > saRight + 0.5 || b.y + b.h > saBottom + 0.5;
      if (outside) {
        const trimOut = b.x < bleed || b.y < bleed || b.x + b.w > bleed + format.width || b.y + b.h > bleed + format.height;
        if (trimOut) {
          out.push(mkErr(`geom-trim-${b.key}`, format, categoryForElement(b.key),
            `${b.label} extends past the trim`,
            `${b.label} would be cut off.`,
            "Reduce size, move inward, or reset offsets.",
            { element: b.key, target: "override" }));
        } else {
          out.push(mkWarn(`geom-safe-${b.key}`, format, categoryForElement(b.key),
            `${b.label} is outside the safe area`,
            `${b.label} sits too close to the trim edge.`,
            "Move the element inward by at least 4 mm from the trim.",
            { element: b.key, target: "override" }));
        }
      }
    }
  }

  // --- Content ---
  if (!content.headline?.trim()) out.push(mkErr("content-headline", format, "content", "Missing headline", "Every pack needs a headline.", "Add a headline in the Content tab.", { element: "headline", target: "content" }));
  if (!content.ctaText?.trim()) out.push(mkErr("content-cta", format, "content", "Missing CTA", "Call-to-action text is required.", "Add CTA text in the Content tab.", { element: "cta", target: "content" }));
  if (!input.qrData) {
    out.push(mkErr("content-shortlink", format, "content",
      "QR short-link is missing",
      "This QR has no short-link and cannot resolve when scanned.",
      "Save the QR code in the QR editor to generate a short-link.",
      { element: "qr", target: "qr" }));
  }
  if (input.destinationType === "google_review") {
    if (!input.reviewUrl?.trim()) {
      out.push(mkErr("content-review-url", format, "content",
        "Business is missing a Google review URL",
        "Google-review QRs need a Google review URL on the linked business.",
        "Add the Google review URL to the business profile.",
        { element: "qr", target: "business" }));
    }
    if (!input.destinationUrl?.trim() && !input.reviewUrl?.trim()) {
      out.push(mkErr("content-destination", format, "content",
        "QR destination URL is missing",
        "No destination is set on the QR code.",
        "Set the destination on the QR code.",
        { element: "qr", target: "qr" }));
    }
  }

  // --- Text length ---
  const headlineLen = (content.headline ?? "").length;
  if (headlineLen > 50) out.push(mkWarn("text-headline-long", format, "text", "Headline is long", `${headlineLen} characters — may overflow on small formats.`, "Shorten to under 40 characters.", { element: "headline", target: "content" }));
  const supportLen = (content.supportText ?? "").length;
  if (supportLen > 120) out.push(mkWarn("text-support-long", format, "text", "Supporting text is long", `${supportLen} characters — may crowd the safe area.`, "Shorten to under 100 characters.", { element: "supportText", target: "content" }));

  // --- Print / geometry ---
  if (isPrint) {
    if (format.bleed <= 0 && !/insert|acrylic/i.test(format.material)) {
      out.push(mkWarn("print-no-bleed", format, "print", "Bleed is 0", "No bleed defined — safe only if artwork is cut in-house.", "Add 3 mm bleed if printing at a commercial print shop."));
    }
    if (isCircular && format.bleed <= 0) {
      out.push(mkErr("print-circle-no-bleed", format, "print", "Circular sticker has no bleed", "Circular dies must have bleed to avoid a white edge.", "Set bleed to 3 mm."));
    }
  }

  // --- Image / logo ---
  if (content.logoUrl) {
    const logoScale = content.logoSize ?? 0.18;
    if (logoScale > 0.28) {
      out.push(mkWarn("logo-large", format, "image", "Logo is large", "Large logos can crowd the QR quiet zone.", "Reduce logo size to ≤25%.", { element: "logo", target: "override" }));
    }
  }
  if (content.backgroundImage && (content.backgroundImageOpacity ?? 1) > 0.6) {
    out.push(mkWarn("bg-image-opaque", format, "image", "Background image is very opaque", "Dense background images can reduce QR scan reliability.", "Reduce background image opacity to ≤50%.", { element: "background", target: "override" }));
  }

  return out;
}

function categoryForElement(key: string): ValidationCategory {
  if (key === "qr") return "qr";
  if (key === "logo" || key === "background") return "image";
  if (key === "cta") return "content";
  return "text";
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
    if (code) return mkPass("qr-decode", format, "qr", "QR decodes", "Rendered QR decoded successfully.", { element: "qr" });
    return mkErr("qr-decode", format, "qr", "QR could not be decoded",
      "The rendered QR failed to scan in a virtual decoder.",
      "Increase QR scale, restore quiet zone, reduce logo size, or switch to black-on-white.",
      { element: "qr", target: "qr" });
  } catch (e) {
    return mkErr("qr-decode-fail", format, "qr", "QR decode failed", (e as Error).message, "Retry the render; if it persists, simplify the QR design.", { element: "qr", target: "qr" });
  }
}

/** Reduce list to a boolean "ready to print" flag. Blocking = errors. */
export function readyToPrint(results: ValidationResult[]): { ready: boolean; blocking: number; warnings: number } {
  const blocking = results.filter((r) => r.level === "error").length;
  const warnings = results.filter((r) => r.level === "warning").length;
  return { ready: blocking === 0, blocking, warnings };
}

// helpers ------------------------------------------------------------------
type Extra = { element?: string; target?: ValidationTarget };
function mkPass(id: string, f: BusinessFormat | null, category: ValidationCategory, title: string, message: string, extra: Extra = {}): ValidationResult {
  return { id, formatId: f?.id ?? null, formatName: f?.name ?? null, category, level: "pass", title, message, ...extra };
}
function mkWarn(id: string, f: BusinessFormat | null, category: ValidationCategory, title: string, message: string, suggestedFix?: string, extra: Extra = {}): ValidationResult {
  return { id, formatId: f?.id ?? null, formatName: f?.name ?? null, category, level: "warning", title, message, suggestedFix, ...extra };
}
function mkErr(id: string, f: BusinessFormat | null, category: ValidationCategory, title: string, message: string, suggestedFix?: string, extra: Extra = {}): ValidationResult {
  return { id, formatId: f?.id ?? null, formatName: f?.name ?? null, category, level: "error", title, message, suggestedFix, ...extra };
}
function clamp(v: number, lo: number, hi: number): number { return Math.max(lo, Math.min(hi, v)); }

// safeArea re-export kept for tooling.
export const _safeArea = safeArea;
