import { useCallback, useEffect, useRef } from "react";
import { useServerFn } from "@tanstack/react-start";
import { trackProductEvent } from "@/lib/analytics.functions";
import type { EventProperties, ProductEventName } from "@/lib/analytics";

const SESSION_KEY = "grp_session_id";

/**
 * A rotating, anonymous session id kept in sessionStorage. Not a cookie, not
 * a device identifier, and cleared the moment the tab closes.
 */
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

/**
 * Fire-and-forget product event tracking. Never blocks the UI and never
 * surfaces an error — analytics must not be able to break a user flow.
 */
export function useTrack() {
  const track = useServerFn(trackProductEvent);

  return useCallback(
    (name: ProductEventName, properties?: EventProperties) => {
      void (async () => {
        try {
          await track({
            data: {
              name,
              properties: properties ?? {},
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

/** Record an event once when a component mounts (e.g. a page view). */
export function useTrackOnce(name: ProductEventName, properties?: EventProperties) {
  const track = useTrack();
  const sent = useRef(false);
  // Properties are captured on the first run by design.
  const propsRef = useRef(properties);

  useEffect(() => {
    if (sent.current) return;
    sent.current = true;
    track(name, propsRef.current);
  }, [name, track]);
}
