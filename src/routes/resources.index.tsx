import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowRight } from "lucide-react";
import { PublicShell, PageHero, Section, FinalCta } from "@/components/public/PublicShell";
import { LeadCaptureForm } from "@/components/public/LeadCaptureForm";
import { RESOURCE_ARTICLES, RESOURCE_CATEGORIES, resourcesInCategory } from "@/lib/resources";
import { seo, jsonLd, absoluteUrl } from "@/lib/seo";
import { usePublicPageView, usePublicTrack } from "@/hooks/use-public-track";

export const Route = createFileRoute("/resources/")({
  component: ResourcesIndex,
  head: () =>
    seo({
      path: "/resources",
      title: "Google Review & QR Marketing Resources | GuestReview Pro",
      description:
        "Practical guides on collecting Google reviews, printing QR codes that actually scan, local SEO and running a review programme that survives staff turnover.",
      jsonLd: [
        jsonLd.breadcrumbs([
          { name: "Home", path: "/" },
          { name: "Resources", path: "/resources" },
        ]),
        {
          "@context": "https://schema.org",
          "@type": "ItemList",
          name: "GuestReview Pro resource centre",
          numberOfItems: RESOURCE_ARTICLES.length,
          itemListElement: RESOURCE_ARTICLES.map((a, i) => ({
            "@type": "ListItem",
            position: i + 1,
            name: a.title,
            url: absoluteUrl(`/resources/${a.slug}`),
          })),
        },
      ],
    }),
});

function ResourcesIndex() {
  usePublicPageView({ page: "resources_index" });
  const track = usePublicTrack();

  return (
    <PublicShell>
      <PageHero
        eyebrow="Resource centre"
        title="Everything we know about collecting Google reviews"
        subtitle="Written for owners and managers, not marketers. Policy-safe collection tactics, print rules that stop codes failing, and the operational routines that keep a review programme alive."
      />

      <Section title="Browse by topic">
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {RESOURCE_CATEGORIES.map((c) => (
            <Link
              key={c.id}
              to="/resources/category/$category"
              params={{ category: c.id }}
              onClick={() => track("resource_cta_clicked", { cta: "category", category: c.id })}
              className="group rounded-3xl border border-white/10 bg-white/[0.03] p-6 transition hover:border-white/25 hover:bg-white/[0.06]"
            >
              <p className="text-base font-semibold">{c.label}</p>
              <p className="mt-2 text-sm leading-relaxed text-white/55">{c.blurb}</p>
              <span className="mt-4 inline-flex items-center gap-1.5 text-sm text-white/70 group-hover:text-white">
                {resourcesInCategory(c.id).length} article
                {resourcesInCategory(c.id).length === 1 ? "" : "s"}
                <ArrowRight className="h-3.5 w-3.5" aria-hidden />
              </span>
            </Link>
          ))}
        </div>
      </Section>

      <Section title="All guides">
        <div className="grid gap-5 sm:grid-cols-2">
          {RESOURCE_ARTICLES.map((a) => (
            <article
              key={a.slug}
              className="rounded-3xl border border-white/10 bg-white/[0.03] p-6"
            >
              <p className="text-xs uppercase tracking-wide text-white/40">
                {RESOURCE_CATEGORIES.find((c) => c.id === a.category)?.label} · {a.readMinutes} min
                read
              </p>
              <h3 className="mt-3 text-lg font-semibold">
                <Link
                  to="/resources/$slug"
                  params={{ slug: a.slug }}
                  onClick={() => track("resource_cta_clicked", { cta: "article_card", article: a.slug })}
                  className="transition hover:text-white/80"
                >
                  {a.title}
                </Link>
              </h3>
              <p className="mt-2 text-sm leading-relaxed text-white/60">{a.excerpt}</p>
            </article>
          ))}
        </div>
      </Section>

      <Section title="Get the placement guide">
        <div className="mx-auto max-w-2xl">
          <LeadCaptureForm sourcePath="/resources" />
        </div>
      </Section>

      <FinalCta title="Put the theory on a counter" />
    </PublicShell>
  );
}
