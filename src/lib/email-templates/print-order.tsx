import React from "react";
import {
  Body,
  Button,
  Container,
  Head,
  Heading,
  Hr,
  Html,
  Preview,
  Section,
  Text,
} from "@react-email/components";
import type { TemplateEntry } from "./registry";
import { PUBLIC_SITE_URL } from "@/lib/public-url";

const main = { backgroundColor: "#ffffff", fontFamily: "Arial, Helvetica, sans-serif" };
const container = { padding: "24px", maxWidth: "600px", margin: "0 auto" };
const body = { color: "#1a1d23", fontSize: "15px", lineHeight: "22px", margin: "0 0 12px" };
const muted = { color: "#5b6472", fontSize: "13px", margin: "0 0 4px" };
const footer = { color: "#8b95a5", fontSize: "12px", lineHeight: "18px", margin: "12px 0 0" };
const primaryBtn = {
  backgroundColor: "#1a73e8",
  color: "#ffffff",
  borderRadius: "8px",
  padding: "12px 20px",
  fontSize: "14px",
  fontWeight: 700,
  textDecoration: "none",
  display: "inline-block",
};

export type PrintEmailStage =
  | "confirmed"
  | "submitted"
  | "shipped"
  | "delivered"
  | "issue"
  | "refunded";

interface PrintEmailData {
  stage: PrintEmailStage;
  orderNumber: string;
  customerName: string;
  amount: string;
  trackingCarrier: string | null;
  trackingNumber: string | null;
  trackingUrl: string | null;
  estimatedDeliveryDate: string | null;
  failureReason: string | null;
  ordersUrl: string;
}

function clean(value: unknown, fallback: string, max = 200): string {
  if (typeof value !== "string") return fallback;
  // eslint-disable-next-line no-control-regex -- strip control characters
  const trimmed = value.replace(/[\u0000-\u001f\u007f]/g, "").trim();
  return trimmed.length ? trimmed.slice(0, max) : fallback;
}

function optional(value: unknown, max = 200): string | null {
  const v = clean(value, "", max);
  return v || null;
}

function money(minor: unknown, currency: unknown): string {
  const amount = typeof minor === "number" ? minor : Number(minor ?? 0);
  const code = clean(currency, "NZD", 3).toUpperCase();
  return `${code} ${(amount / 100).toFixed(2)}`;
}

const HTTPS_ONLY = (value: string | null): string | null =>
  value && /^https:\/\//i.test(value) ? value : null;

export function buildPrintOrderEmailData(input: Record<string, unknown>): PrintEmailData {
  const statusToStage: Record<string, PrintEmailStage> = {
    paid: "confirmed",
    submitted_to_printer: "submitted",
    shipped: "shipped",
    delivered: "delivered",
    production_failed: "issue",
    refunded: "refunded",
  };
  const stage =
    statusToStage[clean(input.status, "paid", 40)] ??
    (clean(input.stage, "confirmed", 20) as PrintEmailStage);

  return {
    stage,
    orderNumber: clean(input.orderNumber, "your order", 40),
    customerName: clean(input.customerName, "there", 80),
    amount: money(input.totalMinor, input.currency),
    trackingCarrier: optional(input.trackingCarrier, 80),
    trackingNumber: optional(input.trackingNumber, 80),
    trackingUrl: HTTPS_ONLY(optional(input.trackingUrl, 400)),
    estimatedDeliveryDate: optional(input.estimatedDeliveryDate, 20),
    failureReason: optional(input.failureReason, 300),
    ordersUrl: `${PUBLIC_SITE_URL}/print-store/orders`,
  };
}

const HEADLINE: Record<PrintEmailStage, string> = {
  confirmed: "Your print order is confirmed",
  submitted: "Your order is with the printer",
  shipped: "Your order is on its way",
  delivered: "Your order has been delivered",
  issue: "There's a hold-up on your print order",
  refunded: "Your print order has been refunded",
};

