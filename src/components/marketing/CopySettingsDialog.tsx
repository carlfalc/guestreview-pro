// Advanced per-format copy tool. Lets the user pick a copy mode (which fields
// to project) plus a target set (similar / all selected / manually picked)
// and shows exactly which fields will be written before applying.

import { useEffect, useMemo, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Copy, Undo2 } from "lucide-react";
import { FORMATS, type BusinessFormat } from "@/lib/qr-formats";
import { similarFormats, type FormatCustomizations, type FormatOverride } from "@/lib/marketing-packs";

export type CopyMode =
  | "everything" | "content" | "design" | "qr" | "background" | "visibility"
  | "folded-front" | "folded-back" | "folded-structure";

export const COPY_MODES: { id: CopyMode; label: string; foldedOnly?: boolean; description: string }[] = [
  { id: "everything", label: "Everything", description: "Copy every field of this override." },
  { id: "content", label: "Content only", description: "Headline / support / CTA / footer." },
  { id: "design", label: "Design only", description: "Colours, fonts, borders, corner radius." },
  { id: "qr", label: "QR position & size only", description: "qrScale, qrOffsetX/Y." },
  { id: "background", label: "Background only", description: "Background image + opacity." },
  { id: "visibility", label: "Visibility only", description: "Show/hide business name, logo, stars, badge." },
  { id: "folded-front", label: "Folded front content", foldedOnly: true, description: "Front panel content only." },
  { id: "folded-back", label: "Folded back content", foldedOnly: true, description: "Back panel content only." },
  { id: "folded-structure", label: "Folded structure", foldedOnly: true, description: "Folded mode (same/mirrored/split)." },
];

const CONTENT_KEYS: (keyof FormatOverride)[] = ["headline", "supportText", "ctaText", "footerText"];
const DESIGN_KEYS: (keyof FormatOverride)[] = ["textAlign", "textColor", "backgroundColor", "accentColor", "borderStyle", "cornerRadius", "starStyle", "fontFamily", "logoSize"];
const QR_KEYS: (keyof FormatOverride)[] = ["qrScale", "qrOffsetX", "qrOffsetY"];
const BG_KEYS: (keyof FormatOverride)[] = ["backgroundImage", "backgroundImageOpacity"];
const VIS_KEYS: (keyof FormatOverride)[] = ["showBusinessName", "logoVisible", "hideStars", "showGoogleBadge"];

/**
 * Project an override into the subset of fields governed by the given mode.
 * Folded modes carve out `folded.front`, `folded.back`, and `folded.mode`.
 */
export function projectOverrideForCopy(source: FormatOverride, mode: CopyMode): FormatOverride {
  const pick = (keys: (keyof FormatOverride)[]): FormatOverride => {
    const o: FormatOverride = {};
    for (const k of keys) if (source[k] !== undefined) (o as Record<string, unknown>)[k] = source[k] as unknown;
    return o;
  };
  switch (mode) {
    case "everything": {
      const { folded, ...rest } = source;
      return { ...rest, ...(folded ? { folded } : {}) };
    }
    case "content": return pick(CONTENT_KEYS);
    case "design": return pick(DESIGN_KEYS);
    case "qr": return pick(QR_KEYS);
    case "background": return pick(BG_KEYS);
    case "visibility": return pick(VIS_KEYS);
    case "folded-front":
      return source.folded ? { folded: { mode: source.folded.mode, front: { ...source.folded.front }, back: source.folded.back } } : {};
    case "folded-back":
      return source.folded ? { folded: { mode: source.folded.mode, front: source.folded.front, back: { ...source.folded.back } } } : {};
    case "folded-structure":
      return source.folded ? { folded: { mode: source.folded.mode, front: source.folded.front, back: source.folded.back } } : {};
  }
}

/**
 * Merge a projected override into a target, respecting folded-safety rules:
 * - Folded-only modes never touch non-folded targets.
 * - Non-folded modes never overwrite folded.front / folded.back unless
 *   explicitly selected.
 */
