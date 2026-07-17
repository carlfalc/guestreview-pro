import { createFileRoute, useParams, useNavigate } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Star, Globe, Phone, MapPin, Clock, PauseCircle, ArchiveX } from "lucide-react";
import { parseUserAgent } from "@/lib/short-code";
import { destinationLabel, type DestinationType } from "@/lib/qr-destinations";
import { resolveQrDestination } from "@/lib/resolve-qr-destination";

export const Route = createFileRoute("/r/$code")({
  component: GuestLanding,
});

interface QrRow {
  id: string;
  business_id: string;
  location_id: string | null;
  owner_id: string;
  campaign: string | null;
  status: string;
  destination_type: string;
  destination_url: string | null;
  destination_label: string | null;
  landing_mode: string;
  expires_at: string | null;
  archived_at: string | null;
  businesses: {
    name: string;
    logo_url: string | null;
    brand_primary: string | null;
    google_review_url: string | null;
    website: string | null;
    phone: string | null;
    address: string | null;
    welcome_message: string | null;
    cover_image_url: string | null;
  } | null;
  locations: { name: string | null; location_type: string | null } | null;
}

type State =
  | { kind: "loading" }
  | { kind: "notFound" }
  | { kind: "paused"; qr: QrRow }
  | { kind: "expired"; qr: QrRow }
  | { kind: "archived"; qr: QrRow }
  | { kind: "invalidDestination"; qr: QrRow }
  | { kind: "active"; qr: QrRow; finalUrl: string };

function sessionStorageKey(qrId: string) {
  return `grp:scan:${qrId}`;
}

function getOrCreateSessionId(): string {
  const key = "grp:sid";
  try {
    let sid = sessionStorage.getItem(key);
    if (!sid) {
      sid = crypto.randomUUID();
      sessionStorage.setItem(key, sid);
    }
    return sid;
  } catch {
    return crypto.randomUUID();
  }
}

async function hashString(input: string): Promise<string> {
  const buf = new TextEncoder().encode(input);
  const hash = await crypto.subtle.digest("SHA-256", buf);
  return Array.from(new Uint8Array(hash))
    .slice(0, 8)
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

async function recordScan(qr: QrRow): Promise<string | null> {
  try {
    let existingId: string | null = null;
    try { existingId = sessionStorage.getItem(sessionStorageKey(qr.id)); } catch { /* ignore */ }
    if (existingId) return existingId;

    const ua = navigator.userAgent;
    const parsed = parseUserAgent(ua);
    let timezone: string | null = null;
    try { timezone = Intl.DateTimeFormat().resolvedOptions().timeZone ?? null; } catch { /* ignore */ }
    const sessionId = getOrCreateSessionId();
    const visitorHash = await hashString(`${ua}-${sessionId}`);

    const { data: inserted } = await supabase
      .from("scan_events")
      .insert({
        qr_code_id: qr.id,
        business_id: qr.business_id,
        location_id: qr.location_id,
        owner_id: qr.owner_id,
        campaign: qr.campaign,
        destination_type: qr.destination_type,
        device_type: parsed.device_type,
        os: parsed.os,
        browser: parsed.browser,
        user_agent: ua,
        visitor_hash: visitorHash,
        referrer: document.referrer || null,
        session_id: sessionId,
        timezone,
      })
      .select("id")
      .single();

    if (!inserted) return null;
    try { sessionStorage.setItem(sessionStorageKey(qr.id), inserted.id); } catch { /* ignore */ }
    await supabase.rpc("increment_qr_scans", { p_qr_id: qr.id }).then(() => {}, () => {});
    return inserted.id;
  } catch {
    return null;
  }
}

function GuestLanding() {
  const { code } = useParams({ from: "/r/$code" });
  const navigate = useNavigate();
  const [state, setState] = useState<State>({ kind: "loading" });
  const [eventId, setEventId] = useState<string | null>(null);
  const didRun = useRef(false);

  useEffect(() => {
    if (didRun.current) return;
    didRun.current = true;

    (async () => {
      const { data, error } = await supabase
        .from("qr_codes")
        .select(
          "id, business_id, location_id, owner_id, campaign, status, destination_type, destination_url, destination_label, landing_mode, expires_at, archived_at, businesses(name, logo_url, brand_primary, google_review_url, website, phone, address, welcome_message, cover_image_url), locations(name, location_type)",
        )
        .eq("short_code", code)
        .maybeSingle();
      if (error || !data) {
        setState({ kind: "notFound" });
        return;
      }
      const qr = data as unknown as QrRow;

      if (qr.status === "archived") { setState({ kind: "archived", qr }); return; }
      if (qr.status === "paused") { setState({ kind: "paused", qr }); return; }
      if (qr.expires_at && new Date(qr.expires_at).getTime() < Date.now()) {
        setState({ kind: "expired", qr }); return;
      }

      const resolved = resolveQrDestination({
        destinationType: qr.destination_type,
        destinationUrl: qr.destination_url,
        businessGoogleReviewUrl: qr.businesses?.google_review_url,
      });

      if (!resolved.url) {
        setState({ kind: "invalidDestination", qr });
        return;
      }

      const id = await recordScan(qr);
      setEventId(id);
      setState({ kind: "active", qr, finalUrl: resolved.url });

      if (qr.landing_mode === "redirect") {
        if (id) {
          const sid = getOrCreateSessionId();
          await supabase.rpc("mark_scan_clicked", {
            p_event_id: id,
            p_session_id: sid,
            p_is_review: qr.destination_type === "google_review",
          }).then(() => {}, () => {});
        }
        window.location.href = resolved.url;
      }
    })();
  }, [code]);

  if (state.kind === "loading") {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
      </div>
    );
  }
  if (state.kind === "notFound") {
    return <StatusPage title="Link not found" message="This QR is invalid or has been removed." onHome={() => navigate({ to: "/" })} />;
  }
  if (state.kind === "paused") {
    return <StatusPage icon={<PauseCircle className="h-8 w-8" />} brand={state.qr.businesses?.brand_primary ?? undefined} businessName={state.qr.businesses?.name} title="Temporarily unavailable" message="This link has been paused by the owner. Please check back soon." />;
  }
  if (state.kind === "expired") {
    return <StatusPage icon={<Clock className="h-8 w-8" />} brand={state.qr.businesses?.brand_primary ?? undefined} businessName={state.qr.businesses?.name} title="This link has expired" message="Please contact the business for an up-to-date link." />;
  }
  if (state.kind === "archived") {
    return <StatusPage icon={<ArchiveX className="h-8 w-8" />} brand={state.qr.businesses?.brand_primary ?? undefined} businessName={state.qr.businesses?.name} title="Not available" message="This QR code is no longer active." />;
  }

  return <ActiveLanding qr={state.qr} eventId={eventId} />;
}

