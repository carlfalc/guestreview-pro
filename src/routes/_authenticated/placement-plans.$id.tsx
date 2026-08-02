import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Progress } from "@/components/ui/progress";
import { Separator } from "@/components/ui/separator";
import { ArrowLeft, BarChart3, Copy, ExternalLink, Loader2, QrCode, Sparkles } from "lucide-react";
import { toast } from "sonner";
import {
  getPlacementPlan,
  generatePlacementPlan,
  getPlacementPlanAnalytics,
  setPlanChecklist,
  duplicatePlacementPlan,
  type PlanItemRow,
} from "@/lib/placement-plans.functions";
import { goalLabel, industryLabel, type PriorityKey } from "@/lib/placement-recommendations";
import { friendlyMutationError } from "@/lib/plan-errors";

export const Route = createFileRoute("/_authenticated/placement-plans/$id")({
  component: PlacementPlanDetail,
});

function PlacementPlanDetail() {
  const { id } = Route.useParams();
  const qc = useQueryClient();
  const fetchPlan = useServerFn(getPlacementPlan);
  const fetchAnalytics = useServerFn(getPlacementPlanAnalytics);
  const generate = useServerFn(generatePlacementPlan);
  const saveChecklist = useServerFn(setPlanChecklist);
  const duplicate = useServerFn(duplicatePlacementPlan);
  const [busy, setBusy] = useState(false);

  const { data, isLoading } = useQuery({
    queryKey: ["placement-plan", id],
    queryFn: async () => await fetchPlan({ data: { id } }),
  });

  const { data: analytics } = useQuery({
    queryKey: ["placement-plan-analytics", id],
    queryFn: async () => await fetchAnalytics({ data: { id } }),
    enabled: !!data,
  });

  if (isLoading || !data) {
    return (
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <Loader2 className="h-4 w-4 animate-spin" /> Loading plan…
      </div>
    );
  }

  const { plan, items, business, plan_tier } = data;
  const pending = items.filter((i) => !i.qr_code_id);
  const done = plan.checklist.filter((c) => c.done).length;
  const progress = plan.checklist.length ? Math.round((done / plan.checklist.length) * 100) : 0;

  async function runGenerate(itemIds?: string[]) {
    setBusy(true);
    try {
      const res = await generate({ data: itemIds ? { id, itemIds } : { id } });
      if (res.failures.length) {
        toast.warning(`${res.generated} created · ${res.failures.length} need attention`);
      } else {
        toast.success(`${res.generated} QR codes created`);
      }
      void qc.invalidateQueries({ queryKey: ["placement-plan", id] });
      void qc.invalidateQueries({ queryKey: ["placement-plan-analytics", id] });
    } catch (e) {
      toast.error(friendlyMutationError(e, "Could not generate this plan"));
    } finally {
      setBusy(false);
    }
  }

  async function toggleChecklist(key: string, value: boolean) {
    const next = plan.checklist.map((c) => (c.key === key ? { ...c, done: value } : c));
    qc.setQueryData(["placement-plan", id], { ...data, plan: { ...plan, checklist: next } });
    try {
      await saveChecklist({ data: { id, checklist: next } });
    } catch (e) {
      toast.error(friendlyMutationError(e, "Could not save the checklist"));
      void qc.invalidateQueries({ queryKey: ["placement-plan", id] });
    }
  }

  async function onDuplicate() {
    try {
      await duplicate({ data: { id } });
      toast.success("Plan duplicated as a new draft");
    } catch (e) {
      toast.error(friendlyMutationError(e, "Could not duplicate the plan"));
    }
  }

  const analyticsByKey = new Map((analytics ?? []).map((a) => [a.placementKey, a]));

  return (
    <div className="animate-fade-in-up space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <Button asChild variant="ghost" size="sm" className="-ml-2 mb-1 rounded-xl">
            <Link to="/placement-plans">
              <ArrowLeft className="mr-1.5 h-4 w-4" /> All plans
            </Link>
          </Button>
          <h1 className="truncate text-2xl font-semibold tracking-tight">{plan.name}</h1>
          <p className="text-sm text-muted-foreground">
            {business?.name ?? "Business"} · {industryLabel(plan.industry)} ·{" "}
            {plan.goals.map(goalLabel).join(", ")}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" className="rounded-xl" onClick={onDuplicate}>
            <Copy className="mr-1.5 h-4 w-4" /> Duplicate
          </Button>
          {plan.marketing_pack_id && (
            <Button asChild variant="outline" className="rounded-xl">
              <Link to="/marketing-packs/$id" params={{ id: plan.marketing_pack_id }}>
                Open marketing pack
              </Link>
            </Button>
          )}
          {pending.length > 0 && (
            <Button className="rounded-xl" disabled={busy} onClick={() => runGenerate()}>
              {busy ? (
                <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />
              ) : (
                <Sparkles className="mr-1.5 h-4 w-4" />
              )}
              Generate {pending.length} remaining
            </Button>
          )}
        </div>
      </div>

      {plan_tier === "free" && pending.length > 0 && (
        <Card className="rounded-3xl border-primary/30 bg-primary/5">
          <CardContent className="flex flex-wrap items-center justify-between gap-3 p-5 text-sm">
            <div>
              <p className="font-medium">Your free plan includes one QR code.</p>
              <p className="text-muted-foreground">
                Upgrade to Pro to generate every placement in this plan.
              </p>
            </div>
            <Button asChild className="rounded-xl">
              <Link to="/plans">See Pro pricing</Link>
            </Button>
          </CardContent>
        </Card>
      )}

      <Card className="rounded-3xl border-border/70 shadow-[var(--shadow-card)]">
        <CardContent className="space-y-4 p-6">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h2 className="text-sm font-semibold">Placements</h2>
            <span className="text-xs text-muted-foreground">
              {items.length - pending.length}/{items.length} generated
            </span>
          </div>
          <div className="space-y-2">
            {items.map((item) => (
              <PlacementRow
                key={item.id}
                item={item}
                stats={analyticsByKey.get(item.placement_key)}
                busy={busy}
                onGenerate={() => runGenerate([item.id])}
              />
            ))}
          </div>
        </CardContent>
      </Card>

      {plan.checklist.length > 0 && (
        <Card className="rounded-3xl border-border/70 shadow-[var(--shadow-card)]">
          <CardContent className="space-y-4 p-6">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h2 className="text-sm font-semibold">Rollout checklist</h2>
              <span className="text-xs text-muted-foreground">{progress}% complete</span>
            </div>
            <Progress value={progress} className="h-1.5" />
            <Separator />
            <div className="space-y-2">
              {plan.checklist.map((c) => (
                <label key={c.key} className="flex items-start gap-3 text-sm">
                  <Checkbox
                    checked={c.done}
                    onCheckedChange={(v) => toggleChecklist(c.key, v === true)}
                    className="mt-0.5"
                  />
                  <span className={c.done ? "text-muted-foreground line-through" : ""}>
                    {c.label}
                  </span>
                </label>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

function PlacementRow({
  item,
  stats,
  busy,
  onGenerate,
}: {
  item: PlanItemRow;
  stats?: { scans: number; destinationClicks: number; conversionRate: number };
  busy: boolean;
  onGenerate: () => void;
}) {
  const variant =
    item.priority === "high" ? "default" : item.priority === "medium" ? "secondary" : "outline";
  return (
    <div className="flex flex-wrap items-start justify-between gap-3 rounded-2xl border border-border/70 p-4">
      <div className="min-w-0">
        <div className="flex flex-wrap items-center gap-2">
          <p className="text-sm font-medium">{item.placement_name}</p>
          <Badge variant={variant}>{item.priority as PriorityKey} priority</Badge>
          {item.qr_code_id ? (
            <Badge variant="outline">QR created</Badge>
          ) : (
            <Badge variant="outline">Not generated</Badge>
          )}
        </div>
        <p className="mt-1 text-xs text-muted-foreground">
          {item.material ?? item.recommended_format_id} · {item.cta_text ?? "Scan to review"}
        </p>
        {item.failure_reason && (
          <p className="mt-1 text-xs text-destructive">{item.failure_reason}</p>
        )}
        {item.qr_code_id && stats && (
          <p className="mt-1 flex items-center gap-1.5 text-xs text-muted-foreground">
            <BarChart3 className="h-3.5 w-3.5" />
            {stats.scans} scans · {stats.destinationClicks} clicks · {stats.conversionRate}%
          </p>
        )}
      </div>
      <div className="flex gap-1.5">
        {item.qr_code_id ? (
          <Button asChild size="sm" variant="outline" className="rounded-xl">
            <Link to="/qr/$id" params={{ id: item.qr_code_id }}>
              <QrCode className="mr-1.5 h-3.5 w-3.5" /> Open QR
              <ExternalLink className="ml-1.5 h-3 w-3" />
            </Link>
          </Button>
        ) : (
          <Button
            size="sm"
            variant="outline"
            className="rounded-xl"
            disabled={busy}
            onClick={onGenerate}
          >
            Generate
          </Button>
        )}
      </div>
    </div>
  );
}
