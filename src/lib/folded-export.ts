// Folded (table-tent) production PDF, ZIP additions, and export helpers.
// Builds on renderFoldedFormatSvg + renderFoldedProductionSvg from folded-render.

import { PDFDocument, StandardFonts, rgb } from "pdf-lib";
import type { BusinessFormat, LayoutTemplate } from "@/lib/qr-formats";
import type { QrDesign } from "@/lib/qr-design";
import { svgToPng, pxFor } from "@/lib/format-render";
import {
  renderFoldedFormatSvg, renderFoldedProductionSvg, renderFoldedMockupSvg,
  type FoldedRenderInput,
} from "@/lib/folded-render";
import { getFoldedLayout } from "@/lib/folded-layouts";
import type { FoldedConfig } from "@/lib/marketing-packs";

const MM_TO_PT = 2.83464567;

export type FoldedExportInputs = {
  format: BusinessFormat;
  template: LayoutTemplate;
  brand: string;
  business: { name: string; logoUrl: string | null };
  qrDesign: QrDesign;
  qrData: string;
  qrLogoUrl: string | null;
  config: FoldedConfig;
  fontFamily?: string;
};

function inputs(x: FoldedExportInputs): FoldedRenderInput { return x; }

/** Rasterise a folded SVG view at print-DPI (300 DPI for print, native for digital). */
async function pngFor(x: FoldedExportInputs, facing: "flat" | "front" | "back", dpi = 300): Promise<Blob> {
  const svg = await renderFoldedFormatSvg(inputs(x), { facing, includeBleed: facing === "flat" });
  const layout = getFoldedLayout(x.format)!;
  let wMm: number, hMm: number;
  if (facing === "flat") {
    wMm = layout.flatWidth + layout.bleed * 2;
    hMm = layout.flatHeight + layout.bleed * 2;
  } else {
    wMm = layout.assembledWidth;
    hMm = layout.assembledHeight;
  }
  const px = x.format.medium === "print"
    ? { w: Math.round(wMm * dpi / 25.4), h: Math.round(hMm * dpi / 25.4) }
    : pxFor(x.format, dpi);
  return await svgToPng(svg, px.w, px.h);
}

/** Front / Back / Flat PNG downloads. */
export async function downloadFoldedPng(x: FoldedExportInputs, facing: "flat" | "front" | "back"): Promise<Blob> {
  return await pngFor(x, facing);
}

/** SVG with switchable production-guide groups (CutContour, FoldLine, ScoreLine). */
export async function renderFoldedSvgWithGuides(x: FoldedExportInputs): Promise<string> {
  return await renderFoldedFormatSvg(inputs(x), {
    includeBleed: true, showCut: true, showFold: true, showScore: true, showPanelLabels: true, showSafe: true,
  });
}

export async function renderFoldedMockup(x: FoldedExportInputs): Promise<string> {
  return await renderFoldedMockupSvg(inputs(x));
}

