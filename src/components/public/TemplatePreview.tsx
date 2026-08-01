import { useMemo } from "react";
import { templateColors } from "@/lib/qr-formats";
import { templateFormat, type GalleryTemplate } from "@/lib/templates";

/**
 * Lightweight, dependency-free artwork preview for the public gallery.
 *
 * Rendered as inline SVG rather than a bitmap: it costs no network request,
 * carries no layout shift and stays sharp at any size — all of which matter
 * for Core Web Vitals on a page showing eighteen previews at once.
 *
 * The code pattern is decorative demo art, not a scannable QR code.
 */
export function TemplatePreview({ template }: { template: GalleryTemplate }) {
  const format = templateFormat(template);
  const colors = templateColors(template.layout, "#3b5bfd");
  const circular = format.shape === "circular";

  // Deterministic pseudo-QR pattern so previews are stable between renders.
  const modules = useMemo(() => {
    const size = 11;
    let seed = 0;
    for (const ch of template.id) seed = (seed * 31 + ch.charCodeAt(0)) % 100000;
    const cells: boolean[] = [];
    for (let i = 0; i < size * size; i++) {
      seed = (seed * 1103515245 + 12345) % 2147483648;
      cells.push((seed >> 8) % 100 > 48);
    }
    return { size, cells };
  }, [template.id]);

  const w = format.width;
  const h = format.height;
  const qrSize = Math.min(w, h) * (circular ? 0.42 : 0.34);
  const qrX = (w - qrSize) / 2;
  const qrY = circular ? (h - qrSize) / 2 - h * 0.02 : h * 0.34;
  const cell = qrSize / modules.size;

  return (
    <svg
      viewBox={`0 0 ${w} ${h}`}
      role="img"
      aria-label={`${template.name} template preview for ${template.demoBusiness}`}
      className="h-full w-full"
      preserveAspectRatio="xMidYMid meet"
    >
      {circular ? (
        <circle cx={w / 2} cy={h / 2} r={Math.min(w, h) / 2} fill={colors.bg} />
      ) : (
        <rect width={w} height={h} rx={Math.min(w, h) * 0.03} fill={colors.bg} />
      )}

      {/* Demo business name */}
      <text
        x={w / 2}
        y={circular ? h * 0.17 : h * 0.13}
        textAnchor="middle"
        fontSize={Math.min(w, h) * 0.055}
        fill={colors.accent}
        fontFamily="system-ui, sans-serif"
        fontWeight="600"
      >
        {template.demoBusiness}
      </text>

      {/* Headline */}
      <text
        x={w / 2}
        y={circular ? h * 0.26 : h * 0.23}
        textAnchor="middle"
        fontSize={Math.min(w, h) * 0.072}
        fill={colors.fg}
        fontFamily="system-ui, sans-serif"
        fontWeight="700"
      >
        {template.headline}
      </text>

      {/* QR plate */}
      <rect
        x={qrX - cell}
        y={qrY - cell}
        width={qrSize + cell * 2}
        height={qrSize + cell * 2}
        rx={cell}
        fill={colors.qrBg}
      />
      <g fill={colors.qrFg}>
        {modules.cells.map((on, i) =>
          on ? (
            <rect
              key={i}
              x={qrX + (i % modules.size) * cell}
              y={qrY + Math.floor(i / modules.size) * cell}
              width={cell}
              height={cell}
            />
          ) : null,
        )}
        {/* Finder patterns */}
        {[
          [0, 0],
          [modules.size - 3, 0],
          [0, modules.size - 3],
        ].map(([cx, cy]) => (
          <g key={`${cx}-${cy}`}>
            <rect x={qrX + cx * cell} y={qrY + cy * cell} width={cell * 3} height={cell * 3} fill={colors.qrFg} />
            <rect
              x={qrX + (cx + 1) * cell}
              y={qrY + (cy + 1) * cell}
              width={cell}
              height={cell}
              fill={colors.qrBg}
            />
          </g>
        ))}
      </g>

      {/* Subline */}
      <text
        x={w / 2}
        y={qrY + qrSize + Math.min(w, h) * (circular ? 0.11 : 0.1)}
        textAnchor="middle"
        fontSize={Math.min(w, h) * 0.05}
        fill={colors.fg}
        fontFamily="system-ui, sans-serif"
        opacity={0.85}
      >
        {template.subline}
      </text>
    </svg>
  );
}
