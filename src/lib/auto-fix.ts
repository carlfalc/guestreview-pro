// Auto-fix engine for the validation panel.
// Builds AutoFixProposal[] from ValidationResult[], applies them to a snapshot,
// and reverses them via a stored prior snapshot. No mutations happen without
// explicit user confirmation.

import type { QrDesign } from "@/lib/qr-design";
import type { BusinessFormat } from "@/lib/qr-formats";
import {
  defaultFoldedConfig,
  type ContentBase,
  type FoldedConfig,
  type FoldedPanelContent,
  type FormatCustomizations,
  type FormatOverride,
  type GlobalSettings,
} from "@/lib/marketing-packs";
import type { ValidationLevel, ValidationResult } from "@/lib/format-validation";

export type AutoFixSnapshot = {
  qrDesign: QrDesign;
  globalSettings: GlobalSettings;
  formatCustomizations: FormatCustomizations;
  selectedFormats: string[];
};

export type AutoFixMutation =
  | { kind: "override"; formatId: string; patch: Partial<FormatOverride> }
  | { kind: "folded"; formatId: string; panel: "front" | "back" | "both"; patch: Partial<FoldedPanelContent> }
  | { kind: "qrDesign"; patch: Partial<QrDesign> }
  | { kind: "global"; patch: Partial<GlobalSettings> };

export type AutoFixCategory = "qr" | "text" | "image" | "print" | "content";

export type AutoFixProposal = {
  id: string;
  formatId: string | null;
  formatName: string | null;
  panel: "front" | "back" | "both" | null;
  validationId: string;
  category: AutoFixCategory;
  element: string;
  description: string;
  before: string;
  after: string;
  reason: string;
  severity: Exclude<ValidationLevel, "pass">;
  mutation: AutoFixMutation;
};

export type BuildContext = {
  formatById: Record<string, BusinessFormat>;
  contentBase: ContentBase;
  snapshot: AutoFixSnapshot;
};

function fmtPct(n: number | undefined | null): string {
  if (n == null) return "default";
  return `${Math.round(n * 100)}%`;
}

function mutationKey(m: AutoFixMutation): string {
  if (m.kind === "qrDesign" || m.kind === "global") {
    return `${m.kind}:${Object.keys(m.patch).sort().join(",")}`;
  }
  if (m.kind === "override") return `override:${m.formatId}:${Object.keys(m.patch).sort().join(",")}`;
  return `folded:${m.formatId}:${m.panel}:${Object.keys(m.patch).sort().join(",")}`;
}

/**
 * Convert validation results into concrete, reversible fix proposals.
 * Proposals are deterministic — no AI rewriting.
 */
