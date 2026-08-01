import { useState, type ReactNode } from "react";
import { Link } from "@tanstack/react-router";
import { QrCode, Menu, X, ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";

const NAV = [
  { to: "/features", label: "Features" },
  { to: "/industries", label: "Industries" },
  { to: "/templates", label: "Templates" },
  { to: "/examples", label: "Examples" },
  { to: "/google-review-qr-code", label: "Google review QR" },
  { to: "/resources", label: "Resources" },
  { to: "/pricing", label: "Pricing" },
] as const;


/**
 * Public marketing chrome. Deliberately independent of the authenticated
 * application layout — it loads no account data and no dashboard queries.
 */
export function PublicShell({ children }: { children: ReactNode }) {
  const [open, setOpen] = useState(false);

  return (
    <div
      className="min-h-screen text-white"
      style={{ background: "radial-gradient(ellipse at top, #12194d 0%, #060826 55%, #030417 100%)" }}
    >
      <a
        href="#main"
        className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-50 focus:rounded-full focus:bg-white focus:px-4 focus:py-2 focus:text-[#0a0f3d]"
      >
        Skip to content
      </a>

      <header className="sticky top-0 z-40 border-b border-white/5 bg-[#060826]/80 backdrop-blur">
        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-6">
          <Link to="/" className="flex items-center gap-2.5" aria-label="GuestReview Pro home">
            <span className="grid h-8 w-8 place-items-center rounded-lg bg-white/10">
              <QrCode className="h-4 w-4" aria-hidden />
            </span>
            <span className="text-[15px] font-semibold tracking-tight">GuestReview Pro</span>
          </Link>

          <nav aria-label="Main" className="hidden items-center gap-1 lg:flex">
            {NAV.map((item) => (
              <Link
                key={item.to}
                to={item.to}
                className="rounded-full px-3 py-2 text-sm text-white/70 transition hover:bg-white/10 hover:text-white"
                activeProps={{ className: "rounded-full px-3 py-2 text-sm text-white bg-white/10" }}
              >
                {item.label}
              </Link>
            ))}
          </nav>

          <div className="hidden items-center gap-2 lg:flex">
            <Link to="/auth">
              <Button variant="ghost" size="sm" className="rounded-full text-white hover:bg-white/10 hover:text-white">
                Sign in
              </Button>
            </Link>
            <Link to="/auth" data-cta="signup">
              <Button size="sm" className="rounded-full bg-white text-[#0a0f3d] hover:bg-white/90">
                Create your free QR
              </Button>
            </Link>
          </div>

          <button
            type="button"
            onClick={() => setOpen((v) => !v)}
            aria-expanded={open}
            aria-controls="mobile-nav"
            aria-label={open ? "Close menu" : "Open menu"}
            className="grid h-10 w-10 place-items-center rounded-full border border-white/15 lg:hidden"
          >
            {open ? <X className="h-4 w-4" aria-hidden /> : <Menu className="h-4 w-4" aria-hidden />}
          </button>
        </div>

        {open && (
          <nav id="mobile-nav" aria-label="Mobile" className="border-t border-white/5 px-6 py-4 lg:hidden">
            <ul className="space-y-1">
              {NAV.map((item) => (
                <li key={item.to}>
                  <Link
                    to={item.to}
                    onClick={() => setOpen(false)}
                    className="block rounded-xl px-3 py-2.5 text-sm text-white/80 hover:bg-white/10 hover:text-white"
                  >
                    {item.label}
                  </Link>
                </li>
              ))}
            </ul>
            <div className="mt-4 flex flex-col gap-2">
              <Link to="/auth" onClick={() => setOpen(false)}>
                <Button className="w-full rounded-full bg-white text-[#0a0f3d] hover:bg-white/90">
                  Create your free QR
                </Button>
              </Link>
              <Link to="/auth" onClick={() => setOpen(false)}>
                <Button variant="outline" className="w-full rounded-full border-white/20 bg-white/5 text-white hover:bg-white/10 hover:text-white">
                  Sign in
                </Button>
              </Link>
            </div>
          </nav>
        )}
      </header>

      <main id="main">{children}</main>

      <PublicFooter />
    </div>
  );
}

function PublicFooter() {
  return (
    <footer className="border-t border-white/5 bg-[#03041a]">
      <div className="mx-auto grid max-w-7xl gap-10 px-6 py-14 sm:grid-cols-2 lg:grid-cols-4">
        <div>
          <p className="text-sm font-semibold">GuestReview Pro</p>
          <p className="mt-3 text-sm leading-relaxed text-white/50">
            Branded Google review QR codes and print-ready marketing packs for hospitality, retail and
            local service businesses.
          </p>
        </div>
        <FooterColumn
          title="Product"
          links={[
            { to: "/features", label: "Features" },
            { to: "/how-it-works", label: "How it works" },
            { to: "/google-review-qr-code", label: "Google review QR codes" },
            { to: "/templates", label: "Template gallery" },
            { to: "/examples", label: "QR examples" },
            { to: "/pricing", label: "Pricing" },
          ]}
        />
        <FooterColumn
          title="Company"
          links={[
            { to: "/industries", label: "Industries" },
            { to: "/resources", label: "Resource centre" },
            { to: "/compare", label: "Compare approaches" },
            { to: "/contact", label: "Contact" },
          ]}
        />
        <FooterColumn
          title="Legal"
          links={[
            { to: "/privacy", label: "Privacy policy" },
            { to: "/terms", label: "Terms of service" },
          ]}
        />
      </div>
      <div className="border-t border-white/5 px-6 py-6">
        <div className="mx-auto flex max-w-7xl flex-col gap-2 text-xs text-white/40">
          <p>© {new Date().getFullYear()} GuestReview Pro. All rights reserved.</p>
          <p>
            GuestReview Pro is an independent product. It is not affiliated with, endorsed by or
            sponsored by Google LLC. Google and Google Maps are trademarks of Google LLC.
          </p>
        </div>
      </div>
    </footer>
  );
}

function FooterColumn({
  title,
  links,
}: {
  title: string;
  links: Array<{ to: string; label: string }>;
}) {
  return (
    <div>
      <p className="text-sm font-semibold">{title}</p>
      <ul className="mt-3 space-y-2">
        {links.map((link) => (
          <li key={link.to}>
            <Link to={link.to} className="text-sm text-white/50 transition hover:text-white">
              {link.label}
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}

/* ---------- Reusable public-page primitives ---------- */

export function PageHero({
  eyebrow,
  title,
  subtitle,
  children,
}: {
  eyebrow?: string;
  title: string;
  subtitle: string;
  children?: ReactNode;
}) {
  return (
    <section className="border-b border-white/5">
      <div className="mx-auto max-w-4xl px-6 py-20 text-center sm:py-24">
        {eyebrow && (
          <p className="text-xs font-medium uppercase tracking-[0.25em] text-white/60">{eyebrow}</p>
        )}
        <h1 className="mt-5 text-4xl font-black tracking-tight sm:text-6xl" style={{ fontFamily: "var(--font-display)", letterSpacing: "-0.03em" }}>
          {title}
        </h1>
        <p className="mx-auto mt-5 max-w-2xl text-lg leading-relaxed text-white/65">{subtitle}</p>
        {children}
      </div>
    </section>
  );
}

export function Section({
  title,
  intro,
  children,
  id,
}: {
  title?: string;
  intro?: string;
  children: ReactNode;
  id?: string;
}) {
  return (
    <section id={id} className="border-b border-white/5">
      <div className="mx-auto max-w-7xl px-6 py-16 sm:py-20">
        {title && (
          <h2 className="text-3xl font-bold tracking-tight sm:text-4xl" style={{ fontFamily: "var(--font-display)" }}>
            {title}
          </h2>
        )}
        {intro && <p className="mt-3 max-w-3xl text-white/60">{intro}</p>}
        <div className={title || intro ? "mt-10" : ""}>{children}</div>
      </div>
    </section>
  );
}

export function CardGrid({ children, cols = 3 }: { children: ReactNode; cols?: 2 | 3 | 4 }) {
  const map = { 2: "sm:grid-cols-2", 3: "sm:grid-cols-2 lg:grid-cols-3", 4: "sm:grid-cols-2 lg:grid-cols-4" };
  return <div className={`grid gap-4 ${map[cols]}`}>{children}</div>;
}

export function InfoCard({ title, body, icon }: { title: string; body: string; icon?: ReactNode }) {
  return (
    <div className="rounded-3xl border border-white/10 bg-white/[0.03] p-6 transition hover:border-white/20 hover:bg-white/[0.06]">
      {icon && <div className="mb-4 grid h-10 w-10 place-items-center rounded-xl bg-white/10">{icon}</div>}
      <h3 className="text-lg font-semibold tracking-tight">{title}</h3>
      <p className="mt-2 text-sm leading-relaxed text-white/60">{body}</p>
    </div>
  );
}

export function Faq({ items, title = "Frequently asked questions" }: { items: Array<{ q: string; a: string }>; title?: string }) {
  return (
    <Section title={title}>
      <div className="divide-y divide-white/10 rounded-3xl border border-white/10 bg-white/[0.02]">
        {items.map((item) => (
          <details key={item.q} className="group p-6">
            <summary className="cursor-pointer list-none text-base font-medium marker:hidden">
              {item.q}
            </summary>
            <p className="mt-3 text-sm leading-relaxed text-white/60">{item.a}</p>
          </details>
        ))}
      </div>
    </Section>
  );
}

export function FinalCta({
  title = "Create your first Google review QR code",
  body = "Free plan: 1 business and 1 QR code. No card required.",
}: {
  title?: string;
  body?: string;
}) {
  return (
    <section>
      <div className="mx-auto max-w-4xl px-6 py-20 text-center">
        <h2 className="text-3xl font-black tracking-tight sm:text-5xl" style={{ fontFamily: "var(--font-display)" }}>
          {title}
        </h2>
        <p className="mx-auto mt-4 max-w-xl text-white/65">{body}</p>
        <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
          <Link to="/auth" data-cta="signup">
            <Button size="lg" className="rounded-full bg-white px-8 text-[#0a0f3d] hover:bg-white/90">
              Create your free QR <ArrowRight className="ml-1 h-4 w-4" aria-hidden />
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
      </div>
    </section>
  );
}
