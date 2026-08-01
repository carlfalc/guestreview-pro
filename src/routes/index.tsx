import { createFileRoute, Link } from "@tanstack/react-router";
import {
  QrCode,
  LineChart,
  MapPin,
  Sparkles,
  ArrowRight,
  Printer,
  Wand2,
  ShieldCheck,
  Check,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  PublicShell,
  Section,
  CardGrid,
  InfoCard,
  Faq,
  FinalCta,
} from "@/components/public/PublicShell";
import { seo, jsonLd } from "@/lib/seo";

const FAQS = [
  {
    q: "What does a Google review QR code do?",
    a: "It sends a customer straight to your Google review form when they scan it with a phone camera. They write the review on Google — GuestReview Pro never writes, filters or posts reviews for you.",
  },
  {
    q: "Is the free plan really free?",
    a: "Yes. The Free plan includes 1 business and 1 QR code with basic analytics and basic marketing packs. No card is required to sign up.",
  },
  {
    q: "Can I change where the QR code points after printing?",
    a: "Yes. Codes are dynamic, so you can update the destination in your dashboard and every printed code keeps working.",
  },
  {
    q: "Do you guarantee more reviews or better rankings?",
    a: "No, and be cautious of anyone who does. GuestReview Pro makes asking easy and measurable — the reviews themselves come from your customers and are handled entirely by Google.",
  },
  {
    q: "Can I print the designs myself?",
    a: "Yes. Every marketing pack exports print-ready files at real physical dimensions with bleed and quiet-zone checks, so you can send them to any printer.",
  },
];

export const Route = createFileRoute("/")({
  component: Landing,
  head: () =>
    seo({
      path: "/",
      title: "Google Review QR Codes for Hospitality & Retail | GuestReview Pro",
      description:
        "Create branded Google review QR codes and print-ready marketing packs in minutes. Free plan: 1 business, 1 QR code, no card required.",
      jsonLd: [
        jsonLd.organization(),
        jsonLd.website(),
        jsonLd.softwareApplication(),
        jsonLd.faq(FAQS),
      ],
    }),
});

function GooglePulse() {
  return (
    <div
      className="relative mx-auto flex items-center justify-center"
      style={{ width: 300, height: 300 }}
    >
      <span className="absolute inset-0 rounded-full border border-white/10" />
      <span className="absolute inset-8 rounded-full border border-white/10" />
      <span
        className="absolute inset-10 rounded-full blur-3xl opacity-70"
        style={{
          background: "conic-gradient(from 90deg, #4285F4, #34A853, #FBBC05, #EA4335, #4285F4)",
        }}
      />
      <div className="relative grid h-44 w-44 place-items-center rounded-full bg-white shadow-[0_30px_80px_-20px_rgba(66,133,244,0.6)]">
        <svg viewBox="0 0 48 48" className="h-24 w-24" role="img" aria-label="Google">
          <path
            fill="#4285F4"
            d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"
          />
          <path
            fill="#34A853"
            d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"
          />
          <path
            fill="#FBBC05"
            d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"
          />
          <path
            fill="#EA4335"
            d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"
          />
        </svg>
      </div>
    </div>
  );
}

