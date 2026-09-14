/**
 * The visual builder's single source of truth: every page draft, the theme,
 * the selection and undo/redo history. Pure reducer — no React, no network —
 * so every mutation is unit-testable and always produces a tree that passes
 * validatePageTree (ids are unique, node types fixed, spans 1..12).
 */
import {
  collectIds,
  createIdFactory,
  normalizeThemeSettings,
  validatePageTree,
  type NodePath,
  type ThemeSettings,
  type Tree,
  type TreeColumn,
  type TreeElement,
  type TreeRow,
  type TreeSection,
} from "@store-builder/store-renderer";

export const HISTORY_LIMIT = 150;
/** Consecutive edits with the same group key inside this window are one undo step. */
export const GROUP_WINDOW_MS = 1200;

export interface EditorPage {
  id: string;
  title: string;
  path: string;
  pageType: string;
}

interface Snapshot {
  trees: Record<string, Tree>;
  theme: ThemeSettings;
}

export interface EditorState {
  pages: EditorPage[];
  trees: Record<string, Tree>;
  /** JSON of each tree as last loaded/saved — the dirty check. */
  savedTrees: Record<string, string>;
  theme: ThemeSettings;
  savedTheme: string;
  currentPageId: string | null;
  selection: NodePath | null;
  /** Section ids picked together in the outline (Ctrl/Shift+click) for bulk actions. */
  multi: string[];
  past: Snapshot[];
  future: Snapshot[];
  lastGroup: string | null;
  lastAt: number;
  /** Bumped on every content change (drives autosave debounce). */
  revision: number;
}

export type EditorAction =
  | { type: "load"; pages: Array<EditorPage & { tree: unknown }>; theme: unknown; currentPageId?: string | null }
  | { type: "addPage"; page: EditorPage; tree?: Tree }
  | { type: "removePage"; pageId: string }
  /** Replaces a page with the server's copy (someone else saved it) — becomes the clean baseline. */
  | { type: "reloadPage"; pageId: string; tree: unknown }
  | { type: "setPage"; pageId: string }
  | { type: "select"; path: NodePath | null }
  | { type: "insertSection"; section: TreeSection; index?: number }
  | { type: "moveSection"; from: number; to: number }
  | { type: "duplicateSection"; sectionId: string }
  | { type: "deleteNode"; path: NodePath }
  | { type: "toggleHidden"; sectionId: string }
  | { type: "updateSettings"; path: NodePath; patch: Record<string, unknown>; group?: string; at?: number }
  | { type: "updateProps"; path: NodePath; patch: Record<string, unknown>; group?: string; at?: number }
  | { type: "inlineEdit"; path: NodePath; field: string; value: string }
  | { type: "insertElement"; columnPath: NodePath; element: TreeElement; index?: number }
  | { type: "moveElement"; path: NodePath; delta: -1 | 1 }
  | { type: "moveElementTo"; path: NodePath; columnPath: NodePath; index?: number }
  | { type: "toggleMulti"; sectionId: string }
  | { type: "clearMulti" }
  | { type: "insertSections"; sections: TreeSection[]; index?: number }
  | { type: "deleteSections"; ids: string[] }
  | { type: "duplicateSections"; ids: string[] }
  | { type: "setHiddenMany"; ids: string[]; hidden: boolean }
  | { type: "setRowColumns"; rowPath: NodePath; spans: number[] }
  | { type: "setTheme"; theme: ThemeSettings; group?: string; at?: number }
  | { type: "applyTheme"; theme: ThemeSettings; trees?: Record<string, Tree> }
  | { type: "undo" }
  | { type: "redo" }
  | { type: "markSaved"; trees?: Record<string, string>; theme?: string };

const EMPTY_TREE = (): Tree => ({ version: 1, sections: [] });

