// Marketing Pack types, defaults and templates for Stage 4 builder.
import type { LayoutTemplate, BusinessFormat } from "@/lib/qr-formats";
import type { BorderStyle, StarStyle, BgImageFit, FormatContent } from "@/lib/format-render";

export type PackType = "essential" | "restaurant" | "hotel" | "retail" | "custom";
export type PackStatus = "draft" | "ready" | "exported" | "archived";

export const PACK_TYPES: { id: PackType; label: string; description: string; formatIds: string[]; layout: LayoutTemplate }[] = [
  {
    id: "essential",
    label: "Essential Pack",
    description: "Sticker, counter card and A4 poster — the core review kit.",
    formatIds: ["sticker-circle-80", "sticker-sq-90", "a6-portrait", "dl-portrait", "poster-a4-p"],
    layout: "clean-minimal",
  },
  {
    id: "restaurant",
    label: "Restaurant Pack",
    description: "Table tent, counter card, window decal and posters.",
    formatIds: ["a6-portrait", "tent-a5", "dl-portrait", "window-decal-150", "poster-a4-p"],
    layout: "bold-review",
  },
  {
    id: "hotel",
    label: "Hotel Pack",
    description: "Reception sign, bedside card, key-card wallet and lift poster.",
    formatIds: ["reception-a5", "compendium-a6", "bedside-dl", "keycard-wallet", "lift-a4"],
    layout: "hospitality",
  },
  {
    id: "retail",
    label: "Retail Pack",
    description: "Circular & square stickers, counter card, window decal, poster, email signature and web badge.",
    formatIds: ["sticker-circle-80", "sticker-sq-90", "a6-portrait", "window-decal-150", "poster-a4-p", "email-signature", "web-review-badge"],
    layout: "brand-colour",
  },
  {
    id: "custom",
    label: "Start Blank",
    description: "Empty pack — pick your own formats.",
    formatIds: [],
    layout: "clean-minimal",
  },
];

export function packTypeById(id: string): (typeof PACK_TYPES)[number] | undefined {
  return PACK_TYPES.find((p) => p.id === (id as PackType));
}

export function defaultProjectName(packType: PackType, businessName: string): string {
  const bn = businessName || "Untitled";
  switch (packType) {
    case "essential": return `${bn} Essential Review Pack`;
    case "restaurant": return `${bn} Restaurant Review Pack`;
    case "hotel": return `${bn} Hotel Guest Review Pack`;
    case "retail": return `${bn} Retail Review Pack`;
    default: return `${bn} Marketing Pack`;
  }
}

export type PackStatusMeta = { label: string; badge: "default" | "secondary" | "outline" | "destructive" };
export function statusMeta(s: PackStatus): PackStatusMeta {
  switch (s) {
    case "ready": return { label: "Ready to print", badge: "default" };
    case "exported": return { label: "Exported", badge: "secondary" };
    case "archived": return { label: "Archived", badge: "outline" };
    default: return { label: "Draft", badge: "outline" };
  }
}

/** Curated font stack presets so previews and exports stay in sync. */
export const FONT_OPTIONS: { id: string; label: string; stack: string }[] = [
  { id: "inter", label: "Inter", stack: "Inter, -apple-system, system-ui, sans-serif" },
  { id: "arial", label: "Arial", stack: "Arial, Helvetica, sans-serif" },
  { id: "helvetica", label: "Helvetica", stack: "Helvetica, Arial, sans-serif" },
  { id: "georgia", label: "Georgia", stack: "Georgia, 'Times New Roman', serif" },
  { id: "times", label: "Times New Roman", stack: "'Times New Roman', Times, serif" },
  { id: "montserrat", label: "Montserrat", stack: "Montserrat, 'Helvetica Neue', Arial, sans-serif" },
  { id: "playfair", label: "Playfair Display", stack: "'Playfair Display', Georgia, serif" },
];

export function resolveFontStack(id: string | undefined): string {
  return FONT_OPTIONS.find((f) => f.id === id)?.stack ?? FONT_OPTIONS[0].stack;
}

export const STAR_STYLES: { id: StarStyle; label: string }[] = [
  { id: "solid", label: "Solid" },
  { id: "outline", label: "Outline" },
  { id: "rounded", label: "Rounded" },
  { id: "dots", label: "Minimal dots" },
  { id: "hidden", label: "Hidden" },
];

export const BORDER_STYLES: { id: BorderStyle; label: string }[] = [
  { id: "none", label: "None" },
  { id: "thin", label: "Thin ring" },
  { id: "thick", label: "Thick ring" },
  { id: "double", label: "Double ring" },
  { id: "ring-brand", label: "Brand-colour ring" },
  { id: "keyline-white", label: "White keyline" },
  { id: "keyline-black", label: "Black keyline" },
];