/** Multi-page folded print PDF: flat + front/back proofs + assembly notes. */
export async function buildFoldedPdf(x: FoldedExportInputs): Promise<Uint8Array> {
  const doc = await PDFDocument.create();
  const helv = await doc.embedFont(StandardFonts.Helvetica);
  const helvBold = await doc.embedFont(StandardFonts.HelveticaBold);
  const layout = getFoldedLayout(x.format)!;
  const bleed = x.format.medium === "print" ? layout.bleed : 0;
  const flatWpt = (layout.flatWidth + bleed * 2) * MM_TO_PT;
  const flatHpt = (layout.flatHeight + bleed * 2) * MM_TO_PT;

  // Page 1: flat artwork with bleed + crop marks
  {
    const png = await pngFor(x, "flat");
    const img = await doc.embedPng(new Uint8Array(await png.arrayBuffer()));
    const page = doc.addPage([flatWpt, flatHpt]);
    page.drawImage(img, { x: 0, y: 0, width: flatWpt, height: flatHpt });

    // Crop marks
    if (bleed > 0) {
      const b = bleed * MM_TO_PT;
      const mL = 4 * MM_TO_PT;
      const stroke = rgb(0, 0, 0);
      const inner = { l: b, r: flatWpt - b, bt: b, tp: flatHpt - b };
      const marks: [number, number, number, number][] = [
        [inner.l - mL, inner.bt, inner.l - 1, inner.bt],
        [inner.l, inner.bt - mL, inner.l, inner.bt - 1],
        [inner.r + 1, inner.bt, inner.r + mL, inner.bt],
        [inner.r, inner.bt - mL, inner.r, inner.bt - 1],
        [inner.l - mL, inner.tp, inner.l - 1, inner.tp],
        [inner.l, inner.tp + 1, inner.l, inner.tp + mL],
        [inner.r + 1, inner.tp, inner.r + mL, inner.tp],
        [inner.r, inner.tp + 1, inner.r, inner.tp + mL],
      ];
      for (const [x1, y1, x2, y2] of marks) page.drawLine({ start: { x: x1, y: y1 }, end: { x: x2, y: y2 }, thickness: 0.4, color: stroke });
    }

    // Vector production paths on top: CutContour (magenta), FoldLine (green dashed), ScoreLine (amber dotted)
    const offXp = bleed * MM_TO_PT;
    const offYp = bleed * MM_TO_PT;
    // Y-axis is flipped in PDF (origin bottom-left). Convert layout y (top-down) to PDF y (bottom-up).
    const flip = (y: number) => flatHpt - (offYp + y * MM_TO_PT);
    for (const s of layout.segments) {
      const color = s.type === "cut" ? rgb(1, 0, 1) : s.type === "fold" ? rgb(0, 0.65, 0.32) : rgb(0.96, 0.62, 0.04);
      const thickness = s.type === "cut" ? 0.25 : 0.4;
      const dash = s.type === "cut" ? undefined : (s.type === "fold" ? [3, 2] : [1, 1]);
      page.drawLine({
        start: { x: offXp + s.x1 * MM_TO_PT, y: flip(s.y1) },
        end: { x: offXp + s.x2 * MM_TO_PT, y: flip(s.y2) },
        thickness, color,
        dashArray: dash,
      });
    }
  }

  // Page 2: front + back proofs side by side
  {
    const page = doc.addPage([595, 842]);
    page.drawText("Front & back proofs", { x: 40, y: 800, size: 18, font: helvBold, color: rgb(0.05, 0.05, 0.05) });
    const proofWpt = (layout.assembledWidth) * MM_TO_PT * 0.9;
    const proofHpt = (layout.assembledHeight) * MM_TO_PT * 0.9;
    const frontPng = await pngFor(x, "front");
    const backPng = await pngFor(x, "back");
    const frontImg = await doc.embedPng(new Uint8Array(await frontPng.arrayBuffer()));
    const backImg = await doc.embedPng(new Uint8Array(await backPng.arrayBuffer()));
    const gap = 20;
    const rowY = 780 - proofHpt;
    page.drawImage(frontImg, { x: 40, y: rowY, width: proofWpt, height: proofHpt });
    page.drawImage(backImg, { x: 40 + proofWpt + gap, y: rowY, width: proofWpt, height: proofHpt });
    page.drawText("Front (as assembled)", { x: 40, y: rowY - 14, size: 9, font: helv, color: rgb(0.3, 0.3, 0.3) });
    page.drawText("Back (as assembled)", { x: 40 + proofWpt + gap, y: rowY - 14, size: 9, font: helv, color: rgb(0.3, 0.3, 0.3) });
  }

  // Page 3: assembly notes
  {
    const page = doc.addPage([595, 842]);
    let y = 800;
    page.drawText("Assembly & print notes", { x: 40, y, size: 20, font: helvBold, color: rgb(0.05, 0.05, 0.05) });
    y -= 26;
    const notes = foldedPrintNotes(x, layout);
    for (const line of notes) {
      page.drawText(line, { x: 40, y, size: 10.5, font: line.startsWith("—") ? helvBold : helv, color: rgb(0.15, 0.15, 0.15), maxWidth: 515 });
      y -= 15;
      if (y < 60) break;
    }
  }

  return await doc.save();
}

export function foldedPrintNotes(x: FoldedExportInputs, layout: import("@/lib/folded-layouts").FoldedLayout): string[] {
  const modeLabel = x.config.mode === "same_both_sides" ? "Same both sides"
    : x.config.mode === "mirrored" ? "Mirrored (back rotated 180° in production)"
    : "Different front and back";
  const l: string[] = [
    `Format: ${x.format.name}`,
    `Design mode: ${modeLabel}`,
    `Flat artwork: ${layout.flatWidth} × ${layout.flatHeight} mm (bleed ${layout.bleed} mm)`,
    `Assembled face: ${layout.assembledWidth} × ${layout.assembledHeight} mm`,
    `Recommended QR minimum: ${x.format.minQrSize} mm finished size`,
    "",
    "— Production paths —",
    "CutContour: vector path, 100% magenta stroke (#ff00ff). Use for die cutting only; do not print.",
    "FoldLine: vector path, dashed green stroke (#00a651). Fold along this line after scoring.",
    "ScoreLine: vector path, dotted amber stroke (#f59e0b). Score before folding.",
  ];
  if (layout.glue) l.push("GlueArea: rectangle marked in production paths — apply adhesive here.");
  l.push(
    "",
    "— Fold order —",
    "1. Print flat artwork.",
    "2. Trim along CutContour.",
    "3. Score along ScoreLine.",
    "4. Fold along FoldLine so front and back panels face outward.",
    "",
    "— Materials —",
    `Recommended stock: ${x.format.material}`,
    "Recommended lamination: matte laminate for durability on hospitality/restaurant use.",
    "",
    layout.notes.map((n) => `Note: ${n}`).join("\n"),
    "",
    "Do NOT print CutContour / FoldLine / ScoreLine on the customer-facing artwork unless the printer explicitly requests them as guides.",
  );
  return l;
}
