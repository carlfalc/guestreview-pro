// Print demand validation surface.
//
// The Print Store commerce UI is paused; these functions only capture and
// report interest. Nothing here can create a cart, proof, order or payment.
import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import type { LooseClient, LooseRecord } from "@/lib/loose-types";
import {
  isPrintInterestStatus,
  isPrintProductKey,
  normalisePrintInterestSource,
  printProductLabel,
  summarisePrintDemand,
  type AdminPrintInterestRow,
  type PrintDemandFunnelStep,
  type PrintDemandSummary,
  type PrintInterestRecord,
} from "./print-interest";

const MAX_TEXT = 120;
const MAX_COMMENTS = 2000;

function text(value: unknown, max = MAX_TEXT): string | null {
  if (typeof value !== "string") return null;
  const v = value.trim();
  if (!v) return null;
  return v.slice(0, max);
}

function uuid(value: unknown): string | null {
  return typeof value === "string" && /^[0-9a-f-]{36}$/i.test(value) ? value : null;
}

function toRecord(row: LooseRecord): PrintInterestRecord {
  return {
    id: String(row.id),
    businessId: (row.business_id as string | null) ?? null,
    email: String(row.email ?? ""),
    countryCode: (row.country_code as string | null) ?? null,
    productKeys: Array.isArray(row.product_keys) ? (row.product_keys as string[]) : [],
    expectedQuantity: (row.expected_quantity as string | null) ?? null,
    preferredSize: (row.preferred_size as string | null) ?? null,
    preferredMaterial: (row.preferred_material as string | null) ?? null,
    desiredTimeframe: (row.desired_timeframe as string | null) ?? null,
    comments: (row.comments as string | null) ?? null,
    contactConsent: Boolean(row.contact_consent),
    source: String(row.source ?? "unknown"),
    status: String(row.status ?? "new"),
    createdAt: String(row.created_at ?? ""),
    updatedAt: String(row.updated_at ?? ""),
  };
}

export interface PrintInterestContext {
  email: string;
  countryCode: string | null;
  businesses: Array<{ id: string; name: string; industry: string | null }>;
  entries: PrintInterestRecord[];
}

/** Everything the waitlist form needs to prefill itself. */
export const getPrintInterestContext = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<PrintInterestContext> => {
    const db = context.supabase as never as LooseClient;
    const [profile, region, businesses, entries] = await Promise.all([
      db.from("profiles").select("email").eq("id", context.userId).maybeSingle(),
      db
        .from("account_regions")
        .select("country_code")
        .eq("owner_id", context.userId)
        .maybeSingle(),
      db
        .from("businesses")
        .select("id, name, industry")
        .eq("owner_id", context.userId)
        .eq("status", "active")
        .order("created_at", { ascending: true }),
      db
        .from("print_interest")
        .select("*")
        .eq("owner_id", context.userId)
        .order("created_at", { ascending: false }),
    ]);

    const claimEmail =
      typeof (context.claims as LooseRecord | undefined)?.email === "string"
        ? String((context.claims as LooseRecord).email)
        : "";

    return {
      email: (profile?.data?.email as string | undefined) || claimEmail,
      countryCode: (region?.data?.country_code as string | null) ?? null,
      businesses: ((businesses?.data ?? []) as LooseRecord[]).map((b) => ({
        id: String(b.id),
        name: String(b.name ?? "Business"),
        industry: (b.industry as string | null) ?? null,
      })),
      entries: ((entries?.data ?? []) as LooseRecord[]).map(toRecord),
    };
  });

export interface SubmitPrintInterestResult {
  ok: true;
  updated: boolean;
  entry: PrintInterestRecord;
}

/**
 * Create or update this account's waitlist entry for a given source. The
 * unique (owner_id, source) index makes a repeat submission an update rather
 * than a duplicate row.
 */
