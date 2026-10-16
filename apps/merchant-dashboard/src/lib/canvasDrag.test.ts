import { describe, expect, it } from "vitest";
import {
  ELEMENT_DROP_REACH_PX,
  elementDropTarget,
  pairSpansAt,
  readCanvasDrag,
  readCanvasStep,
  resolveDrag,
  sectionGapAt,
  sectionMoveTarget,
  snapImagePercent,
  snapSectionHeight,
  stepEdit,
  type DragColumnBox,
  type DragGeometry,
  type DragSectionBox,
} from "./canvasDrag";

const LABELS = { auto: "Auto" };

// Three stacked sections, 100px tall, starting at y=0.
const SECTIONS: DragSectionBox[] = [
  { sectionId: "a", index: 0, top: 0, height: 100 },
  { sectionId: "b", index: 1, top: 100, height: 100 },
  { sectionId: "c", index: 2, top: 200, height: 100 },
];

describe("section drop index", () => {
  it("finds the gap nearest the pointer", () => {
    expect(sectionGapAt(SECTIONS, 10)).toBe(0);
    expect(sectionGapAt(SECTIONS, 60)).toBe(1);
    expect(sectionGapAt(SECTIONS, 160)).toBe(2);
    expect(sectionGapAt(SECTIONS, 290)).toBe(3);
  });

  it("turns a gap into moveSection's target index", () => {
    // Moving the first section below the last one.
    expect(sectionMoveTarget(0, 3, 3)).toBe(2);
    // Moving the last section to the top.
    expect(sectionMoveTarget(2, 0, 3)).toBe(0);
    // Moving the middle one down a place.
    expect(sectionMoveTarget(1, 3, 3)).toBe(2);
  });

  it("treats the gaps right above and below the section as staying put", () => {
    expect(sectionMoveTarget(1, 1, 3)).toBeNull();
    expect(sectionMoveTarget(1, 2, 3)).toBeNull();
  });

  it("resolves a section drag into feedback and an edit", () => {
    const drag: DragGeometry = { kind: "section", sectionId: "a", sections: SECTIONS };
    const start = { x: 0, y: 10, shift: false };
    expect(resolveDrag({ drag, start }, { x: 0, y: 290, shift: false }, LABELS)).toEqual({
      feedback: { kind: "section", gapIndex: 3 },
      edit: { kind: "move-section", sectionId: "a", to: 2 },
    });
    expect(resolveDrag({ drag, start }, { x: 0, y: 20, shift: false }, LABELS)).toEqual({
      feedback: { kind: "section", gapIndex: null },
      edit: null,
    });
  });
});

// Two columns side by side, each with two 50px elements.
const COLUMNS: DragColumnBox[] = [
  {
    columnId: "c1",
    sectionId: "s1",
    top: 0,
    left: 0,
    width: 300,
    height: 100,
    elements: [
      { elementId: "e1", top: 0, height: 50 },
      { elementId: "e2", top: 50, height: 50 },
    ],
  },
  {
    columnId: "c2",
    sectionId: "s1",
    top: 0,
    left: 320,
    width: 300,
    height: 100,
    elements: [
      { elementId: "e3", top: 0, height: 50 },
      { elementId: "e4", top: 50, height: 50 },
    ],
  },
];

