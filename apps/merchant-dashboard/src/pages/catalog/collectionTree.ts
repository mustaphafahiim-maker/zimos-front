/**
 * The collections page's tree, as a flat list in display order — each row
 * knows its depth and parent — plus the moves the page offers: drag (with a
 * sideways pull to nest or un-nest), up / down among siblings, indent under
 * the previous sibling and outdent to the parent's level. A row always moves
 * with everything under it.
 *
 * Pure, so the rules are tested on their own (collectionTree.test.ts). The
 * backend checks the same two limits on save (catalog/collectionTree.js):
 * no cycles, at most MAX_DEPTH levels.
 */

export const MAX_DEPTH = 3;

export interface TreeCollection {
  id: string;
  parentId: string | null;
  position: number;
  name: string;
}

export interface FlatNode<T extends TreeCollection = TreeCollection> {
  item: T;
  /** 0 for a top-level collection. */
  depth: number;
  parentId: string | null;
}

/** Depth-first, siblings by position then name — how the backend orders them. */
export function flattenTree<T extends TreeCollection>(items: readonly T[]): FlatNode<T>[] {
  const ids = new Set(items.map((i) => i.id));
  const children = new Map<string | null, T[]>();
  for (const item of items) {
    // A parent that isn't in the list (deleted meanwhile) reads as the top level.
    const parent = item.parentId && ids.has(item.parentId) ? item.parentId : null;
    if (!children.has(parent)) children.set(parent, []);
    children.get(parent)!.push(item);
  }
  for (const list of children.values()) {
    list.sort((a, b) => a.position - b.position || a.name.localeCompare(b.name));
  }
  const out: FlatNode<T>[] = [];
  const seen = new Set<string>();
  const walk = (parentId: string | null, depth: number) => {
    for (const item of children.get(parentId) ?? []) {
      if (seen.has(item.id)) continue;
      seen.add(item.id);
      out.push({ item, depth, parentId });
      walk(item.id, depth + 1);
    }
  };
  walk(null, 0);
  return out;
}

/** The index range [start, end) of the node at `index` and everything under it. */
export function subtreeRange(flat: readonly FlatNode[], index: number): [number, number] {
  const depth = flat[index].depth;
  let end = index + 1;
  while (end < flat.length && flat[end].depth > depth) end += 1;
  return [index, end];
}

/** How many levels sit under the node at `index` (0 for a leaf). */
export function subtreeHeight(flat: readonly FlatNode[], index: number): number {
  const [start, end] = subtreeRange(flat, index);
  let height = 0;
  for (let i = start + 1; i < end; i += 1) height = Math.max(height, flat[i].depth - flat[start].depth);
  return height;
}

/** Recomputes every parent from the depth sequence. */
function withParents<T extends TreeCollection>(flat: FlatNode<T>[]): FlatNode<T>[] {
  const stack: string[] = [];
  return flat.map((node) => {
    stack.length = node.depth;
    const parentId = node.depth === 0 ? null : (stack[node.depth - 1] ?? null);
    stack[node.depth] = node.item.id;
    return { ...node, parentId };
  });
}

/**
 * Moves the subtree at `from` so that it lands where the row at `to` was,
 * at `depth` (clamped to what is legal there). Used by drag and drop.
 */
export function moveSubtree<T extends TreeCollection>(
  flat: readonly FlatNode<T>[],
  from: number,
  to: number,
  depth: number
): FlatNode<T>[] {
  const [start, end] = subtreeRange(flat, from);
  // Dropped onto its own subtree: nothing to do.
  if (to >= start && to < end) return [...flat];
  const block = flat.slice(start, end);
  const rest = [...flat.slice(0, start), ...flat.slice(end)];
  // `to` counted in the original list; translate it into `rest`.
  let insertAt = to > from ? to - block.length + 1 : to;
  insertAt = Math.max(0, Math.min(rest.length, insertAt));
  const allowed = depthRange(rest, insertAt, subtreeHeight(flat, from));
  const target = Math.max(allowed.min, Math.min(allowed.max, depth));
  // Never land between a collection and its sub-collections at a shallower
  // depth: they would silently change parent. Step past them instead.
  while (insertAt < rest.length && rest[insertAt].depth > target) insertAt += 1;
  const shift = target - block[0].depth;
  const moved = block.map((node) => ({ ...node, depth: node.depth + shift }));
  return withParents([...rest.slice(0, insertAt), ...moved, ...rest.slice(insertAt)]);
}

