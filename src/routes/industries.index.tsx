import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowRight } from "lucide-react";
import { PublicShell, PageHero, Section } from "@/components/public/PublicShell";
import { LeadCaptureForm } from "@/components/public/LeadCaptureForm";
import { INDUSTRIES } from "@/lib/industries";
import { seo, jsonLd, absoluteUrl } from "@/lib/seo";
import { usePublicPageView, usePublicTrack } from "@/hooks/use-public-track";

export const Route = createFileRoute("/industries/")({
  component: IndustriesIndex,
  head: () =>
    seo({
      path: "/industries",
      title: "Google Review QR Codes by Industry | GuestReview Pro",
      description:
        "Placement guidance, print formats and marketing packs for hotels, motels, restaurants, cafés, retail, tourism, salons and medical practices.",
      jsonLd: [
        jsonLd.breadcrumbs([
          { name: "Home", path: "/" },
          { name: "Industries", path: "/industries" },
        ]),
        {
          "@context": "https://schema.org",
          "@type": "ItemList",
          name: "Industries served by GuestReview Pro",
          itemListElement: INDUSTRIES.map((industry, i) => ({
            "@type": "ListItem",
            position: i + 1,
            name: industry.name,
            url: absoluteUrl(`/industries/${industry.slug}`),
          })),
        },
      ],
    }),
});

function IndustriesIndex() {
  usePublicPageView({ page: "industries_index" });
  const track = usePublicTrack();

  return (
    <PublicShell>
      <PageHero
        eyebrow="Industries"
        title="Review QR codes, tuned to how your customers actually behave"
        subtitle="A hotel guest, a coffee regular and a dental patient need completely different placement, sizing and tone. Pick your trade for specific guidance."
      />

      <Section title="Choose your industry">
        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {INDUSTRIES.map((industry) => (
            <Link
              key={industry.slug}
              to="/industries/$slug"
              params={{ slug: industry.slug }}
              onClick={() => track("public_cta_clicked", { cta: "industry_card", industry: industry.slug })}
              className="group rounded-3xl border border-white/10 bg-white/[0.03] p-6 transition hover:border-white/25 hover:bg-white/[0.06]"
            >
              <p className="text-lg font-semibold">{industry.name}</p>
              <p className="mt-2 line-clamp-3 text-sm leading-relaxed text-white/55">
                {industry.heroSubtitle}
              </p>
              <span className="mt-4 inline-flex items-center gap-1.5 text-sm text-white/70 group-hover:text-white">
                {industry.packName}
                <ArrowRight className="h-3.5 w-3.5" aria-hidden />
              </span>
            </Link>
          ))}
        </div>
      </Section>

      <Section title="Not sure where to start?" intro="The placement guide covers every trade on this page in a single PDF.">
        <div className="mx-auto max-w-2xl">
          <LeadCaptureForm sourcePath="/industries" />
        </div>
      </Section>
    </PublicShell>
  );
}