function Landing() {
  return (
    <PublicShell>
      {/* Hero */}
      <section className="border-b border-white/5">
        <div className="mx-auto grid max-w-7xl items-center gap-12 px-6 py-16 sm:py-24 lg:grid-cols-2">
          <div>
            <p className="text-xs font-medium uppercase tracking-[0.25em] text-white/60">
              Google review QR codes · Print-ready packs · Scan analytics
            </p>
            <h1
              className="mt-5 text-4xl font-black leading-[1.05] tracking-tight sm:text-6xl"
              style={{ fontFamily: "var(--font-display)", letterSpacing: "-0.035em" }}
            >
              Create professional Google review QR campaigns in minutes.
            </h1>
            <p className="mt-5 max-w-xl text-lg leading-relaxed text-white/65">
              Design a branded QR code that sends customers directly to your Google review form,
              print it on stickers, table tents and counter cards, and see exactly where scans come
              from.
            </p>
            <div className="mt-8 flex flex-wrap items-center gap-3">
              <Link to="/auth" data-cta="signup">
                <Button
                  size="lg"
                  className="rounded-full bg-white px-8 text-[#0a0f3d] hover:bg-white/90"
                >
                  Create your free QR <ArrowRight className="ml-1 h-4 w-4" aria-hidden />
                </Button>
              </Link>
              <Link to="/how-it-works">
                <Button
                  size="lg"
                  variant="outline"
                  className="rounded-full border-white/20 bg-white/5 px-8 text-white hover:bg-white/10 hover:text-white"
                >
                  See how it works
                </Button>
              </Link>
            </div>
            <p className="mt-5 flex items-center gap-2 text-sm text-white/55">
              <ShieldCheck className="h-4 w-4 shrink-0" aria-hidden />
              Free plan: 1 business and 1 QR code. No card required.
            </p>
          </div>

          <div className="relative">
            <GooglePulse />
            <ProductPreview />
          </div>
        </div>
      </section>

      {/* How it works */}
      <Section
        title="How it works"
        intro="Three steps from an empty account to a printed code on your counter."
      >
        <CardGrid>
          <InfoCard
            icon={<MapPin className="h-5 w-5" aria-hidden />}
            title="1. Add your business"
            body="Paste your Google review link, upload a logo and pick your brand colours. We validate the link before you print anything."
          />
          <InfoCard
            icon={<QrCode className="h-5 w-5" aria-hidden />}
            title="2. Design your QR code"
            body="Choose shape, colours and centre logo. Every design is checked for contrast, quiet zone and minimum print size."
          />
          <InfoCard
            icon={<Printer className="h-5 w-5" aria-hidden />}
            title="3. Print and place it"
            body="Export stickers, table tents, counter cards and posters at true physical dimensions, ready for any printer."
          />
        </CardGrid>
      </Section>

      {/* QR design examples */}
      <Section
        title="QR design examples"
        intro="Deterministic previews generated from the same renderer used for production exports — no stock mockups."
      >
        <CardGrid cols={4}>
          {[
            { name: "Circular sticker", detail: "50 mm · vinyl · counter or window" },
            { name: "Square sticker", detail: "70 mm · laminated · packaging" },
            { name: "Table tent", detail: "A6 folded · 350 gsm card" },
            { name: "Counter card", detail: "A5 · rigid board · reception" },
          ].map((item) => (
            <div key={item.name} className="rounded-3xl border border-white/10 bg-white/[0.03] p-5">
              <div className="grid aspect-square place-items-center rounded-2xl bg-white">
                <SampleQr />
              </div>
              <p className="mt-4 text-sm font-medium">{item.name}</p>
              <p className="text-xs text-white/50">{item.detail}</p>
            </div>
          ))}
        </CardGrid>
      </Section>

      {/* Marketing pack formats */}
      <Section
        title="Marketing pack formats"
        intro="One design, every surface your customers actually touch."
      >
        <CardGrid>
          <InfoCard
            title="Stickers and decals"
            body="Circular and square stickers plus window decals, with bleed, safe area and cut-line dielines included in every export."
          />
          <InfoCard
            title="Folded table tents"
            body="True folded geometry for A5 and A6 tents — front and back panels, fold lines and correct production rotation."
          />
          <InfoCard
            title="Counter and reception cards"
            body="Rigid card layouts for checkouts, front desks and bars, sized for standard print stock."
          />
          <InfoCard
            title="Posters and lift signage"
            body="Larger-format layouts with QR sizing checked against expected scan distance."
          />
          <InfoCard
            title="Hotel room cards"
            body="Bedside and compendium cards designed for the moment a guest is most likely to leave feedback."
          />
          <InfoCard
            title="Digital assets"
            body="Web and email-signature versions of the same code, so online and printed touchpoints stay consistent."
          />
        </CardGrid>
      </Section>

      {/* Analytics */}
      <Section
        title="Analytics preview"
        intro="Know which placements actually earn scans before you reprint anything."
      >
        <div className="grid gap-4 lg:grid-cols-3">
          {[
            { label: "Scans this week", value: "184", hint: "Counter sticker leads by 3×" },
            { label: "Unique devices", value: "146", hint: "Repeat scans filtered out" },
            { label: "Top placement", value: "Table 6", hint: "Per-code attribution" },
          ].map((stat) => (
            <div
              key={stat.label}
              className="rounded-3xl border border-white/10 bg-white/[0.03] p-6"
            >
              <p className="text-xs uppercase tracking-wider text-white/50">{stat.label}</p>
              <p className="mt-2 text-4xl font-semibold tracking-tight">{stat.value}</p>
              <p className="mt-1 text-sm text-white/50">{stat.hint}</p>
            </div>
          ))}
        </div>
        <p className="mt-4 text-xs text-white/40">
          Illustrative sample data shown for demonstration. Your dashboard shows only your own
          scans.
        </p>
      </Section>

      {/* Industry use cases */}
      <Section
        title="Built for the places people leave reviews"
        intro="Placement guidance and templates tuned to how each venue actually operates."
      >
        <CardGrid cols={4}>
          {[
            {
              t: "Hotels & motels",
              b: "Reception, room compendium, bedside card, lift poster, checkout email.",
            },
            {
              t: "Restaurants & cafés",
              b: "Table tents, counter cards, bill folders, window decals, takeaway packaging.",
            },
            {
              t: "Bars & tourism",
              b: "Bar-top stickers, menu inserts, tour desks and ticket counters.",
            },
            {
              t: "Retail & services",
              b: "Checkout counters, receipts, packaging inserts, window stickers, email signatures.",
            },
          ].map((item) => (
            <InfoCard key={item.t} title={item.t} body={item.b} />
          ))}
        </CardGrid>
      </Section>

      {/* Pricing preview */}
      <Section title="Simple pricing" intro="Start free. Upgrade when one code stops being enough.">
        <CardGrid>
          {[
            {
              name: "Free",
              price: "US$0",
              tagline: "1 business, 1 QR code",
              features: ["Basic analytics", "Basic marketing packs", "No card required"],
            },
            {
              name: "Pro",
              price: "from US$19/mo",
              tagline: "For a growing venue",
              features: [
                "Unlimited QR codes",
                "Advanced analytics",
                "AI copy assistant",
                "No GuestReview Pro branding",
              ],
            },
            {
              name: "Business",
              price: "from US$49/mo",
              tagline: "For multi-location operators",
              features: [
                "Up to 10 businesses",
                "Portfolio reporting",
                "White-label exports",
                "Team accounts",
              ],
            },
          ].map((plan) => (
            <div key={plan.name} className="rounded-3xl border border-white/10 bg-white/[0.03] p-6">
              <p className="text-xs uppercase tracking-wider text-white/50">{plan.name}</p>
              <p className="mt-2 text-3xl font-semibold tracking-tight">{plan.price}</p>
              <p className="mt-1 text-sm text-white/55">{plan.tagline}</p>
              <ul className="mt-4 space-y-2 text-sm text-white/70">
                {plan.features.map((f) => (
                  <li key={f} className="flex items-start gap-2">
                    <Check className="mt-0.5 h-4 w-4 shrink-0 text-[#34A853]" aria-hidden />
                    <span>{f}</span>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </CardGrid>
        <div className="mt-8">
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

      <Section title="Why teams choose GuestReview Pro">
        <CardGrid>
          <InfoCard
            icon={<Sparkles className="h-5 w-5" aria-hidden />}
            title="AI copy assistant"
            body="Review-request wording in several tones, written to fit the exact format you are printing."
          />
          <InfoCard
            icon={<Wand2 className="h-5 w-5" aria-hidden />}
            title="Print validation"
            body="Contrast, quiet zone, bleed and decode tests run before you export — not after the print run."
          />
          <InfoCard
            icon={<LineChart className="h-5 w-5" aria-hidden />}
            title="Per-placement analytics"
            body="One code per table, room or counter, so you can compare placements honestly."
          />
        </CardGrid>
      </Section>

      <Faq items={FAQS} />
      <FinalCta />
    </PublicShell>
  );
}

/** Deterministic, data-free product preview — renders identically for everyone. */
function ProductPreview() {
  return (
    <div className="mx-auto mt-6 max-w-md rounded-3xl border border-white/10 bg-white/[0.04] p-5 shadow-[0_30px_80px_-40px_rgba(0,0,0,0.9)]">
      <div className="flex items-center gap-2 border-b border-white/10 pb-3">
        <span className="h-2.5 w-2.5 rounded-full bg-white/20" />
        <span className="h-2.5 w-2.5 rounded-full bg-white/20" />
        <span className="h-2.5 w-2.5 rounded-full bg-white/20" />
        <p className="ml-2 text-xs text-white/40">Sample campaign preview</p>
      </div>
      <div className="mt-4 flex items-center gap-4">
        <div className="grid h-24 w-24 shrink-0 place-items-center rounded-2xl bg-white">
          <SampleQr />
        </div>
        <div className="min-w-0">
          <p className="text-sm font-medium">Counter sticker · 50 mm</p>
          <p className="mt-1 text-xs leading-relaxed text-white/50">
            “Enjoyed your visit? Scan to leave us a Google review — it takes 20 seconds.”
          </p>
          <p className="mt-2 text-xs text-[#34A853]">
            Ready to print · contrast and quiet zone passed
          </p>
        </div>
      </div>
    </div>
  );
}

/** A purely decorative QR-style motif. Not a scannable code. */
function SampleQr() {
  const cells = [
    "1111111011010001111111",
    "1000001010111010000001",
    "1011101001001010111011",
    "1011101011100010111011",
    "1011101000110010111011",
    "1000001011011010000001",
    "1111111010101011111111",
    "0000000001110000000000",
    "1101101110011011011011",
    "0110010001100100110010",
    "1011011011010110110110",
    "0100100110101101001001",
    "1101101011011011011011",
    "0000000010110100000000",
    "1111111001101011011011",
    "1000001011010010010010",
    "1011101001101101101101",
    "1011101010010110010110",
    "1011101011101001101001",
    "1000001000110110110110",
    "1111111011011011011011",
  ];
  return (
    <svg
      viewBox="0 0 22 21"
      className="h-[78%] w-[78%]"
      role="img"
      aria-label="Example QR code design"
    >
      <rect width="22" height="21" fill="#ffffff" />
      {cells.map((row, y) =>
        row
          .split("")
          .map((cell, x) =>
            cell === "1" ? (
              <rect key={`${x}-${y}`} x={x} y={y} width="1" height="1" fill="#0a0f3d" />
            ) : null,
          ),
      )}
    </svg>
  );
}
