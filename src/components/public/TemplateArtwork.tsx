import { ArtworkPreview } from "@/components/public/ArtworkPreview";
import type { GalleryTemplate } from "@/lib/templates";

/**
 * Gallery card artwork — the same renderer the landing page uses, fed from a
 * catalogue entry so every public preview looks identical in quality.
 */
export function TemplateArtwork({ template }: { template: GalleryTemplate }) {
  return (
    <ArtworkPreview
      formatId={template.formatId}
      layout={template.layout}
      label={`${template.name} artwork preview for ${template.demoBusiness}`}
      content={{
        business: template.demoBusiness,
        headline: template.headline,
        subline: template.subline,
        cta: "Leave a review",
        footer: "Scan with your phone camera",
      }}
    />
  );
}
