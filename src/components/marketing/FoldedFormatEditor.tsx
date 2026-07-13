// Folded-format editor: dedicated dialog with Front / Back / Structure / Preview tabs.
// Replaces the standard override dialog for folded formats.

import { useEffect, useMemo, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Slider } from "@/components/ui/slider";
import { Badge } from "@/components/ui/badge";
import { Loader2, Layers, Eye, PanelTop, PanelBottom } from "lucide-react";
import type { BusinessFormat, LayoutTemplate } from "@/lib/qr-formats";
import type { QrDesign } from "@/lib/qr-design";
import {
  type FoldedConfig, type FoldedPanelContent, type FoldedMode,
  DEFAULT_FOLDED_PANEL, defaultFoldedConfig,
  type ContentBase,
} from "@/lib/marketing-packs";
import { getFoldedLayout } from "@/lib/folded-layouts";
import { renderFoldedFormatSvg, renderFoldedMockupSvg } from "@/lib/folded-render";

type Props = {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  format: BusinessFormat;
  contentBase: ContentBase;
  layoutTemplate: LayoutTemplate;
  brand: string;
  qrDesign: QrDesign;
  qrData: string;
  qrLogoUrl: string | null;
  config: FoldedConfig | undefined;
  onSave: (c: FoldedConfig) => void;
  onClear: () => void;
};

export function FoldedFormatEditor(props: Props) {
  const { open, onOpenChange, format, contentBase, layoutTemplate, brand, qrDesign, qrData, qrLogoUrl, config, onSave, onClear } = props;
  const [draft, setDraft] = useState<FoldedConfig>(() => config ?? defaultFoldedConfig(contentBase));
  const [tab, setTab] = useState("front");
  useEffect(() => { if (open) setDraft(config ?? defaultFoldedConfig(contentBase)); }, [open, config, contentBase]);

  const layout = useMemo(() => getFoldedLayout(format), [format]);

  function patchFront<K extends keyof FoldedPanelContent>(k: K, v: FoldedPanelContent[K]) {
    setDraft((d) => ({ ...d, front: { ...d.front, [k]: v } }));
  }
  function patchBack<K extends keyof FoldedPanelContent>(k: K, v: FoldedPanelContent[K]) {
    setDraft((d) => ({ ...d, back: { ...d.back, [k]: v } }));
  }
  function setMode(mode: FoldedMode) { setDraft((d) => ({ ...d, mode })); }

  const backLocked = draft.mode !== "different_sides";
  const backContent: FoldedPanelContent = backLocked ? draft.front : draft.back;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] max-w-4xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Layers className="h-4 w-4"/> Folded editor — {format.name}
            <Badge variant="secondary" className="rounded-full text-[10px]">
              {draft.mode === "same_both_sides" ? "Same both sides" : draft.mode === "mirrored" ? "Mirrored" : "Different sides"}
            </Badge>
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-3">
          <ModeSelector value={draft.mode} onChange={setMode}/>

          <Tabs value={tab} onValueChange={setTab}>
            <TabsList className="w-full">
              <TabsTrigger value="front" className="flex-1"><PanelTop className="mr-1.5 h-3.5 w-3.5"/>Front</TabsTrigger>
              <TabsTrigger value="back" className="flex-1" disabled={backLocked && draft.mode === "same_both_sides"}>
                <PanelBottom className="mr-1.5 h-3.5 w-3.5"/>Back
              </TabsTrigger>
              <TabsTrigger value="structure" className="flex-1"><Layers className="mr-1.5 h-3.5 w-3.5"/>Structure</TabsTrigger>
              <TabsTrigger value="preview" className="flex-1"><Eye className="mr-1.5 h-3.5 w-3.5"/>Preview</TabsTrigger>
            </TabsList>

            <TabsContent value="front" className="mt-3">
              <PanelForm panel={draft.front} onChange={(k, v) => patchFront(k, v)}/>
            </TabsContent>

            <TabsContent value="back" className="mt-3">
              {backLocked ? (
                <div className="space-y-3">
                  <div className="rounded-xl bg-accent/40 p-3 text-xs">
                    {draft.mode === "same_both_sides"
                      ? "Same-both-sides mode: back panel uses the same content as front. Switch to Different sides to edit the back independently."
                      : "Mirrored mode: back panel uses the same content as front and is rotated 180° in production so it reads upright when the tent stands."}
                  </div>
                  <PanelForm panel={backContent} disabled onChange={() => undefined}/>
                </div>
              ) : (
                <PanelForm panel={draft.back} onChange={(k, v) => patchBack(k, v)}/>
              )}
            </TabsContent>

            <TabsContent value="structure" className="mt-3">
              <StructureView format={format}/>
            </TabsContent>

            <TabsContent value="preview" className="mt-3">
              <PreviewView
                format={format}
                config={draft}
                template={layoutTemplate}
                brand={brand}
                business={{ name: contentBase.businessName, logoUrl: contentBase.logoUrl }}
                qrDesign={qrDesign}
                qrData={qrData}
                qrLogoUrl={qrLogoUrl}
              />
            </TabsContent>
          </Tabs>
        </div>

        <DialogFooter className="flex-row justify-between gap-2 sm:justify-between">
          <Button variant="ghost" onClick={() => { onClear(); onOpenChange(false); }} className="rounded-full">Reset to defaults</Button>
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => onOpenChange(false)} className="rounded-full">Cancel</Button>
            <Button onClick={() => { onSave(draft); onOpenChange(false); }} className="rounded-full">Save folded design</Button>
          </div>
        </DialogFooter>
        {!layout && (
          <p className="text-[10px] text-destructive">No folded layout registered for this format.</p>
        )}
      </DialogContent>
    </Dialog>
  );
}

