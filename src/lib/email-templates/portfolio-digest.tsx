import React from "react";
import {
  Body,
  Button,
  Column,
  Container,
  Head,
  Heading,
  Hr,
  Html,
  Preview,
  Row,
  Section,
  Text,
} from "@react-email/components";
import type { TemplateEntry } from "./registry";
import {
  buildPortfolioDigestData,
  portfolioSubject,
  type PortfolioDigestData,
} from "@/lib/email-content";

const main = { backgroundColor: "#ffffff", fontFamily: "Arial, Helvetica, sans-serif" };
const container = { padding: "24px", maxWidth: "640px", margin: "0 auto" };
const muted = { color: "#5b6472", fontSize: "13px", margin: "0 0 4px" };
const body = { color: "#1a1d23", fontSize: "15px", lineHeight: "22px", margin: "0 0 10px" };
const statBox = {
  backgroundColor: "#0f1115",
  borderRadius: "12px",
  padding: "18px 22px",
  margin: "16px 0",
};
const statValue = { color: "#ffffff", fontSize: "34px", fontWeight: 700, margin: "0" };
const statMeta = { color: "#c9d1dc", fontSize: "13px", margin: "4px 0 0" };
const th = {
  color: "#5b6472",
  fontSize: "11px",
  textTransform: "uppercase" as const,
  padding: "0 6px 6px 0",
  margin: "0",
};
const td = { color: "#1a1d23", fontSize: "13px", padding: "6px 6px 6px 0", margin: "0" };
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

const PortfolioDigestEmail = (props: Record<string, unknown>) => {
  const d: PortfolioDigestData = buildPortfolioDigestData(props ?? {});
  return (
    <Html lang="en" dir="ltr">
      <Head />
      <Preview>{`${d.businessCount} businesses at a glance · average Reputation Health™ ${d.averageScore ?? "—"}`}</Preview>
      <Body style={main}>
        <Container style={container}>
          <Text style={muted}>GuestReview Pro · portfolio digest</Text>
          <Heading as="h1" style={{ fontSize: "22px", margin: "0 0 4px" }}>
            {d.businessCount} businesses at a glance
          </Heading>
          <Text style={muted}>{d.periodLabel}</Text>

          <Section style={statBox}>
            <Text style={statMeta}>Average Reputation Health™</Text>
            <Text style={statValue}>
              {d.averageScore === null ? "Not enough data yet" : d.averageScore}
            </Text>
            <Text style={statMeta}>
              {d.averageMovement} · {d.improving} improving · {d.needingAttention} need attention
            </Text>
          </Section>

          <Text style={body}>
            <strong>Strongest:</strong> {d.strongest}
          </Text>
          <Text style={body}>
            <strong>Needs the most attention:</strong> {d.weakest}
          </Text>

          <Hr />

          <Section>
            <Row>
              <Column>
                <Text style={th}>Business</Text>
              </Column>
              <Column>
                <Text style={th}>Score</Text>
              </Column>
              <Column>
                <Text style={th}>Move</Text>
              </Column>
              <Column>
                <Text style={th}>Conf.</Text>
              </Column>
              <Column>
                <Text style={th}>Scans</Text>
              </Column>
              <Column>
                <Text style={th}>Warning</Text>
              </Column>
            </Row>
            {d.rows.map((row) => (
              <Row key={row.businessName}>
                <Column>
                  <Text style={td}>{row.businessName}</Text>
                </Column>
                <Column>
                  <Text style={td}>{row.score === null ? "—" : row.score}</Text>
                </Column>
                <Column>
                  <Text style={td}>{row.movement}</Text>
                </Column>
                <Column>
                  <Text style={td}>{row.confidence}</Text>
                </Column>
                <Column>
                  <Text style={td}>{row.scans}</Text>
                </Column>
                <Column>
                  <Text style={td}>{row.warning}</Text>
                </Column>
              </Row>
            ))}
          </Section>

          {d.recommendations.length > 0 ? (
            <>
              <Heading as="h2" style={{ fontSize: "16px", margin: "20px 0 6px" }}>
                Top portfolio recommendations
              </Heading>
              {d.recommendations.map((rec, i) => (
                <Text key={rec} style={body}>
                  {i + 1}. {rec}
                </Text>
              ))}
            </>
          ) : null}

          <Section style={{ margin: "20px 0 8px" }}>
            <Button href={d.dashboardUrl} style={primaryBtn}>
              View Portfolio Dashboard
            </Button>
          </Section>

          <Hr />
          {d.unsubscribeNote ? <Text style={footer}>{d.unsubscribeNote}</Text> : null}
          <Text style={footer}>
            Figures come from verified GuestReview Pro scan activity only.
          </Text>
        </Container>
      </Body>
    </Html>
  );
};

export const template = {
  component: PortfolioDigestEmail,
  subject: (data: Record<string, unknown>) => portfolioSubject(data),
  displayName: "Business portfolio digest",
  previewText: "Your weekly GuestReview Pro portfolio digest",
  entitlement: "portfolioDigest",
  requiresUnsubscribe: true,
  validate: buildPortfolioDigestData,
  previewData: {
    periodLabel: "21–28 July 2026",
    averageMovement: "+3 vs last week",
    improving: 3,
    needingAttention: 1,
    strongest: "The Glasshouse Café (84)",
    weakest: "Harbour Barbers (52)",
    recommendations: [
      "Add a counter code at Harbour Barbers",
      "Reprint the faded window sticker at Northgate Deli",
      "Brief staff at all sites to mention the code at checkout",
    ],
    dashboardUrl: "https://www.guestreviewpro.com/dashboard",
    rows: [
      {
        businessName: "The Glasshouse Café",
        score: 84,
        movement: "+6",
        confidence: "High",
        scans: 142,
        warning: "None",
      },
      {
        businessName: "Northgate Deli",
        score: 71,
        movement: "+1",
        confidence: "Medium",
        scans: 68,
        warning: "Only one active placement",
      },
      {
        businessName: "Harbour Barbers",
        score: 52,
        movement: "-4",
        confidence: "Low",
        scans: 19,
        warning: "Scans falling week on week",
      },
    ],
  },
} satisfies TemplateEntry;
