import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Loader2, MapPin, Plus, Copy, Archive } from "lucide-react";
import { toast } from "sonner";
import {
  listMyPlacementPlans,
  duplicatePlacementPlan,
  archivePlacementPlan,
  type PlanStatus,
} from "@/lib/placement-plans.functions";
import { goalLabel, industryLabel } from "@/lib/placement-recommendations";
import { friendlyMutationError } from "@/lib/plan-errors";

export const Route = createFileRoute("/_authenticated/placement-plans/")({
  component: PlacementPlansPage,
});

const STATUS_LABEL: Record<PlanStatus, string> = {
  draft: "Draft",
  ready: "Ready",
  generating: "Generating",
  generated: "Generated",
  partially_generated: "Partly generated",
  archived: "Archived",
};

function PlacementPlansPage() {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const list = useServerFn(listMyPlacementPlans);
  const duplicate = useServerFn(duplicatePlacementPlan);
  const archive = useServerFn(archivePlacementPlan);

  const { data, isLoading } = useQuery({
    queryKey: ["placement-plans"],
    queryFn: async () => await list(),
  });

  const plans = data ?? [];

  async function onDuplicate(id: string) {
    try {
      const res = await duplicate({ data: { id } });
      toast.success("Plan duplicated");
      navigate({ to: "/placement-plans/$id", params: { id: res.id } });
    } catch (e) {
      toast.error(friendlyMutationError(e, "Could not duplicate the plan"));
    }
  }

  async function onArchive(id: string) {
    try {
      await archive({ data: { id } });
      toast.success("Plan archived");
      void qc.invalidateQueries({ queryKey: ["placement-plans"] });
    } catch (e) {
      toast.error(friendlyMutationError(e, "Could not archive the plan"));
    }
  }

  return (
    <div className="animate-fade-in-up space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Placement plans</h1>
          <p className="text-sm text-muted-foreground">
            Every QR placement plan you've built, with rollout progress.
          </p>
        </div>
        <Button asChild className="rounded-xl">
          <Link to="/placement-wizard">
            <Plus className="mr-1.5 h-4 w-4" /> New plan
          </Link>
        </Button>
      </div>

      {isLoading ? (
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" /> Loading plans…
        </div>
      ) : plans.length === 0 ? (
        <Card className="rounded-3xl border-dashed">
          <CardContent className="space-y-3 p-10 text-center">
            <MapPin className="mx-auto h-8 w-8 text-muted-foreground" />
            <p className="text-sm font-medium">No placement plans yet</p>
            <p className="text-sm text-muted-foreground">
              Answer three quick questions and we'll map out exactly where your QR codes should go.
            </p>
            <Button asChild className="rounded-xl">
              <Link to="/placement-wizard">Start the Placement Wizard</Link>
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-3 md:grid-cols-2">
          {plans.map((p) => (
            <Card key={p.id} className="rounded-3xl border-border/70 shadow-[var(--shadow-card)]">
              <CardContent className="space-y-3 p-5">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <Link
                      to="/placement-plans/$id"
                      params={{ id: p.id }}
                      className="truncate text-sm font-semibold hover:underline"
                    >
                      {p.name}
                    </Link>
                    <p className="truncate text-xs text-muted-foreground">
                      {p.businessName} · {industryLabel(p.industry)}
                    </p>
                  </div>
                  <Badge variant={p.status === "generated" ? "default" : "secondary"}>
                    {STATUS_LABEL[p.status] ?? p.status}
                  </Badge>
                </div>

                <div className="flex flex-wrap gap-1.5">
                  {p.goals.map((g) => (
                    <Badge key={g} variant="outline">
                      {goalLabel(g)}
                    </Badge>
                  ))}
                </div>

                <div className="space-y-1.5">
                  <div className="flex items-center justify-between text-xs text-muted-foreground">
                    <span>
                      {p.generatedCount}/{p.itemCount} placements generated
                    </span>
                    <span>{p.checklistProgress}% rolled out</span>
                  </div>
                  <Progress value={p.checklistProgress} className="h-1.5" />
                </div>

                <div className="flex flex-wrap gap-2 pt-1">
                  <Button asChild size="sm" variant="outline" className="rounded-xl">
                    <Link to="/placement-plans/$id" params={{ id: p.id }}>
                      Open
                    </Link>
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    className="rounded-xl"
                    onClick={() => onDuplicate(p.id)}
                  >
                    <Copy className="mr-1.5 h-3.5 w-3.5" /> Duplicate
                  </Button>
                  {p.status !== "archived" && (
                    <Button
                      size="sm"
                      variant="ghost"
                      className="rounded-xl"
                      onClick={() => onArchive(p.id)}
                    >
                      <Archive className="mr-1.5 h-3.5 w-3.5" /> Archive
                    </Button>
                  )}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
