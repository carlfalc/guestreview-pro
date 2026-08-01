// Goal-based placement plans: save, generate and track.
//
// Every write runs through the caller's own Supabase client, so RLS is the
// final authority on ownership. Plan/entitlement decisions are made server
// side from the database — never from client input.
import { createServerFn } from "@tanstack/react-start";
import { getRequest } from "@tanstack/react-start/server";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { generateShortCode } from "@/lib/short-code";
import {
  RECOMMENDATION_VERSION,
  buildChecklist,
  isGoalKey,
  isIndustryKey,
  packFormatsFor,
  type ChecklistItem,
  type GoalKey,
  type IndustryKey,
  type PlacementRecommendation,
  type PriorityKey,
} from "@/lib/placement-recommendations";
import type { PlanTierKey } from "@/lib/entitlements";

export type PlanStatus =
  | "draft"
  | "ready"
  | "generating"
  | "generated"
  | "partially_generated"
  | "archived";

export interface PlanItemRow {
  id: string;
  placement_key: string;
  placement_name: string;
  priority: PriorityKey;
  goal: string | null;
  destination_type: string;
  destination_url: string | null;
  recommended_format_id: string | null;
  qr_code_id: string | null;
  location_id: string | null;
  headline: string | null;
  support_text: string | null;
  cta_text: string | null;
  material: string | null;
  sort_order: number;
  implementation_status: string;
  failure_reason: string | null;
}

export interface PlanRow {
  id: string;
  business_id: string;
  name: string;
  industry: string;
  goals: string[];
  status: PlanStatus;
  generated_qr_ids: string[];
  marketing_pack_id: string | null;
  checklist: ChecklistItem[];
  recommendation_version: number;
  created_at: string;
  updated_at: string;
}

export interface PlanSummary extends PlanRow {
  businessName: string;
  itemCount: number;
  generatedCount: number;
  checklistProgress: number;
}

export interface PlanDetail {
  plan: PlanRow;
  items: PlanItemRow[];
  business: {
    id: string;
    name: string;
    google_review_url: string | null;
    website: string | null;
    industry: string | null;
  } | null;
  plan_tier: PlanTierKey;
}

type AnyClient = { from: (t: string) => any; rpc: (n: string, a: unknown) => Promise<any> };

const UUID = /^[0-9a-f-]{36}$/i;

function assertUuid(v: unknown, label = "id"): string {
  const s = String(v ?? "");
  if (!UUID.test(s)) throw new Error(`Invalid ${label}`);
  return s;
}

function text(v: unknown, max: number): string | null {
  if (typeof v !== "string") return null;
  const t = v.trim();
  return t ? t.slice(0, max) : null;
}

async function accountPlan(userId: string): Promise<PlanTierKey> {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { resolvePaymentsEnvironment, requestHost } = await import("./payments-env.server");
  let host: string | null = null;
  try {
    host = requestHost(getRequest());
  } catch {
    host = null;
  }
  const environment = resolvePaymentsEnvironment(host);
  const { getAccountPlan } = await import("./entitlements.server");
  return getAccountPlan(supabaseAdmin as never, userId, environment);
}

function asChecklist(v: unknown): ChecklistItem[] {
  if (!Array.isArray(v)) return [];
  return v
    .filter((x) => x && typeof x === "object")
    .map((x) => {
      const o = x as Record<string, unknown>;
      return {
        key: String(o.key ?? ""),
        label: String(o.label ?? ""),
        done: Boolean(o.done),
      };
    })
    .filter((x) => x.key);
}

function normalisePlan(row: Record<string, unknown>): PlanRow {
  return {
    id: String(row.id),
    business_id: String(row.business_id),
    name: String(row.name ?? "Placement plan"),
    industry: String(row.industry ?? "other"),
    goals: Array.isArray(row.goals) ? (row.goals as string[]) : [],
    status: (row.status as PlanStatus) ?? "draft",
    generated_qr_ids: Array.isArray(row.generated_qr_ids) ? (row.generated_qr_ids as string[]) : [],
    marketing_pack_id: (row.marketing_pack_id as string | null) ?? null,
    checklist: asChecklist(row.checklist),
    recommendation_version: Number(row.recommendation_version ?? RECOMMENDATION_VERSION),
    created_at: String(row.created_at ?? ""),
    updated_at: String(row.updated_at ?? ""),
  };
}

