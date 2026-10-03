import { useEffect, useRef, useState, type RefObject } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { ArrowLeft, Layers, Palette, Redo2, Rocket, Save, SlidersHorizontal, Undo2, X } from "lucide-react";
import { Alert, Button, Spinner, cn } from "@store-builder/ui";
import type {
  CreateWebsitePagePayload,
  PageSection,
  PageTree,
  PublishProblem,
  WebsitePage,
} from "@store-builder/api-client";
import { apiClient } from "@/lib/apiClient";
import { stepEdit, type CanvasEdit, type CanvasStep } from "@/lib/canvasDrag";
import { useWorkspaceId } from "@/lib/useWorkspaceId";
import { useAsync } from "@/lib/useAsync";
import { useSaveThemeSettings } from "@/lib/themeSettingsSave";
import { ApiError, getErrorMessage, getFieldErrors } from "@/lib/errors";
import { useWorkspace } from "@/context/WorkspaceContext";
import { useLocale } from "@/i18n/LocaleContext";
import { DataState } from "@/components/DataState";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { StatusBadge } from "@/components/StatusBadge";
import { useToast } from "@/components/Toast";
import { StorefrontPreview } from "@/components/StorefrontPreview";
import { CollapsiblePane } from "@/components/CollapsiblePane";
import { useSessionBool } from "@/lib/useSessionState";
import { BlockLibrary } from "./BlockLibrary";
import { LayerList } from "./LayerList";
import { SectionInspector } from "./SectionInspector";
import { namedStylesOf } from "./ElementStylePanel";
import { StoreLookPanel } from "./StoreLookPanel";
import { NewPageDialog } from "./NewPageDialog";
import { PageTabs } from "./PageTabs";
import { ResizableSplit } from "./ResizableSplit";
import { applyCanvasEdit, nudgeElement } from "./canvasEdits";
import { ShellPanel } from "./ShellPanels";
import {
  createSection,
  createStarterSections,
  insertSection,
  moveSection,
  normalizeTree,
  sectionLabel,
  type BlockPreset,
} from "./blocks";
import { EditorLocaleContext, editorUi, useEditorLocale } from "./editorLocale";
import { useEditHistory } from "./editHistory";
import {
  lookToPreview,
  lookToShellPreview,
  lookToWorkspacePatch,
  readStoreLook,
  sameAppearance,
  sameLook,
  sameShellParts,
  themeSettingsSize,
  type StoreLook,
} from "./storeLook";
import { THEME_SETTINGS_MAX_CHARS, shellPartLabel, type ShellPart } from "./storeShell";
import type { ColorMode } from "./storeThemes";

/**
 * The website editor — a visual builder with the real storefront as its
 * canvas. Three panes:
 *
 *  - start: the page's sections as a sortable layer list (drag to reorder),
 *    and the block library gallery below it;
 *  - centre: the live preview (StorefrontPreview), re-rendered by the
 *    storefront itself shortly after every edit. Clicking a section there
 *    selects it here, and "+" between sections adds one at that spot. On
 *    the page itself sections and elements drag to new places, and sections,
 *    column widths and pictures resize by their handles (lib/canvasDrag.ts,
 *    canvasEdits.ts) — each release one undo step;
 *  - end: the inspector — the selected section's content, or the store's look
 *    (colours, font, corners, logo), or the announcement bar, header or
 *    footer (ShellPanels.tsx) when one of those is picked.
 *
 * Edits are held locally, with undo/redo, until Save. `draftData` is the only
 * page field written back. The rest of the tree — `version`, any
 * `globalStyles` — is carried through verbatim: dropping keys this editor
 * can't edit would silently destroy template data. The store look is saved to
 * the workspace (see storeLook.ts) by the same Save.
 */

/**
 * The pre-publish check's 422 body. Its `details[]` is page-scoped
 * (`{ field, message, pageId?, path? }`) rather than the flat form-field shape
 * `getFieldErrors` expects, so it is unpacked here instead.
 */
function publishProblemsOf(err: unknown): PublishProblem[] {
  if (!(err instanceof ApiError) || err.status !== 422) return [];
  const body = err.details as { error?: { details?: unknown } } | undefined;
  const details = body?.error?.details;
  if (!Array.isArray(details)) return [];
  return (details as PublishProblem[]).filter(
    (d) => d && typeof d.message === "string"
  );
}

/** Which page the editor opens by default, and falls back to after a delete. */
function pickEditablePage(pages: WebsitePage[]): WebsitePage | null {
  if (pages.length === 0) return null;
  return (
    pages.find((p) => p.pageType === "home") ?? pages.find((p) => p.path === "/") ?? pages[0]
  );
}

/** What undo/redo steps through: the open page's sections and the store look. */
interface EditorDoc {
  sections: PageSection[];
  look: StoreLook;
}

/** Undo/redo shortcuts leave text fields alone — those have their own undo. */
function isTextEntry(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  return target.isContentEditable || target.matches("input, textarea, select");
}

