import { catalogCollectionFlags, isSmartCollection } from "@store-builder/api-client";
import { CollectionVisibilityFields } from "./components/CollectionVisibilityFields";
import {
  CollectionsEmpty,
  SmartCollectionBadge,
  SmartCollectionFields,
  SmartCollectionNote,
  smartDraftOf,
  smartDraftReady,
  smartRulesChanged,
  smartRulesOf,
} from "./components/SmartCollectionFields";
import { CollectionSeoFields, collectionSeoOf, collectionSeoPayload, downloadCollectionsCsv } from "./components/CollectionSeoFields";
import { storeUrl } from "@/lib/storeAddress";
import { useWorkspace } from "@/context/WorkspaceContext";
import { useId, useMemo, useRef, useState, type FormEvent } from "react";
import {
  DndContext,
  KeyboardSensor,
  PointerSensor,
  closestCenter,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragMoveEvent,
  type DragStartEvent,
} from "@dnd-kit/core";
import { SortableContext, sortableKeyboardCoordinates, useSortable, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import {
  IconArrowDown,
  IconArrowUp,
  IconDelete,
  IconDownload,
  IconDragHandle,
  IconEdit,
  IconExternal,
  IconFolder,
  IconIndent,
  IconListNumbers,
  IconOutdent,
  IconPlus,
} from "@/components/icons";
import { Alert, Button, cn } from "@store-builder/ui";
import type { CollectionDetail, CollectionSummary, CreateCollectionPayload } from "@store-builder/api-client";
import { apiClient } from "@/lib/apiClient";
import { useWorkspaceId } from "@/lib/useWorkspaceId";
import { useAsync } from "@/lib/useAsync";
import { getFieldErrors } from "@/lib/errors";
import { useErrorMessage } from "@/lib/errorMessages";
import { pluralOf } from "@/lib/plural";
import { useLocale, useT, fmt, type Messages } from "@/i18n/LocaleContext";
import { useCatalogLabels } from "./catalogLabels";
import { PageHeader } from "@/components/PageHeader";
import { DataState, SkeletonBar } from "@/components/DataState";
import { Modal } from "@/components/Modal";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { ContextMenu, type ContextMenuItem } from "@/components/ContextMenu";
import { ViewLink } from "@/components/ViewLink";
import { ListSkeleton } from "@/components/list";
import { TextField, Field } from "@/components/Field";
import { Textarea } from "@/components/Textarea";
import { Select } from "@/components/Select";
import { useToast } from "@/components/Toast";
import { ImageField } from "@/pages/website/editor/ImageField";
import { ItemMenu } from "./media/ItemMenu";
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
  subtreeRange,
  type FlatNode,
} from "./collectionTree";

/** Pixels per level, on screen and for the sideways pull while dragging. */
const INDENT = 28;

