import { createFileRoute, Link, notFound } from "@tanstack/react-router";
import { ArrowRight } from "lucide-react";
import { PublicShell, PageHero, Section, FinalCta } from "@/components/public/PublicShell";
import { Button } from "@/components/ui/button";
import {
  RESOURCE_CATEGORIES,
  resourceCategory,
  resourcesInCategory,
  type ResourceArticle,
  type ResourceCategory,
} from "@/lib/resources";
import { seo, jsonLd, absoluteUrl } from "@/lib/seo";
import { usePublicPageView, usePublicTrack } from "@/hooks/use-public-track";

export const Route = createFileRoute("/resources/category/$category")({
  loader: ({ params }) => {
    const category = resourceCategory(params.category);
    if (!category) throw notFound();
    return { category, articles: resourcesInCategory(category.id as ResourceCategory) };
  },
  component: ResourceCategoryPage,
  notFoundComponent: CategoryNotFound,
  head: ({ params, loaderData }) => {
    const category = loaderData?.category;
    if (!category) {
      return {
        meta: [{ title: "Topic not found — GuestReview Pro" }, { name: "robots", content: "noindex" }],
      };
    }
    const articles = resourcesInCategory(category.id as ResourceCategory);
    return seo({
      path: `/resources/category/${params.category}`,
      title: `${category.label} guides | GuestReview Pro`,
      description: category.blurb,
      jsonLd: [
        jsonLd.breadcrumbs([
          { name: "Home", path: "/" },
          { name: "Resources", path: "/resources" },
          { name: category.label, path: `/resources/category/${category.id}` },
        ]),
        {
          "@context": "https://schema.org",
          "@type": "ItemList",
          name: `${category.label} guides`,
          itemListElement: articles.map((a, i) => ({
            "@type": "ListItem",
            position: i + 1,
            name: a.title,
            url: absoluteUrl(`/resources/${a.slug}`),
          })),
        },
      ],
    });
  },
});

function CategoryNotFound() {
  return (
    <PublicShell>
      <PageHero
        eyebrow="Resource centre"
        title="No such topic"
        subtitle="That topic does not exist. Browse every guide in the resource centre instead."
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

function ResourceCategoryPage() {
  const { category, articles } = Route.useLoaderData() as {
    category: (typeof RESOURCE_CATEGORIES)[number];
    articles: ResourceArticle[];
  };
  usePublicPageView({ page: "resource_category", category: category.id });
  const track = usePublicTrack();

  return (
    <PublicShell>
      <PageHero eyebrow="Resource centre" title={`${category.label} guides`} subtitle={category.blurb} />

      <Section title="Guides in this topic">
        <div className="grid gap-5 sm:grid-cols-2">
          {articles.map((a) => (
            <Link
              key={a.slug}
              to="/resources/$slug"
              params={{ slug: a.slug }}
              onClick={() => track("resource_cta_clicked", { cta: "category_article", article: a.slug })}
              className="group rounded-3xl border border-white/10 bg-white/[0.03] p-6 transition hover:border-white/25 hover:bg-white/[0.06]"
            >
              <p className="text-xs uppercase tracking-wide text-white/40">{a.readMinutes} min read</p>
              <p className="mt-3 text-lg font-semibold">{a.title}</p>
              <p className="mt-2 text-sm leading-relaxed text-white/55">{a.excerpt}</p>
              <span className="mt-4 inline-flex items-center gap-1.5 text-sm text-white/70 group-hover:text-white">
                Read the guide
                <ArrowRight className="h-3.5 w-3.5" aria-hidden />
              </span>
            </Link>
          ))}
        </div>
      </Section>

      <Section title="Other topics">
        <div className="flex flex-wrap gap-2">
          {RESOURCE_CATEGORIES.filter((c) => c.id !== category.id).map((c) => (
            <Link
              key={c.id}
              to="/resources/category/$category"
              params={{ category: c.id }}
              className="rounded-full border border-white/15 bg-white/5 px-4 py-2 text-sm text-white/70 transition hover:bg-white/10 hover:text-white"
            >
              {c.label}
            </Link>
          ))}
        </div>
      </Section>

      <FinalCta title="Turn the guidance into printed assets" />
    </PublicShell>
  );
}
