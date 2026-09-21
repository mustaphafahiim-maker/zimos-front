import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { Layers, Palette, Redo2, Rocket, Save, SlidersHorizontal, Undo2, X } from "lucide-react";
import { Alert, Button, Spinner, cn } from "@store-builder/ui";
import type {
  CreateWebsitePagePayload,
  PageSection,
  PageTree,
  PublishProblem,
  WebsitePage,
} from "@store-builder/api-client";
import { apiClient } from "@/lib/apiClient";
import { useWorkspaceId } from "@/lib/useWorkspaceId";
import { useAsync } from "@/lib/useAsync";
import { ApiError, getErrorMessage, getFieldErrors } from "@/lib/errors";
import { useWorkspace } from "@/context/WorkspaceContext";
import { useLocale } from "@/i18n/LocaleContext";
import { PageHeader } from "@/components/PageHeader";
import { DataState } from "@/components/DataState";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { StatusBadge } from "@/components/StatusBadge";
import { useToast } from "@/components/Toast";
import { StorefrontPreview } from "@/components/StorefrontPreview";
import { BlockLibrary } from "./BlockLibrary";
import { LayerList } from "./LayerList";
import { SectionInspector } from "./SectionInspector";
import { StoreLookPanel } from "./StoreLookPanel";
import { NewPageDialog } from "./NewPageDialog";
import { PageTabs } from "./PageTabs";
import {
  createSection,
  insertSection,
  moveSection,
  normalizeTree,
  sectionLabel,
  type BlockPreset,
} from "./blocks";
import { EditorLocaleContext, editorUi, useEditorLocale } from "./editorLocale";
import { useEditHistory } from "./editHistory";
import { lookToPreview, lookToWorkspacePatch, readStoreLook, sameLook, type StoreLook } from "./storeLook";

