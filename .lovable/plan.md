## What's actually wrong

Your published site is **public** — I checked, and the anonymous access rules for QR codes, businesses and locations are all correct. So the redirect page itself is fine.

The problem is the **address baked into the QR image**.

Both places that build the QR link use the address of whatever window you were in when you designed/downloaded it:

- `src/routes/_authenticated/qr.$id.tsx` (line 117)
- `src/routes/_authenticated/marketing-packs.$id.tsx` (line 173)

Both do `window.location.origin + "/r/" + short_code`.

When you build the pack inside the Lovable editor preview, that origin is the private preview address (`id-preview--….lovable.app`). That address is always behind the Lovable login, no matter what your publish settings say. So the printed Glasshouse QR literally points at a login-gated URL — which is exactly what your phone hit.

## The fix

1. Add a single canonical public base URL for scan links (`https://www.guestreviewpro.com`), defined in one shared helper — e.g. `src/lib/public-url.ts` exporting `buildScanUrl(shortCode)`.
2. Use that helper in both files above, so every QR, preview, export, PDF and marketing pack encodes the public domain regardless of where you're working.
3. Keep a localhost fallback so local development still works.
4. Show the resolved scan URL as plain text under the QR in the designer, so you can eyeball the domain before printing.
5. Re-generate and re-download the Glasshouse QR/pack once the fix is in. Anything already printed with the preview URL will need reprinting — the short code stays the same, only the domain changes.

## Technical notes

- No database changes; `short_code` and all existing rows stay as they are.
- No change to destination resolution — `resolve-qr-destination.ts` and `/r/$code` behaviour are untouched.
- Optional follow-up: also accept the custom domains you already have (`googlereviewpro.com`, `guestreviewpro.com`) — one is chosen as canonical for printed codes.

## Test

Scan the newly exported Glasshouse QR on a phone with no Lovable session — it should jump straight to the Google review page with no login.
