import { describe, expect, it } from "vitest";
import { readStorePages, writeStorePages } from "./StorePagesBlock";

describe("StorePagesBlock: a template's shop pages", () => {
  it("opens on the template's own", () => {
    expect(readStorePages(undefined, "05")).toEqual({ strip: "band", image: "", thumbs: "side", tabs: "center", titles: { catalog: "", cart: "", checkout: "" }, related: "" });
    expect(readStorePages(undefined, "18").strip).toBe("title");
  });

  it("saves only what differs from the template, and nothing when nothing does", () => {
    const pages = readStorePages(undefined, "05");
    expect(writeStorePages(pages, "05")).toBeUndefined();
    expect(writeStorePages({ ...pages, thumbs: "below", titles: { ...pages.titles, cart: "Your bag " } }, "05")).toEqual({ thumbs: "below", titles: { cart: "Your bag " } });
    // The template's own choice, picked again, is not saved.
    expect(writeStorePages({ ...pages, strip: "band" }, "05")).toBeUndefined();
  });

  it("reads back what it saved", () => {
    const saved = writeStorePages({ ...readStorePages(undefined, "01"), strip: "none", related: "You may also like" }, "01");
    expect(readStorePages(saved, "01")).toMatchObject({ strip: "none", thumbs: "side", related: "You may also like" });
  });
});
