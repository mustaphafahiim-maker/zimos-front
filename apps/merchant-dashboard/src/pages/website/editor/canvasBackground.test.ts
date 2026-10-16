import { describe, expect, it } from "vitest";
import type { PageSection } from "@store-builder/api-client";
import { setBackgroundPosition } from "./canvasEdits";

function section(type: string, props: Record<string, unknown>): PageSection {
  return { id: "s1", type: "section", rows: [{ id: "r1", type: "row", columns: [{ id: "c1", type: "column", span: 12, elements: [{ id: "e1", type, props }] }] }] } as unknown as PageSection;
}
const propsOf = (s: PageSection) => s.rows?.[0]?.columns?.[0]?.elements?.[0]?.props as Record<string, unknown>;
const edit = (path: string, x: number, y: number) => ({ kind: "bg-position" as const, sectionId: "s1", elementId: "e1", path, x, y });

describe("a band's ground picture centred on the canvas", () => {
  it("saves a slide's point beside its picture", () => {
    const s = section("xs_slider", { look: "05", slides: [{ image: "/xs/05/a.jpg" }, { image: "/xs/05/b.jpg" }] });
    expect(propsOf(setBackgroundPosition(s, edit("slides.1.image", 70, 28))).slides).toEqual([{ image: "/xs/05/a.jpg" }, { image: "/xs/05/b.jpg", imagePosition: "70% 28%" }]);
  });

  it("saves a title's or newsletter's point beside its picture", () => {
    const s = section("xs_title", { look: "18", image: "/xs/18/hero-bg.jpg" });
    expect(propsOf(setBackgroundPosition(s, edit("image", 0, 100))).imagePosition).toBe("0% 100%");
  });

  it("changes nothing for the same point, a missing slide, or a band that is not a template's", () => {
    const s = section("xs_title", { look: "18", image: "/x.jpg", imagePosition: "50% 50%" });
    expect(setBackgroundPosition(s, edit("image", 50, 50))).toBe(s);
    const slider = section("xs_slider", { slides: [{ image: "/a.jpg" }] });
    expect(setBackgroundPosition(slider, edit("slides.4.image", 10, 10))).toBe(slider);
    const plain = section("image_banner", { image: "/a.jpg" });
    expect(setBackgroundPosition(plain, edit("image", 10, 10))).toBe(plain);
  });
});
