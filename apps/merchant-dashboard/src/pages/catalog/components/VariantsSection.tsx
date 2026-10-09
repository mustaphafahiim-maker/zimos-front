import { useEffect, useId, useRef, useState, type ReactNode } from "react";
import { Button } from "@store-builder/ui";
import type { Variant } from "@store-builder/api-client";
import { apiClient } from "@/lib/apiClient";
import { useWorkspaceId } from "@/lib/useWorkspaceId";
import { pluralOf } from "@/lib/plural";
import { useToast } from "@/components/Toast";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import type { ContextMenuItem } from "@/components/ContextMenu";
import { IconArchive, IconEdit, IconPlus, IconTable, IconTag, IconUndo } from "@/components/icons";
import { useT, fmt } from "@/i18n/LocaleContext";
import { useErrorMessage } from "@/lib/errorMessages";
import { SectionFrame } from "../media/SectionFrame";
import { DESKTOP_QUERY, useMediaQuery } from "../media/useMediaQuery";
import { useOffersBulkTable } from "../variants/bulkEntry";
import { FormSheet } from "../variants/FormSheet";
import { useVariantEdits } from "../variants/useVariantEdits";
import { useWideEnough } from "../variants/useWideEnough";
import { VariantCards } from "../variants/VariantCards";
import { VariantGrid } from "../variants/VariantGrid";
import type { VariantRow } from "../variants/variantRow";
import { VARIANT_STRINGS } from "../variants/variantStrings";
import { variantName } from "../variants/variantValues";
import { VariantBulkSheet } from "./VariantBulkEditor";
import { VariantForm } from "./VariantForm";
import { useNotTrackedLabel } from "./TrackQuantityField";
import { useRestockBadge } from "./WaitingRestockCard";

interface Props {
  productId: string;
  variants: Variant[];
  onChanged: () => void;
  /** False for a product whose quantity is not tracked: no stock to show or ask for. */
  tracked?: boolean;
  /** A warning about the SKUs, shown above the list and under the SKU when editing (handoff 181). */
  skuNote?: ReactNode;
  /** Without the card and its heading — for a caller that draws both itself. */
  embedded?: boolean;
}

/** Under this width the section has no room for the grid's columns: the variants are cards. */
const GRID_MIN_WIDTH = 600;

/**
 * The product's variants as a grid edited in place: a row each — what it is,
 * price, price before discount, SKU, stock, on sale or not — and every figure
 * pressed and changed where it stands, with «تراجع» on the toast. On a phone
 * (and wherever the section is narrow) the rows are cards with the same
 * figures.
 *
 * What it calls did not change: price, price before discount, SKU and status
 * go through `updateVariant`; stock through the bulk endpoint, as the table
 * sheet sends it (useVariantEdits). «ضيف متغير» and a row's «عدّل كل حاجة» open
 * the variant form in a sheet; «أرشف المتغير…» asks once and can be undone;
 * «عدّل الكل في جدول» opens every variant in one table (VariantBulkSheet).
 */
