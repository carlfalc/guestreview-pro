// Single source of truth for the public, indexable route inventory.
//
// Both the sitemap and the internal SEO admin view read from here so the two
// can never drift apart.

import { INDUSTRY_SLUGS } from "./industries";
import { RESOURCE_ARTICLES, RESOURCE_CATEGORIES } from "./resources";

export type PublicRoute = {
  path: string;
  label: string;
  changefreq: "daily" | "weekly" | "monthly" | "yearly";
  priority: string;
};

export const PUBLIC_ROUTES: PublicRoute[] = [
  { path: "/", label: "Home", changefreq: "weekly", priority: "1.0" },
  {
    path: "/google-review-qr-code",
    label: "Google review QR codes",
    changefreq: "weekly",
    priority: "0.9",
  },
  { path: "/features", label: "Features", changefreq: "monthly", priority: "0.8" },
  { path: "/industries", label: "Industries", changefreq: "monthly", priority: "0.8" },
  ...INDUSTRY_SLUGS.map((slug) => ({
    path: `/industries/${slug}`,
    label: `Industry: ${slug}`,
    changefreq: "monthly" as const,
    priority: "0.8",
  })),
  { path: "/templates", label: "Template gallery", changefreq: "weekly", priority: "0.8" },
  { path: "/examples", label: "QR examples", changefreq: "weekly", priority: "0.7" },
  { path: "/resources", label: "Resource centre", changefreq: "weekly", priority: "0.8" },
  ...RESOURCE_CATEGORIES.map((c) => ({
    path: `/resources/category/${c.id}`,
    label: `Topic: ${c.label}`,
    changefreq: "monthly" as const,
    priority: "0.6",
  })),
  ...RESOURCE_ARTICLES.map((a) => ({
    path: `/resources/${a.slug}`,
    label: a.title,
    changefreq: "monthly" as const,
    priority: "0.7",
  })),
  { path: "/pricing", label: "Pricing", changefreq: "monthly", priority: "0.8" },
  { path: "/how-it-works", label: "How it works", changefreq: "monthly", priority: "0.7" },
  { path: "/compare", label: "Compare approaches", changefreq: "monthly", priority: "0.6" },
  { path: "/contact", label: "Contact", changefreq: "yearly", priority: "0.4" },
  { path: "/privacy", label: "Privacy policy", changefreq: "yearly", priority: "0.3" },
  { path: "/terms", label: "Terms of service", changefreq: "yearly", priority: "0.3" },
  { path: "/auth", label: "Sign in / sign up", changefreq: "monthly", priority: "0.5" },
];

export const PUBLIC_ROUTE_PATHS = PUBLIC_ROUTES.map((r) => r.path);
