import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  COLUMN_ALIGN,
  COLUMN_SURFACE,
  COLUMN_VERTICAL,
  ROW_GAP,
  SECTION_BACKGROUND,
  SECTION_PADDING,
  SECTION_TONE,
  SECTION_WIDTH,
  columnClasses,
  heroSectionIndex,
  openingSectionIndex,
  rowClasses,
  sectionClasses,
  sectionHooks,
  settingClass,
} from "./layout.ts";

/**
 * Pins the one promise the layout settings make: a page saved without any
 * settings — every template the seeder writes, every page built before the
 * editor had a section panel — renders with exactly the classes it always
 * had. The storefront has no test runner of its own, so this runs on Node's
 * built-in one (`node --test src/components/page-renderer/layout.test.mjs`),
 * which is also why layout.ts imports nothing.
 */

// The class strings PageRenderer produced before any of this existed.
const SECTION_OUTER = "px-4 sm:px-6 py-10 sm:py-14";
const SECTION_INNER = "mx-auto flex flex-col gap-6 max-w-6xl";
const ROW = "grid gap-6 md:grid-cols-12";
const COLUMN = "flex min-w-0 flex-col gap-4 md:col-span-12";

describe("defaults reproduce the classes every existing page renders with", () => {
  it("section", () => {
    assert.deepEqual(sectionClasses(undefined), { outer: SECTION_OUTER, inner: SECTION_INNER });
    assert.deepEqual(sectionClasses({}), { outer: SECTION_OUTER, inner: SECTION_INNER });
  });

  it("row", () => {
    assert.equal(rowClasses(undefined), ROW);
    assert.equal(rowClasses({}), ROW);
  });

  it("column", () => {
    assert.equal(columnClasses(undefined, "md:col-span-12"), COLUMN);
    assert.equal(columnClasses({}, "md:col-span-12"), COLUMN);
  });

  it("the default entry of every table is the empty or original class", () => {
    assert.equal(SECTION_BACKGROUND.none, "");
    assert.equal(SECTION_TONE.none, "");
    assert.equal(SECTION_PADDING.normal, "py-10 sm:py-14");
    assert.equal(SECTION_WIDTH.normal, "max-w-6xl");
    assert.equal(ROW_GAP.normal, "gap-6");
    assert.equal(COLUMN_SURFACE.none, "");
    assert.equal(COLUMN_ALIGN.start, "");
    assert.equal(COLUMN_VERTICAL.start, "");
  });
});

describe("anything unusable falls back to the default", () => {
  const odd = [null, "paper", 3, [], ["paper"], { background: 7 }, { background: "PAPER" }, { background: null }];

  it("section", () => {
    for (const settings of odd) {
      assert.deepEqual(sectionClasses(settings), { outer: SECTION_OUTER, inner: SECTION_INNER }, String(settings));
    }
  });

  it("row and column", () => {
    for (const settings of [...odd, { gap: "huge" }, { surface: "glass" }, { align: "right" }]) {
      assert.equal(rowClasses(settings), ROW, String(settings));
      assert.equal(columnClasses(settings, "md:col-span-12"), COLUMN, String(settings));
    }
  });

  it("settingClass reads only known string values", () => {
    const table = { a: "x", b: "y" };
    assert.equal(settingClass({ k: "b" }, "k", table, "a"), "y");
    assert.equal(settingClass({ k: "c" }, "k", table, "a"), "x");
    assert.equal(settingClass({ k: ["b"] }, "k", table, "a"), "x");
    assert.equal(settingClass("b", "k", table, "a"), "x");
  });
});