// ------------------------------------------------------------------ reads

export const listMyPlacementPlans = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<PlanSummary[]> => {
    const db = context.supabase as unknown as AnyClient;
    const { data, error } = await db
      .from("placement_plans")
      .select("*, businesses(name), placement_plan_items(id, implementation_status)")
      .order("updated_at", { ascending: false })
      .limit(200);
    if (error) throw new Error(error.message);
    return ((data ?? []) as Record<string, unknown>[]).map((raw) => {
      const plan = normalisePlan(raw);
      const items = (raw.placement_plan_items ?? []) as Array<{ implementation_status: string }>;
      const done = plan.checklist.filter((c) => c.done).length;
      return {
        ...plan,
        businessName: String((raw.businesses as { name?: string } | null)?.name ?? "Business"),
        itemCount: items.length,
        generatedCount: items.filter((i) => i.implementation_status === "generated").length,
        checklistProgress: plan.checklist.length
          ? Math.round((done / plan.checklist.length) * 100)
          : 0,
      };
    });
  });

export const getPlacementPlan = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { id: string }) => ({ id: assertUuid(data?.id) }))
  .handler(async ({ data, context }): Promise<PlanDetail> => {
    const db = context.supabase as unknown as AnyClient;
    const { data: plan, error } = await db
      .from("placement_plans")
      .select("*")
      .eq("id", data.id)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!plan) throw new Error("Plan not found");
    const [{ data: items }, { data: business }] = await Promise.all([
      db
        .from("placement_plan_items")
        .select("*")
        .eq("placement_plan_id", data.id)
        .order("sort_order", { ascending: true }),
      db
        .from("businesses")
        .select("id, name, google_review_url, website, industry")
        .eq("id", (plan as { business_id: string }).business_id)
        .maybeSingle(),
    ]);
    return {
      plan: normalisePlan(plan as Record<string, unknown>),
      items: (items ?? []) as PlanItemRow[],
      business: (business ?? null) as PlanDetail["business"],
      plan_tier: await accountPlan(context.userId),
    };
  });

// ------------------------------------------------------------------ save

export interface SaveItemInput {
  placementKey: string;
  placementName: string;
  priority: PriorityKey;
  goal: string;
  destinationType: string;
  destinationUrl?: string | null;
  formatId: string;
  headline?: string | null;
  supportText?: string | null;
  ctaText?: string | null;
  material?: string | null;
}

export interface SavePlanInput {
  id?: string | null;
  businessId: string;
  name: string;
  industry: string;
  goals: string[];
  items: SaveItemInput[];
}

