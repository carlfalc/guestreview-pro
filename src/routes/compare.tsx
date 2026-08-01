import { createFileRoute } from "@tanstack/react-router";
import { PublicShell, PageHero, Section, Faq, FinalCta } from "@/components/public/PublicShell";
import { seo, jsonLd } from "@/lib/seo";

const FAQS = [
  {
    q: "Do I need a paid platform at all?",
    a: "Not always. If you need one code, never expect the destination to change and do not care about measurement, a free static generator is enough. The cost appears later, when a reprint is the only way to fix a link.",
  },
  {
    q: "How is this different from a review-management platform?",
    a: "Review-management platforms focus on monitoring, responding to and reporting on reviews across sites. GuestReview Pro focuses on the ask: getting a well-designed, correctly printed, measurable review request in front of the customer.",
  },
  {
    q: "Can I use both?",
    a: "Yes. They solve different halves of the problem and neither depends on the other.",
  },
];

export const Route = createFileRoute("/compare")({
  component: ComparePage,
  head: () =>
    seo({
      path: "/compare",
      title:
        "Compare Review QR Approaches — Static, Dynamic and Review Platforms | GuestReview Pro",
      description:
        "A neutral comparison of four ways to run review requests: free static QR generators, dynamic QR platforms, review-management software and GuestReview Pro.",
      jsonLd: [
        jsonLd.faq(FAQS),
        jsonLd.breadcrumbs([
          { name: "Home", path: "/" },
          { name: "Compare", path: "/compare" },
        ]),
      ],
    }),
});

const COLUMNS = [
  "Free static QR generator",
  "Dynamic QR platform",
  "Review-management platform",
  "GuestReview Pro",
];

const ROWS: Array<{ capability: string; values: string[] }> = [
  { capability: "Editable destination after printing", values: ["No", "Yes", "Varies", "Yes"] },
  { capability: "Scan analytics", values: ["No", "Yes", "Varies", "Yes, per placement"] },
  { capability: "Print-ready marketing packs", values: ["No", "Rarely", "Rarely", "Yes"] },
  {
    capability: "Multi-format exports (PNG, SVG, PDF, dielines)",
    values: ["Image only", "Varies", "Varies", "Yes"],
  },
  {
    capability: "Pre-export print validation and decode test",
    values: ["No", "Varies", "No", "Yes"],
  },
  { capability: "Folded table-tent geometry", values: ["No", "No", "No", "Yes"] },
  { capability: "Hospitality-specific templates", values: ["No", "Varies", "Varies", "Yes"] },
  {
    capability: "Regional currency pricing",
    values: ["Not applicable", "Varies", "Varies", "Yes"],
  },
  { capability: "Review monitoring and replies", values: ["No", "No", "Yes", "No"] },
  { capability: "Free tier", values: ["Yes", "Varies", "Rarely", "Yes — 1 business, 1 QR"] },
];

function ComparePage() {
  return (
    <PublicShell>
      <PageHero
        eyebrow="Compare"
        title="Four ways to run review requests"
        subtitle="We compare approaches rather than making claims about individual competitors' current pricing or features, which change constantly."
      />

      <Section title="Capability comparison">
        <div className="overflow-x-auto rounded-3xl border border-white/10">
          <table className="w-full min-w-[860px] text-left text-sm">
            <caption className="sr-only">Comparison of review QR approaches by capability</caption>
            <thead className="bg-white/[0.04] text-white/70">
              <tr>
                <th scope="col" className="px-5 py-3 font-medium">
                  Capability
                </th>
                {COLUMNS.map((c) => (
                  <th key={c} scope="col" className="px-5 py-3 font-medium">
                    {c}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-white/10 text-white/60">
              {ROWS.map((row) => (
                <tr key={row.capability}>
                  <th scope="row" className="px-5 py-3 font-normal text-white/80">
                    {row.capability}
                  </th>
                  {row.values.map((v, i) => (
                    <td
                      key={`${row.capability}-${i}`}
                      className={`px-5 py-3 ${i === 3 ? "text-white" : ""}`}
                    >
                      {v}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="mt-4 max-w-3xl text-xs text-white/45">
          "Varies" means the capability differs meaningfully between products in that category. We
          do not publish other companies' prices or feature lists here because we cannot keep them
          accurate.
        </p>
      </Section>

      <Section title="When each approach makes sense">
        <div className="space-y-4">
          {[
            {
              t: "Free static QR generator",
              b: "Best for a one-off code where the destination will never change and no measurement is needed. The risk is reprint cost: the destination is baked into the image, and you cannot tell whether anyone scanned it.",
            },
            {
              t: "Dynamic QR platform",
              b: "Good when you need editable destinations and basic scan counts across many codes. Print production is usually left to you — sizing, bleed, dielines and folded geometry are your problem.",
            },
            {
              t: "Review-management platform",
              b: "Right when the priority is monitoring reviews across multiple sites, replying at scale and reporting on sentiment. Generating well-printed physical review requests is rarely the focus.",
            },
            {
              t: "GuestReview Pro",
              b: "Built for venues that print things: dynamic codes, validated print production for stickers, tents, cards and posters, per-placement analytics and hospitality templates. It does not monitor or reply to reviews.",
            },
          ].map((item) => (
            <div key={item.t} className="rounded-3xl border border-white/10 bg-white/[0.03] p-6">
              <h3 className="text-lg font-semibold tracking-tight">{item.t}</h3>
              <p className="mt-2 text-sm leading-relaxed text-white/60">{item.b}</p>
            </div>
          ))}
        </div>
      </Section>

      <Faq items={FAQS} />
      <FinalCta />
    </PublicShell>
  );
}
