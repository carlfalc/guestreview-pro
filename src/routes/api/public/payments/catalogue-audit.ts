import { createFileRoute } from "@tanstack/react-router";
import { createStripeClient, getStripeErrorMessage } from "@/lib/stripe.server";

/** Temporary maintenance endpoint: lists the Stripe catalogue for auditing. */
export const Route = createFileRoute("/api/public/payments/catalogue-audit")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        try {
          const url = new URL(request.url);
          const env = url.searchParams.get("env") === "live" ? "live" : "sandbox";
          const stripe = createStripeClient(env);
          const products = await stripe.products.list({ limit: 100 });
          const prices = await stripe.prices.list({ limit: 100, active: true });
          return Response.json({
            env,
            products: products.data.map((p) => ({
              id: p.id,
              name: p.name,
              external: p.metadata?.lovable_external_id ?? null,
              tax_code: typeof p.tax_code === "string" ? p.tax_code : p.tax_code?.id ?? null,
            })),
            prices: prices.data.map((pr) => ({
              id: pr.id,
              lookup_key: pr.lookup_key,
              external: pr.metadata?.lovable_external_id ?? null,
              product: typeof pr.product === "string" ? pr.product : pr.product.id,
              currency: pr.currency,
              amount: pr.unit_amount,
              interval: pr.recurring?.interval ?? null,
            })),
          });
        } catch (error) {
          return Response.json({ error: getStripeErrorMessage(error) }, { status: 500 });
        }
      },
    },
  },
});
