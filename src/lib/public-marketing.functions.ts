// Unauthenticated server surface for the public marketing site.
//
// Two capabilities only: anonymous page/CTA analytics and the QR Placement
// Guide lead capture. Both write through the admin client because visitors
// have no session, so every field is validated and clamped here first.

import { createServerFn } from "@tanstack/react-start";
import { isProductEvent, sanitiseEventProperties, sanitisePath } from "./analytics";

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

/** Anonymous product event from a public marketing page. No owner, no PII. */
export const trackPublicEvent = createServerFn({ method: "POST" })
  .inputValidator((data: { name: string; properties?: unknown; path?: string; sessionId?: string }) => ({
    name: String(data?.name ?? ""),
    properties: sanitiseEventProperties(data?.properties),
    path: sanitisePath(data?.path),
    sessionId:
      typeof data?.sessionId === "string" && /^[A-Za-z0-9_-]{1,64}$/.test(data.sessionId)
        ? data.sessionId
        : null,
  }))
  .handler(async ({ data }): Promise<{ ok: boolean }> => {
    if (!isProductEvent(data.name)) return { ok: false };
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin.from("product_events").insert({
      owner_id: null,
      event_name: data.name,
      properties: data.properties,
      path: data.path,
      session_id: data.sessionId,
    });
    if (error) {
      console.error("public product_events insert failed:", error.message);
      return { ok: false };
    }
    return { ok: true };
  });

export type LeadResult = { ok: true } | { ok: false; message: string };

/** QR Placement Guide sign-up. Consent is explicit and never pre-ticked. */
export const submitMarketingLead = createServerFn({ method: "POST" })
  .inputValidator(
    (data: { email: string; industry?: string; sourcePath?: string; consent: boolean }) => {
      const email = String(data?.email ?? "").trim().toLowerCase();
      if (!EMAIL.test(email) || email.length > 254) throw new Error("Enter a valid email address.");
      if (data?.consent !== true) throw new Error("Please tick the consent box to continue.");
      const industry =
        typeof data?.industry === "string" && /^[a-z-]{1,64}$/.test(data.industry)
          ? data.industry
          : null;
      return { email, industry, sourcePath: sanitisePath(data?.sourcePath), consent: true };
    },
  )
  .handler(async ({ data }): Promise<LeadResult> => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin.from("marketing_leads").insert({
      email: data.email,
      guide_key: "qr-placement-guide",
      industry: data.industry,
      source_path: data.sourcePath,
      marketing_consent: data.consent,
    });
    // A duplicate simply means they already have the guide — treat as success.
    if (error && !error.message.toLowerCase().includes("duplicate")) {
      console.error("marketing_leads insert failed:", error.message);
      return { ok: false, message: "We could not save that just now. Please try again." };
    }
    return { ok: true };
  });
