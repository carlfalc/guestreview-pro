import { PDFDocument, StandardFonts, rgb } from "pdf-lib";
import JSZip from "jszip";
import type { BusinessFormat, LayoutTemplate } from "@/lib/qr-formats";
import type { QrDesign } from "@/lib/qr-design";
import {
  renderFormatSvg, renderDielineSvg, svgToPng, pxFor, circularSafeRadius,
  DIELINE_COLOR, DIELINE_LAYER, type FormatContent,
} from "@/lib/format-render";

const MM_TO_PT = 2.83464567;

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
  extras: { transparentOutside?: boolean; includeDieline?: boolean } = {},
): Promise<Blob> {
  const svg = await renderFormatSvg(format, template, content, qrDesign, qrData, logoUrl, brand, {
    includeBleed, showBoundaries: false,
    transparentOutside: extras.transparentOutside,
    includeDieline: extras.includeDieline,
  });
  const px = pxFor(format, dpi);
  const totalW = px.w + (includeBleed && format.medium === "print" ? Math.round(format.bleed * dpi / 25.4) * 2 : 0);
  const totalH = px.h + (includeBleed && format.medium === "print" ? Math.round(format.bleed * dpi / 25.4) * 2 : 0);
  return await svgToPng(svg, totalW, totalH);
}

export async function downloadFormatPng(format: BusinessFormat, template: LayoutTemplate, content: FormatContent, qrDesign: QrDesign, qrData: string, logoUrl: string | null, brand: string): Promise<void> {
  const blob = await getPngForFormat(format, template, content, qrDesign, qrData, logoUrl, brand, false);
  triggerDownload(blob, `${format.id}.png`);
}

/** Transparent-background PNG for circular stickers — outside-of-trim stays transparent. */
export async function downloadFormatPngTransparent(format: BusinessFormat, template: LayoutTemplate, content: FormatContent, qrDesign: QrDesign, qrData: string, logoUrl: string | null, brand: string): Promise<void> {
  const blob = await getPngForFormat(format, template, content, qrDesign, qrData, logoUrl, brand, false, 300, { transparentOutside: true });
  triggerDownload(blob, `${format.id}-transparent.png`);
}

export async function downloadFormatSvg(format: BusinessFormat, template: LayoutTemplate, content: FormatContent, qrDesign: QrDesign, qrData: string, logoUrl: string | null, brand: string): Promise<void> {
  const svg = await renderFormatSvg(format, template, content, qrDesign, qrData, logoUrl, brand, { includeBleed: false, showBoundaries: false });
  triggerDownload(new Blob([svg], { type: "image/svg+xml" }), `${format.id}.svg`);
}

/** SVG with CutContour dieline embedded on its own layer (for circular formats). */
export async function downloadFormatSvgWithDieline(format: BusinessFormat, template: LayoutTemplate, content: FormatContent, qrDesign: QrDesign, qrData: string, logoUrl: string | null, brand: string): Promise<void> {
  const svg = await renderFormatSvg(format, template, content, qrDesign, qrData, logoUrl, brand, { includeBleed: true, showBoundaries: false, includeDieline: true });
  triggerDownload(new Blob([svg], { type: "image/svg+xml" }), `${format.id}-with-dieline.svg`);
}

/** Standalone CutContour dieline SVG. */
export async function downloadDielineSvg(format: BusinessFormat): Promise<void> {
  const svg = renderDielineSvg(format);
  triggerDownload(new Blob([svg], { type: "image/svg+xml" }), `${format.id}-${DIELINE_LAYER}.svg`);
}

