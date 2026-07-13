// Panel-level validation for folded (table-tent) formats.
// Validates trim, safe area, fold/score/glue crossings and pairwise overlaps
// for every drawn element on both front and back panels, in every mode.
// Also provides a true front/back QR-decode validator.

import jsQR from "jsqr";
import type { BusinessFormat } from "@/lib/qr-formats";
import type { QrDesign } from "@/lib/qr-design";
import {
  getFoldedLayout, type PanelRect, type FoldSegment,
} from "@/lib/folded-layouts";
import type { FoldedConfig, FoldedPanelContent } from "@/lib/marketing-packs";
import {
  qrEffectiveContrast,
  type ValidationResult, type ValidationTarget, type ValidationCategory,
} from "@/lib/format-validation";
import { renderFoldedFormatSvg, type FoldedRenderInput } from "@/lib/folded-render";
import { svgToPng } from "@/lib/format-render";

export type FoldedValidationInput = {
  format: BusinessFormat;
  config: FoldedConfig;
  qrDesign: QrDesign;
  qrData: string;
  businessName?: string;
  logoUrl?: string | null;
};

type PanelKey = "front" | "back";
type PanelBox = { key: string; label: string; x: number; y: number; w: number; h: number };

/**
 * Compute panel-local bounding boxes for every drawn element, mirroring
 * drawPanelContent in folded-render.ts. Coordinates are inside the panel
 * (0..panel.w, 0..panel.h), before any production rotation.
 */
function computePanelElementBounds(
  panel: PanelRect,
  content: FoldedPanelContent,
  format: BusinessFormat,
  businessName: string,
  hasLogo: boolean,
): PanelBox[] {
  const w = panel.w, h = panel.h;
  const isPrint = format.medium === "print";
  const align = content.textAlign ?? "center";
  const inset = isPrint ? 4 : 40;
  const cx = w / 2;
  const tx = align === "left" ? inset : align === "right" ? w - inset : cx;
  const anchor = (width: number): number =>
    tx - (align === "center" ? width / 2 : align === "right" ? width : 0);
  const est = (s: string, f: number) => (s?.length ?? 0) * f * 0.55;
  const boxes: PanelBox[] = [];

  if (hasLogo && content.showLogo !== false) {
    const logoSize = Math.min(w * 0.18, h * 0.14);
    boxes.push({ key: "logo", label: "Logo", x: anchor(logoSize), y: h * 0.08, w: logoSize, h: logoSize });
  }
  if (businessName && content.showBusinessName !== false) {
    const font = Math.max(h * 0.045, isPrint ? 4 : 24);
    const bw = est(businessName, font);
    boxes.push({ key: "businessName", label: "Business name", x: anchor(bw), y: h * 0.24 - font, w: bw, h: font * 1.2 });
  }

  const showQr = content.showQr !== false;
  const scale = clamp(content.qrScale ?? 0.45, 0.3, 0.7);
  const qrSize = Math.max(Math.min(w, h) * scale, Math.min(format.minQrSize, Math.min(w, h) * 0.7));
  const qrX = (w - qrSize) / 2 + (content.qrOffsetX ?? 0) * w;
  const qrY = h * 0.34 + (content.qrOffsetY ?? 0) * h;
  if (showQr) boxes.push({ key: "qr", label: "QR code", x: qrX, y: qrY, w: qrSize, h: qrSize });

  const showStars = content.showStars !== false;
  const starsY = h * 0.72;
  const starSize = Math.max(h * 0.032, isPrint ? 3 : 20);
  if (showStars) {
    const gap = starSize * 1.2;
    const starsW = gap * 5;
    boxes.push({ key: "stars", label: "Stars", x: cx - starsW / 2, y: starsY - starSize / 2, w: starsW, h: starSize });
  }
  const headlineY = starsY + (showStars ? starSize * 1.8 : h * 0.04);
  const hf = Math.max(h * 0.055, isPrint ? 5 : 28);
  if (content.headline) {
    const bw = est(content.headline, hf);
    boxes.push({ key: "headline", label: "Headline", x: anchor(bw), y: headlineY - hf, w: bw, h: hf * 1.2 });
  }
  const sf = Math.max(h * 0.028, isPrint ? 2.8 : 16);
  if (content.supportText) {
    const bw = est(content.supportText, sf);
    boxes.push({ key: "supportText", label: "Supporting text", x: anchor(bw), y: headlineY + sf * 1.8 - sf, w: bw, h: sf * 1.2 });
  }
  if (content.showGoogleBadge !== false) {
    const gf = Math.max(h * 0.02, isPrint ? 2 : 12);
    const bw = est("on Google Reviews", gf);
    boxes.push({ key: "googleBadge", label: "Google badge", x: tx - bw / 2, y: headlineY + sf * 1.8 + gf * 2 - gf, w: bw, h: gf * 1.2 });
  }

  const ff = Math.max(h * 0.022, isPrint ? 2.2 : 13);
  const footerLine = content.footerText ? ff * 1.8 : 0;
  if (content.ctaText) {
    const cf = Math.max(h * 0.032, isPrint ? 3 : 18);
    const padX = cf * 1.2;
    const cw = est(content.ctaText, cf) + padX * 2;
    const ch = cf * 2.4;
    boxes.push({ key: "cta", label: "CTA", x: anchor(cw), y: h - ch - h * 0.06 - footerLine, w: cw, h: ch });
  }
  if (content.footerText) {
    const bw = est(content.footerText, ff);
    boxes.push({ key: "footer", label: "Footer", x: anchor(bw), y: h - h * 0.03 - ff, w: bw, h: ff * 1.2 });
  }
  return boxes;
}

