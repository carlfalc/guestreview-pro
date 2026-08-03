// Admin-only print fulfilment surface. Every function re-verifies the admin
// role through the caller's own session before touching privileged data.
import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { canTransition, type PrintOrderStatus } from "./print-orders";
import type { JsonObject } from "./json";
import { asJsonObject } from "./json";

type Row = Record<string, unknown>;

async function requireAdmin(context: {
  userId: string;
  supabase: { rpc: (fn: string, args: Record<string, unknown>) => Promise<{ data: unknown }> };
}) {
  const { data } = await context.supabase.rpc("has_role", {
    _user_id: context.userId,
    _role: "admin",
  });
  if (data !== true) throw new Error("Forbidden");
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  return supabaseAdmin as never as import("@supabase/supabase-js").SupabaseClient;
}

const uuid = (value: unknown, label: string): string => {
  const v = typeof value === "string" ? value.trim() : "";
  if (!/^[0-9a-f-]{36}$/i.test(v)) throw new Error(`Invalid ${label}.`);
  return v;
};
const text = (value: unknown, max: number) =>
  typeof value === "string" ? value.trim().slice(0, max) : "";

/* -------------------------------------------------------------------------- */
/* Queue                                                                      */
/* -------------------------------------------------------------------------- */

export interface AdminPrintOrderRow {
  id: string;
  orderNumber: string;
  status: PrintOrderStatus;
  currency: string;
  totalMinor: number;
  costMinor: number;
  marginMinor: number;
  marginPercent: number;
  ownerEmail: string | null;
  shippingName: string | null;
  countryCode: string;
  itemCount: number;
  createdAt: string;
  paidAt: string | null;
  printerName: string | null;
  trackingNumber: string | null;
}

export const listPrintOrdersAdmin = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { status?: string }) => ({
    status: text(data?.status, 40) || null,
  }))
  .handler(async ({ data, context }): Promise<AdminPrintOrderRow[]> => {
    const admin = await requireAdmin(context as never);
    let query = admin
      .from("print_orders")
      .select("*, print_order_items(id), profiles:owner_id(email)")
      .neq("status", "draft")
      .order("created_at", { ascending: false })
      .limit(300);
    if (data.status) query = query.eq("status", data.status);
    const { data: rows, error } = await query;
    if (error) throw new Error(error.message);

    return ((rows as Row[] | null) ?? []).map((row) => {
      const total = Number(row.total_minor ?? 0);
      const cost =
        Number(row.supplier_cost_minor ?? row.estimated_cost_minor ?? 0) +
        Number(row.supplier_shipping_minor ?? 0);
      const margin = total - cost;
      const address = asJsonObject(row.shipping_address);
      return {
        id: row.id as string,
        orderNumber: row.order_number as string,
        status: row.status as PrintOrderStatus,
        currency: (row.currency_code as string) ?? "NZD",
        totalMinor: total,
        costMinor: cost,
        marginMinor: margin,
        marginPercent: total > 0 ? Math.round((margin / total) * 1000) / 10 : 0,
        ownerEmail: ((row.profiles as Row | null)?.email as string) ?? null,
        shippingName: (row.shipping_name as string | null) ?? null,
        countryCode: (address.countryCode as string) ?? "",
        itemCount: ((row.print_order_items as unknown[] | null) ?? []).length,
        createdAt: row.created_at as string,
        paidAt: (row.paid_at as string | null) ?? null,
        printerName: (row.printer_name as string | null) ?? null,
        trackingNumber: (row.tracking_number as string | null) ?? null,
      };
    });
  });

export interface AdminPrintOrderDetail extends AdminPrintOrderRow {
  shippingAddress: JsonObject;
  contactEmail: string | null;
  internalNotes: string | null;
  supplierCostMinor: number | null;
  supplierShippingMinor: number | null;
  trackingCarrier: string | null;
  trackingUrl: string | null;
  failureReason: string | null;
  items: Array<{
    id: string;
    productName: string;
    variantLabel: string;
    quantity: number;
    lineTotalMinor: number;
    unitCostMinor: number;
    proofId: string | null;
    businessId: string | null;
    qrCodeId: string | null;
  }>;
  events: Array<{
    id: string;
    eventType: string;
    previousStatus: string | null;
    newStatus: string | null;
    note: string | null;
    visibility: string;
    createdAt: string;
  }>;
}

