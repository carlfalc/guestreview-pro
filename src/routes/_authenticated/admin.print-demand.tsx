import { useMemo, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { currentUserIsAdmin } from "@/lib/authorised-plan.functions";
import { adminPrintDemand, adminUpdatePrintInterest } from "@/lib/print-interest.functions";
import {
  demandThresholds,
  printInterestCsv,
  printProductLabel,
  PRINT_INTEREST_STATUSES,
  PRINT_INTEREST_STATUS_LABEL,
  summarisePrintDemand,
  type AdminPrintInterestRow,
  type DemandCount,
} from "@/lib/print-interest";

export const Route = createFileRoute("/_authenticated/admin/print-demand")({
  component: AdminPrintDemandPage,
  head: () => ({
    meta: [
      { title: "Admin · Print demand — GuestReview Pro" },
      {
        name: "description",
        content: "Print waitlist demand, product interest and conversion status.",
      },
      { property: "og:title", content: "Admin · Print demand — GuestReview Pro" },
      {
        property: "og:description",
        content: "Print waitlist demand, product interest and conversion status.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
});

function CountList({ title, items }: { title: string; items: DemandCount[] }) {
  return (
    <Card>
      <CardContent className="space-y-2 p-5">
        <h2 className="text-sm font-semibold">{title}</h2>
        {items.length === 0 ? (
          <p className="text-sm text-muted-foreground">No data yet.</p>
        ) : (
          <ul className="space-y-1 text-sm">
            {items.slice(0, 10).map((i) => (
              <li key={i.key} className="flex items-center justify-between gap-3">
                <span className="text-muted-foreground">{i.label}</span>
                <span className="font-medium tabular-nums">{i.count}</span>
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}

function AdminPrintDemandPage() {
  const isAdminFn = useServerFn(currentUserIsAdmin);
  const demandFn = useServerFn(adminPrintDemand);
  const updateFn = useServerFn(adminUpdatePrintInterest);
  const qc = useQueryClient();

  const isAdminQ = useQuery({ queryKey: ["is-admin"], queryFn: () => isAdminFn() });
  const demandQ = useQuery({
    queryKey: ["admin", "print-demand"],
    queryFn: () => demandFn(),
    enabled: isAdminQ.data === true,
  });

  const [statusFilter, setStatusFilter] = useState("all");
  const [productFilter, setProductFilter] = useState("all");
  const [search, setSearch] = useState("");
  const [notes, setNotes] = useState<Record<string, string>>({});

  const update = useMutation({
    mutationFn: (v: { id: string; status?: string; adminNotes?: string }) => updateFn({ data: v }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["admin", "print-demand"] });
      toast.success("Updated.");
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Update failed."),
  });

  const rows: AdminPrintInterestRow[] = demandQ.data?.rows ?? [];

  const filtered = useMemo(
    () =>
      rows.filter((r) => {
        if (statusFilter !== "all" && r.status !== statusFilter) return false;
        if (productFilter !== "all" && !r.productKeys.includes(productFilter)) return false;
        const q = search.trim().toLowerCase();
        if (!q) return true;
        return [r.email, r.businessName, r.countryCode, r.comments]
          .filter(Boolean)
          .some((v) => String(v).toLowerCase().includes(q));
      }),
    [rows, statusFilter, productFilter, search],
  );

  const summary = useMemo(() => summarisePrintDemand(filtered), [filtered]);
  const thresholds = useMemo(() => demandThresholds(summary), [summary]);

  const exportCsv = () => {
    const blob = new Blob([printInterestCsv(filtered)], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `print-demand-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  if (isAdminQ.isLoading) return <p className="p-8 text-sm text-muted-foreground">Loading…</p>;
  if (isAdminQ.data !== true)
    return <p className="p-8 text-sm text-muted-foreground">Administrators only.</p>;

  return (
    <div className="mx-auto w-full max-w-6xl space-y-6 px-4 py-8">
      <header className="space-y-1">
        <h1 className="text-2xl font-semibold tracking-tight">Print demand</h1>
        <p className="text-sm text-muted-foreground">
          Waitlist signal for the paused Print Store. Internal planning only.
        </p>
      </header>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {[
          { label: "Interested accounts", value: summary.totalAccounts },
          { label: "Submissions", value: summary.totalSubmissions },
          { label: "Contact consent", value: summary.consentedAccounts },
          {
            label: "Most requested bundle",
            value: summary.mostRequestedBundle
              ? `${summary.mostRequestedBundle.label} (${summary.mostRequestedBundle.count})`
              : "—",
          },
        ].map((s) => (
          <Card key={s.label}>
            <CardContent className="space-y-1 p-5">
              <p className="text-xs text-muted-foreground">{s.label}</p>
              <p className="text-xl font-semibold">{s.value}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      <Card>
        <CardContent className="space-y-2 p-5">
          <h2 className="text-sm font-semibold">Funnel</h2>
          <div className="grid gap-2 sm:grid-cols-5">
            {(demandQ.data?.funnel ?? []).map((f) => (
              <div key={f.step} className="rounded-md border border-border/60 p-3">
                <p className="text-xs text-muted-foreground">{f.label}</p>
                <p className="text-lg font-semibold tabular-nums">{f.accounts}</p>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="space-y-2 p-5">
          <h2 className="text-sm font-semibold">Decision thresholds (internal)</h2>
          <ul className="space-y-1 text-sm">
            {thresholds.map((t) => (
              <li key={t.key} className="flex items-center justify-between gap-3">
                <span className="text-muted-foreground">
                  {t.title} — {t.detail}
                </span>
                <Badge variant={t.met ? "default" : "secondary"}>
                  {t.actual}/{t.target}
                </Badge>
              </li>
            ))}
          </ul>
        </CardContent>
      </Card>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        <CountList title="Demand by product" items={summary.byProduct} />
        <CountList title="Demand by country" items={summary.byCountry} />
        <CountList title="Business industries" items={summary.byIndustry} />
        <CountList title="Expected quantities" items={summary.byQuantity} />
        <CountList title="Requested timeframes" items={summary.byTimeframe} />
        <CountList title="Conversion status" items={summary.byStatus} />
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <Input
          className="max-w-xs"
          placeholder="Search email, business, country…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-44">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All statuses</SelectItem>
            {PRINT_INTEREST_STATUSES.map((s) => (
              <SelectItem key={s} value={s}>
                {PRINT_INTEREST_STATUS_LABEL[s]}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={productFilter} onValueChange={setProductFilter}>
          <SelectTrigger className="w-56">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All products</SelectItem>
            {summary.byProduct.map((p) => (
              <SelectItem key={p.key} value={p.key}>
                {p.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Button variant="outline" onClick={exportCsv}>
          Export CSV
        </Button>
      </div>

      <div className="space-y-3">
        {demandQ.isLoading && <p className="text-sm text-muted-foreground">Loading demand…</p>}
        {!demandQ.isLoading && filtered.length === 0 && (
          <p className="text-sm text-muted-foreground">No interest records match these filters.</p>
        )}
        {filtered.map((r) => (
          <Card key={r.id}>
            <CardContent className="space-y-3 p-5">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="space-y-0.5">
                  <p className="font-medium">
                    {r.businessName ?? "No business selected"}{" "}
                    <span className="text-muted-foreground">· {r.email}</span>
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {new Date(r.createdAt).toLocaleString()} · source {r.source}
                    {r.countryCode ? ` · ${r.countryCode}` : ""}
                    {r.businessIndustry ? ` · ${r.businessIndustry}` : ""} ·{" "}
                    {r.contactConsent ? "consented to contact" : "no contact consent"}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <Select
                    value={r.status}
                    onValueChange={(status) => update.mutate({ id: r.id, status })}
                  >
                    <SelectTrigger className="w-40">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {PRINT_INTEREST_STATUSES.map((s) => (
                        <SelectItem key={s} value={s}>
                          {PRINT_INTEREST_STATUS_LABEL[s]}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Button
                    variant="secondary"
                    onClick={() => update.mutate({ id: r.id, status: "converted" })}
                    disabled={r.status === "converted"}
                  >
                    Mark converted
                  </Button>
                  {r.businessId && (
                    <Button asChild variant="ghost">
                      <Link to="/businesses/$id" params={{ id: r.businessId }}>
                        Open business
                      </Link>
                    </Button>
                  )}
                </div>
              </div>

              <div className="flex flex-wrap gap-1.5">
                {r.productKeys.map((k) => (
                  <Badge key={k} variant="outline">
                    {printProductLabel(k)}
                  </Badge>
                ))}
              </div>

              <p className="text-sm text-muted-foreground">
                {[r.expectedQuantity, r.preferredSize, r.preferredMaterial, r.desiredTimeframe]
                  .filter(Boolean)
                  .join(" · ") || "No additional preferences"}
              </p>
              {r.comments && <p className="text-sm">{r.comments}</p>}

              <div className="flex items-center gap-2">
                <Input
                  placeholder="Internal notes"
                  defaultValue={r.adminNotes ?? ""}
                  onChange={(e) => setNotes((n) => ({ ...n, [r.id]: e.target.value }))}
                />
                <Button
                  variant="outline"
                  onClick={() =>
                    update.mutate({ id: r.id, adminNotes: notes[r.id] ?? r.adminNotes ?? "" })
                  }
                >
                  Save note
                </Button>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
