import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { currentUserIsAdmin } from "@/lib/authorised-plan.functions";
import { adminConversionFunnel } from "@/lib/analytics.functions";

export const Route = createFileRoute("/_authenticated/admin/funnel")({
  component: AdminFunnelPage,
  head: () => ({
    meta: [
      { title: "Admin · Conversion funnel" },
      {
        name: "description",
        content: "Signup to first scan to upgrade conversion for GuestReview Pro.",
      },
    ],
  }),
});

const LABELS: Record<string, string> = {
  signed_up: "Signed up",
  created_business: "Created a business",
  created_qr: "Created a QR code",
  downloaded_qr: "Downloaded or exported",
  first_scan: "Received a first scan",
  viewed_pricing: "Viewed pricing",
  started_checkout: "Started checkout",
  upgraded: "Upgraded to a paid plan",
};

function AdminFunnelPage() {
  const isAdminFn = useServerFn(currentUserIsAdmin);
  const isAdminQ = useQuery({ queryKey: ["is-admin"], queryFn: () => isAdminFn() });

  const funnelFn = useServerFn(adminConversionFunnel);
  const [days, setDays] = useState(30);
  const funnelQ = useQuery({
    queryKey: ["admin", "funnel", days],
    queryFn: () => funnelFn({ data: { days } }),
    enabled: isAdminQ.data === true,
  });

  if (isAdminQ.isLoading) {
    return <div className="p-8 text-sm text-muted-foreground">Loading…</div>;
  }
  if (isAdminQ.data !== true) {
    return (
      <Card className="rounded-3xl border-border/70">
        <CardContent className="p-8 text-center text-sm">
          You don’t have permission to view this page.
        </CardContent>
      </Card>
    );
  }

  const steps = funnelQ.data?.steps ?? [];
  const top = steps[0]?.accounts ?? 0;

  return (
    <div className="animate-fade-in-up space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-3xl font-semibold tracking-tight">Conversion funnel</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Accounts that signed up in the last {days} days, and how far each got.
          </p>
        </div>
        <div className="flex gap-2">
          {[7, 30, 90].map((d) => (
            <Button
              key={d}
              size="sm"
              variant={d === days ? "default" : "outline"}
              className="rounded-full"
              onClick={() => setDays(d)}
            >
              {d}d
            </Button>
          ))}
        </div>
      </div>

      <Card className="rounded-3xl border-border/70">
        <CardContent className="space-y-4 p-6">
          {funnelQ.isLoading ? (
            <p className="text-sm text-muted-foreground">Loading funnel…</p>
          ) : top === 0 ? (
            <p className="text-sm text-muted-foreground">No signups in this window yet.</p>
          ) : (
            steps.map((step, index) => {
              const share = top ? Math.round((step.accounts / top) * 100) : 0;
              const previous = index > 0 ? steps[index - 1].accounts : step.accounts;
              const dropOff = previous ? Math.max(0, previous - step.accounts) : 0;
              return (
                <div key={step.step} className="space-y-1">
                  <div className="flex items-baseline justify-between gap-4 text-sm">
                    <span className="font-medium">{LABELS[step.step] ?? step.step}</span>
                    <span className="tabular-nums text-muted-foreground">
                      {step.accounts} · {share}%
                      {index > 0 && dropOff > 0 ? ` · −${dropOff}` : ""}
                    </span>
                  </div>
                  <div className="h-2 w-full overflow-hidden rounded-full bg-muted">
                    <div
                      className="h-full rounded-full bg-primary transition-all"
                      style={{ width: `${share}%` }}
                    />
                  </div>
                </div>
              );
            })
          )}
        </CardContent>
      </Card>

      <p className="text-xs text-muted-foreground">
        Privacy: these counts come from first-party events only. No IP addresses, device
        fingerprints or personal data are recorded.
      </p>
    </div>
  );
}