/** Coerces whatever the server stored into a tree the builder can edit. */
export function normalizeTree(data: unknown): Tree {
  if (!data || typeof data !== "object" || Array.isArray(data)) return EMPTY_TREE();
  const d = data as Record<string, unknown>;
  const sections = Array.isArray(d.sections) ? (d.sections as TreeSection[]) : [];
  const out: Tree = { ...(d as object), sections } as Tree;
  if (out.version === undefined) out.version = 1;
  return out;
}

export function initialEditorState(): EditorState {
  const theme = normalizeThemeSettings(null);
  return {
    pages: [],
    trees: {},
    savedTrees: {},
    theme,
    savedTheme: JSON.stringify(theme),
    currentPageId: null,
    selection: null,
    multi: [],
    past: [],
    future: [],
    lastGroup: null,
    lastAt: 0,
    revision: 0,
  };
}

// ---------------------------------------------------------------------------
// Path helpers
// ---------------------------------------------------------------------------

export interface ResolvedPath {
  section?: TreeSection;
  sectionIndex: number;
  row?: TreeRow;
  column?: TreeColumn;
  element?: TreeElement;
  kind: "section" | "row" | "column" | "element" | null;
}

/**
 * The renderer addresses nodes as "sec", "sec/row/col" and
 * "sec/row/col/el" (rows have no own path in the canvas, the builder uses
 * "sec/row" for them).
 */
export function resolvePath(tree: Tree | undefined, path: NodePath | null): ResolvedPath {
  const none: ResolvedPath = { sectionIndex: -1, kind: null };
  if (!tree || !path) return none;
  const [sid, rid, cid, eid] = path.split("/");
  const sectionIndex = tree.sections.findIndex((s) => s.id === sid);
  const section = tree.sections[sectionIndex];
  if (!section) return none;
  if (!rid) return { section, sectionIndex, kind: "section" };
  const row = section.rows.find((r) => r.id === rid);
  if (!row) return { section, sectionIndex, kind: "section" };
  if (!cid) return { section, sectionIndex, row, kind: "row" };
  const column = row.columns.find((c) => c.id === cid);
  if (!column) return { section, sectionIndex, row, kind: "row" };
  if (!eid) return { section, sectionIndex, row, column, kind: "column" };
  const element = column.elements.find((e) => e.id === eid);
  if (!element) return { section, sectionIndex, row, column, kind: "column" };
  return { section, sectionIndex, row, column, element, kind: "element" };
}

/** The column a new element should go into for the current selection. */
export function targetColumnPath(tree: Tree | undefined, selection: NodePath | null): NodePath | null {
  const r = resolvePath(tree, selection);
  if (!r.section) return null;
  if (r.column && r.row) return `${r.section.id}/${r.row.id}/${r.column.id}`;
  const row = r.row ?? r.section.rows[0];
  const column = row?.columns[0];
  return row && column ? `${r.section.id}/${row.id}/${column.id}` : null;
}

// ---------------------------------------------------------------------------
// Immutable tree edits
// ---------------------------------------------------------------------------

function mapSection(tree: Tree, sid: string, fn: (s: TreeSection) => TreeSection): Tree {
  return { ...tree, sections: tree.sections.map((s) => (s.id === sid ? fn(s) : s)) };
}

function mapRow(tree: Tree, sid: string, rid: string, fn: (r: TreeRow) => TreeRow): Tree {
  return mapSection(tree, sid, (s) => ({ ...s, rows: s.rows.map((r) => (r.id === rid ? fn(r) : r)) }));
}

function mapColumn(tree: Tree, sid: string, rid: string, cid: string, fn: (c: TreeColumn) => TreeColumn): Tree {
  return mapRow(tree, sid, rid, (r) => ({ ...r, columns: r.columns.map((c) => (c.id === cid ? fn(c) : c)) }));
}

function mapElement(tree: Tree, path: string, fn: (e: TreeElement) => TreeElement): Tree {
  const [sid, rid, cid, eid] = path.split("/");
  return mapColumn(tree, sid, rid, cid, (c) => ({ ...c, elements: c.elements.map((e) => (e.id === eid ? fn(e) : e)) }));
}

