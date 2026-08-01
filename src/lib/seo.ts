/**
 * Shared SEO metadata builder for every public page.
 *
 * One canonical domain is used everywhere so a preview or *.lovable.app
 * origin can never end up in a canonical tag, an og:url or the sitemap.
 */
export const SITE_URL = "https://googlereviewpro.com";
export const SITE_NAME = "GuestReview Pro";

export type JsonLd = Record<string, unknown>;

export interface SeoInput {
  /** Route path beginning with "/" (no query string, no origin). */
  path: string;
  title: string;
  description: string;
  /** Absolute https URL only. Omit when there is no meaningful image. */
  image?: string;
  type?: "website" | "article" | "product";
  noindex?: boolean;
  jsonLd?: JsonLd[];
}

export function absoluteUrl(path: string): string {
  if (path === "/") return `${SITE_URL}/`;
  return `${SITE_URL}${path.startsWith("/") ? path : `/${path}`}`;
}

/** Builds the `head()` return value for a public route. */
export function seo(input: SeoInput) {
  const url = absoluteUrl(input.path);
  const meta: Array<Record<string, string>> = [
    { title: input.title },
    { name: "description", content: input.description },
    { property: "og:title", content: input.title },
    { property: "og:description", content: input.description },
    { property: "og:type", content: input.type ?? "website" },
    { property: "og:url", content: url },
    { property: "og:site_name", content: SITE_NAME },
    { name: "twitter:card", content: "summary_large_image" },
    { name: "twitter:title", content: input.title },
    { name: "twitter:description", content: input.description },
  ];

  if (input.image) {
    meta.push({ property: "og:image", content: input.image });
    meta.push({ name: "twitter:image", content: input.image });
  }
  if (input.noindex) {
    meta.push({ name: "robots", content: "noindex, nofollow" });
  }

  return {
    meta,
    links: [{ rel: "canonical", href: url }],
    scripts: (input.jsonLd ?? []).map((block) => ({
      type: "application/ld+json",
      children: JSON.stringify(block),
    })),
  };
}

/** Convenience builders for the structured data used across the site. */
export const jsonLd = {
  organization(): JsonLd {
    return {
      "@context": "https://schema.org",
      "@type": "Organization",
      name: SITE_NAME,
      url: SITE_URL,
      description:
        "Independent software for creating branded Google review QR codes and print-ready marketing packs.",
    };
  },
  website(): JsonLd {
    return {
      "@context": "https://schema.org",
      "@type": "WebSite",
      name: SITE_NAME,
      url: SITE_URL,
    };
  },
  softwareApplication(): JsonLd {
    return {
      "@context": "https://schema.org",
      "@type": "SoftwareApplication",
      name: SITE_NAME,
      applicationCategory: "BusinessApplication",
      operatingSystem: "Web",
      url: SITE_URL,
      offers: {
        "@type": "Offer",
        price: "0",
        priceCurrency: "USD",
        description: "Free plan: 1 business and 1 QR code, no card required.",
      },
    };
  },
  faq(items: Array<{ q: string; a: string }>): JsonLd {
    return {
      "@context": "https://schema.org",
      "@type": "FAQPage",
      mainEntity: items.map((item) => ({
        "@type": "Question",
        name: item.q,
        acceptedAnswer: { "@type": "Answer", text: item.a },
      })),
    };
  },
  breadcrumbs(trail: Array<{ name: string; path: string }>): JsonLd {
    return {
      "@context": "https://schema.org",
      "@type": "BreadcrumbList",
      itemListElement: trail.map((item, i) => ({
        "@type": "ListItem",
        position: i + 1,
        name: item.name,
        item: absoluteUrl(item.path),
      })),
    };
  },
  article(input: {
    headline: string;
    description: string;
    path: string;
    datePublished: string;
    dateModified?: string;
  }): JsonLd {
    return {
      "@context": "https://schema.org",
      "@type": "Article",
      headline: input.headline,
      description: input.description,
      mainEntityOfPage: absoluteUrl(input.path),
      datePublished: input.datePublished,
      dateModified: input.dateModified ?? input.datePublished,
      author: { "@type": "Organization", name: SITE_NAME, url: SITE_URL },
      publisher: { "@type": "Organization", name: SITE_NAME, url: SITE_URL },
    };
  },
};

