import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogTrigger } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Globe, Lock, MessageCircleQuestion, CheckCircle2, Clock, XCircle } from "lucide-react";
import { toast } from "sonner";
import {
  createRegionCorrectionRequest,
  listMyRegionCorrectionRequests,
  type AccountRegionDTO,
} from "@/lib/account-region.functions";
import { SUPPORTED_COUNTRIES } from "@/lib/regions";
import { RegionDetectionStatus } from "./RegionDetectionStatus";

export function AccountRegionCard({ region }: { region: AccountRegionDTO }) {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [country, setCountry] = useState("");
  const [reason, setReason] = useState("");
  const [supporting, setSupporting] = useState("");

  const listRequests = useServerFn(listMyRegionCorrectionRequests);
  const requestsQ = useQuery({
    queryKey: ["region-correction-requests"],
    queryFn: () => listRequests(),
  });

  const submitCorrection = useServerFn(createRegionCorrectionRequest);
  const submit = useMutation({
    mutationFn: () => submitCorrection({
      data: {
        requestedCountryCode: country,
        reason,
        supportingInformation: supporting || undefined,
      },
    }),
    onSuccess: () => {
      toast.success("Correction request submitted. Your currency will not change until it's reviewed.");
      setOpen(false);
      setCountry(""); setReason(""); setSupporting("");
      qc.invalidateQueries({ queryKey: ["region-correction-requests"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const countryOptions = useMemo(
    () => [...SUPPORTED_COUNTRIES].sort((a, b) => a.countryName.localeCompare(b.countryName)),
    [],
  );

  return (
    <Card className="rounded-3xl border-border/70 shadow-[var(--shadow-card)]">
      <CardContent className="space-y-6 p-6">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="grid h-11 w-11 place-items-center rounded-2xl bg-accent text-primary">
              <Globe className="h-5 w-5" />
            </div>
            <div>
              <h2 className="text-lg font-semibold tracking-tight">Billing region</h2>
              <p className="text-xs text-muted-foreground">
                Assigned automatically from trusted account signals.
              </p>
            </div>
          </div>
          <Badge variant="secondary" className="rounded-full gap-1"><Lock className="h-3 w-3" /> Locked</Badge>
        </div>

        <div className="grid gap-4 sm:grid-cols-3">
          <ReadOnly label="Country">
            {region.countryName} <span className="text-muted-foreground">({region.countryCode})</span>
          </ReadOnly>
          <ReadOnly label="Currency">
            {region.currencyCode} — {region.currencyName}
          </ReadOnly>
          <ReadOnly label="Pricing region">{region.pricingRegion}</ReadOnly>
        </div>

        <p className="rounded-xl bg-accent/40 p-3 text-xs text-muted-foreground">
          Your country and billing currency are assigned automatically based on your account and billing location. You cannot change them from settings — this keeps subscription pricing consistent and prevents accidental currency changes when travelling.
        </p>

        <RegionDetectionStatus region={region} />

        <div className="flex flex-wrap items-center justify-between gap-2 border-t border-border pt-4">
          <p className="text-xs text-muted-foreground">
            Think this is wrong? You can request a correction — our team reviews each request manually.
          </p>
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
              <Button variant="outline" className="rounded-full">
                <MessageCircleQuestion className="mr-1 h-4 w-4" /> Request a correction
              </Button>
            </DialogTrigger>
            <DialogContent className="rounded-3xl sm:max-w-lg">
              <DialogHeader>
                <DialogTitle>Request billing region correction</DialogTitle>
              </DialogHeader>
              <div className="space-y-3">
                <div className="space-y-1.5">
                  <Label>Requested country</Label>
                  <Select value={country} onValueChange={setCountry}>
                    <SelectTrigger className="rounded-xl"><SelectValue placeholder="Select country" /></SelectTrigger>
                    <SelectContent>
                      {countryOptions.map((c) => (
                        <SelectItem key={c.countryCode} value={c.countryCode}>
                          {c.countryName} ({c.currencyCode})
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label>Reason</Label>
                  <Input value={reason} onChange={(e) => setReason(e.target.value)} placeholder="e.g. We operate from New Zealand, not the US." className="rounded-xl" />
                </div>
                <div className="space-y-1.5">
                  <Label>Supporting details (optional)</Label>
                  <Textarea value={supporting} onChange={(e) => setSupporting(e.target.value)} placeholder="Business address, VAT number, etc." className="rounded-xl" />
                </div>
                <p className="text-[11px] text-muted-foreground">
                  Your currency will not change until the request is reviewed.
                </p>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setOpen(false)} className="rounded-full">Cancel</Button>
                <Button
                  onClick={() => submit.mutate()}
                  disabled={submit.isPending || !country || reason.trim().length < 5}
                  className="rounded-full"
                >
                  {submit.isPending ? "Submitting…" : "Submit request"}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>

        {requestsQ.data && requestsQ.data.length > 0 && (
          <div className="space-y-2 border-t border-border pt-4">
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Your correction requests</p>
            <ul className="space-y-1.5">
              {requestsQ.data.map((r) => (
                <li key={r.id} className="flex items-center justify-between rounded-xl bg-accent/40 px-3 py-2 text-xs">
                  <span>
                    {r.current_country_code ?? "—"} → <span className="font-medium">{r.requested_country_code}</span>
                    <span className="ml-2 text-muted-foreground">
                      {new Date(r.created_at).toLocaleDateString()}
                    </span>
                  </span>
                  <StatusPill status={r.status} />
                </li>
              ))}
            </ul>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function ReadOnly({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="rounded-xl border border-border/60 bg-background/60 p-3">
      <p className="text-[10px] uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className="mt-0.5 text-sm font-medium">{children}</p>
    </div>
  );
}

function StatusPill({ status }: { status: string }) {
  if (status === "approved") return <span className="inline-flex items-center gap-1 text-emerald-600"><CheckCircle2 className="h-3.5 w-3.5" /> Approved</span>;
  if (status === "rejected") return <span className="inline-flex items-center gap-1 text-destructive"><XCircle className="h-3.5 w-3.5" /> Rejected</span>;
  return <span className="inline-flex items-center gap-1 text-muted-foreground"><Clock className="h-3.5 w-3.5" /> Pending</span>;
}
