// Shared presentation pieces for the executive experience.
// Plain-language only — no technical jargon, no invented statistics.
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { ArrowDownRight, ArrowRight, ArrowUpRight, Minus } from "lucide-react";
import {
  friendlyDimension,
  stateLabel,
  type Confidence,
  type Rating,
  type Recommendation,
  type Trend,
} from "@/lib/executive";
import type { DimensionResult } from "@/lib/health-score";
import { cn } from "@/lib/utils";

export function RatingBadge({ rating }: { rating: Rating | null }) {
  if (!rating) return <Badge variant="outline">Not enough data yet</Badge>;
  if (rating === "Excellent" || rating === "Strong") return <Badge>{rating}</Badge>;
  return <Badge variant="secondary">{rating}</Badge>;
}

export function TrendPill({ trend }: { trend: Trend }) {
  const Icon =
    trend.direction === "up"
      ? ArrowUpRight
      : trend.direction === "down"
        ? ArrowDownRight
        : trend.direction === "flat"
          ? Minus
          : ArrowRight;
  return (
    <span className="inline-flex items-center gap-1 rounded-full bg-muted px-2.5 py-1 text-xs text-muted-foreground">
      <Icon className="h-3.5 w-3.5" />
      {trend.label}
    </span>
  );
}

export function MetricCard({
  label,
  value,
  trend,
  note,
}: {
  label: string;
  value: string;
  trend?: Trend;
  note?: string;
}) {
  return (
    <Card className="rounded-2xl border-border/70 shadow-[var(--shadow-card)]">
      <CardContent className="space-y-2 p-5">
        <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{label}</p>
        <p className="text-2xl font-semibold tracking-tight">{value}</p>
        {trend && <TrendPill trend={trend} />}
        {note && <p className="text-xs text-muted-foreground">{note}</p>}
      </CardContent>
    </Card>
  );
}

export function ScoreHeadline({
  score,
  rating,
  trend,
  confidence,
  confidenceNote,
  headline,
  message,
  lastUpdated,
}: {
  score: number | null;
  rating: Rating | null;
  trend: Trend;
  confidence: Confidence;
  confidenceNote: string;
  headline: string;
  message: string;
  lastUpdated: string;
}) {
  return (
    <Card className="rounded-3xl border-border/70 shadow-[var(--shadow-card)]">
      <CardContent className="flex flex-wrap items-center gap-6 p-6">
        <div className="flex h-24 w-24 shrink-0 flex-col items-center justify-center rounded-3xl bg-muted">
          <span className="text-3xl font-semibold tracking-tight">
            {score === null ? "—" : score}
          </span>
          <span className="text-[10px] uppercase tracking-wide text-muted-foreground">
            out of 100
          </span>
        </div>
        <div className="min-w-0 flex-1 space-y-2">
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="text-lg font-semibold tracking-tight">{headline}</h2>
            <RatingBadge rating={rating} />
            <TrendPill trend={trend} />
          </div>
          <p className="text-sm text-muted-foreground">{message}</p>
          <p className="text-xs text-muted-foreground">
            Confidence: {confidence} · {confidenceNote} · Last updated{" "}
            {new Date(lastUpdated).toLocaleString()}
          </p>
        </div>
      </CardContent>
    </Card>
  );
}

export function DimensionCard({ dimension }: { dimension: DimensionResult }) {
  const d = friendlyDimension(dimension);
  return (
    <Card className="rounded-3xl border-border/70">
      <CardContent className="space-y-2 p-5">
        <div className="flex items-center justify-between gap-3">
          <p className="text-sm font-semibold">{d.title}</p>
          <Badge variant={d.state === "good" ? "default" : "secondary"}>
            {stateLabel(d.state)}
          </Badge>
        </div>
        {d.score !== null && <Progress value={d.score} className="h-1.5" />}
        <p className="text-xs text-muted-foreground">{d.whyItMatters}</p>
        <p className="text-xs text-muted-foreground">{d.summary}</p>
        {d.state !== "good" && (
          <p className="text-xs font-medium text-foreground">Next: {d.suggestedAction}</p>
        )}
      </CardContent>
    </Card>
  );
}

export function RecommendationCard({
  rec,
  onAction,
  busy,
}: {
  rec: Recommendation;
  onAction?: (action: "completed" | "snoozed" | "dismissed" | "reopen") => void;
  busy?: boolean;
}) {
  return (
    <Card
      className={cn(
        "rounded-3xl border-border/70",
        rec.status !== "open" && "opacity-70",
      )}
    >
      <CardContent className="space-y-2 p-5">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className="text-sm font-semibold">{rec.title}</p>
          <div className="flex items-center gap-1.5">
            <Badge variant="outline">Impact: {rec.impact}</Badge>
            <Badge variant="outline">Effort: {rec.effort}</Badge>
            {rec.status !== "open" && <Badge variant="secondary">{rec.status}</Badge>}
          </div>
        </div>
        <p className="text-xs text-muted-foreground">{rec.explanation}</p>
        <p className="text-xs text-muted-foreground">Why: {rec.evidence}</p>
        <p className="text-xs font-medium">Do this: {rec.action}</p>
        {onAction && (
          <div className="flex flex-wrap gap-2 pt-1">
            {rec.status === "open" ? (
              <>
                <Button size="sm" className="rounded-xl" disabled={busy} onClick={() => onAction("completed")}>
                  Mark as done
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  className="rounded-xl"
                  disabled={busy}
                  onClick={() => onAction("snoozed")}
                >
                  Remind me later
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  className="rounded-xl"
                  disabled={busy}
                  onClick={() => onAction("dismissed")}
                >
                  Not relevant
                </Button>
              </>
            ) : (
              <Button
                size="sm"
                variant="outline"
                className="rounded-xl"
                disabled={busy}
                onClick={() => onAction("reopen")}
              >
                Reopen
              </Button>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

export function BreakdownList({
  title,
  rows,
  label,
}: {
  title: string;
  rows: Array<{ key: string; scans: number; clickRate: number | null }>;
  label: (key: string) => string;
}) {
  if (rows.length === 0) return null;
  return (
    <Card className="rounded-3xl border-border/70">
      <CardHeader className="pb-2">
        <CardTitle className="text-sm">{title}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-2">
        {rows.map((r) => (
          <div key={r.key} className="flex items-center justify-between gap-3 text-sm">
            <span className="truncate">{label(r.key)}</span>
            <span className="shrink-0 text-muted-foreground">
              {r.scans} scans ·{" "}
              {r.clickRate === null ? "not enough data yet" : `${r.clickRate}% engagement`}
            </span>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}
