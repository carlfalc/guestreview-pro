import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { format, subDays } from "date-fns";
import { Download, AlertCircle, BarChart3 } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/analytics")({
  component: AnalyticsPage,
});

interface ScanEventRow {
  id: string;
  created_at: string;
  qr_code_id: string | null;
  business_id: string | null;
  location_id: string | null;
  campaign: string | null;
  destination_type: string | null;
  device_type: string | null;
  browser: string | null;
  os: string | null;
  timezone: string | null;
  country_code: string | null;
  country_name: string | null;
  session_id: string | null;
  clicked_review: boolean | null;
  clicked_review_at: string | null;
  destination_clicked: boolean | null;
  destination_clicked_at: string | null;
}

interface QrLookup {
  id: string;
  label: string | null;
  scans_count: number;
  businesses: { name: string | null } | null;
  locations: { name: string | null } | null;
}

function AnalyticsPage() {
  const { data, isLoading, isError, refetch, isFetching } = useQuery({
    queryKey: ["analytics"],
    queryFn: async () => {
      const since = subDays(new Date(), 30).toISOString();
      const [eventsRes, qrRes] = await Promise.all([
        supabase
          .from("scan_events")
          .select(
            "id, created_at, qr_code_id, business_id, location_id, campaign, destination_type, device_type, browser, os, timezone, country_code, country_name, session_id, clicked_review, clicked_review_at, destination_clicked, destination_clicked_at",
          )
          .gte("created_at", since)
          .order("created_at", { ascending: false })
          .limit(10000),
        supabase
          .from("qr_codes")
          .select("id, label, scans_count, businesses(name), locations(name)")
          .order("scans_count", { ascending: false })
          .limit(50),
      ]);
      if (eventsRes.error) throw eventsRes.error;
      if (qrRes.error) throw qrRes.error;
      return {
        events: (eventsRes.data ?? []) as ScanEventRow[],
        qrs: (qrRes.data ?? []) as unknown as QrLookup[],
      };
    },
  });

  if (isLoading) {
    return (
      <div className="animate-fade-in-up space-y-6">
        <div className="h-10 w-56 rounded-xl bg-muted shimmer" />
        <div className="h-72 rounded-3xl bg-muted shimmer" />
        <div className="grid gap-6 lg:grid-cols-3">
          <div className="h-56 rounded-3xl bg-muted shimmer" />
          <div className="h-56 rounded-3xl bg-muted shimmer lg:col-span-2" />
        </div>
      </div>
    );
  }

  if (isError) {
    return (
      <Card className="mx-auto max-w-md rounded-3xl border-border/70">
        <CardContent className="flex flex-col items-center gap-3 p-8 text-center">
          <AlertCircle className="h-8 w-8 text-destructive" />
          <h2 className="text-lg font-semibold">Couldn't load analytics</h2>
          <p className="text-sm text-muted-foreground">Please try again in a moment.</p>
          <Button onClick={() => refetch()} className="rounded-full">Retry</Button>
        </CardContent>
      </Card>
    );
  }

  const events = data?.events ?? [];
  const qrs = data?.qrs ?? [];
  const qrById = new Map(qrs.map((q) => [q.id, q]));

  // Metric computations
  const totalScans = events.length;
  // Unique QR scan sessions = distinct (session_id, qr_code_id) pairs
  const qrSessionSet = new Set<string>();
  const visitorSet = new Set<string>();
  events.forEach((e) => {
    if (e.session_id && e.qr_code_id) qrSessionSet.add(`${e.session_id}::${e.qr_code_id}`);
    if (e.session_id) visitorSet.add(e.session_id);
  });
  const uniqueQrSessions = qrSessionSet.size || totalScans;
  const uniqueVisitors = visitorSet.size || totalScans;
  const destinationClicks = events.filter((e) => e.destination_clicked).length;
  const destinationCtr = uniqueQrSessions > 0 ? (destinationClicks / uniqueQrSessions) * 100 : 0;
  const reviewScans = events.filter((e) => e.destination_type === "google_review");
  const reviewClicks = reviewScans.filter((e) => e.clicked_review).length;
  const reviewQrSessions = new Set(
    reviewScans.filter((e) => e.session_id && e.qr_code_id).map((e) => `${e.session_id}::${e.qr_code_id}`),
  ).size || reviewScans.length;
  const reviewCtr = reviewQrSessions > 0 ? (reviewClicks / reviewQrSessions) * 100 : 0;

  // Chart: scans over time
  const byDay = new Map<string, number>();
  for (let i = 29; i >= 0; i--) byDay.set(format(subDays(new Date(), i), "MMM d"), 0);
  const byDevice = new Map<string, number>();
  const byBrowser = new Map<string, number>();
  const byTimezone = new Map<string, number>();
  const byQr = new Map<string, number>();
  const byLocation = new Map<string, number>();
  const byCampaign = new Map<string, number>();

  events.forEach((e) => {
    const k = format(new Date(e.created_at), "MMM d");
    if (byDay.has(k)) byDay.set(k, (byDay.get(k) ?? 0) + 1);
    if (e.device_type) byDevice.set(e.device_type, (byDevice.get(e.device_type) ?? 0) + 1);
    if (e.browser) byBrowser.set(e.browser, (byBrowser.get(e.browser) ?? 0) + 1);
    if (e.timezone) byTimezone.set(e.timezone, (byTimezone.get(e.timezone) ?? 0) + 1);
    if (e.qr_code_id) {
      const q = qrById.get(e.qr_code_id);
      const label = q?.label ?? "Unknown QR";
      byQr.set(label, (byQr.get(label) ?? 0) + 1);
      const loc = q?.locations?.name;
      if (loc) byLocation.set(loc, (byLocation.get(loc) ?? 0) + 1);
    }
    if (e.campaign) byCampaign.set(e.campaign, (byCampaign.get(e.campaign) ?? 0) + 1);
  });

  const chart = Array.from(byDay.entries()).map(([date, scans]) => ({ date, scans }));
  const devices = Array.from(byDevice.entries()).map(([name, value]) => ({ name, value }));
  const browsers = Array.from(byBrowser.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 6)
    .map(([name, value]) => ({ name, value }));
  const timezones = Array.from(byTimezone.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 6)
    .map(([name, value]) => ({ name, value }));
  const topQr = Array.from(byQr.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 8)
    .map(([label, scans]) => ({ label, scans }));
  const topLoc = Array.from(byLocation.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 8)
    .map(([label, scans]) => ({ label, scans }));
  const topCampaign = Array.from(byCampaign.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 8)
    .map(([label, scans]) => ({ label, scans }));

  const CHART_COLORS = [
    "var(--color-chart-1)",
    "var(--color-chart-2)",
    "var(--color-chart-3)",
    "var(--color-chart-4)",
    "var(--color-chart-5)",
  ];

  function exportCsv() {
    const rows = [[
      "scan_date",
      "qr_label",
      "business",
      "location",
      "campaign",
      "device",
      "browser",
      "os",
      "timezone",
      "country_code",
      "review_button_clicked",
      "review_click_timestamp",
    ]];
    events.forEach((e) => {
      const q = e.qr_code_id ? qrById.get(e.qr_code_id) : null;
      rows.push([
        String(e.created_at ?? ""),
        String(q?.label ?? ""),
        String(q?.businesses?.name ?? ""),
        String(q?.locations?.name ?? ""),
        String(e.campaign ?? ""),
        String(e.device_type ?? ""),
        String(e.browser ?? ""),
        String(e.os ?? ""),
        String(e.timezone ?? ""),
        String(e.country_code ?? ""),
        String(e.clicked_review ?? false),
        String(e.clicked_review_at ?? ""),
      ]);
    });
    const csv = rows.map((r) => r.map((c) => `"${c.replace(/"/g, '""')}"`).join(",")).join("\n");
    const url = URL.createObjectURL(new Blob([csv], { type: "text/csv" }));
    const a = document.createElement("a");
    a.href = url;
    a.download = "analytics.csv";
    a.click();
    toast.success("CSV exported");
  }

  if (totalScans === 0) {
    return (
      <div className="animate-fade-in-up space-y-8">
        <div>
          <h1 className="text-3xl font-semibold tracking-tight">Analytics</h1>
          <p className="mt-1 text-sm text-muted-foreground">Last 30 days of scan activity.</p>
        </div>
        <Card className="rounded-3xl border-border/70">
          <CardContent className="flex flex-col items-center gap-3 p-12 text-center">
            <BarChart3 className="h-10 w-10 text-muted-foreground" />
            <h2 className="text-lg font-semibold">No scans yet</h2>
            <p className="max-w-sm text-sm text-muted-foreground">
              Once guests scan your QR codes, you'll see scan volume, device breakdowns and review-click metrics here.
            </p>
            <Button variant="outline" onClick={() => refetch()} className="rounded-full">Refresh</Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="animate-fade-in-up space-y-8">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-3xl font-semibold tracking-tight">Analytics</h1>
          <p className="mt-1 text-sm text-muted-foreground">Last 30 days of scan activity.</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => refetch()} disabled={isFetching} className="rounded-full bg-card">
            Refresh
          </Button>
          <Button onClick={exportCsv} variant="outline" className="rounded-full bg-card">
            <Download className="mr-1 h-4 w-4"/> Export CSV
          </Button>
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <MetricCard label="Total scans" value={totalScans.toLocaleString()} />
        <MetricCard label="Unique QR scan sessions" value={uniqueQrSessions.toLocaleString()} sublabel="session × QR pairs" />
        <MetricCard label="Unique visitors" value={uniqueVisitors.toLocaleString()} sublabel="distinct sessions" />
        <MetricCard label="Destination clicks" value={destinationClicks.toLocaleString()} />
      </div>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <MetricCard label="Destination click-through rate" value={`${destinationCtr.toFixed(1)}%`} sublabel="clicks ÷ unique QR sessions" />
        <MetricCard label="Google review clicks" value={reviewClicks.toLocaleString()} />
        <MetricCard label="Google review click-through rate" value={`${reviewCtr.toFixed(1)}%`} sublabel="review clicks ÷ review QR sessions" />
      </div>

      <Card className="rounded-3xl border-border/70 shadow-[var(--shadow-card)]">
        <CardContent className="p-6">
          <h3 className="text-lg font-semibold tracking-tight">Scans over time</h3>
          <div className="mt-4 h-72">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={chart}>
                <defs>
                  <linearGradient id="a1" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="var(--color-chart-1)" stopOpacity={0.4}/>
                    <stop offset="100%" stopColor="var(--color-chart-1)" stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--color-border)"/>
                <XAxis dataKey="date" tick={{ fontSize: 11 }} interval={4} axisLine={false} tickLine={false}/>
                <YAxis tick={{ fontSize: 11 }} axisLine={false} tickLine={false} width={30}/>
                <Tooltip contentStyle={{ background: "var(--color-card)", border: "1px solid var(--color-border)", borderRadius: 12, fontSize: 12 }}/>
                <Area type="monotone" dataKey="scans" stroke="var(--color-chart-1)" strokeWidth={2} fill="url(#a1)"/>
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-6 lg:grid-cols-3">
        <Card className="rounded-3xl border-border/70">
          <CardContent className="p-6">
            <h3 className="font-semibold tracking-tight">Devices</h3>
            <div className="mt-4 h-56">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie data={devices} dataKey="value" nameKey="name" innerRadius={45} outerRadius={80} paddingAngle={2}>
                    {devices.map((_, i) => <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]}/>)}
                  </Pie>
                  <Tooltip contentStyle={{ background: "var(--color-card)", border: "1px solid var(--color-border)", borderRadius: 12, fontSize: 12 }}/>
                </PieChart>
              </ResponsiveContainer>
            </div>
            <Legend items={devices} colors={CHART_COLORS} />
          </CardContent>
        </Card>

        <Card className="rounded-3xl border-border/70 lg:col-span-2">
          <CardContent className="p-6">
            <h3 className="font-semibold tracking-tight">Top performing QR codes</h3>
            {topQr.length === 0 ? (
              <EmptyRow />
            ) : (
              <div className="mt-4 h-56">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={topQr} layout="vertical">
                    <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="var(--color-border)"/>
                    <XAxis type="number" tick={{ fontSize: 11 }} axisLine={false} tickLine={false}/>
                    <YAxis type="category" dataKey="label" width={140} tick={{ fontSize: 11 }} axisLine={false} tickLine={false}/>
                    <Tooltip contentStyle={{ background: "var(--color-card)", border: "1px solid var(--color-border)", borderRadius: 12, fontSize: 12 }}/>
                    <Bar dataKey="scans" fill="var(--color-chart-1)" radius={[0, 6, 6, 0]}/>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <ListCard title="Top locations" rows={topLoc} />
        <ListCard title="Top campaigns" rows={topCampaign} />
        <ListCard title="Timezone regions" rows={timezones.map((t) => ({ label: t.name, scans: t.value }))} />
      </div>

      <Card className="rounded-3xl border-border/70">
        <CardContent className="p-6">
          <h3 className="font-semibold tracking-tight">Browsers</h3>
          <ListRows rows={browsers.map((b) => ({ label: b.name, scans: b.value }))} />
        </CardContent>
      </Card>
    </div>
  );
}