const STRINGS = {
  en: {
    title: "Collections",
    products: "Products",
    description: "How your store groups products, up to three levels deep. Drag a collection to reorder it; pull it sideways to put it inside the one above.",
    newCollection: "New collection",
    empty: "No collections yet. Create your first one.",
    noProducts: "No products in this collection yet.",
    productCount_one: "1 product",
    productCount_other: "{n} products",
    reorder: "Reorder {name}",
    moveUp: "Move {name} up",
    moveDown: "Move {name} down",
    indent: "Put {name} inside the collection above",
    outdent: "Move {name} out one level",
    orderProducts: "Order the products in {name}",
    preview: "Open {name} in the store",
    sub_one: "1 subcategory",
    sub_other: "{n} subcategories",
    inHeader: "In header",
    hiddenBadge: "Hidden",
    exportCsv: "Export as a sheet",
    more: "More",
    rowMenu: "Actions for {name}",
    menuEdit: "Edit",
    menuOrder: "Order its products",
    menuPreview: "Open in the store",
    menuUp: "Move up",
    menuDown: "Move down",
    menuIndent: "Put inside the one above",
    menuOutdent: "Move out one level",
    menuDelete: "Delete",
    edit: "Edit {name}",
    editTitle: "Edit collection",
    deleteTitle: "Delete “{name}”?",
    deleteDescription:
      "A collection is only a storefront grouping — deleting it is permanent, but the products in it are not affected. Collections inside it move up to the top level.",
    deleteConfirm: "Delete collection",
    deleting: "Deleting…",
    deletedToast: "“{name}” deleted. Products themselves are untouched.",
    name: "Name",
    namePlaceholder: "Summer",
    nameRequired: "Give the collection a name.",
    descriptionLabel: "Description",
    descriptionPlaceholder: "Warm-weather picks",
    parent: "Inside",
    topLevel: "Top level",
    parentHint: "Collections can be nested up to three levels deep.",
    image: "Image",
    cancel: "Cancel",
    saving: "Saving…",
    save: "Save",
    create: "Create",
    savedToast: "Collection saved.",
    createdToast: "“{name}” created.",
    orderSaved: "New order saved.",
    orderTitle: "Order of products in “{name}”",
    orderDescription: "The storefront lists this collection's products in this order when sorted by “Featured”.",
    moveProductUp: "Move {name} up",
    moveProductDown: "Move {name} down",
    reorderProduct: "Reorder {name}",
    saveOrder: "Save order",
    loadingProducts: "Loading the products…",
    dragStart: "Picked up {name}. Use the arrow keys to move it, Space to drop, Escape to cancel.",
    dragOver: "{name} is over {over}.",
    dragEnd: "{name} dropped.",
    dragCancel: "Move cancelled.",
    instructions:
      "To pick up a collection, press Space or Enter. Move it with the up and down arrow keys, press Space or Enter again to drop it, or Escape to cancel.",
  },
  ar: {
    title: "المجموعات",
    products: "المنتجات",
    description: "طريقة تقسيم المنتجات في متجرك، لحد تلات مستويات. اسحب المجموعة عشان ترتّبها، واسحبها على الجنب عشان تحطها جوه اللي فوقها.",
    newCollection: "مجموعة جديدة",
    empty: "مفيش مجموعات لسه. اعمل أول مجموعة.",
    noProducts: "مفيش منتجات في المجموعة دي لسه.",
    productCount_one: "منتج واحد",
    productCount_two: "منتجين",
    productCount_few: "{n} منتجات",
    productCount_other: "{n} منتج",
    reorder: "رتّب {name}",
    moveUp: "طلّع {name} لفوق",
    moveDown: "نزّل {name} لتحت",
    indent: "حط {name} جوه المجموعة اللي فوقها",
    outdent: "طلّع {name} مستوى لبرّه",
    orderProducts: "رتّب منتجات {name}",
    preview: "افتح {name} في المتجر",
    sub_one: "مجموعة فرعية واحدة",
    sub_two: "مجموعتين فرعيتين",
    sub_few: "{n} مجموعات فرعية",
    sub_other: "{n} مجموعة فرعية",
    inHeader: "في الهيدر",
    hiddenBadge: "مخفية",
    exportCsv: "نزّلها شيت",
    more: "كمان",
    rowMenu: "إجراءات {name}",
    menuEdit: "عدّل",
    menuOrder: "رتّب منتجاتها",
    menuPreview: "افتحها في المتجر",
    menuUp: "طلّعها لفوق",
    menuDown: "نزّلها لتحت",
    menuIndent: "حطها جوه اللي فوقها",
    menuOutdent: "طلّعها مستوى لبرّه",
    menuDelete: "امسح",
    edit: "عدّل {name}",
    editTitle: "تعديل المجموعة",
    deleteTitle: "تمسح «{name}»؟",
    deleteDescription:
      "المجموعة مجرد تقسيمة في المتجر — المسح نهائي، بس المنتجات اللي جواها مش هتتأثر. والمجموعات اللي جواها هتطلع للمستوى الأول.",
    deleteConfirm: "امسح المجموعة",
    deleting: "بنمسح…",
    deletedToast: "اتمسحت «{name}». المنتجات نفسها زي ما هي.",
    name: "الاسم",
    namePlaceholder: "الصيف",
    nameRequired: "اكتب اسم للمجموعة.",
    descriptionLabel: "الوصف",
    descriptionPlaceholder: "اختيارات للجو الحر",
    parent: "جوه",
    topLevel: "المستوى الأول",
    parentHint: "تقدر تحط المجموعات جوه بعض لحد تلات مستويات.",
    image: "الصورة",
    cancel: "إلغاء",
    saving: "بنحفظ…",
    save: "حفظ",
    create: "اعمل المجموعة",
    savedToast: "المجموعة اتحفظت.",
    createdToast: "اتعملت «{name}».",
    orderSaved: "الترتيب الجديد اتحفظ.",
    orderTitle: "ترتيب المنتجات في «{name}»",
    orderDescription: "المتجر بيعرض منتجات المجموعة دي بالترتيب ده لما العميل يرتّب بـ «المميزة».",
    moveProductUp: "طلّع {name} لفوق",
    moveProductDown: "نزّل {name} لتحت",
    reorderProduct: "رتّب {name}",
    saveOrder: "احفظ الترتيب",
    loadingProducts: "بنحمّل المنتجات…",
    dragStart: "مسكت {name}. حرّكها بالأسهم، ودوس مسافة عشان تسيبها، أو Escape عشان تلغي.",
    dragOver: "{name} فوق {over}.",
    dragEnd: "سبت {name}.",
    dragCancel: "النقل اتلغى.",
    instructions:
      "عشان تمسك مجموعة دوس مسافة أو Enter. حرّكها بسهم فوق وتحت، ودوس مسافة أو Enter تاني عشان تسيبها، أو Escape عشان تلغي.",
  },
} satisfies Messages;

