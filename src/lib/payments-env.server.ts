/**
 * Trusted, server-only payment environment + return URL resolution.
 *
 * The browser has NO say in whether Stripe runs in sandbox or live mode, and
 * no say in where checkout returns to. Both are derived here from server
 * environment variables and the request host.
 */
import type { StripeEnv } from "./stripe.server";

/** Hosts that are unambiguously the production deployment. */
const PRODUCTION_HOSTS = [
  "www.guestreviewpro.com",
  "guestreviewpro.com",
  "www.googlereviewpro.com",
  "googlereviewpro.com",
  "google-reviews-app.lovable.app",
];

/** Canonical production origin, used when no request host is available. */
export const CANONICAL_APP_URL = "https://www.guestreviewpro.com";

function normaliseHost(host: string | null | undefined): string {
  return (host ?? "").split(":")[0].trim().toLowerCase();
}

/**
 * Is this host the production deployment? Preview builds, `*-dev.lovable.app`,
 * `id-preview--*`, localhost and anything unrecognised are NOT production.
 */
export function isProductionHost(host: string | null | undefined): boolean {
  return PRODUCTION_HOSTS.includes(normaliseHost(host));
}

/**
 * Resolve the payment environment from trusted server state only.
 *
 * Precedence:
 *  1. `PAYMENTS_ENV` (explicit server configuration) — must be exactly
 *     "sandbox" or "live"; any other value is ignored rather than trusted.
 *  2. The request host: a known production host means live.
 *  3. Everything else — local dev, Lovable preview, tests — is sandbox.
 *
 * Never reads request bodies, query parameters, cookies or client state.
 */
export function resolvePaymentsEnvironment(host?: string | null): StripeEnv {
  const configured = (process.env.PAYMENTS_ENV ?? "").trim().toLowerCase();
  if (configured === "live") return "live";
  if (configured === "sandbox") return "sandbox";
  if (process.env.NODE_ENV === "test" || process.env.VITEST) return "sandbox";
  return isProductionHost(host) ? "live" : "sandbox";
}

/** Server-authoritative app origin. Never taken from the browser. */
export function resolveAppUrl(host?: string | null): string {
  const configured = (process.env.APP_URL ?? "").trim();
  if (configured) {
    try {
      const url = new URL(configured);
      if (url.protocol === "https:" || url.protocol === "http:") {
        return url.origin;
      }
    } catch {
      /* fall through to host-derived origin */
    }
  }
  const clean = normaliseHost(host);
  if (!clean) return CANONICAL_APP_URL;
  if (clean === "localhost" || clean === "127.0.0.1") {
    return `http://${host}`;
  }
  return `https://${host}`;
}

/** The only destinations checkout or the billing portal may return to. */
export const ALLOWED_RETURN_PATHS = [
  "/billing",
  "/billing/success",
  "/billing/cancel",
  "/dashboard",
] as const;

export type AllowedReturnPath = (typeof ALLOWED_RETURN_PATHS)[number];

/**
 * Build a return URL from a caller-supplied *path hint*. Anything that is not
 * an exact allow-listed path falls back to `/billing`. Because the URL is
 * assembled from a trusted origin plus a literal path, external origins,
 * protocol-relative URLs (`//evil.com`), `javascript:` schemes, userinfo host
 * tricks (`https://app@evil.com`) and malformed input cannot escape.
 */
export function buildReturnUrl(
  pathHint: string | undefined,
  host?: string | null,
  query?: Record<string, string>,
): string {
  const match = ALLOWED_RETURN_PATHS.find((p) => p === pathHint);
  const path: AllowedReturnPath = match ?? "/billing";
  const origin = resolveAppUrl(host);
  const search = query
    ? "?" +
      Object.entries(query)
        .map(([k, v]) => `${encodeURIComponent(k)}=${v}`)
        .join("&")
    : "";
  return `${origin}${path}${search}`;
}

/** Read the request host inside a server function or server route. */
export function requestHost(request?: Request | null): string | null {
  if (!request) return null;
  const forwarded = request.headers.get("x-forwarded-host");
  if (forwarded) return forwarded.split(",")[0].trim();
  const host = request.headers.get("host");
  if (host) return host;
  try {
    return new URL(request.url).host;
  } catch {
    return null;
  }
}
