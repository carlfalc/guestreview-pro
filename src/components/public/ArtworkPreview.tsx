import { useMemo } from "react";
import { FORMATS, safeArea } from "@/lib/qr-formats";
import venueAsset from "@/assets/venue-interior.jpg.asset.json";

/**
 * Marketing-grade artwork preview for the public landing page.
 *
 * Rendered as inline SVG at the real trim proportions from the format
 * catalogue, so what the visitor sees matches the geometry of an actual
 * production export. No `qr-code-styling` on the public bundle, no network
 * request beyond one shared photo, no layout shift.
 *
 * The module grid is deterministic decorative art — these previews are
 * artwork, not scannable codes.
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

export const DEMO_BRAND: ArtworkContent = {
  business: "Harbour Lane",
  headline: "Loved your visit?",
  subline: "Scan to leave us a review.",
  cta: "Leave a review",
  footer: "Created with GuestReview Pro",
  accent: "#1f4d3a",
};

const PHOTO_URL = venueAsset.url;

function useModules(seedKey: string, size = 21) {
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

function QrBlock({
  x,
  y,
  size,
  modules,
  fg = "#0b0d10",
  bg = "#ffffff",
}: {
  x: number;
  y: number;
  size: number;
  modules: { size: number; cells: boolean[] };
  fg?: string;
  bg?: string;
}) {
  const pad = size * 0.055;
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
  const gap = size * 1.6;
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

/** One printed face: photo or clean panel with brand, QR, headline and CTA. */
function Panel({
  w,
  h,
  variant,
  content,
  modules,
  clipId,
  compact = false,
}: {
  w: number;
  h: number;
  variant: ArtworkVariant;
  content: ArtworkContent;
  modules: { size: number; cells: boolean[] };
  clipId: string;
  compact?: boolean;
}) {
  const min = Math.min(w, h);
  const dark = variant === "photo";
  const fg = dark ? "#ffffff" : "#0b0d10";
  const muted = dark ? "rgba(255,255,255,0.78)" : "rgba(11,13,16,0.62)";
  const qrSize = min * (compact ? 0.46 : 0.42);
  const qrX = (w - qrSize) / 2;
  const qrY = h * (compact ? 0.24 : 0.22);
  const ctaW = w * 0.58;
  const ctaH = h * (compact ? 0.075 : 0.068);
  const ctaY = h * (compact ? 0.83 : 0.815);

  return (
    <g clipPath={`url(#${clipId})`}>
      {dark ? (
        <>
          <image
            href={PHOTO_URL}
            x={0}
            y={0}
            width={w}
            height={h}
            preserveAspectRatio="xMidYMid slice"
          />
          <rect width={w} height={h} fill="#050a09" opacity={0.42} />
        </>
      ) : (
        <rect width={w} height={h} fill="#ffffff" />
      )}

      <text
        x={w / 2}
        y={h * 0.115}
        textAnchor="middle"
        fontSize={min * 0.062}
        fontWeight={700}
        letterSpacing={min * 0.004}
        fill={fg}
        fontFamily="system-ui, sans-serif"
      >
        {content.business}
      </text>

      <QrBlock x={qrX} y={qrY} size={qrSize} modules={modules} />

      <Stars cx={w / 2} y={h * 0.735} size={min * 0.035} fill="#f5b544" />

      <text
        x={w / 2}
        y={h * 0.79}
        textAnchor="middle"
        fontSize={min * 0.082}
        fontWeight={800}
        fill={fg}
        fontFamily="system-ui, sans-serif"
      >
        {content.headline}
      </text>

      <rect
        x={(w - ctaW) / 2}
        y={ctaY}
        width={ctaW}
        height={ctaH}
        rx={ctaH / 2}
        fill={content.accent}
      />
      <text
        x={w / 2}
        y={ctaY + ctaH * 0.68}
        textAnchor="middle"
        fontSize={min * 0.05}
        fontWeight={700}
        fill="#ffffff"
        fontFamily="system-ui, sans-serif"
      >
        {content.cta}
      </text>

      <text
        x={w / 2}
        y={h * 0.955}
        textAnchor="middle"
        fontSize={min * 0.038}
        fill={muted}
        fontFamily="system-ui, sans-serif"
      >
        {compact ? content.subline : content.footer}
      </text>
    </g>
  );
}

