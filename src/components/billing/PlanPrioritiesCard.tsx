import { useEffect, useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { useBilling } from "@/hooks/use-billing";
import { markOverLimit } from "@/lib/entitlements";

type Row = { id: string; name: string; created_at: string; status: string };

/**
 * When an account holds more QR codes or businesses than its current plan
 * allows, nothing is paused — every QR code keeps scanning and redirecting.
 * The plan allowance only decides which records stay editable, and this panel
 * lets the owner choose which ones those are instead of defaulting to oldest.
 */
export function PlanPrioritiesCard() {
  const billing = useBilling();
  const qc = useQueryClient();
  const [saving, setSaving] = useState(false);
  const [qrId, setQrId] = useState<string | null>(null);
  const [bizId, setBizId] = useState<string | null>(null);

  const prefs = useQuery({
    queryKey: ["plan-priorities"],
    queryFn: async () => {
      const { data: auth } = await supabase.auth.getUser();
      const uid = auth.user?.id;
      if (!uid) return null;
      const [profile, qrs, bizs] = await Promise.all([
        supabase
          .from("profiles")
          .select("plan_primary_qr_id, plan_primary_business_id")
          .eq("id", uid)
          .maybeSingle(),
        supabase
          .from("qr_codes")
          .select("id, label, project_name, created_at, status")
          .eq("owner_id", uid)
          .eq("status", "active")
          .order("created_at", { ascending: true }),
        supabase
          .from("businesses")
          .select("id, name, created_at, status")
          .eq("owner_id", uid)
          .eq("status", "active")
          .order("created_at", { ascending: true }),
      ]);
      return {
        profile: (profile.data ?? {}) as {
          plan_primary_qr_id?: string | null;
          plan_primary_business_id?: string | null;
        },
        qrCodes: (qrs.data ?? []).map((q: Record<string, any>) => ({
          id: q.id,
          name: q.label || q.project_name || "Untitled QR",
          created_at: q.created_at,
          status: q.status,
        })) as Row[],
        businesses: (bizs.data ?? []) as Row[],
      };
    },
  });

  useEffect(() => {
    if (!prefs.data) return;
    setQrId(prefs.data.profile.plan_primary_qr_id ?? null);
    setBizId(prefs.data.profile.plan_primary_business_id ?? null);
  }, [prefs.data]);

  const qrMax = billing.entitlements.activeQrCodesMax;
  const bizMax = billing.entitlements.businessesMax;
  const qrRows = prefs.data?.qrCodes ?? [];
  const bizRows = prefs.data?.businesses ?? [];
  const qrOver = Number.isFinite(qrMax) && qrRows.length > qrMax;
  const bizOver = Number.isFinite(bizMax) && bizRows.length > bizMax;

  const qrPreview = useMemo(
    () => markOverLimit(qrRows, qrMax, { preferredIds: [qrId] }),
    [qrRows, qrMax, qrId],
  );
  const bizPreview = useMemo(
    () => markOverLimit(bizRows, bizMax, { preferredIds: [bizId] }),
    [bizRows, bizMax, bizId],
  );

  if (prefs.isLoading || (!qrOver && !bizOver)) return null;

  const save = async () => {
    setSaving(true);
    try {
      const { data: auth } = await supabase.auth.getUser();
      const uid = auth.user?.id;
      if (!uid) throw new Error("Not signed in");
      const { error } = await supabase
        .from("profiles")
        .update({ plan_primary_qr_id: qrId, plan_primary_business_id: bizId })
        .eq("id", uid);
      if (error) throw new Error(error.message);
      toast.success("Saved. Your chosen items stay editable.");
      qc.invalidateQueries({ queryKey: ["plan-priorities"] });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not save");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Card className="rounded-3xl border-amber-500/40">
      <CardContent className="space-y-5 p-6">
        <div>
          <h2 className="text-lg font-semibold">Choose what stays editable</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            You have more items than your current plan includes. Everything stays live — every QR
            code keeps scanning and redirecting to your review page. Pick which ones you want to
            keep editing; the rest become read-only until you upgrade.
          </p>
        </div>

        {qrOver && (
          <section className="space-y-2">
            <Label className="text-xs uppercase tracking-wider text-muted-foreground">
              QR codes ({qrRows.length} active, {qrMax} editable)
            </Label>
            <div className="grid gap-2">
              {qrPreview.map((row) => (
                <button
                  key={row.id}
                  type="button"
                  onClick={() => setQrId(row.id)}
                  className={`flex items-center justify-between gap-3 rounded-2xl border px-4 py-3 text-left text-sm transition ${
                    row.overLimit ? "border-border/50 opacity-70" : "border-primary/60 bg-primary/5"
                  }`}
                >
                  <span>{row.name}</span>
                  <Badge variant={row.overLimit ? "outline" : "default"}>
                    {row.overLimit ? "Read-only" : "Editable"}
                  </Badge>
                </button>
              ))}
            </div>
          </section>
        )}

        {bizOver && (
          <section className="space-y-2">
            <Label className="text-xs uppercase tracking-wider text-muted-foreground">
              Businesses ({bizRows.length} active, {bizMax} editable)
            </Label>
            <div className="grid gap-2">
              {bizPreview.map((row) => (
                <button
                  key={row.id}
                  type="button"
                  onClick={() => setBizId(row.id)}
                  className={`flex items-center justify-between gap-3 rounded-2xl border px-4 py-3 text-left text-sm transition ${
                    row.overLimit ? "border-border/50 opacity-70" : "border-primary/60 bg-primary/5"
                  }`}
                >
                  <span>{row.name}</span>
                  <Badge variant={row.overLimit ? "outline" : "default"}>
                    {row.overLimit ? "Read-only" : "Editable"}
                  </Badge>
                </button>
              ))}
            </div>
          </section>
        )}

        <Button onClick={save} disabled={saving}>
          {saving ? "Saving…" : "Save selection"}
        </Button>
      </CardContent>
    </Card>
  );
}
