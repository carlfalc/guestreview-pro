import { createFileRoute, Link, notFound } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";
import {
  PublicShell,
  PageHero,
  Section,
  CardGrid,
  InfoCard,
  Faq,
  FinalCta,
} from "@/components/public/PublicShell";
import { LeadCaptureForm } from "@/components/public/LeadCaptureForm";
import { TemplatePreview } from "@/components/public/TemplatePreview";
import { industryBySlug, INDUSTRIES, type Industry } from "@/lib/industries";
import { FORMATS } from "@/lib/qr-formats";
import { GALLERY_TEMPLATES, templateDimensions } from "@/lib/templates";
import { seo, jsonLd } from "@/lib/seo";
import { usePublicPageView, usePublicTrack } from "@/hooks/use-public-track";

export const Route = createFileRoute("/industries/$slug")({
  loader: ({ params }) => {
    const industry = industryBySlug(params.slug);
    if (!industry) throw notFound();
    return { industry };
  },
  head: ({ params, loaderData }) => {
    const industry = loaderData?.industry;
    if (!industry) {
      return seo({
        path: `/industries/${params.slug}`,
        title: "Industry not found | GuestReview Pro",
        description: "This industry page is not available.",
        noindex: true,
      });
    }
    return seo({
      path: `/industries/${industry.slug}`,
      title: industry.metaTitle,
      description: industry.metaDescription,
      jsonLd: [
        jsonLd.faq(industry.faqs),
        jsonLd.breadcrumbs([
          { name: "Home", path: "/" },
          { name: "Industries", path: "/industries" },
          { name: industry.name, path: `/industries/${industry.slug}` },
        ]),
      ],
    });
  },
  component: IndustryPage,
});

function IndustryPage() {
  const { industry } = Route.useLoaderData();
  usePublicPageView({ page: "industry", industry: industry.slug });
  const track = usePublicTrack();

  const packFormats = industry.packFormatIds
    .map((id) => FORMATS.find((f) => f.id === id))
    .filter((f): f is NonNullable<typeof f> => Boolean(f));

  const templates = GALLERY_TEMPLATES.filter((t) => t.industries.includes(industry.slug)).slice(0, 3);

  const others = INDUSTRIES.filter((i) => i.slug !== industry.slug);

  return (
    <PublicShell>
      <PageHero eyebrow={industry.name} title={industry.heroTitle} subtitle={industry.heroSubtitle}>
        <div className="mt-8 flex flex-wrap justify-center gap-3">
          <Link
            to="/auth"
            data-cta="signup"
            onClick={() => track("public_cta_clicked", { cta: "industry_hero_signup", industry: industry.slug })}
          >
            <Button size="lg" className="rounded-full bg-white px-8 text-[#0a0f3d] hover:bg-white/90">
              Create your free QR
            </Button>
          </Link>
          <Link
            to="/templates"
            onClick={() => track("public_cta_clicked", { cta: "industry_hero_templates", industry: industry.slug })}
          >
            <Button
              size="lg"
              variant="outline"
              className="rounded-full border-white/20 bg-white/5 px-8 text-white hover:bg-white/10 hover:text-white"
            >
              Browse templates
            </Button>
          </Link>
        </div>
        <p className="mt-4 text-sm text-white/55">1 business and 1 QR code free. No card required.</p>
      </PageHero>

      <Section title={`Why ${industry.shortName.toLowerCase()} are different`}>
        <div className="space-y-4">
          {industry.intro.map((paragraph) => (
            <p key={paragraph.slice(0, 32)} className="text-[15px] leading-relaxed text-white/65">
              {paragraph}
            </p>
          ))}
        </div>
      </Section>

      <Section
        title="Where to put the code"
        intro="Placements ordered roughly by how well they perform in this trade."
      >
        <div className="overflow-x-auto rounded-3xl border border-white/10">
          <table className="w-full min-w-[620px] text-left text-sm">
            <caption className="sr-only">Recommended QR code placements for {industry.name}</caption>
            <thead className="bg-white/[0.04] text-white/70">
              <tr>
                <th scope="col" className="px-5 py-3 font-medium">Placement</th>
                <th scope="col" className="px-5 py-3 font-medium">Format</th>
                <th scope="col" className="px-5 py-3 font-medium">Why it works</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/10 text-white/60">
              {industry.placements.map((p) => (
                <tr key={p.where}>
                  <td className="px-5 py-3 font-medium text-white/80">{p.where}</td>
                  <td className="px-5 py-3">{p.format}</td>
                  <td className="px-5 py-3">{p.why}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Section>

      <Section title={industry.packName} intro={industry.packBlurb}>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {packFormats.map((f) => (
            <div key={f.id} className="rounded-2xl border border-white/10 bg-white/[0.03] p-5">
              <p className="text-sm font-semibold">{f.name}</p>
              <p className="mt-1 text-xs text-white/50">
                {f.width} × {f.height} {f.medium === "print" ? "mm" : "px"} · min QR {f.minQrSize}
                {f.medium === "print" ? " mm" : " px"}
              </p>
              <p className="mt-3 text-sm text-white/60">{f.material}</p>
            </div>
          ))}
        </div>
      </Section>

      {templates.length > 0 && (
        <Section title="Templates that suit this trade" intro="Demo artwork — your own branding replaces it.">
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {templates.map((t) => (
              <div key={t.id} className="rounded-3xl border border-white/10 bg-white/[0.03] p-5">
                <div className="grid h-48 place-items-center overflow-hidden rounded-2xl bg-white/5 p-4">
                  <TemplatePreview template={t} />
                </div>
                <p className="mt-4 text-sm font-semibold">{t.name}</p>
                <p className="mt-1 text-xs text-white/50">{templateDimensions(t)} · {t.material}</p>
              </div>
            ))}
          </div>
          <div className="mt-6">
            <Link
              to="/templates"
              onClick={() => track("public_cta_clicked", { cta: "industry_gallery", industry: industry.slug })}
            >
              <Button
                variant="outline"
                className="rounded-full border-white/20 bg-white/5 text-white hover:bg-white/10 hover:text-white"
              >
                See the full template gallery
              </Button>
            </Link>
          </div>
        </Section>
      )}

      <Section title="When to ask">
        <CardGrid>
          {industry.timing.map((t) => (
            <InfoCard key={t.title} title={t.title} body={t.body} />
          ))}
        </CardGrid>
      </Section>

      <Section title="Get the placement guide">
        <div className="mx-auto max-w-2xl">
          <LeadCaptureForm industry={industry.slug} sourcePath={`/industries/${industry.slug}`} />
        </div>
      </Section>

      <Faq items={industry.faqs} />

      <Section title="Other industries">
        <div className="flex flex-wrap gap-2">
          {others.map((i) => (
            <Link
              key={i.slug}
              to="/industries/$slug"
              params={{ slug: i.slug }}
              className="rounded-full border border-white/15 bg-white/5 px-4 py-2 text-sm text-white/70 transition hover:bg-white/10 hover:text-white"
            >
              {i.name}
            </Link>
          ))}
        </div>
      </Section>

      <FinalCta title={`Start your ${industry.shortName.toLowerCase()} review programme`} />
    </PublicShell>
  );
}

export type { Industry };
