import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { QrCode, ArrowRight, Plus, Building2, AlertCircle, Trash2, Save } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { generateShortCode } from "@/lib/short-code";
import {
  DESTINATION_TYPES,
  destinationLabel,
  computeEffectiveStatus,
  statusBadgeVariant,
  statusLabel,
  type DestinationType,
} from "@/lib/qr-destinations";
import { isValidDestinationUrl, resolveQrDestination } from "@/lib/resolve-qr-destination";

export const Route = createFileRoute("/_authenticated/qr")({
  component: QrList,
});

type BusinessRow = {
  id: string;
  name: string;
  brand_primary: string | null;
  google_review_url: string | null;
};

type QrRow = {
  id: string;
  business_id: string;
  location_id: string | null;
  label: string | null;
  campaign: string | null;
  destination_type: string;
  destination_url: string | null;
  destination_label: string | null;
  status: string;
  landing_mode: string;
  expires_at: string | null;
  scans_count: number;
  businesses?: { name?: string; brand_primary?: string } | null;
  locations?: { name?: string; location_type?: string } | null;
};

type LocationRow = {
  id: string;
  business_id: string;
  name: string;
  location_type: string | null;
};

function QrList() {
  const qc = useQueryClient();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);

  const [editing, setEditing] = useState<QrRow | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);

  const { data: qrs, isLoading, error } = useQuery({
    queryKey: ["all-qr"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("qr_codes")
        .select("*, businesses(name, brand_primary), locations(name, location_type)")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data as unknown as QrRow[];
    },
  });

  const { data: businesses } = useQuery({
    queryKey: ["my-businesses"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("businesses")
        .select("id, name, brand_primary, google_review_url")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data as BusinessRow[];
    },
  });

  const hasBusinesses = !!businesses?.length;

  return (
    <div className="animate-fade-in-up space-y-8">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-3xl font-semibold tracking-tight">QR codes</h1>
          <p className="mt-1 text-sm text-muted-foreground">All QR codes across your businesses.</p>
        </div>
        {hasBusinesses && (
          <Button className="rounded-full" onClick={() => setOpen(true)}>
            <Plus className="mr-1 h-4 w-4" /> Create QR Code
          </Button>
        )}
      </div>

      {isLoading ? (
        <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
          {[0, 1, 2].map((i) => (
            <div key={i} className="h-20 rounded-2xl bg-muted shimmer" />
          ))}
        </div>
      ) : error ? (
        <Card className="rounded-3xl border-destructive/40">
          <CardContent className="flex items-center gap-3 py-8 text-sm text-destructive">
            <AlertCircle className="h-5 w-5" />
            Something went wrong loading your QR codes.
          </CardContent>
        </Card>
      ) : qrs?.length ? (
        <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
          {qrs.map((q) => {
            const biz = q.businesses as { name?: string; brand_primary?: string } | null;
            const loc = q.locations as { name?: string; location_type?: string } | null;
            const effectiveStatus = computeEffectiveStatus(q.status, q.expires_at);
            return (
              <button
                key={q.id}
                type="button"
                onClick={() => setEditing(q)}
                className="group text-left"
              >
                <Card className="rounded-2xl border-border/70 transition hover:-translate-y-0.5 hover:shadow-[var(--shadow-card)]">
                  <CardContent className="flex items-center gap-3 p-4">
                    <div
                      className="grid h-11 w-11 place-items-center rounded-xl text-white"
                      style={{ background: biz?.brand_primary ?? "#0071e3" }}
                    >
                      <QrCode className="h-4 w-4" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="truncate font-medium">{q.label || "Untitled QR"}</p>
                      <p className="truncate text-xs text-muted-foreground">
                        {biz?.name} · {destinationLabel(q.destination_type as DestinationType)}
                        {loc?.name ? ` · ${loc.name}` : ""}
                      </p>
                    </div>
                    <div className="flex flex-col items-end gap-1">
                      <Badge variant={statusBadgeVariant(effectiveStatus)} className="rounded-full text-[10px]">
                        {statusLabel(effectiveStatus)}
                      </Badge>
                      <span className="text-[11px] text-muted-foreground">{q.scans_count} scans</span>
                      <ArrowRight className="h-3 w-3 text-muted-foreground transition group-hover:translate-x-0.5" />
                    </div>
                  </CardContent>
                </Card>
              </button>
            );
          })}
        </div>
      ) : hasBusinesses ? (
        <Card className="rounded-3xl border-dashed">
          <CardContent className="flex flex-col items-center gap-3 py-16 text-center">
            <div className="grid h-14 w-14 place-items-center rounded-2xl bg-accent text-primary">
              <QrCode className="h-6 w-6" />
            </div>
            <h3 className="text-lg font-semibold">Create your first QR code</h3>
            <p className="max-w-sm text-sm text-muted-foreground">
              Point a QR code to a Google review page, menu, booking link, Wi-Fi, and more.
            </p>
            <div className="mt-2 flex flex-wrap items-center justify-center gap-2">
              <Button className="rounded-full" onClick={() => setOpen(true)}>
                <Plus className="mr-1 h-4 w-4" /> Create QR Code
              </Button>
              <Link to="/businesses">
                <Button variant="outline" className="rounded-full">Manage Businesses</Button>
              </Link>
            </div>
          </CardContent>
        </Card>
      ) : (
        <Card className="rounded-3xl border-dashed">
          <CardContent className="flex flex-col items-center gap-3 py-16 text-center">
            <div className="grid h-14 w-14 place-items-center rounded-2xl bg-accent text-primary">
              <Building2 className="h-6 w-6" />
            </div>
            <h3 className="text-lg font-semibold">Create a business first</h3>
            <p className="max-w-sm text-sm text-muted-foreground">
              Add your business details before generating a QR code.
            </p>
            <Link to="/businesses" className="mt-2">
              <Button className="rounded-full"><Plus className="mr-1 h-4 w-4" /> Create Business</Button>
            </Link>
          </CardContent>
        </Card>
      )}

      <CreateQrDialog
        open={open}
        onOpenChange={setOpen}
        businesses={businesses ?? []}
        onCreated={(id) => {
          qc.invalidateQueries({ queryKey: ["all-qr"] });
          setOpen(false);
          navigate({ to: "/qr/$id", params: { id } });
        }}
      />

      <EditQrDialog
        qr={editing}
        onClose={() => setEditing(null)}
        onRequestDelete={() => setConfirmDelete(true)}
      />

      <AlertDialog open={confirmDelete} onOpenChange={setConfirmDelete}>
        <AlertDialogContent className="rounded-3xl">
          <AlertDialogHeader>
            <AlertDialogTitle>Delete this QR code?</AlertDialogTitle>
            <AlertDialogDescription>
              This permanently removes the QR code and its scan history. This cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="rounded-full">Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="rounded-full bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={async () => {
                if (!editing) return;
                const { error } = await supabase.from("qr_codes").delete().eq("id", editing.id);
                if (error) return toast.error(error.message);
                toast.success("QR code deleted");
                setConfirmDelete(false);
                setEditing(null);
                qc.invalidateQueries({ queryKey: ["all-qr"] });
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


function CreateQrDialog({
  open,
  onOpenChange,
  businesses,
  onCreated,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  businesses: BusinessRow[];
  onCreated: (id: string) => void;
}) {
  const [businessId, setBusinessId] = useState<string>("");
  const [locationId, setLocationId] = useState<string>("none");
  const [label, setLabel] = useState("");
  const [campaign, setCampaign] = useState("");
  const [destinationType, setDestinationType] = useState<DestinationType>("google_review");
  const [destinationUrl, setDestinationUrl] = useState("");
  const [destinationLabelValue, setDestinationLabelValue] = useState("");
  const [expiresAt, setExpiresAt] = useState("");
  const [status, setStatus] = useState<"active" | "paused">("active");
  const [landingMode, setLandingMode] = useState<"landing" | "redirect">("landing");
  const [style, setStyle] = useState<"square" | "rounded" | "circle">("square");
  const [fg, setFg] = useState("#000000");
  const [bg, setBg] = useState("#ffffff");
  const [saving, setSaving] = useState(false);

  const business = useMemo(
    () => businesses.find((b) => b.id === businessId),
    [businesses, businessId],
  );

  const { data: locations } = useQuery({
    queryKey: ["locations-for-biz", businessId],
    enabled: !!businessId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("locations")
        .select("id, business_id, name, location_type")
        .eq("business_id", businessId)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data as LocationRow[];
    },
  });

  useEffect(() => {
    if (business?.brand_primary) setFg(business.brand_primary);
    setLocationId("none");
  }, [business]);

  useEffect(() => {
    if (destinationType === "google_review") {
      setDestinationUrl(business?.google_review_url ?? "");
    }
  }, [destinationType, business]);

  useEffect(() => {
    if (!open) {
      setBusinessId("");
      setLocationId("none");
      setLabel("");
      setCampaign("");
      setDestinationType("google_review");
      setDestinationUrl("");
      setDestinationLabelValue("");
      setExpiresAt("");
      setStatus("active");
      setLandingMode("landing");
      setStyle("square");
      setFg("#000000");
      setBg("#ffffff");
    }
  }, [open]);

  const isGoogleReview = destinationType === "google_review";
  const trimmedDestinationUrl = destinationUrl.trim();
  const resolvedPreview = resolveQrDestination({
    destinationType,
    destinationUrl: trimmedDestinationUrl,
    businessGoogleReviewUrl: business?.google_review_url,
  });
  const missingReviewUrl = isGoogleReview && !!business && !resolvedPreview.url;
  const urlValid = !!resolvedPreview.url;

  async function submit() {
    if (!business) return toast.error("Select a business");
    if (isGoogleReview) {
      // For a google_review QR: either QR-specific override is valid, or business URL must be valid.
      if (trimmedDestinationUrl && !isValidDestinationUrl(trimmedDestinationUrl)) {
        return toast.error("QR-specific review URL is not a valid https:// URL.");
      }
      if (!resolvedPreview.url) {
        return toast.error("No valid Google review URL. Add one on the business or enter a QR-specific override.");
      }
    } else {
      if (!isValidDestinationUrl(trimmedDestinationUrl)) {
        return toast.error("Enter a valid https:// destination URL.");
      }
    }
    setSaving(true);
    try {
      const { data: userData } = await supabase.auth.getUser();
      if (!userData.user) throw new Error("Not signed in");
      // Persist QR-specific override when the user entered one; otherwise leave null so it falls back to business.
      const qrDestinationUrl = isGoogleReview
        ? (trimmedDestinationUrl && trimmedDestinationUrl !== (business.google_review_url ?? "").trim()
            ? trimmedDestinationUrl
            : null)
        : trimmedDestinationUrl;
      const { data, error } = await supabase
        .from("qr_codes")
        .insert({
          business_id: business.id,
          owner_id: userData.user.id,
          location_id: locationId === "none" ? null : locationId,
          short_code: generateShortCode(),
          label: label.trim() || "Untitled QR",
          campaign: campaign.trim() || null,
          destination_type: destinationType,
          destination_url: qrDestinationUrl,
          destination_label: destinationLabelValue.trim() || null,
          expires_at: expiresAt ? new Date(expiresAt).toISOString() : null,
          status,
          landing_mode: landingMode,
          style,
          fg_color: fg,
          bg_color: bg,
        })
        .select("id")
        .single();
      if (error) throw error;
      toast.success("QR code created");
      onCreated(data.id);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to create QR code");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto rounded-3xl sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Create QR Code</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label>Business</Label>
            <Select value={businessId} onValueChange={setBusinessId}>
              <SelectTrigger className="rounded-xl"><SelectValue placeholder="Select a business" /></SelectTrigger>
              <SelectContent>
                {businesses.map((b) => (
                  <SelectItem key={b.id} value={b.id}>{b.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5">
            <Label>Destination type</Label>
            <Select value={destinationType} onValueChange={(v) => setDestinationType(v as DestinationType)}>
              <SelectTrigger className="rounded-xl"><SelectValue /></SelectTrigger>
              <SelectContent>
                {DESTINATION_TYPES.map((t: { value: DestinationType; label: string }) => (
                  <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {missingReviewUrl && (
            <div className="flex items-start gap-2 rounded-xl border border-destructive/40 bg-destructive/10 p-3 text-xs text-destructive">
              <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
              <span>This business has no Google review URL. Add one in Business Details, or pick another destination type.</span>
            </div>
          )}

          <div className="space-y-1.5">
            <Label>Destination URL</Label>
            <Input
              value={isGoogleReview ? business?.google_review_url ?? "" : destinationUrl}
              onChange={(e) => setDestinationUrl(e.target.value)}
              disabled={isGoogleReview}
              placeholder="https://..."
              className="rounded-xl font-mono text-xs"
            />
            {isGoogleReview && (
              <p className="text-[11px] text-muted-foreground">Uses the business's Google review URL. Switch to Custom to override.</p>
            )}
            {!isGoogleReview && destinationUrl && !urlValid && (
              <p className="text-[11px] text-destructive">Enter a valid https:// URL.</p>
            )}
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label>Label</Label>
              <Input value={label} onChange={(e) => setLabel(e.target.value)} placeholder="Front desk" className="rounded-xl" />
            </div>
            <div className="space-y-1.5">
              <Label>Destination label</Label>
              <Input value={destinationLabelValue} onChange={(e) => setDestinationLabelValue(e.target.value)} placeholder="View menu" className="rounded-xl" />
            </div>
            <div className="space-y-1.5">
              <Label>Campaign</Label>
              <Input value={campaign} onChange={(e) => setCampaign(e.target.value)} placeholder="Summer 2025" className="rounded-xl" />
            </div>
            <div className="space-y-1.5">
              <Label>Location</Label>
              <Select value={locationId} onValueChange={setLocationId} disabled={!businessId}>
                <SelectTrigger className="rounded-xl"><SelectValue placeholder="Entire business" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Entire business</SelectItem>
                  {locations?.map((l) => (
                    <SelectItem key={l.id} value={l.id}>{l.name}{l.location_type ? ` · ${l.location_type}` : ""}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Status</Label>
              <Select value={status} onValueChange={(v) => setStatus(v as typeof status)}>
                <SelectTrigger className="rounded-xl"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="active">Active</SelectItem>
                  <SelectItem value="paused">Paused</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Landing behaviour</Label>
              <Select value={landingMode} onValueChange={(v) => setLandingMode(v as typeof landingMode)}>
                <SelectTrigger className="rounded-xl"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="landing">Show landing page</SelectItem>
                  <SelectItem value="redirect">Redirect immediately</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5 sm:col-span-2">
              <Label>Expires at (optional)</Label>
              <Input type="datetime-local" value={expiresAt} onChange={(e) => setExpiresAt(e.target.value)} className="rounded-xl" />
            </div>
            <div className="space-y-1.5">
              <Label>QR style</Label>
              <Select value={style} onValueChange={(v) => setStyle(v as typeof style)}>
                <SelectTrigger className="rounded-xl"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="square">Square</SelectItem>
                  <SelectItem value="rounded">Rounded</SelectItem>
                  <SelectItem value="circle">Circle</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Foreground</Label>
              <Input type="color" value={fg} onChange={(e) => setFg(e.target.value)} className="h-10 rounded-xl p-1" />
            </div>
            <div className="space-y-1.5 sm:col-span-2">
              <Label>Background</Label>
              <Input type="color" value={bg} onChange={(e) => setBg(e.target.value)} className="h-10 rounded-xl p-1" />
            </div>
          </div>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)} className="rounded-full">Cancel</Button>
          <Button onClick={submit} disabled={!businessId || missingReviewUrl || !urlValid || saving} className="rounded-full">
            {saving ? "Creating..." : "Create QR Code"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function EditQrDialog({
  qr,
  onClose,
  onRequestDelete,
}: {
  qr: QrRow | null;
  onClose: () => void;
  onRequestDelete: () => void;
}) {
  const qc = useQueryClient();
  const [values, setValues] = useState({
    label: "",
    campaign: "",
    destination_type: "google_review" as DestinationType,
    destination_url: "",
    destination_label: "",
    status: "active" as "active" | "paused",
    landing_mode: "landing" as "landing" | "redirect",
    location_id: "none" as string,
    expires_at: "",
  });
  const [saving, setSaving] = useState(false);

  const { data: locations } = useQuery({
    queryKey: ["locations-for-biz", qr?.business_id ?? ""],
    enabled: !!qr?.business_id,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("locations")
        .select("id, business_id, name, location_type")
        .eq("business_id", qr!.business_id)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data as LocationRow[];
    },
  });

  useEffect(() => {
    if (qr) {
      setValues({
        label: qr.label ?? "",
        campaign: qr.campaign ?? "",
        destination_type: (qr.destination_type as DestinationType) ?? "google_review",
        destination_url: qr.destination_url ?? "",
        destination_label: qr.destination_label ?? "",
        status: (qr.status as "active" | "paused") ?? "active",
        landing_mode: (qr.landing_mode as "landing" | "redirect") ?? "landing",
        location_id: qr.location_id ?? "none",
        expires_at: qr.expires_at ? qr.expires_at.slice(0, 16) : "",
      });
    }
  }, [qr]);

  async function save() {
    if (!qr) return;
    const trimmed = values.destination_url.trim();
    if (trimmed && !isValidDestinationUrl(trimmed)) {
      return toast.error("Enter a valid https:// URL");
    }
    if (values.destination_type !== "google_review" && !trimmed) {
      return toast.error("Destination URL is required for this destination type");
    }
    setSaving(true);
    const { error } = await supabase
      .from("qr_codes")
      .update({
        label: values.label.trim() || "Untitled QR",
        campaign: values.campaign.trim() || null,
        destination_type: values.destination_type,
        destination_url: trimmed || null,
        destination_label: values.destination_label.trim() || null,
        status: values.status,
        landing_mode: values.landing_mode,
        location_id: values.location_id === "none" ? null : values.location_id,
        expires_at: values.expires_at ? new Date(values.expires_at).toISOString() : null,
      })
      .eq("id", qr.id);
    setSaving(false);
    if (error) return toast.error(error.message);
    toast.success("Saved");
    qc.invalidateQueries({ queryKey: ["all-qr"] });
    qc.invalidateQueries({ queryKey: ["qr", qr.id] });
    onClose();
  }

  return (
    <Dialog open={!!qr} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-h-[90vh] overflow-y-auto rounded-3xl sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-3">
            <div
              className="grid h-9 w-9 place-items-center rounded-xl text-white"
              style={{ background: qr?.businesses?.brand_primary ?? "#0071e3" }}
            >
              <QrCode className="h-4 w-4" />
            </div>
            Edit QR code
          </DialogTitle>
        </DialogHeader>

        <div className="grid gap-3 sm:grid-cols-2">
          <div className="space-y-1.5 sm:col-span-2">
            <Label>Label</Label>
            <Input value={values.label} onChange={(e) => setValues({ ...values, label: e.target.value })} className="rounded-xl" />
          </div>
          <div className="space-y-1.5">
            <Label>Destination type</Label>
            <Select value={values.destination_type} onValueChange={(v) => setValues({ ...values, destination_type: v as DestinationType })}>
              <SelectTrigger className="rounded-xl"><SelectValue /></SelectTrigger>
              <SelectContent>
                {DESTINATION_TYPES.map((t: { value: DestinationType; label: string }) => (
                  <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label>Destination label</Label>
            <Input value={values.destination_label} onChange={(e) => setValues({ ...values, destination_label: e.target.value })} placeholder="View menu" className="rounded-xl" />
          </div>
          <div className="space-y-1.5 sm:col-span-2">
            <Label>Destination URL</Label>
            <Input value={values.destination_url} onChange={(e) => setValues({ ...values, destination_url: e.target.value })} placeholder="https://..." className="rounded-xl font-mono text-xs" />
          </div>
          <div className="space-y-1.5">
            <Label>Campaign</Label>
            <Input value={values.campaign} onChange={(e) => setValues({ ...values, campaign: e.target.value })} className="rounded-xl" />
          </div>
          <div className="space-y-1.5">
            <Label>Location</Label>
            <Select value={values.location_id} onValueChange={(v) => setValues({ ...values, location_id: v })}>
              <SelectTrigger className="rounded-xl"><SelectValue placeholder="Entire business" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="none">Entire business</SelectItem>
                {locations?.map((l) => (
                  <SelectItem key={l.id} value={l.id}>{l.name}{l.location_type ? ` · ${l.location_type}` : ""}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label>Status</Label>
            <Select value={values.status} onValueChange={(v) => setValues({ ...values, status: v as "active" | "paused" })}>
              <SelectTrigger className="rounded-xl"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="active">Active</SelectItem>
                <SelectItem value="paused">Paused</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label>Landing behaviour</Label>
            <Select value={values.landing_mode} onValueChange={(v) => setValues({ ...values, landing_mode: v as "landing" | "redirect" })}>
              <SelectTrigger className="rounded-xl"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="landing">Show landing page</SelectItem>
                <SelectItem value="redirect">Redirect immediately</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5 sm:col-span-2">
            <Label>Expires at (optional)</Label>
            <Input type="datetime-local" value={values.expires_at} onChange={(e) => setValues({ ...values, expires_at: e.target.value })} className="rounded-xl" />
          </div>
        </div>

        {qr ? (
          <Link
            to="/qr/$id"
            params={{ id: qr.id }}
            className="inline-flex items-center gap-1 text-sm text-primary hover:underline"
            onClick={onClose}
          >
            Open full editor (design, formats, marketing) <ArrowRight className="h-3.5 w-3.5" />
          </Link>
        ) : null}

        <DialogFooter className="flex-row items-center justify-between gap-2 sm:justify-between">
          <Button
            variant="ghost"
            onClick={onRequestDelete}
            className="rounded-full text-destructive hover:bg-destructive/10 hover:text-destructive"
          >
            <Trash2 className="mr-1 h-4 w-4" /> Delete QR
          </Button>
          <div className="flex gap-2">
            <Button variant="outline" onClick={onClose} className="rounded-full">Cancel</Button>
            <Button onClick={save} disabled={saving} className="rounded-full">
              <Save className="mr-1 h-4 w-4" /> {saving ? "Saving…" : "Save"}
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