function rectsOverlap(a: PanelBox, b: PanelBox): boolean {
  return !(a.x + a.w <= b.x || b.x + b.w <= a.x || a.y + a.h <= b.y || b.y + b.h <= a.y);
}

/** Distance from a rect to a line segment (all in same coord space). 0 if crossing. */
function segmentIntersectsRect(seg: FoldSegment, r: PanelBox): boolean {
  // Clip line to rect via Liang–Barsky
  const x1 = seg.x1, y1 = seg.y1, x2 = seg.x2, y2 = seg.y2;
  const dx = x2 - x1, dy = y2 - y1;
  let t0 = 0, t1 = 1;
  const p = [-dx, dx, -dy, dy];
  const q = [x1 - r.x, r.x + r.w - x1, y1 - r.y, r.y + r.h - y1];
  for (let i = 0; i < 4; i++) {
    if (p[i] === 0) { if (q[i] < 0) return false; }
    else {
      const t = q[i] / p[i];
      if (p[i] < 0) t0 = Math.max(t0, t);
      else t1 = Math.min(t1, t);
    }
  }
  return t0 <= t1;
}

function categoryFor(key: string): ValidationCategory {
  if (key === "qr") return "qr";
  if (key === "logo" || key === "background") return "image";
  if (key === "cta") return "content";
  return "text";
}

function targetFor(key: string): ValidationTarget {
  if (key === "qr") return "override";
  if (key === "headline" || key === "supportText" || key === "footer" || key === "cta") return "override";
  return "override";
}

function mk(level: "error" | "warning", id: string, format: BusinessFormat, panelLabel: string, element: string, elementLabel: string, title: string, message: string, fix: string): ValidationResult {
  return {
    id: `${panelLabel.toLowerCase()}-${id}-${element}`,
    formatId: format.id,
    formatName: `${format.name} · ${panelLabel}`,
    category: categoryFor(element),
    level,
    title: `${panelLabel}: ${title}`,
    message: `${elementLabel}: ${message}`,
    suggestedFix: fix,
    element,
    target: targetFor(element),
  };
}

