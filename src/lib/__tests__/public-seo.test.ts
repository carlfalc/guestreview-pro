import { describe, it, expect } from "vitest";
import { PUBLIC_ROUTES, PUBLIC_ROUTE_PATHS } from "@/lib/public-routes";
import {
  RESOURCE_ARTICLES,
  RESOURCE_CATEGORIES,
  relatedResources,
  resourceBySlug,
} from "@/lib/resources";
import { SITE_URL, absoluteUrl } from "@/lib/seo";

describe("public route inventory", () => {
  it("has no duplicate paths", () => {
    expect(new Set(PUBLIC_ROUTE_PATHS).size).toBe(PUBLIC_ROUTE_PATHS.length);
  });

  it("only lists absolute, non-authenticated paths", () => {
    for (const route of PUBLIC_ROUTES) {
      expect(route.path.startsWith("/")).toBe(true);
      expect(route.path).not.toContain("?");
      expect(route.path.startsWith("/dashboard")).toBe(false);
      expect(route.path.startsWith("/r/")).toBe(false);
    }
  });

  it("includes every resource article and category", () => {
    for (const a of RESOURCE_ARTICLES) {
      expect(PUBLIC_ROUTE_PATHS).toContain(`/resources/${a.slug}`);
    }
    for (const c of RESOURCE_CATEGORIES) {
      expect(PUBLIC_ROUTE_PATHS).toContain(`/resources/category/${c.id}`);
    }
    expect(PUBLIC_ROUTE_PATHS).toContain("/resources");
  });

  it("builds canonical URLs on the production domain only", () => {
    for (const path of PUBLIC_ROUTE_PATHS) {
      expect(absoluteUrl(path).startsWith(`${SITE_URL}/`)).toBe(true);
    }
    expect(SITE_URL).not.toContain("lovable.app");
  });
});

describe("resource centre content", () => {
  it("has unique slugs and titles", () => {
    const slugs = RESOURCE_ARTICLES.map((a) => a.slug);
    const titles = RESOURCE_ARTICLES.map((a) => a.metaTitle);
    expect(new Set(slugs).size).toBe(slugs.length);
    expect(new Set(titles).size).toBe(titles.length);
  });

  it("keeps meta titles and descriptions within search-result limits", () => {
    for (const a of RESOURCE_ARTICLES) {
      expect(a.metaTitle.length).toBeLessThanOrEqual(60);
      expect(a.metaDescription.length).toBeLessThanOrEqual(160);
    }
  });

  it("uses a known category and unique section anchors", () => {
    const ids = RESOURCE_CATEGORIES.map((c) => c.id);
    for (const a of RESOURCE_ARTICLES) {
      expect(ids).toContain(a.category);
      const anchors = a.sections.map((s) => s.id);
      expect(new Set(anchors).size).toBe(anchors.length);
      expect(a.sections.length).toBeGreaterThan(2);
      expect(a.faqs.length).toBeGreaterThan(0);
    }
  });

  it("only links internally to articles that exist", () => {
    for (const a of RESOURCE_ARTICLES) {
      for (const slug of a.relatedSlugs) {
        expect(resourceBySlug(slug), `${a.slug} -> ${slug}`).toBeDefined();
      }
      expect(relatedResources(a).length).toBeGreaterThan(0);
    }
  });

  it("gives every category at least one article", () => {
    for (const c of RESOURCE_CATEGORIES) {
      expect(RESOURCE_ARTICLES.some((a) => a.category === c.id)).toBe(true);
    }
  });
});
