import { describe, expect, it, vi } from "vitest";
import type { PageElement, PageSection } from "@store-builder/api-client";
import { BLOCK_PRESETS, DEFAULT_PICTURE_SHAPE, IMAGE_RATIOS, createSection, createStarterSections, sectionElements } from "./blocks";

// The switch on: what the editor writes for a new block once VITE_PICTURE_SHAPE_DEFAULT_ENABLED is "true".
vi.mock("@/lib/features", async (original) => ({ ...(await original<typeof import("@/lib/features")>()), PICTURE_SHAPE_DEFAULT_ENABLED: true }));

/**
 * With the switch on, a block added from the library gives its full-width
 * pictures a 4:3 box, so the file a merchant then puts in fills that box
 * instead of setting the section's height. (pictureFields.test.ts holds the
 * other side: off, a new picture names no shape.)
 */

const preset = (key: string) => BLOCK_PRESETS.find((p) => p.key === key)!;
const images = (section: PageSection): PageElement[] => sectionElements(section).filter((e) => e.type === "image");

describe("a new picture's shape, with the switch on", () => {
  it("is one of the shapes the storefront draws", () => {
    expect(IMAGE_RATIOS.map((r) => r.value)).toContain(DEFAULT_PICTURE_SHAPE);
  });

  it("is given to the plain picture block and to a picture beside text", () => {
    for (const key of ["image", "hero-split", "image-text", "text-image", "multirow"]) {
      const pictures = images(createSection(preset(key)));
      expect(pictures.length, key).toBeGreaterThan(0);
      for (const picture of pictures) expect(picture.props?.ratio, key).toBe(DEFAULT_PICTURE_SHAPE);
    }
  });

  it("is given to the picture a new page starts with", () => {
    const pictures = createStarterSections("About us").flatMap(images);
    expect(pictures).toHaveLength(1);
    expect(pictures[0].props?.ratio).toBe(DEFAULT_PICTURE_SHAPE);
  });

  it("is not given to a picture that is sized as an icon, a logo or a mark, which a box would crop", () => {
    const sized = BLOCK_PRESETS.flatMap((p) => images(createSection(p))).filter((e) => {
      const size = e.props?.size;
      return (typeof size === "string" && size !== "" && size !== "full") || typeof e.props?.width === "number";
    });
    expect(sized.length).toBeGreaterThan(0);
    for (const picture of sized) expect(picture.props, JSON.stringify(picture.props)).not.toHaveProperty("ratio");
  });

  it("leaves every other new picture of the library with exactly that shape, and changes nothing else in a block", () => {
    for (const block of BLOCK_PRESETS) {
      for (const picture of images(createSection(block))) {
        const size = picture.props?.size;
        const full = (size === undefined || size === "" || size === "full") && picture.props?.width === undefined;
        expect(picture.props?.ratio, block.key).toBe(full ? DEFAULT_PICTURE_SHAPE : undefined);
      }
      // Only pictures gain a prop: every other element is as the block wrote it.
      for (const other of sectionElements(createSection(block)).filter((e) => e.type !== "image")) expect(other.props, block.key).not.toHaveProperty("ratio");
    }
  });
});
