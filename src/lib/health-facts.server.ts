// Shared server-only loader for Reputation Health™ facts.
//
// Placement dimensions (placement_plan_id, placement_plan_item_id,
// placement_key, business_goal) live on qr_codes; campaign and location_id are
// stored on both scan_events and qr_codes. Every scan is joined back to its QR
// code so all six identifiers stay first-class analytics dimensions.
import type { SupabaseClient } from "@supabase/supabase-js";
import { isValidDestinationUrl, resolveQrDestination } from "@/lib/resolve-qr-destination";
import type { HealthInput } from "@/lib/health-score";

const SCAN_LIMIT = 5000;

export interface HealthFacts {
  input: HealthInput;
  businessRow: { id: string; name: string; industry: string | null } | null;
  locationLabels: Record<string, string>;
  newQrCodesInWindow: (sinceIso: string) => number;
  packStats: { total: number; ready: number };
}

/* eslint-disable @typescript-eslint/no-explicit-any */
type Db = SupabaseClient<any, any, any>;

export async function loadHealthFacts(
  supabase: Db,
  userId: string,
  businessId: string | null,
): Promise<HealthFacts> {
  const empty: HealthFacts = {
    input: { business: null, qrCodes: [], plans: [], scans: [], eventDataAvailable: true },
    businessRow: null,
    locationLabels: {},
    newQrCodesInWindow: () => 0,
    packStats: { total: 0, ready: 0 },
  };

  const { data: businesses } = await supabase
    .from("businesses")
    .select(
      "id, name, industry, google_review_url, logo_url, brand_primary, brand_secondary, address, address_line_1, welcome_message, status, created_at",
    )
    .eq("owner_id", userId)
    .eq("status", "active")
    .order("created_at", { ascending: true });

  const row = businessId
    ? (businesses ?? []).find((b: { id: string }) => b.id === businessId)
    : (businesses ?? [])[0];

  if (!row) return empty;

  const { data: qrRows } = await supabase
    .from("qr_codes")
    .select(
      "id, label, status, scans_count, destination_type, destination_url, campaign, location_id, placement_plan_id, placement_plan_item_id, placement_key, business_goal, created_at",
    )
    .eq("owner_id", userId)
    .eq("business_id", row.id);

  const qrCreatedAt: string[] = (qrRows ?? []).map((q: { created_at: string }) => q.created_at);

  const qrCodes: HealthInput["qrCodes"] = (qrRows ?? []).map((q: Record<string, any>) => ({
    id: q.id,
    label: q.label,
    status: q.status,
    destinationResolves: Boolean(
      resolveQrDestination({
        destinationType: q.destination_type,
        destinationUrl: q.destination_url,
        businessGoogleReviewUrl: row.google_review_url,
      }).url,
    ),
    scansCount: q.scans_count ?? 0,
    placementPlanId: q.placement_plan_id,
    placementPlanItemId: q.placement_plan_item_id,
    placementKey: q.placement_key,
    businessGoal: q.business_goal,
    campaign: q.campaign,
    locationId: q.location_id,
  }));

  const { data: planRows } = await supabase
    .from("placement_plans")
    .select("id, status, checklist")
    .eq("owner_id", userId)
    .eq("business_id", row.id)
    .neq("status", "archived");

  const planIds = (planRows ?? []).map((p: { id: string }) => p.id);
  const { data: itemRows } = planIds.length
    ? await supabase
        .from("placement_plan_items")
        .select("id, placement_plan_id, implementation_status, qr_code_id")
        .in("placement_plan_id", planIds)
    : { data: [] as Array<Record<string, unknown>> };

  const plans: HealthInput["plans"] = (planRows ?? []).map((p: Record<string, any>) => {
    const items = (itemRows ?? []).filter(
      (i) => (i as { placement_plan_id: string }).placement_plan_id === p.id,
    ) as Array<{ implementation_status: string; qr_code_id: string | null }>;
    const checklist = Array.isArray(p.checklist) ? (p.checklist as Array<{ done?: boolean }>) : [];
    return {
      id: p.id,
      status: p.status,
      itemCount: items.length,
      generatedItemCount: items.filter((i) => Boolean(i.qr_code_id)).length,
      checklistTotal: checklist.length,
      checklistDone: checklist.filter((c) => Boolean(c?.done)).length,
    };
  });

  const { data: scanRows, error: scanError } = await supabase
    .from("scan_events")
    .select("qr_code_id, campaign, location_id, destination_clicked, created_at")
    .eq("owner_id", userId)
    .eq("business_id", row.id)
    .order("created_at", { ascending: false })
    .limit(SCAN_LIMIT);

  const qrById = new Map(qrCodes.map((q) => [q.id, q]));
  const scans: HealthInput["scans"] = (scanRows ?? []).map((s: Record<string, any>) => {
    const q = qrById.get(s.qr_code_id);
    return {
      qrCodeId: s.qr_code_id,
      placementPlanId: q?.placementPlanId ?? null,
      placementPlanItemId: q?.placementPlanItemId ?? null,
      placementKey: q?.placementKey ?? null,
      businessGoal: q?.businessGoal ?? null,
      campaign: s.campaign ?? q?.campaign ?? null,
      locationId: s.location_id ?? q?.locationId ?? null,
      destinationClicked: Boolean(s.destination_clicked),
      createdAt: s.created_at,
    };
  });

  const { data: locationRows } = await supabase
    .from("locations")
    .select("id, name")
    .eq("owner_id", userId)
    .eq("business_id", row.id);

  const locationLabels: Record<string, string> = {};
  for (const l of (locationRows ?? []) as Array<{ id: string; name: string }>) {
    locationLabels[l.id] = l.name;
  }

  const { data: packRows } = await supabase
    .from("marketing_packs")
    .select("id, status")
    .eq("owner_id", userId)
    .eq("business_id", row.id)
    .is("archived_at", null);

  const packs = (packRows ?? []) as Array<{ status: string }>;

  return {
    input: {
      business: {
        id: row.id,
        name: row.name,
        hasGoogleReviewUrl: isValidDestinationUrl(row.google_review_url),
        hasLogo: Boolean(row.logo_url),
        hasBrandColours: Boolean(row.brand_primary || row.brand_secondary),
        hasAddress: Boolean(row.address || row.address_line_1),
        hasWelcomeMessage: Boolean(row.welcome_message),
      },
      qrCodes,
      plans,
      scans,
      eventDataAvailable: !scanError,
    },
    businessRow: { id: row.id, name: row.name, industry: row.industry ?? null },
    locationLabels,
    newQrCodesInWindow: (sinceIso: string) => {
      const since = Date.parse(sinceIso);
      return qrCreatedAt.filter((c) => Date.parse(c) >= since).length;
    },
    packStats: {
      total: packs.length,
      ready: packs.filter((p) => p.status === "ready" || p.status === "exported").length,
    },

  };
}
