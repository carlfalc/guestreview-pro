import { useMemo, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { PublicShell, PageHero, Section, FinalCta } from "@/components/public/PublicShell";
import { TemplatePreview } from "@/components/public/TemplatePreview";
import {
  GALLERY_CATEGORIES,
  GALLERY_TEMPLATES,
  searchTemplates,
  templateDimensions,
  type GalleryCategory,
} from "@/lib/templates";
import { INDUSTRIES } from "@/lib/industries";
import { seo, jsonLd, absoluteUrl } from "@/lib/seo";
import { usePublicPageView, usePublicTrack } from "@/hooks/use-public-track";

export const Route = createFileRoute("/templates")({
  component: TemplateGallery,
  head: () =>
    seo({
      path: "/templates",
      title: "Free Review QR Code Template Gallery | GuestReview Pro",
      description:
        "Browse print-ready Google review QR templates: stickers, table tents, reception signs, room cards, window decals and posters, with sizes and materials.",
      jsonLd: [
        jsonLd.breadcrumbs([
          { name: "Home", path: "/" },
          { name: "Template gallery", path: "/templates" },
        ]),
        {
          "@context": "https://schema.org",
          "@type": "ItemList",
          name: "Review QR code templates",
          numberOfItems: GALLERY_TEMPLATES.length,
          itemListElement: GALLERY_TEMPLATES.map((t, i) => ({
            "@type": "ListItem",
            position: i + 1,
            name: t.name,
            url: absoluteUrl("/templates"),
          })),
        },
      ],
    }),
});

function TemplateGallery() {
  usePublicPageView({ page: "template_gallery" });
  const track = usePublicTrack();

  const [query, setQuery] = useState("");
  const [category, setCategory] = useState<GalleryCategory | "all">("all");
  const [industry, setIndustry] = useState<string>("all");

  const results = useMemo(
    () => searchTemplates(query, category, industry),
    [query, category, industry],
  );

  return (
    <PublicShell>
      <PageHero
        eyebrow="Template gallery"
        title="Print-ready review QR templates for every surface"
        subtitle="Real dimensions, real materials and validated QR sizing. Every preview below uses demo businesses — your own branding replaces them in seconds."
      />

      <Section title="Find a template">
        <div className="rounded-3xl border border-white/10 bg-white/[0.03] p-6">
          <label htmlFor="template-search" className="text-sm text-white/70">
            Search templates
          </label>
          <Input
            id="template-search"
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="table tent, window, mirror, poster…"
            className="mt-2 h-11 rounded-full border-white/15 bg-white/5 text-white placeholder:text-white/40"
          />

          <fieldset className="mt-6">
            <legend className="text-sm text-white/70">Category</legend>
            <div className="mt-2 flex flex-wrap gap-2">
              <FilterChip active={category === "all"} onClick={() => setCategory("all")}>
                All
              </FilterChip>
              {GALLERY_CATEGORIES.map((c) => (
                <FilterChip key={c.id} active={category === c.id} onClick={() => setCategory(c.id)}>
                  {c.label}
                </FilterChip>
              ))}
            </div>
          </fieldset>

          <fieldset className="mt-6">
            <legend className="text-sm text-white/70">Industry</legend>
            <div className="mt-2 flex flex-wrap gap-2">
              <FilterChip active={industry === "all"} onClick={() => setIndustry("all")}>
                All
              </FilterChip>
              {INDUSTRIES.map((i) => (
                <FilterChip key={i.slug} active={industry === i.slug} onClick={() => setIndustry(i.slug)}>
                  {i.shortName}
                </FilterChip>
              ))}
            </div>
          </fieldset>
        </div>

        <p aria-live="polite" className="mt-4 text-sm text-white/50">
          {results.length} {results.length === 1 ? "template" : "templates"}
        </p>

        <div className="mt-6 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {results.map((t) => (
            <article
              key={t.id}
              className="flex flex-col rounded-3xl border border-white/10 bg-white/[0.03] p-5"
            >
              <div className="grid h-56 place-items-center overflow-hidden rounded-2xl bg-white/5 p-4">
                <TemplatePreview template={t} />
              </div>
              <h3 className="mt-4 text-base font-semibold">{t.name}</h3>
              <dl className="mt-3 space-y-1.5 text-sm text-white/55">
                <div className="flex gap-2">
                  <dt className="w-24 shrink-0 text-white/40">Size</dt>
                  <dd>{templateDimensions(t)}</dd>
                </div>
                <div className="flex gap-2">
                  <dt className="w-24 shrink-0 text-white/40">Material</dt>
                  <dd>{t.material}</dd>
                </div>
                <div className="flex gap-2">
                  <dt className="w-24 shrink-0 text-white/40">Placement</dt>
                  <dd>{t.placement}</dd>
                </div>
              </dl>
              <div className="mt-5 pt-1">
                <Link
                  to="/auth"
                  data-cta="signup"
                  onClick={() => {
                    track("template_viewed", { template: t.id, category: t.category });
                    track("public_cta_clicked", { cta: "create_this_design", template: t.id });
                  }}
                >
                  <Button className="w-full rounded-full bg-white text-[#0a0f3d] hover:bg-white/90">
                    Create this design
                  </Button>
                </Link>
              </div>
            </article>
          ))}
        </div>

        {results.length === 0 && (
          <p className="mt-8 rounded-3xl border border-white/10 bg-white/[0.03] p-8 text-center text-sm text-white/60">
            No templates match that search. Try clearing a filter.
          </p>
        )}
      </Section>

      <Section title="See them in real placements">
        <p className="text-[15px] leading-relaxed text-white/65">
          The examples gallery shows the same formats in context — which surface, which trade and
          what the code is doing there.
        </p>
        <div className="mt-6">
          <Link to="/examples">
            <Button
              variant="outline"
              className="rounded-full border-white/20 bg-white/5 text-white hover:bg-white/10 hover:text-white"
            >
              Open the examples gallery
            </Button>
          </Link>
        </div>
      </Section>

      <FinalCta title="Build your first design free" />
    </PublicShell>
  );
}

function FilterChip({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={
        active
          ? "rounded-full bg-white px-4 py-1.5 text-sm font-medium text-[#0a0f3d]"
          : "rounded-full border border-white/15 bg-white/5 px-4 py-1.5 text-sm text-white/70 transition hover:bg-white/10 hover:text-white"
      }
    >
      {children}
    </button>
  );
}