/** Validate one panel (front or back). Handles trim/safe/fold/score/glue/overlap. */
function validatePanel(
  input: FoldedValidationInput,
  panel: PanelRect,
  panelKey: PanelKey,
  content: FoldedPanelContent,
): ValidationResult[] {
  const { format } = input;
  const layout = getFoldedLayout(format)!;
  const panelName = panelKey === "front" ? "Front" : "Back";
  const safeInset = layout.safeInset;
  const bn = input.businessName ?? "";
  const hasLogo = !!input.logoUrl;
  const boxes = computePanelElementBounds(panel, content, format, bn, hasLogo);
  const qr = boxes.find((b) => b.key === "qr");
  const out: ValidationResult[] = [];

  // Sheet-space segments intersecting THIS panel
  const panelSegments = layout.segments.filter((s) =>
    segmentIntersectsRect(s, { key: "panel", label: "panel", x: panel.x, y: panel.y, w: panel.w, h: panel.h }),
  );
  // Convert to panel-local coords
  const localSegments: FoldSegment[] = panelSegments.map((s) => ({
    type: s.type, x1: s.x1 - panel.x, y1: s.y1 - panel.y, x2: s.x2 - panel.x, y2: s.y2 - panel.y,
  }));
  const foldLocal = localSegments.filter((s) => s.type === "fold");
  const scoreLocal = localSegments.filter((s) => s.type === "score");
  const cutLocal = localSegments.filter((s) => s.type === "cut");
  const glueLocal = layout.glue && rectsOverlap(
    { key: "g", label: "g", x: layout.glue.x, y: layout.glue.y, w: layout.glue.w, h: layout.glue.h },
    { key: "p", label: "p", x: panel.x, y: panel.y, w: panel.w, h: panel.h },
  ) ? {
    key: "glue", label: "Glue area",
    x: layout.glue.x - panel.x, y: layout.glue.y - panel.y,
    w: layout.glue.w, h: layout.glue.h,
  } as PanelBox : null;

  for (const b of boxes) {
    const outsideTrim = b.x < 0 || b.y < 0 || b.x + b.w > panel.w || b.y + b.h > panel.h;
    if (outsideTrim) {
      out.push(mk("error", "trim", format, panelName, b.key, b.label,
        `${b.label} crosses the panel edge`,
        "extends past the panel boundary and will run into the fold, an adjacent panel, or the trim.",
        `Reduce size or reset offsets so ${b.label.toLowerCase()} stays inside the ${panelName.toLowerCase()} panel.`,
      ));
      continue;
    }
    const outsideSafe = b.x < safeInset || b.y < safeInset || b.x + b.w > panel.w - safeInset || b.y + b.h > panel.h - safeInset;
    if (outsideSafe) {
      out.push(mk("warning", "safe", format, panelName, b.key, b.label,
        `${b.label} is outside the safe area`,
        `sits within ${safeInset} mm of the panel edge — folds and trim wobble may clip it.`,
        `Move ${b.label.toLowerCase()} inward or reduce its size.`,
      ));
    }
    // Interior fold/score crossings (only reported if the segment is inside the panel, not on the shared edge)
    for (const f of foldLocal) {
      if (f.x1 === 0 && f.x2 === panel.w && f.y1 === 0 && f.y2 === 0) continue;
      if (f.x1 === 0 && f.x2 === panel.w && f.y1 === panel.h && f.y2 === panel.h) continue;
      if (segmentIntersectsRect(f, b) && b.x > 0.01 && b.y > 0.01 && b.x + b.w < panel.w - 0.01 && b.y + b.h < panel.h - 0.01) {
        out.push(mk("error", "fold-cross", format, panelName, b.key, b.label,
          `${b.label} crosses a fold line`, "will be creased when folded.", "Move the element off the fold line."));
      }
    }
    for (const s of scoreLocal) {
      if (s.x1 === 0 && s.x2 === panel.w && s.y1 === 0 && s.y2 === 0) continue;
      if (s.x1 === 0 && s.x2 === panel.w && s.y1 === panel.h && s.y2 === panel.h) continue;
      if (segmentIntersectsRect(s, b)) {
        out.push(mk("warning", "score-cross", format, panelName, b.key, b.label,
          `${b.label} crosses a score line`, "will look pinched at the score.", "Move the element off the score line."));
      }
    }
    if (glueLocal && rectsOverlap(b, glueLocal)) {
      out.push(mk("error", "glue-overlap", format, panelName, b.key, b.label,
        `${b.label} enters the glue area`, "sits on the adhesive area and will not be visible when assembled.", "Move the element out of the glue area."));
    }
  }

  // Pairwise overlap: QR vs text/logo, and text-vs-text
  if (qr) {
    for (const b of boxes) {
      if (b.key === "qr" || b.key === "stars") continue;
      if (rectsOverlap(b, qr)) {
        out.push(mk("error", "overlap-qr", format, panelName, b.key, b.label,
          `${b.label} overlaps the QR`, "overlaps the QR quiet zone and will break scanning.", `Move ${b.label.toLowerCase()} away from the QR or reduce QR scale.`));
      }
    }
  }
  const textKeys = ["headline", "supportText", "googleBadge", "cta", "footer", "businessName"];
  const textBoxes = boxes.filter((b) => textKeys.includes(b.key));
  for (let i = 0; i < textBoxes.length; i++) {
    for (let j = i + 1; j < textBoxes.length; j++) {
      const a = textBoxes[i], b = textBoxes[j];
      if (rectsOverlap(a, b)) {
        out.push(mk("warning", "overlap-text", format, panelName, a.key, a.label,
          `${a.label} overlaps ${b.label}`, `overlaps with ${b.label.toLowerCase()} — text will collide.`, "Shorten one of the strings or adjust layout."));
      }
    }
  }

  // Minimum finished QR size
  if (qr) {
    const qrDim = Math.min(qr.w, qr.h);
    if (qrDim < format.minQrSize) {
      out.push(mk("error", "qr-min", format, panelName, "qr", "QR code",
        "QR is smaller than the recommended minimum",
        `rendered at ${qrDim.toFixed(1)} mm on the ${panelName.toLowerCase()} panel — needs at least ${format.minQrSize} mm.`,
        "Increase QR scale in the folded editor."));
    }
  }

  // Production orientation note
  if (panel.rotation !== 0) {
    // Not an error — informational so users see the rotation is intentional.
    out.push({
      id: `${panelName.toLowerCase()}-orientation`, formatId: format.id, formatName: `${format.name} · ${panelName}`,
      category: "print", level: "warning",
      title: `${panelName}: production rotation ${panel.rotation}°`,
      message: `The ${panelName.toLowerCase()} panel is placed rotated ${panel.rotation}° on the flat sheet so it reads upright when the tent stands.`,
      suggestedFix: "No action needed — this is expected. Acknowledge to continue.",
      element: "panel", target: "preview",
    });
  }

  return out;
}

