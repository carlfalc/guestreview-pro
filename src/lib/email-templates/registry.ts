/* eslint-disable @typescript-eslint/no-explicit-any -- templates declare their own prop shapes */
import type { ComponentType } from "react";

import { template as weeklyReputationHealth } from "./weekly-reputation-health";
import { template as qrPlacementGuide } from "./qr-placement-guide";
import { template as portfolioDigest } from "./portfolio-digest";
import { template as founderWelcome } from "./founder-welcome";
import { template as founderCancellationWarning } from "./founder-cancellation-warning";
import {
  printOrderConfirmed,
  printOrderSubmitted,
  printOrderShipped,
  printOrderDelivered,
  printOrderIssue,
  printOrderRefunded,
} from "./print-order";

export interface TemplateEntry {
  component: ComponentType<any>;
  subject: string | ((data: Record<string, any>) => string);
  displayName?: string;
  /** Inbox preview line used by the dashboard preview surface. */
  previewText?: string;
  /** Email entitlement key that must be true for this template to be sent. */
  entitlement?: "weeklyReport" | "portfolioDigest" | "none";
  /** Whether the send must carry Lovable's unsubscribe footer. */
  requiresUnsubscribe?: boolean;
  /**
   * Validates + sanitises template data before rendering. Throws when the
   * payload is unusable, which prevents a half-empty email going out.
   */
  validate?: (data: Record<string, any>) => Record<string, any>;
  previewData?: Record<string, any>;
  /** Fixed recipient — overrides caller-provided recipientEmail when set. */
  to?: string;
}

/**
 * Template registry — maps template keys to their React Email components.
 * Keys are stable and are also used as `email_deliveries.email_type` labels.
 */
export const TEMPLATES: Record<string, TemplateEntry> = {
  weekly_reputation_health: weeklyReputationHealth,
  qr_placement_guide: qrPlacementGuide,
  portfolio_digest: portfolioDigest,
  founder_welcome: founderWelcome,
  founder_cancellation_warning: founderCancellationWarning,
  print_order_confirmed: printOrderConfirmed,
  print_order_submitted: printOrderSubmitted,
  print_order_shipped: printOrderShipped,
  print_order_delivered: printOrderDelivered,
  print_order_issue: printOrderIssue,
  print_order_refunded: printOrderRefunded,
};