/** Create or replace a draft placement plan and its items. */
export const savePlacementPlan = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: SavePlanInput) => {
    const businessId = assertUuid(data?.businessId, "business");
    const industry = String(data?.industry ?? "other");
    if (!isIndustryKey(industry)) throw new Error("Unknown industry");
    const goals = (Array.isArray(data?.goals) ? data.goals : []).filter(isGoalKey);
    if (!goals.length) throw new Error("Choose at least one goal");
    const items = (Array.isArray(data?.items) ? data.items : []).slice(0, 40).map((i) => ({
      placementKey: String(i?.placementKey ?? "").slice(0, 80),
      placementName: String(i?.placementName ?? "").slice(0, 120) || "Placement",
      priority: (["high", "medium", "low"].includes(String(i?.priority))
        ? i.priority
        : "medium") as PriorityKey,
      goal: String(i?.goal ?? goals[0]),
      destinationType: String(i?.destinationType ?? "google_review").slice(0, 40),
      destinationUrl: text(i?.destinationUrl, 2000),
      formatId: String(i?.formatId ?? "a6-portrait").slice(0, 60),
      headline: text(i?.headline, 200),
      supportText: text(i?.supportText, 400),
      ctaText: text(i?.ctaText, 120),
      material: text(i?.material, 160),
    }));
    if (!items.length) throw new Error("Add at least one placement");
    if (items.some((i) => !i.placementKey)) throw new Error("Invalid placement");
    return {
      id: data?.id ? assertUuid(data.id, "plan") : null,
      businessId,
      name: String(data?.name ?? "").trim().slice(0, 140) || "Placement plan",
      industry: industry as IndustryKey,
      goals: goals as GoalKey[],
      items,
    };
  })
  .handler(async ({ data, context }): Promise<{ id: string }> => {
    const db = context.supabase as unknown as AnyClient;
    // Ownership of the target business is enforced by RLS on this read.
    const { data: business } = await db
      .from("businesses")
      .select("id")
      .eq("id", data.businessId)
      .maybeSingle();
    if (!business) throw new Error("Business not found");

    let planId = data.id;
    const checklist = buildChecklist(
      data.items.map((i) => ({
        placementKey: i.placementKey,
        placementName: i.placementName,
        formatName: i.material ?? i.formatId,
      })) as unknown as PlacementRecommendation[],
    );

    if (planId) {
      const { error } = await db
        .from("placement_plans")
        .update({
          business_id: data.businessId,
          name: data.name,
          industry: data.industry,
          goals: data.goals,
          selected_placements: data.items.map((i) => i.placementKey),
        })
        .eq("id", planId);
      if (error) throw new Error(error.message);
      // Items not yet generated are replaced wholesale; generated ones stay.
      await db
        .from("placement_plan_items")
        .delete()
        .eq("placement_plan_id", planId)
        .is("qr_code_id", null);
    } else {
      const { data: created, error } = await db
        .from("placement_plans")
        .insert({
          owner_id: context.userId,
          business_id: data.businessId,
          name: data.name,
          industry: data.industry,
          goals: data.goals,
          selected_placements: data.items.map((i) => i.placementKey),
          status: "draft",
          checklist,
          recommendation_version: RECOMMENDATION_VERSION,
        })
        .select("id")
        .single();
      if (error) throw new Error(error.message);
      planId = (created as { id: string }).id;
    }

    const { data: kept } = await db
      .from("placement_plan_items")
      .select("placement_key")
      .eq("placement_plan_id", planId);
    const keptKeys = new Set(
      ((kept ?? []) as Array<{ placement_key: string }>).map((k) => k.placement_key),
    );

    const rows = data.items
      .filter((i) => !keptKeys.has(i.placementKey))
      .map((i, index) => ({
        placement_plan_id: planId,
        owner_id: context.userId,
        business_id: data.businessId,
        placement_key: i.placementKey,
        placement_name: i.placementName,
        priority: i.priority,
        goal: i.goal,
        destination_type: i.destinationType,
        destination_url: i.destinationUrl,
        recommended_format_id: i.formatId,
        headline: i.headline,
        support_text: i.supportText,
        cta_text: i.ctaText,
        material: i.material,
        sort_order: index,
        implementation_status: "ready",
      }));
    if (rows.length) {
      const { error } = await db.from("placement_plan_items").insert(rows);
      if (error) throw new Error(error.message);
    }
    return { id: planId! };
  });

// -------------------------------------------------------------- generate

export interface GenerateFailure {
  itemId: string;
  placementName: string;
  reason: string;
}

export interface GenerateResult {
  planId: string;
  status: PlanStatus;
  generated: number;
  skipped: number;
  failures: GenerateFailure[];
  marketingPackId: string | null;
  qrIds: string[];
}

function reviewUrlFor(
  destinationType: string,
  itemUrl: string | null,
  business: { google_review_url: string | null; website: string | null },
): { url: string | null; error?: string } {
  if (itemUrl) return { url: itemUrl };
  if (destinationType === "google_review") {
    if (business.google_review_url) return { url: null }; // falls back to the business URL
    return { url: null, error: "Add a Google review link to this business first." };
  }
  if (business.website) return { url: business.website };
  return { url: null, error: "Add a destination link for this placement." };
}

