import { createFileRoute, Link, useParams, useNavigate } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  ArrowLeft,
  Copy,
  ExternalLink,
  Trash2,
  Pause,
  Play,
  Archive,
  RefreshCw,
  Copy as CopyIcon,
} from "lucide-react";
import { toast } from "sonner";
import { useEffect, useMemo, useState } from "react";
import {
  DESTINATION_TYPES,
  destinationLabel,
  computeEffectiveStatus,
  isValidHttpsUrl,
  statusBadgeVariant,
  statusLabel,
  type DestinationType,
} from "@/lib/qr-destinations";
import { generateShortCode } from "@/lib/short-code";
import { QrDesigner } from "@/components/qr-designer";
import { mergeDesign, type QrDesign } from "@/lib/qr-design";

export const Route = createFileRoute("/_authenticated/qr/$id")({
  component: QrDetail,
});

function QrDetail() {
  const { id } = useParams({ from: "/_authenticated/qr/$id" });
  const qc = useQueryClient();
  const navigate = useNavigate();

  const { data: qr } = useQuery({
    queryKey: ["qr", id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("qr_codes")
        .select("*, businesses(name, brand_primary, logo_url, google_review_url), locations(name)")
        .eq("id", id)
        .single();
      if (error) throw error;
      return data;
    },
  });

  const [label, setLabel] = useState<string>("");
  const [destinationType, setDestinationType] = useState<DestinationType>("google_review");
  const [destinationUrl, setDestinationUrl] = useState<string>("");
  const [destinationLabelValue, setDestinationLabelValue] = useState<string>("");
  const [landingMode, setLandingMode] = useState<"landing" | "redirect">("landing");
  const [expiresAt, setExpiresAt] = useState<string>("");
  const [design, setDesign] = useState<QrDesign>(mergeDesign(null));
  const [logoUrl, setLogoUrl] = useState<string | null>(null);

  useEffect(() => {
    if (!qr) return;
    setLabel(qr.label ?? "");
    setDestinationType((qr.destination_type as DestinationType) ?? "google_review");
    setDestinationUrl(qr.destination_url ?? "");
    setDestinationLabelValue(qr.destination_label ?? "");
    setLandingMode((qr.landing_mode as "landing" | "redirect") ?? "landing");
    setExpiresAt(qr.expires_at ? new Date(qr.expires_at).toISOString().slice(0, 16) : "");
    const biz = qr.businesses as { logo_url?: string; brand_primary?: string } | null;
    setDesign(mergeDesign((qr.design as Partial<QrDesign> | null) ?? null));
    setLogoUrl(qr.logo_url ?? biz?.logo_url ?? null);
  }, [qr]);

  const shortUrl = useMemo(() => {
    if (!qr) return "";
    return `${typeof window !== "undefined" ? window.location.origin : ""}/r/${qr.short_code}`;
  }, [qr]);

  const isGoogleReview = destinationType === "google_review";
  const biz = qr?.businesses as { name?: string; brand_primary?: string; logo_url?: string; google_review_url?: string } | null;
  const effectiveDestinationUrl = isGoogleReview ? biz?.google_review_url ?? "" : destinationUrl;
  const urlValid = isValidHttpsUrl(effectiveDestinationUrl);

  async function saveAll() {
    if (!qr) return;
    if (!urlValid) return toast.error("Destination URL is not a valid https:// URL");
    const patch = {
      label,
      destination_type: destinationType,
      destination_url: isGoogleReview ? biz?.google_review_url ?? null : destinationUrl.trim() || null,
      destination_label: destinationLabelValue.trim() || null,
      landing_mode: landingMode,
      expires_at: expiresAt ? new Date(expiresAt).toISOString() : null,
      design: design as unknown as never,
      logo_url: logoUrl,
      fg_color: design.fg,
      bg_color: design.bg,
    };
    const { error } = await supabase.from("qr_codes").update(patch).eq("id", qr.id);
    if (error) return toast.error(error.message);
    toast.success("Saved");
    qc.invalidateQueries({ queryKey: ["qr", id] });
  }

  async function setStatus(next: "active" | "paused" | "archived") {
    if (!qr) return;
    const patch: { status: string; archived_at?: string | null } = { status: next };
    if (next === "archived") patch.archived_at = new Date().toISOString();
    if (next === "active") patch.archived_at = null;
    const { error } = await supabase.from("qr_codes").update(patch).eq("id", qr.id);
    if (error) return toast.error(error.message);
    toast.success(`Marked ${next}`);
    qc.invalidateQueries({ queryKey: ["qr", id] });
    qc.invalidateQueries({ queryKey: ["all-qr"] });
  }

  async function clearExpiry() {
    if (!qr) return;
    const { error } = await supabase.from("qr_codes").update({ expires_at: null }).eq("id", qr.id);
    if (error) return toast.error(error.message);
    setExpiresAt("");
    toast.success("Expiry removed");
    qc.invalidateQueries({ queryKey: ["qr", id] });
  }

  async function duplicateQr() {
    if (!qr) return;
    const { data: userData } = await supabase.auth.getUser();
    if (!userData.user) return toast.error("Not signed in");
    const { data, error } = await supabase
      .from("qr_codes")
      .insert({
        business_id: qr.business_id,
        owner_id: userData.user.id,
        location_id: qr.location_id,
        short_code: generateShortCode(),
        label: `${qr.label ?? "Untitled"} (copy)`,
        campaign: qr.campaign,
        destination_type: qr.destination_type,
        destination_url: qr.destination_url,
        destination_label: qr.destination_label,
        landing_mode: qr.landing_mode,
        expires_at: qr.expires_at,
        status: "active",
        design: qr.design ?? {},
        logo_url: qr.logo_url,
        fg_color: qr.fg_color,
        bg_color: qr.bg_color,
        style: qr.style,
      })
      .select("id")
      .single();
    if (error) return toast.error(error.message);
    toast.success("Duplicated");
    qc.invalidateQueries({ queryKey: ["all-qr"] });
    navigate({ to: "/qr/$id", params: { id: data.id } });
  }

  async function deleteQr() {
    if (!qr) return;
    if (!confirm("Delete this QR code? Scan history will also be removed.")) return;
    const { error } = await supabase.from("qr_codes").delete().eq("id", qr.id);
    if (error) return toast.error(error.message);
    toast.success("Deleted");
    qc.invalidateQueries({ queryKey: ["all-qr"] });
    navigate({ to: "/qr" });
  }

  function copyUrl() {
    navigator.clipboard.writeText(shortUrl);
    toast.success("Copied");
  }

  if (!qr) return <div className="h-40 rounded-3xl bg-muted shimmer" />;

  const effectiveStatus = computeEffectiveStatus(qr.status, qr.expires_at);

  return (
    <div className="animate-fade-in-up space-y-6">
      <Link to="/businesses/$id" params={{ id: qr.business_id }} className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft className="h-4 w-4" /> Back to business
      </Link>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-3xl font-semibold tracking-tight">{qr.label || "Untitled QR"}</h1>
            <Badge variant={statusBadgeVariant(effectiveStatus)} className="rounded-full">
              {statusLabel(effectiveStatus)}
            </Badge>
          </div>
          <p className="mt-1 text-sm text-muted-foreground">
            {biz?.name} · {destinationLabel(destinationType)}
            {(qr.locations as { name?: string } | null)?.name ? ` · ${(qr.locations as { name?: string }).name}` : ""}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          {qr.status === "active" && (
            <Button variant="outline" onClick={() => setStatus("paused")} className="rounded-full"><Pause className="mr-1 h-4 w-4"/>Pause</Button>
          )}
          {qr.status === "paused" && (
            <Button variant="outline" onClick={() => setStatus("active")} className="rounded-full"><Play className="mr-1 h-4 w-4"/>Activate</Button>
          )}
          {qr.status !== "archived" ? (
            <Button variant="outline" onClick={() => setStatus("archived")} className="rounded-full"><Archive className="mr-1 h-4 w-4"/>Archive</Button>
          ) : (
            <Button variant="outline" onClick={() => setStatus("active")} className="rounded-full"><RefreshCw className="mr-1 h-4 w-4"/>Restore</Button>
          )}
          <Button variant="outline" onClick={duplicateQr} className="rounded-full"><CopyIcon className="mr-1 h-4 w-4"/>Duplicate</Button>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_400px]">
        <Card className="rounded-3xl border-border/70 shadow-[var(--shadow-card)]">
          <CardContent className="p-6 space-y-5">
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label>Label</Label>
                <Input value={label} onChange={(e) => setLabel(e.target.value)} className="rounded-xl"/>
              </div>
              <div className="space-y-1.5">
                <Label>Destination type</Label>
                <Select value={destinationType} onValueChange={(v) => setDestinationType(v as DestinationType)}>
                  <SelectTrigger className="rounded-xl"><SelectValue/></SelectTrigger>
                  <SelectContent>
                    {DESTINATION_TYPES.map((t) => (
                      <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5 sm:col-span-2">
                <Label>Destination URL</Label>
                <Input
                  value={isGoogleReview ? biz?.google_review_url ?? "" : destinationUrl}
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
              <div className="space-y-1.5">
                <Label>Destination label</Label>
                <Input value={destinationLabelValue} onChange={(e) => setDestinationLabelValue(e.target.value)} placeholder="View menu" className="rounded-xl"/>
              </div>
              <div className="space-y-1.5">
                <Label>Landing behaviour</Label>
                <Select value={landingMode} onValueChange={(v) => setLandingMode(v as typeof landingMode)}>
                  <SelectTrigger className="rounded-xl"><SelectValue/></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="landing">Show landing page</SelectItem>
                    <SelectItem value="redirect">Redirect immediately</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5 sm:col-span-2">
                <Label>Expires at</Label>
                <div className="flex gap-2">
                  <Input type="datetime-local" value={expiresAt} onChange={(e) => setExpiresAt(e.target.value)} className="rounded-xl"/>
                  {expiresAt && (
                    <Button variant="outline" onClick={clearExpiry} className="rounded-full">Remove</Button>
                  )}
                </div>
              </div>
            </div>

            <div className="grid gap-2 rounded-2xl bg-accent/40 p-4 text-xs sm:grid-cols-2">
              <MetaRow label="Short link">
                <div className="flex items-center gap-2 font-mono">
                  <span className="truncate">{shortUrl}</span>
                  <button onClick={copyUrl} className="rounded-md p-1 hover:bg-accent"><Copy className="h-3.5 w-3.5"/></button>
                  <a href={shortUrl} target="_blank" rel="noreferrer" className="rounded-md p-1 hover:bg-accent"><ExternalLink className="h-3.5 w-3.5"/></a>
                </div>
              </MetaRow>
              <MetaRow label="Destination">{destinationLabel(destinationType)}</MetaRow>
              <MetaRow label="Landing">{landingMode === "redirect" ? "Immediate redirect" : "Landing page first"}</MetaRow>
              <MetaRow label="Status">{statusLabel(effectiveStatus)}</MetaRow>
              <MetaRow label="Expires">{qr.expires_at ? new Date(qr.expires_at).toLocaleString() : "Never"}</MetaRow>
              <MetaRow label="Last updated">{new Date(qr.updated_at).toLocaleString()}</MetaRow>
            </div>

            <div className="flex flex-wrap items-center justify-between gap-3 border-t border-border pt-4">
              <Button variant="outline" onClick={deleteQr} className="rounded-full text-destructive hover:text-destructive"><Trash2 className="mr-1 h-4 w-4"/>Delete</Button>
              <Button onClick={saveAll} className="rounded-full">Save changes</Button>
            </div>

            <div className="rounded-2xl bg-accent p-3 text-center text-xs text-accent-foreground">
              <span className="font-semibold">{qr.scans_count}</span> total scans
            </div>
          </CardContent>
        </Card>

        <QrDesigner
          value={design}
          onChange={setDesign}
          url={shortUrl}
          logoUrl={logoUrl}
          onLogoChange={setLogoUrl}
          brandColor={biz?.brand_primary ?? null}
          filenameStem={qr.short_code}
        />
      </div>
    </div>
  );
}

function MetaRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <p className="uppercase tracking-wide text-[10px] text-muted-foreground">{label}</p>
      <div className="mt-0.5 truncate">{children}</div>
    </div>
  );
}
