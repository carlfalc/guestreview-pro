// AI Weekly Insights card.
//
// Narrates the verified Reputation Health™ figures — it never recalculates a
// score, and never surfaces provider names, model IDs or raw responses.
import { useState } from "react";
import { Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import {
  Copy,
  Loader2,
  RefreshCw,
  Sparkles,
  ThumbsDown,
  ThumbsUp,
  Check,
  FileText,
} from "lucide-react";
import {
  generateWeeklyInsight,
  getInsightAccess,
  listWeeklyInsights,
  submitInsightFeedback,
  type StoredInsight,
} from "@/lib/ai-insights.functions";
import { insightToPlainText } from "@/lib/ai-insights";
import {
  AI_DISCLAIMER,
  FEEDBACK_REASONS,
  PAYWALL_BODY,
  PAYWALL_TITLE,
  allowanceLabel,
  canGenerateNow,
  canSelectBusiness,
  customerFacingError,
  formatGeneratedDate,
  freshnessLabel,
  resolveCardState,
  shouldSubmitFeedback,
  upgradePlanFor,
  type FeedbackReasonKey,
} from "@/lib/ai-insight-view";
import { useAccountRegion } from "@/hooks/use-account-region";
import { RegionalPrice } from "@/components/billing/RegionalPrice";
import { InsightHistoryPanel } from "@/components/insights/InsightHistoryPanel";

export function AiInsightCard({
  businessId,
  businessName,
  businesses,
  periodDays,
  onSelectBusiness,
  onRecommendationComplete,
}: {
  businessId: string | null;
  businessName: string;
  businesses: Array<{ id: string; name: string }>;
  periodDays: number;
  onSelectBusiness?: (id: string) => void;
  onRecommendationComplete?: (title: string) => void;
}) {
  const queryClient = useQueryClient();
  const fetchAccess = useServerFn(getInsightAccess);
  const fetchList = useServerFn(listWeeklyInsights);
  const generate = useServerFn(generateWeeklyInsight);
  const sendFeedback = useServerFn(submitInsightFeedback);
  const { data: region } = useAccountRegion();

  const [notice, setNotice] = useState<string | null>(null);
  const [showReasons, setShowReasons] = useState(false);
  const [openId, setOpenId] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const accessQuery = useQuery({
    queryKey: ["insight-access", businessId],
    queryFn: async () => await fetchAccess({ data: { businessId: businessId ?? undefined } }),
  });

  const listQuery = useQuery({
    queryKey: ["insight-list", businessId],
    enabled: Boolean(businessId),
    queryFn: async () => await fetchList({ data: { businessId: businessId ?? undefined } }),
  });

  const insights = listQuery.data ?? [];
  const latest: StoredInsight | null =
    (openId ? (insights.find((i) => i.id === openId) ?? null) : null) ?? insights[0] ?? null;
  const access = accessQuery.data ?? null;

  const loading = accessQuery.isLoading || (Boolean(businessId) && listQuery.isLoading);
  const state = resolveCardState({
    loading,
    hasBusiness: Boolean(businessId),
    access,
    insight: latest,
  });

  const generation = useMutation({
    mutationFn: async () => {
      if (!businessId) throw new Error("no_business");
      return await generate({ data: { businessId, periodDays } });
    },
    onSuccess: async (result) => {
      if (result.ok) {
        setNotice(null);
        setOpenId(null);
      } else {
        setNotice(customerFacingError(result.code, result.message));
      }
      await queryClient.invalidateQueries({ queryKey: ["insight-list", businessId] });
      await queryClient.invalidateQueries({ queryKey: ["insight-access", businessId] });
    },
    onError: () => setNotice(customerFacingError("network")),
  });

  const feedback = useMutation({
    mutationFn: async (vars: { helpful: boolean; reason: FeedbackReasonKey | null }) => {
      if (!latest) throw new Error("no_insight");
      if (!shouldSubmitFeedback(latest.feedback, { helpful: vars.helpful, reason: vars.reason })) {
        return { skipped: true } as const;
      }
      await sendFeedback({
        data: { insightId: latest.id, helpful: vars.helpful, reason: vars.reason ?? undefined },
      });
      return { skipped: false } as const;
    },
    onSuccess: async (r) => {
      if (!r.skipped) {
        toast.success("Thanks — that helps us improve your summaries.");
        await queryClient.invalidateQueries({ queryKey: ["insight-list", businessId] });
      }
      setShowReasons(false);
    },
    onError: () => toast.error("We couldn't record that just now. Please try again."),
  });

  async function copySummary() {
    if (!latest?.output) return;
    try {
      await navigator.clipboard.writeText(insightToPlainText(latest.output, businessName));
      setCopied(true);
      toast.success("Summary copied");
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error("Your browser blocked copying. Select the text and copy it manually.");
    }
  }

  /* ---------------------------------------------------------------- states */

  if (state === "loading") {
    return (
      <Card className="rounded-3xl border-border/70">
        <CardContent className="flex items-center gap-2 p-6 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
          <span role="status" aria-live="polite">
            Checking your AI Weekly Insights…
          </span>
        </CardContent>
      </Card>
    );
  }

  if (state === "no_business") {
    return null;
  }

  if (state === "no_access") {
    const plan = upgradePlanFor(access?.plan ?? "free");
    return (
      <Card className="rounded-3xl border-primary/30 bg-primary/5">
        <CardContent className="space-y-3 p-6">
          <div className="flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-primary" aria-hidden />
            <p className="font-medium">{PAYWALL_TITLE}</p>
          </div>
          <p className="text-sm text-muted-foreground">{PAYWALL_BODY}</p>
          <p className="text-sm">
            From <RegionalPrice region={region} plan={plan} className="font-semibold" /> per month.
          </p>
          <Button asChild className="rounded-full self-start">
            <Link to="/plans">See plans</Link>
          </Button>
        </CardContent>
      </Card>
    );
  }

  const busy = generation.isPending || state === "generating";
  const out = latest?.output ?? null;

  return (
    <Card className="rounded-3xl border-border/70 shadow-[var(--shadow-card)]">
      <CardHeader className="gap-2 pb-2">
        <div className="flex flex-wrap items-center gap-2">
          <Sparkles className="h-4 w-4 text-primary" aria-hidden />
          <CardTitle className="text-sm">AI Weekly Insights</CardTitle>
          <Badge variant="outline">{freshnessLabel(latest?.generatedAt ?? null)}</Badge>
          <span className="ml-auto text-xs text-muted-foreground">{allowanceLabel(access)}</span>
        </div>
        {canSelectBusiness(access) && businesses.length > 1 && onSelectBusiness && (
          <div className="flex flex-wrap gap-1.5" role="group" aria-label="Choose a business">
            {businesses.map((b) => (
              <Button
                key={b.id}
                size="sm"
                variant={b.id === businessId ? "default" : "outline"}
                className="rounded-xl"
                aria-pressed={b.id === businessId}
                onClick={() => onSelectBusiness(b.id)}
              >
                {b.name}
              </Button>
            ))}
          </div>
        )}
      </CardHeader>

      <CardContent className="space-y-4">
        {notice && (
          <p className="rounded-2xl bg-muted px-4 py-3 text-sm" role="alert">
            {notice}
          </p>
        )}

        {state === "generating" && (
          <p className="flex items-center gap-2 text-sm text-muted-foreground" role="status" aria-live="polite">
            <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> Writing this week's summary…
          </p>
        )}

        {state === "insufficient_data" && (
          <p className="text-sm text-muted-foreground">
            {latest?.errorMessage ?? customerFacingError("insufficient_data")} Keep your QR codes in
            place for a few more days and try again.
          </p>
        )}

        {state === "failed" && (
          <p className="text-sm text-muted-foreground">
            {latest?.errorMessage ?? customerFacingError("generation_failed")}
          </p>
        )}

        {state === "rate_limited" && (
          <p className="text-sm text-muted-foreground">{customerFacingError("weekly_limit")}</p>
        )}

        {state === "not_generated" && (
          <p className="text-sm text-muted-foreground">
            Generate a plain-English summary of what improved, what needs attention and what to do
            next.
          </p>
        )}

        {(state === "ready" || state === "stale") && out && (
          <div className="space-y-4">
            {state === "stale" && (
              <p className="text-xs text-muted-foreground">
                This summary covers an earlier period. Generate a fresh one for the latest picture.
              </p>
            )}
            <div className="space-y-1">
              <h3 className="text-base font-semibold tracking-tight">{out.headline}</h3>
              <p className="text-xs text-muted-foreground">
                Generated {formatGeneratedDate(latest?.generatedAt ?? null)}
              </p>
            </div>

            <div className="space-y-2 text-sm text-muted-foreground">
              {out.executiveSummary.split(/\n{1,2}/).filter(Boolean).map((p, i) => (
                <p key={i}>{p}</p>
              ))}
            </div>

            <div className="grid gap-3 md:grid-cols-2">
              <div className="rounded-2xl bg-muted/60 p-4">
                <p className="text-xs uppercase tracking-wide text-muted-foreground">Top win</p>
                <p className="mt-1 text-sm font-medium">{out.topWin.title}</p>
                <p className="mt-1 text-xs text-muted-foreground">{out.topWin.explanation}</p>
              </div>
              <div className="rounded-2xl bg-muted/60 p-4">
                <p className="text-xs uppercase tracking-wide text-muted-foreground">
                  Main opportunity
                </p>
                <p className="mt-1 text-sm font-medium">{out.mainOpportunity.title}</p>
                <p className="mt-1 text-xs text-muted-foreground">
                  {out.mainOpportunity.explanation}
                </p>
              </div>
            </div>

            {out.recommendedActions.length > 0 && (
              <div className="space-y-2">
                <p className="text-sm font-semibold">Recommended actions</p>
                <ul className="space-y-2">
                  {out.recommendedActions.slice(0, 3).map((a) => (
                    <li
                      key={a.title}
                      className="flex flex-wrap items-start justify-between gap-2 border-b border-border/50 pb-2 last:border-0"
                    >
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-medium">{a.title}</p>
                        <p className="text-xs text-muted-foreground">{a.reason}</p>
                      </div>
                      <div className="flex shrink-0 items-center gap-1.5">
                        <Badge variant="outline">Effort: {a.effort}</Badge>
                        <Badge variant="outline">Impact: {a.expectedImpact}</Badge>
                        {onRecommendationComplete && (
                          <Button
                            size="sm"
                            variant="outline"
                            className="rounded-xl"
                            onClick={() => onRecommendationComplete(a.title)}
                          >
                            Mark done
                          </Button>
                        )}
                      </div>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            <p className="text-xs text-muted-foreground">{out.closingNote}</p>
            <p className="text-xs text-muted-foreground">{out.confidenceDisclaimer}</p>
          </div>
        )}

        <Separator />

        <div className="flex flex-wrap items-center gap-2">
          <Button
            className="rounded-full"
            disabled={busy || !canGenerateNow(state, access)}
            onClick={() => generation.mutate()}
          >
            {busy ? (
              <Loader2 className="mr-1 h-4 w-4 animate-spin" aria-hidden />
            ) : state === "ready" || state === "stale" ? (
              <RefreshCw className="mr-1 h-4 w-4" aria-hidden />
            ) : (
              <Sparkles className="mr-1 h-4 w-4" aria-hidden />
            )}
            {state === "ready" || state === "stale" ? "Regenerate" : "Generate insight"}
          </Button>

          {out && (
            <>
              <Button variant="outline" className="rounded-full" onClick={copySummary}>
                {copied ? (
                  <Check className="mr-1 h-4 w-4" aria-hidden />
                ) : (
                  <Copy className="mr-1 h-4 w-4" aria-hidden />
                )}
                Copy summary
              </Button>
              <Button asChild variant="outline" className="rounded-full">
                <Link to="/reports">
                  <FileText className="mr-1 h-4 w-4" aria-hidden /> View full report
                </Link>
              </Button>

              <div className="ml-auto flex items-center gap-1.5">
                <span className="text-xs text-muted-foreground">Was this useful?</span>
                <Button
                  size="sm"
                  variant={latest?.feedback?.helpful === true ? "default" : "outline"}
                  className="rounded-xl"
                  aria-label="Mark this summary as helpful"
                  aria-pressed={latest?.feedback?.helpful === true}
                  disabled={feedback.isPending}
                  onClick={() => feedback.mutate({ helpful: true, reason: null })}
                >
                  <ThumbsUp className="h-4 w-4" aria-hidden />
                </Button>
                <Button
                  size="sm"
                  variant={latest?.feedback?.helpful === false ? "default" : "outline"}
                  className="rounded-xl"
                  aria-label="Mark this summary as not helpful"
                  aria-pressed={latest?.feedback?.helpful === false}
                  disabled={feedback.isPending}
                  onClick={() => setShowReasons((v) => !v)}
                >
                  <ThumbsDown className="h-4 w-4" aria-hidden />
                </Button>
              </div>
            </>
          )}
        </div>

        {showReasons && (
          <div className="flex flex-wrap gap-1.5" role="group" aria-label="Why wasn't it helpful?">
            {FEEDBACK_REASONS.map((r) => (
              <Button
                key={r.key}
                size="sm"
                variant="outline"
                className="rounded-xl"
                disabled={feedback.isPending}
                onClick={() => feedback.mutate({ helpful: false, reason: r.key })}
              >
                {r.label}
              </Button>
            ))}
          </div>
        )}

        <p className="text-xs text-muted-foreground">{AI_DISCLAIMER}</p>

        <InsightHistoryPanel
          insights={insights}
          businessId={businessId}
          businessName={businessName}
          activeId={latest?.id ?? null}
          onOpen={setOpenId}
        />
      </CardContent>
    </Card>
  );
}
