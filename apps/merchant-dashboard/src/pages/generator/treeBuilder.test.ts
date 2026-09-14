import { describe, expect, it } from "vitest";
import { PAGE_ELEMENT_TYPES, type PageTree } from "@store-builder/api-client";
import { generateCopy } from "./copyEngine";
import { buildTree } from "./treeBuilder";
import { SECTION_KEYS, type Brief, type Seeds, type StyleOptions } from "./types";

const brief = (over: Partial<Brief> = {}): Brief => ({
  productId: null,
  productSlug: "mug",
  name: "Magic Mug",
  priceMinor: 29_900,
  compareAtMinor: 39_900,
  currency: "EGP",
  description: "A mug that keeps coffee hot.",
  benefits: ["Keeps heat 6h", "Leak proof", "Dishwasher safe"],
  audience: "busy parents",
  problem: "cold coffee",
  box: "Mug\nLid",
  delivery: "2-4 days",
  returns: "14 days",
  guarantee: "Money back",
  quotes: [{ quote: "Love it", author: "Sara" }],
  faqs: [{ q: "Color?", a: "Black" }],
  images: [],
  ...over,
});

const future = new Date(Date.now() + 48 * 3_600_000).toISOString().slice(0, 16);

const style = (over: Partial<StyleOptions> = {}): StyleOptions => ({
  lang: "en",
  tone: "confident",
  category: "home",
  accent: "#1D4ED8",
  sections: Object.fromEntries(SECTION_KEYS.map((k) => [k, true])) as StyleOptions["sections"],
  countdownOn: true,
  countdownEnd: future,
  ...over,
});

const seeds = (n = 1): Seeds => Object.fromEntries(SECTION_KEYS.map((k) => [k, n])) as Seeds;

function elements(tree: PageTree) {
  return tree.sections.flatMap((s) => s.rows.flatMap((r) => r.columns.flatMap((c) => c.elements)));
}

function strings(v: unknown): string[] {
  if (typeof v === "string") return [v];
  if (Array.isArray(v)) return v.flatMap(strings);
  if (v && typeof v === "object") return Object.values(v).flatMap(strings);
  return [];
}

describe("generateCopy", () => {
  it("is deterministic for the same seed", () => {
    for (const lang of ["en", "ar-eg", "ar-gulf"] as const) {
      expect(generateCopy(brief(), style({ lang }), seeds(3))).toEqual(generateCopy(brief(), style({ lang }), seeds(3)));
    }
  });
  it("different tone yields different copy", () => {
    const a = generateCopy(brief(), style({ tone: "confident" }), seeds());
    const b = generateCopy(brief(), style({ tone: "premium" }), seeds());
    expect(a).not.toEqual(b);
  });
  it("no countdown label when disabled", () => {
    expect(generateCopy(brief(), style({ countdownOn: false }), seeds()).countdownLabel).toBe("");
  });
});

describe("buildTree", () => {
  const build = (b: Brief, s: StyleOptions) => buildTree(b, s, generateCopy(b, s, seeds()), {});

  it("never emits a testimonial section without quotes", () => {
    const t = build(brief({ quotes: [{ quote: "  ", author: "x" }] }), style());
    expect(t.sections.some((s) => s.id === "gen-proof")).toBe(false);
    expect(elements(t).some((e) => e.type === "testimonial")).toBe(false);
  });

  it("emits testimonials when quotes exist", () => {
    expect(elements(build(brief(), style())).some((e) => e.type === "testimonial")).toBe(true);
  });

  it("never emits a countdown when disabled", () => {
    expect(elements(build(brief(), style({ countdownOn: false }))).some((e) => e.type === "countdown")).toBe(false);
    expect(elements(build(brief(), style())).some((e) => e.type === "countdown")).toBe(true);
  });

  it("uses only allowlisted element types and no raw HTML", () => {
    const allowed = new Set<string>(PAGE_ELEMENT_TYPES);
    for (const lang of ["en", "ar-eg", "ar-gulf"] as const) {
      for (const tone of ["confident", "friendly", "premium", "urgent"] as const) {
        for (const e of elements(build(brief(), style({ lang, tone })))) {
          expect(allowed.has(e.type)).toBe(true);
          for (const s of strings(e.props)) expect(s).not.toContain("<");
        }
      }
    }
  });

  it("is deterministic", () => {
    expect(build(brief(), style())).toEqual(build(brief(), style()));
  });
});