export async function buildFormatPdf(
  format: BusinessFormat, template: LayoutTemplate, content: FormatContent,
  qrDesign: QrDesign, qrData: string, logoUrl: string | null, brand: string,
  opts: { includeDieline?: boolean } = {},
): Promise<Uint8Array> {
  const doc = await PDFDocument.create();
  const helv = await doc.embedFont(StandardFonts.Helvetica);
  const helvBold = await doc.embedFont(StandardFonts.HelveticaBold);
  const isPrint = format.medium === "print";
  const bleed = isPrint ? format.bleed : 0;
  const pageW = (format.width + bleed * 2) * (isPrint ? MM_TO_PT : 0.75);
  const pageH = (format.height + bleed * 2) * (isPrint ? MM_TO_PT : 0.75);
  const isCircular = format.shape === "circular";
  const includeDieline = opts.includeDieline !== false && isCircular; // default ON for circular

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

  // Vector CutContour dieline for circular formats. Drawn as a true vector on top of
  // the artwork so the printer sees a spot-style cut path — not a rasterised line.
  if (includeDieline) {
    const magenta = rgb(1, 0, 1);
    const cx = pageW / 2;
    const cy = pageH / 2;
    const rMm = format.width / 2;
    const rPt = rMm * MM_TO_PT;
    page.drawEllipse({ x: cx, y: cy, xScale: rPt, yScale: rPt, borderColor: magenta, borderWidth: 0.25, opacity: 0, borderOpacity: 1 });
  }

  if (isPrint) {
    const notes = doc.addPage([595, 842]);
    const w = 595;
    let y = 800;
    notes.drawText("Print notes", { x: 40, y, size: 20, font: helvBold, color: rgb(0.05, 0.05, 0.05) });
    y -= 30;
    const lines = printNotesLines(format);
    lines.forEach((l) => { notes.drawText(l, { x: 40, y, size: 11, font: helv, color: rgb(0.15, 0.15, 0.15), maxWidth: w - 80 }); y -= 16; });
  }
  return await doc.save();
}

function printNotesLines(f: BusinessFormat): string[] {
  const unit = f.medium === "print" ? "mm" : "px";
  const lines: string[] = [
    `Format: ${f.name}`,
    `Physical size: ${f.width} × ${f.height} ${unit}`,
    `Bleed: ${f.bleed} ${unit}`,
    `Shape: ${f.shape}`,
    `Recommended material: ${f.material}`,
    `Recommended minimum QR size: ${f.minQrSize} ${unit}`,
    `Artwork resolution: 300 DPI`,
    `Colour: supplied RGB — request print shop convert to CMYK if required.`,
    `Crop marks: included on artwork page where bleed is defined.`,
  ];
  if (f.shape === "circular" && f.medium === "print") {
    const safeD = Math.round(circularSafeRadius(f.width) * 2 * 10) / 10;
    lines.push(
      "",
      `— Circular sticker production —`,
      `Final trim diameter: ${f.width} mm`,
      `Bleed diameter (finished + bleed): ${f.width + f.bleed * 2} mm`,
      `Safe-area diameter: ${safeD} mm`,
      `Recommended laminate: matte or gloss vinyl laminate (durable, water-resistant)`,
      `Cut path: named layer "${DIELINE_LAYER}", 100% magenta (${DIELINE_COLOR}), stroke only.`,
      `Do NOT print the ${DIELINE_LAYER} layer — use for die cutting only.`,
    );
  }
  return lines;
}

export async function downloadFormatPdf(format: BusinessFormat, template: LayoutTemplate, content: FormatContent, qrDesign: QrDesign, qrData: string, logoUrl: string | null, brand: string): Promise<void> {
  const bytes = await buildFormatPdf(format, template, content, qrDesign, qrData, logoUrl, brand);
  triggerDownload(new Blob([bytes as BlobPart], { type: "application/pdf" }), `${format.id}.pdf`);
}

export type QrValidationEntry = { formatId: string; pass: boolean; reason?: string };

export type ZipManifest = {
  version: 2;
  project: {
    id: string | null;
    name: string;
    pack_type: string | null;
    status: string | null;
  };
  business: { id: string | null; name: string | null };
  qr: { id: string | null; short_code: string | null; label: string | null; destination_type: string | null };
  layout_template: string;
  exported_at: string;
  formats: {
    id: string;
    name: string;
    medium: "print" | "digital";
    shape: string;
    category: string;
    width: number;
    height: number;
    unit: "mm" | "px";
    bleed: number;
    material: string;
    qr_validation?: { pass: boolean; reason?: string };
    files: string[];
  }[];
};

export type PackZipMeta = {
  projectId?: string | null;
  packType?: string;
  status?: string;
  businessId?: string | null;
  business?: string | null;
  qrId?: string | null;
  qrCode?: string | null;
  qrLabel?: string | null;
  qrDestinationType?: string | null;
  previewDataUrl?: string | null;
  validations?: QrValidationEntry[];
};

