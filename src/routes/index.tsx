import { createFileRoute, Link } from "@tanstack/react-router";
import { QrCode, LineChart, MapPin, Sparkles, ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/")({
  component: Landing,
});

function Landing() {
  return (
    <div className="min-h-screen bg-background">
      {/* Nav */}
      <header className="sticky top-0 z-40 border-b border-border/60 bg-background/80 backdrop-blur-xl">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-6">
          <Link to="/" className="flex items-center gap-2">
            <div className="grid h-8 w-8 place-items-center rounded-xl hero-gradient text-white shadow-sm">
              <QrCode className="h-4 w-4" />
            </div>
            <span className="text-[15px] font-semibold tracking-tight">
              GuestReview Pro
            </span>
          </Link>
          <div className="flex items-center gap-2">
            <Link to="/auth">
              <Button variant="ghost" size="sm" className="rounded-full">
                Sign in
              </Button>
            </Link>
            <Link to="/auth">
              <Button size="sm" className="rounded-full">
                Get started
              </Button>
            </Link>
          </div>
        </div>
      </header>

      {/* Hero */}
      <section className="relative overflow-hidden">
        <div className="pointer-events-none absolute inset-0 -z-10 opacity-70">
          <div className="absolute left-1/2 top-[-30%] h-[600px] w-[900px] -translate-x-1/2 rounded-full hero-gradient blur-3xl opacity-30" />
        </div>
        <div className="mx-auto max-w-4xl px-6 py-24 text-center sm:py-32">
          <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-border bg-card px-4 py-1.5 text-xs font-medium text-muted-foreground shadow-sm animate-fade-in-up">
            <Sparkles className="h-3.5 w-3.5 text-primary" />
            Per-table analytics. Beautiful QR. Real reviews.
          </div>
          <h1 className="animate-fade-in-up text-5xl font-semibold tracking-tight text-foreground sm:text-6xl md:text-7xl">
            More five-star reviews.
            <br />
            <span className="bg-gradient-to-br from-primary via-primary to-accent-foreground bg-clip-text text-transparent">
              Zero awkward asks.
            </span>
          </h1>
          <p className="mx-auto mt-6 max-w-2xl animate-fade-in-up text-lg leading-relaxed text-muted-foreground">
            Generate branded Google review QR codes for every table, room and
            counter. Track scans by location. Turn happy guests into a steady
            stream of glowing reviews.
          </p>
          <div className="mt-10 flex animate-fade-in-up items-center justify-center gap-3">
            <Link to="/auth">
              <Button size="lg" className="rounded-full px-7">
                Start free
                <ArrowRight className="ml-1 h-4 w-4" />
              </Button>
            </Link>
            <a href="#features">
              <Button
                variant="outline"
                size="lg"
                className="rounded-full px-7 bg-card"
              >
                See features
              </Button>
            </a>
          </div>
        </div>
      </section>

      {/* Features */}
      <section id="features" className="mx-auto max-w-6xl px-6 py-20">
        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {[
            {
              icon: QrCode,
              title: "Branded QR codes",
              body: "Custom colors, shapes and logo in the center. Print-ready PNG, SVG and PDF.",
            },
            {
              icon: MapPin,
              title: "Per-location tracking",
              body: "One QR per table, room or counter. See exactly which spots drive reviews.",
            },
            {
              icon: LineChart,
              title: "Beautiful analytics",
              body: "Scans, unique visitors, devices, countries and conversion — all in real time.",
            },
            {
              icon: Sparkles,
              title: "AI copywriter",
              body: "Professional review request wording in five tones, ready to print.",
            },
            {
              icon: QrCode,
              title: "Guest landing pages",
              body: "Warm welcome screens with review, menu, website and directions buttons.",
            },
            {
              icon: LineChart,
              title: "Print designer",
              body: "Drag-and-drop table stands, tent cards and posters in every popular size.",
            },
          ].map((f, i) => (
            <div
              key={i}
              className="group rounded-3xl border border-border bg-card p-8 shadow-[var(--shadow-card)] transition hover:-translate-y-0.5 hover:shadow-[var(--shadow-elevated)]"
            >
              <div className="mb-4 grid h-11 w-11 place-items-center rounded-2xl bg-accent text-primary">
                <f.icon className="h-5 w-5" />
              </div>
              <h3 className="text-lg font-semibold tracking-tight">
                {f.title}
              </h3>
              <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                {f.body}
              </p>
            </div>
          ))}
        </div>
      </section>

      {/* CTA */}
      <section className="mx-auto max-w-4xl px-6 pb-24">
        <div className="relative overflow-hidden rounded-4xl hero-gradient p-12 text-center shadow-[var(--shadow-elevated)]">
          <h2 className="text-3xl font-semibold tracking-tight text-white sm:text-4xl">
            Ready to fill your review page?
          </h2>
          <p className="mx-auto mt-3 max-w-xl text-white/85">
            Launch your first branded QR in under a minute. No credit card.
          </p>
          <Link to="/auth" className="mt-8 inline-block">
            <Button
              size="lg"
              variant="secondary"
              className="rounded-full px-8 bg-white text-foreground hover:bg-white/90"
            >
              Create your account
            </Button>
          </Link>
        </div>
      </section>

      <footer className="border-t border-border py-8 text-center text-xs text-muted-foreground">
        © {new Date().getFullYear()} GuestReview Pro
      </footer>
    </div>
  );
}
