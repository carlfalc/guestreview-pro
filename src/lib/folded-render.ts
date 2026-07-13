// Panel-based renderer for folded (table-tent) formats. Renders each panel
// independently inside its rectangle on the flat sheet, applies production
// rotation for readability when assembled, and emits vector production paths
// (CutContour / FoldLine / ScoreLine / GlueArea / SafeArea) as separate
// switchable SVG groups.

import type { BusinessFormat, LayoutTemplate } from "@/lib/qr-formats";
import { templateColors } from "@/lib/qr-formats";
import type { QrDesign } from "@/lib/qr-design";
import { mapCornerDot, mapCornerSquare } from "@/lib/qr-design";
import QRCodeStyling from "qr-code-styling";
import {
  getFoldedLayout, type FoldedLayout, type PanelRect, type FoldSegment,
} from "@/lib/folded-layouts";
import type { FoldedConfig, FoldedPanelContent } from "@/lib/marketing-packs";

/** Production path colours (spot-style, printer-recognised). */
export const FOLDED_COLORS = {
  cut: "#ff00ff",       // CutContour, 100% magenta
  fold: "#00a651",      // FoldLine, distinct green
  score: "#f59e0b",     // ScoreLine, amber
  glue: "#3b82f6",      // GlueArea guide (preview only)
  safe: "#22c55e",
  panelLabel: "#64748b",
};

export type FoldedRenderOpts = {
  /** Include bleed frame around the flat sheet. */
  includeBleed?: boolean;
  /** Guide layers — off by default so customer-facing exports stay clean. */
  showCut?: boolean;
  showFold?: boolean;
  showScore?: boolean;
  showGlue?: boolean;
  showSafe?: boolean;
  showPanelLabels?: boolean;
  /** Render only a single face rather than the full flat sheet. */
  facing?: "flat" | "front" | "back";
};

