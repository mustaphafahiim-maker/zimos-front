import { beforeEach, describe, expect, it, vi } from "vitest";
import { act, screen, waitFor } from "@testing-library/react";
import type { WebsiteTemplateDetail, WebsiteTemplateSummary, Workspace } from "@store-builder/api-client";
import { invalidateCached } from "@/lib/useCachedAsync";
import { api, fake, workspaceMock, type ListedWorkspace } from "@/test/mocks";
import { currentPath, renderWithProviders } from "@/test/renderWithProviders";
import { buildStoreTemplates } from "../templates/storeTemplates";
import { WebsitePage } from "../WebsitePage";

/**
 * A template that wears a theme is shown in that theme: on its card in the
 * gallery, in the large preview of its sheet, and — when the store takes it —
 * on the store. The template here is one of ours as it is built, served the
 * way the API serves a template's detail.
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

const built = buildStoreTemplates().find((t) => t.key === "home-living")!;

/** The gallery's card for it. Each test names its own id: a template's detail is fetched once per session. */
const card = (id: string, primaryColor: string | null = built.primaryColor) =>
  fake<WebsiteTemplateSummary>({ id, name: built.name, category: built.category, thumbnailUrl: null, templateVersionId: `v_${id}`, primaryColor });

const detail = (id: string, globalStyles: Record<string, unknown> = built.version.globalStyles) =>
  fake<WebsiteTemplateDetail>({ ...card(id), globalStyles, pages: built.version.pages, sections: [] });

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
    expect(posted("theme")).toEqual([JSON.stringify({ storeTheme: "classic" })]);
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
    await waitFor(() => expect(sheet.querySelector<HTMLInputElement>('form[target] input[name="theme"]')?.value).toBe(JSON.stringify({ storeTheme: "classic" })));
  });

  it("stays the template's colour alone for a template that brings no theme", async () => {
    api.listWebsiteTemplates.mockResolvedValue([card("colour_only", "#7C2D12")]);
    api.getWebsiteTemplate.mockResolvedValue(detail("colour_only", { primaryColor: "#7C2D12" }));

    renderWithProviders(<WebsitePage />, { route: "/website" });

    await waitFor(() => expect(submit).toHaveBeenCalledTimes(1));
    expect(posted("theme")).toEqual([JSON.stringify({ primaryColor: "#7C2D12" })]);
  });

  it("is not drawn over a store that has a look of its own", async () => {
    workspaceMock.currentWorkspace = fake<Workspace>({ id: "ws_1", name: "Nile Store", themeSettings: { storeTheme: "warm" } });
    api.listWebsiteTemplates.mockResolvedValue([card("own_look")]);
    api.getWebsiteTemplate.mockResolvedValue(detail("own_look"));

    renderWithProviders(<WebsitePage />, { route: "/website" });

    await waitFor(() => expect(submit).toHaveBeenCalledTimes(1));
    // No look posted: the store is drawn as it is saved.
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