/**
 * Whether the page tabs fit in the toolbar row. `slot` is the row's free space
 * — `flex-1 basis-0`, so its width is what the other controls leave over,
 * with or without the tabs inside it — and `strip` is the tab strip, `w-max`,
 * so its scrollWidth is the width it needs in either place. Moving the strip
 * between the row and its own line therefore can't flip the answer back.
 *
 * `contentKey` re-measures when the tabs change without the strip's box
 * resizing (a strip already capped at the slot's width gaining a tab).
 */
function useFitsInSlot(
  slot: RefObject<HTMLElement | null>,
  strip: RefObject<HTMLElement | null>,
  contentKey: string
): boolean {
  const [fits, setFits] = useState(false);
  useEffect(() => {
    const slotEl = slot.current;
    const stripEl = strip.current;
    if (!slotEl || !stripEl || typeof ResizeObserver === "undefined") return;
    // Fires once on observe, then on every resize of either box.
    const observer = new ResizeObserver(() => setFits(stripEl.scrollWidth <= slotEl.clientWidth));
    observer.observe(slotEl);
    observer.observe(stripEl);
    return () => observer.disconnect();
    // `fits` is a dependency because the strip remounts when it moves.
  }, [slot, strip, contentKey, fits]);
  return fits;
}

export function WebsiteEditorPage() {
  // The shared editor pieces (inspector, library, image pickers) speak the
  // dashboard's language here; the funnel builder sets its own.
  const { locale } = useLocale();
  return (
    <EditorLocaleContext.Provider value={locale}>
      <WebsiteEditor />
    </EditorLocaleContext.Provider>
  );
}

