// Real folded (table-tent) production geometry — panels, fold/score/cut lines,
// glue areas, safe areas. Coordinates are in the format's native units (mm for
// print, px for digital) inside the trim rectangle (bleed handled separately).

import type { BusinessFormat } from "@/lib/qr-formats";
import { FORMATS } from "@/lib/qr-formats";

export type FoldedMode = "same_both_sides" | "mirrored" | "different_sides";
export type FoldedPanel = "front" | "back" | "base" | "glue";
export type FoldLineType = "fold" | "score" | "cut";

export type PanelRect = {
  /** Panel identifier. */
  panel: FoldedPanel;
  /** Top-left corner within the trim rectangle. */
  x: number;
  y: number;
  w: number;
  h: number;
  /** Rotation applied when rendering content into this panel (degrees). */
  rotation: 0 | 90 | 180 | 270;
  /** Human label for previews and notes. */
  label: string;
};

export type FoldSegment = {
  type: FoldLineType;
  x1: number;
  y1: number;
  x2: number;
  y2: number;
};

export type FoldedLayout = {
  formatId: string;
  /** Flat artwork width (trim). */
  flatWidth: number;
  /** Flat artwork height (trim). */
  flatHeight: number;
  /** Bleed in the format's units. */
  bleed: number;
  /** Assembled/visible finished dimensions of a single face. */
  assembledWidth: number;
  assembledHeight: number;
  /** Per-panel safe-area inset. */
  safeInset: number;
  panels: PanelRect[];
  segments: FoldSegment[];
  /** Optional glue/overlap rectangle. */
  glue?: PanelRect;
  /** Notes to show in the Structure tab and print notes. */
  notes: string[];
};

/** Two-panel horizontal-fold tent: front (bottom half) + back (top half, rotated 180°). */
function twoPanelTent(format: BusinessFormat): FoldedLayout {
  const w = format.width;
  const h = format.height;
  const foldY = h / 2;
  const safeInset = 4;
  const back: PanelRect = {
    panel: "back",
    x: 0, y: 0, w, h: foldY,
    rotation: 180,
    label: "Back face",
  };
  const front: PanelRect = {
    panel: "front",
    x: 0, y: foldY, w, h: foldY,
    rotation: 0,
    label: "Front face",
  };
  const segments: FoldSegment[] = [
    { type: "fold", x1: 0, y1: foldY, x2: w, y2: foldY },
    { type: "score", x1: 0, y1: foldY, x2: w, y2: foldY },
    // Trim outline
    { type: "cut", x1: 0, y1: 0, x2: w, y2: 0 },
    { type: "cut", x1: w, y1: 0, x2: w, y2: h },
    { type: "cut", x1: w, y1: h, x2: 0, y2: h },
    { type: "cut", x1: 0, y1: h, x2: 0, y2: 0 },
  ];
  return {
    formatId: format.id,
    flatWidth: w,
    flatHeight: h,
    bleed: format.bleed,
    assembledWidth: w,
    assembledHeight: foldY,
    safeInset,
    panels: [back, front],
    segments,
    notes: [
      "Two-panel tent: fold along the horizontal centre line.",
      "Back panel is rotated 180° on the flat sheet so it reads upright when the tent stands.",
      "Score before folding for a clean crease on 300–350 gsm silk card.",
    ],
  };
}

export function getFoldedLayout(format: BusinessFormat | string): FoldedLayout | null {
  const f = typeof format === "string" ? FORMATS.find((x) => x.id === format) : format;
  if (!f || !f.folded) return null;
  // All current folded formats are two-panel tents.
  return twoPanelTent(f);
}

export function getPanelRect(format: BusinessFormat, panel: FoldedPanel): PanelRect | null {
  const l = getFoldedLayout(format);
  if (!l) return null;
  return l.panels.find((p) => p.panel === panel) ?? l.glue ?? null;
}

export function getPanelSafeArea(format: BusinessFormat, panel: FoldedPanel): PanelRect | null {
  const r = getPanelRect(format, panel);
  if (!r) return null;
  const s = getFoldedLayout(format)?.safeInset ?? 4;
  return { ...r, x: r.x + s, y: r.y + s, w: Math.max(0, r.w - s * 2), h: Math.max(0, r.h - s * 2) };
}

export function getFoldLines(format: BusinessFormat): FoldSegment[] {
  return getFoldedLayout(format)?.segments.filter((s) => s.type === "fold") ?? [];
}
export function getScoreLines(format: BusinessFormat): FoldSegment[] {
  return getFoldedLayout(format)?.segments.filter((s) => s.type === "score") ?? [];
}
export function getCutLines(format: BusinessFormat): FoldSegment[] {
  return getFoldedLayout(format)?.segments.filter((s) => s.type === "cut") ?? [];
}
export function getGlueArea(format: BusinessFormat): PanelRect | null {
  return getFoldedLayout(format)?.glue ?? null;
}

/** True if a point lies inside the panel rectangle. */
export function pointInPanel(p: PanelRect, x: number, y: number): boolean {
  return x >= p.x && x <= p.x + p.w && y >= p.y && y <= p.y + p.h;
}

/** Return the panel that contains a given point, if any. */
export function panelForPoint(format: BusinessFormat, x: number, y: number): PanelRect | null {
  const l = getFoldedLayout(format);
  if (!l) return null;
  return l.panels.find((p) => pointInPanel(p, x, y)) ?? null;
}
