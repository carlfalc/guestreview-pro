// Temporary maintenance endpoint: lists Stripe webhook endpoints for an env.
import { createFileRoute } from "@tanstack/react-router";
import type {} from "@tanstack/react-start";

export const Route = createFileRoute("/api/public/payments/webhook-audit")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const env = new URL(request.url).searchParams.get("env");
        if (env !== "sandbox" && env !== "live") {
          return Response.json({ error: "env must be sandbox or live" }, { status: 400 });
        }
        const { createStripeClient, getStripeErrorMessage } = await import("@/lib/stripe.server");
        try {
          const stripe = createStripeClient(env);
          const list = await stripe.webhookEndpoints.list({ limit: 20 });
          return Response.json({
            env,
            endpoints: list.data.map((e) => ({
              url: e.url,
              status: e.status,
              events: e.enabled_events,
            })),
          });
        } catch (error) {
          return Response.json({ error: getStripeErrorMessage(error) }, { status: 500 });
        }
      },
    },
  },
});