type Strings = Record<keyof typeof STRINGS.en, string>;

// A tool of a row: 44px under a thumb, 40px with a mouse, round like every other small control.
const iconButton =
  "inline-flex size-11 shrink-0 cursor-pointer items-center justify-center rounded-full text-ink-soft transition-[color,background-color,scale] duration-[var(--dur-fade)] ease-[var(--ease-out)] hover:bg-paper-sunken hover:text-ink focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary active:scale-[0.97] disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:bg-transparent disabled:active:scale-100 motion-reduce:transition-none motion-reduce:active:scale-100 pointer-fine:size-10";

function productCount(t: Strings, n: number | undefined) {
  if (n === undefined) return null;
  return pluralOf(t, "productCount", n);
}

/** The parents a collection may move under: not itself, not inside itself, and within three levels. */
function parentChoices(flat: FlatNode<CollectionSummary>[], editingId: string | null) {
  let blocked = new Set<string>();
  let height = 0;
  if (editingId) {
    const index = flat.findIndex((n) => n.item.id === editingId);
    if (index >= 0) {
      const [start, end] = subtreeRange(flat, index);
      blocked = new Set(flat.slice(start, end).map((n) => n.item.id));
      for (let i = start; i < end; i += 1) height = Math.max(height, flat[i].depth - flat[start].depth);
    }
  }
  return flat.filter((n) => !blocked.has(n.item.id) && n.depth + 1 + height <= MAX_DEPTH - 1);
}

/** The tree as it stands once a move is saved: every row's own record takes the parent and place it is drawn at. */
function settled(flat: FlatNode<CollectionSummary>[]): FlatNode<CollectionSummary>[] {
  const counters = new Map<string | null, number>();
  return flat.map((node) => {
    const position = counters.get(node.parentId) ?? 0;
    counters.set(node.parentId, position + 1);
    if (node.item.parentId === node.parentId && node.item.position === position) return node;
    return { ...node, item: { ...node.item, parentId: node.parentId, position } };
  });
}

/** Create or edit one collection, in the dashboard's sheet: the fields scroll, the two buttons stay under a thumb. */
function CollectionDialog({
  open,
  collection,
  flat,
  onDone,
  onClose,
}: {
  open: boolean;
  collection?: CollectionSummary;
  flat: FlatNode<CollectionSummary>[];
  onDone: () => void;
  onClose: () => void;
}) {
  const t = useT(STRINGS);
  const errorMessage = useErrorMessage();
  const workspaceId = useWorkspaceId();
  const toast = useToast();
  const formId = useId();
  const nameBox = useRef<HTMLDivElement>(null);
  const [name, setName] = useState(collection?.name ?? "");
  const [description, setDescription] = useState(collection?.description ?? "");
  const [parentId, setParentId] = useState(collection?.parentId ?? "");
  const [imageUrl, setImageUrl] = useState(collection?.imageUrl ?? "");
  // Header menu / hidden (components/CollectionVisibilityFields).
  const [flags, setFlags] = useState(() => catalogCollectionFlags(collection));
  // Search engines and sharing (SPEC §8.9), same keys as a product's.
  const [seo, setSeo] = useState(() => collectionSeoOf(collection));
  // Manual, automatic by tags, or every product (components/SmartCollectionFields).
  const [smart, setSmart] = useState(() => smartDraftOf(collection));
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const choices = useMemo(() => parentChoices(flat, collection?.id ?? null), [flat, collection?.id]);

  function focusName() {
    const input = nameBox.current?.querySelector("input");
    nameBox.current?.scrollIntoView({ block: "center" });
    input?.focus({ preventScroll: true });
  }

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (saving) return;
    setFormError(null);
    if (name.trim().length === 0) {
      setFieldErrors({ name: t.nameRequired });
      focusName();
      return;
    }
    setSaving(true);
    setFieldErrors({});
    const payload: CreateCollectionPayload = {
      name: name.trim(),
      description: description.trim(),
      imageUrl: imageUrl || null,
      ...{ showInHeader: flags.showInHeader && !flags.hidden, hidden: flags.hidden },
      seo: collectionSeoPayload(collection, seo),
    };
    // Sent only when it changed, so an edit never moves a collection by accident.
    if (!collection || (collection.parentId ?? "") !== parentId) payload.parentId = parentId || null;
    // Rules only when they changed: saving them re-fills the collection.
    if (smartRulesChanged(collection, smart)) payload.rules = smartRulesOf(smart);
    try {
      if (collection) {
        await apiClient.updateCollection(workspaceId, collection.id, payload);
        toast.success(t.savedToast);
      } else {
        await apiClient.createCollection(workspaceId, payload);
        toast.success(fmt(t.createdToast, { name: payload.name }));
      }
      onDone();
    } catch (err) {
      const fields = getFieldErrors(err);
      setFieldErrors(fields);
      if (Object.keys(fields).length === 0 || fields.parentId) setFormError(errorMessage(err));
      if (fields.name) focusName();
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={collection ? t.editTitle : t.newCollection}
      footer={
        <>
          <Button type="button" variant="outline" onClick={onClose} disabled={saving} className="min-h-11 rounded-full px-5">
            {t.cancel}
          </Button>
          <Button type="submit" form={formId} disabled={saving || !smartDraftReady(smart)} className="min-h-11 rounded-full px-5">
            {saving ? t.saving : collection ? t.save : t.create}
          </Button>
        </>
      }
    >
      <form id={formId} onSubmit={submit} noValidate className="space-y-4">
        {formError && <Alert variant="danger">{formError}</Alert>}
        <div ref={nameBox}>
          <TextField
            label={t.name}
            required
            value={name}
            onChange={(e) => {
              setName(e.target.value);
              if (fieldErrors.name) setFieldErrors((prev) => ({ ...prev, name: "" }));
            }}
            error={fieldErrors.name || undefined}
            placeholder={t.namePlaceholder}
            className="[&_input]:h-11"
          />
        </div>
        <Field label={t.parent} hint={t.parentHint} error={fieldErrors.parentId}>
          {({ id }) => (
            <Select id={id} value={parentId} onChange={(e) => setParentId(e.target.value)} className="h-11">
              <option value="">{t.topLevel}</option>
              {choices.map((n) => (
                <option key={n.item.id} value={n.item.id}>
                  {`${"— ".repeat(n.depth)}${n.item.name}`}
                </option>
              ))}
            </Select>
          )}
        </Field>
        <SmartCollectionFields value={smart} onChange={setSmart} disabled={saving} error={fieldErrors.rules} />
        <Field label={t.descriptionLabel} error={fieldErrors.description}>
          {({ id }) => (
            <Textarea
              id={id}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder={t.descriptionPlaceholder}
            />
          )}
        </Field>
        <ImageField label={t.image} value={imageUrl} onChange={setImageUrl} />
        <CollectionVisibilityFields value={flags} onChange={setFlags} disabled={saving} />
        <CollectionSeoFields value={seo} onChange={setSeo} placeholderTitle={name || t.namePlaceholder} disabled={saving} />
      </form>
    </Modal>
  );
}

