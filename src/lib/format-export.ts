import { PDFDocument, StandardFonts, rgb } from "pdf-lib";
import JSZip from "jszip";
import type { BusinessFormat, LayoutTemplate } from "@/lib/qr-formats";
import type { QrDesign } from "@/lib/qr-design";
import { renderFormatSvg, svgToPng, pxFor, type FormatContent } from "@/lib/format-render";

const MM_TO_PT = 2.83464567;

async function getPngForFormat(
  format: BusinessFormat,
  template: LayoutTemplate,
  content: FormatContent,
  qrDesign: QrDesign,
  qrData: string,
  logoUrl: string | null,
  brand: string,
  includeBleed: boolean,
  dpi = 300,
): Promise<Blob> {
  const svg = await renderFormatSvg(
    format,
    template,
    content,
    qrDesign,
    qrData,
    logoUrl,
    brand,
    { includeBleed, showBoundaries: false },
  );
  const px = pxFor(format, dpi);
  const totalW = px.w + (includeBleed && format.medium === "print" ? Math.round(format.bleed * dpi / 25.4) * 2 : 0);
  const totalH = px.h + (includeBleed && format.medium === "print" ? Math.round(format.bleed * dpi / 25.4) * 2 : 0);
  return await svgToPng(svg, totalW, totalH);
}

export async function downloadFormatPng(
  format: BusinessFormat,
  template: LayoutTemplate,
  content: FormatContent,
  qrDesign: QrDesign,
  qrData: string,
  logoUrl: string | null,
  brand: string,
): Promise<void> {
  const blob = await getPngForFormat(format, template, content, qrDesign, qrData, logoUrl, brand, false);
  triggerDownload(blob, `${format.id}.png`);
}

export async function downloadFormatSvg(
  format: BusinessFormat,
  template: LayoutTemplate,
  content: FormatContent,
  qrDesign: QrDesign,
  qrData: string,
  logoUrl: string | null,
  brand: string,
): Promise<void> {
  const svg = await renderFormatSvg(format, template, content, qrDesign, qrData, logoUrl, brand, {
    includeBleed: false,
    showBoundaries: false,
  });
  triggerDownload(new Blob([svg], { type: "image/svg+xml" }), `${format.id}.svg`);
}

/** Print PDF at correct physical size in points, with 3 mm bleed and crop marks (print formats only). */
export async function buildFormatPdf(
  format: BusinessFormat,
  template: LayoutTemplate,
  content: FormatContent,
  qrDesign: QrDesign,
  qrData: string,
  logoUrl: string | null,
  brand: string,
): Promise<Uint8Array> {
  const doc = await PDFDocument.create();
  const helv = await doc.embedFont(StandardFonts.Helvetica);
  const helvBold = await doc.embedFont(StandardFonts.HelveticaBold);
  const isPrint = format.medium === "print";
  const bleed = isPrint ? format.bleed : 0;
  // Page size in PDF points
  const pageW = (format.width + bleed * 2) * (isPrint ? MM_TO_PT : 0.75);
  const pageH = (format.height + bleed * 2) * (isPrint ? MM_TO_PT : 0.75);

  // Rasterise artwork at 300 DPI including bleed
  const png = await getPngForFormat(format, template, content, qrDesign, qrData, logoUrl, brand, isPrint, 300);
  const pngBytes = new Uint8Array(await png.arrayBuffer());
  const image = await doc.embedPng(pngBytes);
  const page = doc.addPage([pageW, pageH]);
  page.drawImage(image, { x: 0, y: 0, width: pageW, height: pageH });

  // Crop marks (print only, when bleed > 0)
  if (isPrint && bleed > 0) {
    const bleedPt = bleed * MM_TO_PT;
    const markLen = 4 * MM_TO_PT;
    const stroke = rgb(0, 0, 0);
    const thick = 0.4;
    const inner = { l: bleedPt, r: pageW - bleedPt, b: bleedPt, t: pageH - bleedPt };
    // corners: 4 pairs
    const marks: [number, number, number, number][] = [
      [inner.l - markLen, inner.b, inner.l - 1, inner.b],
      [inner.l, inner.b - markLen, inner.l, inner.b - 1],
      [inner.r + 1, inner.b, inner.r + markLen, inner.b],
      [inner.r, inner.b - markLen, inner.r, inner.b - 1],
      [inner.l - markLen, inner.t, inner.l - 1, inner.t],
      [inner.l, inner.t + 1, inner.l, inner.t + markLen],
      [inner.r + 1, inner.t, inner.r + markLen, inner.t],
      [inner.r, inner.t + 1, inner.r, inner.t + markLen],
    ];
    marks.forEach(([x1, y1, x2, y2]) => page.drawLine({ start: { x: x1, y: y1 }, end: { x: x2, y: y2 }, thickness: thick, color: stroke }));
  }

  // Print-notes page (print only)
  if (isPrint) {
    const notes = doc.addPage([595, 842]); // A4 in pt
    const w = 595;
    let y = 800;
    notes.drawText("Print notes", { x: 40, y, size: 20, font: helvBold, color: rgb(0.05, 0.05, 0.05) });
    y -= 30;
    const lines = [
      `Format: ${format.name}`,
      `Physical size: ${format.width} × ${format.height} mm`,
      `Bleed: ${format.bleed} mm`,
      `Shape: ${format.shape}`,
      `Recommended material: ${format.material}`,
      `Recommended minimum QR size: ${format.minQrSize} mm`,
      `Artwork resolution: 300 DPI`,
      `Colour: supplied RGB — request print shop convert to CMYK if required.`,
      `Crop marks: included on artwork page where bleed is defined.`,
    ];
    lines.forEach((l) => {
      notes.drawText(l, { x: 40, y, size: 11, font: helv, color: rgb(0.15, 0.15, 0.15), maxWidth: w - 80 });
      y -= 18;
    });
  }
  return await doc.save();
}

export async function downloadFormatPdf(
  format: BusinessFormat,
  template: LayoutTemplate,
  content: FormatContent,
  qrDesign: QrDesign,
  qrData: string,
  logoUrl: string | null,
  brand: string,
): Promise<void> {
  const bytes = await buildFormatPdf(format, template, content, qrDesign, qrData, logoUrl, brand);
  triggerDownload(new Blob([bytes as BlobPart], { type: "application/pdf" }), `${format.id}.pdf`);
}

export async function downloadPackZip(
  packName: string,
  formats: BusinessFormat[],
  template: LayoutTemplate,
  content: FormatContent,
  qrDesign: QrDesign,
  qrData: string,
  logoUrl: string | null,
  brand: string,
): Promise<void> {
  const zip = new JSZip();
  for (const f of formats) {
    const png = await getPngForFormat(f, template, content, qrDesign, qrData, logoUrl, brand, false);
    zip.file(`png/${f.id}.png`, new Uint8Array(await png.arrayBuffer()));
    const svg = await renderFormatSvg(f, template, content, qrDesign, qrData, logoUrl, brand, { includeBleed: false, showBoundaries: false });
    zip.file(`svg/${f.id}.svg`, svg);
    if (f.medium === "print") {
      const pdf = await buildFormatPdf(f, template, content, qrDesign, qrData, logoUrl, brand);
      zip.file(`pdf/${f.id}.pdf`, pdf);
    }
  }
  const blob = await zip.generateAsync({ type: "blob" });
  triggerDownload(blob, `${slugify(packName)}.zip`);
}

function slugify(s: string): string {
  return s.trim().toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "pack";
}
function triggerDownload(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 5000);
}
