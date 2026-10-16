import { describe, expect, it } from "vitest";
import type { PageSection } from "@store-builder/api-client";
import { applyCanvasEdit, moveElementTo, setImageWidth, setSectionMinHeight } from "./canvasEdits";

/** Two sections: `s1` with two columns (a, b | c), `s2` with one column (d). */
function page(): PageSection[] {
  const el = (id: string) => ({ id, type: "text" as const, props: { text: id } });
  return [
    {
      id: "s1",
      type: "section",
      rows: [
        {
          id: "r1",
          type: "row",
          columns: [
            { id: "c1", type: "column", span: 6, elements: [el("a"), el("b")] },
            { id: "c2", type: "column", span: 6, elements: [el("c")] },
          ],
        },
      ],
    },
    {
      id: "s2",
      type: "section",
      rows: [{ id: "r2", type: "row", columns: [{ id: "c3", type: "column", span: 12, elements: [el("d")] }] }],
    },
  ];
}

const ids = (sections: PageSection[], columnId: string) =>
  sections
    .flatMap((s) => s.rows.flatMap((r) => r.columns))
    .find((c) => c.id === columnId)!
    .elements.map((e) => e.id);

describe("moveElementTo", () => {
  it("reorders within a column, counting the column as it was", () => {
    const next = moveElementTo(page(), "a", "c1", 2);
    expect(ids(next, "c1")).toEqual(["b", "a"]);
  });

  it("moves into another column of the same section", () => {
    const next = moveElementTo(page(), "a", "c2", 0);
    expect(ids(next, "c1")).toEqual(["b"]);
    expect(ids(next, "c2")).toEqual(["a", "c"]);
  });

  it("moves into another section", () => {
    const next = moveElementTo(page(), "c", "c3", 1);
    expect(ids(next, "c2")).toEqual([]);
    expect(ids(next, "c3")).toEqual(["d", "c"]);
  });

  it("returns the same array for a drop in place or an unknown target", () => {
    const sections = page();
    expect(moveElementTo(sections, "a", "c1", 0)).toBe(sections);
    expect(moveElementTo(sections, "a", "c1", 1)).toBe(sections);
    expect(moveElementTo(sections, "a", "nope", 0)).toBe(sections);
    expect(moveElementTo(sections, "nope", "c1", 0)).toBe(sections);
  });

  it("leaves untouched sections as the same objects", () => {
    const sections = page();
    const next = moveElementTo(sections, "a", "c1", 2);
    expect(next[1]).toBe(sections[1]);
  });
});

describe("applyCanvasEdit", () => {
  it("moves a section with moveSection's target index", () => {
    const next = applyCanvasEdit(page(), { kind: "move-section", sectionId: "s1", to: 1 });
    expect(next.map((s) => s.id)).toEqual(["s2", "s1"]);
  });

  it("sets and clears a minimum height, dropping empty settings", () => {
    const [s1] = page();
    const tall = setSectionMinHeight(s1, 480);
    expect(tall.settings).toEqual({ minHeight: 480 });
    expect(setSectionMinHeight(tall, null)).not.toHaveProperty("settings");
    expect(setSectionMinHeight(s1, null)).toBe(s1);
  });

  it("sets two neighbouring column spans", () => {
    const next = applyCanvasEdit(page(), { kind: "column-spans", sectionId: "s1", rowId: "r1", index: 0, spans: [4, 8] });
    expect(next[0].rows[0].columns.map((c) => c.span)).toEqual([4, 8]);
  });

  it("gives an image a width in place of its named size, and clears both for the full width", () => {
    const section: PageSection = {
      id: "s",
      type: "section",
      rows: [
        {
          id: "r",
          type: "row",
          columns: [{ id: "c", type: "column", span: 12, elements: [{ id: "i", type: "image", props: { src: "x", size: "medium" } }] }],
        },
      ],
    };
    const narrow = setImageWidth(section, "i", 60);
    expect(narrow.rows[0].columns[0].elements[0].props).toEqual({ src: "x", width: 60 });
    expect(setImageWidth(narrow, "i", 60)).toBe(narrow);
    expect(setImageWidth(narrow, "i", null).rows[0].columns[0].elements[0].props).toEqual({ src: "x" });
  });
});
