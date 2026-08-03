import { useMemo } from "react";
import { FORMATS, templateColors, type LayoutTemplate } from "@/lib/qr-formats";
import venueAsset from "@/assets/venue-interior.jpg.asset.json";

/**
 * Marketing-grade artwork preview shared by every public page.
 *
 * Rendered as inline SVG at the real trim proportions from the format
 * catalogue, so what a visitor sees matches the geometry of a production
 * export. No `qr-code-styling` on the public bundle, no layout shift, one
 * shared photo.
 *
 * Layout is a single vertical flow inside the format's safe area: rows are
 * allocated as fractions of the safe height, type is sized from its own row
 * and then shrunk to fit the safe width, and every face is clipped to the die
 * shape. That combination is what keeps text off the bleed and cut lines on
 * circular, small and folded formats alike.
 *
 * The module grid is deterministic decorative art — previews are artwork, not
 * scannable codes.
 */

export type ArtworkVariant = "photo" | "clean";

export interface ArtworkContent {
  business: string;
  headline: string;
  subline: string;
  cta: string;
  footer: string;
  accent: string;
}

/** Mirrors the production "premium dark" pack used as the design reference. */
export const DEMO_BRAND: ArtworkContent = {
  business: "Harbour Lane",
  headline: "Loved your visit?",
  subline: "Scan to leave us a review.",
  cta: "Leave a review",
  footer: "Thank you for supporting us",
  accent: "#1f4d3a",
};

const PHOTO_URL = venueAsset.url;
const FONT = "system-ui, -apple-system, Segoe UI, sans-serif";

/** Layouts that read best over a photograph. */
const PHOTO_LAYOUTS: LayoutTemplate[] = ["premium-dark", "hospitality"];

type Modules = { size: number; cells: boolean[] };

function useModules(seedKey: string, size = 21): Modules {
  return useMemo(() => {
    let seed = 7;
    for (const ch of seedKey) seed = (seed * 31 + ch.charCodeAt(0)) % 100000;
    const cells: boolean[] = [];
    for (let i = 0; i < size * size; i++) {
      seed = (seed * 1103515245 + 12345) % 2147483648;
      cells.push((seed >> 9) % 100 > 47);
    }
    return { size, cells };
  }, [seedKey, size]);
}

/** Shrink a font size until the string fits the available width. */
function fitFont(text: string, maxWidth: number, desired: number, weight = 1): number {
  const estimated = text.length * desired * (weight >= 700 ? 0.58 : 0.53);
  return estimated > maxWidth ? (desired * maxWidth) / estimated : desired;
}

function FitText({
  text,
  cx,
  y,
  maxWidth,
  size,
  weight = 400,
  fill,
  opacity = 1,
  letterSpacing,
}: {
  text: string;
  cx: number;
  y: number;
  maxWidth: number;
  size: number;
  weight?: number;
  fill: string;
  opacity?: number;
  letterSpacing?: number;
}) {
  if (!text) return null;
  return (
    <text
      x={cx}
      y={y}
      textAnchor="middle"
      dominantBaseline="middle"
      fontFamily={FONT}
      fontSize={fitFont(text, maxWidth, size, weight)}
      fontWeight={weight}
      fill={fill}
      opacity={opacity}
      letterSpacing={letterSpacing}
    >
      {text}
    </text>
  );
}

function QrBlock({
  x,
  y,
  size,
  modules,
  fg,
  bg,
}: {
  x: number;
  y: number;
  size: number;
  modules: Modules;
  fg: string;
  bg: string;
}) {
  const pad = size * 0.06;
  const inner = size - pad * 2;
  const cell = inner / modules.size;
  const finders: [number, number][] = [
    [0, 0],
    [modules.size - 7, 0],
    [0, modules.size - 7],
  ];
  const inFinder = (cx: number, cy: number) =>
    finders.some(([fx, fy]) => cx >= fx && cx < fx + 7 && cy >= fy && cy < fy + 7);

  return (
    <g>
      <rect x={x} y={y} width={size} height={size} rx={size * 0.06} fill={bg} />
      <g fill={fg}>
        {modules.cells.map((on, i) => {
          const cx = i % modules.size;
          const cy = Math.floor(i / modules.size);
          if (!on || inFinder(cx, cy)) return null;
          return (
            <rect
              key={i}
              x={x + pad + cx * cell}
              y={y + pad + cy * cell}
              width={cell}
              height={cell}
            />
          );
        })}
        {finders.map(([fx, fy]) => (
          <g key={`${fx}-${fy}`}>
            <rect
              x={x + pad + fx * cell}
              y={y + pad + fy * cell}
              width={cell * 7}
              height={cell * 7}
            />
            <rect
              x={x + pad + (fx + 1) * cell}
              y={y + pad + (fy + 1) * cell}
              width={cell * 5}
              height={cell * 5}
              fill={bg}
            />
            <rect
              x={x + pad + (fx + 2) * cell}
              y={y + pad + (fy + 2) * cell}
              width={cell * 3}
              height={cell * 3}
              fill={fg}
            />
          </g>
        ))}
      </g>
    </g>
  );
}