export type FoldedRenderInput = {
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

export async function renderFoldedFormatSvg(input: FoldedRenderInput, opts: FoldedRenderOpts = {}): Promise<string> {
  const { format, template, brand, business, qrDesign, qrData, qrLogoUrl, config } = input;
  const layout = getFoldedLayout(format);
  if (!layout) throw new Error(`No folded layout for ${format.id}`);
  const tpl = templateColors(template, brand);
  const fontFamily = input.fontFamily ?? "Inter, -apple-system, system-ui, sans-serif";
  const includeBleed = opts.includeBleed ?? false;
  const bleed = includeBleed ? layout.bleed : 0;
  const totalW = layout.flatWidth + bleed * 2;
  const totalH = layout.flatHeight + bleed * 2;
  const offX = bleed;
  const offY = bleed;
  const unit = format.medium === "print" ? "mm" : "px";

  // QR SVG (reused across panels) — front & back may differ in scale/offsets only.
  const qrSvg = await renderQrSvg(qrDesign, qrData, qrLogoUrl);
  const qrInner = extractQrInnerSvg(qrSvg);

  const parts: string[] = [];
  parts.push(`<?xml version="1.0" encoding="UTF-8"?>`);
  parts.push(
    `<svg xmlns="http://www.w3.org/2000/svg" width="${totalW}${unit}" height="${totalH}${unit}" viewBox="0 0 ${totalW} ${totalH}">`,
  );

  // Sheet background
  parts.push(`<rect x="0" y="0" width="${totalW}" height="${totalH}" fill="#ffffff"/>`);

  const facing = opts.facing ?? "flat";
  const panelsToDraw = layout.panels.filter((p) => {
    if (facing === "flat") return true;
    return p.panel === facing;
  });

  // For single-face view, shift+crop the drawing to just that panel's bounds.
  const targetPanel = facing !== "flat" ? layout.panels.find((p) => p.panel === facing) : null;

  for (const panel of panelsToDraw) {
    const src = panel.panel === "back" ? (config.mode === "different_sides" ? config.back : config.front)
      : config.front;
    const panelContent = mergeWithDefaults(src);
    const bgFill = panelContent.backgroundColor ?? tpl.bg;
    const textColor = panelContent.textColor ?? tpl.fg;
    const accent = panelContent.accentColor ?? tpl.accent;

    // Rotation and translation: when facing !== flat we place the panel at origin unrotated
    // so single-face view shows the assembled orientation. Otherwise apply production rotation.
    const rotation = facing === "flat" ? panel.rotation : 0;
    const drawX = facing === "flat" ? offX + panel.x : offX;
    const drawY = facing === "flat" ? offY + panel.y : offY;

    parts.push(`<g id="Artwork${cap(panel.panel)}" data-layer="Artwork${cap(panel.panel)}"><title>Artwork ${panel.label}</title>`);

    if (rotation !== 0) {
      const cx = drawX + panel.w / 2;
      const cy = drawY + panel.h / 2;
      parts.push(`<g transform="rotate(${rotation} ${cx} ${cy})">`);
    }

    // Panel background
    parts.push(`<rect x="${drawX}" y="${drawY}" width="${panel.w}" height="${panel.h}" fill="${bgFill}"/>`);

    // Background image
    if (panelContent.backgroundImage) {
      const op = clamp(panelContent.backgroundImageOpacity ?? 1, 0, 1);
      parts.push(
        `<image href="${escapeAttr(panelContent.backgroundImage)}" x="${drawX}" y="${drawY}" width="${panel.w}" height="${panel.h}" opacity="${op}" preserveAspectRatio="xMidYMid slice"/>`,
      );
    }

    // Panel content
    drawPanelContent(parts, panel, {
      drawX, drawY, w: panel.w, h: panel.h,
      content: panelContent,
      qrInner, isPrint: format.medium === "print",
      textColor, accent, fontFamily,
      businessName: panelContent.showBusinessName ? business.name : "",
      logoUrl: panelContent.showLogo ? business.logoUrl : null,
      minQrSize: format.minQrSize,
    });

    if (rotation !== 0) parts.push(`</g>`);
    parts.push(`</g>`);
  }

  // Guide layers (each as its own switchable group)
  if (facing === "flat") {
    if (opts.showSafe) {
      parts.push(`<g id="SafeArea" data-layer="SafeArea"><title>SafeArea</title>`);
      for (const p of layout.panels) {
        const s = layout.safeInset;
        parts.push(`<rect x="${offX + p.x + s}" y="${offY + p.y + s}" width="${p.w - s * 2}" height="${p.h - s * 2}" fill="none" stroke="${FOLDED_COLORS.safe}" stroke-width="0.3" stroke-dasharray="1.5 1.5"/>`);
      }
      parts.push(`</g>`);
    }
    if (opts.showGlue && layout.glue) {
      const g = layout.glue;
      parts.push(
        `<g id="GlueArea" data-layer="GlueArea"><title>GlueArea</title>`,
        `<rect x="${offX + g.x}" y="${offY + g.y}" width="${g.w}" height="${g.h}" fill="${FOLDED_COLORS.glue}" fill-opacity="0.15" stroke="${FOLDED_COLORS.glue}" stroke-width="0.3" stroke-dasharray="2 2"/>`,
        `</g>`,
      );
    }
    if (opts.showScore) {
      parts.push(`<g id="ScoreLine" data-layer="ScoreLine"><title>ScoreLine</title>`);
      for (const s of layout.segments.filter((x) => x.type === "score")) {
        parts.push(segmentPath(s, offX, offY, FOLDED_COLORS.score, "1 1"));
      }
      parts.push(`</g>`);
    }
    if (opts.showFold) {
      parts.push(`<g id="FoldLine" data-layer="FoldLine"><title>FoldLine</title>`);
      for (const s of layout.segments.filter((x) => x.type === "fold")) {
        parts.push(segmentPath(s, offX, offY, FOLDED_COLORS.fold, "3 2"));
      }
      parts.push(`</g>`);
    }
    if (opts.showCut) {
      parts.push(`<g id="CutContour" data-layer="CutContour"><title>CutContour</title>`);
      for (const s of layout.segments.filter((x) => x.type === "cut")) {
        parts.push(segmentPath(s, offX, offY, FOLDED_COLORS.cut, undefined, 0.25));
      }
      parts.push(`</g>`);
    }
    if (opts.showPanelLabels) {
      parts.push(`<g id="PanelLabels" data-layer="PanelLabels"><title>PanelLabels</title>`);
      for (const p of layout.panels) {
        parts.push(
          `<text x="${offX + p.x + 2}" y="${offY + p.y + 4}" fill="${FOLDED_COLORS.panelLabel}" font-family="${escapeAttr(fontFamily)}" font-size="3" font-weight="600">${escapeText(p.label.toUpperCase())}</text>`,
        );
      }
      parts.push(`</g>`);
    }
  }

  parts.push(`</svg>`);
  void targetPanel;
  return parts.join("");
}

/** Standalone production-paths SVG (cut + fold + score + glue) for a folded format. */
export function renderFoldedProductionSvg(format: BusinessFormat): string {
  const layout = getFoldedLayout(format);
  if (!layout) return "";
  const bleed = layout.bleed;
  const totalW = layout.flatWidth + bleed * 2;
  const totalH = layout.flatHeight + bleed * 2;
  const offX = bleed, offY = bleed;
  const unit = format.medium === "print" ? "mm" : "px";
  const parts: string[] = [];
  parts.push(`<?xml version="1.0" encoding="UTF-8"?>`);
  parts.push(`<svg xmlns="http://www.w3.org/2000/svg" width="${totalW}${unit}" height="${totalH}${unit}" viewBox="0 0 ${totalW} ${totalH}">`);
  parts.push(`<g id="CutContour" data-layer="CutContour"><title>CutContour</title>`);
  for (const s of layout.segments.filter((x) => x.type === "cut")) parts.push(segmentPath(s, offX, offY, FOLDED_COLORS.cut, undefined, 0.25));
  parts.push(`</g>`);
  parts.push(`<g id="FoldLine" data-layer="FoldLine"><title>FoldLine</title>`);
  for (const s of layout.segments.filter((x) => x.type === "fold")) parts.push(segmentPath(s, offX, offY, FOLDED_COLORS.fold, "3 2"));
  parts.push(`</g>`);
  parts.push(`<g id="ScoreLine" data-layer="ScoreLine"><title>ScoreLine</title>`);
  for (const s of layout.segments.filter((x) => x.type === "score")) parts.push(segmentPath(s, offX, offY, FOLDED_COLORS.score, "1 1"));
  parts.push(`</g>`);
  parts.push(`</svg>`);
  return parts.join("");
}

/** Deterministic folded mockup — front + back proofs rendered side by side with a soft shadow. */
export async function renderFoldedMockupSvg(input: FoldedRenderInput): Promise<string> {
  const front = await renderFoldedFormatSvg(input, { facing: "front" });
  const back = await renderFoldedFormatSvg(input, { facing: "back" });
  const layout = getFoldedLayout(input.format)!;
  const w = layout.assembledWidth;
  const h = layout.assembledHeight;
  const gap = w * 0.3;
  const totalW = w * 2 + gap;
  const totalH = h + 20;
  const front64 = btoa(unescape(encodeURIComponent(front)));
  const back64 = btoa(unescape(encodeURIComponent(back)));
  const unit = input.format.medium === "print" ? "mm" : "px";
  return [
    `<?xml version="1.0" encoding="UTF-8"?>`,
    `<svg xmlns="http://www.w3.org/2000/svg" width="${totalW}${unit}" height="${totalH}${unit}" viewBox="0 0 ${totalW} ${totalH}">`,
    `<defs><filter id="sh" x="-10%" y="-10%" width="120%" height="120%"><feGaussianBlur stdDeviation="1.2"/></filter></defs>`,
    `<rect x="0" y="0" width="${totalW}" height="${totalH}" fill="#f8fafc"/>`,
    // Shadow ellipses under each face
    `<ellipse cx="${w / 2}" cy="${h + 6}" rx="${w * 0.42}" ry="1.5" fill="#0f172a" opacity="0.18" filter="url(#sh)"/>`,
    `<ellipse cx="${w + gap + w / 2}" cy="${h + 6}" rx="${w * 0.42}" ry="1.5" fill="#0f172a" opacity="0.12" filter="url(#sh)"/>`,
    // Faces, front slightly tilted forward using skew
    `<g transform="translate(0 0)"><image href="data:image/svg+xml;base64,${front64}" x="0" y="0" width="${w}" height="${h}" preserveAspectRatio="xMidYMid meet"/></g>`,
    `<g transform="translate(${w + gap} 0) skewX(-6)"><image href="data:image/svg+xml;base64,${back64}" x="0" y="0" width="${w}" height="${h}" preserveAspectRatio="xMidYMid meet" opacity="0.85"/></g>`,
    `<text x="${w / 2}" y="${h + 14}" font-family="Inter, sans-serif" font-size="4" text-anchor="middle" fill="#334155">Front</text>`,
    `<text x="${w + gap + w / 2}" y="${h + 14}" font-family="Inter, sans-serif" font-size="4" text-anchor="middle" fill="#334155">Back</text>`,
    `</svg>`,
  ].join("");
}

// ---- helpers ---------------------------------------------------------------

function drawPanelContent(
  parts: string[],
  panel: PanelRect,
  ctx: {
    drawX: number; drawY: number; w: number; h: number;
    content: FoldedPanelContent;
    qrInner: { body: string; vb: number };
    isPrint: boolean;
    textColor: string; accent: string; fontFamily: string;
    businessName: string; logoUrl: string | null;
    minQrSize: number;
  },
) {
  const { drawX, drawY, w, h, content, qrInner, isPrint, textColor, accent, fontFamily, businessName, logoUrl, minQrSize } = ctx;
  const align = content.textAlign ?? "center";
  const inset = isPrint ? 4 : 40;
  const cx = drawX + w / 2;
  const tx = align === "left" ? drawX + inset : align === "right" ? drawX + w - inset : cx;
  const anchor = align === "left" ? "start" : align === "right" ? "end" : "middle";

  // Logo
  if (logoUrl) {
    const logoSize = Math.min(w * 0.18, h * 0.14);
    const lx = tx - (align === "center" ? logoSize / 2 : align === "right" ? logoSize : 0);
    parts.push(`<image href="${escapeAttr(logoUrl)}" x="${lx}" y="${drawY + h * 0.08}" width="${logoSize}" height="${logoSize}" preserveAspectRatio="xMidYMid meet"/>`);
  }

  // Business name
  if (businessName) {
    const font = Math.max(h * 0.045, isPrint ? 4 : 24);
    parts.push(`<text x="${tx}" y="${drawY + h * 0.24}" fill="${textColor}" font-family="${escapeAttr(fontFamily)}" font-size="${font}" font-weight="700" text-anchor="${anchor}">${escapeText(businessName)}</text>`);
  }

  // QR
  if (content.showQr !== false) {
    const scale = clamp(content.qrScale ?? 0.45, 0.3, 0.7);
    const size = Math.max(Math.min(w, h) * scale, Math.min(minQrSize, Math.min(w, h) * 0.7));
    const qrX = drawX + (w - size) / 2 + (content.qrOffsetX ?? 0) * w;
    const qrY = drawY + h * 0.34 + (content.qrOffsetY ?? 0) * h;
    parts.push(`<g transform="translate(${qrX} ${qrY})"><svg width="${size}" height="${size}" viewBox="0 0 ${qrInner.vb} ${qrInner.vb}" xmlns="http://www.w3.org/2000/svg">${qrInner.body}</svg></g>`);
  }

  // Stars
  const showStars = content.showStars !== false;
  const starsY = drawY + h * 0.72;
  const starSize = Math.max(h * 0.032, isPrint ? 3 : 20);
  if (showStars) {
    const gap = starSize * 1.2;
    const totalW = gap * 5;
    const startX = cx - totalW / 2 + gap / 2;
    for (let i = 0; i < 5; i++) parts.push(starGlyph(startX + i * gap, starsY, starSize / 2, accent));
  }

  // Headline
  const headlineY = starsY + (showStars ? starSize * 1.8 : h * 0.04);
  const hf = Math.max(h * 0.055, isPrint ? 5 : 28);
  if (content.headline) parts.push(`<text x="${tx}" y="${headlineY}" fill="${textColor}" font-family="${escapeAttr(fontFamily)}" font-size="${hf}" font-weight="700" text-anchor="${anchor}">${escapeText(content.headline)}</text>`);
  const sf = Math.max(h * 0.028, isPrint ? 2.8 : 16);
  if (content.supportText) parts.push(`<text x="${tx}" y="${headlineY + sf * 1.8}" fill="${textColor}" fill-opacity="0.72" font-family="${escapeAttr(fontFamily)}" font-size="${sf}" text-anchor="${anchor}">${escapeText(content.supportText)}</text>`);
  if (content.showGoogleBadge !== false) {
    const gf = Math.max(h * 0.02, isPrint ? 2 : 12);
    parts.push(`<text x="${tx}" y="${headlineY + sf * 1.8 + gf * 2}" fill="${textColor}" fill-opacity="0.55" font-family="${escapeAttr(fontFamily)}" font-size="${gf}" text-anchor="${anchor}">on Google Reviews</text>`);
  }

  // CTA pill
  if (content.ctaText) {
    const cf = Math.max(h * 0.032, isPrint ? 3 : 18);
    const padX = cf * 1.2;
    const cw = estimateTextWidth(content.ctaText, cf) + padX * 2;
    const ch = cf * 2.4;
    const cxx = tx - (align === "center" ? cw / 2 : align === "right" ? cw : 0);
    const cy = drawY + h - ch - h * 0.06 - (content.footerText ? cf * 1.8 : 0);
    parts.push(`<rect x="${cxx}" y="${cy}" width="${cw}" height="${ch}" rx="${ch / 2}" fill="${accent}"/>`);
    parts.push(`<text x="${tx}" y="${cy + ch / 2 + cf * 0.35}" fill="${pickReadable(accent)}" font-family="${escapeAttr(fontFamily)}" font-size="${cf}" font-weight="700" text-anchor="${anchor}">${escapeText(content.ctaText)}</text>`);
  }
  if (content.footerText) {
    const ff = Math.max(h * 0.022, isPrint ? 2.2 : 13);
    parts.push(`<text x="${tx}" y="${drawY + h - h * 0.03}" fill="${textColor}" fill-opacity="0.55" font-family="${escapeAttr(fontFamily)}" font-size="${ff}" text-anchor="${anchor}">${escapeText(content.footerText)}</text>`);
  }
  void panel;
}

function mergeWithDefaults(c: FoldedPanelContent): FoldedPanelContent {
  return {
    showQr: true, showLogo: true, showBusinessName: true,
    showStars: true, showGoogleBadge: true,
    qrScale: 0.45, qrOffsetX: 0, qrOffsetY: 0,
    textAlign: "center",
    backgroundColor: null, textColor: null, accentColor: null,
    backgroundImage: null, backgroundImageOpacity: 1,
    ...c,
  };
}

function segmentPath(s: FoldSegment, offX: number, offY: number, color: string, dash?: string, width = 0.4): string {
  return `<line x1="${offX + s.x1}" y1="${offY + s.y1}" x2="${offX + s.x2}" y2="${offY + s.y2}" stroke="${color}" stroke-width="${width}"${dash ? ` stroke-dasharray="${dash}"` : ""} fill="none"/>`;
}

async function renderQrSvg(d: QrDesign, url: string, logoUrl: string | null): Promise<string> {
  const size = 512;
  const fgColorOption = d.colorMode === "gradient"
    ? { gradient: { type: d.gradientType, rotation: d.gradientRotation, colorStops: [{ offset: 0, color: d.fg }, { offset: 1, color: d.fg2 }] } }
    : { color: d.fg };
  const bgColorOption = d.transparentBg ? { color: "rgba(0,0,0,0)" } : { color: d.bg };
  const qr = new QRCodeStyling({
    width: size, height: size, type: "svg", data: url || " ", margin: d.margin,
    qrOptions: { errorCorrectionLevel: d.errorCorrection },
    image: d.logoEnabled && logoUrl ? logoUrl : undefined,
    imageOptions: { hideBackgroundDots: d.logoWhitePad, imageSize: d.logoSize, margin: d.logoMargin, crossOrigin: "anonymous" },
    dotsOptions: { type: d.dotStyle, ...fgColorOption },
    backgroundOptions: bgColorOption,
    cornersSquareOptions: { type: mapCornerSquare(d.cornerSquareStyle), color: d.fg },
    cornersDotOptions: { type: mapCornerDot(d.cornerDotStyle), color: d.fg },
  });
  const blob = (await qr.getRawData("svg")) as Blob | null;
  if (!blob) return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1 1"/>`;
  return await blob.text();
}

function extractQrInnerSvg(qrSvg: string): { body: string; vb: number } {
  const vbMatch = /viewBox="([^"]+)"/.exec(qrSvg);
  let vb = 300;
  if (vbMatch) {
    const p = vbMatch[1].split(/\s+/).map(Number);
    if (p.length === 4 && Number.isFinite(p[2])) vb = p[2];
  }
  return { body: qrSvg.replace(/^[\s\S]*?<svg[^>]*>/, "").replace(/<\/svg>\s*$/, ""), vb };
}