export type GlobalSettings = {
  brandColor?: string;
  backgroundColor?: string;
  textColor?: string;
  accentColor?: string;
  fontFamily?: string; // id from FONT_OPTIONS
  fontWeight?: string;
  textAlign?: "left" | "center" | "right";
  qrAlign?: "left" | "center" | "right";
  cornerRadius?: number;
  logoSize?: number; // 0.08..0.35
  starStyle?: StarStyle;
  borderStyle?: BorderStyle;
  backgroundImage?: string | null;
  backgroundImageOpacity?: number;
  backgroundImageFit?: BgImageFit;
};

export type FormatOverride = {
  headline?: string;
  supportText?: string;
  ctaText?: string;
  footerText?: string;
  showBusinessName?: boolean;
  logoVisible?: boolean;
  logoSize?: number;
  qrScale?: number;
  qrOffsetX?: number;
  qrOffsetY?: number;
  textAlign?: "left" | "center" | "right";
  textColor?: string;
  backgroundColor?: string;
  accentColor?: string;
  borderStyle?: BorderStyle;
  cornerRadius?: number;
  starStyle?: StarStyle;
  hideStars?: boolean;
  showGoogleBadge?: boolean;
  backgroundImage?: string | null;
  backgroundImageOpacity?: number;
  fontFamily?: string;
};

export type FormatCustomizations = Record<string, FormatOverride>;

export const emptyGlobalSettings: GlobalSettings = {};
export const emptyFormatCustomizations: FormatCustomizations = {};

export type ContentBase = {
  businessName: string;
  logoUrl: string | null;
  headline: string;
  supportText: string;
  ctaText: string;
  footerText?: string;
  showBusinessName: boolean;
  showLogo: boolean;
  showStars: boolean;
  showGoogleBadge: boolean;
};

/**
 * Merge base pack content + global settings + per-format override into the
 * FormatContent shape consumed by renderFormatSvg. Applied everywhere previews
 * and exports read from — a single source of truth.
 */
export function buildFormatContent(
  base: ContentBase,
  global: GlobalSettings,
  override: FormatOverride | undefined,
): FormatContent {
  const showBusinessName = override?.showBusinessName ?? base.showBusinessName;
  const showLogo = override?.logoVisible ?? base.showLogo;
  const baseStars = base.showStars && override?.hideStars !== true;
  const starStyle: StarStyle = override?.starStyle ?? global.starStyle ?? (baseStars ? "solid" : "hidden");
  const showStars = baseStars && starStyle !== "hidden";
  const showGoogleBadge = override?.showGoogleBadge ?? base.showGoogleBadge;
  const fontId = override?.fontFamily ?? global.fontFamily;
  return {
    businessName: showBusinessName ? base.businessName : "",
    logoUrl: showLogo ? base.logoUrl : null,
    headline: override?.headline ?? base.headline,
    supportText: override?.supportText ?? base.supportText,
    ctaText: override?.ctaText ?? base.ctaText,
    footerText: override?.footerText ?? base.footerText,
    showStars,
    showGoogleBadge,
    textAlign: override?.textAlign ?? global.textAlign ?? "center",
    qrAlign: global.qrAlign ?? "center",
    fontWeight: global.fontWeight ?? "600",
    fontFamily: resolveFontStack(fontId),
    starStyle,
    borderStyle: override?.borderStyle ?? global.borderStyle ?? "none",
    cornerRadius: override?.cornerRadius ?? global.cornerRadius,
    logoSize: override?.logoSize ?? global.logoSize,
    backgroundImage: override?.backgroundImage ?? global.backgroundImage ?? null,
    backgroundImageOpacity: override?.backgroundImageOpacity ?? global.backgroundImageOpacity,
    backgroundImageFit: global.backgroundImageFit,
    colors: {
      bg: override?.backgroundColor ?? global.backgroundColor,
      fg: override?.textColor ?? global.textColor,
      accent: override?.accentColor ?? global.accentColor ?? global.brandColor,
    },
    qrScale: override?.qrScale,
    qrOffsetX: override?.qrOffsetX,
    qrOffsetY: override?.qrOffsetY,
  };
}

/** Formats considered "similar" for copying overrides: same shape, category, and orientation. */
export function similarFormats(target: BusinessFormat, all: BusinessFormat[]): BusinessFormat[] {
  const orient = (f: BusinessFormat) => (f.width === f.height ? "square" : f.width > f.height ? "landscape" : "portrait");
  const t = orient(target);
  return all.filter((f) => f.id !== target.id && f.shape === target.shape && f.category === target.category && orient(f) === t);
}
