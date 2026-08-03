// Client-callable Print Store surface.
//
// The browser may choose a product, a quantity option, artwork and a shipping
// address. Prices, discounts, taxes, margins, order numbers and the payment
// environment are all resolved server-side.
import { createServerFn } from "@tanstack/react-start";
import { getRequest } from "@tanstack/react-start/server";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import type { PrintBundleDTO, PrintProductDTO } from "./print-catalogue";
import type { CartDTO } from "./print.server";
import type { PrintGate } from "./print-validation";
import type { PrintOrderStatus } from "./print-orders";
import type { StripeEnvName } from "./entitlements.server";
import { asJsonObject, type JsonObject, type JsonValue } from "./json";

/* -------------------------------------------------------------------------- */
/* Shared helpers                                                             */
/* -------------------------------------------------------------------------- */

async function serverEnvironment(): Promise<{ environment: StripeEnvName; host: string | null }> {
  const { resolvePaymentsEnvironment, requestHost } = await import("./payments-env.server");
  let host: string | null = null;
  try {
    host = requestHost(getRequest());
  } catch {
    host = null;
  }
  return { environment: resolvePaymentsEnvironment(host), host };
}

async function ctxFor(userId: string) {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { printAccountContext } = await import("./print.server");
  const { environment, host } = await serverEnvironment();
  const admin = supabaseAdmin as never as import("@supabase/supabase-js").SupabaseClient;
  const ctx = await printAccountContext(admin, userId, environment);
  return { admin, ctx, host };
}

/** Small slack so rounding never blocks an otherwise healthy order. */
const MARGIN_TOLERANCE_PERCENT = 2;

const trimmed = (value: unknown, max: number): string =>
  typeof value === "string" ? value.trim().slice(0, max) : "";

const uuid = (value: unknown, label: string): string => {
  const v = typeof value === "string" ? value.trim() : "";
  if (!/^[0-9a-f-]{36}$/i.test(v)) throw new Error(`Invalid ${label}.`);
  return v;
};

/* -------------------------------------------------------------------------- */
/* Catalogue                                                                  */
/* -------------------------------------------------------------------------- */

export interface PrintStoreCatalogue {
  products: PrintProductDTO[];
  bundles: PrintBundleDTO[];
  currency: string;
  region: string;
  countryCode: string;
  plan: string;
  /** Automatic plan discount applied at checkout, percent. */
  planDiscountPercent: number;
}

export const getPrintCatalogue = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<PrintStoreCatalogue> => {
    const { admin, ctx } = await ctxFor(context.userId);
    const { loadCatalogue, loadBundles } = await import("./print.server");
    const { DEFAULT_MARGIN_RULES } = await import("./print-pricing");
    const [products, bundles] = await Promise.all([
      loadCatalogue(admin, ctx.region),
      loadBundles(admin),
    ]);
    return {
      products,
      bundles,
      currency: ctx.currency,
      region: ctx.region,
      countryCode: ctx.countryCode,
      plan: ctx.plan,
      planDiscountPercent: DEFAULT_MARGIN_RULES.planDiscountPercent[ctx.plan] ?? 0,
    };
  });

/* -------------------------------------------------------------------------- */
/* Cart                                                                       */
/* -------------------------------------------------------------------------- */

export const getPrintCart = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<CartDTO> => {
    const { admin, ctx } = await ctxFor(context.userId);
    const { buildCartDTO } = await import("./print.server");
    return buildCartDTO(admin, ctx);
  });

export interface AddCartItemInput {
  productId: string;
  variantId: string;
  businessId: string;
  qrCodeId: string;
  campaign?: string;
  marketingPackId?: string;
  placementPlanId?: string;
  quantity?: number;
  design?: JsonObject;
  bundleId?: string;
  bundleGroup?: string;
}

