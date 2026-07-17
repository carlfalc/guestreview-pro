import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import {
  currentUserIsAdmin,
  adminListRegionCorrectionRequests,
  adminApproveRegionCorrection,
  adminRejectRegionCorrection,
} from "@/lib/authorised-plan.functions";
import { countryName } from "@/lib/country-names";

export const Route = createFileRoute("/_authenticated/admin/region-requests")({
  component: AdminRegionRequestsPage,
  head: () => ({ meta: [{ title: "Admin · Region requests" }] }),
});

function AdminRegionRequestsPage() {
  const isAdminFn = useServerFn(currentUserIsAdmin);
  const isAdminQ = useQuery({ queryKey: ["is-admin"], queryFn: () => isAdminFn() });

  const listFn = useServerFn(adminListRegionCorrectionRequests);
  const listQ = useQuery({
    queryKey: ["admin", "region-correction-requests"],
    queryFn: () => listFn(),
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

  return (
    <div className="animate-fade-in-up space-y-6">
      <div>
        <h1 className="text-3xl font-semibold tracking-tight">Region correction requests</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Approve or reject account billing-region corrections.
        </p>
      </div>

      {listQ.isLoading ? (
        <Card className="rounded-3xl border-border/70">
          <CardContent className="p-6 text-sm text-muted-foreground">Loading requests…</CardContent>
        </Card>
      ) : (
        <div className="grid gap-4">
          {(listQ.data ?? []).map((r) => (
            <RequestCard key={r.id} req={r} />
          ))}
          {(listQ.data ?? []).length === 0 && (
            <Card className="rounded-3xl border-border/70">
              <CardContent className="p-6 text-sm text-muted-foreground">No requests yet.</CardContent>
            </Card>
          )}
        </div>
      )}
    </div>
  );
}

interface Req {
  id: string;
  owner_id: string;
  current_country_code: string | null;
  requested_country_code: string;
  reason: string;
  supporting_information: string | null;
  status: string;
  admin_notes: string | null;
  reviewed_by: string | null;
  reviewed_at: string | null;
  created_at: string;
}

function RequestCard({ req }: { req: Req }) {
  const qc = useQueryClient();
  const [notes, setNotes] = useState("");
  const approve = useServerFn(adminApproveRegionCorrection);
  const reject = useServerFn(adminRejectRegionCorrection);

  const approveMut = useMutation({
    mutationFn: () => approve({ data: { requestId: req.id, adminNotes: notes || undefined } }),
    onSuccess: () => {
      toast.success("Request approved.");
      qc.invalidateQueries({ queryKey: ["admin", "region-correction-requests"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });
  const rejectMut = useMutation({
    mutationFn: () => reject({ data: { requestId: req.id, adminNotes: notes || undefined } }),
    onSuccess: () => {
      toast.success("Request rejected.");
      qc.invalidateQueries({ queryKey: ["admin", "region-correction-requests"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const pending = req.status === "pending";
  const badgeVariant = useMemo(
    () => (req.status === "approved" ? "default" : req.status === "rejected" ? "destructive" : "secondary"),
    [req.status],
  );

  return (
    <Card className="rounded-3xl border-border/70 shadow-[var(--shadow-card)]">
      <CardContent className="space-y-4 p-6">
        <div className="flex flex-wrap items-center gap-3">
          <Badge variant={badgeVariant} className="capitalize">{req.status}</Badge>
          <span className="text-xs text-muted-foreground">{new Date(req.created_at).toLocaleString()}</span>
          <span className="text-xs text-muted-foreground">Owner: {req.owner_id.slice(0, 8)}…</span>
        </div>
        <div className="grid gap-2 text-sm sm:grid-cols-2">
          <div><span className="text-muted-foreground">Current: </span>{countryName(req.current_country_code) || "—"} ({req.current_country_code ?? "—"})</div>
          <div><span className="text-muted-foreground">Requested: </span>{countryName(req.requested_country_code)} ({req.requested_country_code})</div>
        </div>
        <div className="text-sm"><span className="text-muted-foreground">Reason: </span>{req.reason}</div>
        {req.supporting_information ? (
          <div className="text-sm"><span className="text-muted-foreground">Supporting: </span>{req.supporting_information}</div>
        ) : null}
        {req.admin_notes ? (
          <div className="text-sm"><span className="text-muted-foreground">Admin notes: </span>{req.admin_notes}</div>
        ) : null}
        {pending && (
          <div className="space-y-2">
            <Textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Admin notes (optional)"
              className="rounded-xl"
            />
            <div className="flex justify-end gap-2">
              <Button
                variant="outline"
                className="rounded-full"
                onClick={() => rejectMut.mutate()}
                disabled={rejectMut.isPending || approveMut.isPending}
              >Reject</Button>
              <Button
                className="rounded-full"
                onClick={() => approveMut.mutate()}
                disabled={approveMut.isPending || rejectMut.isPending}
              >Approve</Button>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
