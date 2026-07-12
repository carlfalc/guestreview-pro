import { createFileRoute, Link } from "@tanstack/react-router";
import { QrCode, LineChart, MapPin, Sparkles, ArrowRight, Printer, Wand2 } from "lucide-react";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/")({
  component: Landing,
});

function GooglePulse() {
  return (
    <div className="relative mx-auto flex items-center justify-center" style={{ width: 340, height: 340 }}>
      {/* Pulsing rings */}
      <span className="absolute inset-0 rounded-full border border-white/10 animate-[ping_2.6s_ease-out_infinite]" />
      <span className="absolute inset-6 rounded-full border border-white/10 animate-[ping_2.6s_ease-out_infinite]" style={{ animationDelay: "0.4s" }} />
      <span className="absolute inset-12 rounded-full border border-white/15 animate-[ping_2.6s_ease-out_infinite]" style={{ animationDelay: "0.8s" }} />
      {/* Glow */}
      <span
        className="absolute inset-8 rounded-full blur-3xl opacity-70"
        style={{
          background:
            "conic-gradient(from 90deg, #4285F4, #34A853, #FBBC05, #EA4335, #4285F4)",
        }}
      />
      {/* Google G disc */}
      <div className="relative grid h-52 w-52 place-items-center rounded-full bg-white shadow-[0_30px_80px_-20px_rgba(66,133,244,0.6)]">
        <svg viewBox="0 0 48 48" className="h-32 w-32" aria-hidden>
          <path fill="#4285F4" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"/>
          <path fill="#34A853" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"/>
          <path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"/>
          <path fill="#EA4335" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"/>
        </svg>
      </div>
    </div>
  );
}

function Landing() {
  return (
    <div className="min-h-screen text-white overflow-hidden" style={{ background: "radial-gradient(ellipse at top, #12194d 0%, #060826 55%, #030417 100%)" }}>
      {/* Nav */}
      <header className="relative z-40 border-b border-white/5">
        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-6">
          <Link to="/" className="flex items-center gap-2.5">
            <div className="grid h-8 w-8 place-items-center rounded-lg bg-white/10 backdrop-blur">
              <QrCode className="h-4 w-4" />
            </div>
            <span className="text-[15px] font-semibold tracking-tight">GuestReview Pro</span>
          </Link>
          <div className="flex items-center gap-2">
            <Link to="/auth">
              <Button variant="ghost" size="sm" className="rounded-full text-white hover:bg-white/10 hover:text-white">Sign in</Button>
            </Link>
            <Link to="/auth">
              <Button size="sm" className="rounded-full bg-white text-[#0a0f3d] hover:bg-white/90">Get started</Button>
            </Link>
          </div>
        </div>
      </header>

      {/* Hero */}
      <section className="relative">
        <div className="mx-auto max-w-[1400px] px-6 pt-16 pb-24 sm:pt-24">
          <p className="text-center text-xs sm:text-sm font-medium tracking-[0.25em] uppercase text-white/70">
            Branded Google Review QR · Per-Table Analytics
          </p>

          {/* Massive stacked type */}
          <div
            className="mt-10 select-none text-center"
            style={{
              fontFamily: 'var(--font-display)',
              fontWeight: 900,
              lineHeight: 0.82,
              letterSpacing: "-0.045em",
              fontStretch: "125%",
            }}
          >
            <div className="relative text-white text-[22vw] sm:text-[19vw] drop-shadow-[0_20px_40px_rgba(0,0,0,0.5)]">
              GUEST
            </div>
            <div className="relative -mt-[2vw] text-white/25 text-[22vw] sm:text-[19vw]">
              REVIEW
            </div>
          </div>

          {/* Google pulse illustration */}
          <div className="relative -mt-[6vw] flex justify-center">
            <GooglePulse />
          </div>

          <div className="mx-auto mt-4 max-w-2xl text-center">
            <p className="text-lg leading-relaxed text-white/70">
              A premium platform for hotels, restaurants and retail — generate branded Google review QR stands and track every scan, table by table.
            </p>
            <div className="mt-8 flex items-center justify-center gap-3">
              <Link to="/auth">
                <Button size="lg" className="rounded-full bg-white px-8 text-[#0a0f3d] hover:bg-white/90">
                  Start free <ArrowRight className="ml-1 h-4 w-4" />
                </Button>
              </Link>
              <a href="#features">
                <Button size="lg" variant="outline" className="rounded-full border-white/20 bg-white/5 px-8 text-white hover:bg-white/10 hover:text-white">
                  See features
                </Button>
              </a>
            </div>
          </div>
        </div>
      </section>

      {/* Feature grotesque type block */}
      <section id="features" className="relative border-t border-white/5">
        <div className="mx-auto max-w-7xl px-6 py-24">
          <h2
            className="text-5xl sm:text-7xl font-black tracking-tight"
            style={{ fontFamily: 'var(--font-display)', fontStretch: "125%", letterSpacing: "-0.03em" }}
          >
            One QR per table.<br />
            <span className="text-white/40">Reviews that stack up.</span>
          </h2>
          <div className="mt-16 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {[
              { icon: QrCode, title: "Branded QR", body: "Custom colors, shapes and center logo. Export print-ready PNG, SVG and PDF." },
              { icon: MapPin, title: "Per-location", body: "One QR per table, room, bar or counter. Attribute every scan precisely." },
              { icon: LineChart, title: "Live analytics", body: "Scans, unique visitors, devices and geography — updated in real time." },
              { icon: Sparkles, title: "AI copy", body: "Professional review-request wording in five tones, ready to print." },
              { icon: Printer, title: "Print designer", body: "Drag-and-drop table stands, tent cards and posters in every standard size." },
              { icon: Wand2, title: "Guest pages", body: "Warm welcome screens with review, menu, website and directions in one tap." },
            ].map((f, i) => (
              <div
                key={i}
                className="group relative overflow-hidden rounded-3xl border border-white/10 bg-white/[0.03] p-8 transition hover:border-white/20 hover:bg-white/[0.06]"
              >
                <div className="mb-6 grid h-11 w-11 place-items-center rounded-xl bg-white/10">
                  <f.icon className="h-5 w-5" />
                </div>
                <h3 className="text-xl font-bold tracking-tight" style={{ fontFamily: 'var(--font-display)' }}>{f.title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-white/60">{f.body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="relative border-t border-white/5">
        <div className="mx-auto max-w-5xl px-6 py-28 text-center">
          <h2
            className="text-6xl sm:text-8xl font-black tracking-tight"
            style={{ fontFamily: 'var(--font-display)', fontStretch: "125%", letterSpacing: "-0.035em" }}
          >
            Ready when<br />
            <span className="bg-gradient-to-r from-[#4285F4] via-[#34A853] to-[#FBBC05] bg-clip-text text-transparent">you are.</span>
          </h2>
          <p className="mx-auto mt-6 max-w-xl text-white/70">Launch your first branded QR in under a minute. No credit card.</p>
          <Link to="/auth" className="mt-10 inline-block">
            <Button size="lg" className="rounded-full bg-white px-10 text-[#0a0f3d] hover:bg-white/90">
              Create your account
            </Button>
          </Link>
        </div>
      </section>

      <footer className="border-t border-white/5 py-8 text-center text-xs text-white/40">
        © {new Date().getFullYear()} GuestReview Pro
      </footer>
    </div>
  );
}
