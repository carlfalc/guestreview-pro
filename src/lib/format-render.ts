import QRCodeStyling from "qr-code-styling";
import type { QrDesign } from "@/lib/qr-design";
import { mapCornerDot, mapCornerSquare } from "@/lib/qr-design";
import type { BusinessFormat, LayoutTemplate } from "@/lib/qr-formats";
import { safeArea, templateColors } from "@/lib/qr-formats";

export type FormatContent = {
  businessName: string;
  logoUrl: string | null;
  headline: string;
  supportText: string;
  ctaText: string;
  footerText?: string;
  showStars?: boolean;
  showGoogleBadge?: boolean;
  textAlign?: "left" | "center" | "right";
  qrAlign?: "left" | "center" | "right";
  fontWeight?: string;
  /** Global overrides for template colors. Undefined = keep template default. */
  colors?: { bg?: string; fg?: string; accent?: string };
  /** 0.3..0.7 scale of format width; undefined = 0.45 default. */
  qrScale?: number;
};

/** Render a business format as an SVG string. */
export async function renderFormatSvg(
  format: BusinessFormat,
  template: LayoutTemplate,
  content: FormatContent,
  qrDesign: QrDesign,
  qrData: string,
  logoUrl: string | null,
  brand: string,
  opts: { showBoundaries?: boolean; includeBleed?: boolean } = {},
): Promise<string> {
  const tpl = templateColors(template, brand);
  const bgFill = content.colors?.bg ?? tpl.bg;
  const textColor = content.colors?.fg ?? tpl.fg;
  const accent = content.colors?.accent ?? tpl.accent;

  const includeBleed = opts.includeBleed ?? false;
  const bleed = includeBleed ? format.bleed : 0;
  const unit = format.medium === "print" ? "mm" : "px";
  const totalW = format.width + bleed * 2;
  const totalH = format.height + bleed * 2;
  const offX = bleed;
  const offY = bleed;

  const qrSvg = await renderQrSvg(qrDesign, qrData, logoUrl);

  const isCircular = format.shape === "circular";
  const isFolded = format.folded === true;
  const displayH = isFolded ? format.height / 2 : format.height;

  const qrScale = clamp(content.qrScale ?? 0.45, 0.3, 0.7);
  const qrSize = Math.max(
    Math.min(format.width * qrScale, displayH * qrScale),
    Math.min(format.minQrSize, Math.min(format.width, displayH) * 0.7),
  );
  const qrAlign = content.qrAlign ?? "center";
  const inset = format.medium === "print" ? 4 : 40;
  const qrX = qrAlign === "left" ? offX + inset
    : qrAlign === "right" ? offX + format.width - qrSize - inset
    : offX + (format.width - qrSize) / 2;
  const qrY = offY + displayH * (isCircular ? 0.32 : 0.28);

  const cx = offX + format.width / 2;
  const textAlign = content.textAlign ?? "center";
  const tx = textAlign === "left" ? offX + inset
    : textAlign === "right" ? offX + format.width - inset
    : cx;
  const textAnchor = textAlign === "left" ? "start" : textAlign === "right" ? "end" : "middle";
  const fontWeight = content.fontWeight ?? "700";

  const parts: string[] = [];
  parts.push(`<?xml version="1.0" encoding="UTF-8"?>`);
  parts.push(
    `<svg xmlns="http://www.w3.org/2000/svg" width="${totalW}${unit}" height="${totalH}${unit}" viewBox="0 0 ${totalW} ${totalH}">`,
  );

  if (isCircular) {
    parts.push(`<rect x="0" y="0" width="${totalW}" height="${totalH}" fill="${includeBleed ? bgFill : "none"}"/>`);
    parts.push(`<circle cx="${cx}" cy="${offY + format.height / 2}" r="${format.width / 2}" fill="${bgFill}"/>`);
  } else {
    parts.push(`<rect x="0" y="0" width="${totalW}" height="${totalH}" fill="${bgFill}"/>`);
    if (isFolded) {
      parts.push(`<line x1="${offX}" y1="${offY + format.height / 2}" x2="${offX + format.width}" y2="${offY + format.height / 2}" stroke="${textColor}" stroke-opacity="0.15" stroke-dasharray="2 2"/>`);
    }
  }

  // Logo
  if (content.logoUrl) {
    const logoSize = Math.min(format.width * 0.18, displayH * 0.14);
    const logoX = tx - (textAlign === "center" ? logoSize / 2 : textAlign === "right" ? logoSize : 0);
    const logoY = offY + displayH * 0.08;
    parts.push(
      `<image href="${escapeAttr(content.logoUrl)}" x="${logoX}" y="${logoY}" width="${logoSize}" height="${logoSize}" preserveAspectRatio="xMidYMid meet"/>`,
    );
  }

  // Business name
  if (content.businessName) {
    const nameFont = Math.max(displayH * 0.045, format.medium === "print" ? 4 : 24);
    parts.push(
      `<text x="${tx}" y="${offY + displayH * 0.22}" fill="${textColor}" font-family="Inter, -apple-system, system-ui, sans-serif" font-size="${nameFont}" font-weight="${fontWeight}" text-anchor="${textAnchor}">${escapeText(content.businessName)}</text>`,
    );
  }

  // QR
  const qrInner = extractQrInnerSvg(qrSvg);
  parts.push(
    `<g transform="translate(${qrX} ${qrY})"><svg width="${qrSize}" height="${qrSize}" viewBox="0 0 ${qrInner.vb} ${qrInner.vb}" xmlns="http://www.w3.org/2000/svg">${qrInner.body}</svg></g>`,
  );

  // Stars
  const starsY = qrY + qrSize + displayH * 0.05;
  const starSize = Math.max(displayH * 0.03, format.medium === "print" ? 4 : 22);
  if (content.showStars !== false) {
    const starGap = starSize * 1.2;
    const starsW = starGap * 5;
    const starStartX = cx - starsW / 2 + starGap / 2;
    for (let i = 0; i < 5; i++) {
      parts.push(starPath(starStartX + i * starGap, starsY, starSize / 2, accent));
    }
  }

  // Headline
  const headlineY = starsY + (content.showStars !== false ? starSize * 1.6 : 0);
  const headlineFont = Math.max(displayH * 0.055, format.medium === "print" ? 5 : 28);
  if (content.headline) {
    parts.push(
      `<text x="${tx}" y="${headlineY}" fill="${textColor}" font-family="Inter, sans-serif" font-size="${headlineFont}" font-weight="${fontWeight}" text-anchor="${textAnchor}">${escapeText(content.headline)}</text>`,
    );
  }

  // Support text
  const supportFont = Math.max(displayH * 0.028, format.medium === "print" ? 2.8 : 16);
  if (content.supportText) {
    parts.push(
      `<text x="${tx}" y="${headlineY + supportFont * 1.6}" fill="${textColor}" fill-opacity="0.7" font-family="Inter, sans-serif" font-size="${supportFont}" text-anchor="${textAnchor}">${escapeText(content.supportText)}</text>`,
    );
  }

  // Google badge
  if (content.showGoogleBadge) {
    const gbFont = Math.max(displayH * 0.02, format.medium === "print" ? 2 : 12);
    parts.push(
      `<text x="${tx}" y="${headlineY + supportFont * 1.6 + gbFont * 2}" fill="${textColor}" fill-opacity="0.55" font-family="Inter, sans-serif" font-size="${gbFont}" text-anchor="${textAnchor}">on Google Reviews</text>`,
    );
  }

  // CTA pill
  const ctaFont = Math.max(displayH * 0.032, format.medium === "print" ? 3 : 18);
  const ctaPadX = ctaFont * 1.2;
  const ctaW = estimateTextWidth(content.ctaText, ctaFont) + ctaPadX * 2;
  const ctaH = ctaFont * 2.4;
  const ctaX = tx - (textAlign === "center" ? ctaW / 2 : textAlign === "right" ? ctaW : 0);
  const footerFont = Math.max(displayH * 0.022, format.medium === "print" ? 2.2 : 13);
  const footerLine = content.footerText ? footerFont * 1.8 : 0;
  const ctaY = offY + displayH - ctaH - displayH * 0.06 - footerLine;
  if (content.ctaText) {
    parts.push(
      `<rect x="${ctaX}" y="${ctaY}" width="${ctaW}" height="${ctaH}" rx="${ctaH / 2}" fill="${accent}"/>`,
    );
    parts.push(
      `<text x="${tx}" y="${ctaY + ctaH / 2 + ctaFont * 0.35}" fill="${pickReadableText(accent)}" font-family="Inter, sans-serif" font-size="${ctaFont}" font-weight="${fontWeight}" text-anchor="${textAnchor}">${escapeText(content.ctaText)}</text>`,
    );
  }

  // Footer
  if (content.footerText) {
    parts.push(
      `<text x="${tx}" y="${offY + displayH - displayH * 0.03}" fill="${textColor}" fill-opacity="0.55" font-family="Inter, sans-serif" font-size="${footerFont}" text-anchor="${textAnchor}">${escapeText(content.footerText)}</text>`,
    );
  }

  if (opts.showBoundaries) {
    if (isCircular) {
      parts.push(`<circle cx="${cx}" cy="${offY + format.height / 2}" r="${format.width / 2}" fill="none" stroke="#3b82f6" stroke-width="0.4" stroke-dasharray="2 2"/>`);
    } else {
      parts.push(`<rect x="${offX}" y="${offY}" width="${format.width}" height="${format.height}" fill="none" stroke="#3b82f6" stroke-width="0.4" stroke-dasharray="2 2"/>`);
    }
    if (includeBleed && format.bleed > 0) {
      parts.push(`<rect x="0" y="0" width="${totalW}" height="${totalH}" fill="none" stroke="#ef4444" stroke-width="0.4" stroke-dasharray="1 1"/>`);
    }
    const sa = safeArea(format);
    parts.push(`<rect x="${offX + (format.width - sa.w) / 2}" y="${offY + (format.height - sa.h) / 2}" width="${sa.w}" height="${sa.h}" fill="none" stroke="#22c55e" stroke-width="0.3" stroke-dasharray="1.5 1.5"/>`);
  }

  parts.push(`</svg>`);
  return parts.join("");
}

