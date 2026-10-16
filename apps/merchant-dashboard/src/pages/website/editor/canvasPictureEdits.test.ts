import { describe, expect, it } from "vitest";
import type { PageSection } from "@store-builder/api-client";
import type { CanvasEdit } from "@/lib/canvasDrag";
import { applyCanvasEdit, sizedPictureProps } from "./canvasEdits";

/**
 * A template band's picture resized on the canvas (canvasEdits.ts
 * sizedPictureProps): the size goes beside the picture, per screen, and with
 * "every picture" to the whole list — one tree edit, one undo step.
 */

type PictureEdit = Extract<CanvasEdit, { kind: "picture-size" }>;
const edit = (patch: Partial<PictureEdit>): PictureEdit => ({
  kind: "picture-size",
  sectionId: "s1",
  elementId: "e1",
  path: "items.1.image",
  device: "base",
  scope: "one",
  ...patch,
});

const banners = {
  look: "01",
  items: [
    { image: "/xs/01/a.jpg", title: "One" },
    { image: "/xs/01/b.jpg", title: "Two" },
    { image: "/xs/01/c.jpg", title: "Three" },
  ],
};

describe("a picture's size in the tree", () => {
  it("goes into the item that holds the picture", () => {
    const next = sizedPictureProps(banners, edit({ width: 320, height: 240 }));
    expect((next.items as Array<Record<string, unknown>>)[1]).toEqual({ image: "/xs/01/b.jpg", title: "Two", imageW: 320, imageH: 240 });
    expect((next.items as Array<Record<string, unknown>>)[0]).toEqual(banners.items[0]);
  });

  it("is kept per screen, and a computer's alone stays a plain number", () => {
    const desk = sizedPictureProps(banners, edit({ width: 320 }));
    const phone = sizedPictureProps(desk, edit({ device: "mobile", width: 200 }));
    expect((phone.items as Array<Record<string, unknown>>)[1].imageW).toEqual({ base: 320, mobile: 200 });
    const cleared = sizedPictureProps(phone, edit({ device: "mobile", width: null }));
    expect((cleared.items as Array<Record<string, unknown>>)[1].imageW).toBe(320);
    const gone = sizedPictureProps(cleared, edit({ width: null }));
    expect("imageW" in (gone.items as Array<Record<string, unknown>>)[1]).toBe(false);
  });

  it("goes to every item of the list with 'every picture'", () => {
    const next = sizedPictureProps(banners, edit({ scope: "band", height: 180 }));
    expect((next.items as Array<Record<string, unknown>>).map((item) => item.imageH)).toEqual([180, 180, 180]);
  });

  it("sits in the band itself for its own picture, and by place for a list of addresses", () => {
    expect(sizedPictureProps({ look: "02", image: "/x.png" }, edit({ path: "image", width: 420 }))).toMatchObject({ imageW: 420 });
    const split = { look: "02", images: ["/a.jpg", "/b.jpg", "/c.jpg"] };
    expect(sizedPictureProps(split, edit({ path: "images.2", height: 150 })).imagesH).toEqual([null, null, 150]);
    expect(sizedPictureProps(split, edit({ path: "images.0", scope: "band", width: 200 })).imagesW).toEqual([200, 200, 200]);
  });

  it("ignores a place that is not in the list", () => {
    expect(sizedPictureProps(banners, edit({ path: "items.7.image", width: 300 }))).toBe(banners);
  });
});

describe("a picture edit on the page", () => {
  const section = (props: Record<string, unknown>, type = "xs_banners"): PageSection =>
    ({ id: "s1", type: "section", rows: [{ id: "r1", type: "row", columns: [{ id: "c1", type: "column", span: 12, elements: [{ id: "e1", type, props }] }] }] }) as unknown as PageSection;

  it("changes the one band, and nothing when it changes nothing", () => {
    const sections = [section(banners)];
    const next = applyCanvasEdit(sections, edit({ width: 320 }));
    expect(next).not.toBe(sections);
    expect(applyCanvasEdit(next, edit({ width: 320 }))).toBe(next);
  });

  it("leaves anything but a template band alone, and the logo to the store look", () => {
    const sections = [section({ src: "/a.jpg" }, "image")];
    expect(applyCanvasEdit(sections, edit({ width: 320 }))).toBe(sections);
    expect(applyCanvasEdit(sections, { kind: "logo-size", part: "header", device: "base", px: 40 })).toBe(sections);
  });
});
