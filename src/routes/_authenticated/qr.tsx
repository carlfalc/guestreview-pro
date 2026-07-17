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
  isValidHttpsUrl,
  statusBadgeVariant,
  statusLabel,
  type DestinationType,
} from "@/lib/qr-destinations";

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
  const missingReviewUrl = isGoogleReview && !!business && !business.google_review_url;
  const urlToValidate = isGoogleReview ? business?.google_review_url ?? "" : destinationUrl;
  const urlValid = isValidHttpsUrl(urlToValidate);

  async function submit() {
    if (!business) return toast.error("Select a business");
    if (missingReviewUrl) {
      return toast.error("This business has no Google review URL. Add one first or pick a different destination type.");
    }
    if (!urlValid) {
      return toast.error("Enter a valid https:// URL for the destination.");
    }
    setSaving(true);
    try {
      const { data: userData } = await supabase.auth.getUser();
      if (!userData.user) throw new Error("Not signed in");
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
          destination_url: isGoogleReview ? business.google_review_url : destinationUrl.trim(),
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
