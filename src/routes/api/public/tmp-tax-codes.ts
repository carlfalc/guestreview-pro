// TEMPORARY one-off maintenance route. Deleted immediately after use.
import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/api/public/tmp-tax-codes")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const url = new URL(request.url);
        const env = url.searchParams.get("env") === "live" ? "live" : "sandbox";
        const apply = url.searchParams.get("apply") === "1";
        const { createStripeClient, getStripeErrorMessage } = await import("@/lib/stripe.server");
        try {
          const stripe = createStripeClient(env);
          const products = await stripe.products.list({ limit: 100 });
          const out: unknown[] = [];
          for (const p of products.data) {
            if (apply && p.tax_code !== "txcd_10103001") {
              const updated = await stripe.products.update(p.id, { tax_code: "txcd_10103001" });
              out.push({ id: p.id, name: p.name, tax_code: updated.tax_code });
            } else {
              out.push({ id: p.id, name: p.name, tax_code: p.tax_code });
            }
          }
          return Response.json({ env, apply, products: out });
        } catch (e) {
          return Response.json({ error: getStripeErrorMessage(e) }, { status: 500 });
        }
      },
    },
  },
});
