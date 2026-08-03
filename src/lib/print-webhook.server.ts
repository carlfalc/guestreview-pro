// Print order lifecycle handlers driven by verified Stripe events.
// Called only from the signature-verified payments webhook.
import type { SupabaseClient } from "@supabase/supabase-js";
import { STATUS_EMAIL, STATUS_EVENT, type PrintOrderStatus } from "./print-orders";

type Db = SupabaseClient;
type Row = Record<string, unknown>;

/** Best-effort analytics + email side effects for a status change. */
export async function afterPrintStatusChange(
  admin: Db,
  order: Row,
  status: PrintOrderStatus,
): Promise<void> {
  const eventName = STATUS_EVENT[status];
  if (eventName) {
    await admin.from("product_events").insert({
      owner_id: order.owner_id as string,
      event_name: eventName,
      path: "/print-store",
      properties: {
        orderId: order.id as string,
        orderNumber: order.order_number as string,
        totalMinor: Number(order.total_minor ?? 0),
        currency: (order.currency_code as string) ?? "NZD",
      },
    });
  }

  const template = STATUS_EMAIL[status];
  if (!template) return;
  try {
    const { sendTemplateEmail } = await import("./email-templates/send-email");
    const to = (order.contact_email as string) ?? "";
    if (!to) return;
    await sendTemplateEmail(template, to, {
      idempotencyKey: `print-${order.id as string}-${status}`,
      templateData: {
        orderNumber: order.order_number,
        status,
        customerName: order.shipping_name ?? "there",
        totalMinor: Number(order.total_minor ?? 0),
        currency: (order.currency_code as string) ?? "NZD",
        trackingCarrier: order.tracking_carrier ?? null,
        trackingNumber: order.tracking_number ?? null,
        trackingUrl: order.tracking_url ?? null,
        estimatedDeliveryDate: order.estimated_delivery_date ?? null,
        failureReason: order.failure_reason ?? null,
      },
    });
  } catch (e) {
    // Email failure must never fail the webhook — the order state is what
    // matters and Stripe should not redeliver because of a mail hiccup.
    console.error("print order email failed", (e as Error).message);
  }
}

/**
 * A completed print checkout. Idempotent: replaying the same event leaves the
 * order paid exactly once and never re-empties an already-ordered cart.
 */
export async function markPrintOrderPaid(
  admin: Db,
  args: {
    printOrderId: string;
    paymentIntentId?: string | null;
    sessionId?: string | null;
  },
): Promise<void> {
  const { data, error } = await admin
    .from("print_orders")
    .select("*")
    .eq("id", args.printOrderId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) return;
  const order = data as Row;
  if (order.payment_status === "paid") return;

  const now = new Date().toISOString();
  await admin
    .from("print_orders")
    .update({
      status: "awaiting_fulfilment",
      payment_status: "paid",
      paid_at: now,
      stripe_payment_intent_id: args.paymentIntentId ?? order.stripe_payment_intent_id ?? null,
      stripe_checkout_session_id:
        args.sessionId ?? (order.stripe_checkout_session_id as string | null) ?? null,
    })
    .eq("id", args.printOrderId);

  await admin.from("print_order_events").insert([
    {
      order_id: args.printOrderId,
      owner_id: order.owner_id as string,
      event_type: "payment_succeeded",
      previous_status: order.status as string,
      new_status: "paid",
      note: "Payment received.",
      visibility: "customer",
    },
    {
      order_id: args.printOrderId,
      owner_id: order.owner_id as string,
      event_type: "queued_for_fulfilment",
      previous_status: "paid",
      new_status: "awaiting_fulfilment",
      note: "Queued for manual fulfilment.",
      visibility: "internal",
    },
  ]);

  // Close the cart that produced this order and clear its lines.
  const { data: cart } = await admin
    .from("print_carts")
    .select("id")
    .eq("owner_id", order.owner_id as string)
    .eq("status", "open")
    .maybeSingle();
  if (cart) {
    const cartId = (cart as Row).id as string;
    await admin.from("print_cart_items").delete().eq("cart_id", cartId);
    await admin.from("print_carts").update({ status: "ordered" }).eq("id", cartId);
  }

  await afterPrintStatusChange(admin, { ...order, status: "paid" }, "paid");
}

/** A refunded or disputed charge on a print order. */
export async function refundPrintOrderForPaymentIntent(
  admin: Db,
  paymentIntentId: string,
  amountRefundedMinor: number | null,
): Promise<boolean> {
  const { data } = await admin
    .from("print_orders")
    .select("*")
    .eq("stripe_payment_intent_id", paymentIntentId)
    .maybeSingle();
  if (!data) return false;
  const order = data as Row;
  if (order.status === "refunded") return true;

  await admin
    .from("print_orders")
    .update({
      status: "refunded",
      payment_status: "refunded",
      refunded_at: new Date().toISOString(),
      refund_amount_minor: amountRefundedMinor ?? Number(order.total_minor ?? 0),
    })
    .eq("id", order.id as string);

  await admin.from("print_order_events").insert({
    order_id: order.id as string,
    owner_id: order.owner_id as string,
    event_type: "refunded",
    previous_status: order.status as string,
    new_status: "refunded",
    note: "Refund processed.",
    visibility: "customer",
  });

  await afterPrintStatusChange(admin, order, "refunded");
  return true;
}

/** Abandoned print checkout — release the reserved order. */
export async function expirePrintOrder(admin: Db, sessionId: string): Promise<void> {
  const { data } = await admin
    .from("print_orders")
    .select("id, owner_id, status")
    .eq("stripe_checkout_session_id", sessionId)
    .maybeSingle();
  if (!data) return;
  const order = data as Row;
  if (order.status !== "ready_for_payment") return;
  await admin
    .from("print_orders")
    .update({ status: "canceled", canceled_at: new Date().toISOString() })
    .eq("id", order.id as string);
  await admin.from("print_order_events").insert({
    order_id: order.id as string,
    owner_id: order.owner_id as string,
    event_type: "checkout_expired",
    previous_status: "ready_for_payment",
    new_status: "canceled",
    note: "Checkout expired before payment.",
    visibility: "internal",
  });
}
