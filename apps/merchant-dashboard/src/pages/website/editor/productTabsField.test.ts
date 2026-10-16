import { describe, expect, it } from "vitest";
import { BLOCK_PRESETS, ELEMENT_SPECS, createSection, sectionElements } from "./blocks";
import { fieldHint, fieldLabel } from "./editorLocale";

/**
 * The product grid's tabs in the inspector: a list of tabs, each a name (and
 * its English twin) and the collection it shows. The storefront reads the same
 * three keys (page-renderer/showcase ProductCardsElement).
 */
describe("the product grid's tabs field", () => {
  const field = ELEMENT_SPECS.product_cards.fields.find((f) => f.key === "tabs");

  it("is a list of up to six tabs, each a name, its English twin and a collection", () => {
    expect(field?.kind).toBe("itemList");
    if (field?.kind !== "itemList") return;
    expect(field.max).toBe(6);
    expect(field.titleKey).toBe("label");
    expect(field.fields.map((f) => [f.key, f.kind])).toEqual([
      ["label", "text"],
      ["labelEn", "text"],
      ["collection", "text"],
    ]);
    for (const sub of field.fields) expect(sub.labelAr, sub.key).toMatch(/\p{Script=Arabic}/u);
  });

  it("is named and explained in Arabic", () => {
    expect(fieldLabel("product_cards", "tabs", "Tabs", "ar")).toBe("التبويبات");
    expect(fieldHint("product_cards", "tabs", field?.hint, "ar")).toMatch(/\p{Script=Arabic}/u);
    expect(fieldLabel("product_cards", "tabs", "Tabs", "en")).toBe("Tabs");
  });

  it("is no part of a new product grid: the block starts as the single grid it always was", () => {
    expect(ELEMENT_SPECS.product_cards.defaultProps).not.toHaveProperty("tabs");
    const block = BLOCK_PRESETS.find((p) => p.key === "showcase-product-cards")!;
    const [grid] = sectionElements(createSection(block));
    expect(grid.type).toBe("product_cards");
    expect(grid.props).not.toHaveProperty("tabs");
  });
});
