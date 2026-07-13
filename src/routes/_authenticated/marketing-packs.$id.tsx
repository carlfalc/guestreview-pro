import { createFileRoute, Link, useNavigate, useParams } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Checkbox } from "@/components/ui/checkbox";
import {
  ArrowLeft, Save, Loader2, Download, FileText, ImageIcon, Package,
  AlertTriangle, CheckCircle2, Copy, Archive, Trash2, Settings2, RotateCw,
} from "lucide-react";
import { toast } from "sonner";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  FORMATS, LAYOUT_TEMPLATES, QUICK_PACKS, SHAPE_FILTERS, CATEGORY_FILTERS,
  safeArea, type BusinessFormat, type LayoutTemplate,
} from "@/lib/qr-formats";
import { renderFormatSvg, svgToPng, type FormatContent } from "@/lib/format-render";
import {
  downloadFormatPng, downloadFormatSvg, downloadFormatPdf, downloadPackZip,
} from "@/lib/format-export";
import { mergeDesign, type QrDesign } from "@/lib/qr-design";
import {
  statusMeta, packTypeById, buildFormatContent,
  type GlobalSettings, type FormatCustomizations, type FormatOverride, type PackStatus, type ContentBase,
} from "@/lib/marketing-packs";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Slider } from "@/components/ui/slider";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import jsQR from "jsqr";

export const Route = createFileRoute("/_authenticated/marketing-packs/$id")({
  component: MarketingPackEditor,
});

type SaveState = "idle" | "saving" | "saved" | "error";