function Stars({ cx, y, size, fill }: { cx: number; y: number; size: number; fill: string }) {
  const gap = size * 1.55;
  return (
    <g fill={fill}>
      {[-2, -1, 0, 1, 2].map((i) => (
        <path
          key={i}
          transform={`translate(${cx + i * gap} ${y}) scale(${size / 10})`}
          d="M0 -9 L2.6 -2.9 L9 -2.6 L4 1.5 L5.6 8 L0 4.4 L-5.6 8 L-4 1.5 L-9 -2.6 L-2.6 -2.9 Z"
        />
      ))}
    </g>
  );
}

type Palette = {
  fg: string;
  muted: string;
  accent: string;
  qrFg: string;
  qrBg: string;
  bg: string;
  photo: boolean;
};

function palette(layout: LayoutTemplate, accent: string): Palette {
  const c = templateColors(layout, accent);
  const photo = PHOTO_LAYOUTS.includes(layout);
  if (photo) {
    return {
      fg: "#ffffff",
      muted: "rgba(255,255,255,0.78)",
      accent: layout === "hospitality" ? "#c2703a" : accent,
      qrFg: "#0b0d10",
      qrBg: "#ffffff",
      bg: "#050a09",
      photo: true,
    };
  }
  const darkBg = layout === "brand-colour";
  return {
    fg: c.fg,
    muted: darkBg ? "rgba(255,255,255,0.75)" : "rgba(11,13,16,0.6)",
    accent: c.accent,
    qrFg: c.qrFg,
    qrBg: c.qrBg,
    bg: c.bg,
    photo: false,
  };
}

/**
 * Vertical row flow inside a safe-area box. Weights are fractions of the box
 * height, so nothing can ever be pushed past the edge of the safe area.
 */
type RowKey = "business" | "stars" | "headline" | "qr" | "subline" | "cta" | "footer";

const FULL_ROWS: { key: RowKey; weight: number }[] = [
  { key: "business", weight: 0.1 },
  { key: "stars", weight: 0.07 },
  { key: "headline", weight: 0.14 },
  { key: "qr", weight: 0.36 },
  { key: "subline", weight: 0.09 },
  { key: "cta", weight: 0.14 },
  { key: "footer", weight: 0.07 },
];

const COMPACT_ROWS: { key: RowKey; weight: number }[] = [
  { key: "business", weight: 0.12 },
  { key: "headline", weight: 0.16 },
  { key: "qr", weight: 0.42 },
  { key: "stars", weight: 0.09 },
  { key: "cta", weight: 0.16 },
];

const TINY_ROWS: { key: RowKey; weight: number }[] = [
  { key: "business", weight: 0.15 },
  { key: "qr", weight: 0.5 },
  { key: "headline", weight: 0.18 },
];

function rowsFor(mode: "full" | "compact" | "tiny") {
  if (mode === "tiny") return TINY_ROWS;
  if (mode === "compact") return COMPACT_ROWS;
  return FULL_ROWS;
}