describe("element drop target", () => {
  it("picks the column under the pointer and the slot by midpoints", () => {
    expect(elementDropTarget(COLUMNS, 400, 10)).toEqual({ columnId: "c2", index: 0 });
    expect(elementDropTarget(COLUMNS, 400, 60)).toEqual({ columnId: "c2", index: 1 });
    expect(elementDropTarget(COLUMNS, 400, 95)).toEqual({ columnId: "c2", index: 2 });
  });

  it("falls back to the nearest column within reach", () => {
    // In the gap between the two columns, nearer the second.
    expect(elementDropTarget(COLUMNS, 315, 30)).toEqual({ columnId: "c2", index: 1 });
    // Just below the first column.
    expect(elementDropTarget(COLUMNS, 100, 130)).toEqual({ columnId: "c1", index: 2 });
  });

  it("lands nowhere when every column is out of reach", () => {
    expect(elementDropTarget(COLUMNS, 100, 100 + ELEMENT_DROP_REACH_PX + 1)).toBeNull();
  });

  it("lands in an empty column at index 0", () => {
    const empty: DragColumnBox = { ...COLUMNS[0], columnId: "c9", elements: [] };
    expect(elementDropTarget([empty], 10, 10)).toEqual({ columnId: "c9", index: 0 });
  });

  it("ignores a drop that leaves the element where it is", () => {
    const drag: DragGeometry = { kind: "element", sectionId: "s1", elementId: "e1", columns: COLUMNS };
    const start = { x: 10, y: 10, shift: false };
    // Own slot, and the slot right after it.
    expect(resolveDrag({ drag, start }, { x: 10, y: 10, shift: false }, LABELS).edit).toBeNull();
    expect(resolveDrag({ drag, start }, { x: 10, y: 60, shift: false }, LABELS).edit).toBeNull();
    // Below the second element: a real move.
    expect(resolveDrag({ drag, start }, { x: 10, y: 95, shift: false }, LABELS).edit).toEqual({
      kind: "move-element",
      elementId: "e1",
      columnId: "c1",
      index: 2,
    });
  });
});

describe("resize snapping", () => {
  it("snaps section heights to 8px", () => {
    expect(snapSectionHeight(301)).toBe(304);
    expect(snapSectionHeight(299)).toBe(296);
  });

  it("does not snap with Shift", () => {
    expect(snapSectionHeight(301, true)).toBe(301);
  });

  it("goes back to the natural height below the minimum, and caps the maximum", () => {
    expect(snapSectionHeight(20)).toBeNull();
    expect(snapSectionHeight(-40)).toBeNull();
    expect(snapSectionHeight(99_999)).toBe(2000);
  });

  it("snaps image widths to 5% and treats 100% as the full width", () => {
    expect(snapImagePercent(62)).toBe(60);
    expect(snapImagePercent(63)).toBe(65);
    expect(snapImagePercent(62, true)).toBe(62);
    expect(snapImagePercent(3)).toBe(10);
    expect(snapImagePercent(140)).toBeNull();
    expect(snapImagePercent(99)).toBeNull();
  });

  it("resolves a height drag relative to where it started", () => {
    const drag: DragGeometry = { kind: "section-height", sectionId: "s1", height: 300 };
    const result = resolveDrag({ drag, start: { x: 0, y: 500, shift: false } }, { x: 0, y: 541, shift: false }, LABELS);
    expect(result.edit).toEqual({ kind: "section-height", sectionId: "s1", px: 344 });
    expect(result.feedback).toMatchObject({ label: "344px" });
  });

  it("labels a height below the minimum as automatic", () => {
    const drag: DragGeometry = { kind: "section-height", sectionId: "s1", height: 100 };
    const result = resolveDrag({ drag, start: { x: 0, y: 100, shift: false } }, { x: 0, y: 20, shift: false }, LABELS);
    expect(result.edit).toEqual({ kind: "section-height", sectionId: "s1", px: null });
    expect(result.feedback).toMatchObject({ label: "Auto" });
  });

  it("grows a centred image by twice the pointer's travel, mirrored in RTL", () => {
    const ltr: DragGeometry = { kind: "image-width", sectionId: "s", elementId: "i", width: 300, columnWidth: 600, rtl: false };
    // 300px wide, dragged 30px outwards: 360 / 600 = 60%.
    expect(resolveDrag({ drag: ltr, start: { x: 0, y: 0, shift: false } }, { x: 30, y: 0, shift: false }, LABELS).edit).toEqual({
      kind: "image-width",
      sectionId: "s",
      elementId: "i",
      pct: 60,
    });
    const rtl: DragGeometry = { ...ltr, rtl: true };
    expect(resolveDrag({ drag: rtl, start: { x: 0, y: 0, shift: false } }, { x: -30, y: 0, shift: false }, LABELS).edit).toMatchObject({
      pct: 60,
    });
  });
});

