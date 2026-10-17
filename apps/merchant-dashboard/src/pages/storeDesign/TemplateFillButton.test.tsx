import { describe, expect, it } from "vitest";
import { screen } from "@testing-library/react";
import type { ApiClient, TranslationsOverview, Workspace } from "@store-builder/api-client";
import { api, fake, workspaceMock } from "@/test/mocks";
import { renderWithProviders } from "@/test/renderWithProviders";
import { LanguagesTab } from "./LanguagesTab";
import { fillFromTemplate } from "./templateFill";

/**
 * Languages → "Fill the English from the template": the store's empty English
 * texts filled from its template's dictionary, never over a translation the
 * merchant wrote, with a count of what the template has no English for.
 */

type Call = { path: string; method: string; body: unknown };

/** The API the fill talks to: what each list returns, and every save it is sent. */
function fakeApi(lists: Record<string, unknown[]>) {
  const saves: Call[] = [];
  api.request.mockImplementation(async (path: string, init?: { method?: string; body?: unknown }) => {
    const method = init?.method ?? "GET";
    if (method === "PUT") {
      saves.push({ path, method, body: init?.body });
      return { item: null };
    }
    const kind = /entityType=(\w+)/.exec(path)?.[1] ?? "";
    return { items: lists[kind] ?? [] };
  });
  return saves;
}

const DICTIONARY = {
  arToEn: { "تسوق": "Shop", "اقرأ المزيد": "Read more", "حسابي": "My account", "تيشيرت": "Tee", "عرض": "Offer" },
  byLook: { "05": { "عرض": "Deal" } },
};

describe("fillFromTemplate", () => {
  it("fills only the empty texts the template has English for, and counts the rest", async () => {
    const saves = fakeApi({
      page: [
        {
          entityType: "page",
          entityId: "p1",
          label: "Home",
          sub: "/",
          texts: [
            { key: "h1", source: "تسوق", translation: "" },
            { key: "h2", source: "كلام كتبه التاجر", translation: "" },
            { key: "h3", source: "اقرأ المزيد", translation: "Read on" },
            { key: "h4", source: "عرض", translation: "" },
          ],
        },
      ],
      shell: [{ entityType: "shell", entityId: "ws_1", label: "Header and footer", sub: null, texts: [{ key: "h5", source: " حسابي ", translation: "" }] }],
      product: [{ entityType: "product", entityId: "pr1", source: { name: "تيشيرت", description: "وصف التاجر" }, translation: { name: "", description: "" } }],
      collection: [{ entityType: "collection", entityId: "c1", source: { name: "تيشيرت", description: "" }, translation: { name: "Tees", description: "" } }],
    });

    const result = await fillFromTemplate({ client: api as unknown as ApiClient, workspaceId: "ws_1", locale: "en", dictionary: DICTIONARY, look: "05" });

    expect(result).toEqual({ filled: 4, left: 2 });
    expect(saves).toEqual([
      // The merchant's own "Read on" stays; the store's look gives its own word for "عرض".
      { path: "/workspaces/ws_1/translations/content", method: "PUT", body: { entityType: "page", entityId: "p1", locale: "en", texts: { h1: "Shop", h4: "Deal" } } },
      { path: "/workspaces/ws_1/translations/content", method: "PUT", body: { entityType: "shell", entityId: "ws_1", locale: "en", texts: { h5: "My account" } } },
      { path: "/workspaces/ws_1/translations", method: "PUT", body: { entityType: "product", entityId: "pr1", locale: "en", fields: { name: "Tee" } } },
    ]);
  });

  it("sends nothing when there is nothing empty to fill", async () => {
    const saves = fakeApi({ page: [{ entityType: "page", entityId: "p1", label: "Home", sub: "/", texts: [{ key: "h1", source: "تسوق", translation: "Buy" }] }] });
    expect(await fillFromTemplate({ client: api as unknown as ApiClient, workspaceId: "ws_1", locale: "en", dictionary: DICTIONARY, look: null })).toEqual({ filled: 0, left: 0 });
    expect(saves).toEqual([]);
  });
});

describe("Languages: the fill button", () => {
  const overview = (languages: string[]): TranslationsOverview =>
    ({
      defaultLocale: "ar",
      available: ["ar", "en", "fr"],
      totalFields: 0,
      languages: [{ locale: "ar", isDefault: true, translatedFields: 0, percent: 100 }, ...languages.map((locale) => ({ locale, isDefault: false, translatedFields: 0, percent: 0 }))],
    }) as TranslationsOverview;

  function show(themeSettings: Record<string, unknown>, languages: string[]) {
    workspaceMock.currentWorkspace = fake<Workspace>({ id: "ws_1", name: "Nile Store", themeSettings });
    api.request.mockImplementation(async (path: string) => (path.endsWith("/translations/overview") ? overview(languages) : { items: [] }));
    renderWithProviders(<LanguagesTab />);
  }

  it("is there for a store that wears an imported template and offers English", async () => {
    show({ xsLook: "05" }, ["en"]);
    expect(await screen.findByRole("button", { name: "Fill the English from the template" })).toBeInTheDocument();
    // The header and footer are a kind of their own to translate.
    expect(screen.getByRole("button", { name: "Header and footer" })).toBeInTheDocument();
  });

  it("is not there for a store on its own look", async () => {
    show({}, ["en"]);
    await screen.findByRole("button", { name: "Header and footer" });
    expect(screen.queryByRole("button", { name: "Fill the English from the template" })).toBeNull();
  });

  it("is not there while translating to a language the template has no words in", async () => {
    show({ xsLook: "05" }, ["fr"]);
    await screen.findByRole("button", { name: "Header and footer" });
    expect(screen.queryByRole("button", { name: "Fill the English from the template" })).toBeNull();
  });
});
