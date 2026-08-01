import { useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { PublicShell, PageHero, Section, Faq, FinalCta } from "@/components/public/PublicShell";
import { seo, jsonLd } from "@/lib/seo";
import { REGIONAL_PLAN_PRICES, PLAN_FEATURES } from "@/lib/regional-pricing";
import { formatRegionalPrice } from "@/lib/format-price";
import type { PricingRegion } from "@/lib/regions";

/** Currencies with real recurring prices. Chosen explicitly to avoid any
 *  currency flash — nothing is auto-detected on this public page. */
const DISPLAY_REGIONS: Array<{ region: PricingRegion; label: string; locale: string }> = [
  { region: "US", label: "US$", locale: "en-US" },
  { region: "GB", label: "£", locale: "en-GB" },
  { region: "EU", label: "€", locale: "de-DE" },
  { region: "AU", label: "A$", locale: "en-AU" },
  { region: "NZ", label: "NZ$", locale: "en-NZ" },
  { region: "CA", label: "CA$", locale: "en-CA" },
];

const FAQS = [
  {
    q: "Is the Free plan time-limited?",
    a: "No. Free stays free and includes 1 business and 1 QR code with basic analytics and basic marketing packs. No card is required.",
  },
  {
    q: "Which currency will I be charged in?",
    a: "Your billing currency is assigned automatically from your account region and cannot be switched manually. Where a local currency is not yet supported, the account is billed in US dollars at the international rate, and this is stated before checkout.",
  },
  {
    q: "Are taxes included?",
    a: "Tax treatment depends on your region. Applicable taxes such as VAT or GST are calculated at checkout and shown before you pay.",
  },
  {
    q: "Can I cancel at any time?",
    a: "Yes. Cancel from the billing portal and your paid features remain available until the end of the period you have already paid for.",
  },
  {
    q: "What happens to my data if I downgrade?",
    a: "Nothing is deleted. Content above the Free plan limits becomes read-only until you upgrade again or reduce it yourself.",
  },
];

export const Route = createFileRoute("/pricing")({
  component: PublicPricingPage,
  head: () =>
    seo({
      path: "/pricing",
      title: "Pricing — Free, Pro and Business Plans | GuestReview Pro",
      description:
        "Transparent regional pricing for GuestReview Pro. Start free with 1 business and 1 QR code, no card required. Pro and Business plans for growing and multi-location venues.",
      jsonLd: [
        jsonLd.softwareApplication(),
        jsonLd.faq(FAQS),
        jsonLd.breadcrumbs([
          { name: "Home", path: "/" },
          { name: "Pricing", path: "/pricing" },
        ]),
      ],
    }),
});

function PublicPricingPage() {
  const [regionIndex, setRegionIndex] = useState(0);
  const [annual, setAnnual] = useState(false);
  const active = DISPLAY_REGIONS[regionIndex];
  const prices = REGIONAL_PLAN_PRICES[active.region];

  const rows = [
    { tier: "free" as const, amount: 0, key: null },
    {
      tier: "pro" as const,
      amount: annual ? prices.pro_annual.amountMinor : prices.pro_monthly.amountMinor,
      key: annual ? prices.pro_annual : prices.pro_monthly,
    },
    {
      tier: "business" as const,
      amount: annual ? prices.business_annual.amountMinor : prices.business_monthly.amountMinor,
      key: annual ? prices.business_annual : prices.business_monthly,
    },
  ];

  return (
    <PublicShell>
      <PageHero
        eyebrow="Pricing"
        title="Start free. Pay only when one code isn't enough."
        subtitle="Prices below are shown for reference currencies. Your account is billed in the currency assigned to your region, confirmed before checkout."
      />

      <Section>
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div
            className="inline-flex flex-wrap gap-1 rounded-full border border-white/15 p-1"
            role="group"
            aria-label="Display currency"
          >
            {DISPLAY_REGIONS.map((r, i) => (
              <button
                key={r.region}
                type="button"
                aria-pressed={i === regionIndex}
                onClick={() => setRegionIndex(i)}
                className={`rounded-full px-3 py-1.5 text-sm transition ${i === regionIndex ? "bg-white text-[#0a0f3d]" : "text-white/60 hover:text-white"}`}
              >
                {r.label}
              </button>
            ))}
          </div>
          <div
            className="inline-flex rounded-full border border-white/15 p-1"
            role="group"
            aria-label="Billing interval"
          >
            {[false, true].map((value) => (
              <button
                key={String(value)}
                type="button"
                aria-pressed={annual === value}
                onClick={() => setAnnual(value)}
                className={`rounded-full px-4 py-1.5 text-sm transition ${annual === value ? "bg-white text-[#0a0f3d]" : "text-white/60 hover:text-white"}`}
              >
                {value ? "Annual" : "Monthly"}
              </button>
            ))}
          </div>
        </div>

        <div className="mt-8 grid gap-4 lg:grid-cols-3">
          {rows.map((row) => {
            const feature = PLAN_FEATURES.find((p) => p.key === row.tier)!;
            const currency = row.key?.currency ?? prices.pro_monthly.currency;
            const label =
              row.amount === 0
                ? formatRegionalPrice(0, currency, active.locale)
                : formatRegionalPrice(row.amount, currency, active.locale);
            return (
              <div
                key={row.tier}
                className={`rounded-3xl border p-6 ${row.tier === "pro" ? "border-white/30 bg-white/[0.06]" : "border-white/10 bg-white/[0.03]"}`}
              >
                <p className="text-xs uppercase tracking-wider text-white/50">{feature.name}</p>
                <p className="mt-1 text-sm text-white/55">{feature.tagline}</p>
                <p className="mt-4 text-4xl font-semibold tracking-tight">{label}</p>
                <p className="mt-1 text-xs text-white/50">
                  {row.tier === "free"
                    ? "Free forever"
                    : annual
                      ? "per year, billed annually"
                      : "per month, billed monthly"}
                </p>
                <Link to="/auth" data-cta="signup" className="mt-5 block">
                  <Button
                    className={`w-full rounded-full ${row.tier === "pro" ? "bg-white text-[#0a0f3d] hover:bg-white/90" : "bg-white/10 text-white hover:bg-white/20"}`}
                  >
                    {row.tier === "free"
                      ? "Create your free QR"
                      : `Start free, upgrade to ${feature.name}`}
                  </Button>
                </Link>
                <ul className="mt-5 space-y-2 text-sm text-white/70">
                  {feature.features.map((f) => (
                    <li key={f} className="flex items-start gap-2">
                      <Check className="mt-0.5 h-4 w-4 shrink-0 text-[#34A853]" aria-hidden />
                      <span>{f}</span>
                    </li>
                  ))}
                </ul>
              </div>
            );
          })}
        </div>

        <p className="mt-6 max-w-3xl text-xs leading-relaxed text-white/45">
          Reference prices only. Your billing currency and price are assigned from your account
          region and confirmed on the checkout screen before payment. Applicable taxes are
          calculated at checkout. Subscriptions renew automatically until cancelled; cancelling
          stops future renewals and paid features remain available until the end of the current
          period.
        </p>
      </Section>

      <Faq items={FAQS} />
      <FinalCta
        title="Try it free before you pay anything"
        body="1 business and 1 QR code on the Free plan. No card required."
      />
    </PublicShell>
  );
}
