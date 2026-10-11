/// <reference types="node" />
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { BLOCK_PRESETS, ELEMENT_SPECS, IMAGE_RATIOS, createSection, createStarterSections, sectionElements } from "./blocks";
import { fieldHint, fieldLabel, optionLabel } from "./editorLocale";

/**
 * A picture's shape and the part of it kept in view are plain props the
 * storefront reads (its page-renderer/pictureFrame.ts). The editor offers
 * them for a picture on its own, for the picture banner and for each category
 * tile; these tests hold the names on both sides together and the Arabic
 * wording in place.
 */

const PICTURE_FRAME = fileURLToPath(new URL("../../../../../storefront/src/components/page-renderer/pictureFrame.ts", import.meta.url));
/** A checkout on Windows may hand the file back with CRLF line ends. */
const read = (path: string) => readFileSync(path, "utf8").replace(/\r\n/g, "\n");
/** A line a merchant reads in the Arabic editor. */
const ARABIC = /\p{Script=Arabic}/u;

describe("a picture's shapes", () => {
  it("are the ones the storefront draws", () => {
    const source = read(PICTURE_FRAME);
    const table = source.slice(source.indexOf("export const PICTURE_RATIOS"), source.indexOf("} as const;"));
    const names = [...table.matchAll(/"(\d+:\d+)":/g)].map((m) => m[1]);
    expect(names.length).toBeGreaterThan(0);
    expect(IMAGE_RATIOS.map((r) => r.value)).toEqual(names);
  });
});

describe("a picture's shape and focus in the editor", () => {
  const selectOf = (type: "image" | "image_banner", key: string) => {
    const field = ELEMENT_SPECS[type].fields.find((f) => f.key === key);
    return field?.kind === "select" ? field : null;
  };

  it("are offered for a picture on its own, in Arabic too", () => {
    expect(selectOf("image", "ratio")?.options).toEqual(IMAGE_RATIOS);
    expect(selectOf("image", "focusY")?.options.map((o) => o.value)).toEqual(["top", "center", "bottom"]);
    expect(selectOf("image", "focusX")?.options.map((o) => o.value)).toEqual(["start", "center", "end"]);
    for (const key of ["ratio", "focusY", "focusX"]) {
      expect(fieldLabel("image", key, "", "ar")).toMatch(ARABIC);
      expect(fieldHint("image", key, "x", "ar")).toMatch(ARABIC);
      for (const option of selectOf("image", key)!.options) expect(optionLabel(key, option.value, "", "ar"), `${key}.${option.value}`).toMatch(ARABIC);
    }
    // A picture that never chose a shape starts with none: it is drawn as before.
    expect(ELEMENT_SPECS.image.defaultProps).toEqual({ src: "", alt: "" });
  });

  it("no block of the library gives a new picture a shape while the default-shape switch is off", () => {
    // VITE_PICTURE_SHAPE_DEFAULT_ENABLED is not set here (pictureShapeDefault.test.ts turns it on).
    for (const block of BLOCK_PRESETS) {
      for (const element of sectionElements(createSection(block))) expect(element.props, block.key).not.toHaveProperty("ratio");
    }
    for (const section of createStarterSections("About us")) {
      for (const element of sectionElements(section)) expect(element.props).not.toHaveProperty("ratio");
    }
  });

  it("the part kept in view is offered for the banner and for each category tile", () => {
    for (const key of ["focusY", "focusX"]) {
      expect(selectOf("image_banner", key)).not.toBeNull();
      expect(fieldLabel("image_banner", key, "", "ar")).toMatch(ARABIC);
      expect(fieldHint("image_banner", key, "x", "ar")).toMatch(ARABIC);
    }
    const tiles = ELEMENT_SPECS.category_tiles.fields.find((f) => f.key === "items");
    const keys = tiles?.kind === "itemList" ? tiles.fields.map((f) => f.key) : [];
    expect(keys).toEqual(["image", "title", "titleEn", "href", "focusY", "focusX"]);
    // Neither starts with a focus of its own.
    expect(ELEMENT_SPECS.image_banner.defaultProps).not.toHaveProperty("focusX");
    expect(ELEMENT_SPECS.category_tiles.defaultProps).toMatchObject({ items: [] });
  });
});
