import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { QrCode, ArrowRight } from "lucide-react";

export const Route = createFileRoute("/_authenticated/qr")({
  component: QrList,
});

function QrList() {
  const { data } = useQuery({
    queryKey: ["all-qr"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("qr_codes")
        .select("*, businesses(name, brand_primary), locations(name, location_type)")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  return (
    <div className="animate-fade-in-up space-y-8">
      <div>
        <h1 className="text-3xl font-semibold tracking-tight">QR codes</h1>
        <p className="mt-1 text-sm text-muted-foreground">All QR codes across your businesses.</p>
      </div>
      {data?.length ? (
        <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
          {data.map((q) => {
            const biz = q.businesses as { name?: string; brand_primary?: string } | null;
            const loc = q.locations as { name?: string; location_type?: string } | null;
            return (
              <Link key={q.id} to="/qr/$id" params={{ id: q.id }} className="group">
                <Card className="rounded-2xl border-border/70 transition hover:-translate-y-0.5 hover:shadow-[var(--shadow-card)]">
                  <CardContent className="flex items-center gap-3 p-4">
                    <div
                      className="grid h-11 w-11 place-items-center rounded-xl text-white"
                      style={{ background: biz?.brand_primary ?? "#0071e3" }}
                    >
                      <QrCode className="h-4 w-4"/>
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="truncate font-medium">{q.label}</p>
                      <p className="truncate text-xs text-muted-foreground">
                        {biz?.name} · {loc?.name ?? "No location"}
                      </p>
                    </div>
                    <div className="text-right">
                      <Badge variant="secondary" className="rounded-full">{q.scans_count} scans</Badge>
                      <ArrowRight className="ml-auto mt-1 h-3 w-3 text-muted-foreground transition group-hover:translate-x-0.5"/>
                    </div>
                  </CardContent>
                </Card>
              </Link>
            );
          })}
        </div>
      ) : (
        <Card className="rounded-3xl border-dashed">
          <CardContent className="flex flex-col items-center gap-3 py-16 text-center">
            <div className="grid h-14 w-14 place-items-center rounded-2xl bg-accent text-primary">
              <QrCode className="h-6 w-6"/>
            </div>
            <h3 className="text-lg font-semibold">No QR codes yet</h3>
            <p className="max-w-sm text-sm text-muted-foreground">
              Open a business and create your first QR code — it takes about 20 seconds.
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