function StageBody({ d }: { d: PrintEmailData }) {
  switch (d.stage) {
    case "confirmed":
      return (
        <>
          <Text style={body}>
            Thanks {d.customerName} — we've received your payment of {d.amount} for order{" "}
            {d.orderNumber}. Your approved artwork is queued for production.
          </Text>
          <Text style={body}>
            We'll email you again the moment it goes to the printer, and once more when it ships.
          </Text>
        </>
      );
    case "submitted":
      return (
        <Text style={body}>
          Order {d.orderNumber} has been sent to the printer exactly as you approved it. Printing
          and finishing usually takes a few working days.
        </Text>
      );
    case "shipped":
      return (
        <>
          <Text style={body}>Order {d.orderNumber} has left the printer.</Text>
          {d.trackingNumber ? (
            <Text style={muted}>
              {d.trackingCarrier ?? "Carrier"}: {d.trackingNumber}
            </Text>
          ) : null}
          {d.estimatedDeliveryDate ? (
            <Text style={muted}>Estimated delivery: {d.estimatedDeliveryDate}</Text>
          ) : null}
        </>
      );
    case "delivered":
      return (
        <Text style={body}>
          Order {d.orderNumber} has been delivered. Put the codes where guests already pause — by
          the till, on the table, at the exit — and the scans follow.
        </Text>
      );
    case "issue":
      return (
        <>
          <Text style={body}>
            We've hit a snag producing order {d.orderNumber} and we're sorting it out.
          </Text>
          {d.failureReason ? <Text style={muted}>Details: {d.failureReason}</Text> : null}
          <Text style={body}>No action is needed from you right now — we'll be in touch.</Text>
        </>
      );
    case "refunded":
      return (
        <Text style={body}>
          Order {d.orderNumber} has been refunded in full ({d.amount}). Depending on your bank it
          can take a few working days to appear.
        </Text>
      );
  }
}

const PrintOrderEmail = (props: Record<string, unknown>) => {
  const d = buildPrintOrderEmailData(props ?? {});
  return (
    <Html lang="en" dir="ltr">
      <Head />
      <Preview>
        {HEADLINE[d.stage]} — order {d.orderNumber}
      </Preview>
      <Body style={main}>
        <Container style={container}>
          <Text style={muted}>GuestReview Pro · Print store</Text>
          <Heading as="h1">{HEADLINE[d.stage]}</Heading>
          <StageBody d={d} />
          <Section>
            <Button href={d.trackingUrl ?? d.ordersUrl} style={primaryBtn}>
              {d.trackingUrl ? "Track your parcel" : "View your order"}
            </Button>
          </Section>
          <Hr />
          <Text style={footer}>
            You're receiving this because you placed a print order with GuestReview Pro. Order
            updates are transactional and are always sent.
          </Text>
        </Container>
      </Body>
    </Html>
  );
};

function entry(stage: PrintEmailStage, subject: string): TemplateEntry {
  return {
    component: PrintOrderEmail,
    subject: (data: Record<string, unknown>) => {
      const d = buildPrintOrderEmailData(data ?? {});
      return subject.replace("{order}", d.orderNumber);
    },
    displayName: `Print order — ${stage}`,
    previewText: HEADLINE[stage],
    entitlement: "none",
    requiresUnsubscribe: false,
    previewData: {
      stage,
      status:
        stage === "confirmed"
          ? "paid"
          : stage === "submitted"
            ? "submitted_to_printer"
            : stage === "issue"
              ? "production_failed"
              : stage,
      orderNumber: "GRP-2026-00042",
      customerName: "Sam",
      totalMinor: 12900,
      currency: "NZD",
      trackingCarrier: "NZ Post",
      trackingNumber: "AB123456789NZ",
      trackingUrl: "https://www.nzpost.co.nz/tools/tracking",
      estimatedDeliveryDate: "2026-08-15",
    },
    validate: (data) => buildPrintOrderEmailData(data) as unknown as Record<string, unknown>,
  };
}

export const printOrderConfirmed = entry("confirmed", "Order {order} confirmed");
export const printOrderSubmitted = entry("submitted", "Order {order} is with the printer");
export const printOrderShipped = entry("shipped", "Order {order} has shipped");
export const printOrderDelivered = entry("delivered", "Order {order} delivered");
export const printOrderIssue = entry("issue", "Update on order {order}");
export const printOrderRefunded = entry("refunded", "Order {order} refunded");

export default PrintOrderEmail;
