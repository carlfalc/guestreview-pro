import React from "react";
import {
  Body,
  Button,
  Container,
  Head,
  Heading,
  Hr,
  Html,
  Link,
  Preview,
  Section,
  Text,
} from "@react-email/components";
import type { TemplateEntry } from "./registry";
import { GUIDE_SUBJECT, buildGuideEmailData, type GuideEmailData } from "@/lib/email-content";

const main = { backgroundColor: "#ffffff", fontFamily: "Arial, Helvetica, sans-serif" };
const container = { padding: "24px", maxWidth: "600px", margin: "0 auto" };
const muted = { color: "#5b6472", fontSize: "13px", margin: "0 0 4px" };
const body = { color: "#1a1d23", fontSize: "15px", lineHeight: "22px", margin: "0 0 12px" };
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
const footer = { color: "#8b95a5", fontSize: "12px", lineHeight: "18px", margin: "4px 0 0" };

const QrPlacementGuideEmail = (props: Record<string, unknown>) => {
  const d: GuideEmailData = buildGuideEmailData(props ?? {});
  return (
    <Html lang="en" dir="ltr">
      <Head />
      <Preview>Your Google Review QR Placement Guide is ready to open.</Preview>
      <Body style={main}>
        <Container style={container}>
          <Text style={muted}>GuestReview Pro</Text>
          <Heading as="h1" style={{ fontSize: "22px", margin: "0 0 12px" }}>
            Your QR Placement Guide
          </Heading>

          <Text style={body}>
            Thanks for requesting the guide
            {d.industryLabel ? ` — we've tailored the examples for ${d.industryLabel}` : ""}. It
            opens straight in your browser, no download needed.
          </Text>

          <Section style={{ margin: "18px 0" }}>
            <Button href={d.guideUrl} style={primaryBtn}>
              Open the guide
            </Button>
          </Section>

          <Heading as="h2" style={{ fontSize: "16px", margin: "20px 0 6px" }}>
            What's inside
          </Heading>
          <Text style={body}>1. Where to place codes so they actually get scanned.</Text>
          <Text style={body}>2. Sizing and contrast rules for print that scans first time.</Text>
          <Text style={body}>3. A room-by-room placement checklist you can work through.</Text>

          <Hr />

          <Text style={body}>
            Want to put it into practice?{" "}
            <Link href={d.createQrUrl}>Create a free Google review QR code</Link> and print it
            today.
          </Text>

          <Text style={footer}>
            You are receiving this because you asked for the guide on guestreviewpro.com and ticked
            the consent box. We only use your address to send what you requested — see our privacy
            notice on the site.
          </Text>
        </Container>
      </Body>
    </Html>
  );
};

export const template = {
  component: QrPlacementGuideEmail,
  subject: GUIDE_SUBJECT,
  displayName: "QR Placement Guide delivery",
  previewText: "Your Google Review QR Placement Guide is ready to open.",
  entitlement: "none",
  requiresUnsubscribe: true,
  validate: buildGuideEmailData,
  previewData: {
    guideUrl: "https://www.guestreviewpro.com/resources/qr-code-size-and-placement",
    createQrUrl: "https://www.guestreviewpro.com/auth",
    industryLabel: "cafés and restaurants",
  },
} satisfies TemplateEntry;
