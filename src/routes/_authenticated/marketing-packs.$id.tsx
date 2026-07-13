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
  ImagePlus, X,
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
  downloadFormatPngTransparent, downloadFormatSvgWithDieline, downloadDielineSvg,
} from "@/lib/format-export";
import { mergeDesign, type QrDesign } from "@/lib/qr-design";
import {
  runFormatValidations, decodeQrValidation, readyToPrint,
  type ValidationResult, type ValidationLevel,
} from "@/lib/format-validation";
import {
  statusMeta, packTypeById, buildFormatContent, similarFormats,
  FONT_OPTIONS, STAR_STYLES, BORDER_STYLES,
  type GlobalSettings, type FormatCustomizations, type FormatOverride, type PackStatus, type ContentBase,
} from "@/lib/marketing-packs";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Slider } from "@/components/ui/slider";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import jsQR from "jsqr";

const PREVIEW_BUCKET = "marketing-pack-previews";

export const Route = createFileRoute("/_authenticated/marketing-packs/$id")({
  component: MarketingPackEditor,
});

type SaveState = "idle" | "saving" | "saved" | "error";
type ThumbState = "idle" | "generating" | "saved" | "failed" | "unavailable";

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

  const [thumbState, setThumbState] = useState<ThumbState>("idle");
  const [thumbError, setThumbError] = useState<string | null>(null);

  // Print-production preview overlays
  const [showTrim, setShowTrim] = useState(true);
  const [showSafe, setShowSafe] = useState(true);
  const [showBleedGuide, setShowBleedGuide] = useState(true);
  const [showDieline, setShowDieline] = useState(false);

  // Validation engine state
  const [validations, setValidations] = useState<ValidationResult[]>([]);
  const [validating, setValidating] = useState(false);
  const [warningsAck, setWarningsAck] = useState<Record<string, boolean>>({});
  const [activeTab, setActiveTab] = useState<string>("content");


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
  const qrRow = pack?.qr_codes as { id: string; short_code: string; label: string | null; destination_type: string; destination_url: string | null; design: unknown; logo_url: string | null; fg_color: string | null; bg_color: string | null } | null;

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

  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const thumbTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const generatePreviewDataUrl = useCallback(async (): Promise<{ dataUrl: string; blob: Blob } | null> => {
    if (selectedFormats.length === 0) return null;
    const first = FORMATS.find((f) => f.id === selectedFormats[0]);
    if (!first) return null;
    const c = buildFormatContent(contentBase, globalSettings, formatCustomizations[first.id]);
    const svg = await renderFormatSvg(first, layoutTemplate, c, qrDesign, qrData, c.logoUrl, brand, { includeBleed: false, showBoundaries: false });
    const blob = await svgToPng(svg, 480, 480);
    const dataUrl = await blobToDataUrl(blob);
    return { dataUrl, blob };
  }, [selectedFormats, contentBase, globalSettings, formatCustomizations, layoutTemplate, qrDesign, qrData, brand]);

  const regenerateThumbnail = useCallback(async (opts: { debounce?: boolean } = {}): Promise<boolean> => {
    if (!pack || !qrRow || selectedFormats.length === 0) return false;
    if (opts.debounce) {
      if (thumbTimer.current) clearTimeout(thumbTimer.current);
      await new Promise<void>((resolve) => { thumbTimer.current = setTimeout(resolve, 400); });
    }
    setThumbState("generating");
    setThumbError(null);
    try {
      const gen = await generatePreviewDataUrl();
      if (!gen) { setThumbState("idle"); return false; }
      const { data: userData } = await supabase.auth.getUser();
      if (!userData.user) throw new Error("Not signed in");
      const path = `${userData.user.id}/${pack.id}.png`;
      const up = await supabase.storage.from(PREVIEW_BUCKET).upload(path, gen.blob, { upsert: true, contentType: "image/png" });
      if (up.error) {
        const msg = up.error.message || "Upload failed";
        setThumbError(msg);
        setThumbState(/bucket|not found|policy|denied/i.test(msg) ? "unavailable" : "failed");
        return false;
      }
      await supabase.from("marketing_packs").update({ preview_url: path }).eq("id", pack.id);
      setThumbState("saved");
      qc.invalidateQueries({ queryKey: ["marketing-packs"] });
      return true;
    } catch (e) {
      const msg = (e as Error).message || "Failed";
      setThumbError(msg);
      setThumbState("failed");
      return false;
    }
  }, [pack, qrRow, selectedFormats, generatePreviewDataUrl, qc]);

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
    void regenerateThumbnail({ debounce: true });
    return true;
  }, [pack, projectName, layoutTemplate, headline, supportText, ctaText, footerText, showBusinessName, showLogo, showStars, showGoogleBadge, selectedFormats, globalSettings, formatCustomizations, status, qc, id, regenerateThumbnail]);

  useEffect(() => {
    if (!initialised.current) return;
    setDirty(true);
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => { doSave(); }, 1500);
    return () => { if (saveTimer.current) clearTimeout(saveTimer.current); };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projectName, layoutTemplate, headline, supportText, ctaText, footerText, showBusinessName, showLogo, showStars, showGoogleBadge, selectedFormats, globalSettings, formatCustomizations, status]);

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

  async function deletePack() {
    if (!pack) return;
    const { data: userData } = await supabase.auth.getUser();
    if (userData.user) {
      await supabase.storage.from(PREVIEW_BUCKET).remove([`${userData.user.id}/${pack.id}.png`]).catch(() => undefined);
    }
    const { error } = await supabase.from("marketing_packs").delete().eq("id", pack.id);
    if (error) return toast.error(error.message);
    toast.success("Pack deleted");
    qc.invalidateQueries({ queryKey: ["marketing-packs"] });
    navigate({ to: "/marketing-packs" });
  }

  const runValidation = useCallback(async (opts: { decodeQr?: boolean } = { decodeQr: true }): Promise<ValidationResult[]> => {
    setValidating(true);
    try {
      const out: ValidationResult[] = [];
      if (selected.length === 0) {
        out.push({ id: "pack-formats", formatId: null, category: "content", level: "error", title: "No formats selected", message: "Add at least one format.", suggestedFix: "Pick formats in the Formats tab." });
      }
      for (const f of selected) {
        const c = resolveContent(f);
        out.push(...runFormatValidations({
          format: f, content: c, qrDesign, qrData,
          destinationUrl: qrRow?.destination_url ?? null,
          destinationType: qrRow?.destination_type ?? null,
          reviewUrl: biz?.google_review_url ?? null,
        }));
        if (opts.decodeQr) {
          out.push(await decodeQrValidation(f, c, qrDesign, qrData, c.logoUrl, brand, layoutTemplate));
        }
      }

      setValidations(out);
      return out;
    } finally { setValidating(false); }
  }, [selected, resolveContent, qrData, qrRow, biz, qrDesign, brand, layoutTemplate]);

  async function markReadyToPrint() {
    if (!headline.trim() || !ctaText.trim()) return toast.error("Headline and CTA are required");
    const results = await runValidation({ decodeQr: true });
    const { ready, blocking, warnings } = readyToPrint(results);
    if (!ready) return toast.error(`${blocking} blocking issue(s) — resolve them first`);
    if (warnings > 0 && !warningsAck) return toast.error(`${warnings} warning(s) — acknowledge them below to continue`);
    setStatus("ready");
    toast.success("Marked ready to print");
  }

  // Legacy per-format QR check kept for export-time validation entries
  async function validateAllQrs(): Promise<{ formatId: string; pass: boolean; reason?: string }[]> {
    const out: { formatId: string; pass: boolean; reason?: string }[] = [];
    for (const f of selected) {
      const c = resolveContent(f);
      const r = await decodeQrValidation(f, c, qrDesign, qrData, c.logoUrl, brand, layoutTemplate);
      out.push({ formatId: f.id, pass: r.level === "pass", reason: r.level === "pass" ? undefined : r.message });
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
      const validations = await validateAllQrs();
      const preview = await generatePreviewDataUrl().catch(() => null);
      await downloadPackZip(
        projectName || "marketing-pack", list, layoutTemplate, resolveContent, qrDesign, qrData, rawLogoUrl, brand,
        {
          projectId: pack?.id ?? null,
          packType: pack?.pack_type,
          status,
          businessId: biz?.id ?? null,
          business: biz?.name ?? null,
          qrId: qrRow?.id ?? null,
          qrCode: qrRow?.short_code ?? null,
          qrLabel: qrRow?.label ?? null,
          qrDestinationType: qrRow?.destination_type ?? null,
          previewDataUrl: preview?.dataUrl ?? null,
          validations,
        },
      );
      toast.success("ZIP downloaded");
      // Persist exported status immediately
      const nextStatus: PackStatus = status === "archived" ? "archived" : "exported";
      if (nextStatus !== status && pack) {
        const { error: uerr } = await supabase.from("marketing_packs").update({
          status: nextStatus, updated_at: new Date().toISOString(),
        }).eq("id", pack.id);
        if (!uerr) {
          setStatus(nextStatus);
          qc.invalidateQueries({ queryKey: ["marketing-pack", id] });
          qc.invalidateQueries({ queryKey: ["marketing-packs"] });
        }
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
            <ThumbBadge state={thumbState} error={thumbError} onRetry={() => regenerateThumbnail()}/>
          </div>
          <p className="mt-1 text-sm text-muted-foreground">
            {biz?.name} · {qrRow?.label ?? qrRow?.short_code}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <SaveIndicator state={saveState} onRetry={retrySave} error={saveError}/>
          <Button variant="outline" size="sm" onClick={() => regenerateThumbnail()} disabled={thumbState === "generating"} className="rounded-full">
            {thumbState === "generating" ? <Loader2 className="mr-1 h-4 w-4 animate-spin"/> : <RotateCw className="mr-1 h-4 w-4"/>}Regenerate preview
          </Button>
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

      {thumbState === "failed" && thumbError && (
        <div className="flex flex-wrap items-center gap-2 rounded-2xl border border-destructive/40 bg-destructive/10 px-4 py-2 text-xs text-destructive">
          <AlertTriangle className="h-4 w-4"/>Preview upload failed: {thumbError}
          <Button size="sm" variant="ghost" onClick={() => regenerateThumbnail()} className="ml-auto rounded-full text-xs">
            <RotateCw className="mr-1 h-3 w-3"/>Retry preview
          </Button>
        </div>
      )}
      {thumbState === "unavailable" && (
        <div className="flex flex-wrap items-center gap-2 rounded-2xl border border-amber-500/40 bg-amber-500/10 px-4 py-2 text-xs text-amber-500">
          <AlertTriangle className="h-4 w-4"/>Preview storage unavailable. Exports still work — retry once storage is restored.
          <Button size="sm" variant="ghost" onClick={() => regenerateThumbnail()} className="ml-auto rounded-full text-xs">
            <RotateCw className="mr-1 h-3 w-3"/>Retry
          </Button>
        </div>
      )}

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
          <FormatsTab selectedFormats={selectedFormats} setSelectedFormats={setSelectedFormats}/>
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
                    {exporting === "zip-print" ? <Loader2 className="mr-1 h-3 w-3 animate-spin"/> : <Package className="mr-1 h-3 w-3"/>}Print ZIP
                  </Button>
                  <Button size="sm" variant="outline" onClick={() => exportZip("digital")} disabled={exporting !== null} className="rounded-full">
                    {exporting === "zip-digital" ? <Loader2 className="mr-1 h-3 w-3 animate-spin"/> : <Package className="mr-1 h-3 w-3"/>}Digital ZIP
                  </Button>
                  <Button size="sm" onClick={() => exportZip("all")} disabled={exporting !== null} className="rounded-full">
                    {exporting === "zip-all" ? <Loader2 className="mr-1 h-3 w-3 animate-spin"/> : <Download className="mr-1 h-3 w-3"/>}Full ZIP ({selected.length})
                  </Button>
                  <Button size="sm" variant={status === "ready" ? "default" : "outline"} onClick={markReadyToPrint} disabled={status === "ready"} className="rounded-full">
                    <CheckCircle2 className="mr-1 h-3 w-3"/>{status === "ready" ? "Ready" : "Mark ready to print"}
                  </Button>
                </div>
              </div>
              {/* Preview production overlays */}
              <div className="flex flex-wrap items-center gap-3 rounded-2xl bg-accent/30 px-4 py-2 text-xs">
                <span className="font-semibold uppercase tracking-wide text-muted-foreground">Guides</span>
                <label className="inline-flex items-center gap-1"><Checkbox checked={showTrim} onCheckedChange={(v) => setShowTrim(!!v)}/> Trim</label>
                <label className="inline-flex items-center gap-1"><Checkbox checked={showSafe} onCheckedChange={(v) => setShowSafe(!!v)}/> Safe area</label>
                <label className="inline-flex items-center gap-1"><Checkbox checked={showBleedGuide} onCheckedChange={(v) => setShowBleedGuide(!!v)}/> Bleed</label>
                <label className="inline-flex items-center gap-1"><Checkbox checked={showDieline} onCheckedChange={(v) => setShowDieline(!!v)}/> Dieline (circular)</label>
              </div>

              {/* Validation panel */}
              <ValidationPanel
                results={validations}
                validating={validating}
                onRun={() => runValidation({ decodeQr: true })}
                warningsAck={warningsAck}
                onAckChange={setWarningsAck}
              />

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
                      globalSettings={globalSettings}
                      selectedFormats={selectedFormats}
                      overlays={{ showTrim, showSafe, showBleedGuide, showDieline }}
                      onOverrideChange={(o) => setFormatCustomizations({ ...formatCustomizations, [f.id]: o })}
                      onOverrideClear={() => {
                        const next = { ...formatCustomizations };
                        delete next[f.id];
                        setFormatCustomizations(next);
                      }}
                      onCopyToFormats={(ids, o) => {
                        const next = { ...formatCustomizations };
                        ids.forEach((fid) => { next[fid] = { ...next[fid], ...o }; });
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

function ThumbBadge({ state, error, onRetry }: { state: ThumbState; error: string | null; onRetry: () => void }) {
  if (state === "idle") return null;
  if (state === "generating") return <Badge variant="outline" className="rounded-full text-[10px]"><Loader2 className="mr-1 h-2.5 w-2.5 animate-spin"/>Generating preview</Badge>;
  if (state === "saved") return <Badge variant="secondary" className="rounded-full text-[10px]"><CheckCircle2 className="mr-1 h-2.5 w-2.5"/>Preview saved</Badge>;
  if (state === "unavailable") return <Badge variant="outline" className="rounded-full border-amber-500/50 text-[10px] text-amber-500" title={error ?? ""} onClick={onRetry} role="button"><AlertTriangle className="mr-1 h-2.5 w-2.5"/>Storage unavailable</Badge>;
  return <Badge variant="destructive" className="rounded-full text-[10px]" title={error ?? ""} onClick={onRetry} role="button"><AlertTriangle className="mr-1 h-2.5 w-2.5"/>Preview failed</Badge>;
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
  function patch<K extends keyof GlobalSettings>(k: K, v: GlobalSettings[K]) {
    setGlobalSettings({ ...globalSettings, [k]: v });
  }

  async function onBackgroundFile(file: File | null) {
    if (!file) { patch("backgroundImage", null); return; }
    if (file.size > 4 * 1024 * 1024) return toast.error("Image too large (max 4 MB)");
    const dataUrl = await fileToDataUrl(file);
    patch("backgroundImage", dataUrl);
  }

  return (
    <Card className="rounded-3xl border-border/70 shadow-[var(--shadow-card)]">
      <CardContent className="space-y-6 p-6">
        <div className="space-y-2">
          <Label className="text-xs uppercase tracking-wide text-muted-foreground">Layout template</Label>
          <div className="flex flex-wrap gap-1.5">
            {LAYOUT_TEMPLATES.map((t) => (
              <button key={t.id} type="button" onClick={() => setLayoutTemplate(t.id)} title={t.description}
                className={`rounded-full border px-3 py-1 text-xs transition-colors ${layoutTemplate === t.id ? "border-primary bg-primary text-primary-foreground" : "border-border bg-card hover:bg-accent"}`}>
                {t.label}
              </button>
            ))}
          </div>
        </div>

        <SectionHeading>Colours</SectionHeading>
        <div className="grid gap-3 sm:grid-cols-2">
          <ColorField label="Brand colour" value={globalSettings.brandColor ?? brand} onChange={(v) => patch("brandColor", v)}/>
          <ColorField label="Background" value={globalSettings.backgroundColor ?? "#ffffff"} onChange={(v) => patch("backgroundColor", v)}/>
          <ColorField label="Text colour" value={globalSettings.textColor ?? "#0b0d10"} onChange={(v) => patch("textColor", v)}/>
          <ColorField label="Accent" value={globalSettings.accentColor ?? brand} onChange={(v) => patch("accentColor", v)}/>
        </div>

        <SectionHeading>Typography</SectionHeading>
        <div className="grid gap-3 sm:grid-cols-3">
          <SelectField label="Font family" value={globalSettings.fontFamily ?? "inter"} onChange={(v) => patch("fontFamily", v)}
            options={FONT_OPTIONS.map((f) => ({ value: f.id, label: f.label }))}/>
          <SelectField label="Font weight" value={globalSettings.fontWeight ?? "600"} onChange={(v) => patch("fontWeight", v)}
            options={[{ value: "400", label: "Regular" }, { value: "500", label: "Medium" }, { value: "600", label: "Semibold" }, { value: "700", label: "Bold" }]}/>
          <SelectField label="Text alignment" value={globalSettings.textAlign ?? "center"} onChange={(v) => patch("textAlign", v as GlobalSettings["textAlign"])}
            options={[{ value: "left", label: "Left" }, { value: "center", label: "Center" }, { value: "right", label: "Right" }]}/>
        </div>

        <SectionHeading>Layout &amp; shapes</SectionHeading>
        <div className="grid gap-3 sm:grid-cols-3">
          <SelectField label="QR alignment" value={globalSettings.qrAlign ?? "center"} onChange={(v) => patch("qrAlign", v as GlobalSettings["qrAlign"])}
            options={[{ value: "left", label: "Left" }, { value: "center", label: "Center" }, { value: "right", label: "Right" }]}/>
          <SelectField label="Border style" value={globalSettings.borderStyle ?? "none"} onChange={(v) => patch("borderStyle", v as GlobalSettings["borderStyle"])}
            options={BORDER_STYLES.map((b) => ({ value: b.id, label: b.label }))}/>
          <SelectField label="Star style" value={globalSettings.starStyle ?? "solid"} onChange={(v) => patch("starStyle", v as GlobalSettings["starStyle"])}
            options={STAR_STYLES.map((s) => ({ value: s.id, label: s.label }))}/>
          <SliderField label={`Logo size — ${Math.round((globalSettings.logoSize ?? 0.18) * 100)}%`} value={Math.round((globalSettings.logoSize ?? 0.18) * 100)} min={8} max={35} onChange={(v) => patch("logoSize", v / 100)}/>
          <SliderField label={`Corner radius — ${globalSettings.cornerRadius ?? 0}`} value={globalSettings.cornerRadius ?? 0} min={0} max={20} onChange={(v) => patch("cornerRadius", v)}/>
        </div>

        <SectionHeading>Background image</SectionHeading>
        <div className="grid gap-3 rounded-2xl border border-border/60 p-4 sm:grid-cols-[auto_1fr]">
          <div className="flex h-24 w-24 items-center justify-center overflow-hidden rounded-xl bg-accent/40">
            {globalSettings.backgroundImage
              ? <img src={globalSettings.backgroundImage} alt="" className="h-full w-full object-cover"/>
              : <ImagePlus className="h-6 w-6 text-muted-foreground"/>}
          </div>
          <div className="space-y-2">
            <div className="flex flex-wrap gap-2">
              <label className="inline-flex cursor-pointer items-center gap-1 rounded-full border border-border bg-card px-3 py-1 text-xs hover:bg-accent">
                <ImagePlus className="h-3 w-3"/>Upload image
                <input type="file" accept="image/*" className="hidden" onChange={(e) => onBackgroundFile(e.target.files?.[0] ?? null)}/>
              </label>
              {globalSettings.backgroundImage && (
                <Button size="sm" variant="ghost" onClick={() => patch("backgroundImage", null)} className="rounded-full text-xs text-destructive">
                  <X className="mr-1 h-3 w-3"/>Remove
                </Button>
              )}
            </div>
            <SliderField label={`Opacity — ${Math.round((globalSettings.backgroundImageOpacity ?? 1) * 100)}%`} value={Math.round((globalSettings.backgroundImageOpacity ?? 1) * 100)} min={10} max={100} onChange={(v) => patch("backgroundImageOpacity", v / 100)}/>
            <SelectField label="Fit" value={globalSettings.backgroundImageFit ?? "cover"} onChange={(v) => patch("backgroundImageFit", v as GlobalSettings["backgroundImageFit"])}
              options={[{ value: "cover", label: "Cover" }, { value: "contain", label: "Contain" }]}/>
          </div>
        </div>

        <p className="text-[11px] text-muted-foreground">
          Global settings apply to every format. Per-format overrides in Preview &amp; Export take priority.
        </p>
      </CardContent>
    </Card>
  );
}

function SectionHeading({ children }: { children: React.ReactNode }) {
  return <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">{children}</p>;
}

function SelectField({ label, value, onChange, options }: { label: string; value: string; onChange: (v: string) => void; options: { value: string; label: string }[] }) {
  return (
    <div className="space-y-1.5">
      <Label className="text-xs">{label}</Label>
      <select value={value} onChange={(e) => onChange(e.target.value)} className="w-full rounded-xl border border-border bg-background px-3 py-2 text-sm">
        {options.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
      </select>
    </div>
  );
}

function SliderField({ label, value, min, max, onChange }: { label: string; value: number; min: number; max: number; onChange: (v: number) => void }) {
  return (
    <div className="space-y-1.5">
      <Label className="text-xs">{label}</Label>
      <Slider value={[value]} min={min} max={max} step={1} onValueChange={([v]) => onChange(v)}/>
    </div>
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

type PreviewOverlays = { showTrim: boolean; showSafe: boolean; showBleedGuide: boolean; showDieline: boolean };

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
  globalSettings: GlobalSettings;
  selectedFormats: string[];
  overlays: PreviewOverlays;
  onOverrideChange: (o: FormatOverride) => void;
  onOverrideClear: () => void;
  onCopyToFormats: (ids: string[], o: FormatOverride) => void;
}) {
  const { format, layoutTemplate, content, qrDesign, qrData, logoUrl, brand, exporting, setExporting, override, globalSettings, selectedFormats, overlays, onOverrideChange, onOverrideClear, onCopyToFormats } = props;
  const [svg, setSvg] = useState<string>("");
  const [err, setErr] = useState<string | null>(null);
  const [renderKey, setRenderKey] = useState(0);
  const [scanStatus, setScanStatus] = useState<"idle" | "checking" | "pass" | "fail">("idle");
  const [scanReason, setScanReason] = useState<string | null>(null);
  const [overrideOpen, setOverrideOpen] = useState(false);

  const isCircular = format.shape === "circular";
  const contentKey = JSON.stringify(content);
  const overlaysKey = JSON.stringify(overlays);
  useEffect(() => {
    let cancelled = false;
    setErr(null);
    renderFormatSvg(format, layoutTemplate, content, qrDesign, qrData, logoUrl, brand, {
      includeBleed: format.bleed > 0,
      showTrim: overlays.showTrim,
      showSafe: overlays.showSafe,
      showBleedGuide: overlays.showBleedGuide,
      showDieline: overlays.showDieline && isCircular,
    })
      .then((s) => { if (!cancelled) setSvg(s); })
      .catch((e) => { if (!cancelled) setErr((e as Error).message); });
    return () => { cancelled = true; };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [format.id, layoutTemplate, contentKey, qrDesign, qrData, logoUrl, brand, renderKey, overlaysKey]);

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

  async function run(kind: "png" | "svg" | "pdf" | "png-transparent" | "svg-dieline" | "dieline") {
    const key = `${format.id}-${kind}`;
    setExporting(key);
    try {
      if (kind === "png") await downloadFormatPng(format, layoutTemplate, content, qrDesign, qrData, logoUrl, brand);
      else if (kind === "svg") await downloadFormatSvg(format, layoutTemplate, content, qrDesign, qrData, logoUrl, brand);
      else if (kind === "pdf") await downloadFormatPdf(format, layoutTemplate, content, qrDesign, qrData, logoUrl, brand);
      else if (kind === "png-transparent") await downloadFormatPngTransparent(format, layoutTemplate, content, qrDesign, qrData, logoUrl, brand);
      else if (kind === "svg-dieline") await downloadFormatSvgWithDieline(format, layoutTemplate, content, qrDesign, qrData, logoUrl, brand);
      else await downloadDielineSvg(format);
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
          <Button size="sm" variant="ghost" onClick={() => { setErr(null); setRenderKey((k) => k + 1); }} className="h-6 rounded-full text-[10px]"><RotateCw className="mr-1 h-3 w-3"/>Retry render</Button>
        </div>
      )}
      <div className="mt-2 grid grid-cols-5 gap-1.5">
        <Button size="sm" variant="outline" onClick={() => run("png")} disabled={exporting !== null} className="rounded-full text-[10px]" title="Download PNG">
          {exporting === `${format.id}-png` ? <Loader2 className="h-3 w-3 animate-spin"/> : <ImageIcon className="h-3 w-3"/>}
        </Button>
        <Button size="sm" variant="outline" onClick={() => run("svg")} disabled={exporting !== null} className="rounded-full text-[10px]" title="Download SVG">
          {exporting === `${format.id}-svg` ? <Loader2 className="h-3 w-3 animate-spin"/> : <Download className="h-3 w-3"/>}
        </Button>
        <Button size="sm" variant="outline" onClick={() => run("pdf")} disabled={exporting !== null || format.medium === "digital"} className="rounded-full text-[10px]" title={format.medium === "digital" ? "PDF for print formats only" : "Download PDF (circular formats include vector CutContour dieline)"}>
          {exporting === `${format.id}-pdf` ? <Loader2 className="h-3 w-3 animate-spin"/> : <FileText className="h-3 w-3"/>}
        </Button>
        <Button size="sm" variant="outline" onClick={validate} disabled={scanStatus === "checking"} className="rounded-full text-[10px]" title="Validate QR">
          {scanStatus === "checking" ? <Loader2 className="h-3 w-3 animate-spin"/> : <CheckCircle2 className="h-3 w-3"/>}
        </Button>
        <Button size="sm" variant={hasOverride ? "default" : "outline"} onClick={() => setOverrideOpen(true)} className="rounded-full text-[10px]" title="Customise this format">
          <Settings2 className="h-3 w-3"/>
        </Button>
      </div>
      {isCircular && (
        <div className="mt-1.5 grid grid-cols-3 gap-1.5">
          <Button size="sm" variant="outline" onClick={() => run("png-transparent")} disabled={exporting !== null} className="rounded-full text-[9px]" title="Transparent-background PNG (outside trim = transparent)">
            {exporting === `${format.id}-png-transparent` ? <Loader2 className="h-3 w-3 animate-spin"/> : "PNG·transparent"}
          </Button>
          <Button size="sm" variant="outline" onClick={() => run("svg-dieline")} disabled={exporting !== null} className="rounded-full text-[9px]" title="SVG with embedded CutContour dieline layer">
            {exporting === `${format.id}-svg-dieline` ? <Loader2 className="h-3 w-3 animate-spin"/> : "SVG·+dieline"}
          </Button>
          <Button size="sm" variant="outline" onClick={() => run("dieline")} disabled={exporting !== null} className="rounded-full text-[9px]" title="Standalone CutContour dieline SVG">
            {exporting === `${format.id}-dieline` ? <Loader2 className="h-3 w-3 animate-spin"/> : "Dieline"}
          </Button>
        </div>
      )}
      <OverrideDialog
        open={overrideOpen}
        onOpenChange={setOverrideOpen}
        format={format}
        override={override}
        globalSettings={globalSettings}
        selectedFormats={selectedFormats}
        onSave={(o) => { onOverrideChange(o); setOverrideOpen(false); }}
        onClear={() => { onOverrideClear(); setOverrideOpen(false); }}
        onCopyToFormats={onCopyToFormats}
      />
    </div>
  );
}

function ValidationPanel({ results, validating, onRun, warningsAck, onAckChange }: {
  results: ValidationResult[];
  validating: boolean;
  onRun: () => void;
  warningsAck: boolean;
  onAckChange: (v: boolean) => void;
}) {
  const summary = useMemo(() => readyToPrint(results), [results]);
  const grouped = useMemo(() => {
    const m: Record<ValidationLevel, ValidationResult[]> = { error: [], warning: [], pass: [] };
    for (const r of results) m[r.level].push(r);
    return m;
  }, [results]);

  return (
    <div className="space-y-2 rounded-2xl border border-border/70 bg-card/50 p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2 text-xs">
          <span className="font-semibold uppercase tracking-wide text-muted-foreground">Validation</span>
          {results.length > 0 && (
            <>
              <Badge variant={summary.blocking > 0 ? "destructive" : "default"} className="rounded-full text-[10px]">
                {summary.blocking} blocking
              </Badge>
              <Badge variant="outline" className="rounded-full border-amber-500/50 text-[10px] text-amber-500">
                {summary.warnings} warnings
              </Badge>
              {summary.ready && summary.warnings === 0 && (
                <Badge variant="default" className="rounded-full text-[10px]"><CheckCircle2 className="mr-1 h-2.5 w-2.5"/>All checks passed</Badge>
              )}
            </>
          )}
        </div>
        <Button size="sm" variant="outline" onClick={onRun} disabled={validating} className="rounded-full text-xs">
          {validating ? <Loader2 className="mr-1 h-3 w-3 animate-spin"/> : <CheckCircle2 className="mr-1 h-3 w-3"/>}
          {results.length === 0 ? "Run validation" : "Re-run validation"}
        </Button>
      </div>
      {results.length > 0 && (
        <div className="max-h-80 space-y-1.5 overflow-y-auto pr-1">
          {[...grouped.error, ...grouped.warning].map((r, i) => (
            <div key={`${r.id}-${r.formatId}-${i}`} className={`rounded-xl border p-2.5 text-[11px] ${r.level === "error" ? "border-destructive/40 bg-destructive/5" : "border-amber-500/40 bg-amber-500/5"}`}>
              <div className="flex items-center gap-2">
                {r.level === "error" ? <AlertTriangle className="h-3 w-3 text-destructive"/> : <AlertTriangle className="h-3 w-3 text-amber-500"/>}
                <span className="font-semibold">{r.title}</span>
                <Badge variant="outline" className="rounded-full text-[9px]">{r.category}</Badge>
                {r.formatId && <span className="text-[10px] text-muted-foreground">{r.formatId}</span>}
              </div>
              <p className="mt-1 text-muted-foreground">{r.message}</p>
              {r.suggestedFix && <p className="mt-0.5 text-[10px] text-muted-foreground"><span className="font-semibold">Fix:</span> {r.suggestedFix}</p>}
            </div>
          ))}
          {summary.blocking === 0 && summary.warnings > 0 && (
            <label className="flex items-center gap-2 rounded-xl bg-accent/30 px-3 py-2 text-[11px]">
              <Checkbox checked={warningsAck} onCheckedChange={(v) => onAckChange(v === true)}/>
              I acknowledge the warnings above and want to mark this pack ready to print.
            </label>
          )}
        </div>
      )}
    </div>
  );
}

function OverrideDialog({ open, onOpenChange, format, override, globalSettings, selectedFormats, onSave, onClear, onCopyToFormats }: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  format: BusinessFormat;
  override: FormatOverride | undefined;
  globalSettings: GlobalSettings;
  selectedFormats: string[];
  onSave: (o: FormatOverride) => void;
  onClear: () => void;
  onCopyToFormats: (ids: string[], o: FormatOverride) => void;
}) {
  const [draft, setDraft] = useState<FormatOverride>({});
  useEffect(() => { if (open) setDraft(override ?? {}); }, [open, override]);

  function patch<K extends keyof FormatOverride>(k: K, v: FormatOverride[K]) {
    setDraft((d) => ({ ...d, [k]: v }));
  }
  function unset<K extends keyof FormatOverride>(k: K) {
    setDraft((d) => { const n = { ...d }; delete n[k]; return n; });
  }

  const similar = useMemo(() => {
    const all = FORMATS.filter((f) => selectedFormats.includes(f.id));
    return similarFormats(format, all);
  }, [format, selectedFormats]);

  const otherSelected = useMemo(() => FORMATS.filter((f) => selectedFormats.includes(f.id) && f.id !== format.id), [format, selectedFormats]);

  const [copyPickerOpen, setCopyPickerOpen] = useState(false);
  const [copyIds, setCopyIds] = useState<string[]>([]);

  async function onBgFile(file: File | null) {
    if (!file) { patch("backgroundImage", null); return; }
    if (file.size > 4 * 1024 * 1024) return toast.error("Image too large (max 4 MB)");
    patch("backgroundImage", await fileToDataUrl(file));
  }

  function applyGlobal() {
    setDraft({
      textAlign: globalSettings.textAlign,
      textColor: globalSettings.textColor,
      backgroundColor: globalSettings.backgroundColor,
      accentColor: globalSettings.accentColor,
      borderStyle: globalSettings.borderStyle,
      cornerRadius: globalSettings.cornerRadius,
      starStyle: globalSettings.starStyle,
      logoSize: globalSettings.logoSize,
      backgroundImage: globalSettings.backgroundImage ?? null,
      backgroundImageOpacity: globalSettings.backgroundImageOpacity,
      fontFamily: globalSettings.fontFamily,
    });
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[85vh] max-w-2xl overflow-y-auto">
        <DialogHeader><DialogTitle>Customise {format.name}</DialogTitle></DialogHeader>
        <div className="space-y-4">
          <SectionHeading>Copy</SectionHeading>
          <div className="grid gap-3">
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
                <Label className="text-xs">CTA override</Label>
                <Input value={draft.ctaText ?? ""} onChange={(e) => patch("ctaText", e.target.value || undefined)} className="rounded-xl" placeholder="Use pack default"/>
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Footer override</Label>
                <Input value={draft.footerText ?? ""} onChange={(e) => patch("footerText", e.target.value || undefined)} className="rounded-xl" placeholder="Use pack default"/>
              </div>
            </div>
          </div>

          <SectionHeading>Visibility</SectionHeading>
          <div className="grid gap-2 rounded-xl bg-accent/30 p-3 sm:grid-cols-2">
            <label className="flex items-center gap-2 text-xs">
              <Checkbox checked={draft.showBusinessName !== false} onCheckedChange={(v) => patch("showBusinessName", v === true)}/> Show business name
            </label>
            <label className="flex items-center gap-2 text-xs">
              <Checkbox checked={draft.logoVisible !== false} onCheckedChange={(v) => patch("logoVisible", v === true)}/> Show logo
            </label>
            <label className="flex items-center gap-2 text-xs">
              <Checkbox checked={draft.showGoogleBadge !== false} onCheckedChange={(v) => patch("showGoogleBadge", v === true)}/> Show Google badge
            </label>
            <label className="flex items-center gap-2 text-xs">
              <Checkbox checked={draft.hideStars === true} onCheckedChange={(v) => patch("hideStars", v === true)}/> Hide stars
            </label>
          </div>

          <SectionHeading>Colours</SectionHeading>
          <div className="grid gap-3 sm:grid-cols-3">
            <MiniColor label="Background" value={draft.backgroundColor} onChange={(v) => patch("backgroundColor", v)} onClear={() => unset("backgroundColor")}/>
            <MiniColor label="Text" value={draft.textColor} onChange={(v) => patch("textColor", v)} onClear={() => unset("textColor")}/>
            <MiniColor label="Accent" value={draft.accentColor} onChange={(v) => patch("accentColor", v)} onClear={() => unset("accentColor")}/>
          </div>

          <SectionHeading>Typography &amp; layout</SectionHeading>
          <div className="grid gap-3 sm:grid-cols-3">
            <SelectField label="Font family" value={draft.fontFamily ?? "inherit"} onChange={(v) => v === "inherit" ? unset("fontFamily") : patch("fontFamily", v)}
              options={[{ value: "inherit", label: "Use pack" }, ...FONT_OPTIONS.map((f) => ({ value: f.id, label: f.label }))]}/>
            <SelectField label="Text alignment" value={draft.textAlign ?? "inherit"} onChange={(v) => v === "inherit" ? unset("textAlign") : patch("textAlign", v as FormatOverride["textAlign"])}
              options={[{ value: "inherit", label: "Use pack" }, { value: "left", label: "Left" }, { value: "center", label: "Center" }, { value: "right", label: "Right" }]}/>
            <SelectField label="Border style" value={draft.borderStyle ?? "inherit"} onChange={(v) => v === "inherit" ? unset("borderStyle") : patch("borderStyle", v as FormatOverride["borderStyle"])}
              options={[{ value: "inherit", label: "Use pack" }, ...BORDER_STYLES.map((b) => ({ value: b.id, label: b.label }))]}/>
            <SelectField label="Star style" value={draft.starStyle ?? "inherit"} onChange={(v) => v === "inherit" ? unset("starStyle") : patch("starStyle", v as FormatOverride["starStyle"])}
              options={[{ value: "inherit", label: "Use pack" }, ...STAR_STYLES.map((s) => ({ value: s.id, label: s.label }))]}/>
            <SliderField label={`Corner radius — ${draft.cornerRadius ?? "pack"}`} value={draft.cornerRadius ?? 0} min={0} max={20} onChange={(v) => patch("cornerRadius", v)}/>
            <SliderField label={`Logo size — ${Math.round((draft.logoSize ?? 0.18) * 100)}%`} value={Math.round((draft.logoSize ?? 0.18) * 100)} min={8} max={35} onChange={(v) => patch("logoSize", v / 100)}/>
          </div>

          <SectionHeading>QR position</SectionHeading>
          <div className="grid gap-3 sm:grid-cols-3">
            <SliderField label={`QR scale — ${Math.round((draft.qrScale ?? 0.45) * 100)}%`} value={Math.round((draft.qrScale ?? 0.45) * 100)} min={30} max={70} onChange={(v) => patch("qrScale", v / 100)}/>
            <SliderField label={`X offset — ${Math.round((draft.qrOffsetX ?? 0) * 100)}%`} value={Math.round((draft.qrOffsetX ?? 0) * 100)} min={-40} max={40} onChange={(v) => patch("qrOffsetX", v / 100)}/>
            <SliderField label={`Y offset — ${Math.round((draft.qrOffsetY ?? 0) * 100)}%`} value={Math.round((draft.qrOffsetY ?? 0) * 100)} min={-40} max={40} onChange={(v) => patch("qrOffsetY", v / 100)}/>
          </div>

          <SectionHeading>Background image</SectionHeading>
          <div className="flex flex-wrap items-center gap-3 rounded-2xl border border-border/60 p-3">
            <div className="flex h-16 w-16 items-center justify-center overflow-hidden rounded-lg bg-accent/40">
              {draft.backgroundImage ? <img src={draft.backgroundImage} alt="" className="h-full w-full object-cover"/> : <ImagePlus className="h-5 w-5 text-muted-foreground"/>}
            </div>
            <label className="inline-flex cursor-pointer items-center gap-1 rounded-full border border-border bg-card px-3 py-1 text-xs hover:bg-accent">
              <ImagePlus className="h-3 w-3"/>Upload
              <input type="file" accept="image/*" className="hidden" onChange={(e) => onBgFile(e.target.files?.[0] ?? null)}/>
            </label>
            {draft.backgroundImage && (
              <Button size="sm" variant="ghost" onClick={() => patch("backgroundImage", null)} className="rounded-full text-xs text-destructive">
                <X className="mr-1 h-3 w-3"/>Remove
              </Button>
            )}
            <div className="min-w-[160px] flex-1">
              <SliderField label={`Opacity — ${Math.round((draft.backgroundImageOpacity ?? 1) * 100)}%`} value={Math.round((draft.backgroundImageOpacity ?? 1) * 100)} min={10} max={100} onChange={(v) => patch("backgroundImageOpacity", v / 100)}/>
            </div>
          </div>
        </div>

        <DialogFooter className="mt-4 gap-2 sm:justify-between">
          <div className="flex flex-wrap gap-2">
            <Button variant="ghost" onClick={onClear} className="rounded-full text-destructive">
              <Trash2 className="mr-1 h-3 w-3"/>Reset this format
            </Button>
            <Button variant="outline" onClick={applyGlobal} className="rounded-full text-xs">Apply global settings</Button>
            {similar.length > 0 && (
              <Button variant="outline" onClick={() => { onCopyToFormats(similar.map((f) => f.id), draft); toast.success(`Copied to ${similar.length} similar`); }} className="rounded-full text-xs">
                Copy to similar ({similar.length})
              </Button>
            )}
            {otherSelected.length > 0 && (
              <Button variant="outline" onClick={() => { setCopyIds([]); setCopyPickerOpen(true); }} className="rounded-full text-xs">Copy to selected…</Button>
            )}
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => onOpenChange(false)} className="rounded-full">Cancel</Button>
            <Button onClick={() => onSave(draft)} className="rounded-full">Save override</Button>
          </div>
        </DialogFooter>

        <Dialog open={copyPickerOpen} onOpenChange={setCopyPickerOpen}>
          <DialogContent className="max-w-md">
            <DialogHeader><DialogTitle>Copy override to formats</DialogTitle></DialogHeader>
            <div className="max-h-[50vh] space-y-1 overflow-y-auto">
              {otherSelected.map((f) => (
                <label key={f.id} className="flex items-center gap-2 rounded-lg px-2 py-1.5 text-xs hover:bg-accent">
                  <Checkbox checked={copyIds.includes(f.id)} onCheckedChange={(v) => setCopyIds(v ? [...copyIds, f.id] : copyIds.filter((x) => x !== f.id))}/>
                  {f.name}
                </label>
              ))}
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setCopyPickerOpen(false)} className="rounded-full">Cancel</Button>
              <Button onClick={() => { onCopyToFormats(copyIds, draft); setCopyPickerOpen(false); toast.success(`Copied to ${copyIds.length} format(s)`); }} className="rounded-full" disabled={copyIds.length === 0}>Copy</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </DialogContent>
    </Dialog>
  );
}

function MiniColor({ label, value, onChange, onClear }: { label: string; value: string | undefined; onChange: (v: string) => void; onClear: () => void }) {
  return (
    <div className="space-y-1.5">
      <Label className="text-xs">{label}</Label>
      <div className="flex items-center gap-2">
        <input type="color" value={value ?? "#ffffff"} onChange={(e) => onChange(e.target.value)} className="h-9 w-12 cursor-pointer rounded-lg border border-border"/>
        <Input value={value ?? ""} onChange={(e) => onChange(e.target.value)} placeholder="Use pack" className="rounded-xl font-mono text-xs"/>
        {value && <Button size="sm" variant="ghost" onClick={onClear} className="h-8 rounded-full px-2 text-[10px]">Clear</Button>}
      </div>
    </div>
  );
}

function fileToDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const fr = new FileReader();
    fr.onload = () => resolve(fr.result as string);
    fr.onerror = () => reject(fr.error);
    fr.readAsDataURL(file);
  });
}

function blobToDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const fr = new FileReader();
    fr.onload = () => resolve(fr.result as string);
    fr.onerror = () => reject(fr.error);
    fr.readAsDataURL(blob);
  });
}