/**
 * Generate locations, QR codes and a marketing pack for a plan.
 *
 * Safe to re-run: items that already carry a QR code are skipped, so a retry
 * after a partial failure never creates duplicates.
 */
export const generatePlacementPlan = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { id: string; itemIds?: string[] }) => ({
    id: assertUuid(data?.id, "plan"),
    itemIds: Array.isArray(data?.itemIds)
      ? data.itemIds.slice(0, 40).map((i) => assertUuid(i, "item"))
      : null,
  }))
  .handler(async ({ data, context }): Promise<GenerateResult> => {
    const db = context.supabase as unknown as AnyClient;
    const tier = await accountPlan(context.userId);

    const { data: planRaw } = await db
      .from("placement_plans")
      .select("*")
      .eq("id", data.id)
      .maybeSingle();
    if (!planRaw) throw new Error("Plan not found");
    const plan = normalisePlan(planRaw as Record<string, unknown>);

    const { data: business } = await db
      .from("businesses")
      .select("id, name, google_review_url, website")
      .eq("id", plan.business_id)
      .maybeSingle();
    if (!business) throw new Error("Business not found");
    const biz = business as {
      id: string;
      name: string;
      google_review_url: string | null;
      website: string | null;
    };

    let query = db
      .from("placement_plan_items")
      .select("*")
      .eq("placement_plan_id", plan.id)
      .order("sort_order", { ascending: true });
    if (data.itemIds) query = query.in("id", data.itemIds);
    const { data: itemRows } = await query;
    const items = (itemRows ?? []) as PlanItemRow[];
    if (!items.length) throw new Error("Nothing to generate");

    // Free accounts may only generate a single QR code — one at a time.
    const pending = items.filter((i) => !i.qr_code_id);
    const allowance = tier === "free" ? 1 : pending.length;
    const toGenerate = pending.slice(0, allowance);
    const deferred = pending.slice(allowance);

    await db.from("placement_plans").update({ status: "generating" }).eq("id", plan.id);

    const failures: GenerateFailure[] = [];
    const qrIds: string[] = [...plan.generated_qr_ids];
    let generated = 0;

    for (const item of toGenerate) {
      try {
        // Reuse an existing location with the same name rather than duplicating.
        let locationId = item.location_id;
        const locationName = item.placement_name;
        if (!locationId && locationName) {
          const { data: existingLoc } = await db
            .from("locations")
            .select("id")
            .eq("business_id", biz.id)
            .eq("name", locationName)
            .maybeSingle();
          if (existingLoc) {
            locationId = (existingLoc as { id: string }).id;
          } else {
            const { data: newLoc, error: locError } = await db
              .from("locations")
              .insert({
                business_id: biz.id,
                owner_id: context.userId,
                name: locationName,
                location_type: "placement",
                identifier: item.placement_key,
                status: "active",
              })
              .select("id")
              .single();
            if (locError) throw new Error(locError.message);
            locationId = (newLoc as { id: string }).id;
          }
        }

        const resolved = reviewUrlFor(item.destination_type, item.destination_url, biz);
        if (resolved.error) throw new Error(resolved.error);

        const { data: qr, error: qrError } = await db
          .from("qr_codes")
          .insert({
            business_id: biz.id,
            owner_id: context.userId,
            location_id: locationId,
            short_code: generateShortCode(),
            label: `${item.placement_name} — ${biz.name}`,
            campaign: `plan-${plan.id.slice(0, 8)}`,
            destination_type: item.destination_type,
            destination_url: resolved.url,
            destination_label: item.placement_name,
            status: "active",
            landing_mode: "direct",
            headline: item.headline,
            support_text: item.support_text,
            cta_text: item.cta_text,
            layout_template: "clean-minimal",
            selected_formats: item.recommended_format_id ? [item.recommended_format_id] : [],
            placement_plan_id: plan.id,
            placement_plan_item_id: item.id,
            placement_key: item.placement_key,
            business_goal: item.goal,
          })
          .select("id")
          .single();
        if (qrError) throw new Error(qrError.message);

        const qrId = (qr as { id: string }).id;
        qrIds.push(qrId);
        generated += 1;
        await db
          .from("placement_plan_items")
          .update({
            qr_code_id: qrId,
            location_id: locationId,
            implementation_status: "generated",
            failure_reason: null,
          })
          .eq("id", item.id);
      } catch (e) {
        const reason = (e as { message?: string })?.message ?? "Could not generate this placement.";
        failures.push({ itemId: item.id, placementName: item.placement_name, reason });
        await db
          .from("placement_plan_items")
          .update({ implementation_status: "failed", failure_reason: reason.slice(0, 500) })
          .eq("id", item.id);
      }
    }

    // One marketing pack per plan, anchored to the highest-priority QR.
    let packId = plan.marketing_pack_id;
    if (!packId && qrIds.length) {
      const formats = packFormatsFor(
        items
          .filter((i) => i.recommended_format_id)
          .map((i) => ({ formatId: i.recommended_format_id! })),
      );
      const lead = items.find((i) => i.qr_code_id) ?? null;
      const { data: pack } = await db
        .from("marketing_packs")
        .insert({
          owner_id: context.userId,
          business_id: biz.id,
          qr_code_id: lead?.qr_code_id ?? qrIds[0],
          project_name: `${plan.name} — assets`,
          pack_type: "custom",
          layout_template: "clean-minimal",
          selected_formats: formats,
          headline: items[0]?.headline ?? "Loved your visit?",
          support_text: items[0]?.support_text ?? "Scan to leave us a review.",
          cta_text: items[0]?.cta_text ?? "Leave a review",
          status: "draft",
        })
        .select("id")
        .maybeSingle();
      packId = (pack as { id: string } | null)?.id ?? null;
    }

    const { data: allItems } = await db
      .from("placement_plan_items")
      .select("qr_code_id")
      .eq("placement_plan_id", plan.id);
    const total = ((allItems ?? []) as Array<{ qr_code_id: string | null }>).length;
    const done = ((allItems ?? []) as Array<{ qr_code_id: string | null }>).filter(
      (i) => i.qr_code_id,
    ).length;
    const status: PlanStatus =
      done === 0 ? "ready" : done >= total && !failures.length ? "generated" : "partially_generated";

    await db
      .from("placement_plans")
      .update({
        status,
        generated_qr_ids: qrIds,
        marketing_pack_id: packId,
      })
      .eq("id", plan.id);

    return {
      planId: plan.id,
      status,
      generated,
      skipped: deferred.length,
      failures,
      marketingPackId: packId,
      qrIds,
    };
  });

