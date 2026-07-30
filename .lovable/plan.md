# Stripe go-live review — what's done and what's left

## Confirmed complete on your side

All five go-live steps report completed: sandbox claimed, Stripe go-live form submitted, Lovable app installed on your live account, live API keys provisioned, readiness check passed. Live account is connected alongside the sandbox.

Also verified in the app:

- Live and test client tokens are both present in the build config, and the code picks the environment from the token prefix (never silently defaults to live).
- Live and sandbox webhook secrets and gateway API keys are all present.
- Webhook handler exists at the required public path and updates subscription state.
- Checkout uses embedded mode, resolves one Stripe customer per account, blocks a second active subscription, and stamps plan/region metadata on both the session and subscription.
- Customer portal session is auth-protected and scoped to the caller's own billing record.

## Gaps I'd close before taking real money

1. **Tax is currently switched off.** Checkout only enables Stripe tax when the `STRIPE_AUTOMATIC_TAX_ENABLED` flag is set, and it is not set. As an NZ-based seller you aren't eligible for Stripe's full compliance handling, so the right setting is tax calculation and collection at checkout (+0.5% per transaction), with you handling registration, filing and remittance. This also needs a tax code on each of the two products (SaaS/electronic services) so tax is calculated correctly.

2. **No test-mode banner.** Nothing tells a user in the preview/test environment that their payment isn't real, and nothing warns if a production build ever ships without a live token. A small always-mounted banner covers both.

3. **Welcome emails are a no-op.** The upgrade flow tries to send a welcome email but the sender domain isn't configured, so it silently skips. Either set up email on guestreviewpro.com or accept that upgrades are silent for now.

4. **Live catalogue sync depends on publishing.** Products and prices sync test → live on publish. If you haven't published since the catalogue was created, live checkout will fail with "no price configured". Worth a publish plus one live verification.

5. **No end-to-end live smoke test yet.** A single real low-value transaction (or a live-mode check that prices resolve) confirms the whole chain: checkout → webhook → subscriptions row → entitlements unlocked → portal cancel.

## What I'd change in code

- `src/lib/stripe.server.ts` / deployment config: enable the automatic-tax flag so `automatic_tax: { enabled: true }` is sent on every checkout session.
- One-off Stripe product update setting the correct tax code on both GuestReview Pro and GuestReview Business.
- New `src/components/PaymentTestModeBanner.tsx`, mounted once in `src/routes/__root.tsx`: orange notice on test tokens, red "production checkout not configured" notice when no token, nothing on live.

Nothing else in the billing stack needs changing — entitlements, region locks, over-limit handling and the QR redirect path are all untouched by this.
