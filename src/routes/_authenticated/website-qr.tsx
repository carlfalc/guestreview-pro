import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useRef, useState } from "react";
import { QRCodeCanvas } from "qrcode.react";
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
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Globe, Plus, Copy, Download, ExternalLink, Lock } from "lucide-react";
import { toast } from "sonner";
import { useBilling } from "@/hooks/use-billing";
import { UpgradePrompt } from "@/components/billing/UpgradePrompt";
import { friendlyMutationError } from "@/lib/plan-errors";
import { generateShortCode } from "@/lib/short-code";
import { buildScanUrl } from "@/lib/public-url";
import { isValidDestinationUrl } from "@/lib/resolve-qr-destination";
import { useTrack } from "@/hooks/use-analytics";

export const Route = createFileRoute("/_authenticated/website-qr")({
  component: WebsiteQrPage,
  head: () => ({
    meta: [
      { title: "Website QR codes | GuestReview Pro" },
      {
        name: "description",
        content:
          "Create and manage permanent QR codes that send customers straight to your business websites.",
      },
    ],
  }),
});

/** Free accounts keep three website QR codes; the database enforces the same rule. */
const FREE_WEBSITE_QR_LIMIT = 3;

type BusinessRow = { id: string; name: string; website: string | null };

type WebsiteQrRow = {
  id: string;
  business_id: string;
  short_code: string;
  label: string | null;
  destination_url: string | null;
  destination_label: string | null;
  status: string;
  scans_count: number;
  created_at: string;
  businesses?: { name?: string | null } | null;
};