/**
 * One row of the tree: the drag handle, then the collection itself — a press
 * on it opens the edit sheet — and its tools. With a mouse the four moves and
 * "order its products" stand in the row; on a phone the row keeps to one line
 * and everything is in its «…» menu, which is also what a right-click or a
 * long press gives.
 */
function CollectionRow({
  node,
  depth,
  flat,
  index,
  busy,
  onMove,
  onOrderProducts,
  onEdit,
  onDelete,
}: {
  node: FlatNode<CollectionSummary>;
  depth: number;
  flat: FlatNode<CollectionSummary>[];
  index: number;
  busy: boolean;
  onMove: (next: FlatNode<CollectionSummary>[]) => void;
  onOrderProducts: () => void;
  onEdit: () => void;
  onDelete: () => void;
}) {
  const t = useT(STRINGS);
  const { attributes, listeners, setNodeRef, setActivatorNodeRef, transform, transition, isDragging } = useSortable({
    id: node.item.id,
  });
  const c = node.item;
  const label = (key: keyof Strings) => fmt(t[key], { name: c.name });
  const count = productCount(t, c.productCount);
  const children = flat.filter((n) => n.item.parentId === c.id).length;
  const rowFlags = catalogCollectionFlags(c);
  const { currentWorkspace } = useWorkspace();
  const previewHref = currentWorkspace?.slug ? `${storeUrl(currentWorkspace.slug)}/products?collection=${encodeURIComponent(c.slug)}` : null;

  const up = !busy && canMoveUp(flat, index);
  const down = !busy && canMoveDown(flat, index);
  const inside = !busy && canIndent(flat, index);
  const outside = !busy && canOutdent(flat, index);

  const menu: ContextMenuItem[] = [
    { id: "edit", label: t.menuEdit, icon: IconEdit, onSelect: onEdit },
    { id: "order", label: t.menuOrder, icon: IconListNumbers, onSelect: onOrderProducts },
    ...(previewHref
      ? [
          {
            id: "preview",
            label: t.menuPreview,
            icon: IconExternal,
            onSelect: () => {
              window.open(previewHref, "_blank", "noopener,noreferrer");
            },
          },
        ]
      : []),
    { id: "up", label: t.menuUp, icon: IconArrowUp, separatorBefore: true, disabled: !up, onSelect: () => onMove(moveAmongSiblings(flat, index, -1)) },
    { id: "down", label: t.menuDown, icon: IconArrowDown, disabled: !down, onSelect: () => onMove(moveAmongSiblings(flat, index, 1)) },
    { id: "indent", label: t.menuIndent, icon: IconIndent, disabled: !inside, onSelect: () => onMove(indent(flat, index)) },
    { id: "outdent", label: t.menuOutdent, icon: IconOutdent, disabled: !outside, onSelect: () => onMove(outdent(flat, index)) },
    { id: "delete", label: t.menuDelete, icon: IconDelete, destructive: true, separatorBefore: true, onSelect: onDelete },
  ];

  return (
    <li
      ref={setNodeRef}
      // Rows only slide up and down; the sideways pull is read, not drawn.
      style={{ transform: CSS.Translate.toString(transform ? { ...transform, x: 0 } : null), transition }}
      className={cn("list-none", isDragging && "relative z-10")}
    >
      <ContextMenu items={menu} label={label("rowMenu")}>
        <div
          data-slot="collection-row"
          data-dragging={isDragging ? "" : undefined}
          className={cn(
            "zimos-collection-row flex min-h-[3.75rem] items-center gap-0.5 rounded-[1.125rem] bg-paper-raised py-1 ps-0.5 pe-1 ring-1",
            isDragging ? "shadow-[var(--shadow-raised)] ring-2 ring-primary" : "ring-line"
          )}
          style={{ marginInlineStart: depth * INDENT }}
        >
          <button
            type="button"
            ref={setActivatorNodeRef}
            {...attributes}
            {...listeners}
            aria-label={label("reorder")}
            className={cn(iconButton, "cursor-grab touch-none active:cursor-grabbing")}
          >
            <IconDragHandle className="size-5" aria-hidden />
          </button>
          <button
            type="button"
            onClick={onEdit}
            aria-label={label("edit")}
            className="flex min-h-11 min-w-0 flex-1 cursor-pointer items-center gap-3 rounded-[0.875rem] py-1 pe-2 text-start transition-[scale] duration-[var(--dur-fade)] ease-[var(--ease-out)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary active:scale-[0.99] motion-reduce:transition-none motion-reduce:active:scale-100"
          >
            {c.imageUrl ? (
              <img src={c.imageUrl} alt="" loading="lazy" className="size-10 shrink-0 rounded-[0.625rem] object-cover ring-1 ring-line" />
            ) : (
              <span className="flex size-10 shrink-0 items-center justify-center rounded-[0.625rem] bg-primary-soft text-primary" aria-hidden>
                <IconFolder className="size-5" weight="duotone" />
              </span>
            )}
            <span className="block min-w-0 flex-1">
              <span className="flex min-w-0 flex-wrap items-center gap-x-1.5 gap-y-1">
                <span className="min-w-0 truncate font-medium text-ink">{c.name}</span>
                {isSmartCollection(c) && <SmartCollectionBadge />}
                {rowFlags.showInHeader && (
                  <span className="shrink-0 rounded-full bg-primary-soft px-2 py-0.5 text-[11px] font-medium text-primary">{t.inHeader}</span>
                )}
                {rowFlags.hidden && (
                  <span className="shrink-0 rounded-full bg-paper-sunken px-2 py-0.5 text-[11px] font-medium text-ink-soft">{t.hiddenBadge}</span>
                )}
              </span>
              <span className="block truncate text-xs text-ink-soft tabular-nums">
                <bdi dir="ltr">{c.slug}</bdi>
                {count && <> · {count}</>}
                {children > 0 && <> · {pluralOf(t, "sub", children)}</>}
              </span>
            </span>
          </button>
          {/* From md up: the moves stand in the row. On a phone they are in the menu, so the row keeps to one line. */}
          <div className="flex shrink-0 items-center max-md:hidden">
            <button type="button" className={iconButton} aria-label={label("moveUp")} title={label("moveUp")}
              disabled={!up} onClick={() => onMove(moveAmongSiblings(flat, index, -1))}>
              <IconArrowUp className="size-4" aria-hidden />
            </button>
            <button type="button" className={iconButton} aria-label={label("moveDown")} title={label("moveDown")}
              disabled={!down} onClick={() => onMove(moveAmongSiblings(flat, index, 1))}>
              <IconArrowDown className="size-4" aria-hidden />
            </button>
            <button type="button" className={iconButton} aria-label={label("indent")} title={label("indent")}
              disabled={!inside} onClick={() => onMove(indent(flat, index))}>
              <IconIndent className="size-4 rtl:-scale-x-100" aria-hidden />
            </button>
            <button type="button" className={iconButton} aria-label={label("outdent")} title={label("outdent")}
              disabled={!outside} onClick={() => onMove(outdent(flat, index))}>
              <IconOutdent className="size-4 rtl:-scale-x-100" aria-hidden />
            </button>
            <button type="button" className={iconButton} aria-label={label("orderProducts")} title={label("orderProducts")}
              onClick={onOrderProducts}>
              <IconListNumbers className="size-4" aria-hidden />
            </button>
          </div>
          <ItemMenu items={menu} label={label("rowMenu")} />
        </div>
      </ContextMenu>
    </li>
  );
}