function MarketingPackEditor() {
  const { id } = useParams({ from: "/_authenticated/marketing-packs/$id" });
  const qc = useQueryClient();
  const navigate = useNavigate();

  const { data: pack, isLoading, error } = useQuery({
    queryKey: ["marketing-pack", id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("marketing_packs")
        .select("*, businesses(id, name, brand_primary, logo_url, google_review_url), qr_codes(id, short_code, label, destination_type, destination_url, design, logo_url, fg_color, bg_color)")
        .eq("id", id)
        .single();
      if (error) throw error;
      return data;
    },
  });

  // Editor state (initialised from pack)
  const [projectName, setProjectName] = useState("");
  const [layoutTemplate, setLayoutTemplate] = useState<LayoutTemplate>("clean-minimal");
  const [headline, setHeadline] = useState("");
  const [supportText, setSupportText] = useState("");
  const [ctaText, setCtaText] = useState("");
  const [footerText, setFooterText] = useState("");
  const [showBusinessName, setShowBusinessName] = useState(true);
  const [showLogo, setShowLogo] = useState(true);
  const [showStars, setShowStars] = useState(true);
  const [showGoogleBadge, setShowGoogleBadge] = useState(true);
  const [selectedFormats, setSelectedFormats] = useState<string[]>([]);
  const [globalSettings, setGlobalSettings] = useState<GlobalSettings>({});
  const [formatCustomizations, setFormatCustomizations] = useState<FormatCustomizations>({});
  const [status, setStatus] = useState<PackStatus>("draft");

  const [saveState, setSaveState] = useState<SaveState>("idle");
  const [saveError, setSaveError] = useState<string | null>(null);
  const [dirty, setDirty] = useState(false);
  const [exporting, setExporting] = useState<string | null>(null);

  // Initialise once loaded
  const initialised = useRef(false);
  useEffect(() => {
    if (!pack || initialised.current) return;
    setProjectName(pack.project_name);
    setLayoutTemplate((pack.layout_template as LayoutTemplate) ?? "clean-minimal");
    setHeadline(pack.headline ?? "Loved your visit?");
    setSupportText(pack.support_text ?? "Scan to leave us a review.");
    setCtaText(pack.cta_text ?? "Leave a review");
    setFooterText((pack as { footer_text?: string | null }).footer_text ?? "");
    setShowBusinessName((pack as { show_business_name?: boolean }).show_business_name ?? true);
    setShowLogo((pack as { show_logo?: boolean }).show_logo ?? true);
    setShowStars((pack as { show_stars?: boolean }).show_stars ?? true);
    setShowGoogleBadge((pack as { show_google_badge?: boolean }).show_google_badge ?? true);
    setSelectedFormats(Array.isArray(pack.selected_formats) ? (pack.selected_formats as string[]) : []);
    setGlobalSettings(((pack as { global_settings?: unknown }).global_settings as GlobalSettings) ?? {});
    setFormatCustomizations(((pack as { format_customizations?: unknown }).format_customizations as FormatCustomizations) ?? {});
    setStatus((pack.status as PackStatus) ?? "draft");
    initialised.current = true;
  }, [pack]);

  const biz = pack?.businesses as { id: string; name: string; brand_primary: string | null; logo_url: string | null; google_review_url: string | null } | null;
  const qrRow = pack?.qr_codes as { id: string; short_code: string; label: string | null; destination_type: string; design: unknown; logo_url: string | null; fg_color: string | null; bg_color: string | null } | null;

  const qrDesign: QrDesign = useMemo(() => mergeDesign((qrRow?.design as Partial<QrDesign> | null) ?? null), [qrRow]);
  const brand = biz?.brand_primary ?? "#0071e3";
  const rawLogoUrl = qrRow?.logo_url ?? biz?.logo_url ?? null;
  const qrData = typeof window !== "undefined" && qrRow ? `${window.location.origin}/r/${qrRow.short_code}` : "";

  const contentBase: ContentBase = useMemo(() => ({
    businessName: biz?.name ?? "",
    logoUrl: rawLogoUrl,
    headline,
    supportText,
    ctaText,
    footerText: footerText || undefined,
    showBusinessName,
    showLogo,
    showStars,
    showGoogleBadge,
  }), [biz, rawLogoUrl, headline, supportText, ctaText, footerText, showBusinessName, showLogo, showStars, showGoogleBadge]);

  const resolveContent = useCallback((f: BusinessFormat): FormatContent =>
    buildFormatContent(contentBase, globalSettings, formatCustomizations[f.id]),
    [contentBase, globalSettings, formatCustomizations],
  );

  const selected = useMemo(
    () => selectedFormats.map((fid) => FORMATS.find((f) => f.id === fid)).filter(Boolean) as BusinessFormat[],
    [selectedFormats],
  );

  // ---- Autosave ----
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const thumbTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const regenerateThumbnail = useCallback(async () => {
    if (!pack || !qrRow || selectedFormats.length === 0) return;
    if (thumbTimer.current) clearTimeout(thumbTimer.current);
    await new Promise<void>((resolve) => { thumbTimer.current = setTimeout(resolve, 400); });
    try {
      const first = FORMATS.find((f) => f.id === selectedFormats[0]);
      if (!first) return;
      const c = buildFormatContent(contentBase, globalSettings, formatCustomizations[first.id]);
      const svg = await renderFormatSvg(first, layoutTemplate, c, qrDesign, qrData, c.logoUrl, brand, { includeBleed: false, showBoundaries: false });
      const blob = await svgToPng(svg, 480, 480);
      const { data: userData } = await supabase.auth.getUser();
      if (!userData.user) return;
      const path = `${userData.user.id}/${pack.id}.png`;
      const up = await supabase.storage.from("pack-previews").upload(path, blob, { upsert: true, contentType: "image/png" });
      if (up.error) { console.warn("thumb upload", up.error); return; }
      await supabase.from("marketing_packs").update({ preview_url: path }).eq("id", pack.id);
      qc.invalidateQueries({ queryKey: ["marketing-packs"] });
    } catch (e) { console.warn("thumb gen", e); }
  }, [pack, qrRow, selectedFormats, contentBase, globalSettings, formatCustomizations, layoutTemplate, qrDesign, qrData, brand, qc]);

  const doSave = useCallback(async (): Promise<boolean> => {
    if (!pack) return false;
    setSaveState("saving");
    setSaveError(null);
    const patch = {
      project_name: projectName.trim() || "Untitled pack",
      layout_template: layoutTemplate,
      headline: headline.trim() || null,
      support_text: supportText.trim() || null,
      cta_text: ctaText.trim() || null,
      footer_text: footerText.trim() || null,
      show_business_name: showBusinessName,
      show_logo: showLogo,
      show_stars: showStars,
      show_google_badge: showGoogleBadge,
      selected_formats: selectedFormats as unknown as never,
      global_settings: globalSettings as unknown as never,
      format_customizations: formatCustomizations as unknown as never,
      status,
    };
    const { error } = await supabase.from("marketing_packs").update(patch).eq("id", pack.id);
    if (error) {
      setSaveError(error.message);
      setSaveState("error");
      return false;
    }
    setSaveState("saved");
    setDirty(false);
    qc.invalidateQueries({ queryKey: ["marketing-pack", id] });
    qc.invalidateQueries({ queryKey: ["marketing-packs"] });
    setTimeout(() => setSaveState((s) => (s === "saved" ? "idle" : s)), 1500);
    void regenerateThumbnail();
    return true;
  }, [pack, projectName, layoutTemplate, headline, supportText, ctaText, footerText, showBusinessName, showLogo, showStars, showGoogleBadge, selectedFormats, globalSettings, formatCustomizations, status, qc, id, regenerateThumbnail]);

  // Trigger autosave when state changes (after initial load)
  useEffect(() => {
    if (!initialised.current) return;
    setDirty(true);
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => { doSave(); }, 1500);
    return () => { if (saveTimer.current) clearTimeout(saveTimer.current); };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projectName, layoutTemplate, headline, supportText, ctaText, footerText, showBusinessName, showLogo, showStars, showGoogleBadge, selectedFormats, globalSettings, formatCustomizations, status]);

  // Warn on unload if dirty
  useEffect(() => {
    function onBeforeUnload(e: BeforeUnloadEvent) {
      if (dirty) { e.preventDefault(); e.returnValue = ""; }
    }
    window.addEventListener("beforeunload", onBeforeUnload);
    return () => window.removeEventListener("beforeunload", onBeforeUnload);
  }, [dirty]);

  async function retrySave() { await doSave(); }

  async function duplicatePack() {
    if (!pack) return;
    const { data: userData } = await supabase.auth.getUser();
    if (!userData.user) return toast.error("Not signed in");
    const { data, error } = await supabase.from("marketing_packs").insert({
      owner_id: userData.user.id,
      business_id: pack.business_id,
      qr_code_id: pack.qr_code_id,
      project_name: `${projectName} (copy)`,
      pack_type: pack.pack_type,
      layout_template: layoutTemplate,
      headline, support_text: supportText, cta_text: ctaText, footer_text: footerText,
      show_business_name: showBusinessName, show_logo: showLogo, show_stars: showStars, show_google_badge: showGoogleBadge,
      selected_formats: selectedFormats as unknown as never,
      global_settings: globalSettings as unknown as never,
      format_customizations: formatCustomizations as unknown as never,
      status: "draft",
    } as never).select("id").single();
    if (error || !data) return toast.error(error?.message ?? "Duplicate failed");
    toast.success("Duplicated");
    navigate({ to: "/marketing-packs/$id", params: { id: data.id } });
  }

  async function archivePack() {
    if (!pack) return;
    const archive = status !== "archived";
    const { error } = await supabase.from("marketing_packs").update({
      status: archive ? "archived" : "draft",
      archived_at: archive ? new Date().toISOString() : null,
    }).eq("id", pack.id);
    if (error) return toast.error(error.message);
    setStatus(archive ? "archived" : "draft");
    toast.success(archive ? "Archived" : "Restored");
    qc.invalidateQueries({ queryKey: ["marketing-pack", id] });
  }

  async function markReadyToPrint() {
    // Guard: ensure required fields
    if (!headline.trim() || !ctaText.trim()) return toast.error("Headline and CTA are required");
    if (selectedFormats.length === 0) return toast.error("Add at least one format");
    // Run scan validation
    toast.info("Validating QR in every selected format…");
    const results = await validateAllQrs();
    const failed = results.filter((r) => !r.pass);
    if (failed.length) {
      return toast.error(`${failed.length} format(s) failed QR validation — fix warnings first`);
    }
    setStatus("ready");
    toast.success("Marked ready to print");
  }

  async function validateAllQrs(): Promise<{ formatId: string; pass: boolean; reason?: string }[]> {
    const out: { formatId: string; pass: boolean; reason?: string }[] = [];
    for (const f of selected) {
      try {
        const svg = await renderFormatSvg(f, layoutTemplate, resolveContent(f), qrDesign, qrData, resolveContent(f).logoUrl, brand, { showBoundaries: false, includeBleed: false });
        const target = 600;
        const blob = await svgToPng(svg, target, target);
        const bitmap = await createImageBitmap(blob);
        const canvas = document.createElement("canvas");
        canvas.width = bitmap.width;
        canvas.height = bitmap.height;
        const ctx = canvas.getContext("2d")!;
        ctx.drawImage(bitmap, 0, 0);
        const data = ctx.getImageData(0, 0, canvas.width, canvas.height);
        const code = jsQR(data.data, data.width, data.height);
        out.push({ formatId: f.id, pass: !!code, reason: code ? undefined : "Could not decode QR" });
      } catch (e) {
        out.push({ formatId: f.id, pass: false, reason: (e as Error).message });
      }
    }
    return out;
  }

  async function exportZip(kind: "all" | "print" | "digital") {
    if (!selected.length) return toast.error("Select at least one format");
    const list = kind === "print" ? selected.filter((f) => f.medium === "print")
               : kind === "digital" ? selected.filter((f) => f.medium === "digital")
               : selected;
    if (!list.length) return toast.error("No formats match that group");
    setExporting(`zip-${kind}`);
    try {
      await downloadPackZip(
        projectName || "marketing-pack", list, layoutTemplate, resolveContent, qrDesign, qrData, rawLogoUrl, brand,
        { packType: pack?.pack_type, business: biz?.name ?? null, qrCode: qrRow?.short_code ?? null },
      );
      toast.success("ZIP downloaded");
      // Mark exported
      if (status === "draft" || status === "ready") {
        setStatus("exported");
      }
    } catch (e) {
      toast.error(`Export failed: ${(e as Error).message}`);
    } finally { setExporting(null); }
  }

  if (isLoading) return <div className="h-40 rounded-3xl bg-muted shimmer"/>;
  if (error) return (
    <div className="rounded-3xl border border-destructive/40 bg-destructive/10 p-6 text-sm text-destructive">
      Failed to load pack. <Button size="sm" variant="ghost" onClick={() => qc.invalidateQueries({ queryKey: ["marketing-pack", id] })}>Retry</Button>
    </div>
  );
  if (!pack) return (
    <div className="rounded-3xl border border-border/70 p-6 text-center text-sm text-muted-foreground">
      Pack not found. <Link to="/marketing-packs" className="text-primary underline">Back to packs</Link>
    </div>
  );

  const statusM = statusMeta(status);
  const packTypeLabel = packTypeById(pack.pack_type)?.label ?? "Custom";

  return (
    <div className="animate-fade-in-up space-y-6">
      <Link to="/marketing-packs" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft className="h-4 w-4"/> Back to packs
      </Link>

      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">{projectName || "Untitled pack"}</h1>
            <Badge variant={statusM.badge} className="rounded-full">{statusM.label}</Badge>
            <Badge variant="outline" className="rounded-full text-[10px]">{packTypeLabel}</Badge>
          </div>
          <p className="mt-1 text-sm text-muted-foreground">
            {biz?.name} · {qrRow?.label ?? qrRow?.short_code}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <SaveIndicator state={saveState} onRetry={retrySave} error={saveError}/>
          <Button variant="outline" size="sm" onClick={() => doSave()} className="rounded-full">
            <Save className="mr-1 h-4 w-4"/>Save
          </Button>
          <Button variant="outline" size="sm" onClick={duplicatePack} className="rounded-full">
            <Copy className="mr-1 h-4 w-4"/>Duplicate
          </Button>
          <Button variant="outline" size="sm" onClick={archivePack} className="rounded-full">
            <Archive className="mr-1 h-4 w-4"/>{status === "archived" ? "Restore" : "Archive"}
          </Button>
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button variant="outline" size="sm" className="rounded-full text-destructive hover:text-destructive">
                <Trash2 className="mr-1 h-4 w-4"/>Delete
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Delete this marketing pack?</AlertDialogTitle>
                <AlertDialogDescription>
                  This permanently removes the pack, its saved content and its preview thumbnail. This cannot be undone.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancel</AlertDialogCancel>
                <AlertDialogAction onClick={deletePack} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">Delete</AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </div>
      </div>

      <Tabs defaultValue="content">
        <TabsList className="rounded-full">
          <TabsTrigger value="content" className="rounded-full">Content</TabsTrigger>
          <TabsTrigger value="formats" className="rounded-full">Formats</TabsTrigger>
          <TabsTrigger value="design" className="rounded-full">Design</TabsTrigger>
          <TabsTrigger value="preview" className="rounded-full">Preview &amp; Export</TabsTrigger>
        </TabsList>

        <TabsContent value="content" className="mt-4">
          <Card className="rounded-3xl border-border/70 shadow-[var(--shadow-card)]">
            <CardContent className="grid gap-4 p-6 sm:grid-cols-2">
              <div className="space-y-1.5 sm:col-span-2">
                <Label>Project name</Label>
                <Input value={projectName} onChange={(e) => setProjectName(e.target.value)} className="rounded-xl" maxLength={80}/>
                <Hint value={projectName} recommended={40} max={80}/>
              </div>
              <div className="space-y-1.5 sm:col-span-2">
                <Label>Headline</Label>
                <Input value={headline} onChange={(e) => setHeadline(e.target.value)} className="rounded-xl" maxLength={60}/>
                <Hint value={headline} recommended={30} max={60}/>
              </div>
              <div className="space-y-1.5 sm:col-span-2">
                <Label>Supporting text</Label>
                <Textarea value={supportText} onChange={(e) => setSupportText(e.target.value)} rows={2} className="rounded-xl" maxLength={140}/>
                <Hint value={supportText} recommended={80} max={140}/>
              </div>
              <div className="space-y-1.5">
                <Label>CTA text</Label>
                <Input value={ctaText} onChange={(e) => setCtaText(e.target.value)} className="rounded-xl" maxLength={30}/>
                <Hint value={ctaText} recommended={18} max={30}/>
              </div>
              <div className="space-y-1.5">
                <Label>Footer text</Label>
                <Input value={footerText} onChange={(e) => setFooterText(e.target.value)} className="rounded-xl" maxLength={60} placeholder="Optional"/>
                <Hint value={footerText} recommended={40} max={60}/>
              </div>
              <div className="sm:col-span-2 grid gap-2 rounded-2xl bg-accent/30 p-4 sm:grid-cols-2">
                <ToggleRow label="Show business name" value={showBusinessName} onChange={setShowBusinessName}/>
                <ToggleRow label="Show logo" value={showLogo} onChange={setShowLogo}/>
                <ToggleRow label="Show five stars" value={showStars} onChange={setShowStars}/>
                <ToggleRow label="Show Google review badge" value={showGoogleBadge} onChange={setShowGoogleBadge}/>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="formats" className="mt-4">
          <FormatsTab
            selectedFormats={selectedFormats}
            setSelectedFormats={setSelectedFormats}
          />
        </TabsContent>

        <TabsContent value="design" className="mt-4">
          <DesignTab
            layoutTemplate={layoutTemplate}
            setLayoutTemplate={setLayoutTemplate}
            globalSettings={globalSettings}
            setGlobalSettings={setGlobalSettings}
            brand={brand}
          />
        </TabsContent>

        <TabsContent value="preview" className="mt-4">
          <Card className="rounded-3xl border-border/70 shadow-[var(--shadow-card)]">
            <CardContent className="space-y-5 p-6">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <h3 className="text-sm font-semibold">Preview &amp; export</h3>
                  <p className="mt-0.5 text-xs text-muted-foreground">Every selected format renders below. Export individually or as a ZIP.</p>
                </div>
                <div className="flex flex-wrap gap-2">
                  <Button size="sm" variant="outline" onClick={() => exportZip("print")} disabled={exporting !== null} className="rounded-full">
                    {exporting === "zip-print" ? <Loader2 className="mr-1 h-3 w-3 animate-spin"/> : <Package className="mr-1 h-3 w-3"/>}
                    Print ZIP
                  </Button>
                  <Button size="sm" variant="outline" onClick={() => exportZip("digital")} disabled={exporting !== null} className="rounded-full">
                    {exporting === "zip-digital" ? <Loader2 className="mr-1 h-3 w-3 animate-spin"/> : <Package className="mr-1 h-3 w-3"/>}
                    Digital ZIP
                  </Button>
                  <Button size="sm" onClick={() => exportZip("all")} disabled={exporting !== null} className="rounded-full">
                    {exporting === "zip-all" ? <Loader2 className="mr-1 h-3 w-3 animate-spin"/> : <Download className="mr-1 h-3 w-3"/>}
                    Full ZIP ({selected.length})
                  </Button>
                  <Button size="sm" variant={status === "ready" ? "default" : "outline"} onClick={markReadyToPrint} disabled={status === "ready"} className="rounded-full">
                    <CheckCircle2 className="mr-1 h-3 w-3"/>{status === "ready" ? "Ready" : "Mark ready to print"}
                  </Button>
                </div>
              </div>
              {selected.length === 0 && (
                <div className="rounded-2xl border border-dashed border-border/70 p-8 text-center text-xs text-muted-foreground">
                  Add formats in the Formats tab to see previews here.
                </div>
              )}
              <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                {selected.map((f) => {
                  const c = resolveContent(f);
                  return (
                    <FormatPreviewCard
                      key={f.id}
                      format={f}
                      layoutTemplate={layoutTemplate}
                      content={c}
                      qrDesign={qrDesign}
                      qrData={qrData}
                      logoUrl={c.logoUrl}
                      brand={brand}
                      exporting={exporting}
                      setExporting={setExporting}
                      override={formatCustomizations[f.id]}
                      onOverrideChange={(o) => setFormatCustomizations({ ...formatCustomizations, [f.id]: o })}
                      onOverrideClear={() => {
                        const next = { ...formatCustomizations };
                        delete next[f.id];
                        setFormatCustomizations(next);
                      }}
                    />
                  );
                })}
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}

