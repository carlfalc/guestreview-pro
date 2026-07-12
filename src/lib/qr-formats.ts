// Business format catalogue for QR marketing packs.
// Persisted per QR as `selected_formats` (jsonb, array of format IDs).

export type FormatShape = "circular" | "square" | "portrait" | "landscape" | "folded";
export type FormatCategory = "sticker" | "counter" | "poster" | "hotel" | "digital";
export type FormatMedium = "print" | "digital";

export type BusinessFormat = {
  id: string;
  name: string;
  category: FormatCategory;
  shape: FormatShape;
  medium: FormatMedium;
  /** Width in mm for print, or pixels for digital. */
  width: number;
  /** Height in mm for print, or pixels for digital. Equal to width for circular. */
  height: number;
  /** Bleed in mm. 0 for digital or stickers cut in-house. */
  bleed: number;
  /** Recommended QR min size in mm (or px for digital). */
  minQrSize: number;
  /** Recommended material or medium description. */
  material: string;
  /** True for folded pieces (table tents). */
  folded?: boolean;
};

export const FORMATS: BusinessFormat[] = [
  // STICKERS
  { id: "sticker-circle-60", name: "Circular sticker 60 mm", category: "sticker", shape: "circular", medium: "print", width: 60, height: 60, bleed: 3, minQrSize: 30, material: "Vinyl, matte laminate" },
  { id: "sticker-circle-80", name: "Circular sticker 80 mm", category: "sticker", shape: "circular", medium: "print", width: 80, height: 80, bleed: 3, minQrSize: 40, material: "Vinyl, matte laminate" },
  { id: "sticker-circle-100", name: "Circular sticker 100 mm", category: "sticker", shape: "circular", medium: "print", width: 100, height: 100, bleed: 3, minQrSize: 55, material: "Vinyl, matte laminate" },
  { id: "sticker-sq-60", name: "Square sticker 60 × 60 mm", category: "sticker", shape: "square", medium: "print", width: 60, height: 60, bleed: 3, minQrSize: 30, material: "Vinyl, matte laminate" },
  { id: "sticker-sq-90", name: "Square sticker 90 × 90 mm", category: "sticker", shape: "square", medium: "print", width: 90, height: 90, bleed: 3, minQrSize: 45, material: "Vinyl, matte laminate" },
  { id: "sticker-sq-100", name: "Square sticker 100 × 100 mm", category: "sticker", shape: "square", medium: "print", width: 100, height: 100, bleed: 3, minQrSize: 55, material: "Vinyl, matte laminate" },
  { id: "sticker-rect-100x70", name: "Rectangular sticker 100 × 70 mm", category: "sticker", shape: "landscape", medium: "print", width: 100, height: 70, bleed: 3, minQrSize: 35, material: "Vinyl, matte laminate" },
  { id: "window-decal-150", name: "Window decal 150 × 150 mm", category: "sticker", shape: "square", medium: "print", width: 150, height: 150, bleed: 3, minQrSize: 70, material: "Static-cling window vinyl" },

  // COUNTER AND TABLE
  { id: "a6-portrait", name: "A6 portrait counter card", category: "counter", shape: "portrait", medium: "print", width: 105, height: 148, bleed: 3, minQrSize: 40, material: "350 gsm silk card" },
  { id: "a6-landscape", name: "A6 landscape counter card", category: "counter", shape: "landscape", medium: "print", width: 148, height: 105, bleed: 3, minQrSize: 40, material: "350 gsm silk card" },
  { id: "dl-portrait", name: "DL portrait counter card", category: "counter", shape: "portrait", medium: "print", width: 99, height: 210, bleed: 3, minQrSize: 40, material: "350 gsm silk card" },
  { id: "dl-landscape", name: "DL landscape counter card", category: "counter", shape: "landscape", medium: "print", width: 210, height: 99, bleed: 3, minQrSize: 40, material: "350 gsm silk card" },
  { id: "tent-a5", name: "Folded A5 table tent", category: "counter", shape: "folded", medium: "print", width: 148, height: 420, bleed: 3, minQrSize: 45, material: "350 gsm silk, scored + folded", folded: true },
  { id: "tent-a6", name: "Folded A6 table tent", category: "counter", shape: "folded", medium: "print", width: 105, height: 296, bleed: 3, minQrSize: 35, material: "350 gsm silk, scored + folded", folded: true },
  { id: "acrylic-a6", name: "Acrylic stand insert A6", category: "counter", shape: "portrait", medium: "print", width: 105, height: 148, bleed: 0, minQrSize: 40, material: "Insert for acrylic stand" },
  { id: "acrylic-dl", name: "Acrylic stand insert DL", category: "counter", shape: "portrait", medium: "print", width: 99, height: 210, bleed: 0, minQrSize: 40, material: "Insert for acrylic stand" },

  // POSTERS
  { id: "poster-a5-p", name: "A5 portrait poster", category: "poster", shape: "portrait", medium: "print", width: 148, height: 210, bleed: 3, minQrSize: 55, material: "170 gsm silk poster" },
  { id: "poster-a4-p", name: "A4 portrait poster", category: "poster", shape: "portrait", medium: "print", width: 210, height: 297, bleed: 3, minQrSize: 75, material: "170 gsm silk poster" },
  { id: "poster-a3-p", name: "A3 portrait poster", category: "poster", shape: "portrait", medium: "print", width: 297, height: 420, bleed: 3, minQrSize: 100, material: "170 gsm silk poster" },
  { id: "poster-a4-l", name: "A4 landscape poster", category: "poster", shape: "landscape", medium: "print", width: 297, height: 210, bleed: 3, minQrSize: 75, material: "170 gsm silk poster" },

  // HOTEL
  { id: "bedside-dl", name: "Bedside DL card", category: "hotel", shape: "portrait", medium: "print", width: 99, height: 210, bleed: 3, minQrSize: 40, material: "350 gsm silk card" },
  { id: "compendium-a6", name: "A6 room compendium insert", category: "hotel", shape: "portrait", medium: "print", width: 105, height: 148, bleed: 3, minQrSize: 40, material: "350 gsm silk insert" },
  { id: "keycard-wallet", name: "Key-card wallet insert", category: "hotel", shape: "landscape", medium: "print", width: 86, height: 54, bleed: 2, minQrSize: 25, material: "300 gsm insert card" },
  { id: "lift-a4", name: "A4 lift poster", category: "hotel", shape: "portrait", medium: "print", width: 210, height: 297, bleed: 3, minQrSize: 75, material: "170 gsm silk poster" },
  { id: "reception-a5", name: "A5 reception sign", category: "hotel", shape: "portrait", medium: "print", width: 148, height: 210, bleed: 3, minQrSize: 55, material: "Foamex or acrylic sign" },
  { id: "mirror-100", name: "100 × 100 mm bathroom mirror sticker", category: "hotel", shape: "square", medium: "print", width: 100, height: 100, bleed: 3, minQrSize: 45, material: "Waterproof vinyl" },

  // DIGITAL (dimensions in pixels)
  { id: "ig-story", name: "Instagram Story", category: "digital", shape: "portrait", medium: "digital", width: 1080, height: 1920, bleed: 0, minQrSize: 500, material: "1080 × 1920 px, JPG/PNG" },
  { id: "fb-portrait", name: "Facebook portrait", category: "digital", shape: "portrait", medium: "digital", width: 1080, height: 1350, bleed: 0, minQrSize: 460, material: "1080 × 1350 px, JPG/PNG" },
  { id: "email-signature", name: "Email signature banner", category: "digital", shape: "landscape", medium: "digital", width: 600, height: 200, bleed: 0, minQrSize: 160, material: "600 × 200 px, PNG" },
  { id: "web-review-badge", name: "Website review badge", category: "digital", shape: "square", medium: "digital", width: 400, height: 400, bleed: 0, minQrSize: 220, material: "400 × 400 px, PNG" },
  { id: "sms-card", name: "SMS review card", category: "digital", shape: "landscape", medium: "digital", width: 1200, height: 630, bleed: 0, minQrSize: 340, material: "1200 × 630 px, PNG" },
];

