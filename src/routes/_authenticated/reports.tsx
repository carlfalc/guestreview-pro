import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Loader2, Printer, Sparkles } from "lucide-react";
import { getExecutiveOverview } from "@/lib/executive.functions";
import { PERIOD_OPTIONS } from "@/lib/executive";
import { RatingBadge, TrendPill } from "@/components/executive/executive-ui";
import { listWeeklyInsights } from "@/lib/ai-insights.functions";
import { cardStateFor, AI_DISCLAIMER } from "@/lib/ai-insights";
import { formatGeneratedDate } from "@/lib/ai-insight-view";

export const Route = createFileRoute("/_authenticated/reports")({
  component: ReportsPage,
  head: () => ({
    meta: [
      { title: "Weekly report · GuestReview Pro" },
      {
        name: "description",
        content:
          "A printable weekly business report covering Reputation Health, activity, engagement and recommended actions.",
      },
    ],
  }),
});

function ReportsPage() {
  const [periodDays, setPeriodDays] = useState<number>(7);
  const getOverview = useServerFn(getExecutiveOverview);

  const { data, isLoading } = useQuery({
    queryKey: ["executive-report", periodDays],
    queryFn: async () => await getOverview({ data: { periodDays } }),
  });

  const fetchInsights = useServerFn(listWeeklyInsights);
  const businessId = data?.business?.id ?? null;
  const { data: insights } = useQuery({
    queryKey: ["insight-list", businessId],
    enabled: Boolean(businessId),
    queryFn: async () => await fetchInsights({ data: { businessId: businessId ?? undefined } }),
  });
  const insight = (insights ?? []).find(
    (i) => i.status === "completed" && i.output && cardStateFor(i) !== "stale",
  );

  const label = (k: string) => data?.labels[k] ?? k;

  return (
    <div className="animate-fade-in-up space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3 print:hidden">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Weekly business report</h1>
          <p className="text-sm text-muted-foreground">
            A shareable summary you can print or save as a PDF.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          {PERIOD_OPTIONS.map((p) => (
            <Button
              key={p}
              size="sm"
              variant={periodDays === p ? "default" : "outline"}
              className="rounded-xl"
              onClick={() => setPeriodDays(p)}
            >
              {p} days
            </Button>
          ))}
          <Button className="rounded-full" onClick={() => window.print()}>
            <Printer className="mr-1 h-4 w-4" /> Print / save as PDF
          </Button>
        </div>
      </div>

      {isLoading || !data ? (
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" /> Building your report…
        </div>
      ) : !data.business ? (
        <p className="text-sm text-muted-foreground">Add a business to generate a report.</p>
      ) : (
        <div className="space-y-5">
          <Card className="rounded-3xl border-border/70">
            <CardContent className="space-y-3 p-6">
              <div className="flex flex-wrap items-center gap-2">
                <h2 className="text-xl font-semibold tracking-tight">{data.business.name}</h2>
                <RatingBadge rating={data.rating} />
                <TrendPill trend={data.trend} />
              </div>
              <p className="text-sm text-muted-foreground">
                Reputation Health™: {data.health.overall ?? "not enough data yet"} ·{" "}
                {data.snapshot.periodDays}-day view · confidence {data.confidence}
              </p>
              <p className="text-sm">{data.health.message}</p>
            </CardContent>
          </Card>

          <Card className="rounded-3xl border-border/70">
            <CardHeader className="pb-2">
              <CardTitle className="flex items-center gap-2 text-sm">
                <Sparkles className="h-4 w-4 text-primary" aria-hidden /> AI Executive Summary
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {!insight || !insight.output ? (
                <div className="space-y-2">
                  <p className="text-sm text-muted-foreground">
                    No AI summary has been written for this period yet.
                  </p>
                  <Button asChild variant="outline" className="rounded-full print:hidden">
                    <Link to="/dashboard">Generate one from your dashboard</Link>
                  </Button>
                </div>
              ) : (
                <>
                  <div className="space-y-1">
                    <p className="text-base font-semibold tracking-tight">
                      {insight.output.headline}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      Generated {formatGeneratedDate(insight.generatedAt)}
                    </p>
                  </div>
                  <div className="space-y-2 text-sm text-muted-foreground">
                    {insight.output.executiveSummary
                      .split(/\n{1,2}/)
                      .filter(Boolean)
                      .map((p, i) => (
                        <p key={i}>{p}</p>
                      ))}
                  </div>
                  <div className="grid gap-3 md:grid-cols-2">
                    <div className="rounded-2xl bg-muted/60 p-4">
                      <p className="text-xs uppercase tracking-wide text-muted-foreground">
                        Top win
                      </p>
                      <p className="mt-1 text-sm font-medium">{insight.output.topWin.title}</p>
                      <p className="mt-1 text-xs text-muted-foreground">
                        {insight.output.topWin.explanation}
                      </p>
                    </div>
                    <div className="rounded-2xl bg-muted/60 p-4">
                      <p className="text-xs uppercase tracking-wide text-muted-foreground">
                        Main opportunity
                      </p>
                      <p className="mt-1 text-sm font-medium">
                        {insight.output.mainOpportunity.title}
                      </p>
                      <p className="mt-1 text-xs text-muted-foreground">
                        {insight.output.mainOpportunity.explanation}
                      </p>
                    </div>
                  </div>
                  {insight.output.recommendedActions.length > 0 && (
                    <div className="space-y-2">
                      <p className="text-sm font-semibold">Recommended actions</p>
                      {insight.output.recommendedActions.slice(0, 3).map((a) => (
                        <div
                          key={a.title}
                          className="space-y-1 border-b border-border/50 pb-2 last:border-0"
                        >
                          <div className="flex flex-wrap items-center gap-2">
                            <p className="text-sm font-medium">{a.title}</p>
                            <Badge variant="outline">Impact: {a.expectedImpact}</Badge>
                            <Badge variant="outline">Effort: {a.effort}</Badge>
                          </div>
                          <p className="text-xs text-muted-foreground">{a.reason}</p>
                        </div>
                      ))}
                    </div>
                  )}
                  <p className="text-xs text-muted-foreground">
                    {insight.output.confidenceDisclaimer}
                  </p>
                </>
              )}
              <p className="text-xs text-muted-foreground">{AI_DISCLAIMER}</p>
            </CardContent>
          </Card>

          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {data.email.kpis.map((k) => (
              <Card key={k.label} className="rounded-2xl border-border/70">
                <CardContent className="p-5">
                  <p className="text-xs uppercase tracking-wide text-muted-foreground">{k.label}</p>
                  <p className="mt-1 text-xl font-semibold">{k.value}</p>
                </CardContent>
              </Card>
            ))}
          </div>

          <Card className="rounded-3xl border-border/70">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm">Highlights</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 text-sm text-muted-foreground">
              <p>{data.email.topSuccess}</p>
              <p>{data.email.biggestOpportunity}</p>
            </CardContent>
          </Card>

          <Card className="rounded-3xl border-border/70">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm">Recommended actions</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {data.recommendations.filter((r) => r.status === "open").length === 0 ? (
                <p className="text-sm text-muted-foreground">Nothing outstanding this period.</p>
              ) : (
                data.recommendations
                  .filter((r) => r.status === "open")
                  .map((r) => (
                    <div
                      key={r.key}
                      className="space-y-1 border-b border-border/50 pb-2 last:border-0"
                    >
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="text-sm font-medium">{r.title}</p>
                        <Badge variant="outline">Impact: {r.impact}</Badge>
                        <Badge variant="outline">Effort: {r.effort}</Badge>
                      </div>
                      <p className="text-xs text-muted-foreground">{r.action}</p>
                    </div>
                  ))
              )}
            </CardContent>
          </Card>

          <Card className="rounded-3xl border-border/70">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm">Placement performance</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {data.health.byPlacement.length === 0 ? (
                <p className="text-sm text-muted-foreground">No placement activity yet.</p>
              ) : (
                data.health.byPlacement.map((r) => (
                  <div key={r.key} className="flex items-center justify-between gap-3 text-sm">
                    <span className="truncate">{label(r.key)}</span>
                    <span className="shrink-0 text-muted-foreground">
                      {r.scans} scans ·{" "}
                      {r.clickRate === null ? "not enough data yet" : `${r.clickRate}% engagement`}
                    </span>
                  </div>
                ))
              )}
            </CardContent>
          </Card>

          <Card className="rounded-3xl border-border/70 print:hidden">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm">Weekly email preview</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 text-sm">
              <p className="font-medium">{data.email.subject}</p>
              <p className="text-muted-foreground">
                Score {data.email.score ?? "—"} · {data.email.trendLabel}
              </p>
              <ul className="list-disc space-y-1 pl-5 text-muted-foreground">
                {data.email.actions.map((a) => (
                  <li key={a}>{a}</li>
                ))}
              </ul>
              <p className="text-xs text-muted-foreground">
                Preview only — weekly emails are not sent yet.
              </p>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}