export const getPrintOrderAdmin = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { orderId: string }) => ({ orderId: uuid(data?.orderId, "order") }))
  .handler(async ({ data, context }): Promise<AdminPrintOrderDetail> => {
    const admin = await requireAdmin(context as never);
    const { data: order, error } = await admin
      .from("print_orders")
      .select("*, print_order_items(*), profiles:owner_id(email)")
      .eq("id", data.orderId)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!order) throw new Error("Order not found.");
    const row = order as Row;

    const { data: events } = await admin
      .from("print_order_events")
      .select("*")
      .eq("order_id", data.orderId)
      .order("created_at", { ascending: true });

    const total = Number(row.total_minor ?? 0);
    const cost =
      Number(row.supplier_cost_minor ?? row.estimated_cost_minor ?? 0) +
      Number(row.supplier_shipping_minor ?? 0);
    const margin = total - cost;
    const address = asJsonObject(row.shipping_address);

    return {
      id: row.id as string,
      orderNumber: row.order_number as string,
      status: row.status as PrintOrderStatus,
      currency: (row.currency_code as string) ?? "NZD",
      totalMinor: total,
      costMinor: cost,
      marginMinor: margin,
      marginPercent: total > 0 ? Math.round((margin / total) * 1000) / 10 : 0,
      ownerEmail: ((row.profiles as Row | null)?.email as string) ?? null,
      shippingName: (row.shipping_name as string | null) ?? null,
      countryCode: (address.countryCode as string) ?? "",
      itemCount: ((row.print_order_items as unknown[] | null) ?? []).length,
      createdAt: row.created_at as string,
      paidAt: (row.paid_at as string | null) ?? null,
      printerName: (row.printer_name as string | null) ?? null,
      trackingNumber: (row.tracking_number as string | null) ?? null,
      shippingAddress: address,
      contactEmail: (row.contact_email as string | null) ?? null,
      internalNotes: (row.internal_notes as string | null) ?? null,
      supplierCostMinor: (row.supplier_cost_minor as number | null) ?? null,
      supplierShippingMinor: (row.supplier_shipping_minor as number | null) ?? null,
      trackingCarrier: (row.tracking_carrier as string | null) ?? null,
      trackingUrl: (row.tracking_url as string | null) ?? null,
      failureReason: (row.failure_reason as string | null) ?? null,
      items: ((row.print_order_items as Row[] | null) ?? []).map((item) => ({
        id: item.id as string,
        productName: (item.product_name as string) ?? "",
        variantLabel: (item.variant_label as string) ?? "",
        quantity: Number(item.quantity ?? 1),
        lineTotalMinor: Number(item.line_total_minor ?? 0),
        unitCostMinor: Number(item.unit_cost_minor ?? 0),
        proofId: (item.proof_id as string | null) ?? null,
        businessId: (item.business_id as string | null) ?? null,
        qrCodeId: (item.qr_code_id as string | null) ?? null,
      })),
      events: ((events as Row[] | null) ?? []).map((e) => ({
        id: e.id as string,
        eventType: e.event_type as string,
        previousStatus: (e.previous_status as string | null) ?? null,
        newStatus: (e.new_status as string | null) ?? null,
        note: (e.note as string | null) ?? null,
        visibility: (e.visibility as string) ?? "customer",
        createdAt: e.created_at as string,
      })),
    };
  });

/* -------------------------------------------------------------------------- */
/* Fulfilment actions                                                         */
/* -------------------------------------------------------------------------- */

