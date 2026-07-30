import { createFileRoute, Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { currentUserIsAdmin } from "@/lib/authorised-plan.functions";
import {
  adminBetaHealth,
  adminListFeedback,
  adminSetFeedbackStatus,
  type BetaHealth,
  type FeedbackRow,
} from "@/lib/feedback.functions";

export const Route = createFileRoute("/_authenticated/admin/health")({
  component: AdminHealthPage,
  head: () => ({
    meta: [
      { title: "Admin · Beta health — GuestReview Pro" },
      {
        name: "description",
        content: "Beta activation, revenue and feedback health for GuestReview Pro.",
      },
      { property: "og:title", content: "Admin · Beta health — GuestReview Pro" },
      {
        property: "og:description",
        content: "Beta activation, revenue and feedback health for GuestReview Pro.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
});

function AdminHealthPage() {
  const isAdminFn = useServerFn(currentUserIsAdmin);
  const isAdminQ = useQuery({ queryKey: ["is-admin"], queryFn: () => isAdminFn() });

  const healthFn = useServerFn(adminBetaHealth);
  const feedbackFn = useServerFn(adminListFeedback);
  const statusFn = useServerFn(adminSetFeedbackStatus);
  const qc = useQueryClient();

  const healthQ = useQuery({
    queryKey: ["admin", "beta-health"],
    queryFn: () => healthFn(),
    enabled: isAdminQ.data === true,
    refetchInterval: 60_000,
  });

  const feedbackQ = useQuery({
    queryKey: ["admin", "beta-feedback"],
    queryFn: () => feedbackFn(),
    enabled: isAdminQ.data === true,
  });

  const setStatus = useMutation({
    mutationFn: (v: { id: string; status: string }) => statusFn({ data: v }),
    onSuccess: () => {
      toast.success("Feedback updated");
      qc.invalidateQueries({ queryKey: ["admin", "beta-feedback"] });
      qc.invalidateQueries({ queryKey: ["admin", "beta-health"] });
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Update failed"),
  });

  if (isAdminQ.isLoading) return <p className="text-sm text-muted-foreground">Checking access…</p>;
  if (isAdminQ.data !== true)
    return <p className="text-sm text-muted-foreground">You do not have access to this page.</p>;

  const h = healthQ.data;

  return (
    <div className="animate-fade-in-up space-y-6">
      <div>
        <h1 className="text-3xl font-semibold tracking-tight">Beta health</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Activation, revenue and feedback signals for the last 7 days.
        </p>
      </div>

      {healthQ.isError && (
        <p className="text-sm text-destructive">Could not load the health summary.</p>
      )}

      {h && (
        <>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <Metric label="Signups (7d)" value={h.signups} sub={`${h.totalAccounts} total`} />
            <Metric label="Active businesses" value={h.businesses} />
            <Metric label="Active QR codes" value={h.activeQrCodes} />
            <Metric label="Marketing packs (7d)" value={h.packs} />
            <Metric label="Scans (7d)" value={h.scans} sub={`${h.scanClickThrough}% clicked through`} />
            <Metric label="Paid accounts" value={h.paidAccounts} />
            <Metric
              label="Checkouts (7d)"
              value={h.checkoutsStarted}
              sub={`${h.checkoutsCompleted} completed`}
            />
            <Metric
              label="Failed billing events (7d)"
              value={h.webhookFailures}
              tone={h.webhookFailures > 0 ? "bad" : "ok"}
            />
          </div>

          <div className="flex flex-wrap gap-3">
            <Button asChild variant="outline" size="sm">
              <Link to="/admin/webhook-events">Webhook health</Link>
            </Button>
            <Button asChild variant="outline" size="sm">
              <Link to="/admin/funnel">Conversion funnel</Link>
            </Button>
            <Button asChild variant="outline" size="sm">
              <Link to="/admin/region-requests">
                Region requests
                {h.pendingRegionRequests > 0 ? ` (${h.pendingRegionRequests})` : ""}
              </Link>
            </Button>
          </div>
        </>
      )}

      <Card className="rounded-3xl border-border/70">
        <CardContent className="p-6">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold">Beta feedback</h2>
            {h && <Badge variant={h.feedbackNew > 0 ? "default" : "secondary"}>{h.feedbackNew} new</Badge>}
          </div>

          {feedbackQ.isLoading && (
            <p className="mt-3 text-sm text-muted-foreground">Loading feedback…</p>
          )}
          {feedbackQ.data?.length === 0 && (
            <p className="mt-3 text-sm text-muted-foreground">No feedback yet.</p>
          )}

          <ul className="mt-3 space-y-3">
            {(feedbackQ.data ?? []).map((f: FeedbackRow) => (
              <li key={f.id} className="rounded-2xl border border-border/60 p-4">
                <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                  <Badge variant="outline">{f.category}</Badge>
                  <Badge variant={f.status === "new" ? "default" : "secondary"}>{f.status}</Badge>
                  {f.rating != null && <span>rated {f.rating}/5</span>}
                  {f.path && <span>· {f.path}</span>}
                  <span>· {new Date(f.created_at).toLocaleString()}</span>
                </div>
                <p className="mt-2 whitespace-pre-wrap text-sm">{f.message}</p>
                <div className="mt-3 flex flex-wrap gap-2">
                  {["triaged", "resolved", "wont_fix"].map((s) => (
                    <Button
                      key={s}
                      size="sm"
                      variant="outline"
                      disabled={f.status === s || setStatus.isPending}
                      onClick={() => setStatus.mutate({ id: f.id, status: s })}
                    >
                      Mark {s.replace("_", " ")}
                    </Button>
                  ))}
                </div>
              </li>
            ))}
          </ul>
        </CardContent>
      </Card>
    </div>
  );
}

function Metric({
  label,
  value,
  sub,
  tone = "ok",
}: {
  label: string;
  value: number;
  sub?: string;
  tone?: "ok" | "bad";
}) {
  return (
    <div
      className={
        "rounded-2xl border px-4 py-3 " +
        (tone === "bad" ? "border-destructive/50 bg-destructive/10" : "border-border/60")
      }
    >
      <p className="text-xs uppercase tracking-wider text-muted-foreground">{label}</p>
      <p className="mt-1 text-2xl font-semibold">{value}</p>
      {sub && <p className="text-xs text-muted-foreground">{sub}</p>}
    </div>
  );
}
