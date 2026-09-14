import { useCallback, useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import {
  DndContext,
  KeyboardSensor,
  PointerSensor,
  closestCenter,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import { restrictToParentElement, restrictToVerticalAxis } from "@dnd-kit/modifiers";
import {
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { FilePlus2, LayoutTemplate, MousePointerClick, Rocket, Save } from "lucide-react";
import { Alert, Button, Spinner } from "@store-builder/ui";
import type {
  CreateWebsitePagePayload,
  PageSection,
  PageTree,
  PublishProblem,
  WebsitePage,
} from "@store-builder/api-client";
import { apiClient } from "@/lib/apiClient";
import { useWorkspaceId } from "@/lib/useWorkspaceId";
import { useAsync } from "@store-builder/ui";
import { ApiError, getErrorMessage, getFieldErrors } from "@/lib/errors";
import { PageHeader } from "@/components/PageHeader";
import { DataState } from "@/components/DataState";
import { EmptyState } from "@/components/EmptyState";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { StatusBadge } from "@/components/StatusBadge";
import { useToast } from "@/components/Toast";
import { fmt, useCommon, useLocale, useT, type Messages } from "@/i18n/LocaleContext";
import { BlockLibrary } from "./BlockLibrary";
import { SectionCard } from "./SectionCard";
import { SectionInspector } from "./SectionInspector";
import { NewPageDialog } from "./NewPageDialog";
import { PageTabs } from "./PageTabs";
import { createSection, moveSection, normalizeTree, sectionLabel, type BlockPreset } from "./blocks";

const STRINGS = {
  en: {
    editorTitle: "Website editor",
    backToWebsite: "Back to website",
    editingDescription: 'Editing "{title}". Drag sections to reorder, click one to edit its content.',
    unsaved: "Unsaved changes",
    publish: "Publish",
    publishing: "Publishing…",
    publishSaveFirst: "Save your changes first — publishing ships the last saved version.",
    publishHint: "Publish the saved draft of every page",
    cantPublish: "This site can’t be published yet:",
    noPagesToEdit: "This site has no pages to edit yet.",
    noPagesTitle: "This site has no pages yet",
    noPagesBody: "Use “New page” above to add one.",
    emptyPageTitle: "This page is empty",
    emptyPageBody: "Add a block from the blocks panel to get started.",
    selectSection: "Select a section on the canvas to edit its content.",
    pageCreated: '"{title}" created.',
    pageDeleted: '"{title}" deleted.',
    pageSaved: "Page saved.",
    saveFailed: "Couldn't save the page.",
    published: "Site published — revision {n} is live.",
    publishFailed: "Couldn't publish the site.",
    deleteSectionTitle: "Delete this section?",
    deleteSectionBody:
      '"{label}" and its content will be removed from the page. Nothing is deleted until you save.',
    deleteSectionConfirm: "Delete section",
    deletePageTitle: "Delete this page?",
    deletePageBody:
      '"{title}" ({path}) and everything on it will be permanently deleted. This can\'t be undone.',
    deletePageConfirm: "Delete page",
    leaveTitle: "Leave without saving?",
    leaveBody: "This page has changes you haven't saved. Switching pages will discard them.",
    leaveConfirm: "Discard and switch",
    sectionsLabel: "Page sections",
    blocksLabel: "Blocks",
    inspectorLabel: "Section settings",
  },
  ar: {
    editorTitle: "محرّر الموقع",
    backToWebsite: "العودة إلى الموقع",
    editingDescription: "تعديل صفحة «{title}». اسحب الأقسام لإعادة ترتيبها، وانقر على أي قسم لتعديل محتواه.",
    unsaved: "تغييرات غير محفوظة",
    publish: "نشر",
    publishing: "جارٍ النشر…",
    publishSaveFirst: "احفظ تغييراتك أولًا — النشر يعتمد على آخر نسخة محفوظة.",
    publishHint: "نشر المسودة المحفوظة لجميع الصفحات",
    cantPublish: "لا يمكن نشر هذا الموقع بعد للأسباب التالية:",
    noPagesToEdit: "لا توجد صفحات قابلة للتعديل في هذا الموقع بعد.",
    noPagesTitle: "لا توجد صفحات في هذا الموقع بعد",
    noPagesBody: "استخدم زر «صفحة جديدة» في الأعلى لإضافة صفحة.",
    emptyPageTitle: "هذه الصفحة فارغة",
    emptyPageBody: "أضف قسمًا من لوحة الأقسام للبدء.",
    selectSection: "اختر قسمًا من مساحة العمل لتعديل محتواه.",
    pageCreated: "تم إنشاء صفحة «{title}».",
    pageDeleted: "تم حذف صفحة «{title}».",
    pageSaved: "تم حفظ الصفحة.",
    saveFailed: "تعذّر حفظ الصفحة.",
    published: "تم نشر الموقع — الإصدار {n} متاح الآن.",
    publishFailed: "تعذّر نشر الموقع.",
    deleteSectionTitle: "حذف هذا القسم؟",
    deleteSectionBody:
      "ستتم إزالة قسم «{label}» ومحتواه من الصفحة. لن يُحذف أي شيء فعليًا حتى تحفظ التغييرات.",
    deleteSectionConfirm: "حذف القسم",
    deletePageTitle: "حذف هذه الصفحة؟",
    deletePageBody: "سيتم حذف صفحة «{title}» ({path}) وكل محتواها نهائيًا. لا يمكن التراجع عن ذلك.",
    deletePageConfirm: "حذف الصفحة",
    leaveTitle: "المغادرة دون حفظ؟",
    leaveBody: "في هذه الصفحة تغييرات لم تُحفظ بعد. سيؤدي التبديل إلى صفحة أخرى إلى تجاهلها.",
    leaveConfirm: "تجاهل التغييرات والتبديل",
    sectionsLabel: "أقسام الصفحة",
    blocksLabel: "الأقسام",
    inspectorLabel: "إعدادات القسم",
  },
} satisfies Messages;

/** Isolates an LTR token (path, slug) inside a plain string so it reads correctly in RTL. */
function ltrIsolate(value: string): string {
  // U+2066 LEFT-TO-RIGHT ISOLATE … U+2069 POP DIRECTIONAL ISOLATE
  return `\u2066${value}\u2069`;
}

/**
 * The website editor: pick a page, reorder its sections by drag, edit their
 * content, save. Pages can be added and removed from the tab strip above the
 * canvas.
 *
 * `draftData` is the only field written back on save. The rest of the tree —
 * `version`, any `globalStyles` — is carried through verbatim: this editor has
 * no styling controls, and dropping keys it can't edit would silently destroy
 * template data.
 *
 * RTL: the editor chrome mirrors (block library on the start side, inspector
 * on the end side) via logical classes. The section list is vertical-only, so
 * @dnd-kit's transforms are unaffected by text direction.
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

export function WebsiteEditorPage() {
  const { websiteId = "" } = useParams();
  const workspaceId = useWorkspaceId();
  const toast = useToast();
  const t = useT(STRINGS);
  const c = useCommon();
  const { locale } = useLocale();

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

  // Editing state. `baseline` is the tree as last loaded/saved — the dirty
  // check compares against it rather than tracking every mutation.
  const [sections, setSections] = useState<PageSection[]>([]);
  const [baseline, setBaseline] = useState<string>("[]");
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

  // Everything in the tree the editor doesn't touch, preserved across a save.
  const [treeMeta, setTreeMeta] = useState<Omit<PageTree, "sections">>({ version: 1 });

  // Seed the editing state from the loaded page, adjusting state during render
  // (React's documented pattern for "reset state when a prop changes") rather
  // than in an effect, which would render once with the previous page's tree.
  //
  // Keyed on the page id we last seeded from, NOT on the page object: a save
  // swaps a fresh page object into `site.data`, and re-seeding on that would
  // wipe the merchant's current selection every time they save.
  const [seededPageId, setSeededPageId] = useState<string | null>(null);
  if (page && page.id !== seededPageId) {
    const { sections: loaded, ...meta } = normalizeTree(page.draftData);
    setSeededPageId(page.id);
    setSections(loaded);
    setTreeMeta(meta);
    setBaseline(JSON.stringify(loaded));
    setSelectedId(null);
    setSaveError(null);
  }

  const dirty = JSON.stringify(sections) !== baseline;

  // Browsers only honour this on a real user gesture, but it's the standard
  // guard against losing an unsaved tree to a refresh or a closed tab.
  useEffect(() => {
    if (!dirty) return;
    const onBeforeUnload = (e: BeforeUnloadEvent) => e.preventDefault();
    window.addEventListener("beforeunload", onBeforeUnload);
    return () => window.removeEventListener("beforeunload", onBeforeUnload);
  }, [dirty]);

  const selected = sections.find((s) => s.id === selectedId) ?? null;

  const sensors = useSensors(
    // A small distance threshold so a click on the handle still selects rather
    // than starting a phantom drag.
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  const handleDragEnd = useCallback((event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    setSections((prev) => {
      const from = prev.findIndex((s) => s.id === active.id);
      const to = prev.findIndex((s) => s.id === over.id);
      return moveSection(prev, from, to);
    });
  }, [setSections]);

  function addBlock(preset: BlockPreset) {
    const section = createSection(preset);
    setSections((prev) => [...prev, section]);
    setSelectedId(section.id);
  }

  function updateSection(next: PageSection) {
    setSections((prev) => prev.map((s) => (s.id === next.id ? next : s)));
  }

  function deleteSection(section: PageSection) {
    setSections((prev) => prev.filter((s) => s.id !== section.id));
    setSelectedId((prev) => (prev === section.id ? null : prev));
    setPendingDelete(null);
  }

  /**
   * Switching pages throws away whatever is in the canvas, so an unsaved tree
   * has to be confirmed away first.
   */
  function requestPageSwitch(pageId: string) {
    if (pageId === selectedPageId) return;
    if (dirty) {
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
    toast.success(fmt(t.pageCreated, { title: created.title }));
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
    toast.success(fmt(t.pageDeleted, { title: target.title }));
  }

  async function save() {
    if (!page) return;
    setSaving(true);
    setSaveError(null);
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
      toast.success(t.pageSaved);
    } catch (err) {
      // A malformed tree comes back as a 422 whose details name the node path
      // (e.g. "data.sections[1].rows"); surface that instead of a bare message.
      const fields = getFieldErrors(err);
      const detail = Object.entries(fields)
        .filter(([key]) => key.includes("["))
        .map(([key, message]) => `${key}: ${message}`)[0];
      setSaveError(detail ?? getErrorMessage(err));
      toast.error(t.saveFailed);
    } finally {
      setSaving(false);
    }
  }

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
      toast.success(fmt(t.published, { n: revision.revisionNumber }));
    } catch (err) {
      // A 422 is the pre-publish check: it reports every problem at once, keyed
      // by page rather than by form field, so getFieldErrors can't flatten it.
      const problems = publishProblemsOf(err);
      if (problems.length > 0) {
        setPublishProblems(problems);
      } else {
        setPublishError(getErrorMessage(err));
      }
      toast.error(t.publishFailed);
    } finally {
      setPublishing(false);
    }
  }

  return (
    <div className="-m-6 flex h-[calc(100vh-4rem)] flex-col">
      <div className="border-b border-line bg-paper-raised px-4 py-4 sm:px-6">
        <PageHeader
          title={website ? website.name : t.editorTitle}
          titleMeta={page ? ltrIsolate(page.path) : undefined}
          back={{ to: "/website", label: t.backToWebsite }}
          description={page ? fmt(t.editingDescription, { title: page.title }) : undefined}
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
              {dirty && (
                <span className="inline-flex items-center gap-1.5 rounded-full bg-warning-soft px-2 py-0.5 text-xs font-medium text-warning">
                  <span className="size-1.5 rounded-full bg-warning" aria-hidden />
                  {t.unsaved}
                </span>
              )}
              <Button type="button" onClick={() => void save()} disabled={!page || !dirty || saving}>
                {saving ? <Spinner className="size-4" /> : <Save className="size-4" aria-hidden />}
                {saving ? c.saving : c.save}
              </Button>
              <Button
                type="button"
                variant="outline"
                onClick={() => void publish()}
                disabled={!website || dirty || publishing}
                title={dirty ? t.publishSaveFirst : t.publishHint}
              >
                {publishing ? (
                  <Spinner className="size-4" />
                ) : (
                  <Rocket className="size-4 rtl:-scale-x-100" aria-hidden />
                )}
                {publishing ? t.publishing : t.publish}
              </Button>
            </>
          }
        />
        {saveError && <Alert variant="danger">{saveError}</Alert>}
        {publishError && <Alert variant="danger">{publishError}</Alert>}
        {publishProblems.length > 0 && (
          <Alert variant="danger">
            <p className="font-semibold">{t.cantPublish}</p>
            <ul className="mt-1 list-disc space-y-0.5 ps-5">
              {publishProblems.map((problem, i) => (
                <li key={`${problem.pageId ?? problem.field}-${i}`}>
                  {problem.path && (
                    <span className="font-medium">
                      <bdi dir="ltr">{problem.path}</bdi>:{" "}
                    </span>
                  )}
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
          emptyMessage={t.noPagesToEdit}
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

            <div className="flex min-h-0 flex-1">
              <aside
                aria-label={t.blocksLabel}
                className="hidden w-56 shrink-0 border-e border-line bg-paper-raised lg:block"
              >
                <BlockLibrary onAdd={addBlock} />
              </aside>

              <main
                aria-label={t.sectionsLabel}
                className="min-w-0 flex-1 overflow-y-auto bg-paper p-4 sm:p-6"
              >
                <div className="mx-auto max-w-2xl">
                  {!page ? (
                    <EmptyState
                      className="rounded-2xl bg-paper-raised"
                      icon={<FilePlus2 aria-hidden />}
                      title={t.noPagesTitle}
                      description={t.noPagesBody}
                    />
                  ) : sections.length === 0 ? (
                    <EmptyState
                      className="rounded-2xl bg-paper-raised"
                      icon={<LayoutTemplate aria-hidden />}
                      title={t.emptyPageTitle}
                      description={t.emptyPageBody}
                    />
                  ) : (
                    <DndContext
                      sensors={sensors}
                      collisionDetection={closestCenter}
                      modifiers={[restrictToVerticalAxis, restrictToParentElement]}
                      onDragEnd={handleDragEnd}
                    >
                      <SortableContext
                        items={sections.map((s) => s.id)}
                        strategy={verticalListSortingStrategy}
                      >
                        <div className="space-y-3">
                          {sections.map((section) => (
                            <SectionCard
                              key={section.id}
                              section={section}
                              selected={section.id === selectedId}
                              onSelect={() => setSelectedId(section.id)}
                              onDelete={() => setPendingDelete(section)}
                            />
                          ))}
                        </div>
                      </SortableContext>
                    </DndContext>
                  )}

                  {/* The library lives in the sidebar on desktop; on small screens
                      it moves below the canvas so the editor stays usable. */}
                  <div className="mt-6 overflow-hidden rounded-2xl border border-line bg-paper-raised lg:hidden">
                    <BlockLibrary onAdd={addBlock} />
                  </div>
                </div>
              </main>

              <aside
                aria-label={t.inspectorLabel}
                className="hidden w-80 shrink-0 border-s border-line bg-paper-raised xl:block"
              >
                {selected ? (
                  <SectionInspector
                    section={selected}
                    onChange={updateSection}
                    onDelete={() => setPendingDelete(selected)}
                    onClose={() => setSelectedId(null)}
                  />
                ) : (
                  <div className="flex flex-col items-center gap-2 px-4 py-10 text-center text-sm text-ink-soft">
                    <span className="flex size-10 items-center justify-center rounded-full bg-primary-soft text-primary">
                      <MousePointerClick className="size-5" aria-hidden />
                    </span>
                    <p>{t.selectSection}</p>
                  </div>
                )}
              </aside>
            </div>
          </div>
        </DataState>
      </div>

      {/* Below xl the panel can't sit beside the canvas, so it becomes an overlay. */}
      {selected && (
        <div
          role="dialog"
          aria-label={t.inspectorLabel}
          className="fixed inset-y-0 end-0 z-30 w-80 max-w-full border-s border-line bg-paper-raised shadow-pop xl:hidden"
        >
          <SectionInspector
            section={selected}
            onChange={updateSection}
            onDelete={() => setPendingDelete(selected)}
            onClose={() => setSelectedId(null)}
          />
        </div>
      )}

      <ConfirmDialog
        open={pendingDelete !== null}
        title={t.deleteSectionTitle}
        description={
          pendingDelete
            ? fmt(t.deleteSectionBody, { label: sectionLabel(pendingDelete, locale) })
            : undefined
        }
        confirmLabel={t.deleteSectionConfirm}
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
        title={t.deletePageTitle}
        description={
          pendingPageDelete
            ? fmt(t.deletePageBody, {
                title: pendingPageDelete.title,
                path: ltrIsolate(pendingPageDelete.path),
              })
            : undefined
        }
        confirmLabel={t.deletePageConfirm}
        destructive
        onCancel={() => setPendingPageDelete(null)}
        onConfirm={() => pendingPageDelete && deletePage(pendingPageDelete)}
      />

      <ConfirmDialog
        open={pendingSwitchId !== null}
        title={t.leaveTitle}
        description={t.leaveBody}
        confirmLabel={t.leaveConfirm}
        destructive
        onCancel={() => setPendingSwitchId(null)}
        onConfirm={() => {
          setSelectedPageId(pendingSwitchId);
          setPendingSwitchId(null);
        }}
      />
    </div>
  );
}
