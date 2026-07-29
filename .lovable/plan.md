## Goal

Make `/r/<code>` redirect a scanning phone to Google without loading the React app first. Today the phone downloads the app bundle, runs `GuestLanding`, queries the database from the browser, then redirects. The new path answers the very first HTTP request with a `302`.

## How it works

```text
now:   phone -> /r/CODE -> HTML + JS bundle -> hydrate -> DB query -> location.href = google
after: phone -> /r/CODE -> [server: DB lookup] -> 302 Location: google
```

## Changes

**1. Add a server GET handler to `src/routes/r.$code.tsx`**

The file keeps its UI component, and gains a `server.handlers.GET` block that runs on the edge before any HTML is produced:

- Look up the QR row by `short_code` using a server-side publishable-key Supabase client (created inside the handler, per the server-function rules). Select only the columns needed to decide: status, expiry, destination fields, landing mode, business `google_review_url`, plus the ids needed for logging.
- Reuse the existing `resolveQrDestination` helper unchanged, so redirect precedence and URL validation stay identical to today.
- If the QR is active, `landing_mode` is redirect, and the resolver returns a URL: return `Response.redirect(url, 302)` with `Cache-Control: no-store`.
- Everything else (not found, paused, expired, archived, invalid destination, `landing_mode = landing`) redirects to a new companion route that renders the existing UI.

**2. Add `src/routes/r.$code.view.tsx`**

The current `GuestLanding` component moves here essentially as-is, so the branded landing page and all status pages keep working, including their own analytics and "clicked review" tracking. `r.$code.tsx` becomes a thin server-redirect route.

**3. Analytics without slowing the redirect**

Add a single database function, `log_scan_redirect`, that inserts the `scan_events` row and bumps `scans_count` in one call, returning the new event id. The handler makes one call to it and then redirects — one round trip instead of the current bundle-load plus multiple browser round trips.

- Device/OS/browser come from the request `User-Agent` header, referrer from the `Referer` header, IP-derived nothing (unchanged privacy posture).
- Session dedupe moves from `sessionStorage` to a short-lived `httpOnly` cookie per QR code, preserving the "don't double-count the same visitor" behaviour.
- Because a server 302 guarantees the guest reaches the destination, the event is written with `destination_clicked = true` immediately. Landing-mode scans keep the existing click-tracking flow on the view route.

**4. Migration**

One migration adding the `log_scan_redirect` security-definer function, with `EXECUTE` granted to `anon` and `authenticated` (matching how scans are already recorded anonymously today). No table or policy changes.

## Verification

- Hit `/r/<code>` for the Glasshouse code with a redirect-following disabled request and confirm a `302` with the Google review URL in `Location`.
- Confirm a `scan_events` row is written and `scans_count` increments.
- Confirm a landing-mode QR still shows the branded page, and paused/expired/archived/invalid codes still show their status pages.
- Confirm a second request within the cookie window does not double-count.

## Known trade-offs

- Non-redirect scans (landing mode, status pages) gain one extra tiny hop to `/r/<code>/view`.
- The scan event is recorded as "clicked" at redirect time rather than on a confirmed arrival at Google — there is no way to observe the arrival from a 302, and this matches what the redirect actually guarantees.
