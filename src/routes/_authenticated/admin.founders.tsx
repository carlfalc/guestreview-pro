import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  adminFounderStats,
  adminListFounderSlots,
  adminListFounderFeedback,
  adminReleaseFounderSlot,
  adminRestoreFounderSlot,
} from "@/lib/founder-admin.functions";

export const Route = createFileRoute("/_authenticated/admin/founders")({
  component: AdminFoundersPage,
  head: () => ({
    meta: [
      { title: "Founding members — GuestReview Pro admin" },
      { name: "description", content: "Monitor founder places, revenue and feedback." },
      { property: "og:title", content: "Founding members — GuestReview Pro admin" },
      { property: "og:description", content: "Monitor founder places, revenue and feedback." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
});

function Stat({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="rounded-2xl border border-border/60 px-4 py-3">
      <p className="text-xs uppercase tracking-wider text-muted-foreground">{label}</p>
      <p className="mt-1 text-xl font-semibold">{value}</p>
    </div>
  );
}

function AdminFoundersPage() {
  const fetchStats = useServerFn(adminFounderStats);
  const fetchSlots = useServerFn(adminListFounderSlots);
  const fetchFeedback = useServerFn(adminListFounderFeedback);
  const release = useServerFn(adminReleaseFounderSlot);
  const restore = useServerFn(adminRestoreFounderSlot);
  const [busy, setBusy] = useState<string | null>(null);

  const stats = useQuery({ queryKey: ["admin-founder-stats"], queryFn: () => fetchStats() });
  const slots = useQuery({ queryKey: ["admin-founder-slots"], queryFn: () => fetchSlots() });
  const feedback = useQuery({
    queryKey: ["admin-founder-feedback"],
    queryFn: () => fetchFeedback(),
  });

  const act = async (ownerId: string, action: "release" | "restore") => {
    setBusy(ownerId);
    try {
      if (action === "release") await release({ data: { ownerId } });
      else await restore({ data: { ownerId } });
      toast.success(action === "release" ? "Place released." : "Place restored.");
      await Promise.all([stats.refetch(), slots.refetch()]);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Action failed.");
    } finally {
      setBusy(null);
    }
  };

  const s = stats.data;

  return (
    <div className="animate-fade-in-up space-y-6">
      <div>
        <h1 className="text-3xl font-semibold tracking-tight">Founding members</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Slot occupancy, revenue and manual slot management for the Founding Member Beta.
        </p>
      </div>

      {stats.isError && (
        <Card className="rounded-3xl border-destructive/50">
          <CardContent className="p-6 text-sm text-destructive">
            You do not have access to this view.
          </CardContent>
        </Card>
      )}

      {s && (
        <Card className="rounded-3xl border-border/70">
          <CardContent className="space-y-4 p-6">
            <div className="grid gap-3 sm:grid-cols-3 lg:grid-cols-4">
              <Stat label="Active" value={s.active} />
              <Stat label="Remaining" value={s.remaining} />
              <Stat label="Monthly" value={s.monthly} />
              <Stat label="Annual" value={s.annual} />
              <Stat label="Released" value={s.released} />
              <Stat label="Refunded" value={s.refunded} />
              <Stat label="Cancelled" value={s.canceled} />
              <Stat label="Feedback" value={s.feedbackCount} />
            </div>
            {s.revenue.length > 0 && (
              <div className="flex flex-wrap gap-3 text-sm">
                {s.revenue.map((r) => (
                  <span key={r.currency} className="rounded-full border border-border/60 px-3 py-1">
                    {(r.amount_minor / 100).toLocaleString(undefined, {
                      style: "currency",
                      currency: r.currency,
                    })}{" "}
                    · {r.accounts} accounts
                  </span>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      )}

      <Card className="rounded-3xl border-border/70">
        <CardContent className="p-6">
          <h2 className="text-lg font-semibold">Places</h2>
          <div className="mt-3 overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="text-left text-xs uppercase tracking-wider text-muted-foreground">
                <tr>
                  <th className="py-2">#</th>
                  <th>Status</th>
                  <th>Interval</th>
                  <th>Region</th>
                  <th>Activated</th>
                  <th />
                </tr>
              </thead>
              <tbody className="divide-y divide-border/60">
                {(slots.data ?? []).map((slot) => (
                  <tr key={slot.id}>
                    <td className="py-2 font-medium">
                      {String(slot.slotNumber).padStart(3, "0")}
                    </td>
                    <td>
                      <Badge variant={slot.status === "active" ? "default" : "secondary"}>
                        {slot.status}
                      </Badge>
                    </td>
                    <td>{slot.billingInterval}</td>
                    <td>{slot.pricingRegion}</td>
                    <td>
                      {slot.activatedAt ? new Date(slot.activatedAt).toLocaleDateString() : "—"}
                    </td>
                    <td className="py-2 text-right">
                      {slot.status === "active" || slot.status === "pending" ? (
                        <Button
                          size="sm"
                          variant="outline"
                          disabled={busy === slot.ownerId}
                          onClick={() => act(slot.ownerId, "release")}
                        >
                          Release
                        </Button>
                      ) : (
                        <Button
                          size="sm"
                          variant="outline"
                          disabled={busy === slot.ownerId}
                          onClick={() => act(slot.ownerId, "restore")}
                        >
                          Restore
                        </Button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {slots.data?.length === 0 && (
              <p className="py-6 text-center text-sm text-muted-foreground">
                No founder places have been claimed yet.
              </p>
            )}
          </div>
        </CardContent>
      </Card>

      {feedback.data && feedback.data.length > 0 && (
        <Card className="rounded-3xl border-border/70">
          <CardContent className="p-6">
            <h2 className="text-lg font-semibold">Founder feedback</h2>
            <ul className="mt-3 space-y-3 text-sm">
              {feedback.data.map((row) => (
                <li key={row.id} className="rounded-2xl border border-border/60 p-4">
                  <div className="flex flex-wrap gap-3 text-xs text-muted-foreground">
                    <span>#{String(row.slotNumber ?? 0).padStart(3, "0")}</span>
                    <span>Setup {row.setupEase ?? "—"}/5</span>
                    <span>NPS {row.recommendScore ?? "—"}</span>
                    <span>{new Date(row.createdAt).toLocaleDateString()}</span>
                  </div>
                  {row.nearlyStopped && <p className="mt-2">Blocked by: {row.nearlyStopped}</p>}
                  {row.mostImportantFeature && (
                    <p className="mt-1">Most important: {row.mostImportantFeature}</p>
                  )}
                  {row.missing && <p className="mt-1">Missing: {row.missing}</p>}
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
