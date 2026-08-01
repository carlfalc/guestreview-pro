import { createFileRoute } from "@tanstack/react-router";
import { PublicShell, PageHero, Section } from "@/components/public/PublicShell";
import { seo, jsonLd } from "@/lib/seo";

export const Route = createFileRoute("/terms")({
  component: TermsPage,
  head: () =>
    seo({
      path: "/terms",
      title: "Terms of Service — GuestReview Pro",
      description:
        "The terms that govern use of GuestReview Pro: accounts, acceptable use, review platform policies, subscriptions, cancellation, printing and liability.",
      jsonLd: [
        jsonLd.breadcrumbs([
          { name: "Home", path: "/" },
          { name: "Terms", path: "/terms" },
        ]),
      ],
    }),
});

const SECTIONS: Array<{ h: string; p: string[] }> = [
  {
    h: "Agreement",
    p: [
      "These terms govern your use of GuestReview Pro. By creating an account or using the service you agree to them. If you are using the service for an organisation, you confirm you are authorised to accept these terms on its behalf.",
    ],
  },
  {
    h: "The service",
    p: [
      "GuestReview Pro lets you create dynamic QR codes, design and validate print-ready marketing material, and view scan analytics for your own venues.",
      "The service links customers to review destinations you configure. It does not write, submit, filter, hide or remove reviews, and it does not guarantee any number of scans, reviews or any change in your rating.",
    ],
  },
  {
    h: "Your account",
    p: [
      "You are responsible for keeping your login credentials secure and for activity that happens under your account. Tell us promptly if you believe your account has been accessed without your permission.",
      "You must provide accurate information and must not share an account in a way that circumvents plan limits.",
    ],
  },
  {
    h: "Acceptable use and review platform policies",
    p: [
      "You must not use the service to incentivise, buy, fabricate or otherwise manipulate reviews, and you must not use it to selectively route customers based on how satisfied they appear — a practice commonly called review gating. These practices breach the policies of Google and other review platforms.",
      "You are responsible for complying with the terms of any review platform you link to, and with advertising, consumer-protection and privacy law in your market.",
      "You must not point a QR code at unlawful, deceptive, malicious or adult content, and must not use the service to distribute malware or to harass anyone.",
    ],
  },
  {
    h: "Your content",
    p: [
      "You keep ownership of your business details, logos, artwork and copy. You grant us the limited licence needed to store, process, render and export that content so the service can work.",
      "You confirm you have the rights to any logo, image or trademark you upload.",
    ],
  },
  {
    h: "Plans, billing and renewal",
    p: [
      "The Free plan is available at no cost with the limits published on the pricing page. Paid plans are billed in advance for the interval you choose and renew automatically until cancelled.",
      "Your billing currency and price are assigned from your account region and cannot be switched manually. Applicable taxes are calculated at checkout. Payments are processed by Stripe and are subject to Stripe's terms.",
      "We may change prices for future billing periods. Where a change affects your renewal, we will give you notice before it takes effect.",
    ],
  },
  {
    h: "Cancellation and refunds",
    p: [
      "You can cancel at any time from the billing page. Cancellation stops future renewals; paid features remain available until the end of the period you have already paid for, and we do not provide pro-rata refunds for partial periods unless required by law.",
      "Downgrading does not delete your content. Content above the Free plan limits becomes read-only until you upgrade again or reduce it yourself.",
    ],
  },
  {
    h: "Printing and exports",
    p: [
      "Export files are produced at the dimensions and settings shown in the app, and validation checks contrast, size, quiet zone, element placement and decodability before export.",
      "Final print quality depends on your printer, material and finishing. We strongly recommend scanning a physical proof before ordering a full print run; we are not responsible for print costs arising from files sent to print without proofing.",
    ],
  },
  {
    h: "Availability and changes",
    p: [
      "We aim to keep the service and QR redirects available continuously, but we do not guarantee uninterrupted operation and may carry out maintenance. We may add, change or withdraw features; where a change materially reduces a paid feature, we will give notice.",
    ],
  },
  {
    h: "Suspension and termination",
    p: [
      "We may suspend or terminate an account that breaches these terms, particularly the acceptable-use section, or that creates a security or legal risk. You may stop using the service and close your account at any time.",
    ],
  },
  {
    h: "Disclaimers and liability",
    p: [
      "Except where the law says otherwise, the service is provided as is, without warranties of any kind. Nothing in these terms limits liability that cannot lawfully be limited, including for fraud, death or personal injury caused by negligence, or your rights under consumer law.",
      "Subject to that, our total liability arising from the service is limited to the amount you paid us in the twelve months before the event giving rise to the claim, and we are not liable for indirect or consequential loss, lost profits or lost business.",
    ],
  },
  {
    h: "Changes to these terms",
    p: [
      "We may update these terms. Material changes will be posted on this page and, where they affect you, notified to account holders. Continuing to use the service after a change takes effect means you accept the updated terms.",
    ],
  },
  {
    h: "Contact",
    p: ["Questions about these terms can be sent to support@guestreviewpro.com."],
  },
];

function TermsPage() {
  return (
    <PublicShell>
      <PageHero
        eyebrow="Legal"
        title="Terms of Service"
        subtitle="The rules for using GuestReview Pro, written to be read rather than skipped."
      />
      <Section>
        <div className="max-w-3xl space-y-8">
          {SECTIONS.map((s) => (
            <section key={s.h}>
              <h2 className="text-xl font-semibold tracking-tight">{s.h}</h2>
              {s.p.map((para) => (
                <p key={para.slice(0, 40)} className="mt-3 text-sm leading-relaxed text-white/60">
                  {para}
                </p>
              ))}
            </section>
          ))}
          <p className="text-xs text-white/40">
            GuestReview Pro is an independent product and is not affiliated with, endorsed by or
            sponsored by Google. Google and Google Business Profile are trademarks of Google LLC.
          </p>
        </div>
      </Section>
    </PublicShell>
  );
}
