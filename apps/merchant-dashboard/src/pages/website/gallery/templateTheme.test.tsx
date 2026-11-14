import { beforeEach, describe, expect, it, vi } from "vitest";
import { act, screen, waitFor } from "@testing-library/react";
import type { WebsiteTemplateDetail, WebsiteTemplateSummary, Workspace } from "@store-builder/api-client";
import { invalidateCached } from "@/lib/useCachedAsync";
import { api, fake, workspaceMock, type ListedWorkspace } from "@/test/mocks";
import { currentPath, renderWithProviders } from "@/test/renderWithProviders";
import { THEME_SPECS } from "../editor/storeThemes";
import { WebsitePage } from "../WebsitePage";

/**
 * A template that wears a theme is shown in that theme: on its card in the
 * gallery, in the large preview of its sheet, and — when the store takes it —
 * on the store. The template here wears the classic theme and the fuller
 * footer, served the way the API serves a template's detail.
 */

/** jsdom has no IntersectionObserver: every card is on screen as soon as it asks. */
class OnScreenObserver {
  readonly callback: IntersectionObserverCallback;
  constructor(callback: IntersectionObserverCallback) {
    this.callback = callback;
  }
  observe(target: Element) {
    this.callback([{ target, isIntersecting: true } as IntersectionObserverEntry], this as unknown as IntersectionObserver);
  }
  unobserve() {}
  disconnect() {}
  takeRecords() {
    return [];
  }
}

/** One page with a heading, its ids named by the page. */
const page = (key: string, path: string, title: string, pageType: "home" | "static") => ({
  path,
  title,
  pageType,
  builderData: {
    version: 1,
    sections: [
      {
        id: `${key}-1`,
        type: "section",
        settings: {},
        rows: [{ id: `${key}-1-r`, type: "row", columns: [{ id: `${key}-1-c`, type: "column", span: 12, elements: [{ id: `${key}-1-e`, type: "heading", props: { text: title, level: 1 } }] }] }],
      },
    ],
  },
  seo: {},
});

const built = {
  name: "Home and living",
  category: "home_decor",
  primaryColor: "#1F3A5F",
  version: {
    globalStyles: { primaryColor: "#1F3A5F", themeSettings: { storeTheme: "classic", footer: { layout: "rich" } } },
    pages: [page("home", "/", "Home", "home"), page("about", "/about", "About", "static"), page("contact", "/contact", "Contact", "static")],
    sections: [],
  },
};

/** The gallery's card for it. Each test names its own id: a template's detail is fetched once per session. */
const card = (id: string, primaryColor: string | null = built.primaryColor) =>
  fake<WebsiteTemplateSummary>({ id, name: built.name, category: built.category, thumbnailUrl: null, templateVersionId: `v_${id}`, primaryColor });

const detail = (id: string, globalStyles: Record<string, unknown> = built.version.globalStyles) =>
  fake<WebsiteTemplateDetail>({ ...card(id), globalStyles, pages: built.version.pages, sections: [] });

/** The classic theme as a preview draws it: the theme with its own two accents. */
const CLASSIC = { storeTheme: "classic", primaryColor: THEME_SPECS.classic.palette.light.accent, primaryColorDark: THEME_SPECS.classic.palette.dark.accent };

const posted = (name: string) => Array.from(document.querySelectorAll<HTMLInputElement>(`form[target] input[name="${name}"]`)).map((input) => input.value);

let submit: ReturnType<typeof vi.fn<() => void>>;

beforeEach(() => {
  // The gallery remembers its list of templates for the session: each test starts without one.
  invalidateCached("website:");
  vi.stubGlobal("IntersectionObserver", OnScreenObserver);
  // jsdom can't navigate a frame; count the posts instead.
  submit = vi.fn<() => void>();
  vi.spyOn(HTMLFormElement.prototype, "submit").mockImplementation(submit);
  api.listWebsites.mockResolvedValue([]);
  api.me.mockResolvedValue(fake({}));
  workspaceMock.currentWorkspace = fake<Workspace>({ id: "ws_1", name: "Nile Store", themeSettings: {} });
});

