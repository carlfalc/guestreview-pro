import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { currentUserIsAdmin } from "@/lib/authorised-plan.functions";
import { adminSeoAudit } from "@/lib/seo-audit.functions";
import { SITE_URL } from "@/lib/seo";

export const Route = createFileRoute("/_authenticated/admin/seo")({
  component: AdminSeoPage,
  head: () => ({
    meta: [
      { title: "Admin · SEO health" },
      {
        name: "description",
        content: "Internal SEO health check for every public GuestReview Pro route.",
      },
      { name: "robots", content: "noindex, nofollow" },
    ],
  }),
});

function AdminSeoPage() {
  const isAdminFn = useServerFn(currentUserIsAdmin);
  const isAdminQ = useQuery({ queryKey: ["is-admin"], queryFn: () => isAdminFn() });

  const auditFn = useServerFn(adminSeoAudit);
  const auditQ = useQuery({
    queryKey: ["admin", "seo-audit"],
    queryFn: () => auditFn(),
    enabled: isAdminQ.data === true,
    staleTime: 5 * 60 * 1000,
  });

  if (isAdminQ.isLoading) {
    return <div className="p-8 text-sm text-muted-foreground">Loading…</div>;
  }
  if (isAdminQ.data !== true) {
    return (
      <Card className="rounded-3xl border-border/70">
        <CardContent className="p-8 text-center text-sm">
          You don’t have permission to view this page.
        </CardContent>
      </Card>
    );
  }

  const routes = auditQ.data?.routes ?? [];
  const support = auditQ.data?.support;
  const failing = routes.filter((r) => r.issues.length > 0);

  return (
    <div className="animate-fade-in-up space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-3xl font-semibold tracking-tight">SEO health</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Every public route is fetched from this deployment and its rendered head inspected.
            Canonical URLs must all sit on {SITE_URL}.
          </p>
        </div>
        <Button
          variant="outline"
          className="rounded-full"
          onClick={() => auditQ.refetch()}
          disabled={auditQ.isFetching}
        >
          {auditQ.isFetching ? "Scanning…" : "Re-run scan"}
        </Button>
      </div>

      {auditQ.isLoading && (
        <Card className="rounded-3xl border-border/70">
          <CardContent className="p-8 text-center text-sm text-muted-foreground">
            Crawling public routes…
          </CardContent>
        </Card>
      )}

      {auditQ.error && (
        <Card className="rounded-3xl border-destructive/40">
          <CardContent className="p-6 text-sm text-destructive">
            {auditQ.error instanceof Error ? auditQ.error.message : "Scan failed."}
          </CardContent>
        </Card>
      )}

      {auditQ.data && (
        <>
          <div className="grid gap-4 sm:grid-cols-3">
            <Stat label="Public routes" value={String(routes.length)} />
            <Stat label="Routes with issues" value={String(failing.length)} />
            <Stat label="Sitemap URLs" value={String(support?.sitemapUrlCount ?? 0)} />
          </div>

          <Card className="rounded-3xl border-border/70">
            <CardContent className="space-y-2 p-6 text-sm">
              <p className="font-medium">Crawler files</p>
              <CheckLine ok={Boolean(support?.robotsTxtOk)} label="/robots.txt responds" />
              <CheckLine
                ok={Boolean(support?.robotsTxtMentionsSitemap)}
                label="robots.txt references the sitemap"
              />
              <CheckLine ok={Boolean(support?.sitemapOk)} label="/sitemap.xml responds" />
              <CheckLine
                ok={(support?.sitemapMissingPaths.length ?? 0) === 0}
                label={
                  support && support.sitemapMissingPaths.length > 0
                    ? `Missing from sitemap: ${support.sitemapMissingPaths.join(", ")}`
                    : "Every public route is in the sitemap"
                }
              />
            </CardContent>
          </Card>

          <Card className="rounded-3xl border-border/70">
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm">
                  <thead className="border-b border-border/60 text-xs uppercase text-muted-foreground">
                    <tr>
                      <th className="px-5 py-3">Route</th>
                      <th className="px-5 py-3">Title</th>
                      <th className="px-5 py-3">Desc</th>
                      <th className="px-5 py-3">H1</th>
                      <th className="px-5 py-3">JSON-LD</th>
                      <th className="px-5 py-3">Issues</th>
                    </tr>
                  </thead>
                  <tbody>
                    {routes.map((r) => (
                      <tr key={r.path} className="border-b border-border/40 align-top">
                        <td className="px-5 py-3 font-mono text-xs">{r.path}</td>
                        <td className="px-5 py-3">{r.titleLength || "—"}</td>
                        <td className="px-5 py-3">{r.descriptionLength || "—"}</td>
                        <td className="px-5 py-3">{r.h1Count}</td>
                        <td className="px-5 py-3">{r.jsonLdBlocks}</td>
                        <td className="px-5 py-3">
                          {r.issues.length === 0 ? (
                            <span className="text-emerald-500">OK</span>
                          ) : (
                            <span className="text-amber-500">{r.issues.join("; ")}</span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        </>
      )}

      <Card className="rounded-3xl border-border/70">
        <CardContent className="space-y-3 p-6 text-sm">
          <p className="font-medium">Google Search Console checklist</p>
          <ol className="list-decimal space-y-1.5 pl-5 text-muted-foreground">
            <li>Property is verified via the HTML file served at /google726063f1ecc9f8a3.html.</li>
            <li>
              Submit {SITE_URL}/sitemap.xml under Sitemaps and confirm it is read without errors.
            </li>
            <li>
              Use URL Inspection on the newest resource articles and request indexing after each
              publish.
            </li>
            <li>Check Page indexing weekly for “Discovered – currently not indexed” entries.</li>
            <li>
              Confirm the preview and *.lovable.app hosts never appear as canonical URLs above.
            </li>
          </ol>
        </CardContent>
      </Card>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <Card className="rounded-3xl border-border/70">
      <CardContent className="p-6">
        <p className="text-xs uppercase tracking-wide text-muted-foreground">{label}</p>
        <p className="mt-2 text-3xl font-semibold">{value}</p>
      </CardContent>
    </Card>
  );
}

function CheckLine({ ok, label }: { ok: boolean; label: string }) {
  return (
    <p className={ok ? "text-emerald-500" : "text-amber-500"}>
      {ok ? "✓" : "!"} <span className="text-foreground">{label}</span>
    </p>
  );
}
