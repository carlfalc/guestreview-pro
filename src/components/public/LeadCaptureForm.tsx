import { useState, type FormEvent } from "react";
import { useServerFn } from "@tanstack/react-start";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { submitMarketingLead } from "@/lib/public-marketing.functions";
import { usePublicTrack } from "@/hooks/use-public-track";

/**
 * Optional lead capture for the free QR Placement Guide.
 *
 * Consent is a separate, unticked checkbox and the form cannot be submitted
 * without it. Nothing else about the visitor is collected.
 */
export function LeadCaptureForm({
  industry,
  sourcePath,
}: {
  industry?: string;
  sourcePath: string;
}) {
  const submit = useServerFn(submitMarketingLead);
  const track = usePublicTrack();
  const [email, setEmail] = useState("");
  const [consent, setConsent] = useState(false);
  const [state, setState] = useState<"idle" | "sending" | "done">("idle");
  const [error, setError] = useState<string | null>(null);
  const [outcome, setOutcome] = useState<{ queued: boolean; message: string } | null>(null);

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    setError(null);
    setState("sending");
    try {
      const result = await submit({ data: { email, industry, sourcePath, consent } });
      if (result.ok) {
        setOutcome({ queued: result.emailQueued, message: result.message });
        setState("done");
        track("lead_captured", { guide: "qr-placement-guide", industry: industry ?? "general" });
      } else {
        setState("idle");
        setError(result.message);
      }
    } catch (err) {
      setState("idle");
      setError(err instanceof Error ? err.message : "Something went wrong. Please try again.");
    }
  }

  if (state === "done") {
    return (
      <div className="rounded-3xl border border-white/10 bg-white/[0.04] p-8 text-center">
        <p className="text-lg font-semibold">
          {outcome?.queued ? "Check your inbox" : "Thanks — we’ve got your request"}
        </p>
        <p className="mt-2 text-sm text-white/60">
          {outcome?.message ??
            "We’ve recorded your details and will email the QR Placement Guide shortly."}{" "}
          You can unsubscribe from any email we send.
        </p>
      </div>
    );
  }


  return (
    <form
      onSubmit={onSubmit}
      className="rounded-3xl border border-white/10 bg-white/[0.04] p-8"
      aria-labelledby="lead-capture-title"
    >
      <h2 id="lead-capture-title" className="text-xl font-semibold">
        Free QR Placement Guide
      </h2>
      <p className="mt-2 text-sm leading-relaxed text-white/60">
        A short, practical PDF: where to put review codes, what size to print them and which
        placements earn the most scans in each trade. Optional — the product works without it.
      </p>

      <div className="mt-6 flex flex-col gap-3 sm:flex-row">
        <label htmlFor="lead-email" className="sr-only">
          Email address
        </label>
        <Input
          id="lead-email"
          type="email"
          required
          autoComplete="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="you@yourbusiness.com"
          className="h-11 rounded-full border-white/15 bg-white/5 text-white placeholder:text-white/40"
        />
        <Button
          type="submit"
          disabled={state === "sending" || !consent}
          className="h-11 shrink-0 rounded-full bg-white px-6 text-[#0a0f3d] hover:bg-white/90"
        >
          {state === "sending" ? "Sending…" : "Send me the guide"}
        </Button>
      </div>

      <label className="mt-4 flex items-start gap-3 text-sm text-white/60">
        <input
          type="checkbox"
          checked={consent}
          onChange={(e) => setConsent(e.target.checked)}
          className="mt-1 h-4 w-4 rounded border-white/30 bg-transparent"
        />
        <span>
          Email me the guide and occasional product updates from GuestReview Pro. I can unsubscribe
          at any time.
        </span>
      </label>

      {error && (
        <p role="alert" className="mt-3 text-sm text-red-300">
          {error}
        </p>
      )}
    </form>
  );
}
