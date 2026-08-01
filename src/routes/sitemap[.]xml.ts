import { createFileRoute } from "@tanstack/react-router";
import type {} from "@tanstack/react-start";
import { PUBLIC_ROUTES } from "@/lib/public-routes";

const BASE_URL = "https://googlereviewpro.com";

// Only public, indexable routes. Everything under the authenticated layout
// and the per-code scan routes (/r/$code) are excluded on purpose. The
// inventory itself lives in src/lib/public-routes.ts so the internal SEO
// admin view and this sitemap can never disagree.

export const Route = createFileRoute("/sitemap.xml")({
  server: {
    handlers: {
      GET: async () => {
        const urls = PUBLIC_ROUTES.map((e) =>
          [
            `  <url>`,
            `    <loc>${BASE_URL}${e.path}</loc>`,
            `    <changefreq>${e.changefreq}</changefreq>`,
            `    <priority>${e.priority}</priority>`,
            `  </url>`,
          ].join("\n"),
        );

        const xml = [
          `<?xml version="1.0" encoding="UTF-8"?>`,
          `<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">`,
          ...urls,
          `</urlset>`,
        ].join("\n");

        return new Response(xml, {
          headers: {
            "Content-Type": "application/xml",
            "Cache-Control": "public, max-age=3600",
          },
        });
      },
    },
  },
});
