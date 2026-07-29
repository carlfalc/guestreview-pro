// Guest scan entry point.
//
// This route answers the very first HTTP request from the scanning phone with
// a 302 straight to the destination — no React bundle, no hydration, no
// client-side database round trip. Anything that is not a plain redirect
// (landing mode, paused/expired/archived, invalid destination, unknown code)
// is handed to /r/<code>/view which renders the full branded experience.
import { createFileRoute } from "@tanstack/react-router";
import { useEffect } from "react";
import { createClient } from "@supabase/supabase-js";
import { parseUserAgent } from "@/lib/short-code";
import { resolveQrDestination } from "@/lib/resolve-qr-destination";
import type { Database } from "@/integrations/supabase/types";

const SCAN_COOKIE_MAX_AGE = 60 * 30; // 30 minutes, mirrors the old sessionStorage dedupe

function serverSupabase() {
  const url = process.env.SUPABASE_URL!;
  const key = process.env.SUPABASE_PUBLISHABLE_KEY!;
  return createClient<Database>(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
    global: {
      fetch: (input, init) => {
        const h = new Headers(init?.headers);
        if (key.startsWith("sb_") && h.get("Authorization") === `Bearer ${key}`) {
          h.delete("Authorization");
        }
        h.set("apikey", key);
        return fetch(input, { ...init, headers: h });
      },
    },
  });
}

function readCookie(request: Request, name: string): string | null {
  const raw = request.headers.get("cookie");
  if (!raw) return null;
  for (const part of raw.split(";")) {
    const [k, ...rest] = part.trim().split("=");
    if (k === name) return decodeURIComponent(rest.join("="));
  }
  return null;
}

async function shortHash(input: string): Promise<string> {
  const buf = new TextEncoder().encode(input);
  const hash = await crypto.subtle.digest("SHA-256", buf);
  return Array.from(new Uint8Array(hash))
    .slice(0, 8)
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

export const Route = createFileRoute("/r/$code")({
  server: {
    handlers: {
      GET: async ({ request, params }) => {
        const code = params.code;
        const viewUrl = new URL(request.url);
        viewUrl.pathname = `/r/${encodeURIComponent(code)}/view`;
        const toView = () =>
          new Response(null, {
            status: 302,
            headers: { Location: viewUrl.toString(), "Cache-Control": "no-store" },
          });

        let supabase: ReturnType<typeof serverSupabase>;
        try {
          supabase = serverSupabase();
        } catch {
          return toView();
        }

        const { data, error } = await supabase
          .from("qr_codes")
          .select(
            "id, status, destination_type, destination_url, landing_mode, expires_at, businesses(google_review_url)",
          )
          .eq("short_code", code)
          .maybeSingle();

        if (error || !data) return toView();

        const qr = data as unknown as {
          id: string;
          status: string;
          destination_type: string;
          destination_url: string | null;
          landing_mode: string;
          expires_at: string | null;
          businesses: { google_review_url: string | null } | null;
        };

        if (qr.status !== "active") return toView();
        if (qr.expires_at && new Date(qr.expires_at).getTime() < Date.now()) return toView();
        if (qr.landing_mode !== "redirect") return toView();

        const resolved = resolveQrDestination({
          destinationType: qr.destination_type,
          destinationUrl: qr.destination_url,
          businessGoogleReviewUrl: qr.businesses?.google_review_url,
        });
        if (!resolved.url) return toView();

        // One database call records the scan and bumps the counter, then we go.
        const cookieName = `grp_scan_${qr.id.slice(0, 8)}`;
        const alreadyCounted = readCookie(request, cookieName);
        const headers = new Headers({
          Location: resolved.url,
          "Cache-Control": "no-store, no-cache, must-revalidate",
          Referrer_Policy: "no-referrer",
        });
        headers.delete("Referrer_Policy");
        headers.set("Referrer-Policy", "no-referrer");

        if (!alreadyCounted) {
          const ua = request.headers.get("user-agent") ?? "";
          const parsed = parseUserAgent(ua);
          const sessionId = crypto.randomUUID();
          const visitorHash = await shortHash(`${ua}-${sessionId}`);
          const countryCode =
            request.headers.get("cf-ipcountry") ??
            request.headers.get("x-vercel-ip-country") ??
            null;

          try {
            await supabase.rpc("log_scan_redirect", {
              p_qr_id: qr.id,
              p_destination_type: qr.destination_type,
              p_device_type: parsed.device_type,
              p_os: parsed.os,
              p_browser: parsed.browser,
              p_user_agent: ua || null,
              p_referrer: request.headers.get("referer"),
              p_visitor_hash: visitorHash,
              p_session_id: sessionId,
              p_country_code: countryCode,
              p_clicked: true,
            });
          } catch {
            // Analytics must never block a guest reaching the destination.
          }

          headers.append(
            "Set-Cookie",
            `${cookieName}=1; Path=/r; Max-Age=${SCAN_COOKIE_MAX_AGE}; HttpOnly; Secure; SameSite=Lax`,
          );
        }

        return new Response(null, { status: 302, headers });
      },
    },
  },
  component: ScanFallback,
});

// Only reached on a client-side navigation to /r/<code> (the server handler
// owns every real scan). Bounce to the full view route.
function ScanFallback() {
  const { code } = Route.useParams();
  useEffect(() => {
    window.location.replace(`/r/${encodeURIComponent(code)}/view`);
  }, [code]);
  return (
    <div className="flex min-h-screen items-center justify-center bg-background">
      <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
    </div>
  );
}