describe("a template's theme in the gallery", () => {
  it("is the look its card is drawn in, posted once", async () => {
    api.listWebsiteTemplates.mockResolvedValue([card("theme_card")]);
    api.getWebsiteTemplate.mockResolvedValue(detail("theme_card"));

    renderWithProviders(<WebsitePage />, { route: "/website" });

    await waitFor(() => expect(submit).toHaveBeenCalledTimes(1));
    expect(posted("theme")).toEqual([JSON.stringify(CLASSIC)]);
    // The page posted is the template's own home page.
    expect(JSON.parse(posted("tree")[0])).toEqual(built.version.pages[0].builderData);
    await act(() => new Promise((resolve) => setTimeout(resolve, 30)));
    expect(submit).toHaveBeenCalledTimes(1);
  });

  it("is the look of the large preview in its sheet", async () => {
    api.listWebsiteTemplates.mockResolvedValue([card("theme_sheet")]);
    api.getWebsiteTemplate.mockResolvedValue(detail("theme_sheet"));
    const { user } = renderWithProviders(<WebsitePage />, { route: "/website" });

    await user.click(await screen.findByRole("button", { name: `Preview ${built.name}` }));
    await screen.findByText(/Comes with 3 pages/);

    const sheet = document.querySelector('[data-slot="template-sheet"]')!;
    await waitFor(() => expect(sheet.querySelector<HTMLInputElement>('form[target] input[name="theme"]')?.value).toBe(JSON.stringify(CLASSIC)));
    // A store with no look of its own will take the theme: nothing to add under the preview.
    expect(document.querySelector('[data-slot="template-own-theme"]')).toBeNull();
  });

  it("stays the template's colour alone for a template that brings no theme", async () => {
    api.listWebsiteTemplates.mockResolvedValue([card("colour_only", "#7C2D12")]);
    api.getWebsiteTemplate.mockResolvedValue(detail("colour_only", { primaryColor: "#7C2D12" }));

    renderWithProviders(<WebsitePage />, { route: "/website" });

    await waitFor(() => expect(submit).toHaveBeenCalledTimes(1));
    expect(posted("theme")).toEqual([JSON.stringify({ primaryColor: "#7C2D12" })]);
  });

  it("is shown on a store that has a look of its own too, which is told it keeps that look", async () => {
    workspaceMock.currentWorkspace = fake<Workspace>({ id: "ws_1", name: "Nile Store", themeSettings: { storeTheme: "warm", primaryColor: "#BE123C" } });
    api.listWebsiteTemplates.mockResolvedValue([card("own_look")]);
    api.getWebsiteTemplate.mockResolvedValue(detail("own_look"));
    const { user } = renderWithProviders(<WebsitePage />, { route: "/website" });

    // The card: the template's theme with its own accents, over whatever the store saved.
    await waitFor(() => expect(submit).toHaveBeenCalledTimes(1));
    expect(posted("theme")).toEqual([JSON.stringify(CLASSIC)]);

    await user.click(await screen.findByRole("button", { name: `Preview ${built.name}` }));
    await screen.findByText(/Comes with 3 pages/);
    const sheet = document.querySelector('[data-slot="template-sheet"]')!;
    await waitFor(() => expect(sheet.querySelector<HTMLInputElement>('form[target] input[name="theme"]')?.value).toBe(JSON.stringify(CLASSIC)));
    expect(sheet.querySelector('[data-slot="template-own-theme"]')).toHaveTextContent("Your store keeps the look it has.");

    // And taking it changes nothing of the store's look: the confirmation says so.
    await user.click(screen.getByRole("button", { name: "Use this template" }));
    expect(await screen.findByText("Your store's colours and theme stay as they are.")).toBeInTheDocument();
  });

  it("leaves a store with a look of its own as it is saved for a template that brings no theme", async () => {
    workspaceMock.currentWorkspace = fake<Workspace>({ id: "ws_1", name: "Nile Store", themeSettings: { storeTheme: "warm" } });
    api.listWebsiteTemplates.mockResolvedValue([card("own_look_plain", "#7C2D12")]);
    api.getWebsiteTemplate.mockResolvedValue(detail("own_look_plain", { primaryColor: "#7C2D12" }));

    renderWithProviders(<WebsitePage />, { route: "/website" });

    await waitFor(() => expect(submit).toHaveBeenCalledTimes(1));
    // No look posted: the store is drawn as it is saved, as before.
    expect(posted("theme")).toEqual([""]);
  });
});

describe("a store taking a template that wears a theme", () => {
  it("is told so, and takes the theme and the fuller footer without losing its own footer", async () => {
    api.listWebsiteTemplates.mockResolvedValue([card("theme_take")]);
    api.getWebsiteTemplate.mockResolvedValue(detail("theme_take"));
    api.createWebsite.mockResolvedValue(fake({ website: { id: "site_1", name: "Nile Store" }, pages: [] }));
    // The store's latest settings: a footer line it wrote, and no look yet.
    api.listWorkspaces.mockResolvedValue([fake<ListedWorkspace>({ id: "ws_1", themeSettings: { footer: { text: "Open every day" } } })]);
    api.updateWorkspace.mockResolvedValue(fake<Workspace>({ id: "ws_1", themeSettings: {} }));
    const { user } = renderWithProviders(<WebsitePage />, { route: "/website" });

    await user.click(await screen.findByRole("button", { name: `Preview ${built.name}` }));
    await screen.findByText(/Comes with 3 pages/);
    await user.click(screen.getByRole("button", { name: "Use this template" }));
    expect(await screen.findByText(/takes this template's theme and colours/)).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Start with this template" }));
    await waitFor(() => expect(currentPath()).toMatch(/^\/website\/site_1\/edit/));

    expect(api.updateWorkspace).toHaveBeenCalledWith("ws_1", {
      themeSettings: {
        footer: { text: "Open every day", layout: "rich" },
        storeTheme: "classic",
        primaryColor: built.primaryColor,
        primaryColorSource: "template",
      },
    });
  });
});
