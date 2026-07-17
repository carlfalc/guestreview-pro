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
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Badge } from "@/components/ui/badge";
import { Plus, Building2, MapPin, Trash2, Save, ArrowRight } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { isValidDestinationUrl } from "@/lib/resolve-qr-destination";

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

type BusinessRow = {
  id: string;
  name: string;
  industry: string | null;
  google_review_url: string | null;
  website: string | null;
  phone: string | null;
  address: string | null;
  welcome_message: string | null;
  brand_primary: string | null;
  locations?: { count: number }[];
  qr_codes?: { count: number }[];
};

function Businesses() {
  const qc = useQueryClient();
  const [createOpen, setCreateOpen] = useState(false);
  const [editing, setEditing] = useState<BusinessRow | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);

  const { data: businesses, isLoading } = useQuery({
    queryKey: ["businesses"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("businesses")
        .select("*, locations(count), qr_codes(count)")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data as unknown as BusinessRow[];
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
    const gru = form.google_review_url.trim();
    if (gru && !isValidDestinationUrl(gru)) {
      return toast.error("Enter a valid https:// Google review URL (e.g. https://g.page/r/.../review)");
    }
    const payload = { ...form, google_review_url: gru || null };
    const { error } = await supabase.from("businesses").insert({
      ...payload,
      owner_id: userData.user.id,
    });
    if (error) return toast.error(error.message);
    toast.success("Business created");
    setCreateOpen(false);
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
        <Dialog open={createOpen} onOpenChange={setCreateOpen}>
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
              <Button variant="outline" onClick={() => setCreateOpen(false)} className="rounded-full">Cancel</Button>
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
            const locCount = b.locations?.[0]?.count ?? 0;
            const qrCount = b.qr_codes?.[0]?.count ?? 0;
            return (
              <button
                key={b.id}
                type="button"
                onClick={() => setEditing(b)}
                className="group text-left"
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
              </button>
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
            <Button className="mt-2 rounded-full" onClick={() => setCreateOpen(true)}>
              <Plus className="mr-1 h-4 w-4"/> New business
            </Button>
          </CardContent>
        </Card>
      )}

      <EditBusinessDialog
        business={editing}
        onClose={() => setEditing(null)}
        onRequestDelete={() => setConfirmDelete(true)}
      />

      <AlertDialog open={confirmDelete} onOpenChange={setConfirmDelete}>
        <AlertDialogContent className="rounded-3xl">
          <AlertDialogHeader>
            <AlertDialogTitle>Delete this business?</AlertDialogTitle>
            <AlertDialogDescription>
              This permanently removes the business along with its locations, QR codes and marketing packs. This cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="rounded-full">Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="rounded-full bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={async () => {
                if (!editing) return;
                const { error } = await supabase.from("businesses").delete().eq("id", editing.id);
                if (error) return toast.error(error.message);
                toast.success("Business deleted");
                setConfirmDelete(false);
                setEditing(null);
                qc.invalidateQueries({ queryKey: ["businesses"] });
              }}
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

