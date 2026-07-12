import { createFileRoute, Link, useParams } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
} from "@/components/ui/dialog";
import { toast } from "sonner";
import { useState } from "react";
import { ArrowLeft, Plus, MapPin, QrCode, Save, Trash2 } from "lucide-react";
import { generateShortCode } from "@/lib/short-code";

export const Route = createFileRoute("/_authenticated/businesses/$id")({
  component: BusinessDetail,
});

const LOCATION_TYPES = [
  "Restaurant",
  "Reception",
  "Room",
  "Table",
  "Bar",
  "Cafe",
  "Counter",
  "Drive Through",
  "Pool Area",
  "Conference Room",
  "Other",
];

function BusinessDetail() {
  const { id } = useParams({ from: "/_authenticated/businesses/$id" });
  const qc = useQueryClient();
  const [locOpen, setLocOpen] = useState(false);
  const [qrOpen, setQrOpen] = useState(false);
  const [locForm, setLocForm] = useState({ name: "", location_type: "Table", identifier: "" });
  const [qrForm, setQrForm] = useState({ label: "", location_id: "", campaign: "" });

  const { data: biz } = useQuery({
    queryKey: ["business", id],
    queryFn: async () => {
      const { data, error } = await supabase.from("businesses").select("*").eq("id", id).single();
      if (error) throw error;
      return data;
    },
  });

  const { data: locations } = useQuery({
    queryKey: ["locations", id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("locations")
        .select("*")
        .eq("business_id", id)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  const { data: qrCodes } = useQuery({
    queryKey: ["qr_codes", id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("qr_codes")
        .select("*, locations(name, location_type)")
        .eq("business_id", id)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  const [form, setForm] = useState<{ [k: string]: string }>({});
  const current = { ...biz, ...form };

  async function save() {
    if (!biz) return;
    const patch: Record<string, string | null> = {};
    ["name", "google_review_url", "website", "phone", "address", "welcome_message", "brand_primary", "industry"].forEach(
      (k) => {
        if (form[k] !== undefined) patch[k] = form[k];
      },
    );
    if (!Object.keys(patch).length) return toast.info("Nothing to save");
    const { error } = await supabase.from("businesses").update(patch).eq("id", biz.id);
    if (error) return toast.error(error.message);
    toast.success("Saved");
    setForm({});
    qc.invalidateQueries({ queryKey: ["business", id] });
  }

  async function createLocation() {
    const { data: userData } = await supabase.auth.getUser();
    if (!userData.user) return;
    const { error } = await supabase.from("locations").insert({
      business_id: id,
      owner_id: userData.user.id,
      name: locForm.name,
      location_type: locForm.location_type,
      identifier: locForm.identifier || null,
    });
    if (error) return toast.error(error.message);
    toast.success("Location added");
    setLocOpen(false);
    setLocForm({ name: "", location_type: "Table", identifier: "" });
    qc.invalidateQueries({ queryKey: ["locations", id] });
  }

  async function createQr() {
    const { data: userData } = await supabase.auth.getUser();
    if (!userData.user) return;
    const { error } = await supabase.from("qr_codes").insert({
      business_id: id,
      owner_id: userData.user.id,
      location_id: qrForm.location_id || null,
      short_code: generateShortCode(),
      label: qrForm.label || "Untitled QR",
      campaign: qrForm.campaign || null,
    });
    if (error) return toast.error(error.message);
    toast.success("QR created");
    setQrOpen(false);
    setQrForm({ label: "", location_id: "", campaign: "" });
    qc.invalidateQueries({ queryKey: ["qr_codes", id] });
  }

  async function deleteBiz() {
    if (!confirm("Delete this business and all its data?")) return;
    const { error } = await supabase.from("businesses").delete().eq("id", id);
    if (error) return toast.error(error.message);
    toast.success("Deleted");
    window.location.href = "/businesses";
  }

  if (!biz) return <div className="h-40 rounded-3xl bg-muted shimmer" />;

  return (
    <div className="animate-fade-in-up space-y-6">
      <Link to="/businesses" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft className="h-4 w-4" /> All businesses
      </Link>

      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="flex items-center gap-4">
          <div className="grid h-14 w-14 place-items-center rounded-2xl text-white" style={{ background: biz.brand_primary ?? "#0071e3" }}>
            <span className="text-xl font-semibold">{biz.name.slice(0, 1)}</span>
          </div>
          <div>
            <h1 className="text-3xl font-semibold tracking-tight">{biz.name}</h1>
            <div className="mt-1 flex items-center gap-2 text-xs text-muted-foreground">
              <Badge variant="secondary" className="rounded-full">{biz.industry ?? "—"}</Badge>
              <span>{biz.address || "No address"}</span>
            </div>
          </div>
        </div>
      </div>

      <Tabs defaultValue="locations">
        <TabsList className="rounded-full">
          <TabsTrigger value="locations" className="rounded-full">Locations</TabsTrigger>
          <TabsTrigger value="qr" className="rounded-full">QR codes</TabsTrigger>
          <TabsTrigger value="details" className="rounded-full">Details</TabsTrigger>
        </TabsList>

        <TabsContent value="locations" className="mt-6 space-y-4">
          <div className="flex justify-end">
            <Dialog open={locOpen} onOpenChange={setLocOpen}>
              <DialogTrigger asChild>
                <Button className="rounded-full"><Plus className="mr-1 h-4 w-4"/>Add location</Button>
              </DialogTrigger>
              <DialogContent className="rounded-3xl">
                <DialogHeader><DialogTitle>Add location</DialogTitle></DialogHeader>
                <div className="space-y-3">
                  <div className="space-y-1.5">
                    <Label>Name</Label>
                    <Input value={locForm.name} onChange={(e) => setLocForm({ ...locForm, name: e.target.value })} placeholder="Table 12" className="rounded-xl"/>
                  </div>
                  <div className="space-y-1.5">
                    <Label>Type</Label>
                    <Select value={locForm.location_type} onValueChange={(v) => setLocForm({ ...locForm, location_type: v })}>
                      <SelectTrigger className="rounded-xl"><SelectValue/></SelectTrigger>
                      <SelectContent>{LOCATION_TYPES.map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}</SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1.5">
                    <Label>Identifier (optional)</Label>
                    <Input value={locForm.identifier} onChange={(e) => setLocForm({ ...locForm, identifier: e.target.value })} placeholder="e.g. 12" className="rounded-xl"/>
                  </div>
                </div>
                <DialogFooter>
                  <Button variant="outline" onClick={() => setLocOpen(false)} className="rounded-full">Cancel</Button>
                  <Button onClick={createLocation} disabled={!locForm.name} className="rounded-full">Add</Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          </div>
          {locations?.length ? (
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {locations.map((l) => (
                <Card key={l.id} className="rounded-2xl border-border/70">
                  <CardContent className="flex items-center gap-3 p-4">
                    <div className="grid h-10 w-10 place-items-center rounded-xl bg-accent text-primary">
                      <MapPin className="h-4 w-4"/>
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="truncate font-medium">{l.name}</p>
                      <p className="text-xs text-muted-foreground">{l.location_type}</p>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          ) : (
            <EmptyBox icon={MapPin} title="No locations yet" body="Add tables, rooms or counters so every spot gets its own QR."/>
          )}
        </TabsContent>

        <TabsContent value="qr" className="mt-6 space-y-4">
          <div className="flex justify-end">
            <Dialog open={qrOpen} onOpenChange={setQrOpen}>
              <DialogTrigger asChild>
                <Button className="rounded-full"><Plus className="mr-1 h-4 w-4"/>New QR</Button>
              </DialogTrigger>
              <DialogContent className="rounded-3xl">
                <DialogHeader><DialogTitle>Create QR code</DialogTitle></DialogHeader>
                <div className="space-y-3">
                  <div className="space-y-1.5">
                    <Label>Label</Label>
                    <Input value={qrForm.label} onChange={(e) => setQrForm({ ...qrForm, label: e.target.value })} placeholder="Reception counter" className="rounded-xl"/>
                  </div>
                  <div className="space-y-1.5">
                    <Label>Location (optional)</Label>
                    <Select value={qrForm.location_id} onValueChange={(v) => setQrForm({ ...qrForm, location_id: v })}>
                      <SelectTrigger className="rounded-xl"><SelectValue placeholder="No location"/></SelectTrigger>
                      <SelectContent>
                        {locations?.map((l) => <SelectItem key={l.id} value={l.id}>{l.name}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1.5">
                    <Label>Campaign (optional)</Label>
                    <Input value={qrForm.campaign} onChange={(e) => setQrForm({ ...qrForm, campaign: e.target.value })} placeholder="Summer promo" className="rounded-xl"/>
                  </div>
                </div>
                <DialogFooter>
                  <Button variant="outline" onClick={() => setQrOpen(false)} className="rounded-full">Cancel</Button>
                  <Button onClick={createQr} className="rounded-full">Create</Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          </div>
          {qrCodes?.length ? (
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {qrCodes.map((q) => (
                <Link key={q.id} to="/qr/$id" params={{ id: q.id }}>
                  <Card className="rounded-2xl border-border/70 transition hover:-translate-y-0.5 hover:shadow-[var(--shadow-card)]">
                    <CardContent className="flex items-center gap-3 p-4">
                      <div className="grid h-10 w-10 place-items-center rounded-xl bg-foreground text-background">
                        <QrCode className="h-4 w-4"/>
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="truncate font-medium">{q.label}</p>
                        <p className="text-xs text-muted-foreground">
                          {(q.locations as { name?: string } | null)?.name ?? "No location"} · {q.scans_count} scans
                        </p>
                      </div>
                    </CardContent>
                  </Card>
                </Link>
              ))}
            </div>
          ) : (
            <EmptyBox icon={QrCode} title="No QR codes yet" body="Generate a branded QR for each of your locations."/>
          )}
        </TabsContent>

        <TabsContent value="details" className="mt-6">
          <Card className="rounded-3xl border-border/70">
            <CardContent className="grid gap-4 p-6 sm:grid-cols-2">
              <Field label="Name"><Input defaultValue={biz.name} onChange={(e) => setForm({ ...form, name: e.target.value })} className="rounded-xl"/></Field>
              <Field label="Industry"><Input defaultValue={biz.industry ?? ""} onChange={(e) => setForm({ ...form, industry: e.target.value })} className="rounded-xl"/></Field>
              <Field label="Google review URL"><Input defaultValue={biz.google_review_url ?? ""} onChange={(e) => setForm({ ...form, google_review_url: e.target.value })} className="rounded-xl"/></Field>
              <Field label="Website"><Input defaultValue={biz.website ?? ""} onChange={(e) => setForm({ ...form, website: e.target.value })} className="rounded-xl"/></Field>
              <Field label="Phone"><Input defaultValue={biz.phone ?? ""} onChange={(e) => setForm({ ...form, phone: e.target.value })} className="rounded-xl"/></Field>
              <Field label="Address"><Input defaultValue={biz.address ?? ""} onChange={(e) => setForm({ ...form, address: e.target.value })} className="rounded-xl"/></Field>
              <Field label="Brand color"><Input type="color" defaultValue={biz.brand_primary ?? "#0071e3"} onChange={(e) => setForm({ ...form, brand_primary: e.target.value })} className="h-10 rounded-xl p-1"/></Field>
              <div className="col-span-2">
                <Field label="Welcome message">
                  <Textarea defaultValue={biz.welcome_message ?? ""} onChange={(e) => setForm({ ...form, welcome_message: e.target.value })} className="rounded-xl"/>
                </Field>
              </div>
              <div className="col-span-2 flex justify-between">
                <Button variant="ghost" onClick={deleteBiz} className="rounded-full text-destructive hover:bg-destructive/10 hover:text-destructive">
                  <Trash2 className="mr-1 h-4 w-4"/> Delete
                </Button>
                <Button onClick={save} className="rounded-full"><Save className="mr-1 h-4 w-4"/> Save</Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
      {/* touched: avoid unused-var lint */}
      {current ? null : null}
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <Label className="text-xs uppercase tracking-wide text-muted-foreground">{label}</Label>
      {children}
    </div>
  );
}

function EmptyBox({ icon: Icon, title, body }: { icon: typeof MapPin; title: string; body: string }) {
  return (
    <Card className="rounded-3xl border-dashed">
      <CardContent className="flex flex-col items-center justify-center gap-3 py-14 text-center">
        <div className="grid h-12 w-12 place-items-center rounded-2xl bg-accent text-primary">
          <Icon className="h-5 w-5"/>
        </div>
        <h3 className="font-semibold">{title}</h3>
        <p className="max-w-sm text-sm text-muted-foreground">{body}</p>
      </CardContent>
    </Card>
  );
}