export function safeArea(f: BusinessFormat): { w: number; h: number } {
  // Safe area = 4mm from edge for print (or 40px for digital)
  const inset = f.medium === "print" ? 4 : 40;
  return { w: Math.max(0, f.width - inset * 2), h: Math.max(0, f.height - inset * 2) };
}

export type QuickPack = { id: string; name: string; formatIds: string[] };

export const QUICK_PACKS: QuickPack[] = [
  {
    id: "essential",
    name: "Essential pack",
    formatIds: ["sticker-circle-80", "sticker-sq-90", "a6-portrait", "dl-portrait", "poster-a4-p"],
  },
  {
    id: "restaurant",
    name: "Restaurant pack",
    formatIds: ["a6-portrait", "tent-a5", "dl-portrait", "window-decal-150", "poster-a4-p"],
  },
  {
    id: "hotel",
    name: "Hotel pack",
    formatIds: ["reception-a5", "compendium-a6", "bedside-dl", "keycard-wallet", "lift-a4"],
  },
  {
    id: "retail",
    name: "Retail pack",
    formatIds: ["sticker-circle-80", "sticker-sq-90", "a6-portrait", "window-decal-150", "poster-a4-p", "email-signature", "web-review-badge"],
  },
];

export type LayoutTemplate =
  | "clean-minimal"
  | "premium-dark"
  | "brand-colour"
  | "hospitality"
  | "bold-review"
  | "window-sticker"
  | "circular-sticker";