// -------------------------------------------------------------- lifecycle

export const setPlanChecklist = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { id: string; checklist: ChecklistItem[] }) => ({
    id: assertUuid(data?.id, "plan"),
    checklist: asChecklist(data?.checklist).slice(0, 60),
  }))
  .handler(async ({ data, context }): Promise<{ ok: true }> => {
    const db = context.supabase as unknown as AnyClient;
    const { error } = await db
      .from("placement_plans")
      .update({ checklist: data.checklist })
      .eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const archivePlacementPlan = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { id: string }) => ({ id: assertUuid(data?.id, "plan") }))
  .handler(async ({ data, context }): Promise<{ ok: true }> => {
    const db = context.supabase as unknown as AnyClient;
    const { error } = await db
      .from("placement_plans")
      .update({ status: "archived" })
      .eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

/** Copy a plan and its items as a fresh draft. Never copies generated QR links. */
export const duplicatePlacementPlan = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { id: string }) => ({ id: assertUuid(data?.id, "plan") }))
  .handler(async ({ data, context }): Promise<{ id: string }> => {
    const db = context.supabase as unknown as AnyClient;
    const { data: planRaw } = await db
      .from("placement_plans")
      .select("*")
      .eq("id", data.id)
      .maybeSingle();
    if (!planRaw) throw new Error("Plan not found");
    const plan = normalisePlan(planRaw as Record<string, unknown>);
    const { data: items } = await db
      .from("placement_plan_items")
      .select("*")
      .eq("placement_plan_id", plan.id)
      .order("sort_order", { ascending: true });

    const { data: created, error } = await db
      .from("placement_plans")
      .insert({
        owner_id: context.userId,
        business_id: plan.business_id,
        name: `${plan.name} (copy)`,
        industry: plan.industry,
        goals: plan.goals,
        selected_placements: (planRaw as Record<string, unknown>).selected_placements ?? [],
        status: "draft",
        checklist: plan.checklist.map((c) => ({ ...c, done: false })),
        recommendation_version: plan.recommendation_version,
      })
      .select("id")
      .single();
    if (error) throw new Error(error.message);
    const newId = (created as { id: string }).id;

    const rows = ((items ?? []) as PlanItemRow[]).map((i, index) => ({
      placement_plan_id: newId,
      owner_id: context.userId,
      business_id: plan.business_id,
      placement_key: i.placement_key,
      placement_name: i.placement_name,
      priority: i.priority,
      goal: i.goal,
      destination_type: i.destination_type,
      destination_url: i.destination_url,
      recommended_format_id: i.recommended_format_id,
      headline: i.headline,
      support_text: i.support_text,
      cta_text: i.cta_text,
      material: i.material,
      sort_order: index,
      implementation_status: "ready",
    }));
    if (rows.length) await db.from("placement_plan_items").insert(rows);
    return { id: newId };
  });