function ModeSelector({ value, onChange }: { value: FoldedMode; onChange: (v: FoldedMode) => void }) {
  const options: { id: FoldedMode; label: string; desc: string }[] = [
    { id: "same_both_sides", label: "Same both sides", desc: "Front and back share the same content" },
    { id: "mirrored", label: "Mirrored layout", desc: "Same content, back rotated 180° for readability" },
    { id: "different_sides", label: "Different front and back", desc: "Edit front and back independently" },
  ];
  return (
    <div className="grid gap-2 sm:grid-cols-3">
      {options.map((o) => (
        <button
          key={o.id}
          type="button"
          onClick={() => onChange(o.id)}
          className={`rounded-xl border p-2.5 text-left transition-colors ${value === o.id ? "border-primary bg-primary/10" : "border-border hover:bg-accent"}`}
        >
          <p className="text-xs font-semibold">{o.label}</p>
          <p className="text-[10px] text-muted-foreground">{o.desc}</p>
        </button>
      ))}
    </div>
  );
}

function PanelForm({ panel, disabled, onChange }: {
  panel: FoldedPanelContent;
  disabled?: boolean;
  onChange: <K extends keyof FoldedPanelContent>(k: K, v: FoldedPanelContent[K]) => void;
}) {
  const p = { ...DEFAULT_FOLDED_PANEL, ...panel };
  return (
    <div className="space-y-4">
      <div className="grid gap-3">
        <div className="space-y-1.5">
          <Label className="text-xs">Headline</Label>
          <Input value={p.headline ?? ""} onChange={(e) => onChange("headline", e.target.value)} disabled={disabled} className="rounded-xl"/>
        </div>
        <div className="space-y-1.5">
          <Label className="text-xs">Supporting text</Label>
          <Textarea rows={2} value={p.supportText ?? ""} onChange={(e) => onChange("supportText", e.target.value)} disabled={disabled} className="rounded-xl"/>
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label className="text-xs">CTA</Label>
            <Input value={p.ctaText ?? ""} onChange={(e) => onChange("ctaText", e.target.value)} disabled={disabled} className="rounded-xl"/>
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Footer</Label>
            <Input value={p.footerText ?? ""} onChange={(e) => onChange("footerText", e.target.value)} disabled={disabled} className="rounded-xl"/>
          </div>
        </div>
      </div>

      <div className="grid gap-2 rounded-xl bg-accent/30 p-3 sm:grid-cols-2">
        <ChkRow label="Show QR" value={p.showQr !== false} onChange={(v) => onChange("showQr", v)} disabled={disabled}/>
        <ChkRow label="Show logo" value={p.showLogo !== false} onChange={(v) => onChange("showLogo", v)} disabled={disabled}/>
        <ChkRow label="Show business name" value={p.showBusinessName !== false} onChange={(v) => onChange("showBusinessName", v)} disabled={disabled}/>
        <ChkRow label="Show stars" value={p.showStars !== false} onChange={(v) => onChange("showStars", v)} disabled={disabled}/>
        <ChkRow label="Show Google badge" value={p.showGoogleBadge !== false} onChange={(v) => onChange("showGoogleBadge", v)} disabled={disabled}/>
      </div>

      <div className="grid gap-3 rounded-xl border border-border/60 p-3 sm:grid-cols-3">
        <SliderRow label="QR size" value={p.qrScale ?? 0.45} min={0.3} max={0.7} step={0.01} onChange={(v) => onChange("qrScale", v)} disabled={disabled}/>
        <SliderRow label="QR horizontal" value={p.qrOffsetX ?? 0} min={-0.35} max={0.35} step={0.01} onChange={(v) => onChange("qrOffsetX", v)} disabled={disabled}/>
        <SliderRow label="QR vertical" value={p.qrOffsetY ?? 0} min={-0.35} max={0.35} step={0.01} onChange={(v) => onChange("qrOffsetY", v)} disabled={disabled}/>
      </div>

      <div className="grid gap-3 sm:grid-cols-3">
        <ColorRow label="Background" value={p.backgroundColor} onChange={(v) => onChange("backgroundColor", v)} disabled={disabled}/>
        <ColorRow label="Text" value={p.textColor} onChange={(v) => onChange("textColor", v)} disabled={disabled}/>
        <ColorRow label="Accent" value={p.accentColor} onChange={(v) => onChange("accentColor", v)} disabled={disabled}/>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label className="text-xs">Text alignment</Label>
          <div className="flex gap-1">
            {(["left", "center", "right"] as const).map((a) => (
              <button
                key={a}
                type="button"
                disabled={disabled}
                onClick={() => onChange("textAlign", a)}
                className={`flex-1 rounded-full border px-2 py-1 text-[11px] ${p.textAlign === a ? "border-primary bg-primary/10" : "border-border"}`}
              >{a}</button>
            ))}
          </div>
        </div>
        <div className="space-y-1.5">
          <Label className="text-xs">Background image URL</Label>
          <Input value={p.backgroundImage ?? ""} onChange={(e) => onChange("backgroundImage", e.target.value || null)} disabled={disabled} placeholder="https://…" className="rounded-xl"/>
        </div>
      </div>
      {p.backgroundImage && (
        <SliderRow label="Background opacity" value={p.backgroundImageOpacity ?? 1} min={0} max={1} step={0.05} onChange={(v) => onChange("backgroundImageOpacity", v)} disabled={disabled}/>
      )}
    </div>
  );
}

