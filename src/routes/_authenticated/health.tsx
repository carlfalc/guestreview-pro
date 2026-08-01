import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Button } from "@/components/ui/button";
import { Loader2, CheckCircle2, CircleAlert, Circle, HeartPulse } from "lucide-react";
import {
  getReviewHealthScore,
  listHealthBusinesses,
} from "@/lib/health-score.functions";
import type { DimensionBreakdown, DimensionResult } from "@/lib/health-score";

export const Route = createFileRoute("/_authenticated/health")({
  component: HealthPage,
});

function stateBadge(d: DimensionResult) {
  if (d.state === "insufficient_data") return <Badge variant="outline">Not enough data yet</Badge>;
  if (d.state === "good") return <Badge>Healthy</Badge>;
  if (d.state === "fair") return <Badge variant="secondary">Improving</Badge>;
  return <Badge variant="secondary">Needs attention</Badge>;
}

function BreakdownTable({ title, rows }: { title: string; rows: DimensionBreakdown[] }) {
  if (rows.length === 0) return null;
  return (
    <Card className="rounded-3xl border-border/70 shadow-[var(--shadow-card)]">
      <CardHeader className="pb-2">
        <CardTitle className="text-sm">{title}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-2">
        {rows.map((r) => (
          <div key={r.key} className="flex items-center justify-between gap-3 text-sm">
            <span className="truncate">{r.label}</span>
            <span className="shrink-0 text-muted-foreground">
              {r.scans} scans ·{" "}
              {r.clickRate === null ? "not enough data yet" : `${r.clickRate}% click-through`}
            </span>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}

function HealthPage() {
  const [businessId, setBusinessId] = useState<string | null>(null);
  const listBusinesses = useServerFn(listHealthBusinesses);
  const getScore = useServerFn(getReviewHealthScore);

  const { data: businesses } = useQuery({
    queryKey: ["health-businesses"],
    queryFn: async () => await listBusinesses(),
  });

  const { data, isLoading } = useQuery({
    queryKey: ["review-health", businessId],
    queryFn: async () => await getScore({ data: { businessId: businessId ?? undefined } }),
  });

  return (
    <div className="animate-fade-in-up space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Reputation Health™</h1>
        <p className="text-sm text-muted-foreground">
          Measured from real scan events across your placements, goals, campaigns and locations.
        </p>
      </div>

      {(businesses?.length ?? 0) > 1 && (
        <div className="flex flex-wrap gap-2">
          {businesses!.map((b) => (
            <Button
              key={b.id}
              size="sm"
              variant={businessId === b.id ? "default" : "outline"}
              className="rounded-xl"
              onClick={() => setBusinessId(b.id)}
            >
              {b.name}
            </Button>
          ))}
        </div>
      )}

      {isLoading || !data ? (
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" /> Calculating health…
        </div>
      ) : (
        <>
          <Card className="rounded-3xl border-border/70 shadow-[var(--shadow-card)]">
            <CardContent className="flex flex-wrap items-center gap-5 p-6">
              <div className="flex h-20 w-20 shrink-0 items-center justify-center rounded-2xl bg-muted">
                {data.overall === null ? (
                  <HeartPulse className="h-8 w-8 text-muted-foreground" />
                ) : (
                  <span className="text-2xl font-semibold">{data.overall}</span>
                )}
              </div>
              <div className="min-w-0 space-y-1">
                <p className="text-lg font-semibold">{data.headline}</p>
                <p className="text-sm text-muted-foreground">{data.message}</p>
              </div>
            </CardContent>
          </Card>

          <Card className="rounded-3xl border-border/70">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm">Before we can score performance</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {data.preconditions.map((p) => (
                <div key={p.key} className="flex items-start gap-2 text-sm">
                  {p.passed ? (
                    <CheckCircle2 className="mt-0.5 h-4 w-4 text-primary" />
                  ) : p.blocking ? (
                    <CircleAlert className="mt-0.5 h-4 w-4 text-muted-foreground" />
                  ) : (
                    <Circle className="mt-0.5 h-4 w-4 text-muted-foreground" />
                  )}
                  <div className="min-w-0">
                    <p className="font-medium">{p.label}</p>
                    <p className="text-xs text-muted-foreground">{p.note}</p>
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>

          <div className="grid gap-3 md:grid-cols-2">
            {data.dimensions.map((d) => (
              <Card key={d.key} className="rounded-3xl border-border/70">
                <CardContent className="space-y-2 p-5">
                  <div className="flex items-center justify-between gap-3">
                    <p className="text-sm font-semibold">{d.label}</p>
                    {stateBadge(d)}
                  </div>
                  {d.score !== null && <Progress value={d.score} className="h-1.5" />}
                  <p className="text-xs text-muted-foreground">{d.summary}</p>
                  {d.details.map((line) => (
                    <p key={line} className="text-xs text-muted-foreground">
                      · {line}
                    </p>
                  ))}
                </CardContent>
              </Card>
            ))}
          </div>

          <div className="grid gap-3 md:grid-cols-2">
            <BreakdownTable title="By placement" rows={data.byPlacement} />
            <BreakdownTable title="By business goal" rows={data.byGoal} />
            <BreakdownTable title="By campaign" rows={data.byCampaign} />
            <BreakdownTable title="By location" rows={data.byLocation} />
            <BreakdownTable title="By placement plan" rows={data.byPlan} />
            <BreakdownTable title="By plan placement" rows={data.byPlanItem} />
          </div>
        </>
      )}
    </div>
  );
}
