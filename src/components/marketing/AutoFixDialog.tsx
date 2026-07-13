// Fix Automatically dialog. Renders the proposal list with checkboxes,
// before/after values and a "Apply selected" action. No project state is
// mutated until the user confirms.

import { useEffect, useMemo, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { AlertTriangle, CheckCircle2, Loader2, Wand2 } from "lucide-react";
import type { AutoFixProposal } from "@/lib/auto-fix";

type Phase = "analysing" | "ready" | "applying" | "revalidating" | "done" | "failed";

export function AutoFixDialog({
  open, onOpenChange, proposals, phase, error,
  onApply, onCancel,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  proposals: AutoFixProposal[];
  phase: Phase;
  error?: string | null;
  onApply: (selected: AutoFixProposal[]) => void;
  onCancel: () => void;
}) {
  const [selected, setSelected] = useState<Record<string, boolean>>({});

  useEffect(() => {
    if (!open) return;
    // Default: all selected.
    const next: Record<string, boolean> = {};
    for (const p of proposals) next[p.id] = true;
    setSelected(next);
  }, [open, proposals]);

  const byFormat = useMemo(() => {
    const m = new Map<string, AutoFixProposal[]>();
    for (const p of proposals) {
      const k = p.formatName ?? "Pack-wide";
      if (!m.has(k)) m.set(k, []);
      m.get(k)!.push(p);
    }
    return Array.from(m.entries());
  }, [proposals]);

  const selectedList = proposals.filter((p) => selected[p.id]);
  const busy = phase === "applying" || phase === "revalidating" || phase === "analysing";

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[85vh] max-w-3xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Wand2 className="h-4 w-4"/>Fix automatically
          </DialogTitle>
        </DialogHeader>

        <PhaseBanner phase={phase} error={error} count={proposals.length}/>

        {phase === "analysing" && (
          <div className="flex items-center justify-center gap-2 py-10 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin"/>Analysing validation results…
          </div>
        )}

        {phase !== "analysing" && proposals.length === 0 && (
          <div className="rounded-2xl border border-border/70 bg-accent/30 p-6 text-center text-sm text-muted-foreground">
            No automatic fixes are available for the current issues. Some fixes (text rewriting, redesign)
            require manual edits.
          </div>
        )}

        {byFormat.length > 0 && (
          <div className="space-y-3">
            <div className="flex items-center justify-between text-[11px] text-muted-foreground">
              <span>{selectedList.length} of {proposals.length} fixes selected</span>
              <div className="flex gap-1.5">
                <Button size="sm" variant="ghost" onClick={() => {
                  const n: Record<string, boolean> = {}; for (const p of proposals) n[p.id] = true; setSelected(n);
                }} className="h-6 rounded-full text-[10px]">Select all</Button>
                <Button size="sm" variant="ghost" onClick={() => setSelected({})} className="h-6 rounded-full text-[10px]">None</Button>
              </div>
            </div>
            {byFormat.map(([name, items]) => (
              <div key={name} className="space-y-1.5">
                <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">{name}</p>
                <div className="space-y-1.5">
                  {items.map((p) => (
                    <label key={p.id} className={`flex cursor-pointer items-start gap-2 rounded-xl border p-3 text-[11px] transition-colors ${selected[p.id] ? "border-primary/50 bg-primary/5" : "border-border/60 bg-card"}`}>
                      <Checkbox className="mt-0.5" checked={!!selected[p.id]} onCheckedChange={(v) => setSelected((s) => ({ ...s, [p.id]: v === true }))} disabled={busy}/>
                      <div className="min-w-0 flex-1 space-y-0.5">
                        <div className="flex flex-wrap items-center gap-1.5">
                          <span className="font-semibold">{p.description}</span>
                          <Badge variant="outline" className="rounded-full text-[9px]">{p.category}</Badge>
                          {p.panel && <Badge variant="outline" className="rounded-full text-[9px]">{p.panel}</Badge>}
                          <Badge variant={p.severity === "error" ? "destructive" : "outline"} className="rounded-full text-[9px]">{p.severity}</Badge>
                        </div>
                        <p className="text-muted-foreground"><span className="font-semibold">Reason:</span> {p.reason}</p>
                        <p className="font-mono text-[10px] text-muted-foreground">
                          <span className="text-destructive">before</span> {p.before}<br/>
                          <span className="text-emerald-500">after</span>&nbsp; {p.after}
                        </p>
                      </div>
                    </label>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}

        <DialogFooter className="mt-4 gap-2 sm:justify-between">
          <div className="text-[10px] text-muted-foreground">
            One-step undo is stored after applying — use “Undo automatic fixes” to restore prior state.
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => { onCancel(); onOpenChange(false); }} disabled={busy} className="rounded-full">Cancel</Button>
            <Button
              disabled={busy || selectedList.length === 0}
              onClick={() => onApply(selectedList)}
              className="rounded-full"
            >
              {busy ? <Loader2 className="mr-1 h-3 w-3 animate-spin"/> : <Wand2 className="mr-1 h-3 w-3"/>}
              Apply {selectedList.length === proposals.length ? "all fixes" : `${selectedList.length} fix${selectedList.length === 1 ? "" : "es"}`}
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function PhaseBanner({ phase, error, count }: { phase: Phase; error?: string | null; count: number }) {
  if (phase === "ready") return null;
  if (phase === "applying") return <Row icon={<Loader2 className="h-3 w-3 animate-spin"/>}>Applying {count} fix(es)…</Row>;
  if (phase === "revalidating") return <Row icon={<Loader2 className="h-3 w-3 animate-spin"/>}>Re-running validation…</Row>;
  if (phase === "done") return <Row icon={<CheckCircle2 className="h-3 w-3 text-emerald-500"/>} tone="ok">Done. Validation re-ran automatically.</Row>;
  if (phase === "failed") return <Row icon={<AlertTriangle className="h-3 w-3 text-destructive"/>} tone="err">{error ?? "Some fixes could not be applied."}</Row>;
  return null;
}

function Row({ icon, children, tone }: { icon: React.ReactNode; children: React.ReactNode; tone?: "ok" | "err" }) {
  const cls = tone === "ok" ? "border-emerald-500/40 bg-emerald-500/5 text-emerald-500"
    : tone === "err" ? "border-destructive/40 bg-destructive/5 text-destructive"
    : "border-border/60 bg-accent/30 text-muted-foreground";
  return <div className={`flex items-center gap-2 rounded-xl border p-2 text-[11px] ${cls}`}>{icon} {children}</div>;
}