function StructureView({ format }: { format: BusinessFormat }) {
  const layout = getFoldedLayout(format);
  if (!layout) return <p className="text-xs text-muted-foreground">No folded layout for this format.</p>;
  const [g, setG] = useState({ fold: true, score: true, cut: true, glue: true, labels: true, safe: true });
  const [preview, setPreview] = useState<string>("");

  useEffect(() => {
    // Structure preview: production SVG on top of an empty flat sheet
    const svg = renderStructureSvg(layout, g);
    setPreview(svg);
  }, [layout, g]);

  return (
    <div className="grid gap-4 md:grid-cols-[220px_1fr]">
      <div className="space-y-2 text-[11px]">
        <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">Dimensions</p>
        <dl className="space-y-1">
          <Row k="Flat artwork" v={`${layout.flatWidth} × ${layout.flatHeight} mm`}/>
          <Row k="Assembled face" v={`${layout.assembledWidth} × ${layout.assembledHeight} mm`}/>
          <Row k="Bleed" v={`${layout.bleed} mm`}/>
          <Row k="Safe inset" v={`${layout.safeInset} mm`}/>
          <Row k="Panels" v={layout.panels.map((p) => p.label).join(", ")}/>
          <Row k="Fold lines" v={String(layout.segments.filter((s) => s.type === "fold").length)}/>
          <Row k="Score lines" v={String(layout.segments.filter((s) => s.type === "score").length)}/>
          <Row k="Glue area" v={layout.glue ? "Yes" : "None"}/>
        </dl>
        <p className="mt-3 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">Layers</p>
        <ChkRow label="Fold lines" value={g.fold} onChange={(v) => setG({ ...g, fold: v })}/>
        <ChkRow label="Score lines" value={g.score} onChange={(v) => setG({ ...g, score: v })}/>
        <ChkRow label="Cut path" value={g.cut} onChange={(v) => setG({ ...g, cut: v })}/>
        <ChkRow label="Glue area" value={g.glue} onChange={(v) => setG({ ...g, glue: v })}/>
        <ChkRow label="Panel labels" value={g.labels} onChange={(v) => setG({ ...g, labels: v })}/>
        <ChkRow label="Safe area" value={g.safe} onChange={(v) => setG({ ...g, safe: v })}/>
      </div>
      <div className="rounded-xl border border-border/70 bg-white p-2 [&_svg]:h-auto [&_svg]:w-full" dangerouslySetInnerHTML={{ __html: preview }}/>
    </div>
  );
}