function starGlyph(cx: number, cy: number, r: number, color: string): string {
  const pts: string[] = [];
  for (let i = 0; i < 10; i++) {
    const rad = (Math.PI / 5) * i - Math.PI / 2;
    const rr = i % 2 === 0 ? r : r * 0.5;
    pts.push(`${cx + rr * Math.cos(rad)},${cy + rr * Math.sin(rad)}`);
  }
  return `<polygon points="${pts.join(" ")}" fill="${color}"/>`;
}
function estimateTextWidth(s: string, f: number): number { return (s?.length ?? 0) * f * 0.55; }
function escapeText(s: string): string { return s.replace(/[<>&]/g, (c) => ({ "<": "&lt;", ">": "&gt;", "&": "&amp;" }[c]!)); }
function escapeAttr(s: string): string { return s.replace(/"/g, "&quot;"); }
function clamp(v: number, lo: number, hi: number): number { return Math.max(lo, Math.min(hi, v)); }
function cap(s: string): string { return s.charAt(0).toUpperCase() + s.slice(1); }
function pickReadable(bg: string): string {
  const m = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(bg.trim());
  if (!m) return "#ffffff";
  const [r, g, b] = [parseInt(m[1], 16), parseInt(m[2], 16), parseInt(m[3], 16)];
  return (0.299 * r + 0.587 * g + 0.114 * b) / 255 > 0.6 ? "#0b0d10" : "#ffffff";
}

// Types re-exported for consumers
export type { PanelRect, FoldedLayout };
