// First-visit attribution for anonymous marketing traffic.
//
// PRIVACY: only campaign tags and a referring host are kept. No full URLs, no
// query strings beyond the UTM tags, no identifiers of any kind. Values are
// short and enum-like so they survive the analytics property sanitiser.

const KEY = "grp_attribution";

export type Attribution = {
  source?: string;
  medium?: string;
  campaign?: string;
  /** Referring host only, never a full URL. */
  referrer?: string;
  /** First public path this visitor landed on. */
  landing?: string;
};

function clean(value: string | null | undefined): string | undefined {
  if (!value) return undefined;
  const v = value.trim().toLowerCase().slice(0, 40);
  return /^[a-z0-9._\-/ ]+$/.test(v) ? v : undefined;
}

function capture(): Attribution {
  const params = new URLSearchParams(window.location.search);
  let referrer: string | undefined;
  try {
    if (document.referrer) {
      const host = new URL(document.referrer).hostname;
      if (host && host !== window.location.hostname) referrer = clean(host);
    }
  } catch {
    /* ignore malformed referrers */
  }

  const attribution: Attribution = {};
  const source = clean(params.get("utm_source"));
  const medium = clean(params.get("utm_medium"));
  const campaign = clean(params.get("utm_campaign"));
  const landing = clean(window.location.pathname);

  if (source) attribution.source = source;
  if (medium) attribution.medium = medium;
  if (campaign) attribution.campaign = campaign;
  if (referrer) attribution.referrer = referrer;
  if (landing) attribution.landing = landing;
  if (!attribution.source && referrer) attribution.source = "referral";
  if (!attribution.source) attribution.source = "direct";
  return attribution;
}

/** First-touch attribution for this browser session. Safe on the server. */
export function getAttribution(): Attribution {
  if (typeof window === "undefined") return {};
  try {
    const stored = window.sessionStorage.getItem(KEY);
    if (stored) return JSON.parse(stored) as Attribution;
    const fresh = capture();
    window.sessionStorage.setItem(KEY, JSON.stringify(fresh));
    return fresh;
  } catch {
    return {};
  }
}
