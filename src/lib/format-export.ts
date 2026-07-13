import { PDFDocument, StandardFonts, rgb } from "pdf-lib";
import JSZip from "jszip";
import type { BusinessFormat, LayoutTemplate } from "@/lib/qr-formats";
import type { QrDesign } from "@/lib/qr-design";
import { renderFormatSvg, svgToPng, pxFor, type FormatContent } from "@/lib/format-render";

const MM_TO_PT = 2.83464567;

/**
 * Per-format content selector. In a pack with per-format overrides, callers
 * pass a function that returns the merged FormatContent for a given format.
 */
export type ContentResolver = (format: BusinessFormat) => FormatContent;

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
  const svg = await renderFormatSvg(format, template, content, qrDesign, qrData, logoUrl, brand, { includeBleed, showBoundaries: false });
  const px = pxFor(format, dpi);
  const totalW = px.w + (includeBleed && format.medium === "print" ? Math.round(format.bleed * dpi / 25.4) * 2 : 0);
  const totalH = px.h + (includeBleed && format.medium === "print" ? Math.round(format.bleed * dpi / 25.4) * 2 : 0);
  return await svgToPng(svg, totalW, totalH);
}

export async function downloadFormatPng(format: BusinessFormat, template: LayoutTemplate, content: FormatContent, qrDesign: QrDesign, qrData: string, logoUrl: string | null, brand: string): Promise<void> {
  const blob = await getPngForFormat(format, template, content, qrDesign, qrData, logoUrl, brand, false);
  triggerDownload(blob, `${format.id}.png`);
}

export async function downloadFormatSvg(format: BusinessFormat, template: LayoutTemplate, content: FormatContent, qrDesign: QrDesign, qrData: string, logoUrl: string | null, brand: string): Promise<void> {
  const svg = await renderFormatSvg(format, template, content, qrDesign, qrData, logoUrl, brand, { includeBleed: false, showBoundaries: false });
  triggerDownload(new Blob([svg], { type: "image/svg+xml" }), `${format.id}.svg`);
}

export async function buildFormatPdf(format: BusinessFormat, template: LayoutTemplate, content: FormatContent, qrDesign: QrDesign, qrData: string, logoUrl: string | null, brand: string): Promise<Uint8Array> {
  const doc = await PDFDocument.create();
  const helv = await doc.embedFont(StandardFonts.Helvetica);
  const helvBold = await doc.embedFont(StandardFonts.HelveticaBold);
  const isPrint = format.medium === "print";
  const bleed = isPrint ? format.bleed : 0;
  const pageW = (format.width + bleed * 2) * (isPrint ? MM_TO_PT : 0.75);
  const pageH = (format.height + bleed * 2) * (isPrint ? MM_TO_PT : 0.75);

  const png = await getPngForFormat(format, template, content, qrDesign, qrData, logoUrl, brand, isPrint, 300);
  const pngBytes = new Uint8Array(await png.arrayBuffer());
  const image = await doc.embedPng(pngBytes);
  const page = doc.addPage([pageW, pageH]);
  page.drawImage(image, { x: 0, y: 0, width: pageW, height: pageH });

  if (isPrint && bleed > 0) {
    const bleedPt = bleed * MM_TO_PT;
    const markLen = 4 * MM_TO_PT;
    const stroke = rgb(0, 0, 0);
    const thick = 0.4;
    const inner = { l: bleedPt, r: pageW - bleedPt, b: bleedPt, t: pageH - bleedPt };
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

  if (isPrint) {
    const notes = doc.addPage([595, 842]);
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
    lines.forEach((l) => { notes.drawText(l, { x: 40, y, size: 11, font: helv, color: rgb(0.15, 0.15, 0.15), maxWidth: w - 80 }); y -= 18; });
  }
  return await doc.save();
}

export async function downloadFormatPdf(format: BusinessFormat, template: LayoutTemplate, content: FormatContent, qrDesign: QrDesign, qrData: string, logoUrl: string | null, brand: string): Promise<void> {
  const bytes = await buildFormatPdf(format, template, content, qrDesign, qrData, logoUrl, brand);
  triggerDownload(new Blob([bytes as BlobPart], { type: "application/pdf" }), `${format.id}.pdf`);
}

export type ZipManifest = {
  version: 1;
  pack_name: string;
  pack_type?: string;
  layout_template: string;
  business?: string | null;
  qr_code?: string | null;
  exported_at: string;
  formats: {
    id: string;
    name: string;
    medium: "print" | "digital";
    shape: string;
    category: string;
    width: number;
    height: number;
    bleed: number;
    files: string[];
  }[];
};

/**
 * Build a marketing pack ZIP with per-medium folder structure and manifest.
 *
 *   /manifest.json
 *   /readme.txt
 *   /print/pdf/<id>.pdf
 *   /print/png/<id>.png
 *   /print/svg/<id>.svg
 *   /digital/png/<id>.png
 *   /digital/svg/<id>.svg
 */
export async function downloadPackZip(
  packName: string,
  formats: BusinessFormat[],
  template: LayoutTemplate,
  resolve: ContentResolver,
  qrDesign: QrDesign,
  qrData: string,
  logoUrl: string | null,
  brand: string,
  meta: { packType?: string; business?: string | null; qrCode?: string | null } = {},
): Promise<void> {
  const zip = new JSZip();
  const manifest: ZipManifest = {
    version: 1,
    pack_name: packName,
    pack_type: meta.packType,
    layout_template: template,
    business: meta.business ?? null,
    qr_code: meta.qrCode ?? null,
    exported_at: new Date().toISOString(),
    formats: [],
  };
  for (const f of formats) {
    const content = resolve(f);
    const folder = f.medium === "print" ? "print" : "digital";
    const files: string[] = [];

    const png = await getPngForFormat(f, template, content, qrDesign, qrData, logoUrl, brand, false);
    const pngPath = `${folder}/png/${f.id}.png`;
    zip.file(pngPath, new Uint8Array(await png.arrayBuffer()));
    files.push(pngPath);

    const svg = await renderFormatSvg(f, template, content, qrDesign, qrData, logoUrl, brand, { includeBleed: false, showBoundaries: false });
    const svgPath = `${folder}/svg/${f.id}.svg`;
    zip.file(svgPath, svg);
    files.push(svgPath);

    if (f.medium === "print") {
      const pdf = await buildFormatPdf(f, template, content, qrDesign, qrData, logoUrl, brand);
      const pdfPath = `print/pdf/${f.id}.pdf`;
      zip.file(pdfPath, pdf);
      files.push(pdfPath);
    }

    manifest.formats.push({
      id: f.id, name: f.name, medium: f.medium, shape: f.shape, category: f.category,
      width: f.width, height: f.height, bleed: f.bleed, files,
    });
  }
  zip.file("manifest.json", JSON.stringify(manifest, null, 2));
  zip.file(
    "readme.txt",
    [
      `${packName}`,
      `Exported ${manifest.exported_at}`,
      `Layout template: ${template}`,
      "",
      "Folders:",
      "  print/pdf   Print-ready PDFs with crop marks and bleed",
      "  print/png   High-resolution PNGs (300 DPI)",
      "  print/svg   Vector SVGs (no bleed)",
      "  digital/png Web/social PNGs",
      "  digital/svg Vector SVGs",
      "",
      "manifest.json lists every included format and its files.",
    ].join("\n"),
  );
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
