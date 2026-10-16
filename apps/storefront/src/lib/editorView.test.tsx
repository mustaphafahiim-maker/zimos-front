// @vitest-environment node
import { describe, expect, it } from "vitest";
import { isViewToken, withEditorLook } from "./editorView";
import type { PreviewOptions } from "./previewStore";

const options = (shell: PreviewOptions["shell"]): PreviewOptions => ({ editable: true, parentOrigin: "http://localhost:5173", theme: null, shell, storePath: "/cart" });

describe("editorView: the store's own pages in the editor's unsaved look", () => {
  it("lays the unsaved header, footer, Template look and shop pages over the saved settings", () => {
    const saved = { xsLook: "05", header: { menu: [] }, footer: { text: "old" }, storeWords: { ar: { "cart.title": "قديم" } }, primaryColor: "#111111" };
    const next = withEditorLook(saved, options({ header: { menu: [1] }, footer: null, tokens: { display: "cookie" }, storePages: { strip: "title" }, storeWords: { ar: { "cart.title": "شنطتك" } } }));
    expect(next).toEqual({ xsLook: "05", header: { menu: [1] }, xsTokens: { display: "cookie" }, storePages: { strip: "title" }, storeWords: { ar: { "cart.title": "شنطتك" } }, primaryColor: "#111111" });
    // The saved settings themselves are left as they were.
    expect(saved.footer).toEqual({ text: "old" });
  });

  it("keeps what the editor did not send", () => {
    const saved = { xsLook: "05", storePages: { thumbs: "below" } };
    expect(withEditorLook(saved, options({ header: { menu: [] }, footer: null }))).toEqual({ xsLook: "05", header: { menu: [] }, storePages: { thumbs: "below" } });
    expect(withEditorLook(saved, options(null))).toEqual(saved);
  });

  it("takes only a token-shaped value", () => {
    expect(isViewToken("8a890c19-3e54-4ed1-8dca-74e98b638f9b")).toBe(true);
    expect(isViewToken("../../etc")).toBe(false);
    expect(isViewToken(null)).toBe(false);
  });
});
