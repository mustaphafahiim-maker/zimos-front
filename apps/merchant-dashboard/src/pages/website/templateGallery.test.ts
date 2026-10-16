import { describe, expect, it, vi } from "vitest";
import type { WebsiteTemplateSummary } from "@store-builder/api-client";
import {
  ALL_CATEGORIES,
  filterTemplates,
  isArabicLocale,
  templateCategories,
  templatesInLanguage,
  templateTwins,
} from "./templateGallery";
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

describe("template languages", () => {
  const ids = (list: WebsiteTemplateSummary[]) => list.map((t) => t.id);
  const lang = (id: string, name: string, rtl: boolean, tags: string[]): WebsiteTemplateSummary => ({
    ...template(id, name, "fashion"),
    rtl,
    tags,
  });
  // As the API lists them, by name.
  const catalogue = [
    lang("en01", "XS 01", false, ["xs"]),
    lang("en01b", "XS 01 B", false, ["xs"]),
    lang("ar01b", "XS 01 B عربي", true, ["xs", "ar"]),
    lang("ar01", "XS 01 عربي", true, ["xs", "ar"]),
    template("funnel", "Single product", "single_product"),
    // Right-to-left and named like a twin, but not tagged `ar`: one language only.
    lang("ar02", "XS 02 عربي", true, ["xs"]),
    lang("en02", "XS 02", false, ["xs"]),
    // Tagged and right-to-left, but no English template of that name.
    lang("ar03", "XS 03 عربي", true, ["xs", "ar"]),
  ];

  it("pairs a design's English and Arabic templates by name, right-to-left and the ar tag", () => {
    const twins = templateTwins(catalogue);
    expect(twins.get("en01")?.id).toBe("ar01");
    expect(twins.get("ar01")?.id).toBe("en01");
    expect(twins.get("en01b")?.id).toBe("ar01b");
    expect(twins.get("ar01b")?.id).toBe("en01b");
    expect([...twins.keys()].sort()).toEqual(["ar01", "ar01b", "en01", "en01b"]);
  });

  it("pairs a name once, so a second template under it stays on its own", () => {
    const twins = templateTwins([...catalogue, lang("en01dup", "XS 01", false, ["xs"])]);
    expect(twins.get("ar01")?.id).toBe("en01");
    expect(twins.has("en01dup")).toBe(false);
  });

  it("shows each design once, in the chosen language and in the place of its first template", () => {
    expect(ids(templatesInLanguage(catalogue, "en"))).toEqual(["en01", "en01b", "funnel", "ar02", "en02", "ar03"]);
    expect(ids(templatesInLanguage(catalogue, "ar"))).toEqual(["ar01", "ar01b", "funnel", "ar02", "en02", "ar03"]);
  });

  it("reads a store language with a region as its base language", () => {
    expect(isArabicLocale("ar-EG")).toBe(true);
    expect(isArabicLocale("ar")).toBe(true);
    expect(isArabicLocale("AR_eg")).toBe(true);
    expect(isArabicLocale("en-US")).toBe(false);
    expect(isArabicLocale(undefined)).toBe(false);
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