export const addPrintCartItem = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: AddCartItemInput) => ({
    productId: uuid(data?.productId, "product"),
    variantId: uuid(data?.variantId, "quantity option"),
    businessId: uuid(data?.businessId, "business"),
    qrCodeId: uuid(data?.qrCodeId, "QR code"),
    campaign: trimmed(data?.campaign, 80) || undefined,
    marketingPackId: data?.marketingPackId ? uuid(data.marketingPackId, "pack") : undefined,
    placementPlanId: data?.placementPlanId ? uuid(data.placementPlanId, "plan") : undefined,
    quantity: Math.min(Math.max(Math.round(Number(data?.quantity ?? 1)) || 1, 1), 50),
    design: asJsonObject(data?.design),
    bundleId: data?.bundleId ? uuid(data.bundleId, "bundle") : undefined,
    bundleGroup: trimmed(data?.bundleGroup, 60) || undefined,
  }))
  .handler(async ({ data, context }): Promise<CartDTO> => {
    const { admin, ctx } = await ctxFor(context.userId);
    const {
      assertArtworkOwnership,
      loadVariantForProduct,
      getOrCreateCart,
      buildCartDTO,
      convertBaseMinor,
    } = await import("./print.server");
    const { shipsTo } = await import("./print-catalogue");

    await assertArtworkOwnership(admin, context.userId, data.businessId, data.qrCodeId);
    const { product, variant } = await loadVariantForProduct(admin, data.productId, data.variantId);

    const supported = (product.supported_countries as string[] | null) ?? ["*"];
    if (!shipsTo({ supportedCountries: supported }, ctx.countryCode)) {
      throw new Error("That product cannot be shipped to your country yet.");
    }

    const cart = await getOrCreateCart(admin, ctx);
    const { error } = await admin.from("print_cart_items").insert({
      cart_id: cart.id,
      owner_id: context.userId,
      product_id: data.productId,
      variant_id: data.variantId,
      bundle_id: data.bundleId ?? null,
      bundle_group: data.bundleGroup ?? null,
      business_id: data.businessId,
      qr_code_id: data.qrCodeId,
      marketing_pack_id: data.marketingPackId ?? null,
      placement_plan_id: data.placementPlanId ?? null,
      campaign: data.campaign ?? null,
      quantity: data.quantity,
      unit_retail_minor: convertBaseMinor(Number(variant.retail_price_minor ?? 0), ctx.region),
      unit_cost_minor: convertBaseMinor(Number(variant.fulfilment_cost_minor ?? 0), ctx.region),
      currency_code: ctx.currency,
      design: data.design,
      validation_status: "error",
    });
    if (error) throw new Error(error.message);

    return buildCartDTO(admin, ctx);
  });

export const addPrintBundleToCart = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { bundleId: string; businessId: string; qrCodeId: string }) => ({
    bundleId: uuid(data?.bundleId, "bundle"),
    businessId: uuid(data?.businessId, "business"),
    qrCodeId: uuid(data?.qrCodeId, "QR code"),
  }))
  .handler(async ({ data, context }): Promise<CartDTO> => {
    const { admin, ctx } = await ctxFor(context.userId);
    const { assertArtworkOwnership, getOrCreateCart, buildCartDTO, convertBaseMinor } =
      await import("./print.server");

    await assertArtworkOwnership(admin, context.userId, data.businessId, data.qrCodeId);

    const { data: bundle, error } = await admin
      .from("print_bundles")
      .select(
        "id, name, active, print_bundle_items(product_id, variant_id, quantity, print_products(active, supported_countries))",
      )
      .eq("id", data.bundleId)
      .eq("active", true)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!bundle) throw new Error("That bundle is not available.");

    const cart = await getOrCreateCart(admin, ctx);
    const group = crypto.randomUUID();
    const items = (bundle as Record<string, unknown>).print_bundle_items as Array<
      Record<string, unknown>
    >;

    for (const item of items) {
      const variantId = item.variant_id as string | null;
      if (!variantId) continue;
      const { data: variant } = await admin
        .from("print_product_variants")
        .select("retail_price_minor, fulfilment_cost_minor")
        .eq("id", variantId)
        .eq("active", true)
        .maybeSingle();
      if (!variant) continue;
      const v = variant as Record<string, unknown>;
      await admin.from("print_cart_items").insert({
        cart_id: cart.id,
        owner_id: context.userId,
        product_id: item.product_id as string,
        variant_id: variantId,
        bundle_id: data.bundleId,
        bundle_group: group,
        business_id: data.businessId,
        qr_code_id: data.qrCodeId,
        quantity: Number(item.quantity ?? 1),
        unit_retail_minor: convertBaseMinor(Number(v.retail_price_minor ?? 0), ctx.region),
        unit_cost_minor: convertBaseMinor(Number(v.fulfilment_cost_minor ?? 0), ctx.region),
        currency_code: ctx.currency,
        validation_status: "error",
      });
    }

    return buildCartDTO(admin, ctx);
  });

