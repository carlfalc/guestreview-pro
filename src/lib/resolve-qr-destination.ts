// Shared helper for resolving the final URL of a QR code.
// QR-specific destination_url takes priority over the business default.
// Rejects empty/whitespace/placeholder strings, javascript:/data:/relative
// paths and non-http protocols.

export type DestinationSource = "qr" | "business" | null;

export interface ResolveInput {
  destinationType: string;
  destinationUrl: string | null | undefined;
  businessGoogleReviewUrl?: string | null | undefined;
}

export interface ResolveResult {
  url: string | null;
  source: DestinationSource;
}

const BAD_LITERALS = new Set(["null", "undefined", "none"]);

function isLocalhost(): boolean {
  if (typeof window === "undefined") return false;
  const h = window.location.hostname;
  return h === "localhost" || h === "127.0.0.1" || h === "0.0.0.0";
}

export function normalizeUrlInput(raw: string | null | undefined): string {
  if (raw == null) return "";
  return String(raw).trim();
}

export function isValidDestinationUrl(raw: string | null | undefined): boolean {
  const v = normalizeUrlInput(raw);
  if (!v) return false;
  if (BAD_LITERALS.has(v.toLowerCase())) return false;
  const lower = v.toLowerCase();
  if (lower.startsWith("javascript:") || lower.startsWith("data:") || lower.startsWith("vbscript:")) {
    return false;
  }
  // must be absolute URL — no relative paths
  if (v.startsWith("/") || v.startsWith("./") || v.startsWith("../")) return false;
  let u: URL;
  try {
    u = new URL(v);
  } catch {
    return false;
  }
  if (u.protocol === "https:") return true;
  if (u.protocol === "http:" && isLocalhost()) return true;
  return false;
}

export function resolveQrDestination(input: ResolveInput): ResolveResult {
  const qrUrl = normalizeUrlInput(input.destinationUrl);
  if (input.destinationType === "google_review") {
    if (isValidDestinationUrl(qrUrl)) return { url: qrUrl, source: "qr" };
    const bizUrl = normalizeUrlInput(input.businessGoogleReviewUrl);
    if (isValidDestinationUrl(bizUrl)) return { url: bizUrl, source: "business" };
    return { url: null, source: null };
  }
  if (isValidDestinationUrl(qrUrl)) return { url: qrUrl, source: "qr" };
  return { url: null, source: null };
}