/** One product in the ordering dialog. */
function ProductOrderRow({
  product,
  index,
  total,
  onMove,
}: {
  product: CollectionDetail["products"][number];
  index: number;
  total: number;
  onMove: (from: number, to: number) => void;
}) {
  const t = useT(STRINGS);
  const labels = useCatalogLabels();
  const { attributes, listeners, setNodeRef, setActivatorNodeRef, transform, transition, isDragging } = useSortable({
    id: product.id,
  });
  const label = (key: keyof Strings) => fmt(t[key], { name: product.name });
  return (
    <li
      ref={setNodeRef}
      style={{ transform: CSS.Translate.toString(transform ? { ...transform, x: 0 } : null), transition }}
      data-slot="collection-row"
      className={cn(
        "zimos-collection-row flex items-center gap-0.5 rounded-[1rem] bg-paper-raised py-1 ps-0.5 pe-1 ring-1",
        isDragging ? "relative z-10 shadow-[var(--shadow-raised)] ring-2 ring-primary" : "ring-line"
      )}
    >
      <button type="button" ref={setActivatorNodeRef} {...attributes} {...listeners} aria-label={label("reorderProduct")}
        className={cn(iconButton, "cursor-grab touch-none active:cursor-grabbing")}>
        <IconDragHandle className="size-5" aria-hidden />
      </button>
      <span className="w-6 shrink-0 text-center text-xs tabular-nums text-ink-soft">
        <bdi dir="ltr">{fmt("{n}", { n: index + 1 })}</bdi>
      </span>
      <div className="min-w-0 flex-1 px-1">
        <ViewLink
          to={`/catalog/${product.id}`}
          className="block truncate rounded-sm text-sm font-medium text-ink hover:text-primary focus-visible:outline-2 focus-visible:outline-primary"
        >
          {product.name}
        </ViewLink>
        <p className="text-xs text-ink-soft">{labels.status(product.status)}</p>
      </div>
      <button type="button" className={iconButton} aria-label={label("moveProductUp")} disabled={index === 0}
        onClick={() => onMove(index, index - 1)}>
        <IconArrowUp className="size-4" aria-hidden />
      </button>
      <button type="button" className={iconButton} aria-label={label("moveProductDown")} disabled={index === total - 1}
        onClick={() => onMove(index, index + 1)}>
        <IconArrowDown className="size-4" aria-hidden />
      </button>
    </li>
  );
}