export const updatePrintCartItem = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { itemId: string; quantity: number }) => ({
    itemId: uuid(data?.itemId, "cart item"),
    quantity: Math.min(Math.max(Math.round(Number(data?.quantity ?? 1)) || 1, 1), 50),
  }))
  .handler(async ({ data, context }): Promise<CartDTO> => {
    const { admin, ctx } = await ctxFor(context.userId);
    const { buildCartDTO } = await import("./print.server");
    const { error } = await admin
      .from("print_cart_items")
      .update({ quantity: data.quantity })
      .eq("id", data.itemId)
      .eq("owner_id", context.userId);
    if (error) throw new Error(error.message);
    return buildCartDTO(admin, ctx);
  });

export const removePrintCartItem = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { itemId: string }) => ({ itemId: uuid(data?.itemId, "cart item") }))
  .handler(async ({ data, context }): Promise<CartDTO> => {
    const { admin, ctx } = await ctxFor(context.userId);
    const { buildCartDTO } = await import("./print.server");
    await admin
      .from("print_cart_items")
      .delete()
      .eq("id", data.itemId)
      .eq("owner_id", context.userId);
    return buildCartDTO(admin, ctx);
  });

/* -------------------------------------------------------------------------- */
/* Proofs                                                                     */
/* -------------------------------------------------------------------------- */

export interface ProofResult {
  proofId: string;
  version: number;
  status: "pass" | "warning" | "error";
  gates: PrintGate[];
  approved: boolean;
}

/**
 * Generate (or regenerate) the proof for a cart item. Gates are recomputed on
 * the server from the catalogue specification and the account's own QR record;
 * artwork metrics are supplied by the renderer.
 */
