import { describe, expect, it } from "vitest";
import {
  logoHeightAt,
  pictureSizeAt,
  readCanvasDrag,
  readCanvasStep,
  resolveDrag,
  stepEdit,
  type LogoGeometry,
  type PictureGeometry,
} from "./canvasDrag";
import { valueOnDevice, withDeviceValue } from "./deviceValue";

/**
 * Resizing a template band's picture, or a template logo, by its edges and
 * corners on the canvas (lib/canvasDrag.ts): the size a drag or an arrow
 * press gives, and the edit it makes.
 */

const LABELS = { auto: "Auto", original: "template size", everyPicture: "every picture" };

/** A 400 × 300 picture, the look's own size, in an 800-wide box. */
const picture = (patch: Partial<PictureGeometry> = {}): PictureGeometry => ({
  kind: "picture",
  sectionId: "s1",
  elementId: "e1",
  path: "items.1.image",
  handle: "se",
  width: 400,
  height: 300,
  naturalWidth: 400,
  naturalHeight: 300,
  boxWidth: 800,
  device: "base",
  ...patch,
});

describe("a picture's size after a drag", () => {
  it("follows the pointer on both sides from a corner, a width snapping to twentieths of its box", () => {
    const size = pictureSizeAt(picture(), 83, -50);
    expect(size.width).toBe(480); // 483 → the nearest 40px (5% of 800)
    expect(size.height).toBe(250);
    expect(size.touches).toEqual({ width: true, height: true });
  });

  it("moves only its own side from an edge", () => {
    const size = pictureSizeAt(picture({ handle: "e" }), 120, 90);
    expect(size.width).toBe(520);
    expect(size.height).toBeNull();
    expect(size.touches).toEqual({ width: true, height: false });
  });

  it("grows towards the left from the left edge, and twice as far with Alt", () => {
    expect(pictureSizeAt(picture({ handle: "w" }), -80, 0).width).toBe(480);
    expect(pictureSizeAt(picture({ handle: "w" }), -80, 0, { alt: true }).width).toBe(560);
  });

  it("keeps its shape with Shift, whichever side leads", () => {
    const wide = pictureSizeAt(picture(), 160, 0, { shift: true });
    expect(wide.width).toBe(560);
    expect(wide.height).toBe(420);
    const fromEdge = pictureSizeAt(picture({ handle: "s" }), 0, 75, { shift: true });
    expect(fromEdge.touches).toEqual({ width: true, height: true });
    expect(fromEdge.height! / fromEdge.width!).toBeCloseTo(0.75, 1);
  });

  it("snaps back to the look's own size near it, saved as null", () => {
    const back = pictureSizeAt(picture({ width: 600, height: 300 }), -195, 0);
    expect(back.width).toBeNull();
    expect(back.shown.width).toBe(400);
  });

  it("never grows wider than its box, nor smaller than 24px", () => {
    expect(pictureSizeAt(picture(), 5000, 0).width).toBe(800);
    expect(pictureSizeAt(picture({ handle: "s" }), 0, -5000).height).toBe(24);
  });
});

describe("a picture drag as an edit", () => {
  const start = { x: 100, y: 100, shift: false };

  it("is one picture-size edit for the screen being previewed", () => {
    const { feedback, edit } = resolveDrag({ drag: picture({ device: "mobile" }), start }, { x: 180, y: 160, shift: false }, LABELS);
    expect(edit).toEqual({ kind: "picture-size", sectionId: "s1", elementId: "e1", path: "items.1.image", device: "mobile", scope: "one", width: 480, height: 360 });
    expect(feedback).toMatchObject({ kind: "picture", scope: "one", label: "480 × 360" });
  });

  it("gives every picture of the band the size with Ctrl/⌘", () => {
    const { feedback, edit } = resolveDrag({ drag: picture({ handle: "e" }), start }, { x: 180, y: 100, shift: false, ctrl: true }, LABELS);
    expect(edit).toMatchObject({ scope: "band", width: 480 });
    expect(edit && "height" in edit).toBe(false);
    expect(feedback?.kind === "picture" && feedback.label).toBe("480 × 300 · every picture");
  });

  it("changes nothing when released where it started", () => {
    expect(resolveDrag({ drag: picture(), start }, start, LABELS).edit).toBeNull();
  });

  it("says when the picture is back at the template's size", () => {
    const { feedback, edit } = resolveDrag({ drag: picture({ width: 520, height: 300, handle: "e" }), start }, { x: -20, y: 100, shift: false }, LABELS);
    expect(edit).toMatchObject({ width: null });
    expect(feedback?.kind === "picture" && feedback.label).toBe("400 × 300 · template size");
  });
});

