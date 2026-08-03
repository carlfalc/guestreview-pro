import { Link } from "@tanstack/react-router";
import { Sparkles } from "lucide-react";
import { useEffect, useRef } from "react";
import { useFounderOffer } from "@/hooks/use-founder";
import { remainingLabel, FOUNDER_COPY } from "@/lib/founder";
import { usePublicTrack } from "@/hooks/use-public-track";

/**
 * Public "Founding Member Beta" strip. Disappears the moment the last place
 * is claimed — it never advertises an offer that cannot be bought.
 */
export function FounderBanner() {
  const { data } = useFounderOffer();
  const track = usePublicTrack();
  const seen = useRef(false);

  const remaining = data?.remaining ?? 0;
  const available = Boolean(data?.available);

  useEffect(() => {
    if (!available || seen.current) return;
    seen.current = true;
    track("founder_banner_viewed", { remaining });
  }, [available, remaining, track]);

  if (!available) return null;

  return (
    <div className="border-b border-amber-400/20 bg-amber-400/10">
      <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-center gap-x-3 gap-y-1 px-6 py-2 text-center text-sm text-amber-200">
        <span className="inline-flex items-center gap-1.5 font-medium">
          <Sparkles className="h-4 w-4" aria-hidden />
          {FOUNDER_COPY.eyebrow}
        </span>
        <span className="text-amber-100/80">{remainingLabel(remaining)}</span>
        <Link
          to="/pricing"
          className="underline underline-offset-4 hover:text-white"
          onClick={() => track("founder_offer_viewed", { source: "banner", remaining })}
        >
          See founder pricing
        </Link>
      </div>
    </div>
  );
}