/** Deep copy with brand-new ids everywhere, unique within `taken`. */
export function cloneWithNewIds<T extends TreeSection | TreeElement>(node: T, taken: Set<string>): T {
  const factory = createIdFactory(`copy${Math.random().toString(36).slice(2, 7)}`);
  const fresh = (kind: string) => {
    let id = factory(kind);
    while (taken.has(id)) id = factory(kind);
    taken.add(id);
    return id;
  };
  const copy = structuredClone(node) as T;
  if (copy.type === "section") {
    const s = copy as TreeSection;
    s.id = fresh("sec");
    for (const r of s.rows) {
      r.id = fresh("row");
      for (const c of r.columns) {
        c.id = fresh("col");
        for (const e of c.elements) e.id = fresh(e.type);
      }
    }
  } else {
    copy.id = fresh((copy as TreeElement).type);
  }
  return copy;
}

/** Makes sure an incoming node's ids don't collide with the page. */
function ensureUniqueIds<T extends TreeSection | TreeElement>(tree: Tree, node: T): T {
  const taken = new Set(collectIds(tree));
  const incoming = node.type === "section" ? collectIds({ sections: [node as TreeSection] }) : [node.id];
  return incoming.some((id) => taken.has(id)) ? cloneWithNewIds(node, taken) : node;
}

/** Column spans for a layout preset; must add to 12. */
export const COLUMN_PRESETS: number[][] = [[12], [6, 6], [4, 8], [8, 4], [4, 4, 4], [3, 3, 3, 3]];

function setRowColumns(tree: Tree, sid: string, rid: string, spans: number[]): Tree {
  const clean = spans.map((n) => Math.min(12, Math.max(1, Math.round(n)))).slice(0, 12);
  if (clean.length === 0) return tree;
  const taken = new Set(collectIds(tree));
  const factory = createIdFactory(`col${Math.random().toString(36).slice(2, 7)}`);
  return mapRow(tree, sid, rid, (r) => {
    const cols = r.columns.slice(0, clean.length).map((c, i) => ({ ...c, span: clean[i] }));
    // Removed columns keep their content: merged into the last kept column.
    const dropped = r.columns.slice(clean.length).flatMap((c) => c.elements);
    if (dropped.length > 0 && cols.length > 0) {
      const last = cols[cols.length - 1];
      cols[cols.length - 1] = { ...last, elements: [...last.elements, ...dropped] };
    }
    while (cols.length < clean.length) {
      let id = factory("col");
      while (taken.has(id)) id = factory("col");
      taken.add(id);
      cols.push({ id, type: "column", span: clean[cols.length], settings: {}, elements: [] });
    }
    return { ...r, columns: cols };
  });
}

// ---------------------------------------------------------------------------
// Reducer
// ---------------------------------------------------------------------------

function snapshot(state: EditorState): Snapshot {
  return { trees: state.trees, theme: state.theme };
}

/** Records history before a content change. `group` merges rapid edits (typing). */
function commit(state: EditorState, next: Partial<EditorState>, group?: string, at = Date.now()): EditorState {
  const merge = !!group && group === state.lastGroup && at - state.lastAt < GROUP_WINDOW_MS && state.past.length > 0;
  const past = merge ? state.past : [...state.past, snapshot(state)].slice(-HISTORY_LIMIT);
  return { ...state, ...next, past, future: [], lastGroup: group ?? null, lastAt: at, revision: state.revision + 1 };
}

function currentTree(state: EditorState): Tree | undefined {
  return state.currentPageId ? state.trees[state.currentPageId] : undefined;
}

function withTree(state: EditorState, tree: Tree, extra: Partial<EditorState> = {}, group?: string, at?: number): EditorState {
  if (!state.currentPageId) return state;
  return commit(state, { trees: { ...state.trees, [state.currentPageId]: tree }, ...extra }, group, at);
}

