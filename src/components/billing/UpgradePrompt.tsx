import { Link } from "@tanstack/react-router";
import { Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { UPGRADE_COPY, type UpgradeReason } from "@/lib/entitlements";

/**
 * Positive, benefit-led upgrade prompt. Never blocks or hides existing data —
 * it explains what the next plan unlocks.
 */
export function UpgradePrompt({
  reason,
  className,
  compact = false,
}: {
  reason: UpgradeReason;
  className?: string;
  compact?: boolean;
}) {
  const copy = UPGRADE_COPY[reason];

  if (compact) {
    return (
      <div
        className={`flex flex-wrap items-center gap-3 rounded-2xl border border-primary/30 bg-primary/5 px-4 py-3 ${className ?? ""}`}
      >
        <Sparkles className="h-4 w-4 shrink-0 text-primary" />
        <p className="text-sm">
          <span className="font-medium">{copy.title}</span>{" "}
          <span className="text-muted-foreground">{copy.body}</span>
        </p>
        <Button asChild size="sm" className="ml-auto">
          <Link to="/plans">See plans</Link>
        </Button>
      </div>
    );
  }

  return (
    <Card className={`rounded-3xl border-primary/30 bg-primary/5 ${className ?? ""}`}>
      <CardContent className="flex flex-col gap-3 p-6">
        <div className="flex items-center gap-2">
          <Sparkles className="h-4 w-4 text-primary" />
          <p className="font-medium">{copy.title}</p>
        </div>
        <p className="text-sm text-muted-foreground">{copy.body}</p>
        <Button asChild className="self-start">
          <Link to="/plans">Compare plans</Link>
        </Button>
      </CardContent>
    </Card>
  );
}
