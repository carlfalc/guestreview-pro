import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { currentUserIsAdmin } from "@/lib/authorised-plan.functions";
import {
  adminListFailedWebhookEvents,
  adminRequeueWebhookEvent,
  type WebhookEventRow,
} from "@/lib/webhook-admin.functions";

export const Route = createFileRoute("/_authenticated/admin/webhook-events")({
  component: AdminWebhookEventsPage,
  head: () => ({
    meta: [
      { title: "Admin · Billing webhook health" },
      {
        name: "description",
        content: "Failed and stuck Stripe billing events for GuestReview Pro.",
      },
    ],
  }),
});

function AdminWebhookEventsPage() {
  const isAdminFn = useServerFn(currentUserIsAdmin);
  const isAdminQ = useQuery({ queryKey: ["is-admin"], queryFn: () => isAdminFn() });

  const listFn = useServerFn(adminListFailedWebhookEvents);
  const listQ = useQuery({
    queryKey: ["admin", "webhook-events"],
    queryFn: () => listFn(),
    enabled: isAdminQ.data === true,
    refetchInterval: 60_000,
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

  const health = listQ.data;

  return (
    <div className="animate-fade-in-up space-y-6">
      <div>
        <h1 className="text-3xl font-semibold tracking-tight">Billing webhook health</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Stripe deliveries that failed or are still in flight
          {health ? ` · ${health.environment} environment` : ""}.
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <Stat label="Failed" value={health?.failed ?? 0} tone={health?.failed ? "bad" : "ok"} />
        <Stat label="Stuck in flight" value={health?.stuck ?? 0} tone={health?.stuck ? "warn" : "ok"} />
        <Stat label="Processed (24h)" value={health?.processedLast24h ?? 0} tone="ok" />
      </div>

      {listQ.isLoading ? (
        <Card className="rounded-3xl border-border/70">
          <CardContent className="p-6 text-sm text-muted-foreground">Loading events…</CardContent>
        </Card>
      ) : (health?.events.length ?? 0) === 0 ? (
        <Card className="rounded-3xl border-border/70">
          <CardContent className="p-6 text-sm text-muted-foreground">
            Nothing outstanding — every recent billing event was processed.
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4">
          {health!.events.map((e) => (
            <EventCard key={e.id} event={e} />
          ))}
        </div>
      )}
    </div>
  );
}

function Stat({ label, value, tone }: { label: string; value: number; tone: "ok" | "warn" | "bad" }) {
  const toneClass =
    tone === "bad" ? "text-destructive" : tone === "warn" ? "text-amber-500" : "text-foreground";
  return (
    <Card className="rounded-3xl border-border/70">
      <CardContent className="p-6">
        <p className="text-sm text-muted-foreground">{label}</p>
        <p className={`mt-1 text-3xl font-semibold tabular-nums ${toneClass}`}>{value}</p>
      </CardContent>
    </Card>
  );
}

function EventCard({ event }: { event: WebhookEventRow }) {
  const qc = useQueryClient();
  const requeueFn = useServerFn(adminRequeueWebhookEvent);
  const requeue = useMutation({
    mutationFn: () => requeueFn({ data: { stripeEventId: event.stripe_event_id } }),
    onSuccess: () => {
      toast.success("Event re-queued. Resend it from Stripe to reprocess.");
      qc.invalidateQueries({ queryKey: ["admin", "webhook-events"] });
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Could not re-queue"),
  });

  const failed = event.processing_status === "failed";

  return (
    <Card className="rounded-3xl border-border/70">
      <CardContent className="space-y-3 p-6">
        <div className="flex flex-wrap items-center gap-3">
          <Badge variant={failed ? "destructive" : "secondary"}>{event.processing_status}</Badge>
          <span className="font-medium">{event.event_type}</span>
          <span className="text-xs text-muted-foreground">{event.stripe_event_id}</span>
          {event.retry_count ? (
            <span className="text-xs text-muted-foreground">attempts: {event.retry_count}</span>
          ) : null}
        </div>
        {event.error_message ? (
          <p className="rounded-xl bg-destructive/10 px-3 py-2 text-sm text-destructive">
            {event.error_message}
          </p>
        ) : null}
        <div className="flex flex-wrap items-center gap-4 text-xs text-muted-foreground">
          <span>received {new Date(event.received_at).toLocaleString()}</span>
          {event.last_attempt_at ? (
            <span>last attempt {new Date(event.last_attempt_at).toLocaleString()}</span>
          ) : null}
        </div>
        {failed ? (
          <Button size="sm" variant="outline" disabled={requeue.isPending} onClick={() => requeue.mutate()}>
            {requeue.isPending ? "Re-queuing…" : "Re-queue for retry"}
          </Button>
        ) : null}
      </CardContent>
    </Card>
  );
}
