import { createFileRoute, useParams, useNavigate } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Star, Globe, Phone, MapPin } from "lucide-react";
import { parseUserAgent } from "@/lib/short-code";

export const Route = createFileRoute("/r/$code")({
  component: GuestLanding,
});

interface QrRow {
  id: string;
  business_id: string;
  location_id: string | null;
  owner_id: string;
  campaign: string | null;
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

function GuestLanding() {
  const { code } = useParams({ from: "/r/$code" });
  const navigate = useNavigate();
  const [qr, setQr] = useState<QrRow | null>(null);
  const [eventId, setEventId] = useState<string | null>(null);
  const [notFound, setNotFound] = useState(false);
  const didRun = useRef(false);

  useEffect(() => {
    if (didRun.current) return;
    didRun.current = true;

    (async () => {
      const { data, error } = await supabase
        .from("qr_codes")
        .select(
          "id, business_id, location_id, owner_id, campaign, businesses(name, logo_url, brand_primary, google_review_url, website, phone, address, welcome_message, cover_image_url), locations(name, location_type)",
        )
        .eq("short_code", code)
        .eq("status", "active")
        .maybeSingle();
      if (error || !data) {
        setNotFound(true);
        return;
      }
      const qrRow = data as unknown as QrRow;
      setQr(qrRow);

      // Reuse an existing event id for this QR in this session to avoid duplicates on refresh.
      let existingId: string | null = null;
      try {
        existingId = sessionStorage.getItem(sessionStorageKey(qrRow.id));
      } catch {
        // ignore
      }
      if (existingId) {
        setEventId(existingId);
        return;
      }

      const ua = navigator.userAgent;
      const parsed = parseUserAgent(ua);
      let timezone: string | null = null;
      try {
        timezone = Intl.DateTimeFormat().resolvedOptions().timeZone ?? null;
      } catch {
        // ignore
      }
      const sessionId = getOrCreateSessionId();
      const visitorHash = await hashString(`${ua}-${sessionId}`);

      const { data: inserted, error: insErr } = await supabase
        .from("scan_events")
        .insert({
          qr_code_id: qrRow.id,
          business_id: qrRow.business_id,
          location_id: qrRow.location_id,
          owner_id: qrRow.owner_id,
          campaign: qrRow.campaign,
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

      if (insErr || !inserted) return;
      setEventId(inserted.id);
      try {
        sessionStorage.setItem(sessionStorageKey(qrRow.id), inserted.id);
      } catch {
        // ignore
      }
      // Increment scans_count exactly once for this new event.
      await supabase.rpc("increment_qr_scans", { p_qr_id: qrRow.id }).then(
        () => {},
        () => {},
      );
    })();
  }, [code]);

  async function goReview() {
    if (!qr) return;
    if (eventId) {
      await supabase.rpc("mark_scan_clicked", { p_event_id: eventId }).then(
        () => {},
        () => {},
      );
    }
    const url = qr.businesses?.google_review_url;
    if (url) window.location.href = url;
  }

  if (notFound) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background px-4">
        <div className="text-center">
          <h1 className="text-2xl font-semibold">Link not found</h1>
          <p className="mt-2 text-sm text-muted-foreground">This QR is inactive or has been removed.</p>
          <Button onClick={() => navigate({ to: "/" })} className="mt-6 rounded-full">Home</Button>
        </div>
      </div>
    );
  }

  if (!qr) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
      </div>
    );
  }

  const b = qr.businesses!;
  const brand = b.brand_primary || "#0071e3";

  return (
    <div
      className="min-h-screen"
      style={{
        background: `linear-gradient(180deg, ${brand}22 0%, var(--color-background) 45%)`,
      }}
    >
      <div className="mx-auto max-w-md px-6 py-12">
        <div className="animate-fade-in-up rounded-4xl border border-border/60 bg-card p-8 text-center shadow-[var(--shadow-elevated)]">
          {b.logo_url ? (
            <img src={b.logo_url} alt={b.name} className="mx-auto h-16 w-16 rounded-2xl object-cover"/>
          ) : (
            <div
              className="mx-auto grid h-16 w-16 place-items-center rounded-2xl text-2xl font-semibold text-white"
              style={{ background: brand }}
            >
              {b.name.slice(0, 1)}
            </div>
          )}
          <h1 className="mt-5 text-2xl font-semibold tracking-tight">{b.name}</h1>
          {qr.locations?.name && (
            <p className="mt-1 text-sm text-muted-foreground">{qr.locations.name}</p>
          )}
          <p className="mt-4 text-[15px] leading-relaxed text-muted-foreground">
            {b.welcome_message || "Loved your experience? We'd love your feedback."}
          </p>

          <Button
            onClick={goReview}
            disabled={!b.google_review_url}
            size="lg"
            className="mt-8 w-full rounded-full text-base font-semibold"
            style={{ background: brand }}
          >
            <Star className="mr-2 h-5 w-5 fill-current"/> Leave a Google review
          </Button>

          <div className="mt-4 grid grid-cols-1 gap-2">
            {b.website && (
              <a href={b.website} target="_blank" rel="noreferrer">
                <Button variant="outline" className="w-full rounded-full bg-card">
                  <Globe className="mr-2 h-4 w-4"/> Visit website
                </Button>
              </a>
            )}
            {b.phone && (
              <a href={`tel:${b.phone}`}>
                <Button variant="outline" className="w-full rounded-full bg-card">
                  <Phone className="mr-2 h-4 w-4"/> Call us
                </Button>
              </a>
            )}
            {b.address && (
              <a href={`https://maps.google.com/?q=${encodeURIComponent(b.address)}`} target="_blank" rel="noreferrer">
                <Button variant="outline" className="w-full rounded-full bg-card">
                  <MapPin className="mr-2 h-4 w-4"/> Get directions
                </Button>
              </a>
            )}
          </div>

          <p className="mt-8 text-[10px] uppercase tracking-widest text-muted-foreground">
            Powered by GuestReview Pro
          </p>
        </div>
      </div>
    </div>
  );
}