function selectionExists(tree: Tree | undefined, path: NodePath | null): NodePath | null {
  if (!path) return null;
  const r = resolvePath(tree, path);
  const depth = path.split("/").length;
  const ok = (depth === 1 && r.kind === "section") || (depth === 2 && r.kind === "row") || (depth === 3 && r.kind === "column") || (depth === 4 && r.kind === "element");
  return ok ? path : r.section ? r.section.id : null;
}

export function editorReducer(state: EditorState, action: EditorAction): EditorState {
  switch (action.type) {
    case "load": {
      const trees: Record<string, Tree> = {};
      const savedTrees: Record<string, string> = {};
      for (const p of action.pages) {
        trees[p.id] = normalizeTree(p.tree);
        savedTrees[p.id] = JSON.stringify(trees[p.id]);
      }
      const theme = normalizeThemeSettings(action.theme);
      const pages = action.pages.map(({ id, title, path, pageType }) => ({ id, title, path, pageType }));
      const current =
        action.currentPageId && trees[action.currentPageId]
          ? action.currentPageId
          : (pages.find((p) => p.pageType === "home") ?? pages.find((p) => p.path === "/") ?? pages[0])?.id ?? null;
      return { ...initialEditorState(), pages, trees, savedTrees, theme, savedTheme: JSON.stringify(theme), currentPageId: current };
    }

    case "addPage": {
      const tree = normalizeTree(action.tree ?? null);
      return {
        ...state,
        pages: [...state.pages.filter((p) => p.id !== action.page.id), action.page],
        trees: { ...state.trees, [action.page.id]: tree },
        savedTrees: { ...state.savedTrees, [action.page.id]: JSON.stringify(tree) },
      };
    }

    case "reloadPage": {
      if (!state.trees[action.pageId]) return state;
      const tree = normalizeTree(action.tree);
      const next = { ...state, trees: { ...state.trees, [action.pageId]: tree }, savedTrees: { ...state.savedTrees, [action.pageId]: JSON.stringify(tree) }, revision: state.revision + 1 };
      if (state.currentPageId !== action.pageId) return next;
      return { ...next, selection: selectionExists(tree, state.selection), multi: [] };
    }

    case "removePage": {
      const trees = { ...state.trees };
      const savedTrees = { ...state.savedTrees };
      delete trees[action.pageId];
      delete savedTrees[action.pageId];
      const pages = state.pages.filter((p) => p.id !== action.pageId);
      const currentPageId = state.currentPageId === action.pageId ? (pages.find((p) => p.path === "/") ?? pages[0])?.id ?? null : state.currentPageId;
      return { ...state, pages, trees, savedTrees, currentPageId, selection: state.currentPageId === action.pageId ? null : state.selection };
    }

    case "setPage":
      if (!state.trees[action.pageId]) return state;
      return { ...state, currentPageId: action.pageId, selection: null, multi: [], lastGroup: null };

    case "select":
      return { ...state, selection: selectionExists(currentTree(state), action.path), multi: [] };

    case "toggleMulti": {
      const tree = currentTree(state);
      if (!tree?.sections.some((s) => s.id === action.sectionId)) return state;
      // The section already selected on its own joins the group first.
      const base = state.multi.length === 0 && state.selection ? [state.selection.split("/")[0]] : state.multi;
      const multi = base.includes(action.sectionId) ? base.filter((id) => id !== action.sectionId) : [...base, action.sectionId];
      return { ...state, multi, selection: multi.length === 1 ? multi[0] : multi.length === 0 ? null : state.selection };
    }

    case "clearMulti":
      return state.multi.length ? { ...state, multi: [] } : state;

    case "insertSections": {
      const tree = currentTree(state);
      if (!tree || action.sections.length === 0) return state;
      const inserted: TreeSection[] = [];
      // Each pasted section must be unique against the page and the ones pasted before it.
      for (const node of action.sections) inserted.push(ensureUniqueIds({ ...tree, sections: [...tree.sections, ...inserted] }, node));
      const index = Math.max(0, Math.min(tree.sections.length, action.index ?? tree.sections.length));
      const sections = [...tree.sections];
      sections.splice(index, 0, ...inserted);
      return withTree(state, { ...tree, sections }, { selection: inserted[inserted.length - 1].id, multi: inserted.length > 1 ? inserted.map((s) => s.id) : [] });
    }

    case "deleteSections": {
      const tree = currentTree(state);
      if (!tree || !action.ids.some((id) => tree.sections.some((s) => s.id === id))) return state;
      const next = { ...tree, sections: tree.sections.filter((s) => !action.ids.includes(s.id)) };
      return withTree(state, next, { selection: null, multi: [] });
    }

    case "duplicateSections": {
      const tree = currentTree(state);
      if (!tree) return state;
      const taken = new Set(collectIds(tree));
      const sections: TreeSection[] = [];
      const copies: string[] = [];
      for (const s of tree.sections) {
        sections.push(s);
        if (action.ids.includes(s.id)) {
          const copy = cloneWithNewIds(s, taken);
          sections.push(copy);
          copies.push(copy.id);
        }
      }
      if (copies.length === 0) return state;
      return withTree(state, { ...tree, sections }, { multi: copies.length > 1 ? copies : [], selection: copies[copies.length - 1] });
    }

    case "setHiddenMany": {
      const tree = currentTree(state);
      if (!tree) return state;
      const next = {
        ...tree,
        sections: tree.sections.map((s) => {
          if (!action.ids.includes(s.id)) return s;
          const settings = { ...(s.settings ?? {}) };
          if (action.hidden) settings.hidden = true;
          else delete settings.hidden;
          return { ...s, settings };
        }),
      };
      return withTree(state, next);
    }

    case "moveElementTo": {
      const tree = currentTree(state);
      const from = resolvePath(tree, action.path);
      const to = resolvePath(tree, action.columnPath);
      if (!tree || from.kind !== "element" || !from.element || !from.row || !from.column || to.kind !== "column" || !to.row || !to.column || !to.section) return state;
      const element = from.element;
      const sameColumn = from.column.id === to.column.id && from.row.id === to.row.id && from.section!.id === to.section.id;
      const oldIndex = from.column.elements.findIndex((e) => e.id === element.id);
      let index = Math.max(0, Math.min(to.column.elements.length, action.index ?? to.column.elements.length));
      if (sameColumn) {
        if (index > oldIndex) index -= 1;
        if (index === oldIndex) return state;
      }
      let next = mapColumn(tree, from.section!.id, from.row.id, from.column.id, (c) => ({ ...c, elements: c.elements.filter((e) => e.id !== element.id) }));
      next = mapColumn(next, to.section.id, to.row.id, to.column.id, (c) => {
        const elements = [...c.elements];
        elements.splice(Math.min(index, elements.length), 0, element);
        return { ...c, elements };
      });
      return withTree(state, next, { selection: `${action.columnPath}/${element.id}` });
    }

    case "insertSection": {
      const tree = currentTree(state);
      if (!tree) return state;
      const section = ensureUniqueIds(tree, action.section);
      const index = Math.max(0, Math.min(tree.sections.length, action.index ?? tree.sections.length));
      const sections = [...tree.sections];
      sections.splice(index, 0, section);
      return withTree(state, { ...tree, sections }, { selection: section.id });
    }

    case "moveSection": {
      const tree = currentTree(state);
      if (!tree) return state;
      const { from, to } = action;
      if (from === to || from < 0 || to < 0 || from >= tree.sections.length || to >= tree.sections.length) return state;
      const sections = [...tree.sections];
      const [moved] = sections.splice(from, 1);
      sections.splice(to, 0, moved);
      return withTree(state, { ...tree, sections });
    }

    case "duplicateSection": {
      const tree = currentTree(state);
      if (!tree) return state;
      const index = tree.sections.findIndex((s) => s.id === action.sectionId);
      if (index < 0) return state;
      const copy = cloneWithNewIds(tree.sections[index], new Set(collectIds(tree)));
      const label = tree.sections[index].settings?.label;
      if (typeof label === "string" && label) copy.settings = { ...copy.settings, label: `${label} (2)` };
      const sections = [...tree.sections];
      sections.splice(index + 1, 0, copy);
      return withTree(state, { ...tree, sections }, { selection: copy.id });
    }

    case "deleteNode": {
      const tree = currentTree(state);
      const r = resolvePath(tree, action.path);
      if (!tree || !r.section) return state;
      let next: Tree;
      let selection: NodePath | null = null;
      if (r.kind === "section") {
        next = { ...tree, sections: tree.sections.filter((s) => s.id !== r.section!.id) };
        selection = null;
      } else if (r.kind === "element" && r.row && r.column && r.element) {
        next = mapColumn(tree, r.section.id, r.row.id, r.column.id, (c) => ({ ...c, elements: c.elements.filter((e) => e.id !== r.element!.id) }));
        selection = `${r.section.id}/${r.row.id}/${r.column.id}`;
      } else if (r.kind === "column" && r.row && r.column) {
        if (r.row.columns.length <= 1) return state; // a row needs a column
        const remaining = r.row.columns.filter((c) => c.id !== r.column!.id);
        const total = remaining.reduce((n, c) => n + (c.span ?? 12), 0);
        next = mapRow(tree, r.section.id, r.row.id, (row) => ({
          ...row,
          columns: remaining.map((c) => ({ ...c, span: total > 12 ? c.span : Math.max(1, Math.round(((c.span ?? 12) / total) * 12)) })),
        }));
        selection = r.section.id;
      } else if (r.kind === "row" && r.row) {
        if (r.section.rows.length <= 1) return state;
        next = mapSection(tree, r.section.id, (s) => ({ ...s, rows: s.rows.filter((row) => row.id !== r.row!.id) }));
        selection = r.section.id;
      } else {
        return state;
      }
      return withTree(state, next, { selection });
    }

    case "toggleHidden": {
      const tree = currentTree(state);
      const section = tree?.sections.find((s) => s.id === action.sectionId);
      if (!tree || !section) return state;
      const hidden = !section.settings?.hidden;
      const settings = { ...(section.settings ?? {}) };
      if (hidden) settings.hidden = true;
      else delete settings.hidden;
      return withTree(state, mapSection(tree, section.id, (s) => ({ ...s, settings })));
    }

    case "updateSettings": {
      const tree = currentTree(state);
      const r = resolvePath(tree, action.path);
      if (!tree || !r.section) return state;
      const apply = (settings: Record<string, unknown> | undefined) => {
        const out = { ...(settings ?? {}) };
        for (const [k, v] of Object.entries(action.patch)) {
          if (v === undefined || v === null || v === "") delete out[k];
          else out[k] = v;
        }
        return out;
      };
      let next: Tree;
      if (r.kind === "section") next = mapSection(tree, r.section.id, (s) => ({ ...s, settings: apply(s.settings) }));
      else if (r.kind === "row" && r.row) next = mapRow(tree, r.section.id, r.row.id, (row) => ({ ...row, settings: apply(row.settings) }));
      else if (r.kind === "column" && r.row && r.column) {
        // `span` lives on the column node itself; everything else in settings.
        const { span, ...rest } = action.patch;
        next = mapColumn(tree, r.section.id, r.row.id, r.column.id, (c) => {
          const settings = { ...(c.settings ?? {}) };
          for (const [k, v] of Object.entries(rest)) {
            if (v === undefined || v === null || v === "") delete settings[k];
            else settings[k] = v;
          }
          const out: TreeColumn = { ...c, settings };
          if (span !== undefined) out.span = Math.min(12, Math.max(1, Math.round(Number(span)) || 12));
          return out;
        });
      } else if (r.kind === "element" && r.element) next = mapElement(tree, action.path, (e) => ({ ...e, settings: apply(e.settings) }));
      else return state;
      return withTree(state, next, {}, action.group, action.at);
    }

    case "updateProps": {
      const tree = currentTree(state);
      const r = resolvePath(tree, action.path);
      if (!tree || r.kind !== "element") return state;
      const next = mapElement(tree, action.path, (e) => ({ ...e, props: { ...(e.props ?? {}), ...action.patch } }));
      return withTree(state, next, {}, action.group, action.at);
    }

    case "inlineEdit": {
      const tree = currentTree(state);
      const r = resolvePath(tree, action.path);
      if (!tree || r.kind !== "element" || !r.element) return state;
      if ((r.element.props ?? {})[action.field] === action.value) return state;
      // Plain text only: strip control characters other than newlines.
      const clean = Array.from(action.value).filter((ch) => ch.charCodeAt(0) === 10 || (ch.charCodeAt(0) >= 32 && ch.charCodeAt(0) !== 127)).join("");
      return withTree(state, mapElement(tree, action.path, (e) => ({ ...e, props: { ...(e.props ?? {}), [action.field]: clean } })));
    }

    case "insertElement": {
      const tree = currentTree(state);
      const r = resolvePath(tree, action.columnPath);
      if (!tree || !r.section || !r.row || !r.column) return state;
      const element = ensureUniqueIds(tree, action.element);
      const next = mapColumn(tree, r.section.id, r.row.id, r.column.id, (c) => {
        const elements = [...c.elements];
        const index = Math.max(0, Math.min(elements.length, action.index ?? elements.length));
        elements.splice(index, 0, element);
        return { ...c, elements };
      });
      return withTree(state, next, { selection: `${action.columnPath}/${element.id}` });
    }

    case "moveElement": {
      const tree = currentTree(state);
      const r = resolvePath(tree, action.path);
      if (!tree || r.kind !== "element" || !r.row || !r.column || !r.element) return state;
      const from = r.column.elements.findIndex((e) => e.id === r.element!.id);
      const to = from + action.delta;
      if (to < 0 || to >= r.column.elements.length) return state;
      const next = mapColumn(tree, r.section!.id, r.row.id, r.column.id, (c) => {
        const elements = [...c.elements];
        const [moved] = elements.splice(from, 1);
        elements.splice(to, 0, moved);
        return { ...c, elements };
      });
      return withTree(state, next);
    }

    case "setRowColumns": {
      const tree = currentTree(state);
      const r = resolvePath(tree, action.rowPath);
      if (!tree || !r.section || !r.row) return state;
      return withTree(state, setRowColumns(tree, r.section.id, r.row.id, action.spans), { selection: `${r.section.id}/${r.row.id}` });
    }

    case "setTheme":
      return commit(state, { theme: normalizeThemeSettings(action.theme) }, action.group, action.at);

    case "applyTheme": {
      const trees = { ...state.trees };
      for (const [id, tree] of Object.entries(action.trees ?? {})) {
        if (trees[id] || state.pages.some((p) => p.id === id)) trees[id] = normalizeTree(structuredClone(tree));
      }
      return commit(state, { theme: normalizeThemeSettings(action.theme), trees, selection: action.trees ? null : state.selection });
    }

    case "undo": {
      const prev = state.past[state.past.length - 1];
      if (!prev) return state;
      const trees = restoreTrees(state.trees, prev.trees);
      return {
        ...state,
        trees,
        theme: prev.theme,
        past: state.past.slice(0, -1),
        future: [snapshot(state), ...state.future].slice(0, HISTORY_LIMIT),
        selection: selectionExists(state.currentPageId ? trees[state.currentPageId] : undefined, state.selection),
        multi: [],
        lastGroup: null,
        revision: state.revision + 1,
      };
    }

    case "redo": {
      const next = state.future[0];
      if (!next) return state;
      const trees = restoreTrees(state.trees, next.trees);
      return {
        ...state,
        trees,
        theme: next.theme,
        past: [...state.past, snapshot(state)].slice(-HISTORY_LIMIT),
        future: state.future.slice(1),
        selection: selectionExists(state.currentPageId ? trees[state.currentPageId] : undefined, state.selection),
        multi: [],
        lastGroup: null,
        revision: state.revision + 1,
      };
    }

    case "markSaved": {
      // Snapshots are what was actually sent, so edits made while a save was in flight stay dirty.
      const savedTrees = { ...state.savedTrees };
      for (const [id, json] of Object.entries(action.trees ?? {})) if (state.trees[id]) savedTrees[id] = json;
      return { ...state, savedTrees, savedTheme: action.theme ?? state.savedTheme };
    }

    default:
      return state;
  }
}

