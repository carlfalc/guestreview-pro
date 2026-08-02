// Signed, opaque unsubscribe / preference tokens.
// Server-only: never import from client code.
//
// The token carries no raw email address and no readable owner id — the
// payload is HMAC-signed and the owner id is only recoverable server-side.

import { EMAIL_TOKEN_SECRET_NAME } from "./email-token-shared";

export type TokenScope = "weekly_report" | "product_updates" | "all" | "manage";

export interface TokenPayload {
  /** owner id */
  o: string;
  /** scope */
  s: TokenScope;
  /** expiry, epoch seconds */
  e: number;
  /** version — lets us revoke a whole generation of tokens */
  v: number;
}

export const TOKEN_VERSION = 1;
export const TOKEN_TTL_DAYS = 120;

function b64url(bytes: Uint8Array): string {
  let bin = "";
  for (const b of bytes) bin += String.fromCharCode(b);
  return btoa(bin).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function fromB64url(value: string): Uint8Array {
  const pad = value.replace(/-/g, "+").replace(/_/g, "/");
  const bin = atob(pad + "=".repeat((4 - (pad.length % 4)) % 4));
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

function encode(value: string): Uint8Array<ArrayBuffer> {
  return new TextEncoder().encode(value) as Uint8Array<ArrayBuffer>;
}

async function hmac(secret: string, data: string): Promise<Uint8Array> {
  const key = await crypto.subtle.importKey(
    "raw",
    encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const sig = await crypto.subtle.sign("HMAC", key, encode(data));
  return new Uint8Array(sig);
}

function timingSafeEqual(a: Uint8Array, b: Uint8Array): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= (a[i] ?? 0) ^ (b[i] ?? 0);
  return diff === 0;
}

/** Read the signing secret. Throws (safely, without leaking) when absent. */
export function tokenSecret(): string {
  const secret = process.env[EMAIL_TOKEN_SECRET_NAME] || process.env["LOVABLE_API_KEY"];
  if (!secret) throw new Error("Email token signing secret is not configured");
  return secret;
}

export async function signEmailToken(
  payload: Omit<TokenPayload, "e" | "v"> & { ttlDays?: number },
  now = new Date(),
): Promise<string> {
  const ttl = payload.ttlDays ?? TOKEN_TTL_DAYS;
  const body: TokenPayload = {
    o: payload.o,
    s: payload.s,
    v: TOKEN_VERSION,
    e: Math.floor(now.getTime() / 1000) + ttl * 24 * 60 * 60,
  };
  const encoded = b64url(encode(JSON.stringify(body)));
  const sig = b64url(await hmac(tokenSecret(), encoded));
  return `${encoded}.${sig}`;
}

export type VerifyResult =
  | { ok: true; payload: TokenPayload }
  | { ok: false; reason: "malformed" | "invalid_signature" | "expired" | "revoked" };

export async function verifyEmailToken(token: string, now = new Date()): Promise<VerifyResult> {
  const raw = String(token ?? "");
  const dot = raw.indexOf(".");
  if (dot <= 0 || dot === raw.length - 1) return { ok: false, reason: "malformed" };
  const encoded = raw.slice(0, dot);
  const provided = raw.slice(dot + 1);

  let expected: Uint8Array;
  try {
    expected = await hmac(tokenSecret(), encoded);
  } catch {
    return { ok: false, reason: "invalid_signature" };
  }

  let providedBytes: Uint8Array;
  try {
    providedBytes = fromB64url(provided);
  } catch {
    return { ok: false, reason: "malformed" };
  }
  if (!timingSafeEqual(expected, providedBytes)) return { ok: false, reason: "invalid_signature" };

  let payload: TokenPayload;
  try {
    payload = JSON.parse(new TextDecoder().decode(fromB64url(encoded))) as TokenPayload;
  } catch {
    return { ok: false, reason: "malformed" };
  }
  if (!payload?.o || !payload?.s) return { ok: false, reason: "malformed" };
  if (payload.v !== TOKEN_VERSION) return { ok: false, reason: "revoked" };
  if (payload.e * 1000 <= now.getTime()) return { ok: false, reason: "expired" };
  return { ok: true, payload };
}