export function buildAutoFixProposals(results: ValidationResult[], ctx: BuildContext): AutoFixProposal[] {
  const out: AutoFixProposal[] = [];
  const { snapshot, formatById } = ctx;

  for (const r of results) {
    if (r.level === "pass") continue;
    const fid = r.formatId;
    const format = fid ? formatById[fid] : null;
    const formatName = format?.name ?? r.formatName ?? null;
    const override: FormatOverride = fid ? (snapshot.formatCustomizations[fid] ?? {}) : {};
    const isFront = r.formatName?.includes("Front") ?? false;
    const isBack = r.formatName?.includes("Back") ?? false;
    const foldedPanel: "front" | "back" = isBack ? "back" : "front";
    const foldedCfg: FoldedConfig | null = fid && format?.folded
      ? (override.folded ?? defaultFoldedConfig(ctx.contentBase))
      : null;

    // === QR contrast: switch to black on white ===
    if (r.id === "qr-contrast" || r.id === "qr-contrast-soft") {
      const d = snapshot.qrDesign;
      out.push({
        id: `fix-${r.id}-${fid ?? "pack"}`,
        formatId: fid, formatName, panel: null,
        validationId: r.id, category: "qr", element: "qr",
        description: "Switch QR to solid black on white",
        before: `fg ${d.fg} / bg ${d.transparentBg ? "transparent" : d.bg} · ${d.colorMode}`,
        after: "fg #000000 / bg #ffffff · solid",
        reason: "Guarantees a scan-safe contrast ratio.",
        severity: r.level,
        mutation: { kind: "qrDesign", patch: { fg: "#000000", bg: "#ffffff", transparentBg: false, colorMode: "solid" } },
      });
      continue;
    }

    // === QR minimum size (rect format) ===
    if (r.id === "qr-min-size" && format && !format.folded) {
      const cur = override.qrScale ?? 0.45;
      const next = Math.min(0.7, Math.max(cur + 0.15, 0.55));
      out.push({
        id: `fix-qr-min-${fid}`,
        formatId: fid, formatName, panel: null,
        validationId: r.id, category: "qr", element: "qr",
        description: "Increase QR scale to meet minimum size",
        before: fmtPct(cur), after: fmtPct(next),
        reason: `Rendered QR is below the ${format.minQrSize}${format.medium === "print" ? " mm" : " px"} minimum.`,
        severity: r.level,
        mutation: { kind: "override", formatId: format.id, patch: { qrScale: next } },
      });
      continue;
    }

    // === Geometry: QR outside safe / trim ===
    if ((r.id.startsWith("geom-safe-") || r.id.startsWith("geom-trim-")) && r.element === "qr" && format && !format.folded) {
      const cur = override.qrScale ?? 0.45;
      const next = Math.max(0.35, cur - 0.1);
      const hadOff = (override.qrOffsetX ?? 0) !== 0 || (override.qrOffsetY ?? 0) !== 0;
      out.push({
        id: `fix-qr-safe-${fid}`,
        formatId: fid, formatName, panel: null,
        validationId: r.id, category: "qr", element: "qr",
        description: hadOff ? "Reset QR offsets and reduce scale" : "Reduce QR scale to fit safe area",
        before: `${fmtPct(cur)} · offset ${Math.round((override.qrOffsetX ?? 0) * 100)}/${Math.round((override.qrOffsetY ?? 0) * 100)}`,
        after: `${fmtPct(next)} · offset 0/0`,
        reason: "Keeps the QR inside the format's safe area.",
        severity: r.level,
        mutation: { kind: "override", formatId: format.id, patch: { qrScale: next, qrOffsetX: 0, qrOffsetY: 0 } },
      });
      continue;
    }

    // === Geometry: logo outside safe / trim → reduce logo ===
    if ((r.id.startsWith("geom-safe-") || r.id.startsWith("geom-trim-")) && r.element === "logo" && format) {
      const cur = override.logoSize ?? snapshot.globalSettings.logoSize ?? 0.18;
      const next = Math.max(0.1, cur - 0.05);
      out.push({
        id: `fix-logo-safe-${fid}`,
        formatId: fid, formatName, panel: null,
        validationId: r.id, category: "image", element: "logo",
        description: "Reduce logo size to fit inside safe area",
        before: fmtPct(cur), after: fmtPct(next),
        reason: "Prevents the logo from crossing the trim / safe boundary.",
        severity: r.level,
        mutation: { kind: "override", formatId: format.id, patch: { logoSize: next } },
      });
      continue;
    }

    // === Logo large warning ===
    if (r.id === "logo-large" && format) {
      const cur = override.logoSize ?? snapshot.globalSettings.logoSize ?? 0.18;
      out.push({
        id: `fix-logo-large-${fid}`,
        formatId: fid, formatName, panel: null,
        validationId: r.id, category: "image", element: "logo",
        description: "Reduce logo size to 22%",
        before: fmtPct(cur), after: "22%",
        reason: "Prevents the logo from crowding the QR quiet zone.",
        severity: "warning",
        mutation: { kind: "override", formatId: format.id, patch: { logoSize: 0.22 } },
      });
      continue;
    }

    // === Background image very opaque ===
    if (r.id === "bg-image-opaque" && format) {
      const cur = override.backgroundImageOpacity ?? snapshot.globalSettings.backgroundImageOpacity ?? 1;
      out.push({
        id: `fix-bg-opaque-${fid}`,
        formatId: fid, formatName, panel: null,
        validationId: r.id, category: "image", element: "background",
        description: "Reduce background image opacity to 40%",
        before: fmtPct(cur), after: "40%",
        reason: "Improves QR scan reliability and text legibility.",
        severity: "warning",
        mutation: { kind: "override", formatId: format.id, patch: { backgroundImageOpacity: 0.4 } },
      });
      continue;
    }

    // === QR quiet-zone / border collision ===
    if (r.id === "qr-border-collision" && format) {
      const cur = override.borderStyle ?? snapshot.globalSettings.borderStyle ?? "thin";
      out.push({
        id: `fix-border-${fid}`,
        formatId: fid, formatName, panel: null,
        validationId: r.id, category: "qr", element: "qr",
        description: "Remove decorative border",
        before: String(cur), after: "none",
        reason: "Restores the QR quiet zone.",
        severity: "warning",
        mutation: { kind: "override", formatId: format.id, patch: { borderStyle: "none" } },
      });
      continue;
    }

    // === Folded panel-level fixes ===
    if (foldedCfg && fid && format?.folded) {
      const pc: FoldedPanelContent = foldedPanel === "front" ? foldedCfg.front : foldedCfg.back;

      // QR crossing fold / score / glue / trim / safe / overlap → reduce & reset offsets
      const foldedQrIssue =
        r.element === "qr" && (
          r.id.includes("fold-cross") ||
          r.id.includes("score-cross") ||
          r.id.includes("glue-overlap") ||
          r.id.includes("overlap-qr") ||
          r.id.includes("safe") ||
          r.id.includes("trim")
        );
      if (foldedQrIssue) {
        const cur = pc.qrScale ?? 0.45;
        const next = Math.max(0.35, cur - 0.08);
        out.push({
          id: `fix-folded-qr-${fid}-${foldedPanel}-${r.id}`,
          formatId: fid, formatName, panel: foldedPanel,
          validationId: r.id, category: "qr", element: "qr",
          description: `Reset ${foldedPanel} QR offsets and reduce scale`,
          before: `${fmtPct(cur)} · offset ${Math.round((pc.qrOffsetX ?? 0) * 100)}/${Math.round((pc.qrOffsetY ?? 0) * 100)}`,
          after: `${fmtPct(next)} · offset 0/0`,
          reason: "Keeps the QR clear of folds, score lines and the glue area.",
          severity: r.level,
          mutation: { kind: "folded", formatId: fid, panel: foldedPanel, patch: { qrScale: next, qrOffsetX: 0, qrOffsetY: 0 } },
        });
        continue;
      }

      // Folded QR minimum size → increase
      if (r.id.includes("qr-min") && r.element === "qr") {
        const cur = pc.qrScale ?? 0.45;
        const next = Math.min(0.7, cur + 0.15);
        out.push({
          id: `fix-folded-qr-min-${fid}-${foldedPanel}`,
          formatId: fid, formatName, panel: foldedPanel,
          validationId: r.id, category: "qr", element: "qr",
          description: `Increase ${foldedPanel} QR scale to minimum`,
          before: fmtPct(cur), after: fmtPct(next),
          reason: `Rendered QR is below the ${format.minQrSize} mm minimum on this panel.`,
          severity: r.level,
          mutation: { kind: "folded", formatId: fid, panel: foldedPanel, patch: { qrScale: next } },
        });
        continue;
      }
    }
  }

  // Deduplicate by mutation shape so the same underlying fix isn't proposed twice.
  const seen = new Set<string>();
  return out.filter((p) => {
    const k = mutationKey(p.mutation);
    if (seen.has(k)) return false;
    seen.add(k);
    return true;
  });
}

