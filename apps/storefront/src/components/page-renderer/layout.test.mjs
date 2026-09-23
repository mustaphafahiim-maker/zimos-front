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
  rowClasses,
  sectionClasses,
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