export function VariantsSection({ productId, variants, onChanged, tracked = true, skuNote, embedded = false }: Props) {
  const notTracked = useNotTrackedLabel();
  const t = useT(VARIANT_STRINGS);
  const errorMessage = useErrorMessage();
  const workspaceId = useWorkspaceId();
  const toast = useToast();
  const restockBadge = useRestockBadge();
  const edits = useVariantEdits(productId, onChanged);
  const formId = useId();

  /** The variant in the form sheet (null: a new one). It stays set while the sheet closes, so the sheet keeps its words on the way out. */
  const [form, setForm] = useState<{ variant: Variant | null; turn: number }>({ variant: null, turn: 0 });
  const [formOpen, setFormOpen] = useState(false);
  const [formSaving, setFormSaving] = useState(false);
  const [bulkOpen, setBulkOpen] = useState(false);
  /** The variant the archive question is about; kept while the question closes. */
  const [archiving, setArchiving] = useState<Variant | null>(null);
  const [archiveOpen, setArchiveOpen] = useState(false);

  // «تراجع» is pressed seconds later: it reloads through the page's latest callback.
  const reload = useRef(onChanged);
  useEffect(() => {
    reload.current = onChanged;
  });

  // The stand-alone «عدّل كل المتغيرات في جدول» button steps aside while this head offers the table.
  useOffersBulkTable(productId, variants.length > 0);

  // A grid where its columns fit, cards where they do not: decided by the room the section really has.
  const bigScreen = useMediaQuery(DESKTOP_QUERY, false);
  const [listRef, roomy] = useWideEnough<HTMLDivElement>(GRID_MIN_WIDTH, bigScreen);

  function openForm(variant: Variant | null) {
    setForm((current) => ({ variant, turn: current.turn + 1 }));
    setFormSaving(false);
    setFormOpen(true);
  }

  async function restore(variant: Variant) {
    try {
      await edits.status(variant, "active");
      toast.success(t.statusNowActive);
    } catch (err) {
      toast.error(fmt(t.statusFailed, { reason: errorMessage(err) }));
    }
  }

  async function confirmArchive() {
    const variant = archiving;
    if (!variant) return;
    try {
      await apiClient.deleteVariant(workspaceId, variant.id);
    } catch (err) {
      throw new Error(errorMessage(err));
    }
    setArchiveOpen(false);
    onChanged();
    // Archived, not removed — and a variant's status can be set back to active, so this can be taken back.
    toast.undo(t.archivedToast, async () => {
      await apiClient.updateVariant(workspaceId, variant.id, { status: "active" });
      reload.current();
    });
  }

  function menuFor(variant: Variant): ContextMenuItem[] {
    const items: ContextMenuItem[] = [{ id: "edit", label: t.editEverything, icon: IconEdit, onSelect: () => openForm(variant) }];
    if (variant.status === "active") {
      items.push({
        id: "archive",
        label: t.archive,
        icon: IconArchive,
        destructive: true,
        separatorBefore: true,
        onSelect: () => {
          setArchiving(variant);
          setArchiveOpen(true);
        },
      });
    } else {
      items.push({ id: "restore", label: t.restore, icon: IconUndo, onSelect: () => void restore(variant) });
    }
    return items;
  }

  const rows: VariantRow[] = variants.map((variant) => {
    const name = variantName(variant, t.single);
    return { variant, name, badge: restockBadge(variant), menu: menuFor(variant), menuLabel: fmt(t.menu, { name }) };
  });

  const editing = form.variant;

  return (
    <SectionFrame
      title={t.title}
      description={t.description}
      badge={variants.length > 0 ? <span className="text-sm font-normal text-ink-soft">{pluralOf(t, "count", variants.length)}</span> : undefined}
      embedded={embedded}
      actions={
        <>
          {variants.length > 0 && (
            <Button type="button" variant="outline" className="min-h-11 rounded-full px-4 md:min-h-9" onClick={() => setBulkOpen(true)}>
              <IconTable className="size-4" aria-hidden />
              {t.editAll}
            </Button>
          )}
          <Button type="button" className="min-h-11 rounded-full px-4 md:min-h-9" onClick={() => openForm(null)}>
            <IconPlus className="size-4" weight="bold" aria-hidden />
            {t.add}
          </Button>
        </>
      }
    >
      {skuNote && variants.length > 0 && <div className="mb-4">{skuNote}</div>}
      {!tracked && variants.length > 0 && (
        <p className="mb-3 text-[13px] leading-5 text-ink-soft">{fmt(t.notTrackedNote, { state: notTracked })}</p>
      )}

      <div ref={listRef} data-slot="variants" className="min-w-0">
        {variants.length === 0 ? (
          <div className="zimos-variant-empty flex flex-col items-center gap-2 rounded-[1.25rem] border border-dashed border-line-strong px-4 py-8 text-center">
            <IconTag className="size-10 text-ink-soft" weight="duotone" aria-hidden />
            <p className="max-w-sm text-sm leading-6 text-ink-soft">{t.empty}</p>
          </div>
        ) : roomy ? (
          <VariantGrid rows={rows} tracked={tracked} edits={edits} />
        ) : (
          <VariantCards rows={rows} tracked={tracked} edits={edits} />
        )}
      </div>

      <FormSheet
        open={formOpen}
        onClose={() => setFormOpen(false)}
        title={editing ? t.editTitle : t.addTitle}
        description={editing ? variantName(editing, t.single) : undefined}
        size="md"
        locked={formSaving}
        footer={
          <>
            <Button type="button" variant="outline" className="rounded-full px-5" disabled={formSaving} onClick={() => setFormOpen(false)}>
              {t.cancel}
            </Button>
            <Button type="submit" form={formId} className="rounded-full px-5" disabled={formSaving}>
              {formSaving ? t.sheetSaving : editing ? t.sheetSave : t.sheetAdd}
            </Button>
          </>
        }
      >
        <VariantForm
          key={form.turn}
          productId={productId}
          tracked={tracked}
          variant={editing ?? undefined}
          skuNote={editing ? skuNote : undefined}
          formId={formId}
          hideActions
          onSavingChange={setFormSaving}
          onCancel={() => setFormOpen(false)}
          onDone={() => {
            setFormOpen(false);
            toast.success(editing ? t.savedToast : t.addedToast);
            onChanged();
          }}
        />
      </FormSheet>

      <VariantBulkSheet
        open={bulkOpen}
        onClose={() => setBulkOpen(false)}
        productId={productId}
        variants={variants}
        skuNote={skuNote}
        onSaved={() => {
          setBulkOpen(false);
          onChanged();
        }}
      />

      <ConfirmDialog
        open={archiveOpen}
        title={t.deleteTitle}
        description={t.deleteDescription}
        confirmLabel={t.deleteConfirm}
        busyLabel={t.working}
        cancelLabel={t.cancel}
        destructive
        onCancel={() => setArchiveOpen(false)}
        onConfirm={confirmArchive}
      >
        {archiving && (
          <p className="text-sm font-medium text-ink">
            <bdi>{variantName(archiving, t.single)}</bdi>
          </p>
        )}
      </ConfirmDialog>
    </SectionFrame>
  );
}