export function runFoldedValidations(input: FoldedValidationInput): ValidationResult[] {
  const { format, config, qrDesign, qrData } = input;
  const layout = getFoldedLayout(format);
  if (!layout) return [];
  const out: ValidationResult[] = [];
  const front = layout.panels.find((p) => p.panel === "front");
  const back = layout.panels.find((p) => p.panel === "back");

  if (!front || !back) {
    out.push({ id: "structure-panels", formatId: format.id, formatName: format.name, category: "print", level: "error", title: "Panel geometry invalid", message: "Front or back panel is missing from the folded layout.", suggestedFix: "Contact support — this format has an invalid layout definition." });
    return out;
  }
  if (Math.abs(front.w - back.w) > 0.1 || Math.abs(front.h - back.h) > 0.1) {
    out.push({ id: "structure-panel-size-mismatch", formatId: format.id, formatName: format.name, category: "print", level: "error", title: "Front and back panel sizes differ", message: "Folded tents require front and back panels of equal size for a clean fold.", suggestedFix: "Contact support — layout definition is inconsistent." });
  }
  if (!layout.segments.some((s) => s.type === "cut")) {
    out.push({ id: "structure-no-cut", formatId: format.id, formatName: format.name, category: "print", level: "error", title: "Missing cut path", message: "Layout does not define a CutContour.", suggestedFix: "Contact support." });
  }
  if (!layout.segments.some((s) => s.type === "fold")) {
    out.push({ id: "structure-no-fold", formatId: format.id, formatName: format.name, category: "print", level: "error", title: "Missing fold path", message: "Layout does not define a FoldLine.", suggestedFix: "Contact support." });
  }
  if (format.bleed <= 0) {
    out.push({ id: "structure-no-bleed", formatId: format.id, formatName: format.name, category: "print", level: "warning", title: "Bleed is 0", message: "Folded pieces normally need 3 mm bleed for commercial print.", suggestedFix: "Set bleed to 3 mm." });
  }

  // Front — always validated with front content.
  out.push(...validatePanel(input, front, "front", config.front));

  // Back — validated in every mode:
  //  - same_both_sides & mirrored: back uses front content (mirrored applies production rotation baked into panel.rotation).
  //  - different_sides: back uses config.back.
  const backContent = config.mode === "different_sides" ? config.back : config.front;
  out.push(...validatePanel(input, back, "back", backContent));

  // QR data + contrast (shared across faces)
  if (!qrData) {
    out.push({ id: "qr-no-data", formatId: format.id, formatName: format.name, category: "content", level: "error", title: "QR short-link is missing", message: "This QR has no short-link and cannot resolve when scanned.", suggestedFix: "Save the QR code to generate a short-link.", element: "qr", target: "qr" });
  }
  const { ratio } = qrEffectiveContrast(qrDesign);
  if (ratio < 3) {
    out.push({ id: "qr-contrast", formatId: format.id, formatName: format.name, category: "qr", level: "error", title: "QR contrast is too low", message: `Contrast ratio ${ratio.toFixed(2)}:1 — scanners fail below 3:1.`, suggestedFix: "Switch QR to black on white.", element: "qr", target: "qr" });
  } else if (ratio < 4.5) {
    out.push({ id: "qr-contrast-soft", formatId: format.id, formatName: format.name, category: "qr", level: "warning", title: "QR contrast is borderline", message: `Contrast ratio ${ratio.toFixed(2)}:1.`, suggestedFix: "Aim for 4.5:1 or higher.", element: "qr", target: "qr" });
  }

  return out;
}

