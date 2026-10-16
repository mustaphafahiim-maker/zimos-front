import { describe, expect, it } from "vitest";
import { BLOCK_PRESETS } from "../blocks";
import { XS_ONLY } from "../xsBlocks";
import { LIBRARY_PRESETS, isXsPreset, offeredPresets } from "./purposes";

describe("the library a store is offered", () => {
  it("leaves out the imported templates' bands on a store that wears none of them (VITE_XS_ONLY_ENABLED off)", () => {
    if (XS_ONLY) return;
    const offered = offeredPresets(LIBRARY_PRESETS, false);
    expect(offered.some(isXsPreset)).toBe(false);
    // Every block the library had before the imported templates came is still there, in its order.
    expect(offered.map((preset) => preset.key)).toEqual(BLOCK_PRESETS.filter((preset) => !isXsPreset(preset)).map((preset) => preset.key));
  });

  it("adds them on a store that wears one", () => {
    const offered = offeredPresets(LIBRARY_PRESETS, true);
    expect(offered.filter(isXsPreset).length).toBeGreaterThan(22);
    expect(offered).toEqual([...LIBRARY_PRESETS]);
  });
});
