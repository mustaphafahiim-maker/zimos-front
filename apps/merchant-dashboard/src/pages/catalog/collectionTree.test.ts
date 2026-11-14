import { describe, expect, it } from "vitest";
import {
  MAX_DEPTH,
  canIndent,
  canMoveDown,
  canMoveUp,
  canOutdent,
  flattenTree,
  indent,
  moveAmongSiblings,
  moveSubtree,
  outdent,
  projectedDepth,
  reorderItems,
  type FlatNode,
  type TreeCollection,
} from "./collectionTree";

const c = (id: string, parentId: string | null = null, position = 0): TreeCollection => ({
  id,
  parentId,
  position,
  name: id,
});

const shape = (flat: FlatNode[]) => flat.map((n) => `${"-".repeat(n.depth)}${n.item.id}`);

/*
 *  men
 *  -shirts
 *  --linen
 *  -jackets
 *  women
 *  sale
 */
const tree = () =>
  flattenTree([
    c("women", null, 1),
    c("men", null, 0),
    c("shirts", "men", 0),
    c("linen", "shirts", 0),
    c("jackets", "men", 1),
    c("sale", null, 2),
  ]);

describe("collection tree", () => {
  it("flattens depth-first in the merchant's order", () => {
    expect(shape(tree())).toEqual(["men", "-shirts", "--linen", "-jackets", "women", "sale"]);
    expect(MAX_DEPTH).toBe(3);
  });

  it("moves a collection among its siblings with everything under it", () => {
    const flat = tree();
    const down = moveAmongSiblings(flat, 0, 1);
    expect(shape(down)).toEqual(["women", "men", "-shirts", "--linen", "-jackets", "sale"]);
    expect(canMoveUp(flat, 0)).toBe(false);
    expect(canMoveDown(flat, 5)).toBe(false);
    const up = moveAmongSiblings(flat, 3, -1);
    expect(shape(up)).toEqual(["men", "-jackets", "-shirts", "--linen", "women", "sale"]);
  });

  it("indents under the previous sibling, but never past three levels", () => {
    const flat = tree();
    // women -> under men, after jackets
    const indented = indent(flat, 4);
    expect(shape(indented)).toEqual(["men", "-shirts", "--linen", "-jackets", "-women", "sale"]);
    expect(indented[4].parentId).toBe("men");
    // jackets under shirts would be fine (depth 2)…
    expect(canIndent(flat, 3)).toBe(true);
    // …but shirts can't go under anything: linen would be a fourth level.
    expect(canIndent(flat, 1)).toBe(false);
  });

  it("outdents to the parent's level, after the parent's subtree", () => {
    const flat = tree();
    const out = outdent(flat, 1);
    expect(shape(out)).toEqual(["men", "-jackets", "shirts", "-linen", "women", "sale"]);
    expect(out[2].parentId).toBeNull();
    expect(canOutdent(flat, 0)).toBe(false);
  });

  it("drops a dragged collection where it lands, pulled sideways to nest it", () => {
    const flat = tree();
    // sale dragged up onto women, pulled one indent in → the last child of men? No: under the row above (jackets' level at most +1).
    const onto = moveSubtree(flat, 5, 4, 1);
    expect(shape(onto)).toEqual(["men", "-shirts", "--linen", "-jackets", "-sale", "women"]);
    // Without the pull it stays top level.
    expect(shape(moveSubtree(flat, 5, 4, 0))).toEqual(["men", "-shirts", "--linen", "-jackets", "sale", "women"]);
  });

  it("never lands between a collection and its children", () => {
    const flat = tree();
    // women dragged up onto shirts at top level would sit between men and its children…
    const moved = moveSubtree(flat, 4, 1, 0);
    // …so it becomes men's child (the row below it is a child of men).
    expect(shape(moved)).toEqual(["men", "-women", "-shirts", "--linen", "-jackets", "sale"]);
    // A subtree of height 2 can only be top level: it steps past men's children instead.
    const deep = moveSubtree(
      flattenTree([c("a"), c("a1", "a"), c("b", null, 1), c("b1", "b"), c("b2", "b1")]),
      2,
      1,
      0
    );
    expect(shape(deep)).toEqual(["a", "-a1", "b", "-b1", "--b2"]);
  });

  it("reads the sideways pull in either direction", () => {
    const flat = tree();
    expect(projectedDepth(flat, 4, 50, 24, false)).toBe(2);
    expect(projectedDepth(flat, 4, -50, 24, true)).toBe(2);
    expect(projectedDepth(flat, 4, 5, 24, false)).toBe(0);
  });

  it("sends only what changed", () => {
    const flat = tree();
    expect(reorderItems(flat)).toEqual([]);
    const items = reorderItems(indent(flat, 4));
    expect(items).toEqual([
      { id: "women", parentId: "men", position: 2 },
      { id: "sale", parentId: null, position: 1 },
    ]);
  });
});