function normaliseUrl(raw: string): string {
  const v = raw.trim();
  if (!v) return "";
  if (/^https?:\/\//i.test(v)) return v;
  return `https://${v}`;
}

function WebsiteQrPage() {
  const qc = useQueryClient();
  const billing = useBilling();
  const [createOpen, setCreateOpen] = useState(false);
  const [viewing, setViewing] = useState<WebsiteQrRow | null>(null);

  const { data: codes, isLoading } = useQuery({
    queryKey: ["website-qr"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("qr_codes")
        .select(
          "id, business_id, short_code, label, destination_url, destination_label, status, scans_count, created_at, businesses(name)",
        )
        .eq("destination_type", "website")
        .neq("status", "archived")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data as unknown as WebsiteQrRow[];
    },
  });

  const { data: businesses } = useQuery({
    queryKey: ["my-businesses-website"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("businesses")
        .select("id, name, website")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data as BusinessRow[];
    },
  });

  const activeCount = (codes ?? []).filter((c) => c.status === "active").length;
  const atLimit = !billing.isPaid && activeCount >= FREE_WEBSITE_QR_LIMIT;

  return (
    <div className="animate-fade-in-up space-y-8">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-3xl font-semibold tracking-tight">Website QR codes</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Permanent QR codes that send anyone who scans them straight to a business website.
          </p>
        </div>
        <Badge variant="outline" className="rounded-full">
          {billing.isPaid
            ? `${activeCount} active`
            : `${activeCount} of ${FREE_WEBSITE_QR_LIMIT} on the Free plan`}
        </Badge>
      </div>

      {atLimit && <UpgradePrompt reason="qrLimit" compact />}

      {isLoading ? (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {[0, 1, 2].map((i) => (
            <div key={i} className="h-44 rounded-3xl bg-muted shimmer" />
          ))}
        </div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {(codes ?? []).map((code) => (
            <button
              key={code.id}
              type="button"
              onClick={() => setViewing(code)}
              className="group text-left"
            >
              <Card className="h-full rounded-3xl transition hover:border-primary/50 hover:shadow-lg">
                <CardContent className="flex h-full flex-col gap-3 p-5">
                  <div className="flex items-start justify-between gap-3">
                    <div className="grid h-10 w-10 place-items-center rounded-2xl bg-accent text-primary">
                      <Globe className="h-5 w-5" />
                    </div>
                    <Badge
                      variant={code.status === "active" ? "default" : "secondary"}
                      className="rounded-full"
                    >
                      {code.status === "active" ? "Active" : "Paused"}
                    </Badge>
                  </div>
                  <div className="min-w-0">
                    <p className="truncate text-base font-semibold">
                      {code.businesses?.name || code.label || "Business website"}
                    </p>
                    <p className="truncate text-xs text-muted-foreground">
                      {code.destination_url}
                    </p>
                  </div>
                  <div className="mt-auto flex items-center justify-between text-xs text-muted-foreground">
                    <span>{code.scans_count} scans</span>
                    <span className="font-medium text-primary group-hover:underline">
                      Show QR code
                    </span>
                  </div>
                </CardContent>
              </Card>
            </button>
          ))}

          <button
            type="button"
            onClick={() => {
              if (atLimit) {
                toast.error(
                  "The Free plan includes 3 website QR codes. Upgrade to add more.",
                );
                return;
              }
              setCreateOpen(true);
            }}
            className="text-left"
          >
            <Card
              className={`h-full min-h-44 rounded-3xl border-dashed transition ${
                atLimit ? "opacity-60" : "hover:border-primary/60 hover:shadow-lg"
              }`}
            >
              <CardContent className="flex h-full flex-col items-center justify-center gap-2 p-5 text-center">
                <div className="grid h-12 w-12 place-items-center rounded-2xl bg-accent text-primary">
                  {atLimit ? <Lock className="h-5 w-5" /> : <Plus className="h-5 w-5" />}
                </div>
                <p className="text-sm font-semibold">New business website</p>
                <p className="text-xs text-muted-foreground">
                  {atLimit
                    ? "Upgrade to create unlimited website QR codes."
                    : "Add the business details and website address."}
                </p>
              </CardContent>
            </Card>
          </button>
        </div>
      )}

      <CreateWebsiteQrDialog
        open={createOpen}
        onOpenChange={setCreateOpen}
        businesses={businesses ?? []}
        onCreated={() => {
          qc.invalidateQueries({ queryKey: ["website-qr"] });
          qc.invalidateQueries({ queryKey: ["my-businesses-website"] });
          qc.invalidateQueries({ queryKey: ["billing-state"] });
          setCreateOpen(false);
        }}
      />

      <WebsiteQrDialog code={viewing} onClose={() => setViewing(null)} />
    </div>
  );
}

function CreateWebsiteQrDialog({
  open,
  onOpenChange,
  businesses,
  onCreated,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  businesses: BusinessRow[];
  onCreated: () => void;
}) {
  const [mode, setMode] = useState<string>("new");
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [website, setWebsite] = useState("");
  const [saving, setSaving] = useState(false);
  const track = useTrack();

  const selected = useMemo(
    () => businesses.find((b) => b.id === mode) ?? null,
    [businesses, mode],
  );

  function reset() {
    setMode("new");
    setName("");
    setPhone("");
    setWebsite("");
  }

  async function submit() {
    const url = normaliseUrl(website);
    if (!isValidDestinationUrl(url)) {
      return toast.error("Enter a valid website address, for example https://yourbusiness.com");
    }
    if (mode === "new" && !name.trim()) return toast.error("Enter the business name");

    setSaving(true);
    try {
      const { data: userData } = await supabase.auth.getUser();
      if (!userData.user) throw new Error("Not signed in");
      const ownerId = userData.user.id;

      let businessId = selected?.id ?? "";
      let businessName = selected?.name ?? "";

      if (!businessId) {
        const { data: created, error: bErr } = await supabase
          .from("businesses")
          .insert({
            owner_id: ownerId,
            name: name.trim(),
            website: url,
            phone: phone.trim() || null,
            status: "active",
          })
          .select("id, name")
          .single();
        if (bErr) throw bErr;
        businessId = created.id;
        businessName = created.name;
      } else if (!selected?.website) {
        await supabase.from("businesses").update({ website: url }).eq("id", businessId);
      }

      const { error } = await supabase.from("qr_codes").insert({
        owner_id: ownerId,
        business_id: businessId,
        short_code: generateShortCode(),
        label: `${businessName} website`,
        destination_type: "website",
        destination_url: url,
        destination_label: "Visit our website",
        landing_mode: "redirect",
        status: "active",
      });
      if (error) throw error;

      track("qr_created", { destinationType: "website" });
      toast.success("Website QR code created");
      reset();
      onCreated();
    } catch (e) {
      toast.error(friendlyMutationError(e, "Failed to create the website QR code"));
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(v) => {
        if (!v) reset();
        onOpenChange(v);
      }}
    >
      <DialogContent className="max-h-[90vh] overflow-y-auto rounded-3xl sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>New business website QR code</DialogTitle>
          <DialogDescription>
            The QR code is permanent — it keeps working even if you change the website address
            later.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label>Business</Label>
            <Select value={mode} onValueChange={setMode}>
              <SelectTrigger className="rounded-xl">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="new">Add a new business</SelectItem>
                {businesses.map((b) => (
                  <SelectItem key={b.id} value={b.id}>
                    {b.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {mode === "new" && (
            <>
              <div className="space-y-1.5">
                <Label htmlFor="wq-name">Business name</Label>
                <Input
                  id="wq-name"
                  className="rounded-xl"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Harbour Lane Cafe"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="wq-phone">Phone (optional)</Label>
                <Input
                  id="wq-phone"
                  className="rounded-xl"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="+64 21 123 456"
                />
              </div>
            </>
          )}

          <div className="space-y-1.5">
            <Label htmlFor="wq-url">Website address</Label>
            <Input
              id="wq-url"
              className="rounded-xl"
              value={website}
              onChange={(e) => setWebsite(e.target.value)}
              placeholder="https://yourbusiness.com"
            />
            <p className="text-xs text-muted-foreground">
              Scans redirect here instantly and are tracked in Analytics.
            </p>
          </div>
        </div>

        <DialogFooter>
          <Button
            variant="outline"
            className="rounded-full"
            onClick={() => onOpenChange(false)}
            disabled={saving}
          >
            Cancel
          </Button>
          <Button className="rounded-full" onClick={submit} disabled={saving}>
            {saving ? "Creating…" : "Create QR code"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function WebsiteQrDialog({
  code,
  onClose,
}: {
  code: WebsiteQrRow | null;
  onClose: () => void;
}) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const scanUrl = code ? buildScanUrl(code.short_code) : "";

  function download() {
    const canvas = wrapRef.current?.querySelector("canvas");
    if (!canvas) return;
    const link = document.createElement("a");
    link.download = `${(code?.businesses?.name || "website").replace(/\s+/g, "-").toLowerCase()}-website-qr.png`;
    link.href = canvas.toDataURL("image/png");
    link.click();
  }

  return (
    <Dialog open={!!code} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="rounded-3xl sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{code?.businesses?.name || "Business website"}</DialogTitle>
          <DialogDescription className="break-all">{code?.destination_url}</DialogDescription>
        </DialogHeader>

        <div className="flex flex-col items-center gap-4">
          <div ref={wrapRef} className="rounded-3xl bg-white p-5 shadow-sm">
            {scanUrl && <QRCodeCanvas value={scanUrl} size={224} level="M" includeMargin />}
          </div>
          <p className="break-all text-center text-xs text-muted-foreground">{scanUrl}</p>
          <div className="flex flex-wrap justify-center gap-2">
            <Button
              variant="outline"
              className="rounded-full"
              onClick={() => {
                navigator.clipboard.writeText(scanUrl);
                toast.success("Scan link copied");
              }}
            >
              <Copy className="mr-1 h-4 w-4" /> Copy link
            </Button>
            <Button className="rounded-full" onClick={download}>
              <Download className="mr-1 h-4 w-4" /> Download PNG
            </Button>
            {code && (
              <Link to="/qr/$id" params={{ id: code.id }}>
                <Button variant="ghost" className="rounded-full">
                  <ExternalLink className="mr-1 h-4 w-4" /> Design &amp; analytics
                </Button>
              </Link>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
