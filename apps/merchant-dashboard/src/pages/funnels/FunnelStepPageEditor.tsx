import { useCallback, useState } from "react";
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
import { SortableContext, sortableKeyboardCoordinates, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { Eye, PackageCheck } from "lucide-react";
import { Button } from "@store-builder/ui";
import type { PageSection, PageTree } from "@store-builder/api-client";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { Select } from "@/components/Select";
import { StorefrontPreview } from "@/components/StorefrontPreview";
import { fmt, useLocale, useT } from "@/i18n/LocaleContext";
import { BlockLibrary } from "../website/editor/BlockLibrary";
import { SectionCard } from "../website/editor/SectionCard";
import { SectionInspector } from "../website/editor/SectionInspector";
import { createSection, moveSection, sectionLabel, type BlockPreset } from "../website/editor/blocks";
import { EditorLocaleContext } from "../website/editor/editorLocale";
import { PAGE_STRINGS, STEP_TYPE_LABELS } from "./FunnelEditorPage.strings";
import type { UiStep } from "./funnelAdapter";

/**
 * The page view of one funnel step: the website editor's block library,
 * section cards and inspector (imported, not copied — a section edits the same
 * here as on a website page), plus the storefront's own rendering of the step.
 *
 * Edits go into `step.tree` in the funnel draft, so they are saved by the
 * editor's one Save button along with the flow, and count towards "unsaved
 * changes" like any other edit. The shared editor pieces speak the merchant's
 * language through EditorLocaleContext.
 */

/** Sets `productId` on every product card that doesn't name a product yet. */
function fillProductCards(tree: PageTree, productId: string): PageTree {
  return {
    ...tree,
    sections: tree.sections.map((s) => ({
      ...s,
      rows: (s.rows ?? []).map((r) => ({
        ...r,
        columns: (r.columns ?? []).map((c) => ({
          ...c,
          elements: (c.elements ?? []).map((el) =>
            el.type === "product_card" && !(typeof el.props?.productId === "string" && el.props.productId.trim())
              ? { ...el, props: { ...el.props, productId } }
              : el
          ),
        })),
      })),
    })),
  };
}

function hasUnsetProductCard(tree: PageTree): boolean {
  return tree.sections.some((s) =>
    (s.rows ?? []).some((r) =>
      (r.columns ?? []).some((c) =>
        (c.elements ?? []).some((el) => el.type === "product_card" && !(typeof el.props?.productId === "string" && el.props.productId.trim()))
      )
    )
  );
}

export function FunnelStepPageEditor({
  workspaceId,
  steps,
  step,
  offerProduct,
  onSelectStep,
  onTreeChange,
  onBack,
}: {
  workspaceId: string;
  steps: UiStep[];
  step: UiStep;
  /** The product behind the step's offer, when it has one. */
  offerProduct: { id: string; name: string } | null;
  onSelectStep: (key: string) => void;
  onTreeChange: (tree: PageTree) => void;
  onBack: () => void;
}) {
  const t = useT(PAGE_STRINGS);
  const { locale } = useLocale();
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [pendingDelete, setPendingDelete] = useState<PageSection | null>(null);
  const [previewOpen, setPreviewOpen] = useState(false);

  // A different step is a different page: drop the section selection with it.
  const [seededKey, setSeededKey] = useState(step.key);
  if (seededKey !== step.key) {
    setSeededKey(step.key);
    setSelectedId(null);
  }

  const sections = step.tree.sections;
  const selected = sections.find((s) => s.id === selectedId) ?? null;

  const setSections = useCallback(
    (next: PageSection[]) => onTreeChange({ ...step.tree, sections: next }),
    [onTreeChange, step.tree]
  );

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const from = sections.findIndex((s) => s.id === active.id);
    const to = sections.findIndex((s) => s.id === over.id);
    setSections(moveSection(sections, from, to));
  }

  function addBlock(preset: BlockPreset) {
    const section = createSection(preset);
    setSections([...sections, section]);
    setSelectedId(section.id);
  }

  function updateSection(next: PageSection) {
    setSections(sections.map((s) => (s.id === next.id ? next : s)));
  }

  function deleteSection(section: PageSection) {
    setSections(sections.filter((s) => s.id !== section.id));
    setSelectedId((prev) => (prev === section.id ? null : prev));
    setPendingDelete(null);
  }

  const inspector = selected && (
    <SectionInspector section={selected} onChange={updateSection} onDelete={() => setPendingDelete(selected)} onClose={() => setSelectedId(null)} />
  );

  return (
    <EditorLocaleContext.Provider value={locale}>
      <div className="flex min-h-0 flex-1 flex-col overflow-y-auto lg:flex-row lg:overflow-hidden">
        <aside className="hidden w-56 shrink-0 border-e border-line bg-paper-raised lg:block">
          <BlockLibrary onAdd={addBlock} />
        </aside>

        <main className="min-w-0 flex-1 bg-paper p-4 md:p-6 lg:overflow-y-auto">
          <div className="mx-auto max-w-2xl">
            <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
              <div className="min-w-0 flex-1 space-y-1">
                <label htmlFor="page-step" className="text-xs font-semibold uppercase tracking-wide text-ink-soft">
                  {t.step}
                </label>
                <Select id="page-step" value={step.key} onChange={(e) => onSelectStep(e.target.value)} className="h-9 max-w-sm" dir="auto">
                  {steps.map((s) => (
                    <option key={s.key} value={s.key}>
                      {s.name} · {STEP_TYPE_LABELS[locale][s.type]}
                    </option>
                  ))}
                </Select>
              </div>
              <div className="flex items-center gap-2">
                <Button variant="outline" onClick={onBack}>
                  <span aria-hidden className="inline-block rtl:rotate-180">
                    ←
                  </span>
                  {t.backToFlow}
                </Button>
                <Button variant={previewOpen ? "secondary" : "outline"} aria-pressed={previewOpen} onClick={() => setPreviewOpen((o) => !o)}>
                  <Eye className="size-4" aria-hidden /> {t.preview}
                </Button>
              </div>
            </div>

            <h2 className="font-display text-lg font-semibold text-ink" dir="auto">
              {fmt(t.pageOf, { name: step.name })}
            </h2>
            <p className="mb-4 text-sm text-ink-soft">{t.pageHint}</p>

            {offerProduct && hasUnsetProductCard(step.tree) && (
              <div className="mb-4 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-primary/30 bg-primary-soft px-4 py-3">
                <p className="min-w-0 flex-1 text-sm text-primary-dark dark:text-primary" dir="auto">
                  {fmt(t.useProductHint, { product: offerProduct.name })}
                </p>
                <Button size="sm" variant="outline" onClick={() => onTreeChange(fillProductCards(step.tree, offerProduct.id))}>
                  <PackageCheck className="size-4" aria-hidden /> <span dir="auto">{fmt(t.useProduct, { product: offerProduct.name })}</span>
                </Button>
              </div>
            )}

            {sections.length === 0 ? (
              <div className="rounded-[var(--radius-card)] border border-dashed border-danger/40 bg-danger-soft/40 px-6 py-12 text-center text-sm text-ink-soft">{t.empty}</div>
            ) : (
              <DndContext sensors={sensors} collisionDetection={closestCenter} modifiers={[restrictToVerticalAxis, restrictToParentElement]} onDragEnd={handleDragEnd}>
                <SortableContext items={sections.map((s) => s.id)} strategy={verticalListSortingStrategy}>
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

            {/* The library sits in the sidebar on desktop and below the page on small screens. */}
            <div className="mt-6 rounded-[var(--radius-card)] border border-line bg-paper-raised lg:hidden">
              <BlockLibrary onAdd={addBlock} />
            </div>
          </div>
        </main>

        <aside className="hidden w-80 shrink-0 border-s border-line bg-paper-raised xl:block xl:overflow-y-auto">
          {inspector || <p className="px-4 py-6 text-sm text-ink-soft">{t.selectSection}</p>}
        </aside>
      </div>

      {/* Below xl the inspector can't sit beside the page, so it overlays. */}
      {selected && <div className="fixed inset-y-0 end-0 z-30 w-80 max-w-full border-s border-line bg-paper-raised shadow-xl xl:hidden">{inspector}</div>}

      {previewOpen && (
        <div className="fixed inset-y-0 end-0 z-40 w-full border-s border-line shadow-xl lg:w-1/2">
          <StorefrontPreview
            workspaceId={workspaceId}
            tree={step.tree}
            labels={{
              title: fmt(t.previewTitle, { name: step.name }),
              hint: t.previewHint,
              refresh: t.refresh,
              desktop: t.desktop,
              mobile: t.mobile,
              close: t.close,
              frameTitle: t.frameTitle,
            }}
            onClose={() => setPreviewOpen(false)}
          />
        </div>
      )}

      <ConfirmDialog
        open={pendingDelete !== null}
        title={t.deleteSectionTitle}
        description={pendingDelete ? fmt(t.deleteSectionDescription, { name: sectionLabel(pendingDelete, locale) }) : undefined}
        confirmLabel={t.deleteSection}
        destructive
        onCancel={() => setPendingDelete(null)}
        onConfirm={() => pendingDelete && deleteSection(pendingDelete)}
      />
    </EditorLocaleContext.Provider>
  );
}
