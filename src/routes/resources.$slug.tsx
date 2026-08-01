import { createFileRoute, Link, notFound } from "@tanstack/react-router";
import { ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { PublicShell, PageHero, Section, FinalCta } from "@/components/public/PublicShell";
import { TemplatePreview } from "@/components/public/TemplatePreview";
import { LeadCaptureForm } from "@/components/public/LeadCaptureForm";
import {
  RESOURCE_CATEGORIES,
  relatedResources,
  resourceBySlug,
  type ResourceArticle,
} from "@/lib/resources";
import { GALLERY_TEMPLATES, templateDimensions } from "@/lib/templates";
import { industryBySlug } from "@/lib/industries";
import { seo, jsonLd } from "@/lib/seo";
import { usePublicPageView, usePublicTrack } from "@/hooks/use-public-track";

export const Route = createFileRoute("/resources/$slug")({
  loader: ({ params }) => {
    const article = resourceBySlug(params.slug);
    if (!article) throw notFound();
    return { article };
  },
  component: ResourceArticlePage,
  notFoundComponent: ResourceNotFound,
  head: ({ params, loaderData }) => {
    const article = loaderData?.article;
    if (!article) {
      return {
        meta: [
          { title: "Guide not found — GuestReview Pro" },
          { name: "robots", content: "noindex" },
        ],
      };
    }
    return seo({
      path: `/resources/${params.slug}`,
      title: article.metaTitle,
      description: article.metaDescription,
      type: "article",
      jsonLd: [
        jsonLd.breadcrumbs([
          { name: "Home", path: "/" },
          { name: "Resources", path: "/resources" },
          { name: article.title, path: `/resources/${article.slug}` },
        ]),
        jsonLd.article({
          headline: article.title,
          description: article.metaDescription,
          path: `/resources/${article.slug}`,
          datePublished: article.updated,
        }),
        jsonLd.faq(article.faqs),
      ],
    });
  },
});

function ResourceNotFound() {
  return (
    <PublicShell>
      <PageHero
        eyebrow="Resource centre"
        title="That guide has moved"
        subtitle="The article you were looking for is not here. Browse the resource centre for the current set of guides."
      />
      <Section>
        <Link to="/resources">
          <Button className="rounded-full bg-white text-[#0a0f3d] hover:bg-white/90">
            Back to the resource centre
          </Button>
        </Link>
      </Section>
    </PublicShell>
  );
}

function ResourceArticlePage() {
  const { article } = Route.useLoaderData() as { article: ResourceArticle };
  usePublicPageView({ page: "resource_article", article: article.slug });
  const track = usePublicTrack();

  const category = RESOURCE_CATEGORIES.find((c) => c.id === article.category);
  const related = relatedResources(article);
  const templates = GALLERY_TEMPLATES.filter((t) => article.templateIds.includes(t.id));
  const industries = article.industrySlugs
    .map((s) => industryBySlug(s))
    .filter((i): i is NonNullable<ReturnType<typeof industryBySlug>> => Boolean(i));

  return (
    <PublicShell>
      <PageHero
        eyebrow={category?.label ?? "Guide"}
        title={article.title}
        subtitle={article.excerpt}
      >
        <p className="mt-5 text-xs uppercase tracking-wide text-white/40">
          {article.readMinutes} min read · Updated{" "}
          {new Date(article.updated).toLocaleDateString("en-GB", {
            month: "long",
            year: "numeric",
          })}
        </p>
      </PageHero>

      <Section>
        <div className="grid gap-12 lg:grid-cols-[220px_minmax(0,1fr)]">
          <nav aria-label="On this page" className="lg:sticky lg:top-24 lg:self-start">
            <p className="text-xs uppercase tracking-wide text-white/40">On this page</p>
            <ul className="mt-3 space-y-2">
              {article.sections.map((s) => (
                <li key={s.id}>
                  <a
                    href={`#${s.id}`}
                    className="text-sm text-white/55 transition hover:text-white"
                  >
                    {s.heading}
                  </a>
                </li>
              ))}
              <li>
                <a href="#faq" className="text-sm text-white/55 transition hover:text-white">
                  FAQs
                </a>
              </li>
            </ul>
          </nav>

          <div className="max-w-3xl">
            {article.intro.map((p) => (
              <p key={p.slice(0, 32)} className="mb-5 text-[17px] leading-relaxed text-white/75">
                {p}
              </p>
            ))}

            {article.sections.map((s) => (
              <section key={s.id} id={s.id} className="mt-12 scroll-mt-24">
                <h2 className="text-2xl font-bold tracking-tight">{s.heading}</h2>
                {s.body.map((p) => (
                  <p
                    key={p.slice(0, 32)}
                    className="mt-4 text-[16px] leading-relaxed text-white/65"
                  >
                    {p}
                  </p>
                ))}
                {s.bullets && (
                  <ul className="mt-5 space-y-2.5">
                    {s.bullets.map((b) => (
                      <li
                        key={b.slice(0, 32)}
                        className="flex gap-3 text-[15px] leading-relaxed text-white/65"
                      >
                        <span
                          className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-white/40"
                          aria-hidden
                        />
                        <span>{b}</span>
                      </li>
                    ))}
                  </ul>
                )}
              </section>
            ))}

            <section id="faq" className="mt-14 scroll-mt-24">
              <h2 className="text-2xl font-bold tracking-tight">FAQs</h2>
              <dl className="mt-6 space-y-6">
                {article.faqs.map((f) => (
                  <div key={f.q} className="rounded-3xl border border-white/10 bg-white/[0.03] p-6">
                    <dt className="text-base font-semibold">{f.q}</dt>
                    <dd className="mt-2 text-sm leading-relaxed text-white/60">{f.a}</dd>
                  </div>
                ))}
              </dl>
            </section>

            <div className="mt-12 flex flex-wrap gap-3">
              <Link
                to="/auth"
                data-cta="signup"
                onClick={() =>
                  track("resource_cta_clicked", { cta: "signup", article: article.slug })
                }
              >
                <Button className="rounded-full bg-white text-[#0a0f3d] hover:bg-white/90">
                  Create your free review QR code
                </Button>
              </Link>
              <Link
                to="/templates"
                onClick={() =>
                  track("resource_cta_clicked", { cta: "templates", article: article.slug })
                }
              >
                <Button
                  variant="outline"
                  className="rounded-full border-white/20 bg-white/5 text-white hover:bg-white/10 hover:text-white"
                >
                  Browse print templates
                </Button>
              </Link>
            </div>
          </div>
        </div>
      </Section>

      {templates.length > 0 && (
        <Section title="Templates referenced in this guide">
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {templates.map((t) => (
              <div key={t.id} className="rounded-3xl border border-white/10 bg-white/[0.03] p-5">
                <div className="grid h-48 place-items-center overflow-hidden rounded-2xl bg-white/5 p-4">
                  <TemplatePreview template={t} />
                </div>
                <p className="mt-4 text-sm font-semibold">{t.name}</p>
                <p className="mt-1 text-xs text-white/50">
                  {templateDimensions(t)} · {t.placement}
                </p>
              </div>
            ))}
          </div>
        </Section>
      )}

      {(related.length > 0 || industries.length > 0) && (
        <Section title="Keep reading">
          <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {related.map((r: ResourceArticle) => (
              <Link
                key={r.slug}
                to="/resources/$slug"
                params={{ slug: r.slug }}
                onClick={() => track("resource_cta_clicked", { cta: "related", article: r.slug })}
                className="group rounded-3xl border border-white/10 bg-white/[0.03] p-6 transition hover:border-white/25 hover:bg-white/[0.06]"
              >
                <p className="text-base font-semibold">{r.title}</p>
                <p className="mt-2 line-clamp-3 text-sm leading-relaxed text-white/55">
                  {r.excerpt}
                </p>
                <span className="mt-4 inline-flex items-center gap-1.5 text-sm text-white/70 group-hover:text-white">
                  Read the guide
                  <ArrowRight className="h-3.5 w-3.5" aria-hidden />
                </span>
              </Link>
            ))}
            {industries.map((i) => (
              <Link
                key={i.slug}
                to="/industries/$slug"
                params={{ slug: i.slug }}
                onClick={() => track("resource_cta_clicked", { cta: "industry", industry: i.slug })}
                className="group rounded-3xl border border-white/10 bg-white/[0.03] p-6 transition hover:border-white/25 hover:bg-white/[0.06]"
              >
                <p className="text-base font-semibold">{i.name}</p>
                <p className="mt-2 line-clamp-3 text-sm leading-relaxed text-white/55">
                  {i.heroSubtitle}
                </p>
                <span className="mt-4 inline-flex items-center gap-1.5 text-sm text-white/70 group-hover:text-white">
                  Industry guide
                  <ArrowRight className="h-3.5 w-3.5" aria-hidden />
                </span>
              </Link>
            ))}
          </div>
        </Section>
      )}

      <Section title="Free QR Placement Guide">
        <div className="mx-auto max-w-2xl">
          <LeadCaptureForm sourcePath={`/resources/${article.slug}`} />
        </div>
      </Section>

      <FinalCta title="Start collecting reviews this week" />
    </PublicShell>
  );
}
