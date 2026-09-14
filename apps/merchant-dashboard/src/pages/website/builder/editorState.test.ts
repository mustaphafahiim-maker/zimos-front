import { describe, expect, it } from "vitest";
import { SECTION_BY_ID, THEMES, collectIds, validatePageTree, type Tree } from "@store-builder/store-renderer";
import {
  GROUP_WINDOW_MS,
  buildThemeBlob,
  dirtyPageIds,
  editorReducer,
  initialEditorState,
  isDirty,
  resolvePath,
  targetColumnPath,
  type EditorAction,
  type EditorState,
} from "./editorState";

function tree(...presetIds: string[]): Tree {
  return { version: 1, sections: presetIds.map((id) => SECTION_BY_ID[id].create({ locale: "ar" })) };
}

function loaded(t: Tree = tree("hero-centered", "faq", "cta-band")): EditorState {
  return editorReducer(initialEditorState(), {
    type: "load",
    pages: [
      { id: "home", title: "Home", path: "/", pageType: "home", tree: t },
      { id: "about", title: "About", path: "/about", pageType: "static", tree: tree("rich-text") },
    ],
    theme: { colors: { primary: "#112233" } },
  });
}

const run = (state: EditorState, ...actions: EditorAction[]) => actions.reduce(editorReducer, state);
const home = (s: EditorState) => s.trees.home;
const ids = (s: EditorState) => home(s).sections.map((x) => x.id);

function expectValid(s: EditorState) {
  for (const t of Object.values(s.trees)) {
    expect(validatePageTree(t).errors).toEqual([]);
    const all = collectIds(t);
    expect(new Set(all).size).toBe(all.length);
  }
}