/** Content flow shared by every face — rectangular, circular or folded. */
function Flow({
  x,
  y,
  w,
  h,
  mode,
  colors,
  content,
  modules,
}: {
  x: number;
  y: number;
  w: number;
  h: number;
  mode: "full" | "compact" | "tiny";
  colors: Palette;
  content: ArtworkContent;
  modules: Modules;
}) {
  const rows = rowsFor(mode);
  const total = rows.reduce((sum, r) => sum + r.weight, 0);
  const gap = h * 0.02;
  const usable = h - gap * (rows.length - 1);
  const cx = x + w / 2;

  let cursor = y;
  const nodes: React.ReactNode[] = [];

  for (const row of rows) {
    const rowH = (usable * row.weight) / total;
    const mid = cursor + rowH / 2;

    switch (row.key) {
      case "business":
        nodes.push(
          <FitText
            key="business"
            text={content.business}
            cx={cx}
            y={mid}
            maxWidth={w}
            size={rowH * 0.78}
            weight={700}
            fill={colors.fg}
            letterSpacing={rowH * 0.03}
          />,
        );
        break;
      case "stars":
        nodes.push(
          <Stars
            key="stars"
            cx={cx}
            y={mid}
            size={Math.min(rowH * 0.9, w * 0.075)}
            fill="#f5b544"
          />,
        );
        break;
      case "headline":
        nodes.push(
          <FitText
            key="headline"
            text={content.headline}
            cx={cx}
            y={mid}
            maxWidth={w}
            size={rowH * 0.85}
            weight={800}
            fill={colors.fg}
          />,
        );
        break;
      case "qr": {
        const side = Math.min(rowH, w * 0.62);
        nodes.push(
          <QrBlock
            key="qr"
            x={cx - side / 2}
            y={mid - side / 2}
            size={side}
            modules={modules}
            fg={colors.qrFg}
            bg={colors.qrBg}
          />,
        );
        break;
      }
      case "subline":
        nodes.push(
          <FitText
            key="subline"
            text={content.subline}
            cx={cx}
            y={mid}
            maxWidth={w}
            size={rowH * 0.7}
            fill={colors.muted}
          />,
        );
        break;
      case "cta": {
        const pillH = Math.min(rowH * 0.92, h * 0.13);
        const label = content.cta;
        const fontSize = fitFont(label, w * 0.78, pillH * 0.46, 700);
        const pillW = Math.min(w, Math.max(w * 0.5, label.length * fontSize * 0.62 + pillH));
        nodes.push(
          <g key="cta">
            <rect
              x={cx - pillW / 2}
              y={mid - pillH / 2}
              width={pillW}
              height={pillH}
              rx={pillH / 2}
              fill={colors.accent}
            />
            <text
              x={cx}
              y={mid}
              textAnchor="middle"
              dominantBaseline="middle"
              fontFamily={FONT}
              fontSize={fontSize}
              fontWeight={700}
              fill={colors.accent.toLowerCase() === "#ffffff" ? "#0b0d10" : "#ffffff"}
            >
              {label}
            </text>
          </g>,
        );
        break;
      }
      case "footer":
        nodes.push(
          <FitText
            key="footer"
            text={content.footer}
            cx={cx}
            y={mid}
            maxWidth={w}
            size={rowH * 0.66}
            fill={colors.muted}
          />,
        );
        break;
    }

    cursor += rowH + gap;
  }

  return <>{nodes}</>;
}

function Background({
  w,
  h,
  colors,
  rounded,
}: {
  w: number;
  h: number;
  colors: Palette;
  rounded: number;
}) {
  if (!colors.photo) {
    return <rect width={w} height={h} rx={rounded} fill={colors.bg} />;
  }
  return (
    <>
      <image
        href={PHOTO_URL}
        x={0}
        y={0}
        width={w}
        height={h}
        preserveAspectRatio="xMidYMid slice"
      />
      <rect width={w} height={h} fill="#050a09" opacity={0.46} />
    </>
  );
}

export interface ArtworkPreviewProps {
  formatId: string;
  /** Layout style from the pack editor. `variant` is the legacy shorthand. */
  layout?: LayoutTemplate;
  variant?: ArtworkVariant;
  content?: Partial<ArtworkContent>;
  label: string;
}

