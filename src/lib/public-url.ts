/**
 * Canonical public base URL for anything that gets printed, exported or scanned.
 *
 * QR codes must NEVER encode the Lovable editor preview origin
 * (id-preview--*.lovable.app) — that domain is always behind a Lovable login,
 * so a printed code pointing at it locks scanners out.
 */
export const PUBLIC_SITE_URL = "https://www.guestreviewpro.com";

/** Origins that are safe to use as-is when building scan links. */
const PUBLIC_HOST_SUFFIXES = [
  "guestreviewpro.com",
  "googlereviewpro.com",
];

function isLocalHost(hostname: string) {
  return hostname === "localhost" || hostname === "127.0.0.1" || hostname.endsWith(".local");
}

/**
 * Returns the base URL that public-facing links (QR scan URLs) should use.
 * - Local development keeps the local origin so scanning/testing works offline.
 * - A real custom domain is kept as-is.
 * - Anything else (Lovable preview, *.lovable.app) falls back to the canonical
 *   public domain.
 */
export function getPublicBaseUrl(): string {
  if (typeof window === "undefined") return PUBLIC_SITE_URL;
  const { hostname, origin } = window.location;
  if (isLocalHost(hostname)) return origin;
  if (PUBLIC_HOST_SUFFIXES.some((suffix) => hostname === suffix || hostname.endsWith(`.${suffix}`))) {
    return origin;
  }
  return PUBLIC_SITE_URL;
}

/** Builds the public scan URL for a QR short code. */
export function buildScanUrl(shortCode: string | null | undefined): string {
  if (!shortCode) return "";
  return `${getPublicBaseUrl()}/r/${shortCode}`;
}
