// Styling schema and helpers for the QR design engine.
// Persisted as `qr_codes.design` (jsonb).

export type DotStyle =
  | "square"
  | "rounded"
  | "dots"
  | "classy"
  | "classy-rounded"
  | "extra-rounded";

export type CornerSquareStyle = "square" | "rounded" | "extra-rounded" | "dot";
export type CornerDotStyle = "square" | "dot" | "rounded";
export type ErrorCorrection = "L" | "M" | "Q" | "H";
export type ColorMode = "solid" | "gradient";
export type GradientType = "linear" | "radial";

export type QrDesign = {
  dotStyle: DotStyle;
  cornerSquareStyle: CornerSquareStyle;
  cornerDotStyle: CornerDotStyle;
  colorMode: ColorMode;
  fg: string;
  fg2: string;
  gradientType: GradientType;
  gradientRotation: number; // radians
  bg: string;
  transparentBg: boolean;
  logoEnabled: boolean;
  logoSize: number; // 0.1 – 0.4 (fraction)
  logoMargin: number; // px
  logoWhitePad: boolean;
  errorCorrection: ErrorCorrection;
  margin: number; // px (quiet zone)
};

export const DEFAULT_DESIGN: QrDesign = {
  dotStyle: "square",
  cornerSquareStyle: "square",
  cornerDotStyle: "square",
  colorMode: "solid",
  fg: "#000000",
  fg2: "#4f46e5",
  gradientType: "linear",
  gradientRotation: 0,
  bg: "#ffffff",
  transparentBg: false,
  logoEnabled: true,
  logoSize: 0.22,
  logoMargin: 6,
  logoWhitePad: true,
  errorCorrection: "H",
  margin: 8,
};

export function mergeDesign(input: Partial<QrDesign> | null | undefined): QrDesign {
  return { ...DEFAULT_DESIGN, ...(input ?? {}) };
}

// Map our (richer) UI vocabulary onto the qr-code-styling type union.
export function mapCornerSquare(v: CornerSquareStyle): "square" | "extra-rounded" | "dot" {
  if (v === "square") return "square";
  if (v === "dot") return "dot";
  return "extra-rounded"; // "rounded" and "extra-rounded" both use the library's extra-rounded
}

export function mapCornerDot(v: CornerDotStyle): "square" | "dot" {
  return v === "square" ? "square" : "dot"; // "rounded" maps to dot
}

// --- Scan safety heuristics -------------------------------------------------

function hexToRgb(hex: string): [number, number, number] {
  const m = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex.trim());
  if (!m) return [0, 0, 0];
  return [parseInt(m[1], 16), parseInt(m[2], 16), parseInt(m[3], 16)];
}

function relLuminance(hex: string): number {
  const [r, g, b] = hexToRgb(hex).map((c) => {
    const s = c / 255;
    return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

export function contrastRatio(fg: string, bg: string): number {
  const a = relLuminance(fg);
  const b = relLuminance(bg);
  const [hi, lo] = a > b ? [a, b] : [b, a];
  return (hi + 0.05) / (lo + 0.05);
}

export type ScanWarning = {
  code: "contrast" | "logo" | "quiet-zone" | "gradient-bg" | "decode-failed";
  message: string;
  severity: "warn" | "info";
};

export function computeWarnings(d: QrDesign): ScanWarning[] {
  const w: ScanWarning[] = [];
  const effectiveBg = d.transparentBg ? "#ffffff" : d.bg;
  const cr = contrastRatio(d.fg, effectiveBg);
  if (cr < 4) {
    w.push({
      code: "contrast",
      severity: "warn",
      message: `Low contrast between foreground and background (ratio ${cr.toFixed(2)}). Aim for 4+ for reliable scanning.`,
    });
  }
  if (d.logoEnabled && d.logoSize > 0.3 && d.errorCorrection !== "H") {
    w.push({
      code: "logo",
      severity: "warn",
      message: "Logo covers a large area. Increase error correction to H or reduce logo size.",
    });
  }
  if (d.logoEnabled && d.logoSize > 0.35) {
    w.push({
      code: "logo",
      severity: "warn",
      message: "Logo is very large and may prevent scanning. Reduce below 30%.",
    });
  }
  if (d.margin < 4) {
    w.push({
      code: "quiet-zone",
      severity: "warn",
      message: "Quiet zone is small. Increase margin to at least 4px for reliable scanning.",
    });
  }
  return w;
}

// --- Presets ---------------------------------------------------------------

export const PRESETS: { id: string; label: string; apply: (d: QrDesign, brand?: string | null) => QrDesign }[] = [
  {
    id: "mono",
    label: "High-contrast mono",
    apply: (d) => ({ ...d, colorMode: "solid", fg: "#000000", bg: "#ffffff", transparentBg: false }),
  },
  {
    id: "brand",
    label: "Brand colour",
    apply: (d, brand) => ({ ...d, colorMode: "solid", fg: brand || "#111111", bg: "#ffffff", transparentBg: false }),
  },
];