export const submitPrintInterest = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: LooseRecord) => {
    const products = Array.isArray(data?.productKeys)
      ? [...new Set((data.productKeys as unknown[]).filter(isPrintProductKey))]
      : [];
    if (!products.length) throw new Error("Please choose at least one product.");
    const email = text(data?.email, 254);
    if (!email || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) {
      throw new Error("Please provide a valid contact email.");
    }
    const country = text(data?.countryCode, 2);
    return {
      businessId: uuid(data?.businessId),
      email: email.toLowerCase(),
      countryCode: country ? country.toUpperCase() : null,
      productKeys: products,
      expectedQuantity: text(data?.expectedQuantity),
      preferredSize: text(data?.preferredSize),
      preferredMaterial: text(data?.preferredMaterial),
      desiredTimeframe: text(data?.desiredTimeframe),
      comments: text(data?.comments, MAX_COMMENTS),
      contactConsent: Boolean(data?.contactConsent),
      source: normalisePrintInterestSource(data?.source),
    };
  })
  .handler(async ({ data, context }): Promise<SubmitPrintInterestResult> => {
    const db = context.supabase as never as LooseClient;

    // The business must belong to the caller — never trust a client id.
    let businessId = data.businessId;
    if (businessId) {
      const { data: owned } = await db
        .from("businesses")
        .select("id")
        .eq("id", businessId)
        .eq("owner_id", context.userId)
        .maybeSingle();
      if (!owned) businessId = null;
    }

    const { data: existing } = await db
      .from("print_interest")
      .select("id, status")
      .eq("owner_id", context.userId)
      .eq("source", data.source)
      .maybeSingle();

    const payload = {
      owner_id: context.userId,
      business_id: businessId,
      email: data.email,
      country_code: data.countryCode,
      product_keys: data.productKeys,
      expected_quantity: data.expectedQuantity,
      preferred_size: data.preferredSize,
      preferred_material: data.preferredMaterial,
      desired_timeframe: data.desiredTimeframe,
      comments: data.comments,
      contact_consent: data.contactConsent,
      source: data.source,
    };

    const query = existing
      ? db.from("print_interest").update(payload).eq("id", existing.id).select("*").maybeSingle()
      : db.from("print_interest").insert(payload).select("*").maybeSingle();

    const { data: row, error } = await query;
    if (error) throw new Error(error.message);
    if (!row) throw new Error("Could not save your preferences. Please try again.");

    // Acknowledgment email is best-effort — a mail failure must not lose the
    // demand signal we just captured.
    if (!existing) {
      try {
        const { sendPrintWaitlistAck } = await import("./print-interest.server");
        await sendPrintWaitlistAck({
          email: data.email,
          ownerId: context.userId,
          businessId,
          productLabels: data.productKeys.map(printProductLabel),
        });
      } catch (err) {
        console.error("print waitlist ack failed:", (err as Error).message);
      }
    }

    return { ok: true, updated: Boolean(existing), entry: toRecord(row) };
  });

async function assertAdmin(context: { supabase: LooseClient; userId: string }) {
  const { data } = await context.supabase.rpc("has_role", {
    _user_id: context.userId,
    _role: "admin",
  });
  if (!data) throw new Error("Forbidden");
}

export interface AdminPrintDemand {
  rows: AdminPrintInterestRow[];
  summary: PrintDemandSummary;
  funnel: PrintDemandFunnelStep[];
}

/** Admin-only demand dashboard payload. No supplier costs are exposed. */
export const adminPrintDemand = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<AdminPrintDemand> => {
    const db = context.supabase as never as LooseClient;
    await assertAdmin({ supabase: db, userId: context.userId });

    const { data, error } = await db
      .from("print_interest")
      .select("*, businesses:business_id (name, industry)")
      .order("created_at", { ascending: false })
      .limit(1000);
    if (error) throw new Error(error.message);

    const rows: AdminPrintInterestRow[] = ((data ?? []) as LooseRecord[]).map((row) => ({
      ...toRecord(row),
      ownerId: String(row.owner_id),
      businessName: (row.businesses?.name as string | undefined) ?? null,
      businessIndustry: (row.businesses?.industry as string | undefined) ?? null,
      adminNotes: (row.admin_notes as string | null) ?? null,
    }));

    const summary = summarisePrintDemand(rows);

    const countEvent = async (name: string) => {
      const { data: ev } = await db
        .from("product_events")
        .select("owner_id")
        .eq("event_name", name)
        .limit(5000);
      return new Set(((ev ?? []) as LooseRecord[]).map((e) => e.owner_id ?? e.session_id)).size;
    };

    const [viewed, opened] = await Promise.all([
      countEvent("print_interest_card_viewed"),
      countEvent("print_waitlist_opened"),
    ]);

    const funnel: PrintDemandFunnelStep[] = [
      { step: "card_viewed", label: "Interest card viewed", accounts: viewed },
      { step: "waitlist_opened", label: "Waitlist opened", accounts: opened },
      { step: "submitted", label: "Interest submitted", accounts: summary.totalAccounts },
      {
        step: "contacted",
        label: "Contacted",
        accounts: new Set(
          rows
            .filter((r) => ["contacted", "quoted", "converted"].includes(r.status))
            .map((r) => r.ownerId),
        ).size,
      },
      {
        step: "converted",
        label: "Converted",
        accounts: new Set(rows.filter((r) => r.status === "converted").map((r) => r.ownerId)).size,
      },
    ];

    return { rows, summary, funnel };
  });

/** Admin triage: status and internal notes. */
export const adminUpdatePrintInterest = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { id: string; status?: string; adminNotes?: string }) => {
    const id = uuid(data?.id);
    if (!id) throw new Error("Invalid id");
    const status = data?.status;
    if (status !== undefined && !isPrintInterestStatus(status)) throw new Error("Invalid status");
    return {
      id,
      status: status ?? null,
      adminNotes: data?.adminNotes === undefined ? null : text(data.adminNotes, MAX_COMMENTS),
      notesProvided: data?.adminNotes !== undefined,
    };
  })
  .handler(async ({ data, context }): Promise<{ ok: true }> => {
    const db = context.supabase as never as LooseClient;
    await assertAdmin({ supabase: db, userId: context.userId });
    const patch: LooseRecord = {};
    if (data.status) patch.status = data.status;
    if (data.notesProvided) patch.admin_notes = data.adminNotes;
    if (!Object.keys(patch).length) return { ok: true };
    const { error } = await db.from("print_interest").update(patch).eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });
