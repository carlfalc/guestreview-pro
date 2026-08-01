import { createFileRoute } from "@tanstack/react-router";
import { PublicShell, PageHero, Section } from "@/components/public/PublicShell";
import { seo, jsonLd } from "@/lib/seo";

export const Route = createFileRoute("/privacy")({
  component: PrivacyPage,
  head: () =>
    seo({
      path: "/privacy",
      title: "Privacy Policy — GuestReview Pro",
      description:
        "How GuestReview Pro collects, uses and protects data: account information, QR scan events, payment handling, retention and your rights.",
      jsonLd: [
        jsonLd.breadcrumbs([
          { name: "Home", path: "/" },
          { name: "Privacy", path: "/privacy" },
        ]),
      ],
    }),
});

const SECTIONS: Array<{ h: string; p: string[] }> = [
  {
    h: "Who this policy covers",
    p: [
      "This policy applies to people who create a GuestReview Pro account and to visitors of this website. It is maintained by the operator of GuestReview Pro to explain, in plain terms, what data the product handles.",
      "It is a description of current practice, not a certification or an independent audit.",
    ],
  },
  {
    h: "Account information",
    p: [
      "When you create an account we store your email address and, if you sign in with Google, the basic profile information Google returns for sign-in. We use it to authenticate you, to secure the account and to contact you about the service.",
      "Content you create — business details, review destinations, QR codes, designs, marketing packs and exports — is stored against your account and is only accessible to you and to accounts you explicitly share a workspace with.",
    ],
  },
  {
    h: "QR scan data",
    p: [
      "When someone scans one of your QR codes we record that a scan happened for that code, with a timestamp and coarse technical information used to count and de-duplicate scans.",
      "Scanning does not require the customer to sign in or install anything, and we do not ask the customer for personal details. We do not build advertising profiles from scans and we do not sell scan data.",
      "After the scan is recorded, the customer is redirected to the destination you configured — normally your Google review form. What happens on that destination is governed by that provider's own privacy policy, not this one.",
    ],
  },
  {
    h: "Reviews",
    p: [
      "GuestReview Pro does not write, submit, edit, filter, hide or remove reviews, and it does not screen customers before sending them to a review form. Reviews are created by customers on the destination platform.",
    ],
  },
  {
    h: "Payments",
    p: [
      "Subscriptions are processed by Stripe. Card details are entered directly with Stripe and are never received or stored by GuestReview Pro. We store the subscription state we need to run the service — plan, interval, status, renewal date and a Stripe customer reference.",
      "Stripe processes payment data as an independent controller for its own compliance purposes; see Stripe's privacy policy for details.",
    ],
  },
  {
    h: "Product analytics",
    p: [
      "We record product events such as which pages an account visited and which features were used, so we can find broken flows and improve the product. These events are tied to your account or to a short-lived, anonymous session identifier that is cleared when the browser tab closes.",
    ],
  },
  {
    h: "Hosting and subprocessors",
    p: [
      "The application is built and hosted on Lovable, with the database, authentication and file storage provided by the platform's managed cloud backend. Payments are handled by Stripe. Where AI copy suggestions are used, the prompt text is sent to the model provider through the platform's AI gateway.",
      "These providers process data on our behalf so the service can operate. We do not sell personal data to anyone.",
    ],
  },
  {
    h: "Retention",
    p: [
      "Account content is retained while your account is open. Deleting a business, QR code or marketing pack removes it from the application. When you close your account we delete or anonymise account data, keeping only what we must retain for legal, tax and accounting purposes.",
    ],
  },
  {
    h: "Security",
    p: [
      "Access to your data is enforced at the database level so one account cannot read another account's records. Files used for print previews are stored in a private bucket and served through short-lived signed links. Traffic is encrypted in transit.",
      "No service can promise that a breach is impossible. If a breach affecting your data occurs, we will notify affected accounts and any regulator we are required to inform.",
    ],
  },
  {
    h: "Your rights",
    p: [
      "Depending on where you live, you may have the right to access, correct, export or delete your personal data, and to object to or restrict certain processing. You can exercise these rights by emailing support@guestreviewpro.com from the address on your account.",
    ],
  },
  {
    h: "Cookies",
    p: [
      "We use cookies and equivalent browser storage that are necessary to keep you signed in and to remember interface preferences. Analytics described above uses a session identifier rather than advertising cookies, and we do not run third-party advertising trackers on this site.",
    ],
  },
  {
    h: "Changes and contact",
    p: [
      "If this policy changes materially we will update this page and, where the change affects you, notify account holders. Questions about privacy can be sent to support@guestreviewpro.com.",
    ],
  },
];

function PrivacyPage() {
  return (
    <PublicShell>
      <PageHero
        eyebrow="Legal"
        title="Privacy Policy"
        subtitle="What we collect, why we collect it and what we never do with it."
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
