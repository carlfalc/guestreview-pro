import { createFileRoute, Link } from "@tanstack/react-router";
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
import { seo, jsonLd } from "@/lib/seo";

const FAQS = [
  {
    q: "What is a Google review QR code?",
    a: "It is a QR code that opens your Google review form when scanned. The customer writes and submits the review on Google; the code simply removes the searching step.",
  },
  {
    q: "How do I make a QR code for Google reviews?",
    a: "Copy the review link from your Google Business Profile, paste it into GuestReview Pro, design the code, run validation and export a print-ready file. The Free plan covers one business and one code.",
  },
  {
    q: "Is a dynamic review QR code better than a static one?",
    a: "For printed material, usually yes. A static code hard-codes the destination, so a changed link means a reprint. A dynamic code keeps the same printed image while the destination stays editable.",
  },
  {
    q: "What size should a review QR code be printed?",
    a: "As a working rule, the code should be at least one tenth of the expected scanning distance — around 25–30 mm on a table tent, 40–50 mm on a counter sticker and considerably larger on a poster. Validation warns you when a layout falls below a safe size.",
  },
  {
    q: "Can I ask only happy customers to scan it?",
    a: "No — selectively filtering who is invited to review is review gating and breaches Google's policies. Ask every customer the same way.",
  },
  {
    q: "Does GuestReview Pro post reviews for me?",
    a: "No. It never writes, submits, filters or removes reviews. It sends customers directly to your Google review form and counts scans.",
  },
];

export const Route = createFileRoute("/google-review-qr-code")({
  component: GoogleReviewQrPage,
  head: () =>
    seo({
      path: "/google-review-qr-code",
      title: "Google Review QR Code Generator for Business | GuestReview Pro",
      description:
        "Create a Google review QR code that sends customers directly to your Google review form. Print-ready formats, size guidance and scan analytics. Free plan available.",
      jsonLd: [
        jsonLd.faq(FAQS),
        jsonLd.softwareApplication(),
        jsonLd.breadcrumbs([
          { name: "Home", path: "/" },
          { name: "Google review QR code", path: "/google-review-qr-code" },
        ]),
      ],
    }),
});

