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
    q: "Can I edit a QR code after it has been printed?",
    a: "Yes. Every code is dynamic: the printed image stays the same and you change the destination in your dashboard whenever you need to.",
  },
  {
    q: "What file formats can I export?",
    a: "Print-ready PNG, SVG and PDF at true physical dimensions, plus dielines and cut lines for stickers and folded formats.",
  },
  {
    q: "Does validation guarantee my print will scan?",
    a: "Validation catches the common causes of unscannable prints — poor contrast, missing quiet zone, undersized codes and overlapping elements — and decodes the rendered artwork before export. Final results still depend on your printer and material.",
  },
];

export const Route = createFileRoute("/features")({
  component: FeaturesPage,
  head: () =>
    seo({
      path: "/features",
      title: "Features — QR Design, Print Packs and Scan Analytics | GuestReview Pro",
      description:
        "Branded dynamic QR codes, print-ready marketing packs with validation, AI review-request copy and per-placement scan analytics.",
      jsonLd: [
        jsonLd.faq(FAQS),
        jsonLd.breadcrumbs([
          { name: "Home", path: "/" },
          { name: "Features", path: "/features" },
        ]),
      ],
    }),
});

function FeaturesPage() {
  return (
    <PublicShell>
      <PageHero
        eyebrow="Features"
        title="Everything you need to run a review campaign"
        subtitle="Design, validation, printing and measurement in one place — built for venues that print things and want to know what worked."
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
          Free plan: 1 business and 1 QR code. No card required.
        </p>
      </PageHero>

      <Section title="Dynamic QR codes" intro="A printed code should never become dead stock.">
        <CardGrid>
          <InfoCard
            title="Editable destinations"
            body="Change where a code points at any time — a new Google review link, a seasonal menu or a booking page — without reprinting."
          />
          <InfoCard
            title="Safe destination handling"
            body="Destinations are normalised and validated. Unsupported or unsafe links are refused rather than silently printed."
          />
          <InfoCard
            title="One code per placement"
            body="Create separate codes for each table, room, counter or window so attribution is genuinely per-placement."
          />
        </CardGrid>
      </Section>

      <Section
        title="Brand-accurate design"
        intro="Your code should look like it belongs to your venue."
      >
        <CardGrid>
          <InfoCard
            title="Colours, shapes and logo"
            body="Module shapes, eye styles, brand colours and a centre logo, all rendered with the same engine used for exports."
          />
          <InfoCard
            title="Per-format customisation"
            body="Each print format keeps its own copy, layout and QR size, so a 50 mm sticker isn't just a shrunken poster."
          />
          <InfoCard
            title="Deterministic previews"
            body="What you see in the editor is the artwork that exports — no surprise re-rendering at download time."
          />
        </CardGrid>
      </Section>

      <Section title="Print production" intro="Files a real printer will accept.">
        <CardGrid>
          <InfoCard
            title="True physical dimensions"
            body="Formats are defined in millimetres with bleed and safe areas, not in arbitrary pixels."
          />
          <InfoCard
            title="Circular and folded dielines"
            body="Cut lines for circular stickers and fold geometry for A5 and A6 table tents, exported alongside the artwork."
          />
          <InfoCard
            title="Validation before export"
            body="Contrast ratio, quiet zone, minimum module size, element collisions and a real decode test on the rendered faces."
          />
          <InfoCard
            title="Fix automatically"
            body="Suggested corrections with a preview, a plain-English change summary and one-step undo."
          />
          <InfoCard
            title="Duplicate anywhere"
            body="Copy a finished design to another QR code or another business, with background images and per-code data handled safely."
          />
          <InfoCard
            title="AI copy assistant"
            body="Review-request wording in several tones and lengths, constrained to the space each format actually has."
          />
        </CardGrid>
      </Section>

      <Section title="Measurement" intro="Reprint what works; retire what doesn't.">
        <CardGrid>
          <InfoCard
            title="Scan analytics"
            body="Scans over time, unique devices and per-code comparison so you can see which placement earns attention."
          />
          <InfoCard
            title="Placement comparison"
            body="Because each surface can carry its own code, counter versus table versus receipt is a fair test."
          />
          <InfoCard
            title="Fast, anonymous redirects"
            body="Scans resolve quickly and require no login from your customer — the code goes straight to the destination."
          />
        </CardGrid>
      </Section>

      <Faq items={FAQS} />
      <FinalCta />
    </PublicShell>
  );
}