describe("editorReducer", () => {
  it("loads pages, opens home and starts clean", () => {
    const s = loaded();
    expect(s.currentPageId).toBe("home");
    expect(s.theme.colors.primary).toBe("#112233");
    expect(isDirty(s)).toBe(false);
  });

  it("inserts a section at an index, selects it and keeps ids unique", () => {
    const s0 = loaded();
    const section = SECTION_BY_ID["benefits"].create();
    const s1 = run(s0, { type: "insertSection", section, index: 1 });
    expect(ids(s1)[1]).toBe(section.id);
    expect(s1.selection).toBe(section.id);
    // Same node again (e.g. dropped twice) gets fresh ids instead of colliding.
    const s2 = run(s1, { type: "insertSection", section });
    expect(home(s2).sections).toHaveLength(5);
    expect(ids(s2)[4]).not.toBe(section.id);
    expectValid(s2);
    expect(dirtyPageIds(s2)).toEqual(["home"]);
  });

  it("moves, duplicates, hides and deletes sections", () => {
    const s0 = loaded();
    const [a, b, c] = ids(s0);
    const moved = run(s0, { type: "moveSection", from: 0, to: 2 });
    expect(ids(moved)).toEqual([b, c, a]);

    const dup = run(moved, { type: "duplicateSection", sectionId: b });
    expect(home(dup).sections).toHaveLength(4);
    expect(ids(dup)[0]).toBe(b);
    expect(ids(dup)[1]).not.toBe(b);
    expect(JSON.stringify(home(dup).sections[1].rows[0].columns[0].elements.map((e) => e.props))).toBe(
      JSON.stringify(home(dup).sections[0].rows[0].columns[0].elements.map((e) => e.props))
    );
    expectValid(dup);

    const hidden = run(dup, { type: "toggleHidden", sectionId: c });
    expect(home(hidden).sections.find((x) => x.id === c)?.settings?.hidden).toBe(true);
    const shown = run(hidden, { type: "toggleHidden", sectionId: c });
    expect(home(shown).sections.find((x) => x.id === c)?.settings?.hidden).toBeUndefined();

    const deleted = run(shown, { type: "select", path: a }, { type: "deleteNode", path: a });
    expect(ids(deleted)).not.toContain(a);
    expect(deleted.selection).toBeNull();
    expectValid(deleted);
  });

  it("edits element props inline and through the inspector", () => {
    const s0 = loaded();
    const t = home(s0);
    const sec = t.sections[0];
    const r = sec.rows[0];
    const c = r.columns[0];
    const heading = c.elements.find((e) => e.type === "heading")!;
    const path = `${sec.id}/${r.id}/${c.id}/${heading.id}`;
    expect(resolvePath(t, path).kind).toBe("element");

    const s1 = run(s0, { type: "inlineEdit", path, field: "text", value: "عنوان جديد" });
    expect(resolvePath(home(s1), path).element?.props?.text).toBe("عنوان جديد");
    const s2 = run(s1, { type: "updateProps", path, patch: { level: 1 } });
    expect(resolvePath(home(s2), path).element?.props).toMatchObject({ text: "عنوان جديد", level: 1 });
    expect(targetColumnPath(home(s2), path)).toBe(`${sec.id}/${r.id}/${c.id}`);

    const s3 = run(s2, { type: "insertElement", columnPath: `${sec.id}/${r.id}/${c.id}`, element: { id: heading.id, type: "divider", props: {} } });
    expect(resolvePath(home(s3), `${sec.id}/${r.id}/${c.id}`).column?.elements).toHaveLength(c.elements.length + 1);
    expectValid(s3);
  });

  it("changes row column layouts without losing content", () => {
    const s0 = loaded(tree("image-text"));
    const sec = home(s0).sections[0];
    const row = sec.rows.find((r) => r.columns.length === 2)!;
    const before = row.columns.flatMap((c) => c.elements.map((e) => e.id)).sort();
    const one = run(s0, { type: "setRowColumns", rowPath: `${sec.id}/${row.id}`, spans: [12] });
    const r1 = resolvePath(home(one), `${sec.id}/${row.id}`).row!;
    expect(r1.columns).toHaveLength(1);
    expect(r1.columns[0].elements.map((e) => e.id).sort()).toEqual(before);
    const three = run(one, { type: "setRowColumns", rowPath: `${sec.id}/${row.id}`, spans: [4, 4, 4] });
    expect(resolvePath(home(three), `${sec.id}/${row.id}`).row!.columns.map((c) => c.span)).toEqual([4, 4, 4]);
    expectValid(three);
  });

  it("undoes and redoes, grouping rapid typing into one step", () => {
    const s0 = loaded();
    const sec = home(s0).sections[0].id;
    const s1 = run(
      s0,
      { type: "updateSettings", path: sec, patch: { anchor: "a" }, group: "anchor", at: 1000 },
      { type: "updateSettings", path: sec, patch: { anchor: "ab" }, group: "anchor", at: 1000 + GROUP_WINDOW_MS / 2 },
      { type: "updateSettings", path: sec, patch: { anchor: "abc" }, group: "anchor", at: 1000 + GROUP_WINDOW_MS }
    );
    expect(s1.past).toHaveLength(1);
    const s2 = run(s1, { type: "moveSection", from: 0, to: 1 });
    expect(s2.past).toHaveLength(2);

    const u1 = run(s2, { type: "undo" });
    expect(ids(u1)).toEqual(ids(s1));
    const u2 = run(u1, { type: "undo" });
    expect(home(u2).sections[0].settings?.anchor).toBeUndefined();
    // Nothing left to undo: state is returned unchanged.
    expect(run(u2, { type: "undo" })).toBe(u2);
    const r1 = run(u2, { type: "redo" }, { type: "redo" });
    expect(ids(r1)).toEqual(ids(s2));
    expect(home(r1).sections.find((x) => x.id === sec)?.settings?.anchor).toBe("abc");
    // A new change clears the redo stack.
    const branched = run(u2, { type: "toggleHidden", sectionId: sec });
    expect(branched.future).toHaveLength(0);
  });

  it("keeps at least 100 undo steps", () => {
    let s = loaded();
    const sec = home(s).sections[0].id;
    for (let i = 0; i < 120; i += 1) s = editorReducer(s, { type: "toggleHidden", sectionId: sec });
    expect(s.past.length).toBeGreaterThanOrEqual(100);
  });

  it("applies a theme's style only, or style and pages, as one undo step", () => {
    const s0 = loaded();
    const souq = THEMES.souq.build("ar");
    const styleOnly = run(s0, { type: "applyTheme", theme: souq.settings });
    expect(styleOnly.theme.preset).toBe("souq");
    expect(home(styleOnly)).toBe(home(s0));

    const withPages = run(s0, { type: "applyTheme", theme: souq.settings, trees: { home: souq.pages.home, about: souq.pages.about, ghost: souq.pages.contact } });
    expect(home(withPages).sections.length).toBe(souq.pages.home.sections.length);
    expect(withPages.trees.ghost).toBeUndefined();
    expectValid(withPages);
    expect(withPages.past).toHaveLength(1);

    const undone = run(withPages, { type: "undo" });
    expect(home(undone)).toEqual(home(s0));
    expect(undone.theme).toEqual(s0.theme);
  });

  it("marks pages and theme saved", () => {
    const s = run(loaded(), { type: "moveSection", from: 0, to: 1 }, { type: "setTheme", theme: { ...loaded().theme, preset: "custom" } });
    expect(isDirty(s)).toBe(true);
    const sent = { trees: { home: JSON.stringify(s.trees.home) }, theme: JSON.stringify(s.theme) };
    // An edit that lands while the save is in flight must stay dirty.
    const during = run(s, { type: "moveSection", from: 1, to: 2 });
    const afterSave = run(during, { type: "markSaved", ...sent });
    expect(dirtyPageIds(afterSave)).toEqual(["home"]);
    const saved = run(s, { type: "markSaved", ...sent });
    expect(isDirty(saved)).toBe(false);
  });
});

describe("buildThemeBlob", () => {
  it("keeps unrelated keys, drops legacy colours and guards the size limit", () => {
    const theme = loaded().theme;
    const ok = buildThemeBlob({ defaultLocale: "ar", primaryColor: "#000" }, theme);
    expect("blob" in ok && ok.blob.defaultLocale).toBe("ar");
    expect("blob" in ok && "primaryColor" in ok.blob).toBe(false);
    const big = buildThemeBlob({ notes: "x".repeat(6000) }, theme);
    expect("error" in big && big.error).toBe("tooLarge");
    const many = buildThemeBlob(Object.fromEntries(Array.from({ length: 50 }, (_, i) => [`k${i}`, 1])), theme);
    expect("error" in many && many.error).toBe("tooManyKeys");
  });
});