function GoogleReviewQrPage() {
  return (
    <PublicShell>
      <PageHero
        eyebrow="Google review QR codes"
        title="A Google review QR code your customers will actually scan"
        subtitle="Send customers directly to your Google review form with a branded, dynamic QR code — then print it properly and measure it honestly."
      >
        <div className="mt-8 flex flex-wrap justify-center gap-3">
          <Link to="/auth" data-cta="signup">
            <Button
              size="lg"
              className="rounded-full bg-white px-8 text-[#0a0f3d] hover:bg-white/90"
            >
              Create your free QR
            </Button>
          </Link>
          <Link to="/pricing" data-cta="pricing">
            <Button
              size="lg"
              variant="outline"
              className="rounded-full border-white/20 bg-white/5 px-8 text-white hover:bg-white/10 hover:text-white"
            >
              View pricing
            </Button>
          </Link>
        </div>
        <p className="mt-4 text-sm text-white/55">
          1 business and 1 QR code free. No card required.
        </p>
      </PageHero>

      <Section title="What the generator does">
        <CardGrid>
          <InfoCard
            title="Builds the review link correctly"
            body="Paste the review link from your Google Business Profile. It is normalised, validated and stored against your business so every code and print asset uses the same destination."
          />
          <InfoCard
            title="Generates a branded code"
            body="Colours, module shape, eye style and a centre logo — rendered at export resolution rather than upscaled from a screen preview."
          />
          <InfoCard
            title="Keeps the destination editable"
            body="The code is dynamic. Change the destination whenever you like and previously printed codes keep working."
          />
        </CardGrid>
      </Section>

      <Section title="Set it up in five steps">
        <ol className="space-y-3">
          {[
            "Open your Google Business Profile and copy your review link.",
            "Create a free GuestReview Pro account and add your business.",
            "Paste the review link and test it with the built-in destination check.",
            "Design your QR code and run print validation.",
            "Export the format you need and place it where customers finish their visit.",
          ].map((step, i) => (
            <li
              key={step}
              className="flex gap-4 rounded-2xl border border-white/10 bg-white/[0.03] p-5"
            >
              <span className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-white/10 text-sm">
                {i + 1}
              </span>
              <span className="text-sm leading-relaxed text-white/70">{step}</span>
            </li>
          ))}
        </ol>
      </Section>

      <Section
        title="Safe review links, explained"
        intro="A review QR code is only useful if the destination is trustworthy and stable."
      >
        <CardGrid cols={2}>
          <InfoCard
            title="Only supported destinations"
            body="Destinations must be valid http or https URLs. Anything using another scheme is rejected before it can be printed, so a code cannot be turned into an unsafe link."
          />
          <InfoCard
            title="No review gating"
            body="Every customer gets the same route to the same public review form. There is no pre-screening step and no way to route unhappy customers elsewhere — that practice breaches Google's policies."
          />
          <InfoCard
            title="Anonymous scans"
            body="Scanning requires no login and no app. Scans are counted for the placement without collecting personal data from the customer."
          />
          <InfoCard
            title="Independent product"
            body="GuestReview Pro is not affiliated with or endorsed by Google. It links to your public Google review form in the normal way."
          />
        </CardGrid>
      </Section>

      <Section title="Print formats and sizes">
        <div className="overflow-x-auto rounded-3xl border border-white/10">
          <table className="w-full min-w-[560px] text-left text-sm">
            <caption className="sr-only">Recommended QR code sizes by print format</caption>
            <thead className="bg-white/[0.04] text-white/70">
              <tr>
                <th scope="col" className="px-5 py-3 font-medium">
                  Format
                </th>
                <th scope="col" className="px-5 py-3 font-medium">
                  Typical size
                </th>
                <th scope="col" className="px-5 py-3 font-medium">
                  Suggested QR size
                </th>
                <th scope="col" className="px-5 py-3 font-medium">
                  Where it goes
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/10 text-white/60">
              {[
                ["Circular sticker", "50 mm diameter", "28–32 mm", "Counter, bar top, packaging"],
                ["Square sticker", "70 × 70 mm", "35–45 mm", "Window, till, fridge door"],
                [
                  "Table tent (A6 folded)",
                  "105 × 148 mm",
                  "30–40 mm",
                  "Restaurant and café tables",
                ],
                ["Counter card (A5)", "148 × 210 mm", "45–60 mm", "Reception and checkout"],
                ["Poster (A4 / A3)", "210 × 297 mm+", "80 mm+", "Lifts, corridors, waiting areas"],
              ].map((row) => (
                <tr key={row[0]}>
                  {row.map((cell) => (
                    <td key={cell} className="px-5 py-3">
                      {cell}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="mt-4 text-sm text-white/50">
          Sizes are guidance for typical scanning distances. Validation flags a layout when the code
          is too small, too low-contrast or too close to an edge.
        </p>
      </Section>

      <Section title="Measuring your review QR campaign">
        <CardGrid>
          <InfoCard
            title="Scans by placement"
            body="One code per surface makes it possible to compare a table tent against a counter sticker on the same week."
          />
          <InfoCard
            title="Trend over time"
            body="Scan volume by day shows whether a new placement genuinely lifted engagement or simply moved it."
          />
          <InfoCard
            title="What analytics cannot show"
            body="Google does not report which review came from which scan, so treat scan counts as an engagement measure, not a review count."
          />
        </CardGrid>
      </Section>

      <Section title="Pricing at a glance">
        <CardGrid>
          <InfoCard
            title="Free"
            body="1 business, 1 QR code, basic analytics and basic marketing packs. No card required."
          />
          <InfoCard
            title="Pro"
            body="Unlimited QR codes, unlimited packs, advanced analytics, AI copy and no GuestReview Pro branding."
          />
          <InfoCard
            title="Business"
            body="Up to 10 businesses with portfolio reporting, team accounts and white-label exports."
          />
        </CardGrid>
        <div className="mt-6">
          <Link to="/pricing" data-cta="pricing">
            <Button
              variant="outline"
              className="rounded-full border-white/20 bg-white/5 text-white hover:bg-white/10 hover:text-white"
            >
              See prices in your currency
            </Button>
          </Link>
        </div>
      </Section>

      <Faq items={FAQS} />
      <FinalCta title="Generate your Google review QR code" />
    </PublicShell>
  );
}
