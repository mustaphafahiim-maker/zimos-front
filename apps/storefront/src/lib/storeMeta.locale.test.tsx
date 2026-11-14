// @vitest-environment node
import { afterEach, describe, expect, it, vi } from "vitest";

/*
 * The language button switches the header and footer too: they are drawn from
 * the store's themeSettings (components/xs/XsHeader, XsFooter), and the store
 * is read with the shopper's language (X-Store-Locale, from the cookie the
 * button writes), which the API answers with the header and footer translated
 * (Backend modules/translations contentTranslations.js localizeShell).
 */

const jar = vi.hoisted(() => ({ locale: undefined as string | undefined }));
vi.mock("next/headers", () => ({
  headers: async () => new Headers(),
  cookies: async () => ({ get: (name: string) => (name === "zimos_store_locale" && jar.locale ? { name, value: jar.locale } : undefined) }),
}));
vi.mock("./editorView", () => ({ getEditorView: async () => null, withEditorLook: (settings: unknown) => settings }));

import { getStoreState } from "./storeMeta";

function answer(themeSettings: Record<string, unknown>) {
  const fetchMock = vi.fn(async () => new Response(JSON.stringify({ store: { id: "shop", name: "Shop", themeSettings } }), { status: 200, headers: { "Content-Type": "application/json" } }));
  vi.stubGlobal("fetch", fetchMock);
  return fetchMock;
}

afterEach(() => {
  vi.unstubAllGlobals();
  jar.locale = undefined;
});

describe("the store as the language button leaves it", () => {
  it("is read in the shopper's language, and its header and footer are the ones the API sent", async () => {
    jar.locale = "en";
    const translated = { xsLook: "01", header: { menu: [{ label: "Home", href: "/" }] }, footer: { text: "A clothing store" } };
    const fetchMock = answer(translated);

    const state = await getStoreState("shop-en");

    const [url, init] = fetchMock.mock.calls[0] as unknown as [string, { headers: Record<string, string> }];
    expect(url).toMatch(/\/store\/shop-en$/);
    expect(init.headers["X-Store-Locale"]).toBe("en");
    expect(state).toMatchObject({ kind: "ok", store: { themeSettings: translated } });
  });

  it("asks for no language when the shopper picked none", async () => {
    const fetchMock = answer({ xsLook: "01" });
    await getStoreState("shop-none");
    const [, init] = fetchMock.mock.calls[0] as unknown as [string, { headers: Record<string, string> }];
    expect(init.headers["X-Store-Locale"]).toBeUndefined();
  });
});
