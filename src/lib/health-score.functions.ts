// Review Health Score — server aggregation.
//
// Placement dimensions (placement_plan_id, placement_plan_item_id,
// placement_key, business_goal) live on qr_codes; campaign and location_id are
// stored on both scan_events and qr_codes. Every scan is joined back to its QR
// code so all six identifiers are first-class analytics dimensions.
import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { isValidDestinationUrl, resolveQrDestination } from "@/lib/resolve-qr-destination";
import { computeHealthScore, type HealthInput, type HealthScore } from "@/lib/health-score";

const SCAN_LIMIT = 5000;

export const getReviewHealthScore = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data?: { businessId?: string }) => ({
    businessId:
      typeof data?.businessId === "string" && /^[0-9a-f-]{36}$/i.test(data.businessId)
        ? data.businessId
        : null,
  }))
  .handler(async ({ data, context }): Promise<HealthScore> => {
    const { supabase, userId } = context;

    const { data: businesses } = await supabase
      .from("businesses")
      .select(
        "id, name, google_review_url, logo_url, brand_primary, brand_secondary, address, address_line_1, welcome_message, status, created_at",
      )
      .eq("owner_id", userId)
      .eq("status", "active")
      .order("created_at", { ascending: true });

    const row = data.businessId
      ? (businesses ?? []).find((b) => b.id === data.businessId)
      : (businesses ?? [])[0];

    if (!row) {
      return computeHealthScore({
        business: null,
        qrCodes: [],
        plans: [],
        scans: [],
        eventDataAvailable: true,
      });
    }

    const { data: qrRows } = await supabase
      .from("qr_codes")
      .select(
        "id, label, status, scans_count, destination_type, destination_url, campaign, location_id, placement_plan_id, placement_plan_item_id, placement_key, business_goal",
      )
      .eq("owner_id", userId)
      .eq("business_id", row.id);

    const qrCodes: HealthInput["qrCodes"] = (qrRows ?? []).map((q) => ({
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

    const planIds = (planRows ?? []).map((p) => p.id);
    const { data: itemRows } = planIds.length
      ? await supabase
          .from("placement_plan_items")
          .select("id, placement_plan_id, implementation_status, qr_code_id")
          .in("placement_plan_id", planIds)
      : { data: [] as Array<Record<string, unknown>> };

    const plans: HealthInput["plans"] = (planRows ?? []).map((p) => {
      const items = (itemRows ?? []).filter(
        (i) => (i as { placement_plan_id: string }).placement_plan_id === p.id,
      ) as Array<{ implementation_status: string; qr_code_id: string | null }>;
      const checklist = Array.isArray(p.checklist)
        ? (p.checklist as Array<{ done?: boolean }>)
        : [];
      return {
        id: p.id,
        status: p.status,
        itemCount: items.length,
        generatedItemCount: items.filter((i) => Boolean(i.qr_code_id)).length,
        checklistTotal: checklist.length,
        checklistDone: checklist.filter((c) => Boolean(c?.done)).length,
      };
    });

    // Event-level scans, joined to their QR placement dimensions.
    const { data: scanRows, error: scanError } = await supabase
      .from("scan_events")
      .select("qr_code_id, campaign, location_id, destination_clicked, created_at")
      .eq("owner_id", userId)
      .eq("business_id", row.id)
      .order("created_at", { ascending: false })
      .limit(SCAN_LIMIT);

    const qrById = new Map(qrCodes.map((q) => [q.id, q]));
    const scans: HealthInput["scans"] = (scanRows ?? []).map((s) => {
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

    return computeHealthScore({
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
    });
  });

export interface HealthBusinessOption {
  id: string;
  name: string;
}

export const listHealthBusinesses = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<HealthBusinessOption[]> => {
    const { data } = await context.supabase
      .from("businesses")
      .select("id, name")
      .eq("owner_id", context.userId)
      .eq("status", "active")
      .order("created_at", { ascending: true });
    return (data ?? []).map((b) => ({ id: b.id, name: b.name }));
  });
