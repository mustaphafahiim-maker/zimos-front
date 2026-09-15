import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { PageRenderer, isElementVisible } from "../PageRenderer";
import { SECTION_BY_ID } from "../sections";
import { validatePageTree, type Tree, type TreeElement } from "../tree";

const ctx = { locale: "ar" as const };
const html = (tree: Tree, editing = false) =>
  renderToStaticMarkup(<PageRenderer tree={tree} ctx={editing ? { ...ctx, editor: { enabled: true, selectedPath: null } } : ctx} />);
const one = (id: string, locale: "ar" | "en" = "ar"): Tree => ({ version: 1, sections: [SECTION_BY_ID[id].create({ locale })] });

describe("new sections", () => {
  it.each(["marquee-strip", "comparison", "bundles", "before-after"])("%s is a valid backend tree in both languages", (id) => {
    for (const locale of ["ar", "en"] as const) expect(validatePageTree(one(id, locale), { requireContent: true }).errors).toEqual([]);
  });

  it("marquee renders two tracks, the copy hidden from screen readers", () => {
    const out = html(one("marquee-strip"));
    expect(out.match(/zr-marquee__track/g)).toHaveLength(2);
    expect(out).toContain('aria-hidden="true"');
    expect(out).toContain("الدفع عند الاستلام");
  });

  it("comparison table turns ✓ / ✗ into marks and keeps the text for screen readers", () => {
    const out = html(one("comparison"));
    expect(out).toContain("zr-table--compare");
    expect(out).toContain("zr-mark--yes");
    expect(out).toContain("zr-mark--no");
    expect(out).toContain('<span class="zr-sr">✓</span>');
  });

  it("bundles highlight the tier with a badge", () => {
    const out = html(one("bundles"));
    expect(out.match(/zr-col--highlight/g)).toHaveLength(1);
    expect(out).toContain("العرض المقترح");
  });

  it("before/after shows placeholders until two real images exist, then the slider", () => {
    const tree = one("before-after");
    expect(html(tree)).toContain("zr-ba--ph");
    const gallery = tree.sections[0].rows[1].columns[0].elements[0] as TreeElement;
    gallery.props = { ...gallery.props, images: ["https://cdn.example.com/a.jpg", "https://cdn.example.com/b.jpg"], placeholderCount: 0 };
    const out = html(tree);
    expect(out).toContain('type="range"');
    expect(out).toContain("zr-ba__before");
    expect(out).toContain("قبل");
  });

  it("compare-mode gallery needs two images (or placeholders) to be visible", () => {
    const el = (images: string[], placeholderCount = 0): TreeElement => ({ id: "g", type: "gallery", props: { mode: "compare", images, placeholderCount } });
    expect(isElementVisible(el(["https://a.test/1.jpg"]))).toBe(false);
    expect(isElementVisible(el(["https://a.test/1.jpg", "https://a.test/2.jpg"]))).toBe(true);
    expect(isElementVisible(el([], 2))).toBe(true);
  });
});
