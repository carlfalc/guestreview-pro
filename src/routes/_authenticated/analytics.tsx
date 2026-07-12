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
import { Download } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/analytics")({
  component: AnalyticsPage,
});

function AnalyticsPage() {
  const { data } = useQuery({
    queryKey: ["analytics"],
    queryFn: async () => {
      const since = subDays(new Date(), 30).toISOString();
      const [events, byLoc] = await Promise.all([
        supabase.from("scan_events").select("*").gte("created_at", since).order("created_at", { ascending: false }).limit(5000),
        supabase.from("qr_codes").select("id, label, scans_count, locations(name)").order("scans_count", { ascending: false }).limit(10),
      ]);
      return { events: events.data ?? [], top: byLoc.data ?? [] };
    },
  });

  const byDay = new Map<string, number>();
  for (let i = 29; i >= 0; i--) byDay.set(format(subDays(new Date(), i), "MMM d"), 0);
  const byDevice = new Map<string, number>();
  const byBrowser = new Map<string, number>();
  const byCountry = new Map<string, number>();
  (data?.events ?? []).forEach((e) => {
    const k = format(new Date(e.created_at as string), "MMM d");
    byDay.set(k, (byDay.get(k) ?? 0) + 1);
    if (e.device_type) byDevice.set(e.device_type, (byDevice.get(e.device_type) ?? 0) + 1);
    if (e.browser) byBrowser.set(e.browser, (byBrowser.get(e.browser) ?? 0) + 1);
    if (e.country) byCountry.set(e.country, (byCountry.get(e.country) ?? 0) + 1);
  });
  const chart = Array.from(byDay.entries()).map(([date, scans]) => ({ date, scans }));
  const devices = Array.from(byDevice.entries()).map(([name, value]) => ({ name, value }));
  const CHART_COLORS = ["var(--color-chart-1)", "var(--color-chart-2)", "var(--color-chart-3)", "var(--color-chart-4)", "var(--color-chart-5)"];

  function exportCsv() {
    const rows = [["date", "device", "os", "browser", "country", "campaign", "clicked_review"]];
    (data?.events ?? []).forEach((e) => {
      rows.push([
        String(e.created_at ?? ""),
        String(e.device_type ?? ""),
        String(e.os ?? ""),
        String(e.browser ?? ""),
        String(e.country ?? ""),
        String(e.campaign ?? ""),
        String(e.clicked_review ?? ""),
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

  return (
    <div className="animate-fade-in-up space-y-8">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-3xl font-semibold tracking-tight">Analytics</h1>
          <p className="mt-1 text-sm text-muted-foreground">Last 30 days of scan activity.</p>
        </div>
        <Button onClick={exportCsv} variant="outline" className="rounded-full bg-card">
          <Download className="mr-1 h-4 w-4"/> Export CSV
        </Button>
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
            <div className="mt-2 space-y-1 text-xs">
              {devices.map((d, i) => (
                <div key={d.name} className="flex justify-between">
                  <span className="flex items-center gap-2">
                    <span className="h-2 w-2 rounded-full" style={{ background: CHART_COLORS[i % CHART_COLORS.length] }}/>
                    {d.name}
                  </span>
                  <span className="text-muted-foreground">{d.value}</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        <Card className="rounded-3xl border-border/70 lg:col-span-2">
          <CardContent className="p-6">
            <h3 className="font-semibold tracking-tight">Top performing QR codes</h3>
            <div className="mt-4 h-56">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={data?.top ?? []} layout="vertical">
                  <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="var(--color-border)"/>
                  <XAxis type="number" tick={{ fontSize: 11 }} axisLine={false} tickLine={false}/>
                  <YAxis type="category" dataKey="label" width={140} tick={{ fontSize: 11 }} axisLine={false} tickLine={false}/>
                  <Tooltip contentStyle={{ background: "var(--color-card)", border: "1px solid var(--color-border)", borderRadius: 12, fontSize: 12 }}/>
                  <Bar dataKey="scans_count" fill="var(--color-chart-1)" radius={[0, 6, 6, 0]}/>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
