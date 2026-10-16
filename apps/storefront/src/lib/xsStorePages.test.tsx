// @vitest-environment node
import { describe, expect, it } from "vitest";
import { readXsStorePages, storePageAttrs, stripHoldsTitle } from "./xsStorePages";

describe("xsStorePages: a template's shop pages", () => {
  it("is nothing on a store that wears no template", () => {
    expect(readXsStorePages({})).toBeNull();
    expect(readXsStorePages({ xsLook: "99" })).toBeNull();
    expect(storePageAttrs("cart", null)).toEqual({ "data-page": "cart" });
  });

  it("starts from each template's own shop and product pages", () => {
    expect(readXsStorePages({ xsLook: "05" })).toMatchObject({ look: "05", strip: "band", thumbs: "side", tabs: "center", image: null, related: null });
    expect(readXsStorePages({ xsLook: "01" })).toMatchObject({ strip: "inline", thumbs: "side" });
    expect(readXsStorePages({ xsLook: "18" })).toMatchObject({ strip: "title", thumbs: "below", tabs: "start" });
    expect(readXsStorePages({ xsLook: "11" })).toMatchObject({ strip: "band", thumbs: "below", tabs: "start" });
  });

  it("takes the store's own choices, and only sound ones", () => {
    const pages = readXsStorePages({
      xsLook: "05",
      storePages: { strip: "title", image: "javascript:alert(1)", thumbs: "below", tabs: "sideways", titles: { cart: "  حقيبتك  ", checkout: "" }, related: "قد يعجبك أيضًا" },
    });
    expect(pages).toMatchObject({ strip: "title", image: null, thumbs: "below", tabs: "center", titles: { cart: "حقيبتك" }, related: "قد يعجبك أيضًا" });
    expect(readXsStorePages({ xsLook: "05", storePages: { image: "/xs/05/banner-1.jpg" } })?.image).toBe("/xs/05/banner-1.jpg");
  });

  it("tells the page whether the strip holds its title, and what to put on its <main>", () => {
    const band = readXsStorePages({ xsLook: "05" });
    expect(stripHoldsTitle(band)).toBe(true);
    expect(stripHoldsTitle(readXsStorePages({ xsLook: "01" }))).toBe(false);
    expect(storePageAttrs("product", band)).toEqual({ "data-page": "product", "data-xs-thumbs": "side", "data-xs-tabs": "center", "data-xs-strip": "band" });
  });
});