function ToggleRow({ label, value, onChange }: { label: string; value: boolean; onChange: (v: boolean) => void }) {
  return (
    <label className="flex items-center gap-2 text-xs">
      <Checkbox checked={value} onCheckedChange={(v) => onChange(!!v)}/> {label}
    </label>
  );
}

function Hint({ value, recommended, max }: { value: string; recommended: number; max: number }) {
  const len = value.length;
  const over = len > max;
  const warn = len > recommended;
  return (
    <p className={`text-[10px] ${over ? "text-destructive" : warn ? "text-amber-500" : "text-muted-foreground"}`}>
      {len}/{max} · recommended ≤ {recommended}
    </p>
  );
}

function SaveIndicator({ state, onRetry, error }: { state: SaveState; onRetry: () => void; error: string | null }) {
  if (state === "saving") return <span className="inline-flex items-center gap-1 text-[11px] text-muted-foreground"><Loader2 className="h-3 w-3 animate-spin"/>Saving</span>;
  if (state === "saved") return <span className="inline-flex items-center gap-1 text-[11px] text-emerald-500"><CheckCircle2 className="h-3 w-3"/>Saved</span>;
  if (state === "error") return (
    <span className="inline-flex items-center gap-1 text-[11px] text-destructive">
      <AlertTriangle className="h-3 w-3"/>Save failed
      <button onClick={onRetry} className="underline">retry</button>
      {error && <span className="hidden md:inline text-muted-foreground">({error})</span>}
    </span>
  );
  return null;
}