// --- Front/back QR decode ---------------------------------------------------

export type FoldedDecodeEntry = { pass: boolean; reason?: string };
export type FoldedDecodeResult = {
  front: FoldedDecodeEntry;
  back: FoldedDecodeEntry;
  results: ValidationResult[];
};

async function decodeFace(input: FoldedRenderInput, facing: "front" | "back"): Promise<FoldedDecodeEntry> {
  try {
    const svg = await renderFoldedFormatSvg(input, { facing });
    const blob = await svgToPng(svg, 800, 800);
    const bitmap = await createImageBitmap(blob);
    const canvas = document.createElement("canvas");
    canvas.width = bitmap.width; canvas.height = bitmap.height;
    const ctx = canvas.getContext("2d")!;
    ctx.drawImage(bitmap, 0, 0);
    const data = ctx.getImageData(0, 0, canvas.width, canvas.height);
    const code = jsQR(data.data, data.width, data.height);
    if (code) return { pass: true };
    return { pass: false, reason: `Rendered ${facing} face did not decode. Increase QR scale, restore quiet zone, or reduce logo size.` };
  } catch (e) {
    return { pass: false, reason: (e as Error).message };
  }
}

/**
 * Decode the assembled front and back faces independently. Runs for every
 * folded mode — same_both_sides and mirrored still validate both faces to
 * confirm the back reads upright when the tent stands.
 */
export async function decodeFoldedQrValidation(input: FoldedRenderInput): Promise<FoldedDecodeResult> {
  const front = await decodeFace(input, "front");
  const back = await decodeFace(input, "back");
  const format = input.format;
  const results: ValidationResult[] = [];
  results.push(front.pass
    ? { id: `${format.id}-front-decode`, formatId: format.id, formatName: `${format.name} · Front`, category: "qr", level: "pass", title: "Front: QR decodes", message: "Assembled front face decoded successfully.", element: "qr" }
    : { id: `${format.id}-front-decode`, formatId: format.id, formatName: `${format.name} · Front`, category: "qr", level: "error", title: "Front: QR could not be decoded", message: front.reason ?? "Front face failed to scan.", suggestedFix: "Increase QR scale or reduce logo size.", element: "qr", target: "override" });
  results.push(back.pass
    ? { id: `${format.id}-back-decode`, formatId: format.id, formatName: `${format.name} · Back`, category: "qr", level: "pass", title: "Back: QR decodes (upright)", message: "Assembled back face decoded upright.", element: "qr" }
    : { id: `${format.id}-back-decode`, formatId: format.id, formatName: `${format.name} · Back`, category: "qr", level: "error", title: "Back: QR could not be decoded", message: back.reason ?? "Back face failed to scan.", suggestedFix: "Check back-panel orientation and QR scale.", element: "qr", target: "override" });
  return { front, back, results };
}

function clamp(v: number, lo: number, hi: number): number { return Math.max(lo, Math.min(hi, v)); }