/** Pages created after a snapshot (not in it) keep their current tree. */
function restoreTrees(current: Record<string, Tree>, snap: Record<string, Tree>): Record<string, Tree> {
  const out: Record<string, Tree> = {};
  for (const id of Object.keys(current)) out[id] = snap[id] ?? current[id];
  return out;
}

// ---------------------------------------------------------------------------
// Selectors
// ---------------------------------------------------------------------------

export function dirtyPageIds(state: EditorState): string[] {
  return Object.keys(state.trees).filter((id) => JSON.stringify(state.trees[id]) !== state.savedTrees[id]);
}

export function isThemeDirty(state: EditorState): boolean {
  return JSON.stringify(state.theme) !== state.savedTheme;
}

export function isDirty(state: EditorState): boolean {
  return isThemeDirty(state) || dirtyPageIds(state).length > 0;
}

export interface TreeProblem {
  pageId: string;
  pageTitle: string;
  field: string;
  message: string;
}

export function treeProblems(state: EditorState, pageIds = Object.keys(state.trees), requireContent = false): TreeProblem[] {
  const out: TreeProblem[] = [];
  for (const id of pageIds) {
    const res = validatePageTree(state.trees[id], { requireContent });
    const page = state.pages.find((p) => p.id === id);
    for (const e of res.errors) out.push({ pageId: id, pageTitle: page?.title ?? id, field: e.field, message: e.message });
  }
  return out;
}

