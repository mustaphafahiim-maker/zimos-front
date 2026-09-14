import { useCallback, useEffect, useMemo, useReducer, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { DndContext, PointerSensor, useSensor, useSensors, type DragEndEvent, type DragStartEvent } from "@dnd-kit/core";
import { cn, Spinner, Button } from "@store-builder/ui";
import {
  SECTION_BY_ID,
  THEMES,
  THEME_PAGE_PATHS,
  THEME_PAGE_TITLES,
  THEME_PAGE_TYPES,
  type ElementType,
  type NodePath,
  type RendererLocale,
  type ThemeId,
  type ThemePageKey,
  type ThemeSettings,
  type Tree,
} from "@store-builder/store-renderer";
import type { CreateWebsitePagePayload, PageTree, PublishProblem, Website } from "@store-builder/api-client";
import { apiClient } from "@/lib/apiClient";
import { useWorkspaceId } from "@/lib/useWorkspaceId";
import { useWorkspace } from "@/context/WorkspaceContext";
import { ApiError, getErrorMessage } from "@/lib/errors";
import { useToast } from "@/components/Toast";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { fmt, useLocale } from "@/i18n/LocaleContext";
import { NewPageDialog } from "../editor/NewPageDialog";
import {
  buildThemeBlob,
  dirtyPageIds,
  editorReducer,
  initialEditorState,
  isDirty,
  isThemeDirty,
  resolvePath,
  targetColumnPath,
  treeProblems,
  type EditorPage,
} from "./editorState";
import { Canvas, type CanvasHandle, type Device } from "./Canvas";
import { TopBar, type SaveStatus } from "./TopBar";
import { SectionsPanel } from "./SectionsPanel";
import { AddPanel, type DragData } from "./AddPanel";
import { ThemePanel } from "./ThemePanel";
import { Inspector } from "./Inspector";
import { EMPTY_CATALOG, type CatalogData } from "./StoreChrome";
import { createElement } from "./elementLibrary";
import { ApplyThemeDialog, GUIDE_STEPS, GuideChecklist, HistoryDialog, LeaveDialog, ProblemList, PublishDialog, SmallScreenNotice, UndoToast, type GuideState, type GuideStep } from "./dialogs";
import { useBuilderT, type BuilderStrings } from "./strings";

const STOREFRONT_URL = ((import.meta.env.VITE_STOREFRONT_URL as string | undefined) ?? "http://localhost:3000").replace(/\/+$/, "");
const AUTOSAVE_MS = 2500;
type Tab = "sections" | "add" | "theme";

const guideKey = (websiteId: string) => `zimos.builder.guide.${websiteId}`;
function readGuide(websiteId: string): GuideState {
  const empty: GuideState = { dismissed: false, done: { theme: false, colors: false, content: false, publish: false } };
  try {
    const raw = localStorage.getItem(guideKey(websiteId));
    if (!raw) return empty;
    const parsed = JSON.parse(raw) as Partial<GuideState>;
    return { dismissed: !!parsed.dismissed, done: { ...empty.done, ...(parsed.done ?? {}) } };
  } catch {
    return empty;
  }
}

/** One friendly message per backend failure class. */
function errorText(err: unknown, t: BuilderStrings): { message: string; details: string[] } {
  if (err instanceof ApiError) {
    if (err.status === 402) return { message: t.err402, details: [] };
    if (err.status === 403) return { message: t.err403, details: [] };
    if (err.status === 409) return { message: t.err409, details: [] };
    if (err.status === 422) {
      const body = err.details as { error?: { details?: unknown } } | undefined;
      const list = Array.isArray(body?.error?.details) ? (body!.error!.details as Array<{ field?: string; message?: string }>) : [];
      return { message: t.err422, details: list.map((d) => [d.field, d.message].filter(Boolean).join(": ")).filter(Boolean) };
    }
  }
  return { message: getErrorMessage(err), details: [] };
}

function isTypingTarget(target: EventTarget | null): boolean {
  const el = target as HTMLElement | null;
  if (!el || !el.tagName) return false;
  return el.isContentEditable || ["INPUT", "TEXTAREA", "SELECT"].includes(el.tagName);
}

/**
 * Full-screen visual store builder: pages, theme and every section of the
 * store in one editor store with undo/redo, saved as page drafts plus the
 * workspace themeSettings blob.
 */
export function BuilderPage() {
  const { websiteId = "" } = useParams();
  const workspaceId = useWorkspaceId();
  const { currentWorkspace, refresh: refreshWorkspaces } = useWorkspace();
  const navigate = useNavigate();
  const toast = useToast();
  const t = useBuilderT();
  const { locale: uiLocaleRaw } = useLocale();
  const uiLocale: RendererLocale = uiLocaleRaw === "ar" ? "ar" : "en";

  const [state, dispatch] = useReducer(editorReducer, undefined, initialEditorState);
  const stateRef = useRef(state);
  stateRef.current = state;

  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [website, setWebsite] = useState<Website | null>(null);
  const [liveRevisionId, setLiveRevisionId] = useState<string | null>(null);
  const [catalog, setCatalog] = useState<CatalogData>(EMPTY_CATALOG);
  /** The themeSettings blob as the server last stored it (other keys are preserved on save). */
  const rawThemeRef = useRef<Record<string, unknown>>({});

  const [tab, setTab] = useState<Tab>("sections");
  const [device, setDevice] = useState<Device>("desktop");
  const [fit, setFit] = useState(true);
  const [previewLocale, setPreviewLocale] = useState<RendererLocale>("ar");
  const [insertAt, setInsertAt] = useState<number | null>(null);

  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<{ message: string; details: string[] } | null>(null);
  const [publishOpen, setPublishOpen] = useState(false);
  const [publishing, setPublishing] = useState(false);
  const [publishError, setPublishError] = useState<string | null>(null);
  const [publishProblems, setPublishProblems] = useState<string[]>([]);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [leaveOpen, setLeaveOpen] = useState(false);
  const [newPageOpen, setNewPageOpen] = useState(false);
  const [pageToDelete, setPageToDelete] = useState<EditorPage | null>(null);
  const [themeToApply, setThemeToApply] = useState<ThemeId | null>(null);
  const [applyingTheme, setApplyingTheme] = useState(false);
  const [undoToast, setUndoToast] = useState<string | null>(null);
  const [guide, setGuide] = useState<GuideState>(() => readGuide(websiteId));
  const [smallScreen, setSmallScreen] = useState(() => typeof window !== "undefined" && window.innerWidth < 900);

  const [dragKind, setDragKind] = useState<"section" | "element" | null>(null);
  const [dragPoint, setDragPoint] = useState<{ x: number; y: number } | null>(null);
  const canvasRef = useRef<CanvasHandle>(null);

  // ---- load ---------------------------------------------------------------
  const load = useCallback(async () => {
    setLoading(true);
    setLoadError(null);
    try {
      const detail = await apiClient.getWebsite(workspaceId, websiteId);
      const raw = (currentWorkspace?.themeSettings ?? {}) as Record<string, unknown>;
      rawThemeRef.current = raw;
      setWebsite(detail.website);
      setLiveRevisionId(detail.website.publishedRevisionId);
      const storeLocale = raw.defaultLocale === "en" ? "en" : currentWorkspace?.defaultLocale === "en" ? "en" : "ar";
      setPreviewLocale(storeLocale);
      dispatch({
        type: "load",
        pages: detail.pages.map((p) => ({ id: p.id, title: p.title, path: p.path, pageType: p.pageType, tree: p.draftData })),
        theme: raw,
      });
    } catch (err) {
      setLoadError(errorText(err, t).message || t.loadFailed);
    } finally {
      setLoading(false);
    }
    // Catalog is only decoration for the preview: failures leave it empty.
    Promise.all([
      apiClient.listProducts(workspaceId, { limit: 24 }).catch(() => null),
      apiClient.listCollections(workspaceId).catch(() => null),
    ]).then(([products, collections]) => {
      setCatalog({
        products: products?.products ?? [],
        collections: collections ?? [],
        currency: currentWorkspace?.defaultCurrency ?? "EGP",
      });
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [workspaceId, websiteId]);

  useEffect(() => {
    void load();
  }, [load]);

  // ---- guide ----------------------------------------------------------------
  const markGuide = useCallback(
    (step: GuideStep) => {
      setGuide((g) => {
        if (g.done[step]) return g;
        const next = { ...g, done: { ...g.done, [step]: true } };
        try {
          localStorage.setItem(guideKey(websiteId), JSON.stringify(next));
        } catch {
          /* storage unavailable */
        }
        return next;
      });
    },
    [websiteId]
  );
  const dismissGuide = () => {
    setGuide((g) => {
      const next = { ...g, dismissed: true };
      try {
        localStorage.setItem(guideKey(websiteId), JSON.stringify(next));
      } catch {
        /* storage unavailable */
      }
      return next;
    });
  };

  // ---- save -----------------------------------------------------------------
  const themeBlob = useMemo(() => buildThemeBlob(rawThemeRef.current, state.theme), [state.theme]);
  const themeSizeError = "error" in themeBlob ? (themeBlob.error === "tooLarge" ? fmt(t.themeTooLarge, { size: themeBlob.size }) : t.themeTooManyKeys) : null;

  const savingRef = useRef(false);
  const save = useCallback(
    async (opts: { silent?: boolean } = {}): Promise<boolean> => {
      if (savingRef.current) return false;
      const s = stateRef.current;
      const pageIds = dirtyPageIds(s);
      const themeDirty = isThemeDirty(s);
      if (pageIds.length === 0 && !themeDirty) return true;

      const problems = treeProblems(s, pageIds);
      if (problems.length > 0) {
        setSaveError({ message: t.saveBlocked, details: problems.map((p) => `${p.pageTitle} — ${p.field}: ${p.message}`) });
        return false;
      }
      let blob: Record<string, unknown> | null = null;
      if (themeDirty) {
        const built = buildThemeBlob(rawThemeRef.current, s.theme);
        if ("error" in built) {
          setSaveError({ message: built.error === "tooLarge" ? fmt(t.themeTooLarge, { size: built.size }) : t.themeTooManyKeys, details: [] });
          return false;
        }
        blob = built.blob;
      }

      savingRef.current = true;
      setSaving(true);
      setSaveError(null);
      const sentTrees: Record<string, string> = {};
      try {
        for (const id of pageIds) {
          const tree = s.trees[id];
          await apiClient.updateWebsitePage(workspaceId, websiteId, id, { draftData: tree as unknown as PageTree });
          sentTrees[id] = JSON.stringify(tree);
        }
        let sentTheme: string | undefined;
        if (blob) {
          await apiClient.updateWorkspace(workspaceId, { themeSettings: blob });
          rawThemeRef.current = blob;
          sentTheme = JSON.stringify(s.theme);
          void refreshWorkspaces().catch(() => undefined);
        }
        dispatch({ type: "markSaved", trees: sentTrees, theme: sentTheme });
        return true;
      } catch (err) {
        // Pages already stored stay marked saved.
        if (Object.keys(sentTrees).length) dispatch({ type: "markSaved", trees: sentTrees });
        const e = errorText(err, t);
        setSaveError(e);
        if (!opts.silent) toast.error(e.message);
        return false;
      } finally {
        savingRef.current = false;
        setSaving(false);
      }
    },
    [workspaceId, websiteId, t, toast, refreshWorkspaces]
  );

  const dirty = isDirty(state);

  // Autosave a short while after the last change.
  useEffect(() => {
    if (!dirty || loading) return;
    const id = window.setTimeout(() => void save({ silent: true }), AUTOSAVE_MS);
    return () => window.clearTimeout(id);
  }, [state.revision, dirty, loading, save]);

  useEffect(() => {
    if (!dirty) return;
    const onBeforeUnload = (e: BeforeUnloadEvent) => e.preventDefault();
    window.addEventListener("beforeunload", onBeforeUnload);
    return () => window.removeEventListener("beforeunload", onBeforeUnload);
  }, [dirty]);

  const status: SaveStatus = saving ? "saving" : saveError ? "error" : dirty ? "dirty" : "saved";

  // ---- publish --------------------------------------------------------------
  async function publish() {
    setPublishing(true);
    setPublishError(null);
    setPublishProblems([]);
    try {
      const ok = await save();
      if (!ok) {
        setPublishError(t.statusError);
        return;
      }
      const res = await apiClient.publishWebsite(workspaceId, websiteId);
      setWebsite(res.website);
      setLiveRevisionId(res.revision.id);
      setPublishOpen(false);
      markGuide("publish");
      toast.success(fmt(t.published, { n: res.revision.revisionNumber }));
    } catch (err) {
      if (err instanceof ApiError && err.status === 422) {
        const body = err.details as { error?: { details?: unknown } } | undefined;
        const list = Array.isArray(body?.error?.details) ? (body!.error!.details as PublishProblem[]) : [];
        const pageTitle = (id?: string) => stateRef.current.pages.find((p) => p.id === id)?.title;
        setPublishProblems(list.map((p) => [pageTitle(p.pageId) ?? p.path, p.message].filter(Boolean).join(" — ")));
        if (list.length === 0) setPublishError(errorText(err, t).message);
      } else {
        setPublishError(errorText(err, t).message);
      }
    } finally {
      setPublishing(false);
    }
  }

  // ---- editing helpers ------------------------------------------------------
  const tree: Tree | undefined = state.currentPageId ? state.trees[state.currentPageId] : undefined;

  const deleteNode = useCallback(
    (path: NodePath) => {
      const s = stateRef.current;
      const kind = resolvePath(s.currentPageId ? s.trees[s.currentPageId] : undefined, path).kind;
      dispatch({ type: "deleteNode", path });
      if (kind === "section" || kind === "element") setUndoToast(t.deletedToast);
    },
    [t.deletedToast]
  );

  function addSection(presetId: string, index?: number) {
    const preset = SECTION_BY_ID[presetId];
    if (!preset) return;
    const at = index ?? insertAt ?? undefined;
    dispatch({ type: "insertSection", section: preset.create({ locale: previewLocale }), index: at });
    setInsertAt(null);
    markGuide("content");
  }

  function addElement(type: ElementType, columnPath?: string) {
    const target = columnPath ?? targetColumnPath(tree, state.selection);
    if (!target) return;
    dispatch({ type: "insertElement", columnPath: target, element: createElement(type, previewLocale) });
    markGuide("content");
  }

  // ---- theme ----------------------------------------------------------------
  function changeTheme(next: ThemeSettings, group: string) {
    dispatch({ type: "setTheme", theme: { ...next, preset: "custom" } as ThemeSettings, group, at: Date.now() });
    if (group.startsWith("color") || group.startsWith("font")) markGuide("colors");
  }

  async function applyTheme(mode: "style" | "pages") {
    if (!themeToApply) return;
    const preset = THEMES[themeToApply];
    const built = preset.build(previewLocale);
    if (mode === "style") {
      dispatch({ type: "applyTheme", theme: built.settings });
      setThemeToApply(null);
      markGuide("theme");
      toast.success(t.themeApplied);
      return;
    }
    setApplyingTheme(true);
    try {
      const trees: Record<string, Tree> = {};
      const keys = Object.keys(built.pages) as ThemePageKey[];
      for (const key of keys) {
        const path = THEME_PAGE_PATHS[key];
        let page = stateRef.current.pages.find((p) => p.path === path);
        if (!page) {
          // Missing theme pages are created empty; their content arrives with the undoable applyTheme below.
          const created = await apiClient.createPage(workspaceId, websiteId, {
            path,
            title: THEME_PAGE_TITLES[key][previewLocale],
            pageType: THEME_PAGE_TYPES[key],
            draftData: { version: 1, sections: [] } as unknown as PageTree,
          });
          page = { id: created.id, title: created.title, path: created.path, pageType: created.pageType };
          dispatch({ type: "addPage", page, tree: { version: 1, sections: [] } });
        }
        trees[page.id] = built.pages[key];
      }
      dispatch({ type: "applyTheme", theme: built.settings, trees });
      setThemeToApply(null);
      markGuide("theme");
      toast.success(t.themeApplied);
    } catch (err) {
      toast.error(errorText(err, t).message);
    } finally {
      setApplyingTheme(false);
    }
  }

  // ---- pages ----------------------------------------------------------------
  async function createPage(payload: CreateWebsitePagePayload) {
    try {
      const created = await apiClient.createPage(workspaceId, websiteId, payload);
      dispatch({ type: "addPage", page: { id: created.id, title: created.title, path: created.path, pageType: created.pageType }, tree: created.draftData as unknown as Tree });
      dispatch({ type: "setPage", pageId: created.id });
      setNewPageOpen(false);
      toast.success(t.pageCreated);
    } catch (err) {
      throw new Error(errorText(err, t).message);
    }
  }

  async function deletePage() {
    const page = pageToDelete;
    if (!page) return;
    try {
      await apiClient.deletePage(workspaceId, websiteId, page.id);
    } catch (err) {
      throw new Error(errorText(err, t).message);
    }
    dispatch({ type: "removePage", pageId: page.id });
    setPageToDelete(null);
    toast.success(t.pageDeleted);
  }

  // ---- keyboard -------------------------------------------------------------
  const onKeyDown = useCallback(
    (e: KeyboardEvent) => {
      const mod = e.ctrlKey || e.metaKey;
      const key = e.key.toLowerCase();
      if (mod && key === "s") {
        e.preventDefault();
        void save();
        return;
      }
      if (isTypingTarget(e.target)) return;
      if (mod && key === "z") {
        e.preventDefault();
        dispatch({ type: e.shiftKey ? "redo" : "undo" });
        return;
      }
      if (mod && key === "y") {
        e.preventDefault();
        dispatch({ type: "redo" });
        return;
      }
      const s = stateRef.current;
      const current = s.currentPageId ? s.trees[s.currentPageId] : undefined;
      if (e.key === "Escape") {
        dispatch({ type: "select", path: null });
        return;
      }
      if ((e.key === "Delete" || e.key === "Backspace") && s.selection) {
        e.preventDefault();
        deleteNode(s.selection);
        return;
      }
      if ((e.key === "ArrowDown" || e.key === "ArrowUp") && current && current.sections.length > 0) {
        e.preventDefault();
        const idx = resolvePath(current, s.selection).sectionIndex;
        const nextIdx = idx < 0 ? 0 : Math.max(0, Math.min(current.sections.length - 1, idx + (e.key === "ArrowDown" ? 1 : -1)));
        dispatch({ type: "select", path: current.sections[nextIdx].id });
      }
    },
    [save, deleteNode]
  );

  useEffect(() => {
    const handler = (e: KeyboardEvent) => onKeyDown(e);
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [onKeyDown]);

  // ---- drag from the Add panel onto the canvas ------------------------------
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }));
  useEffect(() => {
    if (!dragKind) return;
    const move = (e: PointerEvent) => setDragPoint({ x: e.clientX, y: e.clientY });
    window.addEventListener("pointermove", move);
    return () => window.removeEventListener("pointermove", move);
  }, [dragKind]);

  function onDragStart(e: DragStartEvent) {
    const data = e.active.data.current as DragData | undefined;
    if (!data) return;
    setDragKind(data.kind);
    const ev = e.activatorEvent as PointerEvent | undefined;
    if (ev && "clientX" in ev) setDragPoint({ x: ev.clientX, y: ev.clientY });
  }

  function onDragEnd(e: DragEndEvent) {
    const data = e.active.data.current as DragData | undefined;
    const point = dragPoint;
    setDragKind(null);
    setDragPoint(null);
    if (!data || !point) return;
    const { x, y } = point;
    const drop = canvasRef.current?.resolveDrop(x, y, data.kind);
    if (!drop) return;
    if (data.kind === "section" && drop.kind === "section") addSection(data.presetId, drop.index);
    else if (data.kind === "element" && drop.kind === "element") addElement(data.elementType, drop.columnPath);
  }

  // ---- render -----------------------------------------------------------------
  const storeName = currentWorkspace?.name ?? website?.name ?? "";
  const currentPage = state.pages.find((p) => p.id === state.currentPageId);
  const liveUrl = `${STOREFRONT_URL}/store/${workspaceId}${currentPage && currentPage.pageType !== "home" && !currentPage.path.startsWith("/_") ? currentPage.path : ""}`;

  function back() {
    if (dirty) setLeaveOpen(true);
    else navigate("/website");
  }

  function guideAction(step: GuideStep) {
    if (step === "theme" || step === "colors") setTab("theme");
    else if (step === "content") setTab("sections");
    else setPublishOpen(true);
  }

  if (loading) {
    return (
      <div className="flex h-screen flex-col items-center justify-center gap-3 bg-paper text-ink-soft">
        <Spinner className="size-6" />
        <p className="text-sm">{t.loading}</p>
      </div>
    );
  }
  if (loadError) {
    return (
      <div className="flex h-screen flex-col items-center justify-center gap-3 bg-paper p-6 text-center">
        <p className="text-sm text-danger">{loadError}</p>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => navigate("/website")}>
            {t.back}
          </Button>
          <Button onClick={() => void load()}>{t.retry}</Button>
        </div>
      </div>
    );
  }

  const tabs: Array<{ id: Tab; label: string }> = [
    { id: "sections", label: t.tabSections },
    { id: "add", label: t.tabAdd },
    { id: "theme", label: t.tabTheme },
  ];
  const guideVisible = !guide.dismissed && GUIDE_STEPS.some((s) => !guide.done[s]);

  return (
    <div className="flex h-screen flex-col overflow-hidden bg-paper text-ink">
      <TopBar
        storeName={storeName}
        pages={state.pages}
        currentPageId={state.currentPageId}
        uiLocale={uiLocale}
        onSelectPage={(id) => dispatch({ type: "setPage", pageId: id })}
        onAddPage={() => setNewPageOpen(true)}
        onDeletePage={(p) => setPageToDelete(p)}
        device={device}
        onDevice={setDevice}
        fit={fit}
        onToggleFit={() => setFit((f) => !f)}
        previewLocale={previewLocale}
        onPreviewLocale={setPreviewLocale}
        canUndo={state.past.length > 0}
        canRedo={state.future.length > 0}
        onUndo={() => dispatch({ type: "undo" })}
        onRedo={() => dispatch({ type: "redo" })}
        status={status}
        onSave={() => void save()}
        liveUrl={liveUrl}
        onPublish={() => {
          setPublishError(null);
          setPublishProblems([]);
          setPublishOpen(true);
        }}
        onHistory={() => setHistoryOpen(true)}
        onBack={back}
        onGuide={() => setGuide((g) => ({ ...g, dismissed: false }))}
      />

      {saveError && (
        <div role="alert" className="border-b border-line bg-danger-soft px-4 py-2 text-sm text-danger">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="font-medium">{saveError.message}</p>
              {saveError.details.length > 0 && <ProblemList title="" items={saveError.details.slice(0, 6)} />}
            </div>
            <button type="button" className="cursor-pointer text-xs font-semibold underline" onClick={() => setSaveError(null)}>
              {t.close}
            </button>
          </div>
        </div>
      )}

      <DndContext sensors={sensors} onDragStart={onDragStart} onDragEnd={onDragEnd} onDragCancel={() => { setDragKind(null); setDragPoint(null); }}>
        <div className="flex min-h-0 flex-1">
          <aside className="flex w-72 shrink-0 flex-col border-e border-line bg-paper-raised">
            <div role="tablist" className="flex border-b border-line">
              {tabs.map((x) => (
                <button
                  key={x.id}
                  role="tab"
                  type="button"
                  aria-selected={tab === x.id}
                  onClick={() => setTab(x.id)}
                  className={cn(
                    "flex-1 cursor-pointer border-b-2 px-2 py-2.5 text-sm font-semibold",
                    tab === x.id ? "border-primary text-primary" : "border-transparent text-ink-soft hover:text-ink"
                  )}
                >
                  {x.label}
                </button>
              ))}
            </div>
            <div className="min-h-0 flex-1 overflow-y-auto">
              {tab === "sections" && tree && <SectionsPanel tree={tree} selection={state.selection} dispatch={dispatch} uiLocale={uiLocale} onDelete={deleteNode} />}
              {tab === "add" && <AddPanel uiLocale={uiLocale} canAddElement={!!targetColumnPath(tree, state.selection)} onAddSection={(id) => addSection(id)} onAddElement={(type) => addElement(type)} />}
              {tab === "theme" && <ThemePanel theme={state.theme} uiLocale={uiLocale} onChange={changeTheme} onPickTheme={setThemeToApply} sizeError={themeSizeError} />}
            </div>
          </aside>

          {tree ? (
            <Canvas
              tree={tree}
              theme={state.theme}
              locale={previewLocale}
              device={device}
              fit={fit}
              selection={state.selection}
              catalog={catalog}
              storeName={storeName}
              logoUrl={currentWorkspace?.logoUrl}
              pages={state.pages}
              dispatch={dispatch}
              dragKind={dragKind}
              dragPoint={dragPoint}
              handle={canvasRef}
              onKeyDown={onKeyDown}
              onChooseTheme={() => setTab("theme")}
              onAddFirst={() => {
                setInsertAt(0);
                setTab("add");
              }}
              onAddBelow={(sectionId) => {
                setInsertAt(tree.sections.findIndex((s) => s.id === sectionId) + 1);
                setTab("add");
              }}
              onDelete={deleteNode}
              onInlineEdited={() => markGuide("content")}
            />
          ) : (
            <div className="flex flex-1 items-center justify-center text-sm text-ink-soft">{t.noSections}</div>
          )}

          <aside aria-label={t.inspectorTitle} className="flex w-80 shrink-0 flex-col border-s border-line bg-paper-raised">
            <h2 className="border-b border-line px-3 py-2.5 text-sm font-semibold text-ink">{t.inspectorTitle}</h2>
            <div className="min-h-0 flex-1 overflow-y-auto">
              <Inspector
                tree={tree}
                selection={state.selection}
                dispatch={dispatch}
                pages={state.pages}
                catalog={catalog}
                uiLocale={uiLocale}
                onDelete={deleteNode}
                onContentEdited={() => markGuide("content")}
              />
            </div>
          </aside>
        </div>
      </DndContext>

      <PublishDialog open={publishOpen} busy={publishing} error={publishError} problems={publishProblems} onClose={() => setPublishOpen(false)} onConfirm={() => void publish()} />
      <ApplyThemeDialog themeId={themeToApply} uiLocale={uiLocale} busy={applyingTheme} onClose={() => setThemeToApply(null)} onApply={(mode) => void applyTheme(mode)} />
      <HistoryDialog
        open={historyOpen}
        workspaceId={workspaceId}
        websiteId={websiteId}
        liveRevisionId={liveRevisionId}
        onClose={() => setHistoryOpen(false)}
        onRolledBack={(w, n) => {
          setWebsite(w);
          setLiveRevisionId(w.publishedRevisionId);
          toast.success(fmt(t.rolledBack, { n }));
        }}
      />
      <LeaveDialog
        open={leaveOpen}
        busy={saving}
        onClose={() => setLeaveOpen(false)}
        onLeave={() => navigate("/website")}
        onSaveAndLeave={async () => {
          if (await save()) navigate("/website");
          else setLeaveOpen(false);
        }}
      />
      <NewPageDialog open={newPageOpen} onClose={() => setNewPageOpen(false)} onCreate={createPage} />
      <ConfirmDialog open={pageToDelete !== null} title={t.deletePageTitle} confirmLabel={t.deletePage} destructive onCancel={() => setPageToDelete(null)} onConfirm={deletePage}>
        <p className="text-sm text-ink-soft">{fmt(t.deletePageBody, { title: pageToDelete?.title ?? "" })}</p>
      </ConfirmDialog>

      {guideVisible && <GuideChecklist state={guide} onAction={guideAction} onDismiss={dismissGuide} />}
      {undoToast && (
        <UndoToast
          message={undoToast}
          onUndo={() => {
            dispatch({ type: "undo" });
            setUndoToast(null);
          }}
          onDismiss={() => setUndoToast(null)}
        />
      )}
      {smallScreen && <SmallScreenNotice onContinue={() => setSmallScreen(false)} />}
    </div>
  );
}
