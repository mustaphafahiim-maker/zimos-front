import { describe, expect, it } from "vitest";
import type { PageSection } from "@store-builder/api-client";
import { applyCanvasEdit } from "./canvasEdits";

function sections(type: string, props: Record<string, unknown>): PageSection[] {
  return [{ id: "s1", type: "section", rows: [{ id: "r1", type: "row", columns: [{ id: "c1", type: "column", span: 12, elements: [{ id: "e1", type, props }] }] }] }] as unknown as PageSection[];
}
const propsOf = (s: PageSection[]) => s[0].rows?.[0]?.columns?.[0]?.elements?.[0]?.props as Record<string, unknown>;
const item = (list: string, action: "move" | "duplicate" | "delete", from: number, to?: number) => ({ kind: "band-item" as const, sectionId: "s1", elementId: "e1", list, action, from, ...(to !== undefined ? { to } : {}) });
const BANNERS = { look: "05", items: [{ title: "A" }, { title: "B" }, { title: "C" }] };
const titles = (s: PageSection[]) => (propsOf(s).items as Array<{ title: string }>).map((i) => i.title).join("");

describe("a band's items on the canvas", () => {
  it("moves an item to another's place", () => {
    expect(titles(applyCanvasEdit(sections("xs_banners", BANNERS), item("items", "move", 0, 2)))).toBe("BCA");
    expect(titles(applyCanvasEdit(sections("xs_banners", BANNERS), item("items", "move", 2, 0)))).toBe("CAB");
  });

  it("duplicates after itself, up to the list's most", () => {
    expect(titles(applyCanvasEdit(sections("xs_banners", BANNERS), item("items", "duplicate", 1)))).toBe("ABBC");
    const full = sections("xs_banners", { look: "05", items: Array.from({ length: 6 }, (_, i) => ({ title: String(i) })) });
    expect(applyCanvasEdit(full, item("items", "duplicate", 0))).toBe(full);
  });

  it("deletes, never the last one", () => {
    expect(titles(applyCanvasEdit(sections("xs_banners", BANNERS), item("items", "delete", 0)))).toBe("BC");
    const one = sections("xs_banners", { look: "05", items: [{ title: "A" }] });
    expect(applyCanvasEdit(one, item("items", "delete", 0))).toBe(one);
  });

  it("moves a gallery picture's own sizes with it", () => {
    const s = sections("xs_gallery", { look: "19", images: ["/a.jpg", "/b.jpg", "/c.jpg"], imagesW: [100, 200, 300] });
    const next = propsOf(applyCanvasEdit(s, item("images", "move", 0, 2)));
    expect(next.images).toEqual(["/b.jpg", "/c.jpg", "/a.jpg"]);
    expect(next.imagesW).toEqual([200, 300, 100]);
  });
});
