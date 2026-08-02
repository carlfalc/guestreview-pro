import { Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Check, Circle, Sparkles } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { getOnboardingProgress } from "@/lib/analytics.functions";
import { onboardingSteps, onboardingCompletion } from "@/lib/analytics";
import { useBilling } from "@/hooks/use-billing";
import { useTrack } from "@/hooks/use-analytics";

/**
 * Guided beta onboarding. Every step is derived from real database state, so
 * it can never claim a step is done when the underlying record is missing.
 * Disappears entirely once the account has completed the journey.
 */
export function OnboardingChecklist() {
  const fetchProgress = useServerFn(getOnboardingProgress);
  const { isPaid } = useBilling();
  const track = useTrack();

  const { data, isLoading } = useQuery({
    queryKey: ["onboarding-progress"],
    queryFn: () => fetchProgress(),
    staleTime: 30_000,
  });

  const steps = onboardingSteps(data, isPaid);
  const percent = onboardingCompletion(steps);

  if (isLoading || percent === 100) return null;

  const next = steps.find((s) => !s.done);

  return (
    <Card className="rounded-3xl border-primary/30 bg-primary/5 shadow-[var(--shadow-card)]">
      <CardContent className="space-y-5 p-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <div className="flex items-center gap-2">
              <Sparkles className="h-4 w-4 text-primary" />
              <h2 className="text-lg font-semibold tracking-tight">Get set up</h2>
            </div>
            <p className="mt-1 text-sm text-muted-foreground">
              {next ? `Next: ${next.title.toLowerCase()}.` : "You're all set."}
            </p>
          </div>
          <div className="min-w-[140px]">
            <Progress value={percent} className="h-2" />
            <p className="mt-1 text-right text-xs text-muted-foreground">{percent}% complete</p>
          </div>
        </div>

        <ol className="space-y-3">
          {steps.map((step) => (
            <li key={step.key} className="flex flex-wrap items-start gap-3">
              <span
                className={`mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full ${
                  step.done ? "bg-primary text-primary-foreground" : "border border-border"
                }`}
                aria-hidden
              >
                {step.done ? <Check className="h-3 w-3" /> : <Circle className="h-2 w-2" />}
              </span>
              <div className="min-w-0 flex-1">
                <p
                  className={`text-sm font-medium ${step.done ? "text-muted-foreground line-through" : ""}`}
                >
                  {step.title}
                </p>
                {!step.done && <p className="text-sm text-muted-foreground">{step.body}</p>}
              </div>
              {!step.done && (
                <Button
                  asChild
                  size="sm"
                  variant={step.key === next?.key ? "default" : "outline"}
                  className="rounded-full"
                  onClick={() =>
                    track("onboarding_step_completed", {
                      step: String(step.key),
                      action: "clicked",
                    })
                  }
                >
                  <Link to={step.to}>{step.cta}</Link>
                </Button>
              )}
            </li>
          ))}
        </ol>
      </CardContent>
    </Card>
  );
}
