import { describe, expect, it } from "vitest";
import { FORMATS } from "@/lib/qr-formats";
import { GALLERY_TEMPLATES, GALLERY_CATEGORIES, templateFormat } from "@/lib/templates";

describe("template gallery catalogue", () => {
  it("covers every supported format with at least one template", () => {
    const covered = new Set(GALLERY_TEMPLATES.map((t) => t.formatId));
    const missing = FORMATS.filter((f) => !covered.has(f.id)).map((f) => f.id);
    expect(missing).toEqual([]);
  });

  it("resolves every template to a real format", () => {
    for (const t of GALLERY_TEMPLATES) expect(() => templateFormat(t)).not.toThrow();
  });

  it("uses known categories and unique ids", () => {
    const known = new Set(GALLERY_CATEGORIES.map((c) => c.id));
    for (const t of GALLERY_TEMPLATES) expect(known.has(t.category)).toBe(true);
    expect(new Set(GALLERY_TEMPLATES.map((t) => t.id)).size).toBe(GALLERY_TEMPLATES.length);
  });
});