function EditBusinessDialog({
  business,
  onClose,
  onRequestDelete,
}: {
  business: BusinessRow | null;
  onClose: () => void;
  onRequestDelete: () => void;
}) {
  const qc = useQueryClient();
  const [values, setValues] = useState({
    name: "",
    industry: "Restaurant",
    google_review_url: "",
    website: "",
    phone: "",
    address: "",
    welcome_message: "",
    brand_primary: "#0071e3",
  });
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (business) {
      setValues({
        name: business.name ?? "",
        industry: business.industry ?? "Restaurant",
        google_review_url: business.google_review_url ?? "",
        website: business.website ?? "",
        phone: business.phone ?? "",
        address: business.address ?? "",
        welcome_message: business.welcome_message ?? "",
        brand_primary: business.brand_primary ?? "#0071e3",
      });
    }
  }, [business]);

  async function save() {
    if (!business) return;
    const gru = values.google_review_url.trim();
    if (gru && !isValidDestinationUrl(gru)) {
      return toast.error("Enter a valid https:// Google review URL (e.g. https://g.page/r/.../review)");
    }
    setSaving(true);
    const payload = { ...values, google_review_url: gru || null };
    const { error } = await supabase
      .from("businesses")
      .update(payload)
      .eq("id", business.id);
    setSaving(false);
    if (error) return toast.error(error.message);
    toast.success("Saved");
    qc.invalidateQueries({ queryKey: ["businesses"] });
    qc.invalidateQueries({ queryKey: ["business", business.id] });
    onClose();
  }

  return (
    <Dialog open={!!business} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-h-[90vh] overflow-y-auto rounded-3xl sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-3">
            <div
              className="grid h-9 w-9 place-items-center rounded-xl text-white"
              style={{ background: values.brand_primary || "#0071e3" }}
            >
              <Building2 className="h-4 w-4" />
            </div>
            Edit business
          </DialogTitle>
        </DialogHeader>

        <div className="grid grid-cols-2 gap-3">
          <div className="col-span-2 space-y-1.5">
            <Label>Business name</Label>
            <Input value={values.name} onChange={(e) => setValues({ ...values, name: e.target.value })} className="rounded-xl"/>
          </div>
          <div className="space-y-1.5">
            <Label>Industry</Label>
            <Select value={values.industry} onValueChange={(v) => setValues({ ...values, industry: v })}>
              <SelectTrigger className="rounded-xl"><SelectValue/></SelectTrigger>
              <SelectContent>
                {INDUSTRIES.map((i) => <SelectItem key={i} value={i}>{i}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label>Brand color</Label>
            <Input type="color" value={values.brand_primary} onChange={(e) => setValues({ ...values, brand_primary: e.target.value })} className="h-10 rounded-xl p-1"/>
          </div>
          <div className="col-span-2 space-y-1.5">
            <Label>Google review URL</Label>
            <Input value={values.google_review_url} onChange={(e) => setValues({ ...values, google_review_url: e.target.value })} placeholder="https://g.page/r/..." className="rounded-xl"/>
          </div>
          <div className="space-y-1.5">
            <Label>Website</Label>
            <Input value={values.website} onChange={(e) => setValues({ ...values, website: e.target.value })} className="rounded-xl"/>
          </div>
          <div className="space-y-1.5">
            <Label>Phone</Label>
            <Input value={values.phone} onChange={(e) => setValues({ ...values, phone: e.target.value })} className="rounded-xl"/>
          </div>
          <div className="col-span-2 space-y-1.5">
            <Label>Address</Label>
            <Input value={values.address} onChange={(e) => setValues({ ...values, address: e.target.value })} className="rounded-xl"/>
          </div>
          <div className="col-span-2 space-y-1.5">
            <Label>Welcome message</Label>
            <Textarea value={values.welcome_message} onChange={(e) => setValues({ ...values, welcome_message: e.target.value })} className="rounded-xl"/>
          </div>
        </div>

        {business ? (
          <Link
            to="/businesses/$id"
            params={{ id: business.id }}
            className="inline-flex items-center gap-1 text-sm text-primary hover:underline"
            onClick={onClose}
          >
            Manage locations & QR codes <ArrowRight className="h-3.5 w-3.5" />
          </Link>
        ) : null}

        <DialogFooter className="flex-row items-center justify-between gap-2 sm:justify-between">
          <Button
            variant="ghost"
            onClick={onRequestDelete}
            className="rounded-full text-destructive hover:bg-destructive/10 hover:text-destructive"
          >
            <Trash2 className="mr-1 h-4 w-4" /> Delete business
          </Button>
          <div className="flex gap-2">
            <Button variant="outline" onClick={onClose} className="rounded-full">Cancel</Button>
            <Button onClick={save} disabled={saving || !values.name} className="rounded-full">
              <Save className="mr-1 h-4 w-4" /> {saving ? "Saving…" : "Save"}
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
