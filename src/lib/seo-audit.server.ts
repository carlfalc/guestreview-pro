// Server-only SEO auditing: fetches each public route from this deployment and
// inspects the rendered head. No third-party service is involved.

import { PUBLIC_ROUTES } from "./public-routes";
import { SITE_URL } from "./seo";

export type SeoRouteCheck = {
  path: string;
  label: string;
  status: number | null;
  title: string | null;
  titleLength: number;
  description: string | null;
  descriptionLength: number;
  canonical: string | null;
  canonicalCount: number;
  h1Count: number;
  jsonLdBlocks: number;
  robots: string | null;
  issues: string[];
};

function match(html: string, re: RegExp): string | null {
  const m = re.exec(html);
  return m?.[1]?.trim() ?? null;
}

function countMatches(html: string, re: RegExp): number {
  return (html.match(re) ?? []).length;
}

function decode(value: string | null): string | null {
  if (!value) return null;
  return value
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">");
}

function inspect(path: string, label: string, status: number, html: string): SeoRouteCheck {
  const title = decode(match(html, /<title[^>]*>([\s\S]*?)<\/title>/i));
  const description = decode(
    match(html, /<meta[^>]+name=["']description["'][^>]+content=["']([^"']*)["']/i) ??
      match(html, /<meta[^>]+content=["']([^"']*)["'][^>]+name=["']description["']/i),
  );
  const canonical = match(html, /<link[^>]+rel=["']canonical["'][^>]+href=["']([^"']*)["']/i);
  const canonicalCount = countMatches(html, /rel=["']canonical["']/gi);
  const h1Count = countMatches(html, /<h1[\s>]/gi);
  const jsonLdBlocks = countMatches(html, /application\/ld\+json/gi);
  const robots = match(html, /<meta[^>]+name=["']robots["'][^>]+content=["']([^"']*)["']/i);

  const issues: string[] = [];
  if (status !== 200) issues.push(`HTTP ${status}`);
  if (!title) issues.push("Missing title");
  else if (title.length > 60) issues.push(`Title ${title.length} chars (over 60)`);
  if (!description) issues.push("Missing meta description");
  else if (description.length > 160)
    issues.push(`Description ${description.length} chars (over 160)`);
  if (!canonical) issues.push("Missing canonical");
  else if (!canonical.startsWith(SITE_URL))
    issues.push("Canonical is not on the production domain");
  if (canonicalCount > 1) issues.push(`${canonicalCount} canonical tags`);
  if (h1Count === 0) issues.push("No H1");
  if (h1Count > 1) issues.push(`${h1Count} H1 elements`);
  if (jsonLdBlocks === 0) issues.push("No structured data");
  if (robots && /noindex/i.test(robots)) issues.push("Marked noindex");

  return {
    path,
    label,
    status,
    title,
    titleLength: title?.length ?? 0,
    description,
    descriptionLength: description?.length ?? 0,
    canonical,
    canonicalCount,
    h1Count,
    jsonLdBlocks,
    robots,
    issues,
  };
}

/** Fetch and inspect every public route against the supplied origin. */
export async function auditPublicRoutes(origin: string): Promise<SeoRouteCheck[]> {
  const results: SeoRouteCheck[] = [];
  // Sequential on purpose: this hits our own deployment and there is no reason
  // to burst dozens of SSR renders at once.
  for (const route of PUBLIC_ROUTES) {
    try {
      const res = await fetch(`${origin}${route.path}`, {
        headers: { accept: "text/html" },
      });
      const html = await res.text();
      results.push(inspect(route.path, route.label, res.status, html));
    } catch (err) {
      results.push({
        path: route.path,
        label: route.label,
        status: null,
        title: null,
        titleLength: 0,
        description: null,
        descriptionLength: 0,
        canonical: null,
        canonicalCount: 0,
        h1Count: 0,
        jsonLdBlocks: 0,
        robots: null,
        issues: [`Fetch failed: ${err instanceof Error ? err.message : "unknown error"}`],
      });
    }
  }
  return results;
}

export type SeoSupportCheck = {
  robotsTxtOk: boolean;
  robotsTxtMentionsSitemap: boolean;
  sitemapOk: boolean;
  sitemapUrlCount: number;
  sitemapMissingPaths: string[];
};

/** Check robots.txt and sitemap.xml agree with the route inventory. */
export async function auditSupportFiles(origin: string): Promise<SeoSupportCheck> {
  let robotsTxtOk = false;
  let robotsTxtMentionsSitemap = false;
  let sitemapOk = false;
  let sitemapUrlCount = 0;
  let sitemapMissingPaths: string[] = [];

  try {
    const res = await fetch(`${origin}/robots.txt`);
    robotsTxtOk = res.ok;
    const text = await res.text();
    robotsTxtMentionsSitemap = /sitemap\s*:/i.test(text);
  } catch {
    robotsTxtOk = false;
  }

  try {
    const res = await fetch(`${origin}/sitemap.xml`);
    sitemapOk = res.ok;
    const xml = await res.text();
    const locs = [...xml.matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => m[1]);
    sitemapUrlCount = locs.length;
    sitemapMissingPaths = PUBLIC_ROUTES.map((r) => r.path).filter(
      (p) => !locs.some((loc) => loc === `${SITE_URL}${p}` || loc === `${SITE_URL}${p}/`),
    );
  } catch {
    sitemapOk = false;
  }

  return { robotsTxtOk, robotsTxtMentionsSitemap, sitemapOk, sitemapUrlCount, sitemapMissingPaths };
}
