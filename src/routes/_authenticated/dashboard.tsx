import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Building2,
  QrCode,
  MousePointerClick,
  Star,
  TrendingUp,
  Plus,
} from "lucide-react";
import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { format, subDays } from "date-fns";

export const Route = createFileRoute("/_authenticated/dashboard")({
  component: Dashboard,
});

function Dashboard() {
  const { data: stats } = useQuery({
    queryKey: ["dashboard-stats"],
    queryFn: async () => {
      const [biz, qr, scans, clicks, recent] = await Promise.all([
        supabase.from("businesses").select("id", { count: "exact", head: true }),
        supabase.from("qr_codes").select("id", { count: "exact", head: true }).eq("status", "active"),
        supabase.from("scan_events").select("id", { count: "exact", head: true }),
        supabase.from("scan_events").select("id", { count: "exact", head: true }).eq("clicked_review", true),
        supabase.from("scan_events").select("created_at, clicked_review").gte("created_at", subDays(new Date(), 30).toISOString()),
      ]);
      const byDay = new Map<string, { scans: number; clicks: number }>();
      for (let i = 29; i >= 0; i--) {
        const key = format(subDays(new Date(), i), "MMM d");
        byDay.set(key, { scans: 0, clicks: 0 });
      }
      (recent.data ?? []).forEach((r) => {
        const key = format(new Date(r.created_at as string), "MMM d");
        const cur = byDay.get(key);
        if (cur) {
          cur.scans++;
          if (r.clicked_review) cur.clicks++;
        }
      });
      return {
        businesses: biz.count ?? 0,
        qrCodes: qr.count ?? 0,
        scans: scans.count ?? 0,
        clicks: clicks.count ?? 0,
        chart: Array.from(byDay.entries()).map(([date, v]) => ({ date, ...v })),
      };
    },
  });

  const cards = [
    { label: "Businesses", value: stats?.businesses ?? 0, icon: Building2 },
    { label: "Active QR codes", value: stats?.qrCodes ?? 0, icon: QrCode },
    { label: "Total scans", value: stats?.scans ?? 0, icon: MousePointerClick },
    { label: "Review clicks", value: stats?.clicks ?? 0, icon: Star },
  ];

  return (
    <div className="animate-fade-in-up space-y-8">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-3xl font-semibold tracking-tight">Dashboard</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            An overview of your locations, scans and reviews.
          </p>
        </div>
        <Link to="/businesses">
          <Button className="rounded-full">
            <Plus className="mr-1 h-4 w-4" /> New business
          </Button>
        </Link>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {cards.map((c) => (
          <Card
            key={c.label}
            className="rounded-2xl border-border/70 shadow-[var(--shadow-card)]"
          >
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                  {c.label}
                </span>
                <c.icon className="h-4 w-4 text-muted-foreground" />
              </div>
              <div className="mt-3 text-3xl font-semibold tracking-tight">
                {c.value.toLocaleString()}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <Card className="rounded-3xl border-border/70 shadow-[var(--shadow-card)]">
        <CardContent className="p-6">
          <div className="mb-6 flex items-center justify-between">
            <div>
              <h3 className="text-lg font-semibold tracking-tight">
                Scans, last 30 days
              </h3>
              <p className="text-xs text-muted-foreground">
                Total scans vs review clicks
              </p>
            </div>
            <div className="hidden items-center gap-2 rounded-full bg-accent px-3 py-1 text-xs text-accent-foreground sm:flex">
              <TrendingUp className="h-3.5 w-3.5" /> Live
            </div>
          </div>
          <div className="h-72 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={stats?.chart ?? []}>
                <defs>
                  <linearGradient id="scans" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="var(--color-chart-1)" stopOpacity={0.4} />
                    <stop offset="100%" stopColor="var(--color-chart-1)" stopOpacity={0} />
                  </linearGradient>
                  <linearGradient id="clicks" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="var(--color-chart-3)" stopOpacity={0.4} />
                    <stop offset="100%" stopColor="var(--color-chart-3)" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--color-border)" />
                <XAxis dataKey="date" tick={{ fontSize: 11 }} interval={4} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 11 }} axisLine={false} tickLine={false} width={30} />
                <Tooltip
                  contentStyle={{
                    background: "var(--color-card)",
                    border: "1px solid var(--color-border)",
                    borderRadius: 12,
                    fontSize: 12,
                  }}
                />
                <Area type="monotone" dataKey="scans" stroke="var(--color-chart-1)" strokeWidth={2} fill="url(#scans)" />
                <Area type="monotone" dataKey="clicks" stroke="var(--color-chart-3)" strokeWidth={2} fill="url(#clicks)" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
