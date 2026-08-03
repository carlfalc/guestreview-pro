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

const main = { backgroundColor: "#ffffff", fontFamily: "Arial, Helvetica, sans-serif" };
const container = { padding: "24px", maxWidth: "600px", margin: "0 auto" };
const body = { color: "#1a1d23", fontSize: "15px", lineHeight: "22px", margin: "0 0 12px" };
const muted = { color: "#5b6472", fontSize: "13px", margin: "0 0 4px" };
const footer = { color: "#8b95a5", fontSize: "12px", lineHeight: "18px", margin: "4px 0 0" };
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

interface WarningData {
  slotLabel: string;
  accessUntil: string;
  billingUrl: string;
}

function clean(value: unknown, fallback: string): string {
  if (typeof value !== "string") return fallback;
  // eslint-disable-next-line no-control-regex -- strip control characters
  const trimmed = value.replace(/[\u0000-\u001f\u007f]/g, "").trim();
  return trimmed.length ? trimmed.slice(0, 200) : fallback;
}

export function buildFounderWarningData(input: Record<string, unknown>): WarningData {
  return {
    slotLabel: clean(input.slotLabel, "Founding Member"),
    accessUntil: clean(input.accessUntil, "the end of your billing period"),
    billingUrl: clean(input.billingUrl, "https://googlereviewpro.com/billing"),
  };
}

const FounderCancellationWarningEmail = (props: Record<string, unknown>) => {
  const d = buildFounderWarningData(props ?? {});
  return (
    <Html lang="en" dir="ltr">
      <Head />
      <Preview>Your founder pricing ends when this subscription does.</Preview>
      <Body style={main}>
        <Container style={container}>
          <Text style={muted}>Founding Member Beta</Text>
          <Heading as="h1">Your founder place is about to be released</Heading>
          <Text style={body}>
            {d.slotLabel}, your subscription is set to end on {d.accessUntil}. When it does, your
            founder place returns to the pool and your locked founder pricing ends.
          </Text>
          <Text style={body}>
            If you resubscribe later, standard pricing for your region applies — the founder rate
            cannot be reinstated.
          </Text>
          <Section>
            <Button href={d.billingUrl} style={primaryBtn}>
              Keep my founder pricing
            </Button>
          </Section>
          <Hr />
          <Text style={footer}>
            If you meant to cancel, no action is needed and nothing further will be charged.
          </Text>
        </Container>
      </Body>
    </Html>
  );
};

export const template: TemplateEntry = {
  component: FounderCancellationWarningEmail,
  subject: "Your founder pricing ends when your subscription does",
  displayName: "Founder cancellation warning",
  previewText: "Keep your locked founder rate.",
  entitlement: "none",
  requiresUnsubscribe: false,
  validate: (data) => buildFounderWarningData(data ?? {}) as unknown as Record<string, unknown>,
  previewData: {
    slotLabel: "Founding Member #042",
    accessUntil: "12 August 2026",
    billingUrl: "https://googlereviewpro.com/billing",
  },
};
