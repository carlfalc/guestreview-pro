import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { Check } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useBilling } from "@/hooks/use-billing";

const STEPS = [
  {
    title: "Branding is gone",
    body: "The “Created with GuestReview Pro” line has been removed from every pack you have already made — re-export to get clean files.",
    to: "/marketing-packs",
    cta: "Open packs",
  },
  {
    title: "Add your other locations",
    body: "Your plan now covers more businesses and QR codes. Add the rest of your venues.",
    to: "/businesses",
    cta: "Add a business",
  },
  {
    title: "Check your analytics",
    body: "Full scan history and device breakdowns are unlocked.",
    to: "/analytics",
    cta: "View analytics",
  },
] as const;

/**
 * One-off post-upgrade checklist. Shown after a successful payment until the
 * owner dismisses it; the webhook re-arms it when the plan changes.
 */
export function UpgradeChecklist() {
  const billing = useBilling();
  const qc = useQueryClient();

  const profile = useQuery({
    queryKey: ["upgrade-checklist"],
    enabled: billing.isPaid,
    queryFn: async () => {
      const { data: auth } = await supabase.auth.getUser();
      const uid = auth.user?.id;
      if (!uid) return null;
      const { data } = await supabase
        .from("profiles")
        .select("upgrade_checklist_dismissed_at")
        .eq("id", uid)
        .maybeSingle();
      return (data ?? null) as { upgrade_checklist_dismissed_at: string | null } | null;
    },
  });

  if (!billing.isPaid || !profile.data || profile.data.upgrade_checklist_dismissed_at) return null;

  const dismiss = async () => {
    const { data: auth } = await supabase.auth.getUser();
    if (!auth.user?.id) return;
    await supabase
      .from("profiles")
      .update({ upgrade_checklist_dismissed_at: new Date().toISOString() })
      .eq("id", auth.user.id);
    qc.invalidateQueries({ queryKey: ["upgrade-checklist"] });
  };

  return (
    <Card className="rounded-3xl border-primary/40 bg-primary/5">
      <CardContent className="space-y-4 p-6">
        <div>
          <h2 className="text-lg font-semibold">You&apos;re all set — here&apos;s what changed</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Your new plan is active straight away. Three quick things to get the most from it.
          </p>
        </div>
        <ul className="space-y-3">
          {STEPS.map((step) => (
            <li
              key={step.title}
              className="flex items-start gap-3 rounded-2xl border border-border/60 bg-background/60 p-4"
            >
              <Check className="mt-0.5 size-4 shrink-0 text-primary" />
              <div className="flex-1">
                <p className="text-sm font-medium">{step.title}</p>
                <p className="mt-0.5 text-sm text-muted-foreground">{step.body}</p>
              </div>
              <Button asChild size="sm" variant="outline">
                <Link to={step.to}>{step.cta}</Link>
              </Button>
            </li>
          ))}
        </ul>
        <Button variant="ghost" size="sm" onClick={dismiss}>
          Dismiss
        </Button>
      </CardContent>
    </Card>
  );
}
