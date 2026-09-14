import { describe, expect, it } from "vitest";
import { act, fireEvent, screen, waitFor, within } from "@testing-library/react";
import type { WebsiteDetail, WebsitePage } from "@store-builder/api-client";
import { api, fake } from "@/test/mocks";
import { renderWithProviders } from "@/test/renderWithProviders";
import { BuilderPage } from "./BuilderPage";

const home = fake<WebsitePage>({
  id: "page_home",
  title: "Home",
  path: "/",
  pageType: "home",
  draftData: {
    version: 1,
    sections: [
      {
        id: "sec_1",
        type: "section",
        settings: {},
        rows: [{ id: "row_1", type: "row", settings: {}, columns: [{ id: "col_1", type: "column", span: 12, settings: {}, elements: [{ id: "h_1", type: "heading", props: { text: "Old title", level: 1 } }] }] }],
      },
    ],
  },
});

const detail = fake<WebsiteDetail>({
  website: { id: "site_1", name: "Nile Store", subdomain: "nile", status: "draft", publishedRevisionId: null },
  pages: [home],
  publishedRevision: null,
});

describe("BuilderPage", () => {
  it("adds a section, edits a heading inline and saves the page draft", async () => {
    localStorage.setItem("zimos.builder.guide.site_1", JSON.stringify({ dismissed: true }));
    api.getWebsite.mockResolvedValue(detail);
    api.listProducts.mockResolvedValue(fake({ products: [], nextCursor: null }));
    api.listCollections.mockResolvedValue([]);
    api.updateWebsitePage.mockImplementation(async (_w, _s, id, payload) => fake<WebsitePage>({ ...home, id, draftData: payload.draftData }));

    const { user } = renderWithProviders(<BuilderPage />, { route: "/website/site_1/edit", path: "/website/:websiteId/edit" });

    // Add a section from the library.
    await user.click(await screen.findByRole("tab", { name: "Add" }));
    await user.click(screen.getByRole("button", { name: "Add Announcement bar" }));

    // Edit the existing heading inside the preview iframe.
    const frame = screen.getByTitle("Store preview") as HTMLIFrameElement;
    const heading = await waitFor(() => {
      const el = frame.contentDocument?.querySelector('[data-zr-field="text"]') as HTMLElement | null;
      const match = Array.from(frame.contentDocument?.querySelectorAll<HTMLElement>("[data-zr-field]") ?? []).find((n) => n.textContent === "Old title");
      expect(el).not.toBeNull();
      expect(match).toBeDefined();
      return match!;
    });
    Object.defineProperty(heading, "innerText", { configurable: true, get: () => "New hero title" });
    act(() => {
      fireEvent.blur(heading);
    });

    await user.click(within(screen.getByRole("banner")).getByRole("button", { name: "Save" }));

    await waitFor(() => expect(api.updateWebsitePage).toHaveBeenCalled());
    const [, , pageId, payload] = api.updateWebsitePage.mock.calls[api.updateWebsitePage.mock.calls.length - 1];
    expect(pageId).toBe("page_home");
    const tree = payload.draftData as unknown as { sections: Array<{ id: string; rows: Array<{ columns: Array<{ elements: Array<{ props: { text?: string } }> }> }> }> };
    expect(tree.sections).toHaveLength(2);
    expect(JSON.stringify(tree)).toContain("New hero title");
    // Only guide progress may reach the workspace blob — no theme was edited.
    for (const [, body] of api.updateWorkspace.mock.calls) {
      expect(Object.keys(body.themeSettings ?? {})).toEqual(["builderGuide"]);
    }
  });
});
