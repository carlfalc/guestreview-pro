// AI Copy Assistant dialog — generate, review alternatives, apply, save favourites.

import { useEffect, useMemo, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Sparkles, Loader2, Copy, Star, RotateCw, AlertTriangle, CheckCircle2, Undo2 } from "lucide-react";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import {
  TONES, LENGTHS, PLACEMENTS, BUSINESS_TYPES, limitsFor, alternativeIsSafe,
  type Alternative, type CopyResponse, type GenerateInput, type Placement, type Tone, type Length, type BusinessType,
  type BusinessAiPreferences,
} from "@/lib/ai-copy";
import { generateMarketingCopy, markGenerationSelection } from "@/lib/ai-copy.functions";

export type AiCopyContext = {
  businessId: string | null;
  businessName: string;
  businessType?: BusinessType;
  packId: string | null;
  packType?: string;
  formatId?: string | null;
  placement: Placement;
  existing: { headline: string; supportingText: string; ctaText: string; footerText: string };
  preferences?: BusinessAiPreferences;
  businessDescription?: string;
};

export type ApplyPatch = Partial<{ headline: string; supportingText: string; ctaText: string; footerText: string }>;

export function AiCopyDialog({
  open, onOpenChange, ctx, onApply, onUndo, canUndo,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  ctx: AiCopyContext;
  onApply: (patch: ApplyPatch, source: { alternativeIndex: number; generationId: string | null }) => void;
  onUndo: () => void;
  canUndo: boolean;
}) {
  const [tone, setTone] = useState<Tone>(ctx.preferences?.defaultTone ?? "Professional");
  const [length, setLength] = useState<Length>("Standard");
  const [businessType, setBusinessType] = useState<BusinessType>(ctx.businessType ?? "General business");
  const [placement, setPlacement] = useState<Placement>(ctx.placement);
  const [audience, setAudience] = useState<string>(ctx.preferences?.targetAudience ?? "");
  const [keyMessage, setKeyMessage] = useState<string>("");
  const [language, setLanguage] = useState<string>(ctx.preferences?.defaultLanguage ?? "en");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [response, setResponse] = useState<CopyResponse | null>(null);
  const [generationId, setGenerationId] = useState<string | null>(null);

  const generate = useServerFn(generateMarketingCopy);
  const mark = useServerFn(markGenerationSelection);
  const limits = useMemo(() => limitsFor(placement), [placement]);

  useEffect(() => { if (open) { setResponse(null); setError(null); setGenerationId(null); } }, [open]);

  async function run() {
    setLoading(true); setError(null);
    try {
      const input: GenerateInput = {
        businessName: ctx.businessName, businessType, packType: ctx.packType,
        formatId: ctx.formatId ?? null, placement, tone, length, audience, language,
        existingWording: ctx.existing, keyMessage: keyMessage || undefined,
        businessDescription: ctx.businessDescription, preferences: ctx.preferences,
        alternativesCount: 3,
      };
      const { result, generationId } = await generate({ data: { businessId: ctx.businessId, packId: ctx.packId, input } });
      setResponse(result); setGenerationId(generationId);
    } catch (e) {
      const msg = (e as Error).message;
      setError(errorMessage(msg));
    } finally { setLoading(false); }
  }

  async function apply(a: Alternative, index: number, patch: ApplyPatch) {
    onApply(patch, { alternativeIndex: index, generationId });
    if (generationId) {
      try { await mark({ data: { generationId, alternativeIndex: index } }); } catch { /* ignore */ }
    }
  }

  async function saveFavourite(a: Alternative) {
    if (!ctx.businessId) { toast.error("Choose a business first"); return; }
    const name = window.prompt("Name this favourite", `${tone} · ${placement}`);
    if (!name) return;
    const { error } = await supabase.from("ai_copy_favourites").insert({
      business_id: ctx.businessId, name,
      headline: a.headline, support_text: a.supportingText, cta_text: a.ctaText, footer_text: a.footerText,
      tone: a.tone || tone, placement,
    } as never);
    if (error) toast.error(error.message); else toast.success("Saved to favourites");
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] max-w-3xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2"><Sparkles className="h-4 w-4"/>AI Copy Assistant</DialogTitle>
        </DialogHeader>

        <div className="grid gap-3 sm:grid-cols-2">
          <SelectRow label="Business type" value={businessType} onChange={(v) => setBusinessType(v as BusinessType)} options={BUSINESS_TYPES as unknown as string[]}/>
          <SelectRow label="Placement" value={placement} onChange={(v) => setPlacement(v as Placement)} options={PLACEMENTS as unknown as string[]}/>
          <SelectRow label="Tone" value={tone} onChange={(v) => setTone(v as Tone)} options={TONES as unknown as string[]}/>
          <SelectRow label="Length" value={length} onChange={(v) => setLength(v as Length)} options={LENGTHS as unknown as string[]}/>
          <div className="space-y-1"><Label className="text-xs">Language</Label>
            <Input value={language} onChange={(e) => setLanguage(e.target.value)} maxLength={8} className="rounded-xl"/></div>
          <div className="space-y-1"><Label className="text-xs">Audience</Label>
            <Input value={audience} onChange={(e) => setAudience(e.target.value)} maxLength={80} className="rounded-xl" placeholder="e.g. weekend brunch crowd"/></div>
          <div className="sm:col-span-2 space-y-1">
            <Label className="text-xs">Key message (optional)</Label>
            <Textarea value={keyMessage} onChange={(e) => setKeyMessage(e.target.value)} rows={2} maxLength={280} className="rounded-xl" placeholder="What should the wording emphasise?"/>
          </div>
        </div>

        <div className="mt-3 flex flex-wrap items-center justify-between gap-2 rounded-2xl bg-accent/30 p-3 text-[11px] text-muted-foreground">
          <span>Recommended max — h {limits.headline} · sup {limits.supportingText} · cta {limits.ctaText} · foot {limits.footerText}</span>
          <div className="flex gap-2">
            <Button variant="ghost" size="sm" onClick={onUndo} disabled={!canUndo} className="rounded-full text-xs"><Undo2 className="mr-1 h-3 w-3"/>Undo AI copy</Button>
            <Button onClick={run} disabled={loading} className="rounded-full text-xs">
              {loading ? <Loader2 className="mr-1 h-3 w-3 animate-spin"/> : <Sparkles className="mr-1 h-3 w-3"/>}
              {response ? "Regenerate" : "Generate"}
            </Button>
          </div>
        </div>

        {error && (
          <div className="mt-3 flex items-start gap-2 rounded-2xl border border-destructive/40 bg-destructive/10 p-3 text-xs text-destructive">
            <AlertTriangle className="mt-0.5 h-4 w-4"/><span>{error}</span>
          </div>
        )}

        {response && (
          <div className="mt-3 space-y-3">
            {(response.safety.reviewGatingDetected || response.safety.incentiveDetected || response.safety.fakeReviewDetected) && (
              <div className="rounded-2xl border border-amber-500/40 bg-amber-500/10 p-3 text-xs text-amber-500">
                <AlertTriangle className="mr-1 inline h-3 w-3"/>Some alternatives were flagged as unsafe (review gating / incentives / fake wording). Unsafe cards are marked and cannot be applied.
              </div>
            )}
            {response.alternatives.map((a, i) => (
              <AlternativeCard key={i} a={a} placement={placement} onApply={(patch) => apply(a, i, patch)} onFavourite={() => saveFavourite(a)}/>
            ))}
          </div>
        )}

        <DialogFooter className="mt-4">
          <Button variant="outline" onClick={() => onOpenChange(false)} className="rounded-full">Close</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function SelectRow({ label, value, onChange, options }: { label: string; value: string; onChange: (v: string) => void; options: string[] }) {
  return (
    <div className="space-y-1">
      <Label className="text-xs">{label}</Label>
      <select value={value} onChange={(e) => onChange(e.target.value)} className="w-full rounded-xl border border-border bg-background px-3 py-2 text-sm">
        {options.map((o) => <option key={o} value={o}>{o}</option>)}
      </select>
    </div>
  );
}

function AlternativeCard({ a, placement, onApply, onFavourite }: {
  a: Alternative; placement: Placement; onApply: (p: ApplyPatch) => void; onFavourite: () => void;
}) {
  const limits = limitsFor(placement);
  const safe = alternativeIsSafe(a);
  const over = (val: string, max: number) => val.length > max;
  const Field = ({ k, label, max, val }: { k: keyof ApplyPatch; label: string; max: number; val: string }) => (
    <div className="flex items-start justify-between gap-2 rounded-xl bg-accent/20 px-3 py-2">
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2 text-[10px] uppercase tracking-wide text-muted-foreground">
          {label}
          <span className={over(val, max) ? "text-amber-500" : "text-muted-foreground"}>{val.length}/{max}</span>
        </div>
        <div className="mt-0.5 truncate text-sm">{val || <span className="text-muted-foreground">—</span>}</div>
      </div>
      <Button size="sm" variant="ghost" disabled={!safe || !val} onClick={() => onApply({ [k]: val } as ApplyPatch)} className="rounded-full text-[11px]">Apply</Button>
    </div>
  );

  return (
    <div className={`rounded-2xl border p-3 ${safe ? "border-border/60" : "border-destructive/40 bg-destructive/5"}`}>
      <div className="mb-2 flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <Badge variant="outline" className="rounded-full text-[10px]">{a.tone || "—"}</Badge>
          {!safe && <Badge variant="destructive" className="rounded-full text-[10px]">Unsafe</Badge>}
        </div>
        <div className="flex gap-1">
          <Button size="sm" variant="ghost" onClick={() => navigator.clipboard.writeText(`${a.headline}\n${a.supportingText}\n${a.ctaText}\n${a.footerText}`).then(() => toast.success("Copied"))} className="rounded-full text-[11px]"><Copy className="mr-1 h-3 w-3"/>Copy</Button>
          <Button size="sm" variant="ghost" onClick={onFavourite} disabled={!safe} className="rounded-full text-[11px]"><Star className="mr-1 h-3 w-3"/>Favourite</Button>
          <Button size="sm" disabled={!safe} onClick={() => onApply({ headline: a.headline, supportingText: a.supportingText, ctaText: a.ctaText, footerText: a.footerText })} className="rounded-full text-[11px]"><CheckCircle2 className="mr-1 h-3 w-3"/>Apply all</Button>
        </div>
      </div>
      <div className="grid gap-1.5">
        <Field k="headline" label="Headline" max={limits.headline} val={a.headline}/>
        <Field k="supportingText" label="Supporting" max={limits.supportingText} val={a.supportingText}/>
        <Field k="ctaText" label="CTA" max={limits.ctaText} val={a.ctaText}/>
        <Field k="footerText" label="Footer" max={limits.footerText} val={a.footerText}/>
      </div>
      {a.rationale && <p className="mt-2 text-[10px] italic text-muted-foreground">{a.rationale}</p>}
    </div>
  );
}

function errorMessage(code: string): string {
  switch (code) {
    case "monthly_limit_reached": return "You've hit the monthly generation limit. Try again next month or contact support.";
    case "rate_limit_reached": return "Too many generations in the last hour. Please wait and try again.";
    case "rate_limit_upstream": return "The AI service is busy. Please retry in a moment.";
    case "credits_exhausted": return "AI credits exhausted. Please contact your workspace admin.";
    case "invalid_response_format": return "The AI returned an unexpected format. Please regenerate.";
    default: return code || "Something went wrong. Please try again.";
  }
}

// --- History + Favourites panels ------------------------------------------

export function AiCopyHistoryPanel({ businessId, onReapply }: { businessId: string | null; onReapply: (a: Alternative) => void }) {
  const [rows, setRows] = useState<Array<{ id: string; created_at: string; placement: string | null; tone: string | null; generated_output: CopyResponse }>>([]);
  const [loading, setLoading] = useState(false);

  async function load() {
    if (!businessId) return;
    setLoading(true);
    const { data } = await supabase.from("ai_copy_generations")
      .select("id, created_at, placement, tone, generated_output")
      .eq("business_id", businessId).order("created_at", { ascending: false }).limit(20);
    setRows((data as unknown as typeof rows) ?? []);
    setLoading(false);
  }
  useEffect(() => { load(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [businessId]);

  async function del(id: string) {
    await supabase.from("ai_copy_generations").delete().eq("id", id);
    load();
  }

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Copy history</p>
        <Button size="sm" variant="ghost" onClick={load} disabled={loading} className="rounded-full text-[11px]"><RotateCw className="mr-1 h-3 w-3"/>Refresh</Button>
      </div>
      {rows.length === 0 && <p className="rounded-2xl border border-dashed p-4 text-center text-[11px] text-muted-foreground">No generations yet.</p>}
      {rows.map((r) => (
        <div key={r.id} className="rounded-2xl border border-border/60 p-2 text-xs">
          <div className="flex items-center justify-between">
            <span className="text-[10px] text-muted-foreground">{new Date(r.created_at).toLocaleString()} · {r.tone} · {r.placement}</span>
            <Button size="sm" variant="ghost" onClick={() => del(r.id)} className="rounded-full text-[10px] text-destructive">Delete</Button>
          </div>
          <div className="mt-1 space-y-1">
            {(r.generated_output?.alternatives ?? []).slice(0, 3).map((a, i) => (
              <button key={i} onClick={() => onReapply(a)} className="block w-full rounded-xl bg-accent/30 p-2 text-left hover:bg-accent">
                <div className="truncate font-semibold">{a.headline}</div>
                <div className="truncate text-[10px] text-muted-foreground">{a.supportingText}</div>
              </button>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
