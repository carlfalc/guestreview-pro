# Post-publish live checkout verification

Short answer: yes. Once the publish finishes, the live site builds with the live payments token, so checkout runs against your live Stripe account, uses the live prices, and the webhook writes real subscription rows.

## What is already confirmed

- The published build uses the live payments token (the production environment file holds a `pk_live_` token; preview keeps the `pk_test_` one).
- Both GuestReview products and all 24 regional prices exist in live with amounts identical to the app's pricing table.
- Both live products carry the SaaS tax code, and tax calculation is on at checkout.
- Checkout is fully server-driven: the browser only sends tier and interval; region, currency, amount and price are resolved server-side from the locked account region, so a user cannot pick a cheaper price.
- Duplicate subscriptions are blocked before a session is created.
- The webhook route validates the environment and records events for the matching environment.

## What is not yet proven end to end

No real live transaction has run through the chain yet. Only a live payment proves that the live webhook endpoint is registered and signing correctly, and that entitlements unlock.

## Proposed verification (no code changes unless something fails)

1. Confirm the live webhook endpoint is registered on the live Stripe account and points at the published domain with the live environment parameter.
2. You run one real low-value checkout on the published site (Pro monthly, then cancel immediately for a refund/proration).
3. I check, in order: the Stripe payment succeeded, the webhook event was recorded as processed, the subscription row was written with the live environment, the plan shows as Pro in the app, and the billing portal opens and cancels correctly.
4. If any step fails, I fix that step only and we re-test.

## Notes

- Welcome/transactional emails still skip silently until an email domain is set up for the domain; unrelated to checkout.
- Regions outside the six supported currencies correctly bill in USD at the international price.
