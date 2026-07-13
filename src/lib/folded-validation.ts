// Panel-level validation for folded (table-tent) formats.

import type { BusinessFormat } from "@/lib/qr-formats";
import type { QrDesign } from "@/lib/qr-design";
import { getFoldedLayout, type PanelRect } from "@/lib/folded-layouts";
import type { FoldedConfig, FoldedPanelContent } from "@/lib/marketing-packs";
import { qrEffectiveContrast, type ValidationResult, type ValidationTarget } from "@/lib/format-validation";

export type FoldedValidationInput = {
  format: BusinessFormat;
  config: FoldedConfig;
  qrDesign: QrDesign;
  qrData: string;
};

/** Compute the QR bounding box within a panel's local coordinate space. */
function qrBoxInPanel(panel: PanelRect, c: FoldedPanelContent, minQrSize: number) {
  const w = panel.w, h = panel.h;
  const scale = clamp(c.qrScale ?? 0.45, 0.3, 0.7);
  const size = Math.max(Math.min(w, h) * scale, Math.min(minQrSize, Math.min(w, h) * 0.7));
  const qrX = (w - size) / 2 + (c.qrOffsetX ?? 0) * w;
  const qrY = h * 0.34 + (c.qrOffsetY ?? 0) * h;
  return { x: qrX, y: qrY, w: size, h: size };
}

function mkErr(id: string, format: BusinessFormat, panel: string, element: string, title: string, message: string, fix: string, target: ValidationTarget = "override"): ValidationResult {
  return { id: `${panel}-${id}`, formatId: format.id, formatName: `${format.name} · ${panel}`, category: "qr", level: "error", title, message, suggestedFix: fix, element, target };
}
function mkWarn(id: string, format: BusinessFormat, panel: string, element: string, title: string, message: string, fix: string, target: ValidationTarget = "override"): ValidationResult {
  return { id: `${panel}-${id}`, formatId: format.id, formatName: `${format.name} · ${panel}`, category: "qr", level: "warning", title, message, suggestedFix: fix, element, target };
}

function validatePanel(
  input: FoldedValidationInput,
  panelKey: "front" | "back",
  panel: PanelRect,
  content: FoldedPanelContent,
): ValidationResult[] {
  const { format } = input;
  const out: ValidationResult[] = [];
  const panelName = panelKey === "front" ? "Front" : "Back";
  const safeInset = 4;

  if (content.showQr === false) return out;

  const qr = qrBoxInPanel(panel, content, format.minQrSize);
  const qrRight = qr.x + qr.w;
  const qrBottom = qr.y + qr.h;

  // Trim (panel boundary) — crossing means QR enters an adjacent panel / fold / glue.
  if (qr.x < 0 || qr.y < 0 || qrRight > panel.w || qrBottom > panel.h) {
    out.push(mkErr("qr-cross-panel", format, panelName, "qr", `QR crosses the ${panelName.toLowerCase()} panel edge`,
      "The QR extends past the panel boundary and may hit the fold line or an adjacent panel.",
      "Reduce QR scale or reset QR offsets so it stays inside this panel."));
  }

  // Safe area
  if (qr.x < safeInset || qr.y < safeInset || qrRight > panel.w - safeInset || qrBottom > panel.h - safeInset) {
    out.push(mkWarn("qr-safe", format, panelName, "qr", `QR is outside the ${panelName.toLowerCase()} panel safe area`,
      "QR sits within 4 mm of the panel edge — folds and trim wobble may clip it.",
      "Move the QR inward or reduce its scale."));
  }

  // Minimum finished size
  const qrDim = Math.min(qr.w, qr.h);
  if (qrDim < format.minQrSize) {
    out.push(mkErr("qr-min-size", format, panelName, "qr", `QR is smaller than the recommended minimum`,
      `The rendered QR is ${qrDim.toFixed(1)} mm — needs at least ${format.minQrSize} mm.`,
      "Increase QR scale in the folded editor."));
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

  // Structural checks
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

  // Per-panel content validation
  out.push(...validatePanel(input, "front", front, config.front));

  if (config.mode !== "same_both_sides" && config.mode !== "mirrored") {
    // different_sides — validate back independently
    out.push(...validatePanel(input, "back", back, config.back));
  } else if (config.mode === "mirrored") {
    // Mirrored — same content, but note rotation for scanability
    out.push(...validatePanel(input, "back", back, config.front));
  }

  // QR data + contrast (shared)
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

function clamp(v: number, lo: number, hi: number): number { return Math.max(lo, Math.min(hi, v)); }
