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
import { FOUNDER_COPY } from "@/lib/founder";

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

interface WelcomeData {
  slotLabel: string;
  priceLine: string;
  dashboardUrl: string;
}

function clean(value: unknown, fallback: string): string {
  if (typeof value !== "string") return fallback;
  // eslint-disable-next-line no-control-regex -- strip control characters
  const trimmed = value.replace(/[\u0000-\u001f\u007f]/g, "").trim();
  return trimmed.length ? trimmed.slice(0, 200) : fallback;
}

export function buildFounderWelcomeData(input: Record<string, unknown>): WelcomeData {
  return {
    slotLabel: clean(input.slotLabel, "Founding Member"),
    priceLine: clean(input.priceLine, "your founder rate"),
    dashboardUrl: clean(input.dashboardUrl, "https://googlereviewpro.com/dashboard"),
  };
}

const FounderWelcomeEmail = (props: Record<string, unknown>) => {
  const d = buildFounderWelcomeData(props ?? {});
  return (
    <Html lang="en" dir="ltr">
      <Head />
      <Preview>You're in — {d.slotLabel} of the GuestReview Pro Founding Member Beta.</Preview>
      <Body style={main}>
        <Container style={container}>
          <Text style={muted}>{FOUNDER_COPY.eyebrow}</Text>
          <Heading as="h1">Welcome, {d.slotLabel}</Heading>
          <Text style={body}>
            Your place in the Founding Member Beta is confirmed. You're paying {d.priceLine}, and{" "}
            {FOUNDER_COPY.lockWording.toLowerCase()}.
          </Text>
          <Section>
            <Button href={d.dashboardUrl} style={primaryBtn}>
              Open your dashboard
            </Button>
          </Section>
          <Hr />
          <Text style={body}>First four things to do:</Text>
          <Text style={body}>
            1. Add your business and Google review link
            <br />
            2. Create your first QR code
            <br />
            3. Print a marketing pack and place it
            <br />
            4. Watch your first scans arrive
          </Text>
          <Hr />
          {FOUNDER_COPY.terms.map((term) => (
            <Text key={term} style={footer}>
              {term}
            </Text>
          ))}
        </Container>
      </Body>
    </Html>
  );
};

export const template: TemplateEntry = {
  component: FounderWelcomeEmail,
  subject: (data) =>
    `You're ${clean(data?.slotLabel, "a Founding Member")} — welcome to GuestReview Pro`,
  displayName: "Founding Member welcome",
  previewText: "Your founder place is confirmed.",
  entitlement: "none",
  requiresUnsubscribe: false,
  validate: (data) => buildFounderWelcomeData(data ?? {}) as unknown as Record<string, unknown>,
  previewData: {
    slotLabel: "Founding Member #042",
    priceLine: "NZ$19 per month",
    dashboardUrl: "https://googlereviewpro.com/dashboard",
  },
};