export const LAYOUT_TEMPLATES: { id: LayoutTemplate; label: string; description: string }[] = [
  { id: "clean-minimal", label: "Clean minimal", description: "White, minimal type, quiet." },
  { id: "premium-dark", label: "Premium dark", description: "Dark background with light QR." },
  { id: "brand-colour", label: "Brand colour", description: "Uses your business brand colour." },
  { id: "hospitality", label: "Hospitality", description: "Warm accent, welcoming tone." },
  { id: "bold-review", label: "Bold review", description: "Bold CTA, five-star hero." },
  { id: "window-sticker", label: "Window sticker", description: "Optimised for window vinyl." },
  { id: "circular-sticker", label: "Circular sticker", description: "Centred, radial layout." },
];

export type TemplateColors = { bg: string; fg: string; accent: string; qrFg: string; qrBg: string };

export function templateColors(t: LayoutTemplate, brand: string): TemplateColors {
  switch (t) {
    case "premium-dark":
      return { bg: "#0b0d10", fg: "#ffffff", accent: brand, qrFg: "#ffffff", qrBg: "#0b0d10" };
    case "brand-colour":
      return { bg: brand, fg: "#ffffff", accent: "#ffffff", qrFg: "#0b0d10", qrBg: "#ffffff" };
    case "hospitality":
      return { bg: "#f6efe6", fg: "#1a1a1a", accent: brand, qrFg: "#1a1a1a", qrBg: "#f6efe6" };
    case "bold-review":
      return { bg: "#ffffff", fg: "#0b0d10", accent: "#fbbf24", qrFg: "#0b0d10", qrBg: "#ffffff" };
    case "window-sticker":
      return { bg: "#ffffff", fg: "#0b0d10", accent: brand, qrFg: "#0b0d10", qrBg: "#ffffff" };
    case "circular-sticker":
      return { bg: "#ffffff", fg: "#0b0d10", accent: brand, qrFg: "#0b0d10", qrBg: "#ffffff" };
    default:
      return { bg: "#ffffff", fg: "#0b0d10", accent: brand, qrFg: "#0b0d10", qrBg: "#ffffff" };
  }
}

export const SHAPE_FILTERS: FormatShape[] = ["circular", "square", "portrait", "landscape", "folded"];
export const CATEGORY_FILTERS: FormatCategory[] = ["sticker", "counter", "poster", "hotel", "digital"];