function FormatsTab({ selectedFormats, setSelectedFormats }: {
  selectedFormats: string[];
  setSelectedFormats: (v: string[]) => void;
}) {
  const [shape, setShape] = useState<string>("all");
  const [category, setCategory] = useState<string>("all");
  const [medium, setMedium] = useState<string>("all");

  const filtered = useMemo(() => FORMATS.filter((f) => {
    if (shape !== "all" && f.shape !== shape) return false;
    if (category !== "all" && f.category !== category) return false;
    if (medium !== "all" && f.medium !== medium) return false;
    return true;
  }), [shape, category, medium]);

  function toggle(id: string) {
    if (selectedFormats.includes(id)) setSelectedFormats(selectedFormats.filter((s) => s !== id));
    else setSelectedFormats([...selectedFormats, id]);
  }
  function addPack(ids: string[]) { setSelectedFormats(Array.from(new Set([...selectedFormats, ...ids]))); }

  return (
    <Card className="rounded-3xl border-border/70 shadow-[var(--shadow-card)]">
      <CardContent className="space-y-4 p-6">
        <div className="rounded-2xl bg-accent/30 p-4">
          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Quick packs</p>
          <div className="mt-2 flex flex-wrap gap-2">
            {QUICK_PACKS.map((p) => (
              <Button key={p.id} size="sm" variant="outline" onClick={() => addPack(p.formatIds)} className="rounded-full">+ {p.name}</Button>
            ))}
          </div>
        </div>

        <div className="space-y-2 text-xs">
          <FilterRow label="Shape">
            <Chip active={shape === "all"} onClick={() => setShape("all")}>All</Chip>
            {SHAPE_FILTERS.map((s) => <Chip key={s} active={shape === s} onClick={() => setShape(s)}>{cap(s)}</Chip>)}
          </FilterRow>
          <FilterRow label="Category">
            <Chip active={category === "all"} onClick={() => setCategory("all")}>All</Chip>
            {CATEGORY_FILTERS.map((c) => <Chip key={c} active={category === c} onClick={() => setCategory(c)}>{cap(c)}</Chip>)}
          </FilterRow>
          <FilterRow label="Medium">
            <Chip active={medium === "all"} onClick={() => setMedium("all")}>All</Chip>
            <Chip active={medium === "print"} onClick={() => setMedium("print")}>Print</Chip>
            <Chip active={medium === "digital"} onClick={() => setMedium("digital")}>Digital</Chip>
          </FilterRow>
        </div>

        <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
          {filtered.map((f) => {
            const sa = safeArea(f);
            const unit = f.medium === "print" ? "mm" : "px";
            const checked = selectedFormats.includes(f.id);
            return (
              <label key={f.id} className={`flex cursor-pointer flex-col gap-2 rounded-2xl border p-4 text-xs transition-colors ${checked ? "border-primary bg-primary/5" : "border-border/70 bg-card hover:bg-accent/30"}`}>
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-sm font-semibold">{f.name}</p>
                    <p className="mt-0.5 text-[11px] text-muted-foreground">{f.width} × {f.height} {unit}</p>
                  </div>
                  <Checkbox checked={checked} onCheckedChange={() => toggle(f.id)}/>
                </div>
                <div className="flex flex-wrap gap-1">
                  <Badge variant="outline" className="rounded-full text-[10px]">{cap(f.shape)}</Badge>
                  <Badge variant="outline" className="rounded-full text-[10px]">{cap(f.category)}</Badge>
                  <Badge variant="outline" className="rounded-full text-[10px]">{f.medium === "print" ? "Print" : "Digital"}</Badge>
                </div>
                <div className="grid grid-cols-2 gap-x-2 text-[10px] text-muted-foreground">
                  <span>Bleed: {f.bleed} {unit}</span>
                  <span>Safe: {Math.round(sa.w)} × {Math.round(sa.h)} {unit}</span>
                  <span>Min QR: {f.minQrSize} {unit}</span>
                  <span className="truncate">{f.material}</span>
                </div>
              </label>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}

function DesignTab({ layoutTemplate, setLayoutTemplate, globalSettings, setGlobalSettings, brand }: {
  layoutTemplate: LayoutTemplate;
  setLayoutTemplate: (v: LayoutTemplate) => void;
  globalSettings: GlobalSettings;
  setGlobalSettings: (v: GlobalSettings) => void;
  brand: string;
}) {
  function patch(k: keyof GlobalSettings, v: unknown) {
    setGlobalSettings({ ...globalSettings, [k]: v });
  }
  return (
    <Card className="rounded-3xl border-border/70 shadow-[var(--shadow-card)]">
      <CardContent className="space-y-5 p-6">
        <div className="space-y-2">
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

        <div className="grid gap-3 sm:grid-cols-2">
          <ColorField label="Brand colour" value={globalSettings.brandColor ?? brand} onChange={(v) => patch("brandColor", v)}/>
          <ColorField label="Background" value={globalSettings.backgroundColor ?? "#ffffff"} onChange={(v) => patch("backgroundColor", v)}/>
          <ColorField label="Text colour" value={globalSettings.textColor ?? "#0b0d10"} onChange={(v) => patch("textColor", v)}/>
          <ColorField label="Accent" value={globalSettings.accentColor ?? brand} onChange={(v) => patch("accentColor", v)}/>
        </div>

        <div className="grid gap-3 sm:grid-cols-3">
          <div className="space-y-1.5">
            <Label className="text-xs">Font weight</Label>
            <select
              value={globalSettings.fontWeight ?? "500"}
              onChange={(e) => patch("fontWeight", e.target.value)}
              className="w-full rounded-xl border border-border bg-background px-3 py-2 text-sm"
            >
              <option value="400">Regular</option>
              <option value="500">Medium</option>
              <option value="600">Semibold</option>
              <option value="700">Bold</option>
            </select>
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Text alignment</Label>
            <select
              value={globalSettings.textAlign ?? "center"}
              onChange={(e) => patch("textAlign", e.target.value as GlobalSettings["textAlign"])}
              className="w-full rounded-xl border border-border bg-background px-3 py-2 text-sm"
            >
              <option value="left">Left</option>
              <option value="center">Center</option>
              <option value="right">Right</option>
            </select>
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">QR alignment</Label>
            <select
              value={globalSettings.qrAlign ?? "center"}
              onChange={(e) => patch("qrAlign", e.target.value as GlobalSettings["qrAlign"])}
              className="w-full rounded-xl border border-border bg-background px-3 py-2 text-sm"
            >
              <option value="left">Left</option>
              <option value="center">Center</option>
              <option value="right">Right</option>
            </select>
          </div>
        </div>
        <p className="text-[11px] text-muted-foreground">
          Layout template drives colours and composition. Extra global overrides apply progressively as templates gain support.
        </p>
      </CardContent>
    </Card>
  );
}

function ColorField({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  return (
    <div className="space-y-1.5">
      <Label className="text-xs">{label}</Label>
      <div className="flex items-center gap-2">
        <input type="color" value={value} onChange={(e) => onChange(e.target.value)} className="h-9 w-12 cursor-pointer rounded-lg border border-border bg-background"/>
        <Input value={value} onChange={(e) => onChange(e.target.value)} className="rounded-xl font-mono text-xs"/>
      </div>
    </div>
  );
}

function FilterRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      <span className="mr-1 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">{label}</span>
      {children}
    </div>
  );
}
function Chip({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button type="button" onClick={onClick} className={`rounded-full border px-3 py-1 text-xs transition-colors ${active ? "border-primary bg-primary text-primary-foreground" : "border-border bg-card hover:bg-accent"}`}>{children}</button>
  );
}
function cap(s: string) { return s.charAt(0).toUpperCase() + s.slice(1); }

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
  override: FormatOverride | undefined;
  onOverrideChange: (o: FormatOverride) => void;
  onOverrideClear: () => void;
}) {
  const { format, layoutTemplate, content, qrDesign, qrData, logoUrl, brand, exporting, setExporting, override, onOverrideChange, onOverrideClear } = props;
  const [svg, setSvg] = useState<string>("");
  const [err, setErr] = useState<string | null>(null);
  const [scanStatus, setScanStatus] = useState<"idle" | "checking" | "pass" | "fail">("idle");
  const [scanReason, setScanReason] = useState<string | null>(null);
  const [overrideOpen, setOverrideOpen] = useState(false);

  const renderKey = JSON.stringify(content);
  useEffect(() => {
    let cancelled = false;
    setErr(null);
    renderFormatSvg(format, layoutTemplate, content, qrDesign, qrData, logoUrl, brand, { showBoundaries: true, includeBleed: format.bleed > 0 })
      .then((s) => { if (!cancelled) setSvg(s); })
      .catch((e) => { if (!cancelled) setErr((e as Error).message); });
    return () => { cancelled = true; };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [format.id, layoutTemplate, renderKey, qrDesign, qrData, logoUrl, brand]);

  async function validate() {
    setScanStatus("checking"); setScanReason(null);
    try {
      const raw = await renderFormatSvg(format, layoutTemplate, content, qrDesign, qrData, logoUrl, brand, { showBoundaries: false, includeBleed: false });
      const blob = await svgToPng(raw, 600, 600);
      const bitmap = await createImageBitmap(blob);
      const canvas = document.createElement("canvas");
      canvas.width = bitmap.width; canvas.height = bitmap.height;
      const ctx = canvas.getContext("2d")!;
      ctx.drawImage(bitmap, 0, 0);
      const data = ctx.getImageData(0, 0, canvas.width, canvas.height);
      const code = jsQR(data.data, data.width, data.height);
      if (code) setScanStatus("pass");
      else { setScanStatus("fail"); setScanReason("QR could not be decoded"); }
    } catch (e) { setScanStatus("fail"); setScanReason((e as Error).message); }
  }

  async function run(kind: "png" | "svg" | "pdf") {
    const key = `${format.id}-${kind}`;
    setExporting(key);
    try {
      if (kind === "png") await downloadFormatPng(format, layoutTemplate, content, qrDesign, qrData, logoUrl, brand);
      else if (kind === "svg") await downloadFormatSvg(format, layoutTemplate, content, qrDesign, qrData, logoUrl, brand);
      else await downloadFormatPdf(format, layoutTemplate, content, qrDesign, qrData, logoUrl, brand);
      toast.success(`${kind.toUpperCase()} downloaded`);
    } catch (e) { toast.error(`Export failed: ${(e as Error).message}`); }
    finally { setExporting(null); }
  }

  const hasOverride = !!override && Object.keys(override).length > 0;

  return (
    <div className="rounded-2xl border border-border/70 bg-card p-3">
      <div className="mb-2 flex items-center justify-between gap-2">
        <p className="truncate text-xs font-semibold">{format.name}</p>
        <div className="flex items-center gap-1">
          {hasOverride && <Badge variant="secondary" className="rounded-full text-[9px]">Custom</Badge>}
          {scanStatus === "pass" && <Badge variant="default" className="rounded-full text-[10px]"><CheckCircle2 className="mr-1 h-2.5 w-2.5"/>Scannable</Badge>}
          {scanStatus === "fail" && <Badge variant="destructive" className="rounded-full text-[10px]" title={scanReason ?? ""}><AlertTriangle className="mr-1 h-2.5 w-2.5"/>QR issue</Badge>}
        </div>
      </div>
      <div className="aspect-[3/4] w-full overflow-hidden rounded-xl bg-white/5 [&_svg]:h-full [&_svg]:w-full" dangerouslySetInnerHTML={{ __html: svg || "" }}/>
      {err && (
        <div className="mt-2 flex items-center justify-between gap-2 rounded-lg border border-destructive/40 bg-destructive/10 p-2">
          <p className="text-[10px] text-destructive">{err}</p>
          <Button size="sm" variant="ghost" onClick={() => setErr(null)} className="h-6 rounded-full text-[10px]"><RotateCw className="mr-1 h-3 w-3"/>Retry</Button>
        </div>
      )}
      <div className="mt-2 grid grid-cols-5 gap-1.5">
        <Button size="sm" variant="outline" onClick={() => run("png")} disabled={exporting !== null} className="rounded-full text-[10px]" title="Download PNG">
          {exporting === `${format.id}-png` ? <Loader2 className="h-3 w-3 animate-spin"/> : <ImageIcon className="h-3 w-3"/>}
        </Button>
        <Button size="sm" variant="outline" onClick={() => run("svg")} disabled={exporting !== null} className="rounded-full text-[10px]" title="Download SVG">
          {exporting === `${format.id}-svg` ? <Loader2 className="h-3 w-3 animate-spin"/> : <Download className="h-3 w-3"/>}
        </Button>
        <Button size="sm" variant="outline" onClick={() => run("pdf")} disabled={exporting !== null || format.medium === "digital"} className="rounded-full text-[10px]" title={format.medium === "digital" ? "PDF for print formats only" : "Download PDF"}>
          {exporting === `${format.id}-pdf` ? <Loader2 className="h-3 w-3 animate-spin"/> : <FileText className="h-3 w-3"/>}
        </Button>
        <Button size="sm" variant="outline" onClick={validate} disabled={scanStatus === "checking"} className="rounded-full text-[10px]" title="Validate QR">
          {scanStatus === "checking" ? <Loader2 className="h-3 w-3 animate-spin"/> : <CheckCircle2 className="h-3 w-3"/>}
        </Button>
        <Button size="sm" variant={hasOverride ? "default" : "outline"} onClick={() => setOverrideOpen(true)} className="rounded-full text-[10px]" title="Customize this format">
          <Settings2 className="h-3 w-3"/>
        </Button>
      </div>
      <OverrideDialog
        open={overrideOpen}
        onOpenChange={setOverrideOpen}
        format={format}
        override={override}
        onSave={(o) => { onOverrideChange(o); setOverrideOpen(false); }}
        onClear={() => { onOverrideClear(); setOverrideOpen(false); }}
      />
    </div>
  );
}

function OverrideDialog({ open, onOpenChange, format, override, onSave, onClear }: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  format: BusinessFormat;
  override: FormatOverride | undefined;
  onSave: (o: FormatOverride) => void;
  onClear: () => void;
}) {
  const [draft, setDraft] = useState<FormatOverride>({});
  useEffect(() => { if (open) setDraft(override ?? {}); }, [open, override]);

  function patch<K extends keyof FormatOverride>(k: K, v: FormatOverride[K]) {
    setDraft((d) => ({ ...d, [k]: v }));
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Customize {format.name}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label className="text-xs">Headline override</Label>
            <Input value={draft.headline ?? ""} onChange={(e) => patch("headline", e.target.value || undefined)} className="rounded-xl" placeholder="Use pack default"/>
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Support text override</Label>
            <Textarea value={draft.supportText ?? ""} onChange={(e) => patch("supportText", e.target.value || undefined)} rows={2} className="rounded-xl" placeholder="Use pack default"/>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label className="text-xs">CTA text override</Label>
              <Input value={draft.ctaText ?? ""} onChange={(e) => patch("ctaText", e.target.value || undefined)} className="rounded-xl" placeholder="Use pack default"/>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">QR scale (0.30–0.70)</Label>
              <div className="flex items-center gap-2">
                <Slider value={[Math.round((draft.qrScale ?? 0.45) * 100)]} min={30} max={70} step={1} onValueChange={([v]) => patch("qrScale", v / 100)} className="flex-1"/>
                <span className="w-10 text-right font-mono text-xs">{Math.round((draft.qrScale ?? 0.45) * 100)}%</span>
              </div>
            </div>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label className="text-xs">Background override</Label>
              <div className="flex items-center gap-2">
                <input type="color" value={draft.backgroundColor ?? "#ffffff"} onChange={(e) => patch("backgroundColor", e.target.value)} className="h-9 w-12 cursor-pointer rounded-lg border border-border"/>
                <Input value={draft.backgroundColor ?? ""} onChange={(e) => patch("backgroundColor", e.target.value || undefined)} placeholder="Use pack" className="rounded-xl font-mono text-xs"/>
              </div>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Accent override</Label>
              <div className="flex items-center gap-2">
                <input type="color" value={draft.accentColor ?? "#0071e3"} onChange={(e) => patch("accentColor", e.target.value)} className="h-9 w-12 cursor-pointer rounded-lg border border-border"/>
                <Input value={draft.accentColor ?? ""} onChange={(e) => patch("accentColor", e.target.value || undefined)} placeholder="Use pack" className="rounded-xl font-mono text-xs"/>
              </div>
            </div>
          </div>
          <div className="grid gap-2 rounded-xl bg-accent/30 p-3 sm:grid-cols-2">
            <label className="flex items-center gap-2 text-xs">
              <Checkbox checked={draft.logoVisible !== false} onCheckedChange={(v) => patch("logoVisible", v === true)}/> Show logo
            </label>
            <label className="flex items-center gap-2 text-xs">
              <Checkbox checked={draft.hideStars === true} onCheckedChange={(v) => patch("hideStars", v === true)}/> Hide stars
            </label>
          </div>
        </div>
        <DialogFooter className="gap-2 sm:justify-between">
          <Button variant="ghost" onClick={onClear} className="rounded-full text-destructive">
            <Trash2 className="mr-1 h-3 w-3"/>Clear override
          </Button>
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => onOpenChange(false)} className="rounded-full">Cancel</Button>
            <Button onClick={() => onSave(draft)} className="rounded-full">Save override</Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

