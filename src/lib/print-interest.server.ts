// Server-only side effects for the print waitlist.
import { dispatchEmail } from "./email-dispatch.server";
import { PUBLIC_SITE_URL } from "./public-url";

export interface PrintWaitlistAckArgs {
  email: string;
  ownerId: string;
  businessId: string | null;
  productLabels: string[];
}

/**
 * One transactional acknowledgment per account per day. Never promotional and
 * never promises a launch date.
 */
export async function sendPrintWaitlistAck(args: PrintWaitlistAckArgs) {
  const day = new Date().toISOString().slice(0, 10);
  return dispatchEmail({
    templateKey: "print_waitlist_ack",
    to: args.email,
    ownerId: args.ownerId,
    businessId: args.businessId,
    idempotencyKey: `print-waitlist:${args.ownerId}:${day}`,
    templateData: {
      productLabels: args.productLabels,
      preferencesUrl: `${PUBLIC_SITE_URL}/print-store`,
    },
    kind: "triggered",
  });
}