describe("a chosen value lands where the renderer expects it", () => {
  it("strong backgrounds capture their two colours outside and re-point the tokens inside", () => {
    for (const background of ["primary", "ink"]) {
      const { outer, inner } = sectionClasses({ background });
      assert.match(outer, /\[--zs-bg:/);
      assert.match(outer, /\[--zs-fg:/);
      assert.match(inner, /\[--color-ink:var\(--zs-fg\)\]/);
      assert.match(inner, /\[--color-paper-raised:/);
    }
    // The brand band swaps primary and its foreground so a primary button stays visible.
    assert.match(sectionClasses({ background: "primary" }).inner, /\[--color-primary:var\(--zs-fg\)\]/);
    assert.match(sectionClasses({ background: "primary" }).inner, /\[--color-on-primary:var\(--zs-bg\)\]/);
    // The quiet backgrounds re-point nothing.
    for (const background of ["paper", "raised", "primary-soft"]) {
      assert.equal(sectionClasses({ background }).inner, SECTION_INNER);
    }
  });

  it("every table option is a distinct class string", () => {
    for (const table of [SECTION_BACKGROUND, SECTION_PADDING, SECTION_WIDTH, ROW_GAP, COLUMN_SURFACE, COLUMN_ALIGN, COLUMN_VERTICAL]) {
      const values = Object.values(table);
      assert.equal(new Set(values).size, values.length);
    }
  });

  it("column classes compose surface, alignment and vertical position after the span", () => {
    assert.equal(
      columnClasses({ surface: "card", align: "center", verticalAlign: "end" }, "md:col-span-4"),
      `flex min-w-0 flex-col gap-4 md:col-span-4 ${COLUMN_SURFACE.card} ${COLUMN_ALIGN.center} ${COLUMN_VERTICAL.end}`
    );
    assert.equal(rowClasses({ gap: "tight" }), "grid gap-3 md:grid-cols-12");
  });
});

/**
 * The hooks a store theme styles by. They add attributes only — the class
 * strings pinned above are untouched — and they have to read the same
 * fallbacks as the classes, or a theme would space a section differently
 * from what its settings say.
 */
describe("theme hooks", () => {
  it("names each section's space and width, and its background only once one is chosen", () => {
    assert.deepEqual(sectionHooks(undefined), { "data-zt-section": "", "data-zt-pad": "normal", "data-zt-width": "normal" });
    assert.deepEqual(sectionHooks({ padding: "roomy", width: "full", background: "ink" }), {
      "data-zt-section": "",
      "data-zt-pad": "roomy",
      "data-zt-width": "full",
      "data-zt-bg": "ink",
    });
    assert.deepEqual(sectionHooks({ padding: "huge", background: "none", width: 3 }), sectionHooks({}));
  });

  const heading = (level, text = "x") => ({ id: `h${level}`, type: "heading", props: { text, level } });
  const el = (type) => ({ id: type, type, props: {} });
  const section = (...columns) => ({ id: "s", type: "section", rows: [{ id: "r", type: "row", columns: columns.map((elements, i) => ({ id: `c${i}`, type: "column", elements })) }] });

  it("finds the page's opening section by its headline", () => {
    // A level-1 heading, wherever it sits in the section.
    assert.equal(heroSectionIndex([section([heading(1), el("text")], [el("image")])]), 0);
    // The editor's plain Hero block: a level-2 heading with a button beside it.
    assert.equal(heroSectionIndex([section([heading(2), el("text"), el("button")])]), 0);
    // Behind a thin announcement band.
    assert.equal(heroSectionIndex([section([el("marquee")]), section([heading(1)])]), 1);
  });

  it("finds none rather than guessing", () => {
    assert.equal(heroSectionIndex([]), -1);
    assert.equal(heroSectionIndex(undefined), -1);
    assert.equal(heroSectionIndex([section([el("product_list")]), section([heading(2)])]), -1);
    // Only the first two sections are candidates.
    assert.equal(heroSectionIndex([section([el("text")]), section([el("gallery")]), section([heading(1)])]), -1);
    // A heading and a button in different columns is a layout, not a headline.
    assert.equal(heroSectionIndex([section([heading(2)], [el("button")])]), -1);
    // Junk nodes are skipped, not thrown on.
    assert.equal(heroSectionIndex([null, { rows: "x" }, section([heading(1)])]), -1);
    assert.equal(heroSectionIndex([{ rows: [{ columns: [{ elements: [null, { type: "heading", props: { level: "1" } }] }] }] }]), 0);
  });
});

describe("openingSectionIndex", () => {
  const section = (rows) => ({ id: "s", type: "section", rows });
  const row = { id: "r", type: "row", columns: [] };

  it("is the first section that has rows", () => {
    assert.equal(openingSectionIndex([section([row]), section([row])]), 0);
    // An empty section draws nothing on the store, so the next one is the top.
    assert.equal(openingSectionIndex([section([]), section([row])]), 1);
    assert.equal(openingSectionIndex([null, { rows: "x" }, section([row])]), 2);
  });

  it("is -1 when nothing draws", () => {
    assert.equal(openingSectionIndex([]), -1);
    assert.equal(openingSectionIndex(undefined), -1);
    assert.equal(openingSectionIndex([section([])]), -1);
  });
});