export function mergeForCopy(target: FormatOverride | undefined, patch: FormatOverride, mode: CopyMode, targetFolded: boolean): FormatOverride | null {
  const foldedOnly = mode === "folded-front" || mode === "folded-back" || mode === "folded-structure";
  if (foldedOnly && !targetFolded) return null; // skip incompatible target

  const merged: FormatOverride = { ...(target ?? {}), ...patch };
  if (patch.folded && target?.folded) {
    if (mode === "folded-front") merged.folded = { ...target.folded, front: { ...target.folded.front, ...patch.folded.front } };
    else if (mode === "folded-back") merged.folded = { ...target.folded, back: { ...target.folded.back, ...patch.folded.back } };
    else if (mode === "folded-structure") merged.folded = { ...target.folded, mode: patch.folded.mode };
    else merged.folded = { ...target.folded, ...patch.folded };
  } else if (patch.folded && !target?.folded) {
    // No prior folded config: only apply if target is folded and mode intends front/back/structure or everything
    if (targetFolded) merged.folded = patch.folded;
    else delete merged.folded;
  }
  return merged;
}

type TargetSel = "similar" | "all" | "manual";

export function CopySettingsDialog({
  open, onOpenChange, sourceFormat, sourceOverride, selectedFormats, customizations,
  onApply, onUndo, canUndo,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  sourceFormat: BusinessFormat;
  sourceOverride: FormatOverride | undefined;
  selectedFormats: string[];
  customizations: FormatCustomizations;
  onApply: (patched: FormatCustomizations, summary: { copied: number; skipped: number; mode: CopyMode }) => void;
  onUndo: () => void;
  canUndo: boolean;
}) {
  const [mode, setMode] = useState<CopyMode>("everything");
  const [targetSel, setTargetSel] = useState<TargetSel>("similar");
  const [manualIds, setManualIds] = useState<string[]>([]);
  const isFoldedSource = sourceFormat.folded === true;

  useEffect(() => { if (open) { setMode("everything"); setTargetSel("similar"); setManualIds([]); } }, [open, sourceFormat.id]);

  const otherSelected = useMemo(
    () => FORMATS.filter((f) => selectedFormats.includes(f.id) && f.id !== sourceFormat.id),
    [selectedFormats, sourceFormat.id],
  );
  const similar = useMemo(() => similarFormats(sourceFormat, otherSelected), [sourceFormat, otherSelected]);

  const targetFormats = useMemo(() => {
    if (targetSel === "similar") return similar;
    if (targetSel === "all") return otherSelected;
    return otherSelected.filter((f) => manualIds.includes(f.id));
  }, [targetSel, similar, otherSelected, manualIds]);

  const projected: FormatOverride = useMemo(
    () => projectOverrideForCopy(sourceOverride ?? {}, mode),
    [sourceOverride, mode],
  );

  const projectedKeys = useMemo(() => {
    const keys: string[] = [];
    for (const k of Object.keys(projected)) {
      if (k === "folded") {
        const f = projected.folded!;
        if (mode === "folded-front") keys.push("folded.front");
        else if (mode === "folded-back") keys.push("folded.back");
        else if (mode === "folded-structure") keys.push(`folded.mode = ${f.mode}`);
        else keys.push("folded.front", "folded.back", `folded.mode = ${f.mode}`);
      } else keys.push(k);
    }
    return keys;
  }, [projected, mode]);

  const availableModes = useMemo(
    () => COPY_MODES.filter((m) => !m.foldedOnly || isFoldedSource),
    [isFoldedSource],
  );

  function apply() {
    let copied = 0, skipped = 0;
    const next: FormatCustomizations = { ...customizations };
    for (const f of targetFormats) {
      const merged = mergeForCopy(next[f.id], projected, mode, f.folded === true);
      if (merged == null) { skipped++; continue; }
      next[f.id] = merged;
      copied++;
    }
    onApply(next, { copied, skipped, mode });
    onOpenChange(false);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[85vh] max-w-2xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2"><Copy className="h-4 w-4"/>Copy settings from {sourceFormat.name}</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label className="text-xs">Copy mode</Label>
            <select value={mode} onChange={(e) => setMode(e.target.value as CopyMode)} className="w-full rounded-xl border border-border bg-background px-3 py-2 text-sm">
              {availableModes.map((m) => <option key={m.id} value={m.id}>{m.label}</option>)}
            </select>
            <p className="text-[10px] text-muted-foreground">{COPY_MODES.find((m) => m.id === mode)?.description}</p>
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs">Target formats</Label>
            <RadioGroup value={targetSel} onValueChange={(v) => setTargetSel(v as TargetSel)} className="space-y-1">
              <label className="flex cursor-pointer items-center gap-2 rounded-lg border border-border/60 px-2 py-1.5 text-xs hover:bg-accent">
                <RadioGroupItem value="similar"/>Similar formats ({similar.length})
              </label>
              <label className="flex cursor-pointer items-center gap-2 rounded-lg border border-border/60 px-2 py-1.5 text-xs hover:bg-accent">
                <RadioGroupItem value="all"/>All selected formats ({otherSelected.length})
              </label>
              <label className="flex cursor-pointer items-center gap-2 rounded-lg border border-border/60 px-2 py-1.5 text-xs hover:bg-accent">
                <RadioGroupItem value="manual"/>Manually selected
              </label>
            </RadioGroup>
          </div>

          {targetSel === "manual" && (
            <div className="max-h-40 space-y-1 overflow-y-auto rounded-xl border border-border/60 p-2">
              {otherSelected.map((f) => (
                <label key={f.id} className="flex items-center gap-2 rounded-lg px-2 py-1 text-xs hover:bg-accent">
                  <Checkbox checked={manualIds.includes(f.id)} onCheckedChange={(v) => setManualIds(v ? [...manualIds, f.id] : manualIds.filter((x) => x !== f.id))}/>
                  {f.name}
                </label>
              ))}
            </div>
          )}

          {/* Preview target list with uncheckable rows */}
          <div className="space-y-1.5">
            <Label className="text-xs">Preview — targets that will be updated</Label>
            <div className="max-h-40 space-y-1 overflow-y-auto rounded-xl border border-border/60 p-2">
              {targetFormats.length === 0 ? (
                <p className="p-1.5 text-[11px] text-muted-foreground">No compatible targets.</p>
              ) : targetFormats.map((f) => {
                const foldedOnly = mode === "folded-front" || mode === "folded-back" || mode === "folded-structure";
                const skipped = foldedOnly && !f.folded;
                const active = manualIds.includes(f.id) || targetSel !== "manual";
                return (
                  <label key={f.id} className={`flex items-center gap-2 rounded-lg px-2 py-1 text-xs ${skipped ? "opacity-50" : "hover:bg-accent"}`}>
                    <Checkbox
                      checked={active}
                      onCheckedChange={(v) => {
                        if (targetSel !== "manual") setTargetSel("manual");
                        setManualIds((ids) => v ? Array.from(new Set([...ids, f.id])) : ids.filter((x) => x !== f.id));
                      }}
                    />
                    <span className="flex-1">{f.name}</span>
                    {skipped && <span className="text-[10px] text-amber-500">skipped · not folded</span>}
                  </label>
                );
              })}
            </div>
          </div>

          <div className="rounded-xl bg-accent/30 p-3 text-[11px]">
            <p className="font-semibold">Fields that will be copied</p>
            <p className="font-mono text-[10px] text-muted-foreground">
              {projectedKeys.length === 0 ? "(no matching fields on source override)" : projectedKeys.join(" · ")}
            </p>
          </div>
        </div>

        <DialogFooter className="mt-4 gap-2 sm:justify-between">
          <Button variant="ghost" onClick={onUndo} disabled={!canUndo} className="rounded-full text-xs">
            <Undo2 className="mr-1 h-3 w-3"/>Undo copied settings
          </Button>
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => onOpenChange(false)} className="rounded-full">Cancel</Button>
            <Button onClick={apply} disabled={targetFormats.length === 0 || projectedKeys.length === 0} className="rounded-full">
              <Copy className="mr-1 h-3 w-3"/>Apply copy ({targetFormats.filter((f) => !((mode === "folded-front" || mode === "folded-back" || mode === "folded-structure") && !f.folded)).length})
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