export const updatePrintOrderStatus = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    (data: {
      orderId: string;
      status: PrintOrderStatus;
      note?: string;
      printerName?: string;
      supplierCostMinor?: number;
      supplierShippingMinor?: number;
      trackingCarrier?: string;
      trackingNumber?: string;
      trackingUrl?: string;
      estimatedShipDate?: string;
      estimatedDeliveryDate?: string;
      failureReason?: string;
    }) => ({
      orderId: uuid(data?.orderId, "order"),
      status: text(data?.status, 40) as PrintOrderStatus,
      note: text(data?.note, 500),
      printerName: text(data?.printerName, 120),
      supplierCostMinor:
        data?.supplierCostMinor == null ? null : Math.max(0, Math.round(data.supplierCostMinor)),
      supplierShippingMinor:
        data?.supplierShippingMinor == null
          ? null
          : Math.max(0, Math.round(data.supplierShippingMinor)),
      trackingCarrier: text(data?.trackingCarrier, 80),
      trackingNumber: text(data?.trackingNumber, 120),
      trackingUrl: text(data?.trackingUrl, 400),
      estimatedShipDate: text(data?.estimatedShipDate, 10),
      estimatedDeliveryDate: text(data?.estimatedDeliveryDate, 10),
      failureReason: text(data?.failureReason, 400),
    }),
  )
  .handler(async ({ data, context }): Promise<{ ok: true; status: PrintOrderStatus }> => {
    const admin = await requireAdmin(context as never);
    const { data: existing, error } = await admin
      .from("print_orders")
      .select("*")
      .eq("id", data.orderId)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!existing) throw new Error("Order not found.");
    const order = existing as Row;
    const from = order.status as PrintOrderStatus;

    if (!canTransition(from, data.status)) {
      throw new Error(`An order cannot move from ${from} to ${data.status}.`);
    }
    if (data.trackingUrl && !/^https:\/\//i.test(data.trackingUrl)) {
      throw new Error("Tracking links must be https.");
    }

    const now = new Date().toISOString();
    const patch: Record<string, unknown> = { status: data.status };
    if (data.printerName) patch.printer_name = data.printerName;
    if (data.supplierCostMinor != null) patch.supplier_cost_minor = data.supplierCostMinor;
    if (data.supplierShippingMinor != null)
      patch.supplier_shipping_minor = data.supplierShippingMinor;
    if (data.trackingCarrier) patch.tracking_carrier = data.trackingCarrier;
    if (data.trackingNumber) patch.tracking_number = data.trackingNumber;
    if (data.trackingUrl) patch.tracking_url = data.trackingUrl;
    if (data.estimatedShipDate) patch.estimated_ship_date = data.estimatedShipDate;
    if (data.estimatedDeliveryDate) patch.estimated_delivery_date = data.estimatedDeliveryDate;
    if (data.failureReason) patch.failure_reason = data.failureReason;
    if (data.status === "submitted_to_printer") patch.submitted_at = now;
    if (data.status === "shipped") patch.shipped_at = now;
    if (data.status === "delivered") patch.delivered_at = now;
    if (data.status === "canceled") patch.canceled_at = now;

    const { error: updateError } = await admin
      .from("print_orders")
      .update(patch)
      .eq("id", data.orderId);
    if (updateError) throw new Error(updateError.message);

    await admin.from("print_order_events").insert({
      order_id: data.orderId,
      owner_id: order.owner_id as string,
      event_type: "status_changed",
      previous_status: from,
      new_status: data.status,
      note: data.note || null,
      visibility: "customer",
      actor_id: context.userId,
    });

    const { afterPrintStatusChange } = await import("./print-webhook.server");
    await afterPrintStatusChange(admin, { ...order, ...patch }, data.status);

    return { ok: true, status: data.status };
  });

export const addPrintOrderNote = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { orderId: string; note: string; visibility?: "customer" | "internal" }) => ({
    orderId: uuid(data?.orderId, "order"),
    note: text(data?.note, 1000),
    visibility: data?.visibility === "customer" ? ("customer" as const) : ("internal" as const),
  }))
  .handler(async ({ data, context }): Promise<{ ok: true }> => {
    const admin = await requireAdmin(context as never);
    if (!data.note) throw new Error("A note is required.");
    const { data: order } = await admin
      .from("print_orders")
      .select("owner_id, status")
      .eq("id", data.orderId)
      .maybeSingle();
    if (!order) throw new Error("Order not found.");
    await admin.from("print_order_events").insert({
      order_id: data.orderId,
      owner_id: (order as Row).owner_id as string,
      event_type: "note",
      new_status: (order as Row).status as string,
      note: data.note,
      visibility: data.visibility,
      actor_id: context.userId,
    });
    return { ok: true };
  });

/** Artwork bundle for manual fulfilment — approved proofs only. */
export const getPrintOrderArtwork = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { orderId: string }) => ({ orderId: uuid(data?.orderId, "order") }))
  .handler(async ({ data, context }) => {
    const admin = await requireAdmin(context as never);
    const { data: proofs, error } = await admin
      .from("print_proofs")
      .select(
        "id, version, front_svg, back_svg, qr_destination, approved_at, approval_statement, print_products(name, width_mm, height_mm, bleed_mm, artwork_format), order_item_id",
      )
      .in(
        "order_item_id",
        (
          ((
            await admin.from("print_order_items").select("id").eq("order_id", data.orderId)
          ).data as Row[] | null) ?? []
        ).map((r) => r.id as string),
      );
    if (error) throw new Error(error.message);
    return ((proofs as Row[] | null) ?? []).map((p) => {
      const product = (p.print_products as Row | null) ?? {};
      return {
        proofId: p.id as string,
        version: Number(p.version ?? 1),
        productName: (product.name as string) ?? "",
        widthMm: Number(product.width_mm ?? 0),
        heightMm: Number(product.height_mm ?? 0),
        bleedMm: Number(product.bleed_mm ?? 0),
        artworkFormat: (product.artwork_format as string) ?? "pdf",
        frontSvg: (p.front_svg as string | null) ?? null,
        backSvg: (p.back_svg as string | null) ?? null,
        qrDestination: (p.qr_destination as string | null) ?? null,
        approvedAt: (p.approved_at as string | null) ?? null,
        approvalStatement: (p.approval_statement as string | null) ?? null,
      };
    });
  });

