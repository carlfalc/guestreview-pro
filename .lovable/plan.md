# Complete the template gallery

## Short answer

No — the gallery is not the complete list. The page currently shows **19 templates**, but the product supports **31 real print/digital formats**. Twelve formats have no template in the gallery at all, so visitors see a smaller product than they actually get.

## Formats with no gallery template today

| Missing format | What it is |
|---|---|
| sticker-circle-100 | 100 mm circular sticker (large counter/floor) |
| sticker-sq-60 | 60 mm square sticker |
| sticker-sq-100 | 100 mm square sticker |
| sticker-rect-100x70 | 100x70 mm rectangular sticker |
| a6-landscape | A6 landscape counter card |
| dl-portrait | DL portrait card |
| dl-landscape | DL landscape card |
| acrylic-a6 | A6 acrylic stand insert |
| acrylic-dl | DL acrylic stand insert |
| poster-a5-p | A5 portrait poster |
| poster-a4-l | A4 landscape poster |
| lift-a4 | Lift / corridor A4 panel |
| ig-story | Instagram story graphic |
| fb-portrait | Facebook / social post graphic |

(The four "pack" entries — essential, restaurant, hotel, retail — are bundles, not printable formats, so they stay out of the gallery.)

## What to build

1. **Add one template per missing format** (14 new entries in the gallery catalogue), each with a fictional demo business, headline, subline, material, placement, industries and search keywords — matching the style and safe-demo rule of the existing entries.
2. **Balance industry coverage.** Motels (4) and tourism (4) are under-represented versus salons (8) and retail (7). New entries will be tagged so every industry has at least six matching templates, so industry filters never look empty.
3. **Add two gallery categories** so the new formats file correctly:
   - "Acrylic stands" (acrylic-a6, acrylic-dl)
   - "Social" — or fold the Instagram/Facebook graphics into the existing "Digital" category
4. **Keep the page structure identical** — same search box, same category and industry filters, same card layout and preview renderer. Only the catalogue and the category list grow.
5. **Update SEO metadata** so the ItemList count and the meta description reflect the full set (stickers, table tents, reception signs, room cards, window decals, posters, acrylic stands, digital).

## Technical notes

- Catalogue lives in `src/lib/templates.ts` (`GALLERY_TEMPLATES`, `GALLERY_CATEGORIES`); the page is `src/routes/templates.tsx`. Both already render dimensions from `FORMATS` in `src/lib/qr-formats.ts`, so new entries only need a valid `formatId`.
- No database, pricing, export or marketing-pack changes. No new components — `TemplatePreview` already handles every shape.
- Add a small test asserting that every printable format in `FORMATS` has at least one gallery template, so future formats can't silently go missing.

## Out of scope

Print Store, AI copy, pricing and export logic stay untouched.