export const generatePrintProof = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    (data: {
      itemId: string;
      frontSvg?: string;
      backSvg?: string;
      qrSizeMm: number;
      artworkBleedMm: number;
      imageDpi?: number | null;
      validation?: unknown[];
      warningsAcknowledged?: boolean;
      design?: JsonObject;
    }) => ({
      itemId: uuid(data?.itemId, "cart item"),
      frontSvg: typeof data?.frontSvg === "string" ? data.frontSvg.slice(0, 900_000) : null,
      backSvg: typeof data?.backSvg === "string" ? data.backSvg.slice(0, 900_000) : null,
      qrSizeMm: Number(data?.qrSizeMm ?? 0),
      artworkBleedMm: Number(data?.artworkBleedMm ?? 0),
      imageDpi: data?.imageDpi == null ? null : Number(data.imageDpi),
      validation: Array.isArray(data?.validation) ? data.validation.slice(0, 200) : [],
      warningsAcknowledged: data?.warningsAcknowledged === true,
      design: asJsonObject(data?.design),
    }),
  )
  .handler(async ({ data, context }): Promise<ProofResult> => {
    const { admin } = await ctxFor(context.userId);
    const { printOrderGates, evaluatePrintGates, buildValidationSnapshot } =
      await import("./print-validation");
    const { resolveQrDestination } = await import("./resolve-qr-destination");

    const { data: item, error } = await admin
      .from("print_cart_items")
      .select("*, print_products(*), qr_codes(*), businesses(*)")
      .eq("id", data.itemId)
      .eq("owner_id", context.userId)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!item) throw new Error("That cart item no longer exists.");

    const row = item as Record<string, unknown>;
    const product = row.print_products as Record<string, unknown>;
    const qr = row.qr_codes as Record<string, unknown>;
    const business = row.businesses as Record<string, unknown>;

    const destination = resolveQrDestination({
      destinationType: (qr.destination_type as string) ?? "google_review",
      destinationUrl: (qr.destination_url as string | null) ?? null,
      businessGoogleReviewUrl: (business.google_review_url as string | null) ?? null,
    });

    const gates = printOrderGates({
      product: {
        minQrMm: Number(product.min_qr_mm ?? 25),
        bleedMm: Number(product.bleed_mm ?? 3),
        safeAreaMm: Number(product.safe_area_mm ?? 4),
        widthMm: Number(product.width_mm ?? 0),
        heightMm: Number(product.height_mm ?? 0),
      },
      validation: (data.validation ?? []) as never[],
      qr: {
        shortCode: (qr.short_code as string) ?? null,
        destinationUrl: destination.url,
        destinationOk: destination.url ? true : false,
      },
      qrSizeMm: data.qrSizeMm,
      artworkBleedMm: data.artworkBleedMm,
      imageDpi: data.imageDpi,
    });
    const verdict = evaluatePrintGates(gates, data.warningsAcknowledged);
    const snapshot = buildValidationSnapshot(
      gates,
      (data.validation ?? []) as never[],
      data.warningsAcknowledged,
    );

    // Supersede any earlier proof for this item — approval must be re-taken
    // whenever the artwork changes.
    await admin
      .from("print_proofs")
      .update({ status: "superseded" })
      .eq("cart_item_id", data.itemId)
      .eq("owner_id", context.userId)
      .neq("status", "superseded");

    const version = Number(row.artwork_version ?? 1) + 1;
    const { data: proof, error: proofError } = await admin
      .from("print_proofs")
      .insert({
        owner_id: context.userId,
        cart_item_id: data.itemId,
        product_id: row.product_id as string,
        business_id: row.business_id as string,
        qr_code_id: row.qr_code_id as string,
        version,
        status: "draft",
        front_svg: data.frontSvg,
        back_svg: data.backSvg,
        design_snapshot: data.design,
        validation_snapshot: snapshot,
        qr_destination: destination.url,
        qr_short_url: (qr.short_code as string) ?? null,
      })
      .select("id")
      .single();
    if (proofError) throw new Error(proofError.message);

    await admin
      .from("print_cart_items")
      .update({
        proof_id: (proof as Record<string, unknown>).id as string,
        artwork_version: version,
        validation_snapshot: snapshot,
        validation_status: verdict.status,
        warnings_acknowledged: data.warningsAcknowledged,
        approved_at: null,
        design: data.design,
      })
      .eq("id", data.itemId);

    return {
      proofId: (proof as Record<string, unknown>).id as string,
      version,
      status: verdict.status,
      gates,
      approved: false,
    };
  });

export const approvePrintProof = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { proofId: string; statement?: string }) => ({
    proofId: uuid(data?.proofId, "proof"),
    statement: trimmed(data?.statement, 400),
  }))
  .handler(async ({ data, context }): Promise<CartDTO> => {
    const { admin, ctx } = await ctxFor(context.userId);
    const { buildCartDTO } = await import("./print.server");
    const { evaluatePrintGates } = await import("./print-validation");

    const { data: proof, error } = await admin
      .from("print_proofs")
      .select("*")
      .eq("id", data.proofId)
      .eq("owner_id", context.userId)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!proof) throw new Error("That proof could not be found.");

    const row = proof as Record<string, unknown>;
    if (row.status === "superseded") {
      throw new Error("The artwork changed after this proof. Generate a new proof to approve.");
    }
    const snapshot = (row.validation_snapshot ?? {}) as {
      gates?: PrintGate[];
      warningsAcknowledged?: boolean;
    };
    const verdict = evaluatePrintGates(
      snapshot.gates ?? [],
      snapshot.warningsAcknowledged === true,
    );
    if (!verdict.ok) {
      throw new Error("This artwork still has unresolved print problems and cannot be approved.");
    }

    const approvedAt = new Date().toISOString();
    await admin
      .from("print_proofs")
      .update({
        status: "approved",
        approval_statement:
          data.statement ||
          "I confirm the artwork, spelling, QR destination and finished size are correct.",
        approved_at: approvedAt,
        approved_by: context.userId,
      })
      .eq("id", data.proofId);

    if (row.cart_item_id) {
      await admin
        .from("print_cart_items")
        .update({ approved_at: approvedAt })
        .eq("id", row.cart_item_id as string)
        .eq("owner_id", context.userId);
    }

    return buildCartDTO(admin, ctx);
  });