/** Apply proposals to a snapshot. Returns a new snapshot. */
export function applyAutoFixes(
  snapshot: AutoFixSnapshot,
  proposals: AutoFixProposal[],
  contentBase: ContentBase,
): AutoFixSnapshot {
  const s: AutoFixSnapshot = {
    qrDesign: { ...snapshot.qrDesign },
    globalSettings: { ...snapshot.globalSettings },
    formatCustomizations: { ...snapshot.formatCustomizations },
    selectedFormats: [...snapshot.selectedFormats],
  };
  for (const p of proposals) {
    const m = p.mutation;
    if (m.kind === "qrDesign") {
      s.qrDesign = { ...s.qrDesign, ...m.patch };
    } else if (m.kind === "global") {
      s.globalSettings = { ...s.globalSettings, ...m.patch };
    } else if (m.kind === "override") {
      const prev = s.formatCustomizations[m.formatId] ?? {};
      s.formatCustomizations = { ...s.formatCustomizations, [m.formatId]: { ...prev, ...m.patch } };
    } else if (m.kind === "folded") {
      const prev = s.formatCustomizations[m.formatId] ?? {};
      const fc: FoldedConfig = prev.folded ?? defaultFoldedConfig(contentBase);
      const next: FoldedConfig = {
        ...fc,
        front: m.panel === "front" || m.panel === "both" ? { ...fc.front, ...m.patch } : fc.front,
        back: m.panel === "back" || m.panel === "both" ? { ...fc.back, ...m.patch } : fc.back,
      };
      s.formatCustomizations = { ...s.formatCustomizations, [m.formatId]: { ...prev, folded: next } };
    }
  }
  return s;
}

/** Reverse a previous auto-fix by restoring the snapshot taken before it. */
export function reverseAutoFixes(before: AutoFixSnapshot): AutoFixSnapshot {
  return {
    qrDesign: { ...before.qrDesign },
    globalSettings: { ...before.globalSettings },
    formatCustomizations: { ...before.formatCustomizations },
    selectedFormats: [...before.selectedFormats],
  };
}

export function summariseAutoFixes(proposals: AutoFixProposal[]): {
  total: number;
  byCategory: Record<string, number>;
  byFormat: Record<string, number>;
} {
  const byCategory: Record<string, number> = {};
  const byFormat: Record<string, number> = {};
  for (const p of proposals) {
    byCategory[p.category] = (byCategory[p.category] ?? 0) + 1;
    const k = p.formatName ?? "Pack-wide";
    byFormat[k] = (byFormat[k] ?? 0) + 1;
  }
  return { total: proposals.length, byCategory, byFormat };
}