describe("a picture's arrow keys", () => {
  const step = {
    kind: "picture" as const,
    sectionId: "s1",
    elementId: "e1",
    path: "images.0",
    device: "tablet" as const,
    axis: "w" as const,
    delta: 1 as const,
    fine: false,
    band: false,
    width: 410,
    height: 300,
    naturalWidth: 400,
    naturalHeight: 300,
    boxWidth: 800,
  };

  it("steps the width to the next twentieth of the box, or one pixel with Shift", () => {
    expect(stepEdit(step)).toMatchObject({ kind: "picture-size", device: "tablet", scope: "one", width: 440 });
    expect(stepEdit({ ...step, fine: true, delta: -1 })).toMatchObject({ width: 409 });
  });

  it("steps the height by 8px, stopping on the look's own (saved as null)", () => {
    expect(stepEdit({ ...step, axis: "h", height: 302, delta: -1 })).toMatchObject({ height: null });
    expect(stepEdit({ ...step, axis: "h", height: 320, delta: -1 })).toMatchObject({ height: 312 });
    expect(stepEdit({ ...step, axis: "h", height: 300, delta: 1 })).toMatchObject({ height: 304 });
  });
});

describe("a template logo's size", () => {
  const logo = (patch: Partial<LogoGeometry> = {}): LogoGeometry => ({
    kind: "logo",
    sectionId: "header",
    handle: "se",
    width: 160,
    height: 40,
    naturalHeight: 40,
    device: "base",
    ...patch,
  });

  it("keeps its shape: a sideways drag scales its height, in 2px steps", () => {
    expect(logoHeightAt(logo(), 80, 0)).toBe(60);
    expect(logoHeightAt(logo({ handle: "sw" }), 80, 0)).toBe(20);
  });

  it("stays within the header's range and snaps back to the look's own", () => {
    expect(logoHeightAt(logo(), 4000, 0)).toBe(140);
    expect(logoHeightAt(logo({ height: 60 }), -60, 0)).toBeNull();
  });

  it("is a logo-size edit for the store look", () => {
    const { edit } = resolveDrag({ drag: logo({ sectionId: "footer", device: "mobile" }), start: { x: 0, y: 0, shift: false } }, { x: 40, y: 0, shift: false }, LABELS);
    expect(edit).toEqual({ kind: "logo-size", part: "footer", device: "mobile", px: 50 });
  });
});

describe("the frame's picture and logo messages", () => {
  it("are read field by field", () => {
    const start = readCanvasDrag({ phase: "start", x: 1, y: 2, shift: false, alt: true, ctrl: true, drag: { ...picture() } });
    expect(start).toMatchObject({ phase: "start", pointer: { alt: true, ctrl: true }, drag: { kind: "picture", path: "items.1.image" } });
    expect(readCanvasDrag({ phase: "start", x: 1, y: 2, drag: { ...picture(), path: "items.1.image;x" } })).toBeNull();
    expect(readCanvasDrag({ phase: "start", x: 1, y: 2, drag: { ...picture(), handle: "middle" } })).toBeNull();
    expect(readCanvasStep({ kind: "logo", sectionId: "aside", device: "base", delta: 1, current: 40, natural: 40 })).toBeNull();
    expect(readCanvasStep({ kind: "logo", sectionId: "footer", device: "base", delta: 1, current: 40, natural: 40 })).toMatchObject({ kind: "logo" });
  });
});

describe("a setting per screen", () => {
  it("stays a plain value while only a computer's is set", () => {
    expect(withDeviceValue(undefined, "base", 48)).toBe(48);
    expect(withDeviceValue(48, "mobile", 28)).toEqual({ base: 48, mobile: 28 });
    expect(withDeviceValue({ base: 48, mobile: 28 }, "mobile", null)).toBe(48);
    expect(withDeviceValue(48, "base", null)).toBeUndefined();
  });

  it("falls back from a phone to a tablet to a computer", () => {
    expect(valueOnDevice({ base: 48, tablet: 36 }, "mobile")).toBe(36);
    expect(valueOnDevice({ base: 48 }, "tablet")).toBe(48);
    expect(valueOnDevice(48, "mobile")).toBe(48);
  });
});