/* -------------------------------------------------------------------------- */
/* Catalogue + margin health                                                  */
/* -------------------------------------------------------------------------- */

export const getPrintAdminOverview = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const admin = await requireAdmin(context as never);
    const since = new Date(Date.now() - 30 * 86400000).toISOString();

    const [{ data: orders }, { data: carts }] = await Promise.all([
      admin.from("print_orders").select("status, total_minor, estimated_cost_minor, currency_code, created_at, paid_at"),
      admin.from("print_cart_items").select("id").limit(1000),
    ]);

    const rows = (orders as Row[] | null) ?? [];
    const paid = rows.filter((r) => r.paid_at);
    const recent = paid.filter((r) => (r.paid_at as string) >= since);
    const revenue = recent.reduce((s, r) => s + Number(r.total_minor ?? 0), 0);
    const cost = recent.reduce((s, r) => s + Number(r.estimated_cost_minor ?? 0), 0);

    const byStatus: Record<string, number> = {};
    for (const r of rows) {
      const key = (r.status as string) ?? "unknown";
      byStatus[key] = (byStatus[key] ?? 0) + 1;
    }

    return {
      totalOrders: rows.length,
      paidOrders: paid.length,
      last30Orders: recent.length,
      last30RevenueMinor: revenue,
      last30CostMinor: cost,
      last30MarginMinor: revenue - cost,
      last30MarginPercent: revenue > 0 ? Math.round(((revenue - cost) / revenue) * 1000) / 10 : 0,
      openCartItems: ((carts as Row[] | null) ?? []).length,
      byStatus,
    };
  });

export const listPrintCatalogueAdmin = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const admin = await requireAdmin(context as never);
    const { loadAdminCatalogue } = await import("./print.server");
    return loadAdminCatalogue(admin, "NZ");
  });

export const setPrintProductActive = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { productId: string; active: boolean }) => ({
    productId: uuid(data?.productId, "product"),
    active: data?.active === true,
  }))
  .handler(async ({ data, context }): Promise<{ ok: true }> => {
    const admin = await requireAdmin(context as never);
    const { error } = await admin
      .from("print_products")
      .update({ active: data.active })
      .eq("id", data.productId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

/**
 * Update a variant's supplier cost or retail price. The margin floor is
 * enforced here so an admin cannot accidentally publish a loss-making price.
 */
export const updatePrintVariantPricing = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    (data: { variantId: string; retailPriceMinor: number; fulfilmentCostMinor: number }) => ({
      variantId: uuid(data?.variantId, "variant"),
      retailPriceMinor: Math.max(0, Math.round(Number(data?.retailPriceMinor ?? 0))),
      fulfilmentCostMinor: Math.max(0, Math.round(Number(data?.fulfilmentCostMinor ?? 0))),
    }),
  )
  .handler(async ({ data, context }): Promise<{ ok: true; marginPercent: number }> => {
    const admin = await requireAdmin(context as never);
    const { canPublish, marginFor, suggestedRetailMinor } = await import("./print-pricing");
    const verdict = canPublish(data.retailPriceMinor, data.fulfilmentCostMinor);
    if (!verdict.ok) {
      const suggested = suggestedRetailMinor(data.fulfilmentCostMinor);
      throw new Error(
        `That price is below the minimum margin. Suggested retail: ${(suggested / 100).toFixed(2)}.`,
      );
    }
    const { error } = await admin
      .from("print_product_variants")
      .update({
        retail_price_minor: data.retailPriceMinor,
        fulfilment_cost_minor: data.fulfilmentCostMinor,
      })
      .eq("id", data.variantId);
    if (error) throw new Error(error.message);
    return { ok: true, marginPercent: marginFor(data.retailPriceMinor, data.fulfilmentCostMinor).marginPercent };
  });
