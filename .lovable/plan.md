# Upgrade the "QR design examples" section on the landing page

Today that section shows four identical white squares with the same decorative QR motif. It looks like placeholder art and undersells the product. Your Glasshouse screenshots show what the app actually produces: a photographic venue background, brand name, star row, headline, subline, "Leave a review" CTA pill and a footer credit — in real format shapes.

## What changes

Replace the four flat squares with four real-looking artwork previews that mirror what a customer gets in the editor:

- **Circular sticker (80 mm)** — genuinely round, brand mark + QR + short CTA.
- **Folded A5 table tent** — shown as a real folded tent: back panel rotated 180°, fold line across the middle, exactly like the editor proof.
- **A6 counter card** — portrait, photographic background with dark scrim, name, stars, headline, subline, CTA pill, footer credit.
- **A4 poster** — portrait, larger QR, same brand system.

Each card gains: true aspect ratio for its format, a soft drop shadow and slight perspective so it reads as a physical product on the dark page, and a small caption line with real size/material ("A6 · 350 gsm · counter or reception").

Under the grid, one line of proof text plus a link to the full template gallery (`/templates`) and the pricing CTA.

## Content shown

Safe demo brand content only (no customer data on a public page), styled to match your Glasshouse example: warm hospitality interior photo, deep-green accent, "Loved your visit?" / "Scan to leave us a review." / "Leave a review" pill / "Created with GuestReview Pro".

If you would rather showcase Glasshouse by name as a real customer example, say so and I will swap the demo name and photo for it.

## Technical notes

- New component `src/components/public/ArtworkPreview.tsx`, built the same dependency-free way as the existing `TemplatePreview` — inline SVG, no `qr-code-styling` on the public bundle, no layout shift, sharp at any size.
- Reuses real geometry from `src/lib/qr-formats.ts` (`FORMATS`, `safeArea`, `templateColors`) so shapes and proportions match production exports rather than being hand-drawn.
- Folded tent preview reuses the front/back + rotation model from `src/lib/folded-layouts.ts`.
- The QR module grid stays a deterministic decorative pattern (as it is now); previews are artwork, not scannable codes.
- One hospitality background image added via the assets pipeline, `loading="lazy"`, reused across the cards.
- Only `src/routes/index.tsx` and the new component change. No backend, pricing, packs, exports or editor behaviour is touched.