/** Circular sticker face — tighter composition, no photo. */
function CircleFace({
  d,
  content,
  modules,
}: {
  d: number;
  content: ArtworkContent;
  modules: { size: number; cells: boolean[] };
}) {
  const qr = d * 0.44;
  return (
    <g>
      <circle cx={d / 2} cy={d / 2} r={d / 2} fill="#ffffff" />
      <circle
        cx={d / 2}
        cy={d / 2}
        r={d / 2 - d * 0.035}
        fill="none"
        stroke={content.accent}
        strokeWidth={d * 0.016}
      />
      <text
        x={d / 2}
        y={d * 0.185}
        textAnchor="middle"
        fontSize={d * 0.062}
        fontWeight={700}
        fill={content.accent}
        fontFamily="system-ui, sans-serif"
      >
        {content.business}
      </text>
      <QrBlock x={(d - qr) / 2} y={d * 0.235} size={qr} modules={modules} />
      <Stars cx={d / 2} y={d * 0.755} size={d * 0.032} fill="#f5b544" />
      <text
        x={d / 2}
        y={d * 0.835}
        textAnchor="middle"
        fontSize={d * 0.07}
        fontWeight={800}
        fill="#0b0d10"
        fontFamily="system-ui, sans-serif"
      >
        {content.headline}
      </text>
      <text
        x={d / 2}
        y={d * 0.895}
        textAnchor="middle"
        fontSize={d * 0.04}
        fill="rgba(11,13,16,0.6)"
        fontFamily="system-ui, sans-serif"
      >
        Scan to review us
      </text>

    </g>
  );
}

export interface ArtworkPreviewProps {
  formatId: string;
  variant?: ArtworkVariant;
  content?: ArtworkContent;
  label: string;
}

export function ArtworkPreview({
  formatId,
  variant = "photo",
  content = DEMO_BRAND,
  label,
}: ArtworkPreviewProps) {
  const format = FORMATS.find((f) => f.id === formatId) ?? FORMATS[0];
  const modules = useModules(formatId);
  const uid = `art-${formatId}`;

  if (format.shape === "circular") {
    const d = format.width;
    return (
      <svg
        viewBox={`0 0 ${d} ${d}`}
        role="img"
        aria-label={label}
        className="h-full w-full drop-shadow-[0_18px_36px_rgba(0,0,0,0.55)]"
        preserveAspectRatio="xMidYMid meet"
      >
        <CircleFace d={d} content={content} modules={modules} />
      </svg>
    );
  }

  if (format.shape === "folded") {
    // Folded tent: printed flat, back panel rotated 180 degrees above the fold.
    const w = format.width;
    const panelH = format.height / 2;
    return (
      <svg
        viewBox={`0 0 ${w} ${format.height}`}
        role="img"
        aria-label={label}
        className="h-full w-full drop-shadow-[0_18px_36px_rgba(0,0,0,0.55)]"
        preserveAspectRatio="xMidYMid meet"
      >
        <defs>
          <clipPath id={`${uid}-back`}>
            <rect width={w} height={panelH} />
          </clipPath>
          <clipPath id={`${uid}-front`}>
            <rect width={w} height={panelH} />
          </clipPath>
        </defs>
        <rect width={w} height={format.height} fill="#ffffff" />
        <g transform={`rotate(180 ${w / 2} ${panelH / 2})`}>
          <Panel
            w={w}
            h={panelH}
            variant="clean"
            content={content}
            modules={modules}
            clipId={`${uid}-back`}
            compact
          />
        </g>
        <g transform={`translate(0 ${panelH})`}>
          <Panel
            w={w}
            h={panelH}
            variant={variant}
            content={content}
            modules={modules}
            clipId={`${uid}-front`}
            compact
          />
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

  const { w, h } = { w: format.width, h: format.height };
  const safe = safeArea(format);
  const inset = (w - safe.w) / 2;
  const radius = Math.min(w, h) * 0.03;

  return (
    <svg
      viewBox={`0 0 ${w} ${h}`}
      role="img"
      aria-label={label}
      className="h-full w-full drop-shadow-[0_18px_36px_rgba(0,0,0,0.55)]"
      preserveAspectRatio="xMidYMid meet"
    >
      <defs>
        <clipPath id={uid}>
          <rect width={w} height={h} rx={radius} />
        </clipPath>
      </defs>
      <Panel w={w} h={h} variant={variant} content={content} modules={modules} clipId={uid} />
      <rect
        x={inset / 2}
        y={inset / 2}
        width={w - inset}
        height={h - inset}
        rx={radius}
        fill="none"
        stroke="rgba(255,255,255,0.14)"
        strokeWidth={Math.max(0.3, w * 0.003)}
      />
    </svg>
  );
}
