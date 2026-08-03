import { useState } from "react";
import { Link } from "@tanstack/react-router";
import { Sparkles, Check } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useMyFounderStatus } from "@/hooks/use-founder";
import { founderBadgeLabel, isFounderActive, FOUNDER_COPY } from "@/lib/founder";
import { FounderFeedbackDialog } from "./FounderFeedbackDialog";

const STEPS = [
  { label: "Add your business details and Google review link", to: "/businesses" },
  { label: "Create your first QR code", to: "/qr" },
  { label: "Print a marketing pack and place it", to: "/marketing-packs" },
  { label: "Watch your first scans arrive", to: "/analytics" },
] as const;

/**
 * Founder welcome panel: place number, what the lock means, and the four
 * things a new founder should do first.
 */
export function FounderWelcomeCard() {
  const { data } = useMyFounderStatus();
  const [feedbackOpen, setFeedbackOpen] = useState(false);

  if (!data?.slot || !isFounderActive(data.slot)) return null;

  return (
    <Card className="rounded-3xl border-amber-400/40 bg-amber-400/[0.04]">
      <CardContent className="space-y-4 p-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <Badge className="gap-1.5 bg-amber-400/20 text-amber-300 hover:bg-amber-400/20">
              <Sparkles className="h-3.5 w-3.5" aria-hidden />
              {founderBadgeLabel(data.slot.slotNumber)}
            </Badge>
          </div>
          {data.feedbackDue && !data.feedbackSubmitted && (
            <Button size="sm" variant="outline" onClick={() => setFeedbackOpen(true)}>
              Share founder feedback
            </Button>
          )}
        </div>

        <div>
          <h2 className="text-lg font-semibold">Welcome aboard — you're one of the first 100.</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            {FOUNDER_COPY.lockWording}. If you cancel and come back later, standard pricing applies.
          </p>
        </div>

        <ul className="grid gap-2 text-sm sm:grid-cols-2">
          {STEPS.map((step) => (
            <li key={step.to} className="flex items-start gap-2">
              <Check className="mt-0.5 h-4 w-4 shrink-0 text-amber-300" aria-hidden />
              <Link to={step.to} className="underline-offset-4 hover:underline">
                {step.label}
              </Link>
            </li>
          ))}
        </ul>
      </CardContent>

      <FounderFeedbackDialog open={feedbackOpen} onOpenChange={setFeedbackOpen} />
    </Card>
  );
}