function WebsiteEditor() {
  const { websiteId = "" } = useParams();
  const navigate = useNavigate();
  const workspaceId = useWorkspaceId();
  const { currentWorkspace } = useWorkspace();
  const saveThemeSettings = useSaveThemeSettings();
  const toast = useToast();
  const locale = useEditorLocale();
  const ui = editorUi(locale);

  const site = useAsync(
    () => apiClient.getWebsite(workspaceId, websiteId),
    [workspaceId, websiteId]
  );

  const pages = site.data?.pages ?? [];

  // Which page is open. Adjusted during render (below) whenever it no longer
  // names a real page — on first load, and after the open page is deleted.
  const [selectedPageId, setSelectedPageId] = useState<string | null>(null);
  if (pages.length > 0 && !pages.some((p) => p.id === selectedPageId)) {
    setSelectedPageId(pickEditablePage(pages)!.id);
  }
  const page = pages.find((p) => p.id === selectedPageId) ?? null;

  // Editing state, with undo/redo. `baseline` / `lookBaseline` are what was
  // last loaded or saved — the dirty checks compare against them rather than
  // tracking every mutation.
  const history = useEditHistory<EditorDoc>({ sections: [], look: readStoreLook(null) });
  const { sections, look } = history.value;
  const [baseline, setBaseline] = useState<string>("[]");
  const [lookBaseline, setLookBaseline] = useState<StoreLook>(() => readStoreLook(null));
  const [selectedId, setSelectedId] = useState<string | null>(null);
  /** The announcement bar, header or footer, when one of those is open instead of a section. */
  const [selectedShell, setSelectedShell] = useState<ShellPart | null>(null);
  const [pendingDelete, setPendingDelete] = useState<PageSection | null>(null);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  // Publishing. A failed publish comes back with a *list* of problems (one per
  // offending page), so they get their own state rather than sharing saveError.
  const [publishing, setPublishing] = useState(false);
  const [publishError, setPublishError] = useState<string | null>(null);
  const [publishProblems, setPublishProblems] = useState<PublishProblem[]>([]);

  // Page-level dialogs.
  const [showNewPage, setShowNewPage] = useState(false);
  const [pendingPageDelete, setPendingPageDelete] = useState<WebsitePage | null>(null);
  /** Page the merchant asked to switch to while the canvas had unsaved edits. */
  const [pendingSwitchId, setPendingSwitchId] = useState<string | null>(null);
  /** In-app address the merchant tried to leave for with unsaved edits. */
  const [pendingLeave, setPendingLeave] = useState<string | null>(null);

  // The builder's panes.
  const [inspectorTab, setInspectorTab] = useState<"section" | "look">("section");
  // The preview's own light/dark mode (null: whatever the page opens in). The
  // Store look panel switches it to the mode whose accent is being edited, so
  // the change is always the one on screen.
  const [previewMode, setPreviewMode] = useState<ColorMode | null>(null);
  /** Where "add a section here" pointed; the next block from the library lands there. */
  const [insertIndex, setInsertIndex] = useState<number | null>(null);
  /** The block library card currently being dragged, or null between drags. Drives the canvas's drop overlay. */
  const [draggingPreset, setDraggingPreset] = useState<BlockPreset | null>(null);
  const [scrollRequest, setScrollRequest] = useState<{ sectionId: string; nonce: number } | null>(null);
  const [shellScrollRequest, setShellScrollRequest] = useState<{ part: ShellPart; nonce: number } | null>(null);
  /** Below lg / xl the start and end panes are drawers. */
  const [startOpen, setStartOpen] = useState(false);
  const [endOpen, setEndOpen] = useState(false);
  /** "Page sections" unfolded, or folded to its header so the library gets the whole pane. */
  const [layersOpen, setLayersOpen] = useState(true);
  /**
   * At lg / xl and up the panes sit beside the canvas instead — collapsible to
   * a slim rail so the live preview can use their width back. Per-session
   * (not per-user forever): worth remembering while a merchant works, not
   * worth a permanent setting they'd have to go find again.
   */
  const [startCollapsed, setStartCollapsed] = useSessionBool("zimos:website-editor:start-collapsed", false);
  const [endCollapsed, setEndCollapsed] = useSessionBool("zimos:website-editor:end-collapsed", false);

  /** The page tabs sit in the toolbar row when they fit there, else on a slim line under it. */
  const tabsSlotRef = useRef<HTMLDivElement>(null);
  const tabsStripRef = useRef<HTMLDivElement>(null);
  const tabsInline = useFitsInSlot(
    tabsSlotRef,
    tabsStripRef,
    pages.map((p) => `${p.id}:${p.title}`).join("|")
  );

  // Everything in the tree the editor doesn't touch, preserved across a save.
  const [treeMeta, setTreeMeta] = useState<Omit<PageTree, "sections">>({ version: 1 });

  // Seed the editing state from the loaded page and the workspace's look,
  // adjusting state during render (React's documented pattern for "reset state
  // when a prop changes") rather than in an effect, which would render once
  // with the previous page's tree.
  //
  // Keyed on the page / workspace id we last seeded from, NOT on the objects: a
  // save swaps fresh ones in, and re-seeding on that would wipe the merchant's
  // current selection (and undo history) every time they save.
  const [seededPageId, setSeededPageId] = useState<string | null>(null);
  const [seededLookFor, setSeededLookFor] = useState<string | null>(null);
  const needLook = currentWorkspace !== null && currentWorkspace.id !== seededLookFor;
  const needPage = page !== null && page.id !== seededPageId;
  if (needLook || needPage) {
    let nextSections = sections;
    let nextLook = look;
    if (needLook) {
      nextLook = readStoreLook(currentWorkspace);
      setSeededLookFor(currentWorkspace.id);
      setLookBaseline(nextLook);
    }
    if (needPage) {
      const { sections: loaded, ...meta } = normalizeTree(page.draftData);
      nextSections = loaded;
      setSeededPageId(page.id);
      setTreeMeta(meta);
      setBaseline(JSON.stringify(loaded));
      setSelectedId(null);
      setInsertIndex(null);
      setSaveError(null);
    }
    history.reset({ sections: nextSections, look: nextLook });
  }

  const pageDirty = JSON.stringify(sections) !== baseline;
  const lookDirty = !sameLook(look, lookBaseline);
  const dirty = pageDirty || lookDirty;
  /** Only the Store look tab's own fields — the dot on that tab. */
  const appearanceDirty = !sameAppearance(look, lookBaseline);
  /** The announcement bar, header or footer have unsaved changes the preview should show. */
  const shellDirty = !sameShellParts(look, lookBaseline);
  /** How much of the API's themeSettings allowance a save would use (1 = full). */
  const settingsUsage = themeSettingsSize(currentWorkspace?.themeSettings, look) / THEME_SETTINGS_MAX_CHARS;

  // Browsers only honour this on a real user gesture, but it's the standard
  // guard against losing an unsaved tree to a refresh or a closed tab.
  useEffect(() => {
    if (!dirty) return;
    const onBeforeUnload = (e: BeforeUnloadEvent) => e.preventDefault();
    window.addEventListener("beforeunload", onBeforeUnload);
    return () => window.removeEventListener("beforeunload", onBeforeUnload);
  }, [dirty]);

  // …and the in-app equivalent. The app uses a plain BrowserRouter (no route
  // blockers), so a click on any link that would leave this screen is caught
  // before React Router sees it and turned into a confirm.
  useEffect(() => {
    if (!dirty) return;
    function onClick(event: MouseEvent) {
      if (event.defaultPrevented || event.button !== 0) return;
      if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
      const link = (event.target as Element | null)?.closest?.("a[href]") as HTMLAnchorElement | null;
      if (!link || (link.target && link.target !== "_self") || link.hasAttribute("download")) return;
      const url = new URL(link.href, window.location.href);
      if (url.origin !== window.location.origin || url.pathname === window.location.pathname) return;
      event.preventDefault();
      setPendingLeave(`${url.pathname}${url.search}${url.hash}`);
    }
    document.addEventListener("click", onClick, true);
    return () => document.removeEventListener("click", onClick, true);
  }, [dirty]);

  const selected = sections.find((s) => s.id === selectedId) ?? null;

  function setSections(update: (prev: PageSection[]) => PageSection[], key?: string) {
    // An update that changes nothing (a drop in place) records no undo step.
    history.set((doc) => {
      const next = update(doc.sections);
      return next === doc.sections ? doc : { ...doc, sections: next };
    }, key);
  }

  /** A drag or resize released on the canvas: one tree edit, one undo step. */
  function applyCanvas(edit: CanvasEdit, key?: string) {
    setSections((prev) => applyCanvasEdit(prev, edit), key);
    // Keep the moved element's section in the inspector.
    if (edit.kind === "move-element") {
      const owner = sections.find((s) =>
        (s.rows ?? []).some((r) => (r.columns ?? []).some((c) => c.id === edit.columnId))
      );
      if (owner && owner.id !== selectedId) selectSection(owner.id, { scroll: false });
    }
  }

  /**
   * One arrow-key press on a canvas handle. Repeated presses on the same
   * handle fold into one undo step, like a burst of typing.
   */
  function stepCanvas(step: CanvasStep) {
    if (step.kind === "element") {
      setSections((prev) => nudgeElement(prev, step.sectionId, step.elementId, step.delta));
      return;
    }
    const edit = stepEdit(step);
    if (edit) applyCanvas(edit, `canvas:${step.kind}:${step.sectionId}`);
  }

  /** Selecting from the editor side also brings the section into view in the preview. */
  function selectSection(sectionId: string, { scroll }: { scroll: boolean }) {
    setSelectedId(sectionId);
    setSelectedShell(null);
    setInspectorTab("section");
    setEndOpen(true);
    setEndCollapsed(false); // a picked section is the point of opening the inspector
    if (scroll) setScrollRequest((prev) => ({ sectionId, nonce: (prev?.nonce ?? 0) + 1 }));
  }

  /** Opens the announcement bar's, header's or footer's panel — and, from the editor side, scrolls the preview to it. */
  function selectShell(part: ShellPart, { scroll }: { scroll: boolean }) {
    setSelectedShell(part);
    setSelectedId(null);
    setInspectorTab("section");
    setEndOpen(true);
    setEndCollapsed(false);
    if (scroll) setShellScrollRequest((prev) => ({ part, nonce: (prev?.nonce ?? 0) + 1 }));
  }

  function requestInsert(index: number) {
    setInsertIndex(index);
    setStartOpen(true);
    setStartCollapsed(false); // "add a section here" is pointless if the library stays hidden
  }

  /** Creates a section from `preset` and drops it at `index`, then selects and scrolls to it. */
  function addBlockAt(preset: BlockPreset, index: number) {
    const section = createSection(preset, locale);
    setSections((prev) => insertSection(prev, section, index));
    selectSection(section.id, { scroll: true });
  }

  function addBlock(preset: BlockPreset) {
    addBlockAt(preset, insertIndex ?? sections.length);
    setInsertIndex(null);
    setStartOpen(false);
  }

  /** A block dragged from the library and dropped at an exact gap on the canvas. */
  function dropBlockAt(index: number) {
    if (draggingPreset) addBlockAt(draggingPreset, index);
    setDraggingPreset(null);
  }

  /** The canvas's own up/down buttons (PreviewBridge.tsx) — reorder without opening the layer list. */
  function moveSectionBy(sectionId: string, direction: "up" | "down") {
    setSections((prev) => {
      const from = prev.findIndex((s) => s.id === sectionId);
      if (from === -1) return prev;
      return moveSection(prev, from, direction === "up" ? from - 1 : from + 1);
    });
  }

  function updateSection(next: PageSection) {
    // One undo step per burst of typing in a section, not per keystroke.
    setSections((prev) => prev.map((s) => (s.id === next.id ? next : s)), `section:${next.id}`);
  }

  function deleteSection(section: PageSection) {
    setSections((prev) => prev.filter((s) => s.id !== section.id));
    setSelectedId((prev) => (prev === section.id ? null : prev));
    setPendingDelete(null);
  }

  function updateLook(next: StoreLook, key?: string) {
    history.set((doc) => ({ ...doc, look: next }), key);
  }

  /**
   * Switching pages throws away whatever is in the canvas, so an unsaved tree
   * has to be confirmed away first. (An unsaved store look is workspace-wide
   * and survives the switch.)
   */
  function requestPageSwitch(pageId: string) {
    if (pageId === selectedPageId) return;
    if (pageDirty) {
      setPendingSwitchId(pageId);
      return;
    }
    setSelectedPageId(pageId);
  }

  async function createPage(payload: CreateWebsitePagePayload) {
    // A new page starts from a few placeholder sections rather than empty. The
    // create call validates `draftData` exactly like a save, so it goes in the
    // same request and the page opens saved, with nothing pending.
    const created = await apiClient.createPage(workspaceId, websiteId, {
      ...payload,
      draftData: { version: 1, sections: createStarterSections(payload.title, locale) },
    });
    const detail = site.data;
    if (detail) site.setData({ ...detail, pages: [...detail.pages, created] });
    // Open it straight away — the canvas re-seeds off the new id.
    setSelectedPageId(created.id);
    setShowNewPage(false);
    toast.success(ui.pageCreated(created.title));
  }

  async function deletePage(target: WebsitePage) {
    // The backend deletes any page, home included; this is the real guard, not
    // just the disabled button in the tab strip.
    if (target.pageType === "home") return;
    await apiClient.deletePage(workspaceId, websiteId, target.id);
    const detail = site.data;
    if (detail) {
      site.setData({ ...detail, pages: detail.pages.filter((p) => p.id !== target.id) });
    }
    // If that was the open page, the render-time check above reselects home.
    setPendingPageDelete(null);
    toast.success(ui.pageDeleted(target.title));
  }

  async function savePage(): Promise<boolean> {
    if (!page) return true;
    const tree: PageTree = { ...treeMeta, sections };
    try {
      const updated = await apiClient.updateWebsitePage(workspaceId, websiteId, page.id, {
        draftData: tree,
      });
      // Re-baseline off what the server stored, not off what we sent.
      const { sections: saved } = normalizeTree(updated.draftData);
      setBaseline(JSON.stringify(saved));
      const detail = site.data;
      if (detail) {
        site.setData({
          ...detail,
          pages: detail.pages.map((p) => (p.id === updated.id ? updated : p)),
        });
      }
      return true;
    } catch (err) {
      // A malformed tree comes back as a 422 whose details name the node path
      // (e.g. "data.sections[1].rows"); surface that instead of a bare message.
      const fields = getFieldErrors(err);
      const detail = Object.entries(fields)
        .filter(([key]) => key.includes("["))
        .map(([key, message]) => `${key}: ${message}`)[0];
      setSaveError(detail ?? getErrorMessage(err));
      toast.error(ui.saveFailed);
      return false;
    }
  }

  async function saveLook(): Promise<boolean> {
    // The API refuses a themeSettings blob over ~5KB with a bare 422; say why
    // before sending it, while the merchant can still trim a link or two.
    if (settingsUsage > 1) {
      setSaveError(ui.shellTooLarge);
      toast.error(ui.lookSaveFailed);
      return false;
    }
    try {
      await saveThemeSettings((current) => lookToWorkspacePatch(current, look));
      setLookBaseline(look);
      return true;
    } catch (err) {
      setSaveError(getErrorMessage(err));
      toast.error(ui.lookSaveFailed);
      return false;
    }
  }

  async function save() {
    if (!dirty || saving) return;
    setSaving(true);
    setSaveError(null);
    const savingPage = pageDirty;
    const savingLook = lookDirty;
    try {
      const pageOk = savingPage ? await savePage() : true;
      const lookOk = savingLook ? await saveLook() : true;
      if (pageOk && lookOk) {
        toast.success(savingPage && savingLook ? ui.savedBoth : savingLook ? ui.lookSaved : ui.pageSaved);
      }
    } finally {
      setSaving(false);
    }
  }

  // Keyboard: undo / redo / save.
  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if (!(event.ctrlKey || event.metaKey) || event.altKey) return;
      const key = event.key.toLowerCase();
      if (key === "s") {
        event.preventDefault();
        void save();
        return;
      }
      if (isTextEntry(event.target)) return;
      if (key === "z" && !event.shiftKey) {
        event.preventDefault();
        history.undo();
      } else if ((key === "z" && event.shiftKey) || key === "y") {
        event.preventDefault();
        history.redo();
      }
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  });

  const website = site.data?.website;

  /**
   * Publishes the whole site. The server snapshots `draftData` as it is stored,
   * so this deliberately refuses to run while the canvas is dirty — publishing
   * unsaved edits would silently ship the *previous* content.
   */
  async function publish() {
    if (!website || dirty) return;
    setPublishing(true);
    setPublishError(null);
    setPublishProblems([]);
    try {
      const { website: published, revision } = await apiClient.publishWebsite(
        workspaceId,
        websiteId
      );
      const detail = site.data;
      if (detail) site.setData({ ...detail, website: published, publishedRevision: revision });
      toast.success(ui.published(revision.revisionNumber));
    } catch (err) {
      // A 422 is the pre-publish check: it reports every problem at once, keyed
      // by page rather than by form field, so getFieldErrors can't flatten it.
      const problems = publishProblemsOf(err);
      if (problems.length > 0) {
        setPublishProblems(problems);
      } else {
        setPublishError(getErrorMessage(err));
      }
      toast.error(ui.publishFailed);
    } finally {
      setPublishing(false);
    }
  }

  const labels = Object.fromEntries(sections.map((s) => [s.id, sectionLabel(s, locale)]));

  // The outline and the library share the pane on an adjustable split; the
  // handle between them steps aside while the outline is folded away.
  const startPane = (
    <ResizableSplit
      storageKey="zimos:website-editor:layer-split"
      label={ui.resizeSplit}
      hint={ui.resizeSplitHint}
      topCollapsed={!layersOpen}
      top={
        <LayerList
          sections={sections}
          selectedId={selectedId}
          insertIndex={insertIndex}
          onSelect={(id) => selectSection(id, { scroll: true })}
          onDelete={setPendingDelete}
          onMove={(from, to) => setSections((prev) => moveSection(prev, from, to))}
          onInsertAt={requestInsert}
          open={layersOpen}
          onOpenChange={setLayersOpen}
          selectedShell={selectedShell}
          onSelectShell={(part) => selectShell(part, { scroll: true })}
          announcementOn={look.announcement.enabled && look.announcement.messages.some((m) => m.trim() !== "")}
        />
      }
      bottom={
        <BlockLibrary
          onAdd={addBlock}
          insertPosition={insertIndex === null ? null : insertIndex + 1}
          onCancelInsert={() => setInsertIndex(null)}
          onDragStart={setDraggingPreset}
          onDragEnd={() => setDraggingPreset(null)}
        />
      }
    />
  );

  const endPane = (onClose?: () => void) => (
    <div className="flex h-full min-h-0 flex-col">
      <div role="tablist" aria-label={ui.tabLook} className="flex items-center gap-1 border-b border-line px-2 py-1.5">
        {(
          [
            ["section", selectedShell ? shellPartLabel(selectedShell, ui) : ui.tabSection, SlidersHorizontal],
            ["look", ui.tabLook, Palette],
          ] as const
        ).map(([value, label, Icon]) => (
          <button
            key={value}
            type="button"
            role="tab"
            aria-selected={inspectorTab === value}
            onClick={() => setInspectorTab(value)}
            className={cn(
              "cursor-pointer flex flex-1 items-center justify-center gap-1.5 rounded-[0.375rem] px-2 py-1.5 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40",
              inspectorTab === value
                ? "bg-primary-soft text-primary-dark dark:text-primary"
                : "text-ink-soft hover:bg-paper hover:text-ink"
            )}
          >
            <Icon className="size-4" aria-hidden />
            {label}
            {value === "look" && appearanceDirty && (
              <span className="size-1.5 rounded-full bg-accent" aria-label={ui.unsavedChanges} />
            )}
          </button>
        ))}
        {onClose && (
          <Button type="button" size="icon" variant="ghost" aria-label={ui.closePanel} onClick={onClose}>
            <X className="size-4" aria-hidden />
          </Button>
        )}
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto">
        {inspectorTab === "look" ? (
          <StoreLookPanel
            look={look}
            onChange={updateLook}
            onEditShell={(part) => selectShell(part, { scroll: true })}
            storeName={currentWorkspace?.name ?? ""}
            previewMode={previewMode ?? "light"}
            onPreviewMode={setPreviewMode}
          />
        ) : selectedShell ? (
          <ShellPanel
            part={selectedShell}
            look={look}
            onChange={updateLook}
            pages={pages}
            usage={settingsUsage}
            onClose={() => {
              setSelectedShell(null);
              setEndOpen(false);
            }}
          />
        ) : selected ? (
          <SectionInspector
            section={selected}
            onChange={updateSection}
            namedStyles={namedStylesOf(treeMeta.globalStyles)}
            onNamedStylesChange={(named) =>
              // Saved with the page tree; the element that triggered it changes too, which marks the page unsaved.
              setTreeMeta((prev) => ({ ...prev, globalStyles: { ...(prev.globalStyles ?? {}), named } }))
            }
            onDelete={() => setPendingDelete(selected)}
            onClose={() => {
              setSelectedId(null);
              setEndOpen(false);
            }}
          />
        ) : (
          <p className="px-4 py-6 text-sm text-ink-soft">{ui.pickSection}</p>
        )}
      </div>
    </div>
  );

  // Only once the site has loaded — until then there are no pages to switch
  // between, and an empty strip would still measure as fitting.
  const pageTabs = site.data && (
    <PageTabs
      ref={tabsStripRef}
      inline={tabsInline}
      pages={pages}
      selectedId={selectedPageId}
      onSelect={requestPageSwitch}
      onDelete={setPendingPageDelete}
      onAdd={() => setShowNewPage(true)}
    />
  );

  return (
    // A full-viewport page (mounted in EditorLayout, not DashboardLayout — see
    // App.tsx), so this is the page's only chrome apart from the access banner.
    // EditorLayout is an h-dvh column with the banner as a fixed-height row
    // above this one, so `h-full` here is the viewport minus the banner.
    <div className="flex h-full flex-col">
      {/* One toolbar row: where you are on the start side, what you can do on
          the end side, the page tabs in the space between when they fit. */}
      <div className="shrink-0 border-b border-line bg-paper-raised">
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5 px-3 py-1.5 md:flex-nowrap">
          <div className="flex min-w-0 items-center gap-2">
            <Link
              to="/website"
              title={ui.backToWebsite}
              className="flex shrink-0 items-center gap-1 rounded-[0.375rem] px-1.5 py-1 text-sm text-ink-soft transition-colors hover:bg-paper hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40"
            >
              <ArrowLeft className="size-4 rtl:-scale-x-100" aria-hidden />
              <span className="sr-only xl:not-sr-only">{ui.backToWebsite}</span>
            </Link>
            <span className="h-5 w-px shrink-0 bg-line" aria-hidden />
            <h1 className="min-w-0 max-w-64 truncate font-display text-base font-medium text-ink">
              {website ? website.name : ui.editorTitle}
            </h1>
            {website && (
              <span className="shrink-0">
                <StatusBadge
                  value={website.status}
                  tone={
                    website.status === "published"
                      ? "success"
                      : website.status === "suspended"
                        ? "danger"
                        : "neutral"
                  }
                />
              </span>
            )}
            {page && (
              <p
                className="hidden min-w-0 truncate text-xs text-ink-soft sm:block"
                title={`${ui.editingPage(page.title)} · ${page.path}`}
              >
                {ui.editingPage(page.title)}
                <span className="mx-1.5" aria-hidden>
                  ·
                </span>
                <span dir="ltr">{page.path}</span>
              </p>
            )}
          </div>

          <div ref={tabsSlotRef} className="min-w-0 flex-1 basis-0">
            {tabsInline && pageTabs}
          </div>

          <div className="flex shrink-0 items-center gap-1.5">
            {/* Below lg / xl the side panes are drawers, opened from here. */}
            <Button
              type="button"
              size="icon-sm"
              variant="outline"
              className="lg:hidden"
              aria-label={ui.layersTitle}
              title={ui.layersTitle}
              onClick={() => setStartOpen(true)}
            >
              <Layers className="size-4" aria-hidden />
            </Button>
            <Button
              type="button"
              size="icon-sm"
              variant="outline"
              className="xl:hidden"
              aria-label={ui.tabLook}
              title={ui.tabLook}
              onClick={() => {
                setInspectorTab("look");
                setEndOpen(true);
              }}
            >
              <Palette className="size-4" aria-hidden />
            </Button>
            <span
              role="status"
              title={dirty ? ui.unsavedChanges : ui.allSaved}
              className={cn(
                "flex items-center gap-1.5 whitespace-nowrap text-xs",
                dirty ? "font-medium text-accent-dark" : "text-ink-soft"
              )}
            >
              <span className={cn("size-2 rounded-full", dirty ? "bg-accent" : "bg-success")} aria-hidden />
              <span className="sr-only lg:not-sr-only">{dirty ? ui.unsavedChanges : ui.allSaved}</span>
            </span>
            <span className="flex items-center">
              <Button
                type="button"
                size="icon-sm"
                variant="ghost"
                aria-label={ui.undo}
                title={`${ui.undo} (Ctrl+Z)`}
                disabled={!history.canUndo}
                onClick={history.undo}
              >
                <Undo2 className="size-4 rtl:-scale-x-100" aria-hidden />
              </Button>
              <Button
                type="button"
                size="icon-sm"
                variant="ghost"
                aria-label={ui.redo}
                title={`${ui.redo} (Ctrl+Shift+Z)`}
                disabled={!history.canRedo}
                onClick={history.redo}
              >
                <Redo2 className="size-4 rtl:-scale-x-100" aria-hidden />
              </Button>
            </span>
            <Button type="button" size="sm" onClick={() => void save()} disabled={!dirty || saving} title="Ctrl+S">
              {saving ? <Spinner className="size-4" /> : <Save className="size-4" aria-hidden />}
              {saving ? ui.saving : ui.save}
            </Button>
            <Button
              type="button"
              size="sm"
              variant="outline"
              onClick={() => void publish()}
              disabled={!website || dirty || publishing}
              title={dirty ? ui.publishSaveFirst : ui.publishHint}
            >
              {publishing ? (
                <Spinner className="size-4" />
              ) : (
                <Rocket className="size-4" aria-hidden />
              )}
              {publishing ? ui.publishing : ui.publish}
            </Button>
          </div>
        </div>

        {!tabsInline && pageTabs}

        {(saveError || publishError || publishProblems.length > 0) && (
          <div className="space-y-2 px-3 pb-2">
            {saveError && <Alert variant="danger">{saveError}</Alert>}
            {publishError && <Alert variant="danger">{publishError}</Alert>}
            {publishProblems.length > 0 && (
              <Alert variant="danger">
                <p className="font-medium">{ui.cantPublish}</p>
                <ul className="mt-1 list-disc space-y-0.5 ps-5">
                  {publishProblems.map((problem, i) => (
                    <li key={`${problem.pageId ?? problem.field}-${i}`}>
                      {problem.path && <span className="font-medium">{problem.path}: </span>}
                      {problem.message}
                    </li>
                  ))}
                </ul>
              </Alert>
            )}
          </div>
        )}
      </div>

      <div className="min-h-0 flex-1">
        <DataState
          loading={site.loading}
          error={site.error}
          empty={!site.data}
          emptyMessage={ui.noPagesToEdit}
          onRetry={() => site.refresh()}
        >
          {/* The three columns take whatever height the toolbar leaves; only
              the side panes and the preview scroll, each on its own. Side
              panes scale with the window between 240 and 320px. */}
          <div className="flex h-full min-h-0">
            <CollapsiblePane
              side="start"
              collapsed={startCollapsed}
              onCollapsedChange={setStartCollapsed}
              visibleClassName="lg:flex lg:w-[clamp(240px,22vw,320px)]"
              railClassName="lg:flex"
              collapseLabel={ui.collapsePanel}
              expandLabel={ui.expandPanel}
            >
              {startPane}
            </CollapsiblePane>

            <main className="min-w-0 flex-1 bg-paper">
              {!page ? (
                <div className="p-6">
                  <div className="rounded-[var(--radius-card)] border border-dashed border-line px-6 py-16 text-center text-sm text-ink-soft">
                    {ui.noPages}
                  </div>
                </div>
              ) : (
                <StorefrontPreview
                  workspaceId={workspaceId}
                  tree={{ ...treeMeta, sections }}
                  labels={{
                    title: ui.previewTitle,
                    hint: ui.previewHint,
                    refresh: ui.previewRefresh,
                    desktop: ui.previewDesktop,
                    tablet: ui.previewTablet,
                    mobile: ui.previewMobile,
                    close: ui.previewClose,
                    frameTitle: ui.previewFrame,
                    lightMode: ui.previewLightMode,
                    darkMode: ui.previewDarkMode,
                  }}
                  colorMode={previewMode}
                  onColorModeChange={setPreviewMode}
                  canvas={{
                    selectedId,
                    labels,
                    strings: {
                      addAbove: ui.addAbove,
                      addBelow: ui.addBelow,
                      moveUp: ui.moveSectionUp,
                      moveDown: ui.moveSectionDown,
                      dragSection: ui.canvasDragSection,
                      dragElement: ui.canvasDragElement,
                      resizeHeight: ui.canvasResizeHeight,
                      resizeColumns: ui.canvasResizeColumns,
                      resizeImage: ui.canvasResizeImage,
                      auto: ui.canvasAuto,
                    },
                    theme: lookToPreview(look),
                    scrollRequest,
                    selectedShell,
                    shellLabels: {
                      header: ui.shellHeader,
                      footer: ui.shellFooter,
                      announcement: ui.announcementBar,
                    },
                    // Only while there is something unsaved to show: otherwise
                    // the frame draws the saved header and footer untouched.
                    shell: shellDirty ? lookToShellPreview(currentWorkspace?.themeSettings, look) : null,
                    shellScrollRequest,
                    onSelectShell: (part) => selectShell(part, { scroll: false }),
                    onSelect: (id) => selectSection(id, { scroll: false }),
                    onCanvasEdit: (edit) => applyCanvas(edit),
                    onCanvasStep: stepCanvas,
                    onInsert: requestInsert,
                    onMoveSection: moveSectionBy,
                    dragActive: draggingPreset !== null,
                    onDrop: dropBlockAt,
                  }}
                />
              )}
            </main>

            <CollapsiblePane
              side="end"
              collapsed={endCollapsed}
              onCollapsedChange={setEndCollapsed}
              visibleClassName="xl:flex xl:w-[clamp(240px,22vw,320px)]"
              railClassName="xl:flex"
              collapseLabel={ui.collapsePanel}
              expandLabel={ui.expandPanel}
            >
              {endPane()}
            </CollapsiblePane>
          </div>
        </DataState>
      </div>

      {startOpen && (
        <div className="fixed inset-y-0 start-0 z-30 w-80 max-w-full border-e border-line bg-paper-raised shadow-xl lg:hidden">
          <div className="flex justify-end border-b border-line px-2 py-1.5">
            <Button type="button" size="icon" variant="ghost" aria-label={ui.closePanel} onClick={() => setStartOpen(false)}>
              <X className="size-4" aria-hidden />
            </Button>
          </div>
          <div className="h-[calc(100%-2.75rem)]">{startPane}</div>
        </div>
      )}

      {endOpen && (selected || selectedShell || inspectorTab === "look") && (
        <div className="fixed inset-y-0 end-0 z-30 w-80 max-w-full border-s border-line bg-paper-raised shadow-xl xl:hidden">
          {endPane(() => setEndOpen(false))}
        </div>
      )}

      <ConfirmDialog
        open={pendingDelete !== null}
        title={ui.deleteSectionTitle}
        description={pendingDelete ? ui.deleteSectionBody(sectionLabel(pendingDelete, locale)) : undefined}
        confirmLabel={ui.deleteSection}
        destructive
        onCancel={() => setPendingDelete(null)}
        onConfirm={() => pendingDelete && deleteSection(pendingDelete)}
      />

      <NewPageDialog
        open={showNewPage}
        onClose={() => setShowNewPage(false)}
        onCreate={createPage}
      />

      <ConfirmDialog
        open={pendingPageDelete !== null}
        title={ui.deletePageTitle}
        description={
          pendingPageDelete ? ui.deletePageBody(pendingPageDelete.title, pendingPageDelete.path) : undefined
        }
        confirmLabel={ui.deletePage}
        destructive
        onCancel={() => setPendingPageDelete(null)}
        onConfirm={() => pendingPageDelete && deletePage(pendingPageDelete)}
      />

      <ConfirmDialog
        open={pendingSwitchId !== null}
        title={ui.leaveTitle}
        description={ui.switchBody}
        confirmLabel={ui.switchConfirm}
        destructive
        onCancel={() => setPendingSwitchId(null)}
        onConfirm={() => {
          setSelectedPageId(pendingSwitchId);
          setPendingSwitchId(null);
        }}
      />

      <ConfirmDialog
        open={pendingLeave !== null}
        title={ui.leaveTitle}
        description={ui.leaveBody}
        confirmLabel={ui.leaveConfirm}
        destructive
        onCancel={() => setPendingLeave(null)}
        onConfirm={() => {
          const to = pendingLeave;
          setPendingLeave(null);
          if (to) navigate(to);
        }}
      />
    </div>
  );
}