function renderStructureSvg(layout: import("@/lib/folded-layouts").FoldedLayout, g: { fold: boolean; score: boolean; cut: boolean; glue: boolean; labels: boolean; safe: boolean }): string {
  const b = layout.bleed;
  const w = layout.flatWidth + b * 2;
  const h = layout.flatHeight + b * 2;
  const parts: string[] = [];
  parts.push(`<svg xmlns="http://www.w3.org/2000/svg" width="${w}mm" height="${h}mm" viewBox="0 0 ${w} ${h}">`);
  parts.push(`<rect x="0" y="0" width="${w}" height="${h}" fill="#f8fafc"/>`);
  parts.push(`<rect x="${b}" y="${b}" width="${layout.flatWidth}" height="${layout.flatHeight}" fill="#ffffff" stroke="#cbd5e1" stroke-width="0.3"/>`);
  if (g.safe) {
    for (const p of layout.panels) {
      const s = layout.safeInset;
      parts.push(`<rect x="${b + p.x + s}" y="${b + p.y + s}" width="${p.w - s * 2}" height="${p.h - s * 2}" fill="none" stroke="#22c55e" stroke-width="0.3" stroke-dasharray="1.5 1.5"/>`);
    }
  }
  for (const s of layout.segments) {
    if (s.type === "cut" && !g.cut) continue;
    if (s.type === "fold" && !g.fold) continue;
    if (s.type === "score" && !g.score) continue;
    const color = s.type === "cut" ? "#ff00ff" : s.type === "fold" ? "#00a651" : "#f59e0b";
    const dash = s.type === "cut" ? undefined : (s.type === "fold" ? "3 2" : "1 1");
    parts.push(`<line x1="${b + s.x1}" y1="${b + s.y1}" x2="${b + s.x2}" y2="${b + s.y2}" stroke="${color}" stroke-width="${s.type === "cut" ? 0.4 : 0.5}"${dash ? ` stroke-dasharray="${dash}"` : ""}/>`);
  }
  if (g.glue && layout.glue) {
    parts.push(`<rect x="${b + layout.glue.x}" y="${b + layout.glue.y}" width="${layout.glue.w}" height="${layout.glue.h}" fill="#3b82f6" fill-opacity="0.15" stroke="#3b82f6" stroke-dasharray="2 2" stroke-width="0.3"/>`);
  }
  if (g.labels) {
    for (const p of layout.panels) {
      parts.push(`<text x="${b + p.x + 3}" y="${b + p.y + 6}" font-family="Inter, sans-serif" font-size="4" font-weight="700" fill="#64748b">${p.label.toUpperCase()}</text>`);
    }
  }
  parts.push(`</svg>`);
  return parts.join("");
}