/**
 * The website editor — a visual builder with the real storefront as its
 * canvas. Three panes:
 *
 *  - start: the page's sections as a sortable layer list (drag to reorder),
 *    and the block library gallery below it;
 *  - centre: the live preview (StorefrontPreview), re-rendered by the
 *    storefront itself shortly after every edit. Clicking a section there
 *    selects it here, and "+" between sections adds one at that spot;
 *  - end: the inspector — the selected section's content, or the store's look
 *    (colours, font, corners, logo).
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
  const { currentWorkspace, refresh: refreshWorkspace } = useWorkspace();
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
  /** Where "add a section here" pointed; the next block from the library lands there. */
  const [insertIndex, setInsertIndex] = useState<number | null>(null);
  const [scrollRequest, setScrollRequest] = useState<{ sectionId: string; nonce: number } | null>(null);
  /** Below lg / xl the start and end panes are drawers. */
  const [startOpen, setStartOpen] = useState(false);
  const [endOpen, setEndOpen] = useState(false);

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
    history.set((doc) => ({ ...doc, sections: update(doc.sections) }), key);
  }

  /** Selecting from the editor side also brings the section into view in the preview. */
  function selectSection(sectionId: string, { scroll }: { scroll: boolean }) {
    setSelectedId(sectionId);
    setInspectorTab("section");
    setEndOpen(true);
    if (scroll) setScrollRequest((prev) => ({ sectionId, nonce: (prev?.nonce ?? 0) + 1 }));
  }

  function requestInsert(index: number) {
    setInsertIndex(index);
    setStartOpen(true);
  }

  function addBlock(preset: BlockPreset) {
    const section = createSection(preset);
    setSections((prev) => insertSection(prev, section, insertIndex ?? prev.length));
    setInsertIndex(null);
    setStartOpen(false);
    selectSection(section.id, { scroll: true });
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
    const created = await apiClient.createPage(workspaceId, websiteId, payload);
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
    try {
      await apiClient.updateWorkspace(
        workspaceId,
        lookToWorkspacePatch(currentWorkspace?.themeSettings, look)
      );
      setLookBaseline(look);
      // The header's store switcher and the Settings page read the workspace list.
      await refreshWorkspace();
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

  const startPane = (
    <div className="flex h-full min-h-0 flex-col">
      <LayerList
        sections={sections}
        selectedId={selectedId}
        insertIndex={insertIndex}
        onSelect={(id) => selectSection(id, { scroll: true })}
        onDelete={setPendingDelete}
        onMove={(from, to) => setSections((prev) => moveSection(prev, from, to))}
        onInsertAt={requestInsert}
      />
      <div className="min-h-0 flex-1">
        <BlockLibrary
          onAdd={addBlock}
          insertPosition={insertIndex === null ? null : insertIndex + 1}
          onCancelInsert={() => setInsertIndex(null)}
        />
      </div>
    </div>
  );

  const endPane = (onClose?: () => void) => (
    <div className="flex h-full min-h-0 flex-col">
      <div role="tablist" aria-label={ui.tabLook} className="flex items-center gap-1 border-b border-line px-2 py-1.5">
        {(
          [
            ["section", ui.tabSection, SlidersHorizontal],
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
            {value === "look" && lookDirty && (
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
          <StoreLookPanel look={look} onChange={updateLook} />
        ) : selected ? (
          <SectionInspector
            section={selected}
            onChange={updateSection}
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

  return (
    <div className="-m-6 flex h-[calc(100vh-4rem)] flex-col">
      <div className="border-b border-line bg-paper-raised px-6 py-4">
        <PageHeader
          title={website ? website.name : ui.editorTitle}
          titleMeta={page ? page.path : undefined}
          back={{ to: "/website", label: ui.backToWebsite }}
          description={page ? ui.editingPage(page.title) : undefined}
          titleBadge={
            website && (
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
            )
          }
          actions={
            <>
              <span
                role="status"
                className={cn(
                  "flex items-center gap-1.5 text-xs",
                  dirty ? "font-medium text-accent-dark" : "text-ink-soft"
                )}
              >
                <span className={cn("size-2 rounded-full", dirty ? "bg-accent" : "bg-success")} aria-hidden />
                {dirty ? ui.unsavedChanges : ui.allSaved}
              </span>
              <span className="flex items-center">
                <Button
                  type="button"
                  size="icon"
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
                  size="icon"
                  variant="ghost"
                  aria-label={ui.redo}
                  title={`${ui.redo} (Ctrl+Shift+Z)`}
                  disabled={!history.canRedo}
                  onClick={history.redo}
                >
                  <Redo2 className="size-4 rtl:-scale-x-100" aria-hidden />
                </Button>
              </span>
              <Button type="button" onClick={() => void save()} disabled={!dirty || saving} title="Ctrl+S">
                {saving ? <Spinner className="size-4" /> : <Save className="size-4" aria-hidden />}
                {saving ? ui.saving : ui.save}
              </Button>
              <Button
                type="button"
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
            </>
          }
        />
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

      <div className="min-h-0 flex-1">
        <DataState
          loading={site.loading}
          error={site.error}
          empty={!site.data}
          emptyMessage={ui.noPagesToEdit}
          onRetry={() => site.refresh()}
        >
          <div className="flex h-full min-h-0 flex-col">
            <PageTabs
              pages={pages}
              selectedId={selectedPageId}
              onSelect={requestPageSwitch}
              onDelete={setPendingPageDelete}
              onAdd={() => setShowNewPage(true)}
            />

            {/* Below lg / xl the side panes open as drawers from here. */}
            <div className="flex items-center gap-2 border-b border-line bg-paper-raised px-4 py-2 xl:hidden">
              <Button
                type="button"
                size="sm"
                variant="outline"
                className="lg:hidden"
                onClick={() => setStartOpen(true)}
              >
                <Layers className="size-4" aria-hidden />
                {ui.layersTitle}
              </Button>
              <Button
                type="button"
                size="sm"
                variant="outline"
                onClick={() => {
                  setInspectorTab("look");
                  setEndOpen(true);
                }}
              >
                <Palette className="size-4" aria-hidden />
                {ui.tabLook}
              </Button>
            </div>

            <div className="flex min-h-0 flex-1">
              <aside className="hidden w-72 shrink-0 border-e border-line bg-paper-raised lg:block">
                {startPane}
              </aside>

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
                    }}
                    canvas={{
                      selectedId,
                      labels,
                      strings: { addAbove: ui.addAbove, addBelow: ui.addBelow },
                      theme: lookToPreview(look),
                      scrollRequest,
                      onSelect: (id) => selectSection(id, { scroll: false }),
                      onInsert: requestInsert,
                    }}
                  />
                )}
              </main>

              <aside className="hidden w-80 shrink-0 border-s border-line bg-paper-raised xl:block">
                {endPane()}
              </aside>
            </div>
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

      {endOpen && (selected || inspectorTab === "look") && (
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
