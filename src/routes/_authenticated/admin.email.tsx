import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { loadEmailHealth } from "@/lib/admin-email.functions";

export const Route = createFileRoute("/_authenticated/admin/email")({
  head: () => ({
    meta: [
      { title: "Email delivery health | GuestReview Pro" },
      {
        name: "description",
        content:
          "Operator view of email queue state, delivery failures, suppressions and the current sending budget.",
      },
      { property: "og:title", content: "Email delivery health | GuestReview Pro" },
      {
        property: "og:description",
        content: "Queue state, failures, suppressions and sending budget for outbound email.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: AdminEmailHealthPage,
});

function AdminEmailHealthPage() {
  const load = useServerFn(loadEmailHealth);
  const health = useQuery({ queryKey: ["admin-email-health"], queryFn: () => load() });
  const d = health.data;

  return (
    <div className="animate-fade-in-up space-y-8">
      <header className="space-y-2">
        <h1 className="text-3xl font-semibold tracking-tight">Email delivery health</h1>
        <p className="text-muted-foreground max-w-2xl text-sm">
          Sending budget, queue state and recent failures for outbound email.
        </p>
      </header>

      {health.isLoading ? (
        <Card>
          <CardContent className="text-muted-foreground py-10 text-sm">Loading…</CardContent>
        </Card>
      ) : health.isError || !d ? (
        <Card>
          <CardContent className="py-10 text-sm">
            Could not load email health. Admin access is required.
          </CardContent>
        </Card>
      ) : (
        <>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <Stat label="Domain status" value={d.domainStatus} />
            <Stat label="Sent last hour" value={`${d.sentLastHour} / ${d.maxPerHour}`} />
            <Stat label="Sent last 24h" value={`${d.sentLastDay} / ${d.maxPerDay}`} />
            <Stat label="Remaining today" value={String(d.remainingToday)} />
          </div>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between gap-4">
              <CardTitle className="text-lg">Queue</CardTitle>
              <Badge variant={d.paused ? "destructive" : "secondary"}>
                {d.paused ? "Sending paused" : "Sending active"}
              </Badge>
            </CardHeader>
            <CardContent className="grid gap-3 sm:grid-cols-3">
              {Object.entries(d.byStatus).map(([status, count]) => (
                <div
                  key={status}
                  className="border-border/60 flex items-center justify-between rounded-lg border px-3 py-2 text-sm"
                >
                  <span className="capitalize">{status}</span>
                  <span className="font-semibold">{count}</span>
                </div>
              ))}
              <div className="border-border/60 flex items-center justify-between rounded-lg border px-3 py-2 text-sm">
                <span>Suppressed addresses</span>
                <span className="font-semibold">{d.suppressions}</span>
              </div>
              <div className="border-border/60 flex items-center justify-between rounded-lg border px-3 py-2 text-sm">
                <span>Last send</span>
                <span className="font-semibold">
                  {d.lastSentAt ? new Date(d.lastSentAt).toLocaleString() : "—"}
                </span>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Recent failures</CardTitle>
            </CardHeader>
            <CardContent>
              {d.recentFailures.length === 0 ? (
                <p className="text-muted-foreground text-sm">No failures recorded.</p>
              ) : (
                <div className="space-y-2">
                  {d.recentFailures.map((row) => (
                    <div
                      key={row.id}
                      className="border-border/60 flex flex-wrap items-center justify-between gap-2 rounded-lg border px-3 py-2 text-sm"
                    >
                      <span className="min-w-0">
                        <span className="block truncate font-medium">
                          {row.emailType} · {row.recipient}
                        </span>
                        <span className="text-muted-foreground text-xs">
                          {row.error ?? "No error recorded"} · attempt {row.attempts} ·{" "}
                          {new Date(row.createdAt).toLocaleString()}
                        </span>
                      </span>
                      <Badge variant="destructive">{row.status}</Badge>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <Card>
      <CardContent className="py-5">
        <p className="text-muted-foreground text-xs tracking-wide uppercase">{label}</p>
        <p className="mt-1 text-2xl font-semibold capitalize">{value}</p>
      </CardContent>
    </Card>
  );
}