function extractQrInnerSvg(qrSvg: string): { body: string; vb: number } {
  const vbMatch = /viewBox="([^"]+)"/.exec(qrSvg);
  const wMatch = /width="([\d.]+)"/.exec(qrSvg);
  let vb = 300;
  if (vbMatch) {
    const parts = vbMatch[1].split(/\s+/).map(Number);
    if (parts.length === 4 && Number.isFinite(parts[2])) vb = parts[2];
  } else if (wMatch) {
    vb = Number(wMatch[1]);
  }
  const body = qrSvg.replace(/^[\s\S]*?<svg[^>]*>/, "").replace(/<\/svg>\s*$/, "");
  return { body, vb };
}

async function renderQrSvg(d: QrDesign, url: string, logoUrl: string | null): Promise<string> {
  const size = 512;
  const fgColorOption = d.colorMode === "gradient"
    ? { gradient: { type: d.gradientType, rotation: d.gradientRotation, colorStops: [{ offset: 0, color: d.fg }, { offset: 1, color: d.fg2 }] } }
    : { color: d.fg };
  const bgColorOption = d.transparentBg ? { color: "rgba(0,0,0,0)" } : { color: d.bg };
  const qr = new QRCodeStyling({
    width: size,
    height: size,
    type: "svg",
    data: url || " ",
    margin: d.margin,
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

export async function svgToPng(svg: string, targetWpx: number, targetHpx: number): Promise<Blob> {
  const url = URL.createObjectURL(new Blob([svg], { type: "image/svg+xml;charset=utf-8" }));
  try {
    const img = new Image();
    img.crossOrigin = "anonymous";
    await new Promise<void>((resolve, reject) => {
      img.onload = () => resolve();
      img.onerror = () => reject(new Error("svg image failed"));
      img.src = url;
    });
    const canvas = document.createElement("canvas");
    canvas.width = Math.round(targetWpx);
    canvas.height = Math.round(targetHpx);
    const ctx = canvas.getContext("2d")!;
    ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
    return await new Promise<Blob>((resolve) => canvas.toBlob((b) => resolve(b!), "image/png", 1)!);
  } finally {
    URL.revokeObjectURL(url);
  }
}

export function pxFor(format: BusinessFormat, dpi = 300): { w: number; h: number } {
  if (format.medium === "digital") return { w: format.width, h: format.height };
  const mmToIn = 1 / 25.4;
  return { w: Math.round(format.width * mmToIn * dpi), h: Math.round(format.height * mmToIn * dpi) };
}

function starPath(cx: number, cy: number, r: number, color: string): string {
  const points: string[] = [];
  const outer = r;
  const inner = r * 0.5;
  for (let i = 0; i < 10; i++) {
    const rad = (Math.PI / 5) * i - Math.PI / 2;
    const rr = i % 2 === 0 ? outer : inner;
    points.push(`${cx + rr * Math.cos(rad)},${cy + rr * Math.sin(rad)}`);
  }
  return `<polygon points="${points.join(" ")}" fill="${color}"/>`;
}

function escapeText(s: string): string { return s.replace(/[<>&]/g, (c) => ({ "<": "&lt;", ">": "&gt;", "&": "&amp;" }[c]!)); }
function escapeAttr(s: string): string { return s.replace(/"/g, "&quot;"); }
function estimateTextWidth(s: string, fontSize: number): number { return s.length * fontSize * 0.55; }
function clamp(v: number, lo: number, hi: number): number { return Math.max(lo, Math.min(hi, v)); }
function pickReadableText(bg: string): string {
  const m = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(bg.trim());
  if (!m) return "#ffffff";
  const [r, g, b] = [parseInt(m[1], 16), parseInt(m[2], 16), parseInt(m[3], 16)];
  const lum = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
  return lum > 0.6 ? "#0b0d10" : "#ffffff";
}
