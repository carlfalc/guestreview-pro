import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Loader2, Plus, FileText, HeartPulse } from "lucide-react";
import { toast } from "sonner";
import { OnboardingChecklist } from "@/components/onboarding/OnboardingChecklist";
import { FounderBadge } from "@/components/founder/FounderBadge";
import { FounderWelcomeCard } from "@/components/founder/FounderWelcomeCard";

import { FinishUpgradeCard } from "@/components/billing/FinishUpgradeCard";
import {
  BreakdownList,
  DimensionCard,
  MetricCard,
  RecommendationCard,
  ScoreHeadline,
} from "@/components/executive/executive-ui";
import { getExecutiveOverview, setRecommendationAction } from "@/lib/executive.functions";
import { PERIOD_OPTIONS } from "@/lib/executive";
import { AiInsightCard } from "@/components/insights/AiInsightCard";

export const Route = createFileRoute("/_authenticated/dashboard")({
  component: Dashboard,
  head: () => ({
    meta: [
      { title: "Executive dashboard · GuestReview Pro" },
      {
        name: "description",
        content:
          "Your weekly reputation overview: Reputation Health, customer activity, engagement and the actions worth doing next.",
      },
    ],
  }),
});

function Dashboard() {
  const [businessId, setBusinessId] = useState<string | null>(null);
  const [periodDays, setPeriodDays] = useState<number>(7);
  const getOverview = useServerFn(getExecutiveOverview);
  const saveAction = useServerFn(setRecommendationAction);
  const queryClient = useQueryClient();

  const { data, isLoading } = useQuery({
    queryKey: ["executive-overview", businessId, periodDays],
    queryFn: async () =>
      await getOverview({ data: { businessId: businessId ?? undefined, periodDays } }),
  });

  const action = useMutation({
    mutationFn: async (vars: { key: string; action: string }) => {
      if (!data?.business) throw new Error("No business selected");
      return await saveAction({
        data: { businessId: data.business.id, key: vars.key, action: vars.action },
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["executive-overview"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const label = (k: string) => data?.labels[k] ?? k;

  return (
    <div className="animate-fade-in-up space-y-8">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-3xl font-semibold tracking-tight">
            {data?.business?.name ?? "Your business"}
          </h1>
          <div className="mt-2">
            <FounderBadge />
          </div>
          <p className="mt-1 text-sm text-muted-foreground">
            Where your reputation stands, what changed, and what to do next.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link to="/reports">
            <Button variant="outline" className="rounded-full">
              <FileText className="mr-1 h-4 w-4" /> Weekly report
            </Button>
          </Link>
          <Link to="/businesses">
            <Button className="rounded-full">
              <Plus className="mr-1 h-4 w-4" /> New business
            </Button>
          </Link>
        </div>
      </div>

      <FounderWelcomeCard />
      <FinishUpgradeCard />
      <OnboardingChecklist />

      <div className="flex flex-wrap items-center gap-2">
        {(data?.businesses.length ?? 0) > 1 &&
          data!.businesses.map((b) => (
            <Button
              key={b.id}
              size="sm"
              variant={(businessId ?? data!.business?.id) === b.id ? "default" : "outline"}
              className="rounded-xl"
              onClick={() => setBusinessId(b.id)}
            >
              {b.name}
            </Button>
          ))}
        <div className="ml-auto flex gap-1.5">
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
        </div>
      </div>

      {isLoading || !data ? (
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" /> Preparing your overview…
        </div>
      ) : !data.business ? (
        <Card className="rounded-3xl border-border/70">
          <CardContent className="space-y-3 p-6">
            <p className="text-sm font-semibold">Let's get your first business set up</p>
            <p className="text-sm text-muted-foreground">
              Add a business and we'll start tracking its reputation health straight away.
            </p>
            <Link to="/businesses">
              <Button className="rounded-full">Add a business</Button>
            </Link>
          </CardContent>
        </Card>
      ) : (
        <>
          <ScoreHeadline
            score={data.health.overall}
            rating={data.rating}
            trend={data.trend}
            confidence={data.confidence}
            confidenceNote={data.confidenceNote}
            headline={data.health.headline}
            message={data.health.message}
            lastUpdated={data.lastUpdated}
          />

          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <MetricCard
              label="Scans"
              value={String(data.snapshot.current.scans)}
              trend={data.snapshot.scanTrend}
              note={`Last ${data.snapshot.periodDays} days`}
            />
            <MetricCard
              label="Review clicks"
              value={String(data.snapshot.current.clicks)}
              trend={data.snapshot.clickTrend}
            />
            <MetricCard
              label="Engagement"
              value={
                data.snapshot.current.clickRate === null
                  ? "Not enough data yet"
                  : `${data.snapshot.current.clickRate}%`
              }
              trend={data.snapshot.clickRateTrend}
              note="People who went on to your review page"
            />
            <MetricCard
              label="Rollout"
              value={
                data.snapshot.rolloutCompletion === null
                  ? "No plan yet"
                  : `${data.snapshot.rolloutCompletion}%`
              }
              note={`${data.snapshot.activePlacementPlans} active placement plan(s)`}
            />
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <Card className="rounded-3xl border-border/70">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm">What's working</CardTitle>
              </CardHeader>
              <CardContent className="text-sm text-muted-foreground">
                {data.snapshot.bestPlacement
                  ? `${label(data.snapshot.bestPlacement.key)} — ${data.snapshot.bestPlacement.scans} scans${
                      data.snapshot.bestPlacement.clickRate !== null
                        ? `, ${data.snapshot.bestPlacement.clickRate}% engagement`
                        : ""
                    }.`
                  : "We'll highlight your strongest spot as soon as scans come in."}
              </CardContent>
            </Card>
            <Card className="rounded-3xl border-border/70">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm">Biggest opportunity</CardTitle>
              </CardHeader>
              <CardContent className="text-sm text-muted-foreground">
                {data.snapshot.weakestPlacement
                  ? `${label(data.snapshot.weakestPlacement.key)} is engaging fewest customers at ${data.snapshot.weakestPlacement.clickRate}%.`
                  : (data.recommendations.find((r) => r.status === "open")?.title ??
                    "Nothing needs attention right now.")}
              </CardContent>
            </Card>
          </div>

          <AiInsightCard
            businessId={data.business.id}
            businessName={data.business.name}
            businesses={data.businesses}
            periodDays={periodDays}
            onSelectBusiness={setBusinessId}
            onRecommendationComplete={(title) => {
              const match = data.recommendations.find(
                (r) => r.title.toLowerCase() === title.toLowerCase() && r.status === "open",
              );
              if (match) action.mutate({ key: match.key, action: "completed" });
              else toast.message("Marked as noted — this action isn't tracked in your checklist.");
            }}
          />

          <section className="space-y-3">
            <div className="flex items-center gap-2">
              <HeartPulse className="h-4 w-4 text-muted-foreground" />
              <h2 className="text-lg font-semibold tracking-tight">Reputation Health™</h2>
            </div>
            <div className="grid gap-3 md:grid-cols-2">
              {data.health.dimensions.map((d) => (
                <DimensionCard key={d.key} dimension={d} />
              ))}
            </div>
          </section>

          <section className="space-y-3">
            <h2 className="text-lg font-semibold tracking-tight">What to do next</h2>
            {data.recommendations.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                Nothing outstanding — your setup looks healthy.
              </p>
            ) : (
              <div className="grid gap-3 md:grid-cols-2">
                {data.recommendations.map((r) => (
                  <RecommendationCard
                    key={r.key}
                    rec={r}
                    busy={action.isPending}
                    onAction={(a) => action.mutate({ key: r.key, action: a })}
                  />
                ))}
              </div>
            )}
          </section>

          <section className="grid gap-3 md:grid-cols-2">
            <BreakdownList title="By placement" rows={data.health.byPlacement} label={label} />
            <BreakdownList title="By business goal" rows={data.health.byGoal} label={label} />
            <BreakdownList title="By campaign" rows={data.health.byCampaign} label={label} />
            <BreakdownList title="By location" rows={data.health.byLocation} label={label} />
          </section>
        </>
      )}
    </div>
  );
}
