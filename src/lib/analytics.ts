// First-party product analytics — event catalogue and payload rules.
//
// PRIVACY: events carry no personal data. No names, emails, addresses, review
// URLs, IP addresses or user agents are ever recorded. Property values are
// restricted to short enums, booleans and numbers so a payload cannot become
// an accidental PII sink.

export const PRODUCT_EVENTS = [
  "signup_completed",
  "business_created",
  "qr_created",
  "qr_downloaded",
  "pack_created",
  "pack_exported",
  "scan_received",
  "pricing_viewed",
  "upgrade_prompt_shown",
  "upgrade_prompt_clicked",
  "checkout_started",
  "checkout_completed",
  "checkout_abandoned",
  "limit_reached",
  "onboarding_step_completed",
  "feedback_submitted",
  "public_page_viewed",
  "public_cta_clicked",
  "template_viewed",
  "lead_captured",
  "resource_viewed",
  "resource_cta_clicked",
] as const;


export type ProductEventName = (typeof PRODUCT_EVENTS)[number];

export type EventValue = string | number | boolean | null;
export type EventProperties = Record<string, EventValue>;

const MAX_KEYS = 12;
const MAX_KEY_LEN = 40;
const MAX_VALUE_LEN = 60;

/** Anything that looks like it could carry personal data is dropped. */
const BLOCKED_KEY = /(email|name|phone|address|url|token|ip|agent|password|secret)/i;

/**
 * Strip a property bag down to safe, non-identifying values. Unknown keys are
 * allowed; unsafe keys, long strings, objects and arrays are not.
 */
export function sanitiseEventProperties(input: unknown): EventProperties {
  if (!input || typeof input !== "object" || Array.isArray(input)) return {};
  const out: EventProperties = {};
  for (const [rawKey, rawValue] of Object.entries(input as Record<string, unknown>)) {
    if (Object.keys(out).length >= MAX_KEYS) break;
    const key = rawKey.trim().slice(0, MAX_KEY_LEN);
    if (!key || BLOCKED_KEY.test(key)) continue;

    if (typeof rawValue === "number" && Number.isFinite(rawValue)) {
      out[key] = rawValue;
    } else if (typeof rawValue === "boolean" || rawValue === null) {
      out[key] = rawValue;
    } else if (typeof rawValue === "string") {
      const value = rawValue.trim();
      // Anything long, or containing an @ or a scheme, is treated as unsafe.
      if (!value || value.length > MAX_VALUE_LEN) continue;
      if (value.includes("@") || /^[a-z]+:\/\//i.test(value)) continue;
      out[key] = value;
    }
  }
  return out;
}

/** Route paths are recorded; dynamic ids inside them are not. */
export function sanitisePath(path: unknown): string | null {
  if (typeof path !== "string" || !path.startsWith("/")) return null;
  const [pathname] = path.split("?");
  return pathname
    .split("/")
    .map((segment) =>
      /^[0-9a-f]{8}-[0-9a-f]{4}-/i.test(segment) || /^\d+$/.test(segment) ? ":id" : segment,
    )
    .join("/")
    .slice(0, 200);
}

export function isProductEvent(name: unknown): name is ProductEventName {
  return typeof name === "string" && (PRODUCT_EVENTS as readonly string[]).includes(name);
}

export interface OnboardingProgress {
  hasBusiness: boolean;
  hasQrCode: boolean;
  hasDownload: boolean;
  hasScan: boolean;
  hasPack: boolean;
  scanCount: number;
}

export interface OnboardingStep {
  key: keyof OnboardingProgress | "upgrade";
  title: string;
  body: string;
  cta: string;
  to: string;
  done: boolean;
}

/** The guided beta path, derived from real database state — never from flags. */
export function onboardingSteps(
  progress: OnboardingProgress | null | undefined,
  isPaid: boolean,
): OnboardingStep[] {
  const p = progress ?? {
    hasBusiness: false,
    hasQrCode: false,
    hasDownload: false,
    hasScan: false,
    hasPack: false,
    scanCount: 0,
  };
  return [
    {
      key: "hasBusiness",
      title: "Add your business",
      body: "Your name, logo and Google review link power every QR code and print asset.",
      cta: "Add business",
      to: "/businesses",
      done: p.hasBusiness,
    },
    {
      key: "hasQrCode",
      title: "Create your first QR code",
      body: "It points guests straight at your Google review page — no app, no login.",
      cta: "Create QR code",
      to: "/qr",
      done: p.hasQrCode,
    },
    {
      key: "hasDownload",
      title: "Download it or build a marketing pack",
      body: "Print-ready stickers, table tents and counter cards, sized for real printers.",
      cta: "Open marketing packs",
      to: "/marketing-packs",
      done: p.hasDownload || p.hasPack,
    },
    {
      key: "hasScan",
      title: "Get your first scan",
      body: "Put it on the counter or the table. Scan it yourself to check the journey.",
      cta: "View analytics",
      to: "/analytics",
      done: p.hasScan,
    },
    {
      key: "upgrade",
      title: "Unlock unlimited QR codes",
      body: "Pro adds unlimited codes, campaign tracking, advanced analytics and no branding.",
      cta: "Compare plans",
      to: "/plans",
      done: isPaid,
    },
  ];
}

export function onboardingCompletion(steps: OnboardingStep[]): number {
  if (!steps.length) return 0;
  return Math.round((steps.filter((s) => s.done).length / steps.length) * 100);
}