/**
 * Build a marketing pack ZIP with per-medium folder structure, project preview,
 * human-readable print notes, and a rich manifest.
 *
 *   /manifest.json
 *   /readme.txt
 *   /preview/{project}.png
 *   /print-notes/{format}.txt
 *   /print-notes/README.txt
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
  meta: PackZipMeta = {},
): Promise<{ manifest: ZipManifest; blob: Blob }> {
  const zip = new JSZip();
  const validationsMap = new Map<string, QrValidationEntry>();
  (meta.validations ?? []).forEach((v) => validationsMap.set(v.formatId, v));

  const manifest: ZipManifest = {
    version: 2,
    project: {
      id: meta.projectId ?? null,
      name: packName,
      pack_type: meta.packType ?? null,
      status: meta.status ?? null,
    },
    business: { id: meta.businessId ?? null, name: meta.business ?? null },
    qr: {
      id: meta.qrId ?? null,
      short_code: meta.qrCode ?? null,
      label: meta.qrLabel ?? null,
      destination_type: meta.qrDestinationType ?? null,
    },
    layout_template: template,
    exported_at: new Date().toISOString(),
    formats: [],
  };

  const printAny = formats.some((f) => f.medium === "print");
  if (printAny) {
    zip.file(
      "print-notes/README.txt",
      [
        `${packName} — print notes`,
        `Exported ${manifest.exported_at}`,
        "",
        "One text file per print format with recommended material, physical size,",
        "bleed and minimum QR size. Share with your printer alongside the PDFs.",
      ].join("\n"),
    );
  }

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

      const notesPath = `print-notes/${f.id}.txt`;
      zip.file(notesPath, printNotesLines(f).join("\n"));
      files.push(notesPath);
    }

    // Circular sticker production extras: transparent PNG + CutContour dieline (SVG),
    // plus an artwork+dieline variant for print shops that prefer one file.
    if (f.shape === "circular") {
      const transparent = await getPngForFormat(f, template, content, qrDesign, qrData, logoUrl, brand, false, 300, { transparentOutside: true });
      const tPath = `${folder}/png/${f.id}-transparent.png`;
      zip.file(tPath, new Uint8Array(await transparent.arrayBuffer()));
      files.push(tPath);

      const dielineSvg = renderDielineSvg(f);
      const dPath = `${folder}/svg/${f.id}-${DIELINE_LAYER}.svg`;
      zip.file(dPath, dielineSvg);
      files.push(dPath);

      const withDieline = await renderFormatSvg(f, template, content, qrDesign, qrData, logoUrl, brand, { includeBleed: true, showBoundaries: false, includeDieline: true });
      const wPath = `${folder}/svg/${f.id}-with-dieline.svg`;
      zip.file(wPath, withDieline);
      files.push(wPath);
    }

    const v = validationsMap.get(f.id);
    manifest.formats.push({
      id: f.id, name: f.name, medium: f.medium, shape: f.shape, category: f.category,
      width: f.width, height: f.height,
      unit: f.medium === "print" ? "mm" : "px",
      bleed: f.bleed,
      material: f.material,
      qr_validation: v ? { pass: v.pass, reason: v.reason } : undefined,
      files,
    });
  }

  // Project preview thumbnail
  if (meta.previewDataUrl) {
    const previewBytes = dataUrlToBytes(meta.previewDataUrl);
    if (previewBytes) {
      const path = `preview/${slugify(packName)}.png`;
      zip.file(path, previewBytes);
    }
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
      "  preview/     Project preview thumbnail",
      "  print-notes/ Per-format print specifications for your printer",
      "  print/pdf    Print-ready PDFs with crop marks and bleed",
      "  print/png    High-resolution PNGs (300 DPI)",
      "  print/svg    Vector SVGs (no bleed)",
      "  digital/png  Web/social PNGs",
      "  digital/svg  Vector SVGs",
      "",
      "manifest.json lists every included format, its dimensions and its files.",
    ].join("\n"),
  );
  const blob = await zip.generateAsync({ type: "blob" });
  triggerDownload(blob, `${slugify(packName)}.zip`);
  return { manifest, blob };
}

function dataUrlToBytes(dataUrl: string): Uint8Array | null {
  const m = /^data:[^;]+;base64,(.+)$/.exec(dataUrl);
  if (!m) return null;
  const bin = atob(m[1]);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return bytes;
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
