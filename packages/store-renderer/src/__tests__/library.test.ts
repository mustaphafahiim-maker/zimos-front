import { describe, expect, it } from "vitest";
import { SECTION_GROUPS, SECTION_LIBRARY } from "../sections";
import { THEMES, THEME_LIST } from "../themes";
import { THEME_IDS } from "../theme";
import { ALLOWED_ELEMENT_TYPES, collectIds, validatePageTree, type Tree } from "../tree";

const FAKE_CLAIMS = [
  /\d+\s*%/, // discounts
  /خصم/,
  /discount/i,
  /\+\s*\d/, // "+10,000 customers"
  /[0-9٠-٩]{2,}\s*(عميل|customer|طلب|order|review|تقييم)/i,
  /lorem/i,
  /https?:\/\/(?!wa\.me)/, // no external image/video URLs baked into content
];

function allStrings(v: unknown, out: string[] = []): string[] {
  if (typeof v === "string") out.push(v);
  else if (Array.isArray(v)) v.forEach((x) => allStrings(x, out));
  else if (v && typeof v === "object") Object.values(v).forEach((x) => allStrings(x, out));
  return out;
}

describe("validatePageTree (mirror of backend pageTree.js)", () => {
  it("accepts the backend integration-test tree", () => {
    const tree = {
      version: 1,
      sections: [{ id: "s1", type: "section", settings: {}, rows: [{ id: "r1", type: "row", settings: {}, columns: [{ id: "c1", type: "column", span: 12, settings: {}, elements: [{ id: "e1", type: "text", props: { text: "x" } }] }] }] }],
    };
    expect(validatePageTree(tree, { requireContent: true })).toEqual({ ok: true, errors: [] });
  });

  it("rejects raw HTML, unknown types, bad spans, missing ids and empty publish", () => {
    expect(validatePageTree("<h1>x</h1>").ok).toBe(false);
    const bad = {
      version: 1.5,
      sections: [{ id: "", type: "section", rows: [{ id: "r", type: "row", columns: [{ id: "c", type: "column", span: 13, elements: ["<b>", { id: "e", type: "html" }, { id: "e2", type: "text", props: [] }] }] }] }],
    };
    const res = validatePageTree(bad);
    const fields = res.errors.map((e) => e.field);
    expect(fields).toContain("data.version");
    expect(fields).toContain("data.sections[0].id");
    expect(fields).toContain("data.sections[0].rows[0].columns[0].span");
    expect(fields).toContain("data.sections[0].rows[0].columns[0].elements[0]");
    expect(fields).toContain("data.sections[0].rows[0].columns[0].elements[1].type");
    expect(fields).toContain("data.sections[0].rows[0].columns[0].elements[2].props");
    expect(validatePageTree({ sections: [] }, { requireContent: true }).ok).toBe(false);
  });
});

describe("SECTION_LIBRARY", () => {
  it("has at least 24 presets with unique ids, known groups and bilingual labels", () => {
    expect(SECTION_LIBRARY.length).toBeGreaterThanOrEqual(24);
    const ids = SECTION_LIBRARY.map((s) => s.id);
    expect(new Set(ids).size).toBe(ids.length);
    const groups = new Set(SECTION_GROUPS.map((g) => g.id));
    for (const s of SECTION_LIBRARY) {
      expect(groups.has(s.group)).toBe(true);
      expect(s.label.ar.trim()).not.toBe("");
      expect(s.label.en.trim()).not.toBe("");
      expect(s.thumbnail.ar.trim()).not.toBe("");
    }
  });

  it.each(SECTION_LIBRARY.map((s) => [s.id, s] as const))("%s creates a publishable tree in ar and en", (_id, preset) => {
    for (const locale of ["ar", "en"] as const) {
      const tree: Tree = { version: 1, sections: [preset.create({ locale })] };
      const res = validatePageTree(tree, { requireContent: true });
      expect(res.errors).toEqual([]);
      const ids = collectIds(tree);
      expect(new Set(ids).size).toBe(ids.length);
      for (const s of allStrings(tree)) for (const re of FAKE_CLAIMS) expect(s).not.toMatch(re);
    }
  });

  it("gives fresh ids on every create so a preset can be inserted twice", () => {
    const preset = SECTION_LIBRARY.find((s) => s.id === "benefits")!;
    const tree: Tree = { sections: [preset.create(), preset.create()] };
    const ids = collectIds(tree);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("only uses allowed element types", () => {
    const allowed = new Set<string>(ALLOWED_ELEMENT_TYPES);
    for (const preset of SECTION_LIBRARY) {
      const s = preset.create();
      for (const r of s.rows) for (const c of r.columns) for (const e of c.elements) expect(allowed.has(e.type)).toBe(true);
    }
  });
});

describe("THEMES", () => {
  it("ships the five themes", () => {
    expect(Object.keys(THEMES).sort()).toEqual([...THEME_IDS].sort());
  });

  it.each(THEME_LIST.map((t) => [t.id, t] as const))("%s: every page is valid, ids unique, no fake claims, settings fit the backend blob caps", (_id, theme) => {
    for (const locale of ["ar", "en"] as const) {
      const { settings, pages } = theme.build(locale);
      for (const [key, tree] of Object.entries(pages)) {
        const res = validatePageTree(tree, { requireContent: true });
        expect({ key, errors: res.errors }).toEqual({ key, errors: [] });
        const ids = collectIds(tree);
        expect(new Set(ids).size).toBe(ids.length);
        for (const s of allStrings(tree)) for (const re of FAKE_CLAIMS) expect({ key, s }).not.toEqual({ key, s: expect.stringMatching(re) });
      }
      // Backend: themeSettings max 50 top-level keys and ~5KB.
      expect(Object.keys(settings).length).toBeLessThanOrEqual(50);
      expect(JSON.stringify(settings).length).toBeLessThan(4000);
    }
  });

  it("theme ids in page trees don't collide across pages of the same theme", () => {
    for (const theme of THEME_LIST) {
      const all = Object.values(theme.pages).flatMap((p) => collectIds(p));
      expect(new Set(all).size).toBe(all.length);
    }
  });
});
