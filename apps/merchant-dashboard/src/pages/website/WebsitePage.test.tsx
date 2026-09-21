import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, fireEvent, screen, waitFor } from "@testing-library/react";
import type { WebsiteTemplateDetail, WebsiteTemplateSummary } from "@store-builder/api-client";
import { api, fake } from "@/test/mocks";
import { renderWithProviders } from "@/test/renderWithProviders";
import { MAX_LOADING_PREVIEWS } from "@/lib/templatePreview";
import { STOREFRONT_URL } from "@/lib/storefrontUrl";
import { WebsitePage } from "./WebsitePage";

/** jsdom has no IntersectionObserver; this one lets a test decide what is on screen. */
class FakeIntersectionObserver {
  static instances: FakeIntersectionObserver[] = [];
  readonly elements = new Set<Element>();
  readonly callback: IntersectionObserverCallback;
  constructor(callback: IntersectionObserverCallback) {
    this.callback = callback;
    FakeIntersectionObserver.instances.push(this);
  }
  observe(el: Element) {
    this.elements.add(el);
  }
  unobserve(el: Element) {
    this.elements.delete(el);
  }
  disconnect() {
    this.elements.clear();
  }
  takeRecords() {
    return [];
  }
  static scrollAllIntoView() {
    for (const observer of FakeIntersectionObserver.instances) {
      const entries = [...observer.elements].map(
        (target) => ({ target, isIntersecting: true }) as IntersectionObserverEntry
      );
      if (entries.length > 0) {
        observer.callback(entries, observer as unknown as IntersectionObserver);
      }
    }
  }
}

function template(id: string, name: string, category: string | null) {
  return fake<WebsiteTemplateSummary>({
    id,
    name,
    category,
    thumbnailUrl: null,
    templateVersionId: `v_${id}`,
  });
}

const homeDetail = fake<WebsiteTemplateDetail>({
  pages: [
    {
      path: "/",
      title: "الرئيسية",
      pageType: "home",
      builderData: { version: 1, sections: [{ id: "hero", type: "section", rows: [] }] },
      seo: {},
    },
  ],
});

let submit: ReturnType<typeof vi.fn<() => void>>;

beforeEach(() => {
  FakeIntersectionObserver.instances = [];
  vi.stubGlobal("IntersectionObserver", FakeIntersectionObserver);
  // jsdom can't navigate a frame; count the posts instead.
  submit = vi.fn<() => void>();
  vi.spyOn(HTMLFormElement.prototype, "submit").mockImplementation(submit);
  api.listWebsites.mockResolvedValue([]);
  api.me.mockResolvedValue(fake({}));
  api.getWebsiteTemplate.mockResolvedValue(homeDetail);
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("WebsitePage template gallery", () => {
  it("builds category chips from the templates and filters by category and name", async () => {
    api.listWebsiteTemplates.mockResolvedValue([
      template("t_1", "Nile Fashion", "fashion"),
      template("t_2", "Oud House", "perfume"),
      template("t_3", "Cairo Basics", null),
      template("t_4", "Zamalek Fashion", "fashion"),
    ]);

    const { user } = renderWithProviders(<WebsitePage />, { route: "/website" });

    const chips = await screen.findByRole("group", { name: "Filter templates by category" });
    // One chip per real category, plus All; a template without one adds none.
    expect(
      Array.from(chips.querySelectorAll("button")).map((b) => b.textContent)
    ).toEqual(["All", "Fashion", "Perfume"]);
    expect(screen.getAllByRole("button", { name: /^Preview / })).toHaveLength(4);

    await user.click(screen.getByRole("button", { name: "Perfume" }));
    expect(screen.getByRole("button", { name: "Perfume" })).toHaveAttribute("aria-pressed", "true");
    expect(screen.getAllByRole("button", { name: /^Preview / }).map((b) => b.getAttribute("aria-label"))).toEqual([
      "Preview Oud House",
    ]);

    await user.click(screen.getByRole("button", { name: "Fashion" }));
    await user.type(screen.getByRole("searchbox", { name: "Search templates" }), "zamalek");
    expect(screen.getAllByRole("button", { name: /^Preview / }).map((b) => b.getAttribute("aria-label"))).toEqual([
      "Preview Zamalek Fashion",
    ]);

    await user.type(screen.getByRole("searchbox", { name: "Search templates" }), "x");
    expect(screen.getByText("No templates match")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Show all templates" }));
    expect(screen.getAllByRole("button", { name: /^Preview / })).toHaveLength(4);

    // Nothing scrolled into view, so no template was fetched for a preview.
    expect(api.getWebsiteTemplate).not.toHaveBeenCalled();
  });

  it("loads previews only for cards in view, a few at a time", async () => {
    api.listWebsiteTemplates.mockResolvedValue([
      template("lazy_1", "Store One", "general"),
      template("lazy_2", "Store Two", "general"),
      template("lazy_3", "Store Three", "general"),
      template("lazy_4", "Store Four", "general"),
    ]);

    renderWithProviders(<WebsitePage />, { route: "/website" });

    expect(await screen.findAllByRole("button", { name: /^Preview / })).toHaveLength(4);
    expect(document.querySelectorAll("iframe")).toHaveLength(0);
    expect(api.getWebsiteTemplate).not.toHaveBeenCalled();

    act(() => FakeIntersectionObserver.scrollAllIntoView());

    await waitFor(() => expect(submit).toHaveBeenCalledTimes(MAX_LOADING_PREVIEWS));
    expect(api.getWebsiteTemplate).toHaveBeenCalledTimes(4);
    expect(document.querySelectorAll("iframe")).toHaveLength(MAX_LOADING_PREVIEWS);

    // Each post goes to the storefront preview route with its own token.
    const forms = Array.from(document.querySelectorAll("form[target]"));
    expect(forms[0]).toHaveAttribute("action", `${STOREFRONT_URL}/store/ws_1/preview`);
    const tokens = forms.map((f) => (f.querySelector('input[name="token"]') as HTMLInputElement).value);
    expect(new Set(tokens).size).toBe(tokens.length);
    expect(JSON.parse((forms[0].querySelector('input[name="tree"]') as HTMLInputElement).value)).toEqual(
      (homeDetail.pages[0].builderData as object)
    );

    // A frame that finishes loading frees its slot for the next card. jsdom
    // fires its own loads for the blank documents; those must not count.
    const first = document.querySelectorAll("iframe")[0];
    fireEvent.load(first);
    expect(submit).toHaveBeenCalledTimes(MAX_LOADING_PREVIEWS);
    Object.defineProperty(first, "contentWindow", {
      configurable: true,
      value: { location: { href: `${STOREFRONT_URL}/store/ws_1/preview/some-token` } },
    });
    fireEvent.load(first);
    await waitFor(() => expect(submit).toHaveBeenCalledTimes(MAX_LOADING_PREVIEWS + 1));
    expect(document.querySelectorAll("iframe")).toHaveLength(MAX_LOADING_PREVIEWS + 1);
    // Blank-document loads of the new frame don't free another slot either.
    await new Promise((resolve) => setTimeout(resolve, 50));
    expect(submit).toHaveBeenCalledTimes(MAX_LOADING_PREVIEWS + 1);
  });
});