describe("column divider", () => {
  // A 1200px row with a 24px gap: unit = (1200 + 24) / 12 = 102.
  const drag = {
    kind: "column-width" as const,
    sectionId: "s",
    rowId: "r",
    index: 0,
    spans: [6, 6],
    pairStart: 0,
    unit: 102,
    gap: 24,
    rtl: false,
  };

  it("snaps the boundary to whole twelfths, keeping the pair's total", () => {
    expect(pairSpansAt(4 * 102 - 12, drag)).toEqual([4, 8]);
    expect(pairSpansAt(4 * 102 + 30, drag)).toEqual([4, 8]);
    expect(pairSpansAt(5 * 102 - 12, drag)).toEqual([5, 7]);
  });

  it("keeps at least one twelfth on each side", () => {
    expect(pairSpansAt(-500, drag)).toEqual([1, 11]);
    expect(pairSpansAt(5000, drag)).toEqual([11, 1]);
  });

  it("moves the boundary the other way in RTL", () => {
    const start = { x: 600, y: 0, shift: false };
    // Two units to the left: in RTL that makes the first column wider.
    const moved = { x: 600 - 2 * 102, y: 0, shift: false };
    expect(resolveDrag({ drag: { ...drag, rtl: true }, start }, moved, LABELS).edit).toEqual({
      kind: "column-spans",
      sectionId: "s",
      rowId: "r",
      index: 0,
      spans: [8, 4],
    });
    expect(resolveDrag({ drag, start }, moved, LABELS).edit).toMatchObject({ spans: [4, 8] });
  });

  it("labels a full row in percentages", () => {
    const result = resolveDrag({ drag, start: { x: 600, y: 0, shift: false } }, { x: 600 - 2 * 102, y: 0, shift: false }, LABELS);
    expect(result.feedback).toMatchObject({ label: "33% · 67%" });
  });
});

describe("keyboard steps", () => {
  it("moves a column divider one twelfth, never past one", () => {
    expect(stepEdit({ kind: "column-width", sectionId: "s", rowId: "r", index: 0, spans: [6, 6], delta: 1 })).toEqual({
      kind: "column-spans",
      sectionId: "s",
      rowId: "r",
      index: 0,
      spans: [7, 5],
    });
    expect(stepEdit({ kind: "column-width", sectionId: "s", rowId: "r", index: 0, spans: [1, 11], delta: -1 })).toBeNull();
  });

  it("steps heights by 8px from the snapped value, or 1px when fine", () => {
    expect(stepEdit({ kind: "section-height", sectionId: "s", delta: 1, fine: false, current: 301 })).toEqual({
      kind: "section-height",
      sectionId: "s",
      px: 304,
    });
    expect(stepEdit({ kind: "section-height", sectionId: "s", delta: -1, fine: true, current: 301 })).toMatchObject({ px: 300 });
  });

  it("steps an image by 5%, reaching the full width at the top", () => {
    expect(stepEdit({ kind: "image-width", sectionId: "s", elementId: "i", delta: -1, fine: false, current: 100 })).toMatchObject({
      pct: 95,
    });
    expect(stepEdit({ kind: "image-width", sectionId: "s", elementId: "i", delta: 1, fine: false, current: 95 })).toMatchObject({
      pct: null,
    });
  });
});

describe("message readers", () => {
  it("accepts a well-formed start", () => {
    const message = readCanvasDrag({
      phase: "start",
      x: 1,
      y: 2,
      shift: true,
      drag: { kind: "section-height", sectionId: "s", height: 200 },
    });
    expect(message).toEqual({
      type: "zimos:canvas-drag",
      phase: "start",
      drag: { kind: "section-height", sectionId: "s", height: 200 },
      pointer: { x: 1, y: 2, shift: true },
    });
  });

  it("rejects junk geometry and pointers", () => {
    expect(readCanvasDrag({ phase: "start", x: 1, y: 2, drag: { kind: "section-height", sectionId: "", height: 1 } })).toBeNull();
    expect(readCanvasDrag({ phase: "move", x: "1", y: 2 })).toBeNull();
    expect(
      readCanvasDrag({
        phase: "start",
        x: 0,
        y: 0,
        drag: { kind: "column-width", sectionId: "s", rowId: "r", index: 1, spans: [6, 6], pairStart: 0, unit: 10, gap: 0, rtl: false },
      })
    ).toBeNull();
    expect(readCanvasStep({ kind: "element", sectionId: "s", elementId: "e", delta: 2 })).toBeNull();
  });
});
