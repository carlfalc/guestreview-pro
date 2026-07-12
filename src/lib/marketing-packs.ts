// Marketing Pack types, defaults and templates for Stage 4 builder.
import type { LayoutTemplate } from "@/lib/qr-formats";

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
    case "essential":
      return `${bn} Essential Review Pack`;
    case "restaurant":
      return `${bn} Restaurant Review Pack`;
    case "hotel":
      return `${bn} Hotel Guest Review Pack`;
    case "retail":
      return `${bn} Retail Review Pack`;
    default:
      return `${bn} Marketing Pack`;
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

export type GlobalSettings = {
  brandColor?: string;
  backgroundColor?: string;
  textColor?: string;
  accentColor?: string;
  fontFamily?: string;
  fontWeight?: string;
  textAlign?: "left" | "center" | "right";
  qrAlign?: "left" | "center" | "right";
  cornerRadius?: number;
};

export type FormatOverride = {
  headline?: string;
  supportText?: string;
  ctaText?: string;
  logoVisible?: boolean;
  qrScale?: number;
  backgroundColor?: string;
  accentColor?: string;
  hideStars?: boolean;
};

export type FormatCustomizations = Record<string, FormatOverride>;

/** Deep-clone-safe empty defaults. */
export const emptyGlobalSettings: GlobalSettings = {};
export const emptyFormatCustomizations: FormatCustomizations = {};