/* -------------------------------------------------------------------------- */
/* Checkout                                                                   */
/* -------------------------------------------------------------------------- */

export interface PrintCheckoutInput {
  shippingName: string;
  contactEmail: string;
  line1: string;
  line2?: string;
  city: string;
  region?: string;
  postalCode: string;
}

export interface PrintCheckoutResult {
  clientSecret?: string;
  orderId?: string;
  orderNumber?: string;
  error?: string;
}

export const createPrintOrderCheckout = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: PrintCheckoutInput) => {
    const required = (value: unknown, label: string, max = 120) => {
      const v = trimmed(value, max);
      if (!v) throw new Error(`${label} is required.`);
      return v;
    };
    const email = required(data?.contactEmail, "Email", 200);
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) throw new Error("Enter a valid email address.");
    return {
      shippingName: required(data?.shippingName, "Name"),
      contactEmail: email,
      line1: required(data?.line1, "Address"),
      line2: trimmed(data?.line2, 120),
      city: required(data?.city, "City"),
      region: trimmed(data?.region, 120),
      postalCode: required(data?.postalCode, "Postcode", 20),
    };
  })
  .handler(async ({ data, context }): Promise<PrintCheckoutResult> => {
    const { admin, ctx, host } = await ctxFor(context.userId);
    const { getOrCreateCart, cartTotalsInternal, recordOrderEvent } = await import("./print.server");
    const { DEFAULT_MARGIN_RULES } = await import("./print-pricing");
    const { createStripeClient, getStripeErrorMessage, automaticTaxEnabled } =
      await import("./stripe.server");
    const { getOrCreateStripeCustomer } = await import("./stripe-customer.server");
    const { buildReturnUrl } = await import("./payments-env.server");

    const cart = await getOrCreateCart(admin, ctx);
    const { rows, totals } = await cartTotalsInternal(admin, cart.id, ctx);
    if (!rows.length) return { error: "Your cart is empty." };

    // Every line must carry an approved, current proof.
    for (const row of rows) {
      const r = row as Record<string, unknown>;
      if (!r.approved_at || !r.proof_id) {
        return { error: "Every item needs an approved proof before payment." };
      }
      if (r.validation_status === "error") {
        return { error: "One or more items still have artwork problems." };
      }
    }

    // Margin floor guard — never sell below the configured minimum.
    if (
      totals.estimatedMarginPercent <
      DEFAULT_MARGIN_RULES.minMarginPercent - MARGIN_TOLERANCE_PERCENT
    ) {
      return { error: "This order cannot be priced right now. Please contact support." };
    }

    const { data: numberRow, error: numberError } = await admin.rpc("next_print_order_number");
    if (numberError) return { error: numberError.message };
    const orderNumber = String(numberRow);

    const { data: order, error: orderError } = await admin
      .from("print_orders")
      .insert({
        owner_id: context.userId,
        order_number: orderNumber,
        status: "ready_for_payment",
        environment: ctx.environment,
        currency_code: ctx.currency,
        pricing_region: ctx.region,
        plan_key: ctx.plan,
        discount_percent: totals.discountPercent,
        subtotal_minor: totals.subtotalMinor,
        discount_minor: totals.discountMinor,
        shipping_minor: totals.shippingMinor,
        tax_minor: totals.taxMinor,
        total_minor: totals.totalMinor,
        estimated_cost_minor: totals.estimatedCostMinor,
        estimated_margin_minor: totals.estimatedMarginMinor,
        contact_email: data.contactEmail,
        shipping_name: data.shippingName,
        shipping_address: {
          line1: data.line1,
          line2: data.line2 || null,
          city: data.city,
          region: data.region || null,
          postalCode: data.postalCode,
          countryCode: ctx.countryCode,
        },
        provider_key: "manual",
      })
      .select("id")
      .single();
    if (orderError) return { error: orderError.message };
    const orderId = (order as Record<string, unknown>).id as string;

    for (const row of rows) {
      const r = row as Record<string, unknown>;
      const product = (r.print_products ?? {}) as Record<string, unknown>;
      const quantity = Number(r.quantity ?? 1);
      const unit = Number(r.unit_retail_minor ?? 0);
      const { data: orderItem } = await admin
        .from("print_order_items")
        .insert({
          order_id: orderId,
          owner_id: context.userId,
          product_id: r.product_id as string,
          variant_id: r.variant_id as string,
          bundle_id: (r.bundle_id as string | null) ?? null,
          business_id: r.business_id as string,
          qr_code_id: r.qr_code_id as string,
          proof_id: (r.proof_id as string | null) ?? null,
          product_name: String(product.name ?? ""),
          variant_label: String(
            (r.print_product_variants as Record<string, unknown> | null)?.label ?? "",
          ),
          quantity,
          unit_retail_minor: unit,
          unit_cost_minor: Number(r.unit_cost_minor ?? 0),
          line_total_minor: unit * quantity,
          design: asJsonObject(r.design),
          artwork_version: Number(r.artwork_version ?? 1),
          validation_snapshot: (r.validation_snapshot ?? []) as JsonValue,
        })
        .select("id")
        .single();
      if (orderItem && r.proof_id) {
        await admin
          .from("print_proofs")
          .update({ order_item_id: (orderItem as Record<string, unknown>).id as string })
          .eq("id", r.proof_id as string);
      }
    }

    try {
      const stripe = createStripeClient(ctx.environment);
      const customerId = await getOrCreateStripeCustomer({
        stripe,
        admin: admin as never,
        supabase: context.supabase,
        ownerId: context.userId,
        environment: ctx.environment,
        countryCode: ctx.countryCode,
        pricingRegion: ctx.region,
      });

      const session = await stripe.checkout.sessions.create({
        mode: "payment",
        ui_mode: "embedded_page",
        customer: customerId,
        return_url: buildReturnUrl("/print-store/orders", host, {
          checkout: "complete",
          session_id: "{CHECKOUT_SESSION_ID}",
        }),
        line_items: [
          {
            quantity: 1,
            price_data: {
              currency: ctx.currency.toLowerCase(),
              unit_amount: totals.totalMinor,
              product_data: {
                name: `Print order ${orderNumber}`,
                description: `${rows.length} printed item(s), shipped to ${ctx.countryCode}.`,
              },
            },
          },
        ],
        billing_address_collection: "required",
        ...(automaticTaxEnabled() ? { automatic_tax: { enabled: true } } : {}),
        metadata: {
          purpose: "print_order",
          print_order_id: orderId,
          order_number: orderNumber,
          owner_id: context.userId,
        },
        payment_intent_data: {
          metadata: {
            purpose: "print_order",
            print_order_id: orderId,
            owner_id: context.userId,
          },
        },
      });

      await admin
        .from("print_orders")
        .update({
          stripe_checkout_session_id: session.id,
          stripe_customer_id: customerId,
        })
        .eq("id", orderId);

      await recordOrderEvent(admin, {
        orderId,
        ownerId: context.userId,
        eventType: "checkout_started",
        newStatus: "ready_for_payment",
        note: "Checkout opened.",
      });

      return {
        clientSecret: session.client_secret ?? undefined,
        orderId,
        orderNumber,
      };
    } catch (e) {
      await admin
        .from("print_orders")
        .update({ status: "canceled", canceled_at: new Date().toISOString() })
        .eq("id", orderId);
      return { error: getStripeErrorMessage(e) };
    }
  });

