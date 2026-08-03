// Print order status model — shared by customer tracking and admin fulfilment.

export const PRINT_ORDER_STATUSES = [
  "draft",
  "awaiting_proof",
  "ready_for_payment",
  "paid",
  "awaiting_fulfilment",
  "submitted_to_printer",
  "in_production",
  "shipped",
  "delivered",
  "canceled",
  "refund_requested",
  "refunded",
  "production_failed",
] as const;

export type PrintOrderStatus = (typeof PRINT_ORDER_STATUSES)[number];

export const PRINT_ORDER_STATUS_LABEL: Record<PrintOrderStatus, string> = {
  draft: "Draft",
  awaiting_proof: "Awaiting proof approval",
  ready_for_payment: "Ready for payment",
  paid: "Paid",
  awaiting_fulfilment: "Awaiting fulfilment",
  submitted_to_printer: "Sent to printer",
  in_production: "In production",
  shipped: "Shipped",
  delivered: "Delivered",
  canceled: "Cancelled",
  refund_requested: "Refund requested",
  refunded: "Refunded",
  production_failed: "Production issue",
};

/** Plain-English explanation shown on the customer order page. */
export const PRINT_ORDER_STATUS_HELP: Record<PrintOrderStatus, string> = {
  draft: "Your order is still being put together.",
  awaiting_proof: "Approve the artwork proof to continue.",
  ready_for_payment: "Every proof is approved — complete payment to start production.",
  paid: "Payment received. We are preparing your job for the printer.",
  awaiting_fulfilment: "Queued for production.",
  submitted_to_printer: "Your artwork has been sent to the printer.",
  in_production: "Your order is being printed.",
  shipped: "Your order is on its way.",
  delivered: "Delivered. Put those codes to work.",
  canceled: "This order was cancelled.",
  refund_requested: "A refund has been requested and is being reviewed.",
  refunded: "This order has been refunded.",
  production_failed: "There was a production issue — our team is on it.",
};

/** Statuses a customer sees as an active, in-flight order. */
export const ACTIVE_PRINT_STATUSES: PrintOrderStatus[] = [
  "paid",
  "awaiting_fulfilment",
  "submitted_to_printer",
  "in_production",
  "shipped",
];

const ALLOWED_TRANSITIONS: Record<PrintOrderStatus, PrintOrderStatus[]> = {
  draft: ["awaiting_proof", "ready_for_payment", "canceled"],
  awaiting_proof: ["ready_for_payment", "canceled"],
  ready_for_payment: ["paid", "canceled"],
  paid: ["awaiting_fulfilment", "canceled", "refund_requested", "refunded", "production_failed"],
  awaiting_fulfilment: [
    "submitted_to_printer",
    "canceled",
    "refund_requested",
    "refunded",
    "production_failed",
  ],
  submitted_to_printer: ["in_production", "shipped", "production_failed", "canceled", "refunded"],
  in_production: ["shipped", "production_failed", "canceled", "refunded"],
  shipped: ["delivered", "production_failed", "refund_requested", "refunded"],
  delivered: ["refund_requested", "refunded"],
  canceled: ["refunded"],
  refund_requested: ["refunded", "paid"],
  refunded: [],
  production_failed: ["submitted_to_printer", "in_production", "refunded", "canceled"],
};

export function canTransition(from: PrintOrderStatus, to: PrintOrderStatus): boolean {
  if (from === to) return true;
  return (ALLOWED_TRANSITIONS[from] ?? []).includes(to);
}

export function isTerminal(status: PrintOrderStatus): boolean {
  return status === "delivered" || status === "refunded" || status === "canceled";
}

/** Which transactional email a status change should trigger, if any. */
export const STATUS_EMAIL: Partial<Record<PrintOrderStatus, string>> = {
  paid: "print_order_confirmed",
  submitted_to_printer: "print_order_submitted",
  shipped: "print_order_shipped",
  delivered: "print_order_delivered",
  production_failed: "print_order_issue",
  refunded: "print_order_refunded",
};

/** Analytics event emitted for a status change, if any. */
export const STATUS_EVENT: Partial<Record<PrintOrderStatus, string>> = {
  paid: "print_order_paid",
  submitted_to_printer: "print_order_submitted",
  shipped: "print_order_shipped",
  delivered: "print_order_delivered",
  refunded: "print_order_refunded",
};

export function estimatedDeliveryWindow(
  productionDaysMax: number,
  shippedDays = 5,
  from: Date = new Date(),
): { earliest: string; latest: string } {
  const add = (days: number) => {
    const d = new Date(from);
    d.setDate(d.getDate() + days);
    return d.toISOString().slice(0, 10);
  };
  return { earliest: add(productionDaysMax + 2), latest: add(productionDaysMax + shippedDays) };
}
