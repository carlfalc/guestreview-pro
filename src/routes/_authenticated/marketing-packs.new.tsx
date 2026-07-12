import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ArrowLeft, ArrowRight, Check, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { useMemo, useState } from "react";
import { PACK_TYPES, defaultProjectName, type PackType } from "@/lib/marketing-packs";

export const Route = createFileRoute("/_authenticated/marketing-packs/new")({
  component: NewMarketingPack,
});

function NewMarketingPack() {
  const navigate = useNavigate();
  const [step, setStep] = useState(1);
  const [businessId, setBusinessId] = useState<string>("");
  const [qrId, setQrId] = useState<string>("");
  const [packType, setPackType] = useState<PackType>("essential");
  const [projectName, setProjectName] = useState<string>("");
  const [creating, setCreating] = useState(false);

  const { data: businesses } = useQuery({
    queryKey: ["businesses-min"],
    queryFn: async () => {
      const { data, error } = await supabase.from("businesses").select("id, name, brand_primary, logo_url").order("name");
      if (error) throw error;
      return data ?? [];
    },
  });

  const { data: qrs } = useQuery({
    queryKey: ["qr-for-business", businessId],
    enabled: !!businessId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("qr_codes")
        .select("id, label, short_code, destination_type, status")
        .eq("business_id", businessId)
        .neq("status", "archived")
        .order("updated_at", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });

  const business = useMemo(() => businesses?.find((b) => b.id === businessId) ?? null, [businesses, businessId]);
  const qr = useMemo(() => qrs?.find((q) => q.id === qrId) ?? null, [qrs, qrId]);

  function next() {
    if (step === 1 && !businessId) return toast.error("Choose a business");
    if (step === 2 && !qrId) return toast.error("Choose a QR code");
    if (step === 3 && !packType) return toast.error("Choose a starting pack");
    if (step === 4) {
      // moved into step 4 → auto-populate project name
      if (!projectName) setProjectName(defaultProjectName(packType, business?.name ?? ""));
    }
    setStep((s) => Math.min(5, s + 1));
  }
  function prev() { setStep((s) => Math.max(1, s - 1)); }

  async function create() {
    const finalName = projectName.trim() || defaultProjectName(packType, business?.name ?? "");
    const template = PACK_TYPES.find((p) => p.id === packType)!;
    setCreating(true);
    const { data: userData } = await supabase.auth.getUser();
    if (!userData.user) { setCreating(false); return toast.error("Not signed in"); }
    const { data, error } = await supabase
      .from("marketing_packs")
      .insert({
        owner_id: userData.user.id,
        business_id: businessId,
        qr_code_id: qrId,
        project_name: finalName,
        pack_type: packType,
        layout_template: template.layout,
        selected_formats: template.formatIds as unknown as never,
        headline: "Loved your visit?",
        support_text: "Scan to leave us a review.",
        cta_text: "Leave a review",
        status: "draft",
      } as never)
      .select("id")
      .single();
    setCreating(false);
    if (error || !data) return toast.error(error?.message ?? "Could not create pack");
    toast.success("Pack created");
    navigate({ to: "/marketing-packs/$id", params: { id: data.id } });
  }

  return (
    <div className="animate-fade-in-up space-y-6">
      <Link to="/marketing-packs" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft className="h-4 w-4"/> Back to packs
      </Link>

      <div className="flex items-center gap-3">
        {[1,2,3,4].map((n) => (
          <div key={n} className={`flex items-center gap-2 text-xs ${step >= n ? "text-foreground" : "text-muted-foreground"}`}>
            <div className={`grid h-6 w-6 place-items-center rounded-full text-[11px] ${step > n ? "bg-primary text-primary-foreground" : step === n ? "bg-primary/20 text-primary" : "bg-muted"}`}>
              {step > n ? <Check className="h-3 w-3"/> : n}
            </div>
            <span className="hidden sm:inline">{["Business","QR code","Starting pack","Project name"][n-1]}</span>
          </div>
        ))}
      </div>

      <Card className="rounded-3xl border-border/70 shadow-[var(--shadow-card)]">
        <CardContent className="space-y-6 p-6">
          {step === 1 && (
            <div className="space-y-3">
              <h2 className="text-lg font-semibold">Choose a business</h2>
              {(businesses ?? []).length === 0 && (
                <div className="rounded-2xl border border-dashed border-border/70 p-6 text-center text-sm text-muted-foreground">
                  You don't have any businesses yet. <Link to="/businesses" className="text-primary underline">Create one</Link> first.
                </div>
              )}
              <div className="grid gap-2 md:grid-cols-2">
                {(businesses ?? []).map((b) => (
                  <button
                    key={b.id}
                    type="button"
                    onClick={() => { setBusinessId(b.id); setQrId(""); }}
                    className={`flex items-center gap-3 rounded-2xl border p-4 text-left transition-colors ${businessId === b.id ? "border-primary bg-primary/5" : "border-border/70 hover:bg-accent/40"}`}
                  >
                    {b.logo_url ? (
                      <img src={b.logo_url} alt="" className="h-10 w-10 rounded-xl object-cover"/>
                    ) : (
                      <div className="h-10 w-10 rounded-xl" style={{ background: b.brand_primary ?? "hsl(var(--muted))" }}/>
                    )}
                    <div className="min-w-0"><p className="truncate text-sm font-medium">{b.name}</p></div>
                  </button>
                ))}
              </div>
            </div>
          )}

          {step === 2 && (
            <div className="space-y-3">
              <h2 className="text-lg font-semibold">Choose a QR code</h2>
              {(qrs ?? []).length === 0 && (
                <div className="rounded-2xl border border-dashed border-border/70 p-6 text-center text-sm text-muted-foreground">
                  No active QR codes for this business. <Link to="/qr" className="text-primary underline">Create one</Link>.
                </div>
              )}
              <div className="grid gap-2 md:grid-cols-2">
                {(qrs ?? []).map((q) => (
                  <button
                    key={q.id}
                    type="button"
                    onClick={() => setQrId(q.id)}
                    className={`flex items-center justify-between gap-3 rounded-2xl border p-4 text-left transition-colors ${qrId === q.id ? "border-primary bg-primary/5" : "border-border/70 hover:bg-accent/40"}`}
                  >
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium">{q.label ?? "Untitled QR"}</p>
                      <p className="mt-0.5 truncate text-[11px] text-muted-foreground">/{q.short_code} · {q.destination_type}</p>
                    </div>
                  </button>
                ))}
              </div>
            </div>
          )}

          {step === 3 && (
            <div className="space-y-3">
              <h2 className="text-lg font-semibold">Choose a starting pack</h2>
              <div className="grid gap-2 md:grid-cols-2">
                {PACK_TYPES.map((p) => (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() => setPackType(p.id)}
                    className={`rounded-2xl border p-4 text-left transition-colors ${packType === p.id ? "border-primary bg-primary/5" : "border-border/70 hover:bg-accent/40"}`}
                  >
                    <p className="text-sm font-semibold">{p.label}</p>
                    <p className="mt-1 text-xs text-muted-foreground">{p.description}</p>
                    <p className="mt-2 text-[10px] uppercase tracking-wide text-muted-foreground">{p.formatIds.length} format{p.formatIds.length === 1 ? "" : "s"}</p>
                  </button>
                ))}
              </div>
            </div>
          )}

          {step === 4 && (
            <div className="space-y-3">
              <h2 className="text-lg font-semibold">Project name</h2>
              <div className="space-y-1.5">
                <Label>Name</Label>
                <Input
                  value={projectName || defaultProjectName(packType, business?.name ?? "")}
                  onChange={(e) => setProjectName(e.target.value)}
                  className="rounded-xl"
                />
                <p className="text-[11px] text-muted-foreground">You can rename this later.</p>
              </div>
            </div>
          )}

          <div className="flex items-center justify-between border-t border-border pt-4">
            <Button variant="outline" onClick={prev} disabled={step === 1} className="rounded-full">
              <ArrowLeft className="mr-1 h-4 w-4"/> Back
            </Button>
            {step < 4 ? (
              <Button onClick={next} className="rounded-full">
                Next <ArrowRight className="ml-1 h-4 w-4"/>
              </Button>
            ) : (
              <Button onClick={create} disabled={creating} className="rounded-full">
                {creating ? <Loader2 className="mr-1 h-4 w-4 animate-spin"/> : null} Open editor
              </Button>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