/* -------------------------------------------------------------------------- */
/* Orders (customer)                                                          */
/* -------------------------------------------------------------------------- */

export interface PrintOrderSummary {
  id: string;
  orderNumber: string;
  status: PrintOrderStatus;
  currency: string;
  totalMinor: number;
  createdAt: string;
  paidAt: string | null;
  trackingCarrier: string | null;
  trackingNumber: string | null;
  trackingUrl: string | null;
  estimatedDeliveryDate: string | null;
  itemCount: number;
}

export const listMyPrintOrders = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<PrintOrderSummary[]> => {
    const { admin } = await ctxFor(context.userId);
    const { data, error } = await admin
      .from("print_orders")
      .select("*, print_order_items(id)")
      .eq("owner_id", context.userId)
      .neq("status", "draft")
      .order("created_at", { ascending: false });
    if (error) throw new Error(error.message);
    return ((data as Array<Record<string, unknown>> | null) ?? []).map((row) => ({
      id: row.id as string,
      orderNumber: row.order_number as string,
      status: row.status as PrintOrderStatus,
      currency: (row.currency_code as string) ?? "NZD",
      totalMinor: Number(row.total_minor ?? 0),
      createdAt: row.created_at as string,
      paidAt: (row.paid_at as string | null) ?? null,
      trackingCarrier: (row.tracking_carrier as string | null) ?? null,
      trackingNumber: (row.tracking_number as string | null) ?? null,
      trackingUrl: (row.tracking_url as string | null) ?? null,
      estimatedDeliveryDate: (row.estimated_delivery_date as string | null) ?? null,
      itemCount: ((row.print_order_items as unknown[] | null) ?? []).length,
    }));
  });

