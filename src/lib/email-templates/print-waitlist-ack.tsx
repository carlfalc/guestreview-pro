import React from "react";
import {
  Body,
  Button,
  Container,
  Head,
  Heading,
  Html,
  Preview,
  Section,
  Text,
} from "@react-email/components";
import type { TemplateEntry } from "./registry";

const main = { backgroundColor: "#ffffff", fontFamily: "Arial, Helvetica, sans-serif" };
const container = { padding: "24px", maxWidth: "600px", margin: "0 auto" };
const muted = { color: "#5b6472", fontSize: "13px", margin: "0 0 4px" };
const body = { color: "#1a1d23", fontSize: "15px", lineHeight: "22px", margin: "0 0 12px" };
const item = { color: "#1a1d23", fontSize: "14px", lineHeight: "20px", margin: "0 0 4px" };
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
const footer = { color: "#8b95a5", fontSize: "12px", lineHeight: "18px", margin: "12px 0 0" };

function labels(data: Record<string, unknown>): string[] {
  const raw = data?.productLabels;
  if (!Array.isArray(raw)) return [];
  return raw.filter((v): v is string => typeof v === "string").slice(0, 20);
}

const PrintWaitlistAckEmail = (props: Record<string, unknown>) => {
  const products = labels(props ?? {});
  const preferencesUrl =
    typeof props?.preferencesUrl === "string"
      ? props.preferencesUrl
      : "https://www.guestreviewpro.com/print-store";

  return (
    <Html lang="en" dir="ltr">
      <Head />
      <Preview>We received your print preferences.</Preview>
      <Body style={main}>
        <Container style={container}>
          <Text style={muted}>GuestReview Pro</Text>
          <Heading as="h1" style={{ fontSize: "22px", margin: "0 0 12px" }}>
            You&rsquo;re on the print waitlist
          </Heading>

          <Text style={body}>
            Thanks — your preferences were received. We use them to decide which printed products
            to prepare first and which regions to serve.
          </Text>

          {products.length > 0 && (
            <Section style={{ margin: "16px 0" }}>
              <Text style={{ ...body, fontWeight: 700, margin: "0 0 6px" }}>
                Products you selected
              </Text>
              {products.map((label) => (
                <Text key={label} style={item}>
                  • {label}
                </Text>
              ))}
            </Section>
          )}

          <Text style={body}>
            You can change your selections at any time — nothing is ordered and nothing is charged.
          </Text>

          <Section style={{ margin: "18px 0" }}>
            <Button href={preferencesUrl} style={primaryBtn}>
              Update my preferences
            </Button>
          </Section>

          <Text style={footer}>
            You received this because you joined the print waitlist in your GuestReview Pro
            account. Manage your email preferences in Settings → Email, or reply to opt out of
            print updates.
          </Text>
        </Container>
      </Body>
    </Html>
  );
};

export const template: TemplateEntry = {
  component: PrintWaitlistAckEmail,
  subject: "You're on the GuestReview Pro print waitlist",
  displayName: "Print waitlist acknowledgment",
  previewText: "We received your print preferences.",
  entitlement: "none",
  requiresUnsubscribe: false,
  previewData: {
    productLabels: ["Vinyl QR stickers", "Counter cards", "Table tents"],
    preferencesUrl: "https://www.guestreviewpro.com/print-store",
  },
};

export default PrintWaitlistAckEmail;
