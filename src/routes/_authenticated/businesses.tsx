import { createFileRoute, Link } from "@tanstack/react-router";
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
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Plus, Building2, ExternalLink, MapPin } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/businesses")({
  component: Businesses,
});

const INDUSTRIES = [
  "Hotel",
  "Restaurant",
  "Cafe",
  "Bar",
  "Retail",
  "Medical",
  "Beauty",
  "Real Estate",
  "Tourism",
  "Other",
];

function Businesses() {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const { data: businesses, isLoading } = useQuery({
    queryKey: ["businesses"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("businesses")
        .select("*, locations(count), qr_codes(count)")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  const [form, setForm] = useState({
    name: "",
    industry: "Restaurant",
    google_review_url: "",
    website: "",
    phone: "",
    address: "",
    welcome_message: "Loved your visit? We'd love your feedback.",
    brand_primary: "#0071e3",
  });

  async function create() {
    const { data: userData } = await supabase.auth.getUser();
    if (!userData.user) return;
    const { error } = await supabase.from("businesses").insert({
      ...form,
      owner_id: userData.user.id,
    });
    if (error) return toast.error(error.message);
    toast.success("Business created");
    setOpen(false);
    setForm({ ...form, name: "" });
    qc.invalidateQueries({ queryKey: ["businesses"] });
  }

  return (
    <div className="animate-fade-in-up space-y-8">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-3xl font-semibold tracking-tight">Businesses</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Manage all the businesses under your account.
          </p>
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button className="rounded-full">
              <Plus className="mr-1 h-4 w-4" /> New business
            </Button>
          </DialogTrigger>
          <DialogContent className="rounded-3xl sm:max-w-lg">
            <DialogHeader>
              <DialogTitle>Add business</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div className="col-span-2 space-y-1.5">
                  <Label>Business name</Label>
                  <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Blue Bottle Coffee" className="rounded-xl"/>
                </div>
                <div className="space-y-1.5">
                  <Label>Industry</Label>
                  <Select value={form.industry} onValueChange={(v) => setForm({ ...form, industry: v })}>
                    <SelectTrigger className="rounded-xl"><SelectValue/></SelectTrigger>
                    <SelectContent>
                      {INDUSTRIES.map((i) => <SelectItem key={i} value={i}>{i}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label>Brand color</Label>
                  <Input type="color" value={form.brand_primary} onChange={(e) => setForm({ ...form, brand_primary: e.target.value })} className="h-10 rounded-xl p-1"/>
                </div>
                <div className="col-span-2 space-y-1.5">
                  <Label>Google review URL</Label>
                  <Input value={form.google_review_url} onChange={(e) => setForm({ ...form, google_review_url: e.target.value })} placeholder="https://g.page/r/..." className="rounded-xl"/>
                </div>
                <div className="space-y-1.5">
                  <Label>Website</Label>
                  <Input value={form.website} onChange={(e) => setForm({ ...form, website: e.target.value })} className="rounded-xl"/>
                </div>
                <div className="space-y-1.5">
                  <Label>Phone</Label>
                  <Input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} className="rounded-xl"/>
                </div>
                <div className="col-span-2 space-y-1.5">
                  <Label>Address</Label>
                  <Input value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} className="rounded-xl"/>
                </div>
                <div className="col-span-2 space-y-1.5">
                  <Label>Welcome message</Label>
                  <Textarea value={form.welcome_message} onChange={(e) => setForm({ ...form, welcome_message: e.target.value })} className="rounded-xl"/>
                </div>
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setOpen(false)} className="rounded-full">Cancel</Button>
              <Button onClick={create} disabled={!form.name} className="rounded-full">Create</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      {isLoading ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-40 rounded-3xl bg-muted shimmer" />
          ))}
        </div>
      ) : businesses && businesses.length ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {businesses.map((b) => {
            const locCount = (b.locations as unknown as { count: number }[])?.[0]?.count ?? 0;
            const qrCount = (b.qr_codes as unknown as { count: number }[])?.[0]?.count ?? 0;
            return (
              <Link
                key={b.id}
                to="/businesses/$id"
                params={{ id: b.id }}
                className="group"
              >
                <Card className="h-full rounded-3xl border-border/70 shadow-[var(--shadow-card)] transition hover:-translate-y-0.5 hover:shadow-[var(--shadow-elevated)]">
                  <CardContent className="p-6">
                    <div className="mb-4 flex items-start justify-between">
                      <div
                        className="grid h-12 w-12 place-items-center rounded-2xl text-white"
                        style={{ background: b.brand_primary ?? "#0071e3" }}
                      >
                        <Building2 className="h-5 w-5" />
                      </div>
                      <Badge variant="secondary" className="rounded-full text-[10px]">
                        {b.industry ?? "—"}
                      </Badge>
                    </div>
                    <h3 className="text-lg font-semibold tracking-tight">{b.name}</h3>
                    <p className="mt-1 line-clamp-1 text-xs text-muted-foreground">{b.address || "No address"}</p>
                    <div className="mt-5 flex items-center gap-4 text-xs text-muted-foreground">
                      <span className="flex items-center gap-1"><MapPin className="h-3 w-3"/>{locCount} locations</span>
                      <span>{qrCount} QR codes</span>
                    </div>
                  </CardContent>
                </Card>
              </Link>
            );
          })}
        </div>
      ) : (
        <Card className="rounded-3xl border-dashed">
          <CardContent className="flex flex-col items-center justify-center gap-3 py-16 text-center">
            <div className="grid h-14 w-14 place-items-center rounded-2xl bg-accent text-primary">
              <Building2 className="h-6 w-6"/>
            </div>
            <h3 className="text-lg font-semibold">Add your first business</h3>
            <p className="max-w-sm text-sm text-muted-foreground">
              Create a business to generate branded QR codes, guest landing pages and per-location analytics.
            </p>
            <Button className="mt-2 rounded-full" onClick={() => setOpen(true)}>
              <Plus className="mr-1 h-4 w-4"/> New business
            </Button>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
