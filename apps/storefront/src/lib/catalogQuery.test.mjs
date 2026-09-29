import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { activeFilterCount, catalogHref, readCatalogState, toListingParams, toggleOption } from "./catalogQuery.ts";

describe("catalog URL state", () => {
  it("reads every filter from the query string", () => {
    const state = readCatalogState({
      q: "  linen   shirt ",
      collection: "men",
      tag: ["summer", "summer", "linen"],
      min: "100",
      max: "450.5",
      "option[Size]": ["M", "L"],
      "option[Color]": "Blue",
      sort: "price_asc",
      page: "2",
    });
    assert.deepEqual(state, {
      q: "linen shirt",
      collection: "men",
      tags: ["summer", "linen"],
      min: 100,
      max: 450.5,
      options: { Size: ["M", "L"], Color: ["Blue"] },
      sort: "price_asc",
      page: 2,
    });
  });

  it("ignores what it cannot use", () => {
    const state = readCatalogState({ sort: "random", page: "-3", min: "abc", "option[]": "x" });
    assert.equal(state.sort, null);
    assert.equal(state.page, 1);
    assert.equal(state.min, null);
    assert.deepEqual(state.options, {});
  });

  it("writes a link that changes one thing and starts again from page 1", () => {
    const state = readCatalogState({ collection: "men", page: "3", "option[Size]": "M" });
    assert.equal(catalogHref(state, { tags: ["summer"] }), "/products?collection=men&tag=summer&option%5BSize%5D=M");
    assert.equal(catalogHref(state, { page: 4 }), "/products?collection=men&option%5BSize%5D=M&page=4");
    assert.equal(catalogHref(readCatalogState({})), "/products");
  });

  it("toggles option values and counts the filters", () => {
    let options = toggleOption({}, "Size", "M");
    options = toggleOption(options, "Size", "L");
    assert.deepEqual(options, { Size: ["M", "L"] });
    assert.deepEqual(toggleOption(options, "Size", "M"), { Size: ["L"] });
    assert.deepEqual(toggleOption({ Size: ["M"] }, "Size", "M"), {});
    assert.equal(activeFilterCount(readCatalogState({ collection: "x", tag: ["a", "b"], min: "1", "option[S]": ["M", "L"] })), 6);
  });

  it("asks the API in minor units, best match first while searching", () => {
    const state = readCatalogState({ q: "mug", min: "10", max: "20.5" });
    assert.deepEqual(toListingParams(state, "newest"), {
      search: "mug",
      minPrice: 1000,
      maxPrice: 2050,
      sort: "relevance",
      page: 1,
    });
    assert.equal(toListingParams(readCatalogState({}), "price_desc").sort, "price_desc");
  });
});
