import { useEffect, useMemo, useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { Loader2, Download, FileText, Package, ImageIcon, AlertCircle } from "lucide-react";
import { toast } from "sonner";
import {
  CATEGORY_FILTERS,
  FORMATS,
  LAYOUT_TEMPLATES,
  QUICK_PACKS,
  SHAPE_FILTERS,
  safeArea,
  type BusinessFormat,
  type FormatCategory,
  type FormatShape,
  type LayoutTemplate,
} from "@/lib/qr-formats";
import { renderFormatSvg, type FormatContent } from "@/lib/format-render";
import {
  downloadFormatPng,
  downloadFormatSvg,
  downloadFormatPdf,
  downloadPackZip,
} from "@/lib/format-export";
import type { QrDesign } from "@/lib/qr-design";

type ShapeFilter = FormatShape | "all";
type CategoryFilter = FormatCategory | "all";
type MediumFilter = "all" | "print" | "digital";

type Props = {
  projectName: string;
  setProjectName: (v: string) => void;
  layoutTemplate: LayoutTemplate;
  setLayoutTemplate: (v: LayoutTemplate) => void;
  selectedIds: string[];
  setSelectedIds: (ids: string[]) => void;
  content: FormatContent;
  setContent: (c: FormatContent) => void;
  qrDesign: QrDesign;
  qrData: string;
  logoUrl: string | null;
  brand: string;
  onSave: () => Promise<void>;
  saving: boolean;
  saveError: string | null;
};

export function FormatStudio(props: Props) {
  const {
    projectName, setProjectName,
    layoutTemplate, setLayoutTemplate,
    selectedIds, setSelectedIds,
    content, setContent,
    qrDesign, qrData, logoUrl, brand,
    onSave, saving, saveError,
  } = props;

  const [shape, setShape] = useState<ShapeFilter>("all");
  const [category, setCategory] = useState<CategoryFilter>("all");
  const [medium, setMedium] = useState<MediumFilter>("all");
  const [exporting, setExporting] = useState<string | null>(null);

  const filtered = useMemo(() => {
    return FORMATS.filter((f) => {
      if (shape !== "all" && f.shape !== shape) return false;
      if (category !== "all" && f.category !== category) return false;
      if (medium !== "all" && f.medium !== medium) return false;
      return true;
    });
  }, [shape, category, medium]);

  const selected = useMemo(
    () => selectedIds.map((id) => FORMATS.find((f) => f.id === id)).filter(Boolean) as BusinessFormat[],
    [selectedIds],
  );

  function toggleFormat(id: string) {
    if (selectedIds.includes(id)) setSelectedIds(selectedIds.filter((s) => s !== id));
    else setSelectedIds([...selectedIds, id]);
  }

  function applyQuickPack(ids: string[]) {
    setSelectedIds(Array.from(new Set([...selectedIds, ...ids])));
    toast.success("Pack added");
  }

  async function exportPack() {
    if (!selected.length) return toast.error("Select at least one format");
    setExporting("zip");
    try {
      await downloadPackZip(projectName || "format-pack", selected, layoutTemplate, () => content, qrDesign, qrData, logoUrl, brand);
      toast.success("ZIP downloaded");
    } catch (e) {
      toast.error(`Export failed: ${(e as Error).message}`);
    } finally { setExporting(null); }
  }

  return (
    <Card className="rounded-3xl border-border/70 shadow-[var(--shadow-card)]">
      <CardContent className="space-y-6 p-6">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h2 className="text-xl font-semibold tracking-tight">Choose your business format</h2>
            <p className="mt-1 text-xs text-muted-foreground">
              Select the physical or digital formats you want to print or share. Your QR design carries into every layout.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" onClick={onSave} disabled={saving} className="rounded-full">
              {saving ? <Loader2 className="mr-1 h-4 w-4 animate-spin"/> : null} Save project
            </Button>
            <Button onClick={exportPack} disabled={!selected.length || !!exporting} className="rounded-full">
              {exporting === "zip" ? <Loader2 className="mr-1 h-4 w-4 animate-spin"/> : <Package className="mr-1 h-4 w-4"/>}
              Download ZIP ({selected.length})
            </Button>
          </div>
        </div>

        {saveError && (
          <div className="flex items-center gap-2 rounded-2xl border border-destructive/40 bg-destructive/10 p-3 text-xs text-destructive">
            <AlertCircle className="h-4 w-4"/> {saveError}
            <Button size="sm" variant="ghost" className="ml-auto" onClick={onSave}>Retry</Button>
          </div>
        )}

        {/* Project name + content */}
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label className="text-xs uppercase tracking-wide text-muted-foreground">Project name</Label>
            <Input value={projectName} onChange={(e) => setProjectName(e.target.value)} placeholder="Glass House Google Review Pack" className="rounded-xl"/>
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs uppercase tracking-wide text-muted-foreground">Layout template</Label>
            <div className="flex flex-wrap gap-1.5">
              {LAYOUT_TEMPLATES.map((t) => (
                <button
                  key={t.id}
                  type="button"
                  onClick={() => setLayoutTemplate(t.id)}
                  title={t.description}
                  className={`rounded-full border px-3 py-1 text-xs transition-colors ${layoutTemplate === t.id ? "border-primary bg-primary text-primary-foreground" : "border-border bg-card hover:bg-accent"}`}
                >
                  {t.label}
                </button>
              ))}
            </div>
          </div>
          <div className="space-y-1.5 sm:col-span-2">
            <Label className="text-xs uppercase tracking-wide text-muted-foreground">Headline</Label>
            <Input value={content.headline} onChange={(e) => setContent({ ...content, headline: e.target.value })} className="rounded-xl"/>
          </div>
          <div className="space-y-1.5 sm:col-span-2">
            <Label className="text-xs uppercase tracking-wide text-muted-foreground">Supporting text</Label>
            <Textarea value={content.supportText} onChange={(e) => setContent({ ...content, supportText: e.target.value })} className="rounded-xl" rows={2}/>
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs uppercase tracking-wide text-muted-foreground">CTA</Label>
            <Input value={content.ctaText} onChange={(e) => setContent({ ...content, ctaText: e.target.value })} className="rounded-xl"/>
          </div>
        </div>

        {/* Quick packs */}
        <div className="rounded-2xl bg-accent/30 p-4">
          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Quick packs</p>
          <div className="mt-2 flex flex-wrap gap-2">
            {QUICK_PACKS.map((p) => (
              <Button key={p.id} size="sm" variant="outline" onClick={() => applyQuickPack(p.formatIds)} className="rounded-full">
                + {p.name}
              </Button>
            ))}
          </div>
        </div>

        {/* Filters */}
        <div className="space-y-3">
          <FilterRow label="Shape">
            <FilterChip active={shape === "all"} onClick={() => setShape("all")}>All</FilterChip>
            {SHAPE_FILTERS.map((s) => (
              <FilterChip key={s} active={shape === s} onClick={() => setShape(s)} primary={s === "circular"}>
                {cap(s)}
              </FilterChip>
            ))}
          </FilterRow>
          <FilterRow label="Category">
            <FilterChip active={category === "all"} onClick={() => setCategory("all")}>All</FilterChip>
            {CATEGORY_FILTERS.map((c) => (
              <FilterChip key={c} active={category === c} onClick={() => setCategory(c)}>{cap(c)}</FilterChip>
            ))}
          </FilterRow>
          <FilterRow label="Medium">
            <FilterChip active={medium === "all"} onClick={() => setMedium("all")}>All</FilterChip>
            <FilterChip active={medium === "print"} onClick={() => setMedium("print")}>Flat / print</FilterChip>
            <FilterChip active={medium === "digital"} onClick={() => setMedium("digital")}>Digital</FilterChip>
          </FilterRow>
        </div>

        {/* Format grid */}
        <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
          {filtered.map((f) => (
            <FormatCard key={f.id} format={f} checked={selectedIds.includes(f.id)} onToggle={() => toggleFormat(f.id)} />
          ))}
        </div>

        {/* Previews */}
        {selected.length > 0 && (
          <div className="space-y-3">
            <h3 className="text-sm font-semibold tracking-tight">Live previews ({selected.length})</h3>
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {selected.map((f) => (
                <FormatPreviewCard
                  key={f.id}
                  format={f}
                  layoutTemplate={layoutTemplate}
                  content={content}
                  qrDesign={qrDesign}
                  qrData={qrData}
                  logoUrl={logoUrl}
                  brand={brand}
                  exporting={exporting}
                  setExporting={setExporting}
                />
              ))}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function cap(s: string) { return s.charAt(0).toUpperCase() + s.slice(1); }

function FilterRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      <span className="mr-1 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">{label}</span>
      {children}
    </div>
  );
}
function FilterChip({ active, primary, onClick, children }: { active: boolean; primary?: boolean; onClick: () => void; children: React.ReactNode }) {
  const base = "rounded-full border px-3 py-1 text-xs transition-colors";
  const cls = active
    ? primary
      ? "border-primary bg-primary text-primary-foreground shadow-[0_0_0_2px_var(--color-primary)]"
      : "border-primary bg-primary text-primary-foreground"
    : primary
      ? "border-primary/60 bg-primary/10 text-primary hover:bg-primary/20"
      : "border-border bg-card hover:bg-accent";
  return <button type="button" onClick={onClick} className={`${base} ${cls}`}>{children}</button>;
}

function FormatCard({ format, checked, onToggle }: { format: BusinessFormat; checked: boolean; onToggle: () => void }) {
  const sa = safeArea(format);
  const unit = format.medium === "print" ? "mm" : "px";
  return (
    <label className={`flex cursor-pointer flex-col gap-2 rounded-2xl border p-4 text-xs transition-colors ${checked ? "border-primary bg-primary/5" : "border-border/70 bg-card hover:bg-accent/30"}`}>
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-sm font-semibold">{format.name}</p>
          <p className="mt-0.5 text-[11px] text-muted-foreground">{format.width} × {format.height} {unit}</p>
        </div>
        <Checkbox checked={checked} onCheckedChange={onToggle}/>
      </div>
      <div className="flex flex-wrap gap-1">
        <Badge variant="outline" className="rounded-full text-[10px]">{cap(format.shape)}</Badge>
        <Badge variant="outline" className="rounded-full text-[10px]">{cap(format.category)}</Badge>
        <Badge variant="outline" className="rounded-full text-[10px]">{format.medium === "print" ? "Print" : "Digital"}</Badge>
      </div>
      <div className="grid grid-cols-2 gap-x-2 text-[10px] text-muted-foreground">
        <span>Bleed: {format.bleed} {unit}</span>
        <span>Safe: {Math.round(sa.w)} × {Math.round(sa.h)} {unit}</span>
        <span>Min QR: {format.minQrSize} {unit}</span>
        <span className="truncate">{format.material}</span>
      </div>
    </label>
  );
}

function FormatPreviewCard(props: {
  format: BusinessFormat;
  layoutTemplate: LayoutTemplate;
  content: FormatContent;
  qrDesign: QrDesign;
  qrData: string;
  logoUrl: string | null;
  brand: string;
  exporting: string | null;
  setExporting: (v: string | null) => void;
}) {
  const { format, layoutTemplate, content, qrDesign, qrData, logoUrl, brand, exporting, setExporting } = props;
  const [svg, setSvg] = useState<string>("");
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setErr(null);
    renderFormatSvg(format, layoutTemplate, content, qrDesign, qrData, logoUrl, brand, {
      showBoundaries: true,
      includeBleed: format.bleed > 0,
    })
      .then((s) => { if (!cancelled) setSvg(s); })
      .catch((e) => { if (!cancelled) setErr((e as Error).message); });
    return () => { cancelled = true; };
  }, [format, layoutTemplate, content, qrDesign, qrData, logoUrl, brand]);

  async function run(kind: "png" | "svg" | "pdf") {
    const key = `${format.id}-${kind}`;
    setExporting(key);
    try {
      if (kind === "png") await downloadFormatPng(format, layoutTemplate, content, qrDesign, qrData, logoUrl, brand);
      else if (kind === "svg") await downloadFormatSvg(format, layoutTemplate, content, qrDesign, qrData, logoUrl, brand);
      else await downloadFormatPdf(format, layoutTemplate, content, qrDesign, qrData, logoUrl, brand);
      toast.success(`${kind.toUpperCase()} downloaded`);
    } catch (e) {
      toast.error(`Export failed: ${(e as Error).message}`);
    } finally { setExporting(null); }
  }

  const isSvgEligible = format.medium === "digital" || format.bleed === 0 || true;

  return (
    <div className="rounded-2xl border border-border/70 bg-card p-3">
      <p className="mb-2 text-xs font-semibold">{format.name}</p>
      <div className="aspect-[3/4] w-full overflow-hidden rounded-xl bg-white/5 [&_svg]:h-full [&_svg]:w-full" dangerouslySetInnerHTML={{ __html: svg || "" }} />
      {err && <p className="mt-2 text-[10px] text-destructive">{err}</p>}
      <div className="mt-2 grid grid-cols-3 gap-1.5">
        <Button size="sm" variant="outline" onClick={() => run("png")} disabled={exporting !== null} className="rounded-full text-[11px]">
          {exporting === `${format.id}-png` ? <Loader2 className="h-3 w-3 animate-spin"/> : <ImageIcon className="h-3 w-3 mr-1"/>} PNG
        </Button>
        <Button size="sm" variant="outline" onClick={() => run("svg")} disabled={exporting !== null || !isSvgEligible} className="rounded-full text-[11px]">
          {exporting === `${format.id}-svg` ? <Loader2 className="h-3 w-3 animate-spin"/> : <Download className="h-3 w-3 mr-1"/>} SVG
        </Button>
        <Button size="sm" variant="outline" onClick={() => run("pdf")} disabled={exporting !== null} className="rounded-full text-[11px]">
          {exporting === `${format.id}-pdf` ? <Loader2 className="h-3 w-3 animate-spin"/> : <FileText className="h-3 w-3 mr-1"/>} PDF
        </Button>
      </div>
    </div>
  );
}