/**
 * The depths a block of the given height may take when inserted before
 * `rest[index]`: at most one deeper than the row above, at least as deep as
 * the row below requires, and never past MAX_DEPTH.
 */
export function depthRange(rest: readonly FlatNode[], index: number, height: number): { min: number; max: number } {
  const above = index > 0 ? rest[index - 1] : null;
  const below = index < rest.length ? rest[index] : null;
  const max = Math.min(above ? above.depth + 1 : 0, MAX_DEPTH - 1 - height);
  const min = below ? below.depth : 0;
  return { min: Math.min(min, Math.max(0, max)), max: Math.max(0, max) };
}

/** The depth a drag lands at: the row's own depth plus the sideways pull, in indent steps. */
export function projectedDepth(
  flat: readonly FlatNode[],
  from: number,
  offsetX: number,
  indentWidth: number,
  rtl: boolean
): number {
  const steps = Math.round(((rtl ? -1 : 1) * offsetX) / indentWidth);
  return flat[from].depth + steps;
}

function siblings(flat: readonly FlatNode[], index: number): number[] {
  const { parentId, depth } = flat[index];
  return flat.flatMap((node, i) => (node.depth === depth && node.parentId === parentId ? [i] : []));
}

export function canMoveUp(flat: readonly FlatNode[], index: number): boolean {
  return siblings(flat, index)[0] !== index;
}

export function canMoveDown(flat: readonly FlatNode[], index: number): boolean {
  const s = siblings(flat, index);
  return s[s.length - 1] !== index;
}

/** Swaps the subtree at `index` with its previous (-1) or next (+1) sibling's. */
export function moveAmongSiblings<T extends TreeCollection>(
  flat: readonly FlatNode<T>[],
  index: number,
  direction: -1 | 1
): FlatNode<T>[] {
  const s = siblings(flat, index);
  const other = s[s.indexOf(index) + direction];
  if (other === undefined) return [...flat];
  const [first, second] = direction === -1 ? [other, index] : [index, other];
  const [aStart, aEnd] = subtreeRange(flat, first);
  const [bStart, bEnd] = subtreeRange(flat, second);
  return withParents([
    ...flat.slice(0, aStart),
    ...flat.slice(bStart, bEnd),
    ...flat.slice(aEnd, bStart),
    ...flat.slice(aStart, aEnd),
    ...flat.slice(bEnd),
  ]);
}

/** Whether the row can go one level deeper, under its previous sibling. */
export function canIndent(flat: readonly FlatNode[], index: number): boolean {
  return canMoveUp(flat, index) && flat[index].depth + 1 + subtreeHeight(flat, index) <= MAX_DEPTH - 1;
}

/** Makes the row the last child of its previous sibling. */
export function indent<T extends TreeCollection>(flat: readonly FlatNode<T>[], index: number): FlatNode<T>[] {
  if (!canIndent(flat, index)) return [...flat];
  const [start, end] = subtreeRange(flat, index);
  return withParents(flat.map((node, i) => (i >= start && i < end ? { ...node, depth: node.depth + 1 } : node)));
}

export function canOutdent(flat: readonly FlatNode[], index: number): boolean {
  return flat[index].depth > 0;
}

/** Moves the row up a level, right after its parent's subtree. */
export function outdent<T extends TreeCollection>(flat: readonly FlatNode<T>[], index: number): FlatNode<T>[] {
  if (!canOutdent(flat, index)) return [...flat];
  const parentIndex = flat.findIndex((node) => node.item.id === flat[index].parentId);
  const [start, end] = subtreeRange(flat, index);
  const block = flat.slice(start, end).map((node) => ({ ...node, depth: node.depth - 1 }));
  const rest = [...flat.slice(0, start), ...flat.slice(end)];
  const parentInRest = parentIndex < start ? parentIndex : parentIndex - (end - start);
  const [, parentEnd] = subtreeRange(rest, parentInRest);
  return withParents([...rest.slice(0, parentEnd), ...block, ...rest.slice(parentEnd)]);
}

/** Everything the reorder request needs, for the rows whose parent or position changed. */
export function reorderItems(
  flat: readonly FlatNode[]
): Array<{ id: string; parentId: string | null; position: number }> {
  const counters = new Map<string | null, number>();
  const out: Array<{ id: string; parentId: string | null; position: number }> = [];
  for (const node of flat) {
    const position = counters.get(node.parentId) ?? 0;
    counters.set(node.parentId, position + 1);
    if (node.item.parentId !== node.parentId || node.item.position !== position) {
      out.push({ id: node.item.id, parentId: node.parentId, position });
    }
  }
  return out;
}
