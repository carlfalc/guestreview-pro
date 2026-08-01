import { createFileRoute, Link } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";
import { PublicShell, PageHero, Section, CardGrid, InfoCard, Faq, FinalCta } from "@/components/public/PublicShell";
import { seo, jsonLd } from "@/lib/seo";

const FAQS = [
  { q: "How long does setup take?", a: "Most venues have a printable code within about ten minutes: add the business, paste the Google review link, design the code, export the format you need." },
  { q: "Where do I find my Google review link?", a: "Open your Google Business Profile, choose the option to ask for reviews, and copy the short review link Google gives you. Paste that into your business settings." },
  { q: "Do customers need an app?", a: "No. Any modern phone camera opens the link directly. Customers sign in to Google only if Google asks them to when posting." },
];

export const Route = createFileRoute("/how-it-works")({
  component: HowItWorksPage,
  head: () =>
    seo({
      path: "/how-it-works",
      title: "How It Works — From Google Review Link to Printed QR | GuestReview Pro",
      description:
        "A step-by-step walkthrough: add your business, paste your Google review link, design a validated QR code, print it and measure scans.",
      jsonLd: [jsonLd.faq(FAQS), jsonLd.breadcrumbs([{ name: "Home", path: "/" }, { name: "How it works", path: "/how-it-works" }])],
    }),
});

const STEPS = [
  {
    title: "Add your business",
    body: "Enter your venue name, upload a logo and paste your Google review link. The link is normalised and checked so a broken destination never reaches print.",
  },
  {
    title: "Create a QR code",
    body: "Each code is a named placement — Table 6, Reception, Checkout counter. Codes are dynamic, so the destination can change later without reprinting.",
  },
  {
    title: "Design and validate",
    body: "Pick colours, module shape and centre logo. Validation checks contrast, quiet zone, minimum print size and element collisions, and decodes the rendered artwork.",
  },
  {
    title: "Build a marketing pack",
    body: "Choose the formats you actually need — circular sticker, table tent, counter card, poster — and write or generate the request copy for each one.",
  },
  {
    title: "Export and print",
    body: "Download print-ready files at true physical dimensions with bleed and cut lines, then send them to your printer or print in-house.",
  },
  {
    title: "Place and measure",
    body: "Put each code on its surface and compare scans by placement in analytics. Reprint the winners, retire the rest.",
  },
];

function HowItWorksPage() {
  return (
    <PublicShell>
      <PageHero
        eyebrow="How it works"
        title="From Google review link to printed QR code"
        subtitle="Six steps, no design software and no reprint risk. You can complete all of them on the Free plan."
      >
        <div className="mt-8">
          <Link to="/auth" data-cta="signup">
            <Button size="lg" className="rounded-full bg-white px-8 text-[#0a0f3d] hover:bg-white/90">
              Create your free QR
            </Button>
          </Link>
        </div>
      </PageHero>

      <Section title="The workflow">
        <ol className="space-y-4">
          {STEPS.map((step, i) => (
            <li key={step.title} className="flex gap-5 rounded-3xl border border-white/10 bg-white/[0.03] p-6">
              <span className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-white/10 text-sm font-semibold">
                {i + 1}
              </span>
              <div>
                <h3 className="text-lg font-semibold tracking-tight">{step.title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-white/60">{step.body}</p>
              </div>
            </li>
          ))}
        </ol>
      </Section>

      <Section title="What happens when someone scans" intro="The customer journey is deliberately short.">
        <CardGrid>
          <InfoCard title="1. Camera opens the link" body="No app, no account and no login on our side. The scan is anonymous." />
          <InfoCard title="2. We record the scan" body="A scan count for that placement, with no personal data attached to it." />
          <InfoCard title="3. Google takes over" body="The customer lands on your Google review form and writes their review on Google." />
        </CardGrid>
        <p className="mt-4 text-sm text-white/50">
          GuestReview Pro never writes, edits, filters or removes reviews, and never screens customers
          before sending them to Google.
        </p>
      </Section>

      <Faq items={FAQS} />
      <FinalCta />
    </PublicShell>
  );
}