// -------------------------------------------------------------- analytics

export interface PlacementPerformance {
  placementKey: string;
  placementName: string;
  qrCodeId: string | null;
  scans: number;
  destinationClicks: number;
  conversionRate: number;
}

/** Scans and destination clicks grouped by placement for one plan. */
export const getPlacementPlanAnalytics = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { id: string }) => ({ id: assertUuid(data?.id, "plan") }))
  .handler(async ({ data, context }): Promise<PlacementPerformance[]> => {
    const db = context.supabase as unknown as AnyClient;
    const { data: items } = await db
      .from("placement_plan_items")
      .select("placement_key, placement_name, qr_code_id")
      .eq("placement_plan_id", data.id)
      .order("sort_order", { ascending: true });
    const rows = (items ?? []) as Array<{
      placement_key: string;
      placement_name: string;
      qr_code_id: string | null;
    }>;
    const qrIds = rows.map((r) => r.qr_code_id).filter(Boolean) as string[];
    if (!qrIds.length) {
      return rows.map((r) => ({
        placementKey: r.placement_key,
        placementName: r.placement_name,
        qrCodeId: null,
        scans: 0,
        destinationClicks: 0,
        conversionRate: 0,
      }));
    }
    const { data: scans } = await db
      .from("scan_events")
      .select("qr_code_id, destination_clicked")
      .in("qr_code_id", qrIds)
      .limit(20000);
    const tally = new Map<string, { scans: number; clicks: number }>();
    for (const s of (scans ?? []) as Array<{
      qr_code_id: string;
      destination_clicked: boolean;
    }>) {
      const entry = tally.get(s.qr_code_id) ?? { scans: 0, clicks: 0 };
      entry.scans += 1;
      if (s.destination_clicked) entry.clicks += 1;
      tally.set(s.qr_code_id, entry);
    }
    return rows.map((r) => {
      const t = (r.qr_code_id && tally.get(r.qr_code_id)) || { scans: 0, clicks: 0 };
      return {
        placementKey: r.placement_key,
        placementName: r.placement_name,
        qrCodeId: r.qr_code_id,
        scans: t.scans,
        destinationClicks: t.clicks,
        conversionRate: t.scans ? Math.round((t.clicks / t.scans) * 100) : 0,
      };
    });
  });
