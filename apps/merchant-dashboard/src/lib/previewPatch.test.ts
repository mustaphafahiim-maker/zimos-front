import { describe, expect, it } from "vitest";
import type { PageTree } from "@store-builder/api-client";
import { diffTreePatch, patchKind } from "./previewBridge";

/** One section with one element. */
function tree(type: string, props: Record<string, unknown>): PageTree {
  return {
    version: 1,
    sections: [{ id: "s1", type: "section", rows: [{ id: "r1", type: "row", columns: [{ id: "c1", type: "column", span: 12, elements: [{ id: "e1", type, props }] }] }] }],
  } as unknown as PageTree;
}

const BAND = { look: "05", heading: "New arrivals", items: [{ title: "Shirts", image: "/xs/05/a.jpg", href: "/shirts" }], headingSize: 40 };

describe("patches for an imported template's band", () => {
  it("sends its whole own look when a size or colour changes", () => {
    const ops = diffTreePatch(tree("xs_banners", BAND), tree("xs_banners", { ...BAND, headingSize: { base: 48, mobile: 28 }, accentColor: "#e53637" }));
    expect(ops).toEqual([{ elementId: "e1", own: { headingSize: { base: 48, mobile: 28 }, accentColor: "#e53637" } }]);
    expect(patchKind(ops!)).toBe("colour");
    expect(patchKind(diffTreePatch(tree("xs_banners", BAND), tree("xs_banners", { ...BAND, headingSize: 52 }))!)).toBe("size");
  });

  it("sends changed words as they showed and as they are, in lists too", () => {
    const next = { ...BAND, heading: "Just in", items: [{ ...BAND.items[0], title: "Shirts and tees" }] };
    expect(diffTreePatch(tree("xs_banners", BAND), tree("xs_banners", next))).toEqual([
      { elementId: "e1", words: [["New arrivals", "Just in"], ["Shirts", "Shirts and tees"]] },
    ]);
  });

  it("sends a new picture by its place in the props", () => {
    const next = { ...BAND, items: [{ ...BAND.items[0], image: "/xs/05/b.jpg" }] };
    const ops = diffTreePatch(tree("xs_banners", BAND), tree("xs_banners", next));
    expect(ops).toEqual([{ elementId: "e1", pictures: { "items.0.image": "/xs/05/b.jpg" } }]);
    expect(patchKind(ops!)).toBe("picture");
  });

  it("renders for anything a patch cannot show: a link, a look, a list that grows, emptied words", () => {
    expect(diffTreePatch(tree("xs_banners", BAND), tree("xs_banners", { ...BAND, items: [{ ...BAND.items[0], href: "/tees" }] }))).toBeNull();
    expect(diffTreePatch(tree("xs_banners", BAND), tree("xs_banners", { ...BAND, look: "06" }))).toBeNull();
    expect(diffTreePatch(tree("xs_banners", BAND), tree("xs_banners", { ...BAND, items: [...BAND.items, BAND.items[0]] }))).toBeNull();
    expect(diffTreePatch(tree("xs_banners", BAND), tree("xs_banners", { ...BAND, heading: "" }))).toBeNull();
  });
});
