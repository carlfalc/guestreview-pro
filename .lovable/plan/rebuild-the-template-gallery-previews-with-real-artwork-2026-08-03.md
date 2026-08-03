# Rebuild the template gallery previews with real artwork

## What's wrong today

The gallery previews are drawn by a separate, older renderer (`TemplatePreview`) that is much cruder than the artwork the app actually produces:

- Text is positioned with fixed ratios that ignore the format's shape, so on circular and small formats headlines and sublines run across the code plate and outside the die-cut edge.
- Flat colour blocks only — no photo background, no scrim, no star row, no CTA pill, no footer line, none of the folded geometry.
- The result looks nothing like what a customer gets, which undersells the product.

Meanwhile the landing page now uses a much better renderer (`ArtworkPreview`) with true format geometry, safe-area clipping, photo backgrounds, stars, CTA pills and a proper folded tent layout.

## The Glasshouse reference

The Glasshouse marketing pack in the account is the quality bar:

- Layout: premium dark
- Headline: "Loved your visit?" / Support: "Scan to leave us a review." / CTA: "Leave a review" / Footer: "Thank you for supporting us"
- Business name, logo, stars and Google badge all shown
- Photo background applied globally
- Formats chosen: A6 portrait, A5 table tent, DL portrait, 150 mm window decal, A4 poster, A6 acrylic

These are the exact settings the gallery previews should mirror.

## What to build

1. **Retire `TemplatePreview` and render the gallery with the same engine as the landing page.** Promote `ArtworkPreview` into a shared preview component that accepts a format id, a layout style and demo content, and use it on the template gallery, industry pages and the landing page so every public preview looks identical in quality.
2. **Give the renderer full layout coverage** so each gallery entry uses its template's own style — premium dark (Glasshouse style, photo + scrim), clean minimal, brand colour, hospitality, bold review, window sticker and circular sticker — instead of one hard-coded look.
3. **Fix the overflow class of bugs, not one instance.** Every panel gets a shared safe-area model: content is clipped to the die shape, text sits inside the safe inset for that format, and headline/subline sizes step down automatically on small formats (60 mm dots, DL, key-card) so nothing crosses a bleed or cut line. Applies to circular, square, portrait, landscape and folded shapes.
4. **Match the Glasshouse copy and structure** as the default demo content: business name, star row, headline, CTA pill, footer line and Google badge, with the same premium-dark treatment on photo formats.
5. **Complete the catalogue.** Twelve supported formats currently have no gallery template (100 mm circle, 60/100 mm squares, 100x70 rectangle, A6 landscape, DL portrait and landscape, A6 and DL acrylic, A5 poster, A4 landscape poster, lift panel, Instagram story, Facebook post). Add an entry for each, add "Acrylic stands" as a category, and fold the social graphics into Digital.
6. **Keep the page layout, filters and copy as they are** — only the previews and the catalogue change.

## Naming on public pages

The gallery is a public, indexable page, so entries keep fictional demo business names. The Glasshouse pack is used as the design and copy reference, not as published customer content. Say the word if you'd rather show the real Glasshouse branding on the public gallery.

## Technical notes

- New shared component under `src/components/public/`, derived from `src/components/public/ArtworkPreview.tsx`; delete `TemplatePreview.tsx` once nothing imports it.
- Layout colour resolution reuses `templateColors` from `src/lib/qr-formats.ts`; geometry comes from `FORMATS`; catalogue additions go in `src/lib/templates.ts`.
- Safe-area insets stored per shape in the renderer, derived from the same bleed/safe values the export pipeline uses, so previews and exports stay in agreement.
- Add a test asserting every printable format has at least one gallery template.
- No database, export, pricing or marketing-pack logic changes.

## Verification

Screenshot the full gallery at desktop and mobile widths and check every card for text crossing a bleed or cut line before reporting done.
