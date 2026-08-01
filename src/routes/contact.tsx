import { createFileRoute, Link } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";
import { PublicShell, PageHero, Section, CardGrid, InfoCard, FinalCta } from "@/components/public/PublicShell";
import { seo, jsonLd } from "@/lib/seo";

const SUPPORT_EMAIL = "support@guestreviewpro.com";

export const Route = createFileRoute("/contact")({
  component: ContactPage,
  head: () =>
    seo({
      path: "/contact",
      title: "Contact GuestReview Pro — Support and Sales",
      description:
        "Get in touch about GuestReview Pro: product support, billing questions, multi-location enquiries and partnership requests.",
      jsonLd: [jsonLd.organization(), jsonLd.breadcrumbs([{ name: "Home", path: "/" }, { name: "Contact", path: "/contact" }])],
    }),
});

function ContactPage() {
  return (
    <PublicShell>
      <PageHero
        eyebrow="Contact"
        title="Talk to us"
        subtitle="We answer product, billing and multi-location questions directly — there is no call-centre layer in between."
      />

      <Section title="How to reach us">
        <CardGrid>
          <InfoCard
            title="Product support"
            body="Questions about QR codes, print exports, validation or analytics. Include your business name and the QR code in question so we can look it up quickly."
          />
          <InfoCard
            title="Billing and subscriptions"
            body="Plan changes, invoices, regional currency and cancellations. Subscription management is also self-service from the billing page inside the app."
          />
          <InfoCard
            title="Multiple locations"
            body="Running more than ten venues, a franchise group or an agency portfolio? Tell us how many locations and how you print, and we will advise on the right setup."
          />
        </CardGrid>

        <div className="mt-8 rounded-3xl border border-white/10 bg-white/[0.03] p-8">
          <p className="text-sm text-white/60">Email us at</p>
          <a
            href={`mailto:${SUPPORT_EMAIL}`}
            className="mt-1 block text-2xl font-semibold tracking-tight underline-offset-4 hover:underline"
          >
            {SUPPORT_EMAIL}
          </a>
          <p className="mt-4 max-w-2xl text-sm leading-relaxed text-white/55">
            We aim to reply within one business day. If you already have an account, the fastest route
            for a product issue is the feedback button inside the app — it attaches the page you were on,
            which usually saves a round trip.
          </p>
          <div className="mt-6 flex flex-wrap gap-3">
            <a href={`mailto:${SUPPORT_EMAIL}`}>
              <Button className="rounded-full bg-white text-[#0a0f3d] hover:bg-white/90">Email support</Button>
            </a>
            <Link to="/auth" data-cta="signup">
              <Button variant="outline" className="rounded-full border-white/20 bg-white/5 text-white hover:bg-white/10 hover:text-white">
                Create a free account
              </Button>
            </Link>
          </div>
        </div>
      </Section>

      <Section title="Before you write in" intro="These answer most incoming questions faster than we can.">
        <CardGrid>
          <InfoCard title="Scanned code goes somewhere wrong" body="Check the destination on the QR code itself, then on the business. The QR destination always wins where both are set, and there is a test button beside each one." />
          <InfoCard title="Print looks blurry" body="Export SVG or PDF rather than PNG for anything larger than a sticker, and run validation before exporting — it flags codes below a safe printed size." />
          <InfoCard title="Wrong billing currency" body="Currency is assigned from your account region and cannot be switched manually. If the region is genuinely wrong, request a correction from the billing page and we will review it." />
        </CardGrid>
      </Section>

      <FinalCta />
    </PublicShell>
  );
}
