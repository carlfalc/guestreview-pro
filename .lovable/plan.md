# Live payments: where things actually stand

Short answer: **you are already live on your real domains.** Preview is deliberately test mode and should stay that way.

## What is configured today

- Stripe go-live is complete: account claimed, go-live form submitted, Lovable app installed on the live account, live API keys provisioned, readiness check passed.
- Live account: `acct_1RVUsAKnqI7Oju4N`. Sandbox account: `acct_1TwRgg5LnFHHgTT7`.
- Production builds ship the live publishable token; preview/dev builds ship the test token.
- The server, not the browser, decides the environment: requests on `guestreviewpro.com`, `googlereviewpro.com` (both with and without `www`) and `google-reviews-app.lovable.app` run **live**; every other host — preview, `*-dev.lovable.app`, localhost, tests — runs **sandbox**.
- Both live and sandbox webhook signing secrets and gateway keys are present on the server.

So a customer on www.guestreviewpro.com already gets a genuine end-to-end flow: real card, real charge, live webhook, subscription row written, entitlements upgraded. The preview never charges a real card — that is a safety property, not a gap.

## What has not been proven with a real transaction

Configuration being complete is not the same as one real payment having succeeded. Unverified so far:

1. That the live Stripe account has prices carrying the same lookup keys the app resolves (`pro_monthly`, `pro_annual`, `business_*`, and the founder variants) in every supported currency.
2. That the live webhook endpoint delivers and the signature verifies with the live secret.
3. That a live payment writes the subscription, applies entitlements, and — if founder pricing is in play — allocates a founding-member slot exactly once.

## Proposed verification (no product changes)

1. Read the live Stripe catalogue through the gateway and list every active price with its lookup key and currency; compare against the app's trusted price map and report any missing or mismatched key.
2. Confirm the live webhook endpoint exists, is enabled, and subscribes to the events the handler relies on.
3. Guided real-money smoke test on www.guestreviewpro.com: you subscribe with your own card on the cheapest monthly plan, we confirm the subscription row, entitlements and webhook event landed, then cancel and refund immediately from the billing portal.
4. Report the outcome, including anything that needs fixing before you promote checkout to customers.

## Technical notes

- Environment resolution lives in `src/lib/payments-env.server.ts`; return URLs stay on an allow-list, so nothing here is client-controllable.
- No code change is required to "switch off test mode" — switching happens by host. Forcing live in preview would mean setting `PAYMENTS_ENV=live`, which is not recommended: it would charge real cards from a preview link.
