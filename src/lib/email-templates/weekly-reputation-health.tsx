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
import {
  AI_SUMMARY_DISCLAIMER,
  buildWeeklyReportData,
  weeklySubject,
  type WeeklyReportData,
} from "@/lib/email-content";

const main = { backgroundColor: "#ffffff", fontFamily: "Arial, Helvetica, sans-serif" };
const container = { padding: "24px", maxWidth: "600px", margin: "0 auto" };
const muted = { color: "#5b6472", fontSize: "13px", margin: "0 0 4px" };
const body = { color: "#1a1d23", fontSize: "15px", lineHeight: "22px", margin: "0 0 12px" };
const scoreBox = {
  backgroundColor: "#0f1115",
  borderRadius: "12px",
  padding: "20px 24px",
  margin: "16px 0",
};
const scoreValue = { color: "#ffffff", fontSize: "40px", fontWeight: 700, margin: "0" };
const scoreMeta = { color: "#c9d1dc", fontSize: "13px", margin: "4px 0 0" };
const kpiLabel = { color: "#5b6472", fontSize: "12px", margin: "0" };
const kpiValue = { color: "#1a1d23", fontSize: "18px", fontWeight: 700, margin: "2px 0 12px" };
const primaryBtn = {
  backgroundColor: "#1a73e8",
  color: "#ffffff",
  borderRadius: "8px",
  padding: "12px 20px",
  fontSize: "14px",
  fontWeight: 700,
  textDecoration: "none",
  display: "inline-block",
  marginRight: "10px",
};
const secondaryBtn = { ...primaryBtn, backgroundColor: "#eef2f7", color: "#1a1d23" };
const footer = { color: "#8b95a5", fontSize: "12px", lineHeight: "18px", margin: "4px 0 0" };

const WeeklyReputationHealthEmail = (props: Record<string, unknown>) => {
  const d: WeeklyReportData = buildWeeklyReportData(props ?? {});
  return (
    <Html lang="en" dir="ltr">
      <Head />
      <Preview>{`${d.businessName}: Reputation Health™ ${d.score ?? "—"} · ${d.scans} scans this week`}</Preview>
      <Body style={main}>
        <Container style={container}>
          <Text style={muted}>GuestReview Pro · weekly report</Text>
          <Heading as="h1" style={{ fontSize: "22px", margin: "0 0 4px" }}>
            {d.businessName}
          </Heading>
          <Text style={muted}>{d.periodLabel}</Text>

          <Section style={scoreBox}>
            <Text style={scoreMeta}>Reputation Health™</Text>
            <Text style={scoreValue}>{d.score === null ? "Not enough data yet" : d.score}</Text>
            <Text style={scoreMeta}>
              {d.scoreMovement} · Confidence: {d.confidence}
            </Text>
          </Section>

          <Section>
            <Text style={kpiLabel}>Scans this week</Text>
            <Text style={kpiValue}>{d.scans}</Text>
            <Text style={kpiLabel}>Destination clicks</Text>
            <Text style={kpiValue}>{d.clicks}</Text>
            <Text style={kpiLabel}>Click-through rate</Text>
            <Text style={kpiValue}>{d.clickRate}</Text>
          </Section>

          <Hr />

          <Text style={body}>
            <strong>Strongest placement:</strong> {d.strongestPlacement}
          </Text>
          <Text style={body}>
            <strong>Main opportunity:</strong> {d.mainOpportunity}
          </Text>

          {d.aiSummary ? (
            <>
              <Heading as="h2" style={{ fontSize: "16px", margin: "20px 0 6px" }}>
                Executive summary
              </Heading>
              <Text style={body}>{d.aiSummary}</Text>
              <Text style={footer}>{AI_SUMMARY_DISCLAIMER}</Text>
            </>
          ) : null}

          {d.actions.length > 0 ? (
            <>
              <Heading as="h2" style={{ fontSize: "16px", margin: "20px 0 6px" }}>
                Recommended actions
              </Heading>
              {d.actions.map((action, i) => (
                <Text key={action} style={body}>
                  {i + 1}. {action}
                </Text>
              ))}
            </>
          ) : null}

          <Section style={{ margin: "20px 0 8px" }}>
            <Button href={d.dashboardUrl} style={primaryBtn}>
              View Dashboard
            </Button>
            <Button href={d.reportUrl} style={secondaryBtn}>
              View Full Report
            </Button>
          </Section>

          <Hr />
          <Text style={footer}>{AI_SUMMARY_DISCLAIMER}</Text>
          {d.unsubscribeNote ? <Text style={footer}>{d.unsubscribeNote}</Text> : null}
          <Text style={footer}>
            You receive this because weekly reports are switched on for your GuestReview Pro
            account.
          </Text>
        </Container>
      </Body>
    </Html>
  );
};

export const template = {
  component: WeeklyReputationHealthEmail,
  subject: (data: Record<string, unknown>) => weeklySubject(data),
  displayName: "Weekly Reputation Health™ report",
  previewText: "Your weekly Reputation Health™ report",
  entitlement: "weeklyReport",
  requiresUnsubscribe: true,
  validate: buildWeeklyReportData,
  previewData: {
    businessName: "The Glasshouse Café",
    periodLabel: "21–28 July 2026",
    score: 78,
    scoreMovement: "+6 vs last week",
    confidence: "Medium",
    scans: 142,
    clicks: 96,
    clickRate: "67.6%",
    strongestPlacement: "Table tent is your strongest spot with 61 scans.",
    mainOpportunity: "Counter sticker is your biggest opportunity at 34% engagement.",
    aiSummary:
      "Scanning held steady across the week and your table tents did most of the work. Adding a second code near the till is the clearest next step.",
    actions: [
      "Add a QR code at the payment counter",
      "Refresh the faded window sticker",
      "Brief staff to mention the code at checkout",
    ],
    dashboardUrl: "https://www.guestreviewpro.com/dashboard",
    reportUrl: "https://www.guestreviewpro.com/reports",
  },
} satisfies TemplateEntry;