function PreviewView(props: {
  format: BusinessFormat;
  config: FoldedConfig;
  template: LayoutTemplate;
  brand: string;
  business: { name: string; logoUrl: string | null };
  qrDesign: QrDesign;
  qrData: string;
  qrLogoUrl: string | null;
}) {
  const [mode, setMode] = useState<"flat" | "front" | "back" | "mockup">("mockup");
  const [svg, setSvg] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    const input = {
      format: props.format, template: props.template, brand: props.brand,
      business: props.business, qrDesign: props.qrDesign, qrData: props.qrData,
      qrLogoUrl: props.qrLogoUrl, config: props.config,
    };
    const p = mode === "mockup"
      ? renderFoldedMockupSvg(input)
      : renderFoldedFormatSvg(input, { facing: mode, includeBleed: mode === "flat", showFold: mode === "flat", showCut: mode === "flat", showSafe: mode === "flat", showPanelLabels: mode === "flat" });
    p.then((s) => { if (!cancelled) { setSvg(s); setLoading(false); } })
      .catch(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode, JSON.stringify(props.config), props.format.id, props.template, props.qrData, props.brand]);

  const opts: { id: typeof mode; label: string }[] = [
    { id: "mockup", label: "Folded proof preview" },
    { id: "flat", label: "Flat artwork" },
    { id: "front", label: "Front" },
    { id: "back", label: "Back" },
  ];

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-1.5">
        {opts.map((o) => (
          <button key={o.id} type="button" onClick={() => setMode(o.id)} className={`rounded-full border px-3 py-1 text-[11px] ${mode === o.id ? "border-primary bg-primary text-primary-foreground" : "border-border hover:bg-accent"}`}>{o.label}</button>
        ))}
      </div>
      {mode === "mockup" && (
        <p className="text-[10px] text-muted-foreground">Shows front and back assembled faces side by side.</p>
      )}
      <div className="min-h-[280px] rounded-xl border border-border/70 bg-white p-3 [&_svg]:h-auto [&_svg]:max-h-[520px] [&_svg]:w-auto [&_svg]:mx-auto [&_svg]:block">
        {loading ? <div className="flex h-[280px] items-center justify-center text-xs text-muted-foreground"><Loader2 className="mr-1 h-3 w-3 animate-spin"/>Rendering…</div>
          : <div dangerouslySetInnerHTML={{ __html: svg }}/>}
      </div>
    </div>
  );
}

function ChkRow({ label, value, onChange, disabled }: { label: string; value: boolean; onChange: (v: boolean) => void; disabled?: boolean }) {
  return (
    <label className="flex items-center gap-2 text-xs">
      <Checkbox checked={value} onCheckedChange={(v) => onChange(v === true)} disabled={disabled}/> {label}
    </label>
  );
}
function SliderRow({ label, value, min, max, step, onChange, disabled }: { label: string; value: number; min: number; max: number; step: number; onChange: (v: number) => void; disabled?: boolean }) {
  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between text-[10px] text-muted-foreground"><span>{label}</span><span>{value.toFixed(2)}</span></div>
      <Slider min={min} max={max} step={step} value={[value]} onValueChange={(v) => onChange(v[0])} disabled={disabled}/>
    </div>
  );
}
function ColorRow({ label, value, onChange, disabled }: { label: string; value: string | null | undefined; onChange: (v: string | null) => void; disabled?: boolean }) {
  return (
    <div className="space-y-1">
      <Label className="text-xs">{label}</Label>
      <div className="flex items-center gap-2">
        <Input type="color" value={value ?? "#000000"} onChange={(e) => onChange(e.target.value)} className="h-8 w-12 rounded-lg" disabled={disabled}/>
        <Input value={value ?? ""} onChange={(e) => onChange(e.target.value || null)} placeholder="Use template" className="h-8 rounded-lg text-[11px]" disabled={disabled}/>
        {value && !disabled && (
          <Button variant="ghost" size="sm" onClick={() => onChange(null)} className="h-7 rounded-full text-[10px]">Clear</Button>
        )}
      </div>
    </div>
  );
}
function Row({ k, v }: { k: string; v: string }) {
  return <div className="flex justify-between gap-2"><dt className="text-muted-foreground">{k}</dt><dd className="text-right font-medium">{v}</dd></div>;
}