/** Friendly outline label: merchant rename → first heading → variant. */
export function sectionLabel(section: TreeSection): string {
  const label = section.settings?.label;
  if (typeof label === "string" && label.trim()) return label.trim();
  for (const r of section.rows) {
    for (const c of r.columns) {
      for (const e of c.elements) {
        const text = e.props?.text;
        if ((e.type === "heading" || e.type === "text") && typeof text === "string" && text.trim()) {
          const t = text.trim();
          return t.length > 38 ? `${t.slice(0, 36)}…` : t;
        }
      }
    }
  }
  const variant = section.settings?.variant;
  return typeof variant === "string" && variant ? variant : "section";
}

// ---------------------------------------------------------------------------
// Theme persistence (workspace.themeSettings: ≤50 keys, ≤5000 chars JSON)
// ---------------------------------------------------------------------------

export const THEME_MAX_BYTES = 5000;
export const THEME_MAX_KEYS = 50;

/**
 * Builds the blob to PATCH: the builder owns the ThemeSettings keys, every
 * other key already in the blob (e.g. `defaultLocale`, `whatsapp`) is kept.
 * Returns an error code instead when the backend would reject it.
 */
export function buildThemeBlob(raw: Record<string, unknown> | null | undefined, theme: ThemeSettings): { blob: Record<string, unknown> } | { error: "tooLarge" | "tooManyKeys"; size: number } {
  const blob: Record<string, unknown> = { ...(raw ?? {}) };
  // Legacy top-level colour keys are superseded by `colors`.
  delete blob.primaryColor;
  delete blob.secondaryColor;
  Object.assign(blob, theme);
  const size = JSON.stringify(blob).length;
  if (Object.keys(blob).length > THEME_MAX_KEYS) return { error: "tooManyKeys", size };
  if (size > THEME_MAX_BYTES) return { error: "tooLarge", size };
  return { blob };
}
