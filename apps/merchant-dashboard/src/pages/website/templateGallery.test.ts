import { describe, expect, it, vi } from "vitest";
import type { WebsiteTemplateSummary } from "@store-builder/api-client";
import { ALL_CATEGORIES, filterTemplates, templateCategories } from "./templateGallery";
import { createSlotQueue, homeTreeOf } from "@/lib/templatePreview";

// templatePreview talks to the API only through these; the tests here never do.
vi.mock("@/lib/apiClient", () => ({ apiClient: {} }));

function template(id: string, name: string, category: string | null): WebsiteTemplateSummary {
  return { id, name, category, thumbnailUrl: null, templateVersionId: `v_${id}` };
}

const templates = [
  template("1", "بسيط ومينيمال", "general"),
  template("2", "عطور الشرق", "perfume"),
  template("3", "Modest Wear", "modest_fashion"),
  template("4", "No category", null),
  template("5", "عطورات فاخرة", "perfume"),
];

describe("templateCategories", () => {
  it("lists each real category once, in catalogue order, skipping templates without one", () => {
    expect(templateCategories(templates)).toEqual(["general", "perfume", "modest_fashion"]);
    expect(templateCategories([])).toEqual([]);
  });
});

describe("filterTemplates", () => {
  const ids = (list: WebsiteTemplateSummary[]) => list.map((t) => t.id);

  it("shows everything under All with an empty search", () => {
    expect(ids(filterTemplates(templates, { category: ALL_CATEGORIES, query: "  " }))).toEqual([
      "1",
      "2",
      "3",
      "4",
      "5",
    ]);
  });

  it("keeps only the chosen category", () => {
    expect(ids(filterTemplates(templates, { category: "perfume", query: "" }))).toEqual(["2", "5"]);
    expect(ids(filterTemplates(templates, { category: "watches", query: "" }))).toEqual([]);
  });

  it("matches names regardless of case and common Arabic spelling variants", () => {
    expect(ids(filterTemplates(templates, { category: ALL_CATEGORIES, query: "modest" }))).toEqual(["3"]);
    // Typed without hamza / with a different alef form.
    expect(ids(filterTemplates(templates, { category: ALL_CATEGORIES, query: "بسيط و" }))).toEqual(["1"]);
    expect(ids(filterTemplates(templates, { category: "perfume", query: "عطورات" }))).toEqual(["5"]);
    expect(ids(filterTemplates([template("6", "إضاءة", "home_decor")], { category: ALL_CATEGORIES, query: "اضاءه" }))).toEqual(["6"]);
  });
});

describe("homeTreeOf", () => {
  const tree = { version: 1, sections: [{ id: "hero" }] };

  it("prefers the home page over the first page", () => {
    const pages = [
      { path: "/about", title: "", pageType: "static", builderData: { sections: [{ id: "x" }] }, seo: {} },
      { path: "/", title: "", pageType: "home", builderData: tree, seo: {} },
    ];
    expect(homeTreeOf({ pages })).toBe(tree);
  });

  it("gives nothing to render for a template without sections", () => {
    expect(homeTreeOf({ pages: [] })).toBeNull();
    expect(
      homeTreeOf({ pages: [{ path: "/", title: "", pageType: "home", builderData: { sections: [] }, seo: {} }] })
    ).toBeNull();
  });
});

describe("createSlotQueue", () => {
  it("never runs more than the limit, and starts the next job as one finishes", () => {
    const queue = createSlotQueue(2);
    const releases: Array<() => void> = [];
    const started: number[] = [];
    for (let i = 0; i < 4; i++) {
      queue.request((release) => {
        started.push(i);
        releases.push(release);
      });
    }
    expect(started).toEqual([0, 1]);
    expect(queue.active).toBe(2);
    expect(queue.waiting).toBe(2);

    releases[0]();
    releases[0](); // releasing twice frees one slot only
    expect(started).toEqual([0, 1, 2]);
    expect(queue.active).toBe(2);
  });

  it("drops a job cancelled while it waits", () => {
    const queue = createSlotQueue(1);
    const started: string[] = [];
    const releaseA = queue.request(() => started.push("a"));
    const cancelB = queue.request(() => started.push("b"));
    queue.request(() => started.push("c"));

    cancelB();
    releaseA();
    expect(started).toEqual(["a", "c"]);
    expect(queue.waiting).toBe(0);
  });
});