export interface PrintOrderDetail extends PrintOrderSummary {
  subtotalMinor: number;
  discountMinor: number;
  shippingMinor: number;
  taxMinor: number;
  shippingName: string | null;
  shippingAddress: JsonObject;
  items: Array<{
    id: string;
    productName: string;
    variantLabel: string;
    quantity: number;
    lineTotalMinor: number;
    proofId: string | null;
  }>;
  timeline: Array<{
    id: string;
    eventType: string;
    newStatus: string | null;
    note: string | null;
    createdAt: string;
  }>;
}

export const getMyPrintOrder = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { orderId: string }) => ({ orderId: uuid(data?.orderId, "order") }))
  .handler(async ({ data, context }): Promise<PrintOrderDetail> => {
    const { admin } = await ctxFor(context.userId);
    const { data: order, error } = await admin
      .from("print_orders")
      .select("*, print_order_items(*)")
      .eq("id", data.orderId)
      .eq("owner_id", context.userId)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!order) throw new Error("Order not found.");

    const { data: events } = await admin
      .from("print_order_events")
      .select("id, event_type, new_status, note, created_at")
      .eq("order_id", data.orderId)
      .eq("visibility", "customer")
      .order("created_at", { ascending: true });

    const row = order as Record<string, unknown>;
    const items = ((row.print_order_items as Array<Record<string, unknown>> | null) ?? []).map(
      (item) => ({
        id: item.id as string,
        productName: (item.product_name as string) ?? "",
        variantLabel: (item.variant_label as string) ?? "",
        quantity: Number(item.quantity ?? 1),
        lineTotalMinor: Number(item.line_total_minor ?? 0),
        proofId: (item.proof_id as string | null) ?? null,
      }),
    );

    return {
      id: row.id as string,
      orderNumber: row.order_number as string,
      status: row.status as PrintOrderStatus,
      currency: (row.currency_code as string) ?? "NZD",
      totalMinor: Number(row.total_minor ?? 0),
      subtotalMinor: Number(row.subtotal_minor ?? 0),
      discountMinor: Number(row.discount_minor ?? 0),
      shippingMinor: Number(row.shipping_minor ?? 0),
      taxMinor: Number(row.tax_minor ?? 0),
      createdAt: row.created_at as string,
      paidAt: (row.paid_at as string | null) ?? null,
      trackingCarrier: (row.tracking_carrier as string | null) ?? null,
      trackingNumber: (row.tracking_number as string | null) ?? null,
      trackingUrl: (row.tracking_url as string | null) ?? null,
      estimatedDeliveryDate: (row.estimated_delivery_date as string | null) ?? null,
      itemCount: items.length,
      shippingName: (row.shipping_name as string | null) ?? null,
      shippingAddress: asJsonObject(row.shipping_address),
      items,
      timeline: ((events as Array<Record<string, unknown>> | null) ?? []).map((e) => ({
        id: e.id as string,
        eventType: e.event_type as string,
        newStatus: (e.new_status as string | null) ?? null,
        note: (e.note as string | null) ?? null,
        createdAt: e.created_at as string,
      })),
    };
  });
