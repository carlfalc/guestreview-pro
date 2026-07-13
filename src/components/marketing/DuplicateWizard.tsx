// Multi-step duplication wizard: same QR (quick), another QR, another business.
// Reads only records the current user owns — RLS enforces authoritative filtering.

import { useEffect, useMemo, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Loader2, ChevronLeft, ChevronRight, Copy, CheckCircle2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export type DuplicateFields = {
  content: boolean;
  design: boolean;
  formats: boolean;
  customizations: boolean;
  folded: boolean;
  backgroundImages: boolean;
};

export type BrandBehaviour = "replace" | "preserve" | "logo-only";

export type DuplicateWizardMode = "another-qr" | "another-business";

type BizRow = { id: string; name: string; brand_primary: string | null; logo_url: string | null; google_review_url: string | null };
type QrRow = { id: string; short_code: string; label: string | null; destination_type: string; destination_url: string | null; business_id: string };

export function DuplicateWizard({
  open, onOpenChange, mode, currentBusinessId, sourcePack, defaultName, onCreated,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  mode: DuplicateWizardMode;
  currentBusinessId: string;
  sourcePack: {
    id: string;
    project_name: string;
    layout_template: string;
    headline: string | null;
    support_text: string | null;
    cta_text: string | null;
    footer_text: string | null;
    pack_type: string;
    show_business_name: boolean;
    show_logo: boolean;
    show_stars: boolean;
    show_google_badge: boolean;
    selected_formats: string[];
    global_settings: Record<string, unknown>;
    format_customizations: Record<string, unknown>;
  };
  defaultName: string;
  onCreated: (newId: string) => void;
}) {
  const [step, setStep] = useState(1);
  const [busy, setBusy] = useState<string | null>(null);
  const [businesses, setBusinesses] = useState<BizRow[]>([]);
  const [qrs, setQrs] = useState<QrRow[]>([]);
  const [businessId, setBusinessId] = useState(currentBusinessId);
  const [qrId, setQrId] = useState<string | null>(null);
  const [projectName, setProjectName] = useState(defaultName);
  const [fields, setFields] = useState<DuplicateFields>({
    content: true, design: true, formats: true, customizations: true, folded: true, backgroundImages: true,
  });
  const [brandMode, setBrandMode] = useState<BrandBehaviour>("replace");

  // Reset when opened
  useEffect(() => {
    if (!open) return;
    setStep(1);
    setBusinessId(currentBusinessId);
    setQrId(null);
    setProjectName(defaultName);
    setFields({ content: true, design: true, formats: true, customizations: true, folded: true, backgroundImages: true });
    setBrandMode("replace");
  }, [open, currentBusinessId, defaultName]);

  // Load businesses (only when needed)
  useEffect(() => {
    if (!open || mode !== "another-business") return;
    setBusy("businesses");
    supabase.from("businesses").select("id, name, brand_primary, logo_url, google_review_url").order("name")
      .then(({ data, error }) => {
        setBusy(null);
        if (error) return toast.error(error.message);
        setBusinesses((data ?? []) as BizRow[]);
      });
  }, [open, mode]);

  // Load QRs for the active businessId
  useEffect(() => {
    if (!open) return;
    if (!businessId) return;
    setBusy("qrs");
    supabase.from("qr_codes").select("id, short_code, label, destination_type, destination_url, business_id")
      .eq("business_id", businessId).order("created_at", { ascending: false })
      .then(({ data, error }) => {
        setBusy(null);
        if (error) return toast.error(error.message);
        setQrs((data ?? []) as QrRow[]);
      });
  }, [open, businessId]);

  const activeBiz = useMemo(() => businesses.find((b) => b.id === businessId), [businesses, businessId]);

  const totalSteps = mode === "another-qr" ? 4 : 6;

  function next() { setStep((s) => Math.min(totalSteps, s + 1)); }
  function prev() { setStep((s) => Math.max(1, s - 1)); }

  async function create() {
    if (!qrId) return toast.error("Pick a QR code");
    setBusy("create");
    try {
      const { data: userData } = await supabase.auth.getUser();
      if (!userData.user) throw new Error("Not signed in");

      // Build the payload based on selected fields.
      const src = sourcePack;
      const payload: Record<string, unknown> = {
        owner_id: userData.user.id,
        business_id: mode === "another-business" ? businessId : src && currentBusinessId,
        qr_code_id: qrId,
        project_name: projectName.trim() || "Duplicated pack",
        pack_type: src.pack_type,
        layout_template: fields.design ? src.layout_template : "clean-minimal",
        status: "draft",
        selected_formats: fields.formats ? (src.selected_formats as unknown as never) : ([] as unknown as never),
      };

      if (fields.content) {
        payload.headline = src.headline;
        payload.support_text = src.support_text;
        payload.cta_text = src.cta_text;
        payload.footer_text = src.footer_text;
        payload.show_business_name = src.show_business_name;
        payload.show_logo = src.show_logo;
        payload.show_stars = src.show_stars;
        payload.show_google_badge = src.show_google_badge;
      }

      // Global settings — respect design + branding rules
      let global = (fields.design ? { ...(src.global_settings ?? {}) } : {}) as Record<string, unknown>;
      if (mode === "another-business" && activeBiz) {
        if (brandMode === "replace") {
          global = {}; // fully use business branding
        } else if (brandMode === "logo-only") {
          // Preserve design colours; business logo comes from business record automatically.
        }
      }
      if (!fields.backgroundImages) {
        delete global.backgroundImage;
      }
      payload.global_settings = global as unknown as never;

      // Per-format customizations
      let customizations = fields.customizations ? { ...(src.format_customizations ?? {}) } : {};
      if (!fields.backgroundImages || !fields.folded) {
        customizations = Object.fromEntries(Object.entries(customizations).map(([k, v]) => {
          const o = { ...(v as Record<string, unknown>) };
          if (!fields.backgroundImages) delete o.backgroundImage;
          if (!fields.folded) delete o.folded;
          return [k, o];
        }));
      }
      payload.format_customizations = customizations as unknown as never;

      const { data, error } = await supabase.from("marketing_packs").insert(payload as never).select("id").single();
      if (error || !data) throw new Error(error?.message ?? "Insert failed");
      toast.success("Duplicated");
      onCreated((data as { id: string }).id);
      onOpenChange(false);
    } catch (e) {
      toast.error(`Duplicate failed: ${(e as Error).message}`);
    } finally {
      setBusy(null);
    }
  }

  const title = mode === "another-qr" ? "Duplicate to another QR" : "Duplicate to another business";

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2"><Copy className="h-4 w-4"/>{title}</DialogTitle>
        </DialogHeader>

        <div className="mb-2 text-[10px] text-muted-foreground">Step {step} of {totalSteps}</div>

        {/* Step 1: business (only for another-business) */}
        {mode === "another-business" && step === 1 && (
          <div className="space-y-2">
            <Label className="text-xs">Choose destination business</Label>
            {busy === "businesses" ? <BusyRow>Loading businesses…</BusyRow> : (
              <RadioGroup value={businessId} onValueChange={(v) => { setBusinessId(v); setQrId(null); }} className="max-h-[40vh] space-y-1 overflow-y-auto">
                {businesses.map((b) => (
                  <label key={b.id} className="flex cursor-pointer items-center gap-2 rounded-lg border border-border/60 px-2 py-1.5 text-xs hover:bg-accent">
                    <RadioGroupItem value={b.id}/>{b.name}
                  </label>
                ))}
              </RadioGroup>
            )}
          </div>
        )}

        {/* Step (2 or 1): QR picker */}
        {((mode === "another-qr" && step === 1) || (mode === "another-business" && step === 2)) && (
          <div className="space-y-2">
            <Label className="text-xs">Choose destination QR code</Label>
            {busy === "qrs" ? <BusyRow>Loading QR codes…</BusyRow> : qrs.length === 0 ? (
              <p className="rounded-lg bg-accent/30 p-3 text-xs text-muted-foreground">No QR codes on this business.</p>
            ) : (
              <RadioGroup value={qrId ?? ""} onValueChange={setQrId} className="max-h-[40vh] space-y-1 overflow-y-auto">
                {qrs.map((q) => (
                  <label key={q.id} className="flex cursor-pointer items-center gap-2 rounded-lg border border-border/60 px-2 py-1.5 text-xs hover:bg-accent">
                    <RadioGroupItem value={q.id}/>
                    <span className="flex-1">{q.label ?? q.short_code}</span>
                    <span className="font-mono text-[10px] text-muted-foreground">{q.short_code}</span>
                  </label>
                ))}
              </RadioGroup>
            )}
          </div>
        )}

        {/* Fields step */}
        {((mode === "another-qr" && step === 2) || (mode === "another-business" && step === 3)) && (
          <FieldsPicker fields={fields} onChange={setFields}/>
        )}

        {/* Brand behaviour (only for another-business) */}
        {mode === "another-business" && step === 4 && (
          <BrandStep value={brandMode} onChange={setBrandMode}/>
        )}

        {/* Name step */}
        {((mode === "another-qr" && step === 3) || (mode === "another-business" && step === 5)) && (
          <div className="space-y-2">
            <Label className="text-xs">Project name</Label>
            <Input value={projectName} onChange={(e) => setProjectName(e.target.value)} className="rounded-xl" maxLength={80}/>
          </div>
        )}

        {/* Confirm step */}
        {((mode === "another-qr" && step === 4) || (mode === "another-business" && step === 6)) && (
          <ConfirmStep
            mode={mode}
            businessName={activeBiz?.name ?? "Current business"}
            qrLabel={qrs.find((q) => q.id === qrId)?.label ?? qrs.find((q) => q.id === qrId)?.short_code ?? "—"}
            fields={fields}
            brandMode={brandMode}
            projectName={projectName}
          />
        )}

        <DialogFooter className="gap-2 sm:justify-between">
          <Button variant="ghost" onClick={prev} disabled={step === 1 || busy != null} className="rounded-full">
            <ChevronLeft className="mr-1 h-3 w-3"/>Back
          </Button>
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => onOpenChange(false)} disabled={busy != null} className="rounded-full">Cancel</Button>
            {step < totalSteps ? (
              <Button
                onClick={next}
                disabled={busy != null || (step === 1 && mode === "another-qr" && !qrId) || (step === 2 && mode === "another-business" && !qrId)}
                className="rounded-full"
              >Next<ChevronRight className="ml-1 h-3 w-3"/></Button>
            ) : (
              <Button onClick={create} disabled={busy != null || !qrId} className="rounded-full">
                {busy === "create" ? <Loader2 className="mr-1 h-3 w-3 animate-spin"/> : <CheckCircle2 className="mr-1 h-3 w-3"/>}
                Create duplicate
              </Button>
            )}
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function BusyRow({ children }: { children: React.ReactNode }) {
  return <div className="flex items-center gap-2 rounded-lg bg-accent/30 p-3 text-xs text-muted-foreground"><Loader2 className="h-3 w-3 animate-spin"/>{children}</div>;
}

function FieldsPicker({ fields, onChange }: { fields: DuplicateFields; onChange: (f: DuplicateFields) => void }) {
  const items: { k: keyof DuplicateFields; label: string; hint: string }[] = [
    { k: "content", label: "Written content", hint: "Headline, support text, CTA, footer, visibility toggles." },
    { k: "design", label: "Global design", hint: "Layout template + global colours, fonts, borders." },
    { k: "formats", label: "Formats", hint: "The list of selected formats." },
    { k: "customizations", label: "Per-format customisations", hint: "Overrides you've set on individual formats." },
    { k: "folded", label: "Folded front / back content", hint: "Per-panel content for table tents." },
    { k: "backgroundImages", label: "Background images", hint: "Uploaded images (global and per-format)." },
  ];
  return (
    <div className="space-y-1.5">
      <Label className="text-xs">Choose what to copy</Label>
      {items.map((it) => (
        <label key={it.k} className="flex cursor-pointer items-start gap-2 rounded-lg border border-border/60 p-2 text-xs hover:bg-accent">
          <Checkbox className="mt-0.5" checked={fields[it.k]} onCheckedChange={(v) => onChange({ ...fields, [it.k]: v === true })}/>
          <div>
            <p className="font-medium">{it.label}</p>
            <p className="text-[10px] text-muted-foreground">{it.hint}</p>
          </div>
        </label>
      ))}
    </div>
  );
}

function BrandStep({ value, onChange }: { value: BrandBehaviour; onChange: (v: BrandBehaviour) => void }) {
  return (
    <div className="space-y-2">
      <Label className="text-xs">Brand behaviour on the destination business</Label>
      <RadioGroup value={value} onValueChange={(v) => onChange(v as BrandBehaviour)} className="space-y-1">
        <label className="flex cursor-pointer items-start gap-2 rounded-lg border border-border/60 p-2 text-xs hover:bg-accent">
          <RadioGroupItem value="replace" className="mt-0.5"/>
          <div><p className="font-medium">Replace with new business branding (recommended)</p>
          <p className="text-[10px] text-muted-foreground">Use the destination business's name, logo and brand colour.</p></div>
        </label>
        <label className="flex cursor-pointer items-start gap-2 rounded-lg border border-border/60 p-2 text-xs hover:bg-accent">
          <RadioGroupItem value="preserve" className="mt-0.5"/>
          <div><p className="font-medium">Preserve current colours</p>
          <p className="text-[10px] text-muted-foreground">Keep the source pack's colours and design; only the QR destination changes.</p></div>
        </label>
        <label className="flex cursor-pointer items-start gap-2 rounded-lg border border-border/60 p-2 text-xs hover:bg-accent">
          <RadioGroupItem value="logo-only" className="mt-0.5"/>
          <div><p className="font-medium">Use new logo but preserve design colours</p>
          <p className="text-[10px] text-muted-foreground">Adopt the destination logo and business name but keep custom colours.</p></div>
        </label>
      </RadioGroup>
    </div>
  );
}

function ConfirmStep({ mode, businessName, qrLabel, fields, brandMode, projectName }: {
  mode: DuplicateWizardMode; businessName: string; qrLabel: string; fields: DuplicateFields; brandMode: BrandBehaviour; projectName: string;
}) {
  const rows: string[] = [];
  if (fields.content) rows.push("Written content");
  if (fields.design) rows.push("Global design");
  if (fields.formats) rows.push("Formats");
  if (fields.customizations) rows.push("Per-format customisations");
  if (fields.folded) rows.push("Folded content");
  if (fields.backgroundImages) rows.push("Background images");
  return (
    <div className="space-y-2 text-xs">
      <div className="rounded-xl bg-accent/30 p-3">
        <p><span className="font-semibold">Destination:</span> {businessName} · {qrLabel}</p>
        <p><span className="font-semibold">Name:</span> {projectName}</p>
        <p><span className="font-semibold">Copying:</span> {rows.length ? rows.join(", ") : "nothing (empty pack)"}</p>
        {mode === "another-business" && (
          <p><span className="font-semibold">Brand behaviour:</span> {brandMode === "replace" ? "Replace with new business branding" : brandMode === "preserve" ? "Preserve current colours" : "New logo, preserved colours"}</p>
        )}
      </div>
      <p className="text-[10px] text-muted-foreground">
        Scan events, analytics, review-click history, export status and preview thumbnails are not copied.
        The new pack starts as Draft and will render its own preview on first open.
      </p>
    </div>
  );
}