/** The rows of the ordering dialog while its products load: the same height, so nothing jumps. */
function ProductOrderSkeleton() {
  const t = useT(STRINGS);
  return (
    <div role="status" aria-busy="true" className="space-y-1.5">
      <span className="sr-only">{t.loadingProducts}</span>
      {["w-2/5", "w-1/2", "w-1/3", "w-3/5"].map((width) => (
        <div key={width} aria-hidden className="flex h-[3.25rem] items-center gap-3 rounded-[1rem] bg-paper-raised px-4 ring-1 ring-line">
          <SkeletonBar className="size-4 shrink-0" />
          <SkeletonBar className={cn("h-3", width)} />
        </div>
      ))}
    </div>
  );
}

function ProductOrderDialog({ collection, onClose }: { collection: CollectionSummary; onClose: () => void }) {
  const t = useT(STRINGS);
  const workspaceId = useWorkspaceId();
  const toast = useToast();
  const errorMessage = useErrorMessage();
  const detail = useAsync(() => apiClient.getCollection(workspaceId, collection.id), [workspaceId, collection.id]);
  const [order, setOrder] = useState<CollectionDetail["products"] | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const products = order ?? detail.data?.products ?? [];
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  function move(from: number, to: number) {
    if (to < 0 || to >= products.length) return;
    const next = [...products];
    const [row] = next.splice(from, 1);
    next.splice(to, 0, row);
    setOrder(next);
  }

  function onDragEnd({ active, over }: DragEndEvent) {
    if (!over || active.id === over.id) return;
    move(
      products.findIndex((p) => p.id === active.id),
      products.findIndex((p) => p.id === over.id)
    );
  }

  async function save() {
    setSaving(true);
    setError(null);
    try {
      await apiClient.reorderCollectionProducts(
        workspaceId,
        collection.id,
        products.map((p) => p.id)
      );
      toast.success(t.orderSaved);
      onClose();
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal
      open
      onClose={onClose}
      title={fmt(t.orderTitle, { name: collection.name })}
      description={t.orderDescription}
      footer={
        <>
          <Button variant="outline" onClick={onClose} disabled={saving} className="min-h-11 rounded-full px-5">
            {t.cancel}
          </Button>
          <Button onClick={save} disabled={saving || order === null || products.length === 0} className="min-h-11 rounded-full px-5">
            {saving ? t.saving : t.saveOrder}
          </Button>
        </>
      }
    >
      {error && <Alert variant="danger" className="mb-3">{error}</Alert>}
      <SmartCollectionNote
        collection={detail.data ?? collection}
        onSynced={() => {
          setOrder(null);
          detail.refresh({ silent: true });
        }}
      />
      {detail.loading ? (
        <ProductOrderSkeleton />
      ) : detail.error ? (
        <Alert variant="danger">
          <p>{errorMessage(detail.error)}</p>
        </Alert>
      ) : products.length === 0 ? (
        <p className="rounded-[1rem] bg-paper-sunken/60 px-4 py-6 text-center text-sm text-ink-soft">{t.noProducts}</p>
      ) : (
        <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onDragEnd}>
          <SortableContext items={products.map((p) => p.id)} strategy={verticalListSortingStrategy}>
            <ol className="space-y-1.5">
              {products.map((product, index) => (
                <ProductOrderRow key={product.id} product={product} index={index} total={products.length} onMove={move} />
              ))}
            </ol>
          </SortableContext>
        </DndContext>
      )}
    </Modal>
  );
}

