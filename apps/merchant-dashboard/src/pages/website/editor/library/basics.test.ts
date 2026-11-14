import { describe, expect, it } from "vitest";
import { XS_ONLY } from "../xsBlocks";
import { LIBRARY_PRESETS, XS_BASICS } from "./purposes";

describe("the library on a store that wears a template", () => {
  it("offers the template bands and the six basic elements, nothing else", () => {
    if (!XS_ONLY) return;
    const keys = LIBRARY_PRESETS.map((preset) => preset.key);
    for (const basic of XS_BASICS) expect(keys).toContain(basic);
    expect(keys.filter((key) => !key.startsWith("xs-")).sort()).toEqual([...XS_BASICS].sort());
  });
});