function MetricCard({ label, value, sublabel }: { label: string; value: string; sublabel?: string }) {
  return (
    <Card className="rounded-3xl border-border/70 shadow-[var(--shadow-card)]">
      <CardContent className="p-5">
        <p className="text-xs uppercase tracking-wide text-muted-foreground">{label}</p>
        <p className="mt-1 text-3xl font-semibold tracking-tight">{value}</p>
        {sublabel && <p className="mt-1 text-[11px] text-muted-foreground">{sublabel}</p>}
      </CardContent>
    </Card>
  );
}

function Legend({ items, colors }: { items: { name: string; value: number }[]; colors: string[] }) {
  return (
    <div className="mt-2 space-y-1 text-xs">
      {items.map((d, i) => (
        <div key={d.name} className="flex justify-between">
          <span className="flex items-center gap-2">
            <span className="h-2 w-2 rounded-full" style={{ background: colors[i % colors.length] }}/>
            {d.name}
          </span>
          <span className="text-muted-foreground">{d.value}</span>
        </div>
      ))}
    </div>
  );
}

function ListCard({ title, rows }: { title: string; rows: { label: string; scans: number }[] }) {
  return (
    <Card className="rounded-3xl border-border/70">
      <CardContent className="p-6">
        <h3 className="font-semibold tracking-tight">{title}</h3>
        {rows.length === 0 ? <EmptyRow /> : <ListRows rows={rows} />}
      </CardContent>
    </Card>
  );
}

function ListRows({ rows }: { rows: { label: string; scans: number }[] }) {
  const max = Math.max(...rows.map((r) => r.scans), 1);
  return (
    <div className="mt-4 space-y-2">
      {rows.map((r) => (
        <div key={r.label} className="space-y-1">
          <div className="flex justify-between text-xs">
            <span className="truncate">{r.label}</span>
            <span className="text-muted-foreground">{r.scans}</span>
          </div>
          <div className="h-1.5 overflow-hidden rounded-full bg-accent">
            <div className="h-full rounded-full" style={{ width: `${(r.scans / max) * 100}%`, background: "var(--color-chart-1)" }} />
          </div>
        </div>
      ))}
    </div>
  );
}

function EmptyRow() {
  return <p className="mt-6 text-center text-xs text-muted-foreground">No data yet</p>;
}