export function ArtworkPreview({
  formatId,
  layout,
  variant,
  content: override,
  label,
}: ArtworkPreviewProps) {
  const format = FORMATS.find((f) => f.id === formatId) ?? FORMATS[0];
  const modules = useModules(formatId);
  const content: ArtworkContent = { ...DEMO_BRAND, ...override };
  const resolvedLayout: LayoutTemplate =
    layout ?? (variant === "clean" ? "clean-minimal" : "premium-dark");
  const colors = palette(resolvedLayout, content.accent);
  const uid = `art-${formatId}-${resolvedLayout}`;
  const shadow = "h-full w-full drop-shadow-[0_18px_36px_rgba(0,0,0,0.55)]";

  // Safe area: 4 mm inset for print, 40 px for digital, never less than 5%.
  const baseInset = format.medium === "print" ? 4 : 40;
  const inset = Math.max(baseInset, Math.min(format.width, format.height) * 0.06);

  if (format.shape === "circular") {
    const d = format.width;
    const r = d / 2;
    // Content lives in the square inscribed in the inner keyline circle, so it
    // is geometrically impossible for type to reach the die-cut edge.
    const innerR = r - inset;
    const side = innerR * 1.414 * 0.94;
    return (
      <svg
        viewBox={`0 0 ${d} ${d}`}
        role="img"
        aria-label={label}
        className={shadow}
        preserveAspectRatio="xMidYMid meet"
      >
        <defs>
          <clipPath id={`${uid}-circle`}>
            <circle cx={r} cy={r} r={r} />
          </clipPath>
        </defs>
        <g clipPath={`url(#${uid}-circle)`}>
          {colors.photo ? (
            <Background w={d} h={d} colors={colors} rounded={0} />
          ) : (
            <circle cx={r} cy={r} r={r} fill={colors.bg} />
          )}
          <circle
            cx={r}
            cy={r}
            r={r - inset * 0.55}
            fill="none"
            stroke={colors.accent}
            strokeWidth={d * 0.012}
            opacity={colors.photo ? 0.9 : 1}
          />
          <Flow
            x={r - side / 2}
            y={r - side / 2}
            w={side}
            h={side}
            mode="compact"
            colors={colors}
            content={content}
            modules={modules}
          />
        </g>
      </svg>
    );
  }

  if (format.shape === "folded") {
    // Table tent printed flat: back panel rotated 180° above the fold line.
    const w = format.width;
    const panelH = format.height / 2;
    const side = { x: inset, y: inset, w: w - inset * 2, h: panelH - inset * 2 };
    return (
      <svg
        viewBox={`0 0 ${w} ${format.height}`}
        role="img"
        aria-label={label}
        className={shadow}
        preserveAspectRatio="xMidYMid meet"
      >
        <defs>
          <clipPath id={`${uid}-panel`}>
            <rect width={w} height={panelH} />
          </clipPath>
        </defs>
        <rect width={w} height={format.height} fill={colors.photo ? "#050a09" : colors.bg} />
        <g transform={`rotate(180 ${w / 2} ${panelH / 2})`} clipPath={`url(#${uid}-panel)`}>
          <Background w={w} h={panelH} colors={colors} rounded={0} />
          <Flow
            {...side}
            mode="compact"
            colors={colors}
            content={content}
            modules={modules}
          />
        </g>
        <g transform={`translate(0 ${panelH})`}>
          <g clipPath={`url(#${uid}-panel)`}>
            <Background w={w} h={panelH} colors={colors} rounded={0} />
            <Flow
              {...side}
              mode="compact"
              colors={colors}
              content={content}
              modules={modules}
            />
          </g>
        </g>
        <line
          x1={0}
          y1={panelH}
          x2={w}
          y2={panelH}
          stroke="rgba(11,13,16,0.35)"
          strokeWidth={Math.max(0.4, w * 0.004)}
          strokeDasharray={`${w * 0.02} ${w * 0.015}`}
        />
      </svg>
    );
  }

  const w = format.width;
  const h = format.height;
  const min = Math.min(w, h);
  const rounded = min * 0.03;
  const safe = { x: inset, y: inset, w: w - inset * 2, h: h - inset * 2 };

  // Landscape and very small pieces cannot carry the full seven-row flow.
  const aspect = w / h;
  const mode: "full" | "compact" | "tiny" =
    aspect > 1.35 || min <= 60 ? "tiny" : aspect > 1.05 || h < 100 ? "compact" : "full";

  if (mode === "tiny" && aspect > 1.35) {
    // Wide strips read as a two-column lockup: code left, message right.
    const qr = Math.min(safe.h, safe.w * 0.3);
    const textX = safe.x + qr + safe.w * 0.06;
    const textW = safe.x + safe.w - textX;
    return (
      <svg
        viewBox={`0 0 ${w} ${h}`}
        role="img"
        aria-label={label}
        className={shadow}
        preserveAspectRatio="xMidYMid meet"
      >
        <defs>
          <clipPath id={`${uid}-rect`}>
            <rect width={w} height={h} rx={rounded} />
          </clipPath>
        </defs>
        <g clipPath={`url(#${uid}-rect)`}>
          <Background w={w} h={h} colors={colors} rounded={rounded} />
          <QrBlock
            x={safe.x}
            y={safe.y + (safe.h - qr) / 2}
            size={qr}
            modules={modules}
            fg={colors.qrFg}
            bg={colors.qrBg}
          />
          <FitText
            text={content.business}
            cx={textX + textW / 2}
            y={safe.y + safe.h * 0.28}
            maxWidth={textW}
            size={safe.h * 0.17}
            weight={700}
            fill={colors.fg}
          />
          <FitText
            text={content.headline}
            cx={textX + textW / 2}
            y={safe.y + safe.h * 0.55}
            maxWidth={textW}
            size={safe.h * 0.2}
            weight={800}
            fill={colors.fg}
          />
          <FitText
            text={content.subline}
            cx={textX + textW / 2}
            y={safe.y + safe.h * 0.8}
            maxWidth={textW}
            size={safe.h * 0.13}
            fill={colors.muted}
          />
        </g>
      </svg>
    );
  }

  return (
    <svg
      viewBox={`0 0 ${w} ${h}`}
      role="img"
      aria-label={label}
      className={shadow}
      preserveAspectRatio="xMidYMid meet"
    >
      <defs>
        <clipPath id={`${uid}-rect`}>
          <rect width={w} height={h} rx={rounded} />
        </clipPath>
      </defs>
      <g clipPath={`url(#${uid}-rect)`}>
        <Background w={w} h={h} colors={colors} rounded={rounded} />
        <Flow {...safe} mode={mode} colors={colors} content={content} modules={modules} />
      </g>
    </svg>
  );
}
