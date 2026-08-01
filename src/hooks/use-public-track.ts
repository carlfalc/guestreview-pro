import { useCallback, useEffect, useRef } from "react";
import { useServerFn } from "@tanstack/react-start";
import { trackPublicEvent } from "@/lib/public-marketing.functions";
import { getAttribution } from "@/lib/attribution";
import type { EventProperties, ProductEventName } from "@/lib/analytics";

const SESSION_KEY = "grp_session_id";

function sessionId(): string | undefined {
  if (typeof window === "undefined") return undefined;
  try {
    let id = window.sessionStorage.getItem(SESSION_KEY);
    if (!id) {
      id = crypto.randomUUID().replace(/-/g, "").slice(0, 32);
      window.sessionStorage.setItem(SESSION_KEY, id);
    }
    return id;
  } catch {
    return undefined;
  }
}

/** Fire-and-forget analytics for anonymous visitors on the marketing site. */
export function usePublicTrack() {
  const track = useServerFn(trackPublicEvent);

  return useCallback(
    (name: ProductEventName, properties?: EventProperties) => {
      void (async () => {
        try {
          const attribution = getAttribution();
          await track({
            data: {
              name,
              properties: { ...attribution, ...(properties ?? {}) },
              path: typeof window !== "undefined" ? window.location.pathname : undefined,
              sessionId: sessionId(),
            },
          });
        } catch {
          /* analytics is best-effort */
        }
      })();
    },
    [track],
  );
}

/** Record a single public page view after hydration. */
export function usePublicPageView(properties?: EventProperties) {
  const track = usePublicTrack();
  const sent = useRef(false);
  const propsRef = useRef(properties);

  useEffect(() => {
    if (sent.current) return;
    sent.current = true;
    track("public_page_viewed", propsRef.current);
  }, [track]);
}
