import { useMemo, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";
import { PublicShell, PageHero, Section, FinalCta } from "@/components/public/PublicShell";
import { TemplatePreview } from "@/components/public/TemplatePreview";
import { LeadCaptureForm } from "@/components/public/LeadCaptureForm";
import { INDUSTRIES } from "@/lib/industries";
import { GALLERY_TEMPLATES, templateDimensions } from "@/lib/templates";
import { seo, jsonLd, absoluteUrl } from "@/lib/seo";
import { usePublicPageView, usePublicTrack } from "@/hooks/use-public-track";

export const Route = createFileRoute("/examples")({
  component: ExamplesGallery,
  head: () =>
    seo({
      path: "/examples",
      title: "Review QR Code Examples by Industry | GuestReview Pro",
      description:
        "Real-world Google review QR code examples: where each code goes, who scans it and which marketing pack covers it, across hospitality, retail and services.",
      jsonLd: [
        jsonLd.breadcrumbs([
          { name: "Home", path: "/" },
          { name: "QR examples", path: "/examples" },
        ]),
        {
          "@context": "https://schema.org",
          "@type": "ItemList",
          name: "Google review QR code examples by industry",
          itemListElement: INDUSTRIES.map((i, index) => ({
            "@type": "ListItem",
            position: index + 1,
            name: `${i.name} review QR code examples`,
            url: absoluteUrl(`/industries/${i.slug}`),
          })),
        },
      ],
    }),
});

function ExamplesGallery() {
  usePublicPageView({ page: "examples_gallery" });
  const track = usePublicTrack();
  const [active, setActive] = useState<string>(INDUSTRIES[0].slug);

  const industry = useMemo(
    () => INDUSTRIES.find((i) => i.slug === active) ?? INDUSTRIES[0],
    [active],
  );
  const packPreview = useMemo(
    () => GALLERY_TEMPLATES.filter((t) => t.industries.includes(industry.slug)).slice(0, 3),
    [industry.slug],
  );

  return (
    <PublicShell>
      <PageHero
        eyebrow="QR examples"
        title="What a review QR code looks like in the real world"
        subtitle="Every example below pairs a surface with the format, the scanning distance it has to survive and the moment it is meant to catch."
      />

      <Section title="Pick an industry">
        <div className="flex flex-wrap gap-2" role="tablist" aria-label="Industry examples">
          {INDUSTRIES.map((i) => (
            <button
              key={i.slug}
              type="button"
              role="tab"
              aria-selected={i.slug === active}
              onClick={() => {
                setActive(i.slug);
                track("public_cta_clicked", { cta: "examples_tab", industry: i.slug });
              }}
              className={
                i.slug === active
                  ? "rounded-full bg-white px-4 py-2 text-sm font-medium text-[#0a0f3d]"
                  : "rounded-full border border-white/15 bg-white/5 px-4 py-2 text-sm text-white/70 transition hover:bg-white/10 hover:text-white"
              }
            >
              {i.shortName}
            </button>
          ))}
        </div>

        <div className="mt-8 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {industry.placements.map((p, index) => {
            const suggested = packPreview[index % Math.max(packPreview.length, 1)];
            return (
              <article
                key={p.where}
                className="flex flex-col rounded-3xl border border-white/10 bg-white/[0.03] p-6"
              >
                <h3 className="text-base font-semibold">{p.where}</h3>
                <p className="mt-1 text-xs uppercase tracking-wide text-white/40">{p.format}</p>
                <p className="mt-3 text-sm leading-relaxed text-white/60">{p.why}</p>
                {suggested && (
                  <p className="mt-4 border-t border-white/10 pt-4 text-xs text-white/45">
                    Closest template: <span className="text-white/70">{suggested.name}</span> ·{" "}
                    {templateDimensions(suggested)}
                  </p>
                )}
              </article>
            );
          })}
        </div>
      </Section>


      <Section
        title={`${industry.packName} preview`}
        intro={industry.packBlurb}
      >
        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {packPreview.map((t) => (
            <div key={t.id} className="rounded-3xl border border-white/10 bg-white/[0.03] p-5">
              <div className="grid h-52 place-items-center overflow-hidden rounded-2xl bg-white/5 p-4">
                <TemplatePreview template={t} />
              </div>
              <p className="mt-4 text-sm font-semibold">{t.name}</p>
              <p className="mt-1 text-xs text-white/50">
                {templateDimensions(t)} · {t.placement}
              </p>
            </div>
          ))}
        </div>
        <div className="mt-6 flex flex-wrap gap-3">
          <Link
            to="/industries/$slug"
            params={{ slug: industry.slug }}
            onClick={() => track("public_cta_clicked", { cta: "examples_to_industry", industry: industry.slug })}
          >
            <Button className="rounded-full bg-white text-[#0a0f3d] hover:bg-white/90">
              Read the {industry.shortName.toLowerCase()} guide
            </Button>
          </Link>
          <Link to="/templates">
            <Button
              variant="outline"
              className="rounded-full border-white/20 bg-white/5 text-white hover:bg-white/10 hover:text-white"
            >
              Browse all templates
            </Button>
          </Link>
        </div>
      </Section>

      <Section title="Get the full placement guide">
        <div className="mx-auto max-w-2xl">
          <LeadCaptureForm sourcePath="/examples" />
        </div>
      </Section>

      <FinalCta title="Create a code for your own counter" />
    </PublicShell>
  );
}