export function CollectionsPage() {
  const t = useT(STRINGS);
  const { locale } = useLocale();
  const errorMessage = useErrorMessage();
  const workspaceId = useWorkspaceId();
  const toast = useToast();
  const list = useAsync(() => apiClient.listCollections(workspaceId), [workspaceId]);

  const [flat, setFlat] = useState<FlatNode<CollectionSummary>[]>([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // The create / edit sheet. `key` starts each opening with fresh fields; the sheet stays mounted while it closes.
  const [sheet, setSheet] = useState<{ key: number; collection: CollectionSummary | null; open: boolean } | null>(null);
  const [deleting, setDeleting] = useState<CollectionSummary | null>(null);
  const [ordering, setOrdering] = useState<CollectionSummary | null>(null);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [offsetX, setOffsetX] = useState(0);

  // The server's tree is the truth; a move is shown at once and put back if the save fails.
  const [shown, setShown] = useState<typeof list.data>(null);
  if (list.data && list.data !== shown) {
    setShown(list.data);
    setFlat(flattenTree(list.data));
  }
  // What is on screen now, for an Undo pressed a few seconds after the move it takes back.
  const flatNow = useRef(flat);
  flatNow.current = flat;

  const reload = () => list.refresh({ silent: true });
  const rtl = locale === "ar";

  const openSheet = (collection: CollectionSummary | null) => setSheet((current) => ({ key: (current?.key ?? 0) + 1, collection, open: true }));
  const closeSheet = () => setSheet((current) => (current ? { ...current, open: false } : current));

  async function commit(next: FlatNode<CollectionSummary>[], undoable = true) {
    const items = reorderItems(next);
    if (items.length === 0) return;
    const previous = flatNow.current;
    setFlat(next);
    setSaving(true);
    setError(null);
    try {
      await apiClient.reorderCollections(workspaceId, items);
      // The rows now hold what was saved, so a second move (or an Undo) made before the list is read again starts from it.
      setFlat(settled(next));
      if (undoable) {
        toast.undo(t.orderSaved, () => {
          // The same shape as before the move, over what the server holds now: only what differs is sent back.
          const current = new Map(flatNow.current.map((n) => [n.item.id, n.item]));
          const back = previous.flatMap((n) => {
            const item = current.get(n.item.id);
            return item ? [{ ...n, item }] : [];
          });
          return commit(back, false);
        });
      } else {
        toast.success(t.orderSaved);
      }
      await reload();
    } catch (err) {
      setFlat(previous);
      setError(errorMessage(err));
    } finally {
      setSaving(false);
    }
  }

  // While a collection is dragged, what is inside it travels with it and is hidden.
  const visible = useMemo(() => {
    if (!activeId) return flat;
    const index = flat.findIndex((n) => n.item.id === activeId);
    if (index < 0) return flat;
    const [start, end] = subtreeRange(flat, index);
    return [...flat.slice(0, start + 1), ...flat.slice(end)];
  }, [flat, activeId]);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  const nameOf = (id: unknown) => flat.find((n) => n.item.id === id)?.item.name ?? "";

  function onDragStart({ active }: DragStartEvent) {
    setActiveId(String(active.id));
    setOffsetX(0);
  }

  function onDragMove({ delta }: DragMoveEvent) {
    setOffsetX(delta.x);
  }

  function onDragEnd({ active, over }: DragEndEvent) {
    const from = flat.findIndex((n) => n.item.id === active.id);
    const to = over ? flat.findIndex((n) => n.item.id === over.id) : from;
    const depth = from >= 0 ? projectedDepth(flat, from, offsetX, INDENT, rtl) : 0;
    setActiveId(null);
    setOffsetX(0);
    if (from < 0 || to < 0) return;
    void commit(moveSubtree(flat, from, to, depth));
  }

  async function confirmDelete() {
    if (!deleting) return;
    try {
      await apiClient.deleteCollection(workspaceId, deleting.id);
    } catch (err) {
      throw new Error(errorMessage(err));
    }
    toast.success(fmt(t.deletedToast, { name: deleting.name }));
    setDeleting(null);
    reload();
  }

  const activeDepth = (node: FlatNode<CollectionSummary>, index: number) => {
    if (node.item.id !== activeId) return node.depth;
    // Shows where the sideways pull would put it, within what is allowed.
    const moved = moveSubtree(flat, index, index, projectedDepth(flat, index, offsetX, INDENT, rtl));
    return moved.find((n) => n.item.id === activeId)?.depth ?? node.depth;
  };

  const headerMenu: ContextMenuItem[] = [
    { id: "export", label: t.exportCsv, icon: IconDownload, disabled: flat.length === 0, onSelect: () => downloadCollectionsCsv(flat) },
  ];

  return (
    <div className="max-w-3xl">
      <PageHeader
        title={t.title}
        back={{ to: "/catalog", label: t.products }}
        description={t.description}
        actions={<ItemMenu items={headerMenu} label={t.more} />}
        primaryAction={
          <Button onClick={() => openSheet(null)} className="min-h-11 gap-2 rounded-full px-5">
            <IconPlus className="size-4" weight="bold" aria-hidden />
            {t.newCollection}
          </Button>
        }
      />

      {error && (
        <Alert variant="danger" className="mb-3">
          {error}
        </Alert>
      )}

      {/* No collections: start one, or make "All products" in one tap (components/SmartCollectionFields). */}
      {!list.loading && !list.error && flat.length === 0 && (
        <CollectionsEmpty title={t.empty} createLabel={t.newCollection} onCreate={() => openSheet(null)} onCreated={reload} />
      )}
      <DataState loading={list.loading} error={list.error} onRetry={() => list.refresh()} skeleton={<ListSkeleton variant="card" rows={6} />}>
        <DndContext
          sensors={sensors}
          collisionDetection={closestCenter}
          onDragStart={onDragStart}
          onDragMove={onDragMove}
          onDragEnd={onDragEnd}
          onDragCancel={() => {
            setActiveId(null);
            setOffsetX(0);
          }}
          accessibility={{
            screenReaderInstructions: { draggable: t.instructions },
            announcements: {
              onDragStart: ({ active }) => fmt(t.dragStart, { name: nameOf(active.id) }),
              onDragOver: ({ active, over }) => (over ? fmt(t.dragOver, { name: nameOf(active.id), over: nameOf(over.id) }) : undefined),
              onDragEnd: ({ active }) => fmt(t.dragEnd, { name: nameOf(active.id) }),
              onDragCancel: () => t.dragCancel,
            },
          }}
        >
          <SortableContext items={visible.map((n) => n.item.id)} strategy={verticalListSortingStrategy}>
            <ul className="space-y-2 empty:hidden" aria-busy={saving}>
              {visible.map((node) => {
                const index = flat.findIndex((n) => n.item.id === node.item.id);
                return (
                  <CollectionRow
                    key={node.item.id}
                    node={node}
                    depth={activeDepth(node, index)}
                    flat={flat}
                    index={index}
                    busy={saving}
                    onMove={(next) => void commit(next)}
                    onOrderProducts={() => setOrdering(node.item)}
                    onEdit={() => openSheet(node.item)}
                    onDelete={() => setDeleting(node.item)}
                  />
                );
              })}
            </ul>
          </SortableContext>
        </DndContext>
      </DataState>

      {sheet && (
        <CollectionDialog
          key={sheet.key}
          open={sheet.open}
          collection={sheet.collection ?? undefined}
          flat={flat}
          onClose={closeSheet}
          onDone={() => {
            closeSheet();
            reload();
          }}
        />
      )}

      {ordering && (
        <ProductOrderDialog
          collection={ordering}
          onClose={() => {
            setOrdering(null);
            // A Refresh inside may have changed the product counts.
            if (isSmartCollection(ordering)) reload();
          }}
        />
      )}

      <ConfirmDialog
        open={deleting !== null}
        title={fmt(t.deleteTitle, { name: deleting?.name ?? "" })}
        description={t.deleteDescription}
        confirmLabel={t.deleteConfirm}
        busyLabel={t.deleting}
        cancelLabel={t.cancel}
        destructive
        onCancel={() => setDeleting(null)}
        onConfirm={confirmDelete}
      />
    </div>
  );
}