function ActiveLanding({ qr, eventId }: { qr: QrRow; eventId: string | null }) {
  const b = qr.businesses!;
  const brand = b.brand_primary || "#0071e3";
  const dtype = qr.destination_type as DestinationType;
  const finalUrl = dtype === "google_review"
    ? b.google_review_url ?? qr.destination_url ?? ""
    : qr.destination_url ?? "";

  async function goDestination() {
    if (eventId) {
      const sid = getOrCreateSessionId();
      await supabase.rpc("mark_scan_clicked", {
        p_event_id: eventId,
        p_session_id: sid,
        p_is_review: dtype === "google_review",
      }).then(() => {}, () => {});
    }
    if (finalUrl) window.location.href = finalUrl;
  }

  const ctaLabel =
    qr.destination_label ||
    (dtype === "google_review" ? "Leave a Google review" : `Continue to ${destinationLabel(dtype)}`);

  return (
    <div
      className="min-h-screen"
      style={{ background: `linear-gradient(180deg, ${brand}22 0%, var(--color-background) 45%)` }}
    >
      <div className="mx-auto max-w-md px-6 py-12">
        <div className="animate-fade-in-up rounded-4xl border border-border/60 bg-card p-8 text-center shadow-[var(--shadow-elevated)]">
          {b.logo_url ? (
            <img src={b.logo_url} alt={b.name} className="mx-auto h-16 w-16 rounded-2xl object-cover"/>
          ) : (
            <div className="mx-auto grid h-16 w-16 place-items-center rounded-2xl text-2xl font-semibold text-white" style={{ background: brand }}>
              {b.name.slice(0, 1)}
            </div>
          )}
          <h1 className="mt-5 text-2xl font-semibold tracking-tight">{b.name}</h1>
          {qr.locations?.name && (<p className="mt-1 text-sm text-muted-foreground">{qr.locations.name}</p>)}
          <p className="mt-4 text-[15px] leading-relaxed text-muted-foreground">
            {b.welcome_message || "Loved your experience? We'd love your feedback."}
          </p>

          <Button
            onClick={goDestination}
            disabled={!finalUrl}
            size="lg"
            className="mt-8 w-full rounded-full text-base font-semibold"
            style={{ background: brand }}
          >
            {dtype === "google_review" && <Star className="mr-2 h-5 w-5 fill-current"/>}
            {ctaLabel}
          </Button>

          <div className="mt-4 grid grid-cols-1 gap-2">
            {b.website && (
              <a href={b.website} target="_blank" rel="noreferrer">
                <Button variant="outline" className="w-full rounded-full bg-card"><Globe className="mr-2 h-4 w-4"/> Visit website</Button>
              </a>
            )}
            {b.phone && (
              <a href={`tel:${b.phone}`}>
                <Button variant="outline" className="w-full rounded-full bg-card"><Phone className="mr-2 h-4 w-4"/> Call us</Button>
              </a>
            )}
            {b.address && (
              <a href={`https://maps.google.com/?q=${encodeURIComponent(b.address)}`} target="_blank" rel="noreferrer">
                <Button variant="outline" className="w-full rounded-full bg-card"><MapPin className="mr-2 h-4 w-4"/> Get directions</Button>
              </a>
            )}
          </div>

          <p className="mt-8 text-[10px] uppercase tracking-widest text-muted-foreground">Powered by GuestReview Pro</p>
        </div>
      </div>
    </div>
  );
}

function StatusPage({
  title,
  message,
  icon,
  brand,
  businessName,
  onHome,
}: {
  title: string;
  message: string;
  icon?: React.ReactNode;
  brand?: string;
  businessName?: string;
  onHome?: () => void;
}) {
  const bg = brand || "#0071e3";
  return (
    <div className="min-h-screen" style={{ background: `linear-gradient(180deg, ${bg}22 0%, var(--color-background) 45%)` }}>
      <div className="mx-auto max-w-md px-6 py-16">
        <div className="rounded-4xl border border-border/60 bg-card p-10 text-center shadow-[var(--shadow-elevated)]">
          {icon && (
            <div className="mx-auto grid h-14 w-14 place-items-center rounded-2xl text-white" style={{ background: bg }}>
              {icon}
            </div>
          )}
          {businessName && <p className="mt-4 text-sm text-muted-foreground">{businessName}</p>}
          <h1 className="mt-2 text-2xl font-semibold tracking-tight">{title}</h1>
          <p className="mt-3 text-sm text-muted-foreground">{message}</p>
          {onHome && (
            <Button onClick={onHome} className="mt-8 rounded-full">Home</Button>
          )}
        </div>
      </div>
    </div>
  );
}
