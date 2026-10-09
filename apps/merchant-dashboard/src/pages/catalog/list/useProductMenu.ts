import type { ContextMenuItem } from "@/components/ContextMenu";
import { IconArchive, IconCopy, IconDelete, IconExternal, IconLink, IconProduct, IconQuickLook, IconUndo } from "@/components/icons";
import { useT, type Messages } from "@/i18n/LocaleContext";
import type { ProductRowView } from "./productRow";
import type { ProductActions } from "./useProductActions";

const STRINGS = {
  en: {
    open: "Open the product",
    peek: "Quick look",
    seeInStore: "See it in the store",
    copyLink: "Copy its link",
    duplicate: "Duplicate",
    archive: "Archive or delete…",
    restore: "Restore as a draft",
    deletePermanently: "Delete permanently…",
  },
  ar: {
    open: "افتح المنتج",
    peek: "نظرة سريعة",
    seeInStore: "شوفه في المتجر",
    copyLink: "انسخ اللينك",
    duplicate: "اعمل نسخة",
    archive: "أرشفة أو حذف…",
    restore: "رجّعه كمسودة",
    deletePermanently: "حذف نهائي…",
  },
} satisfies Messages;

/**
 * The menu of a product's row (right-click, a long press, Shift+F10): open,
 * quick look, see it in the store, copy its link, duplicate, then archive —
 * or, for an archived product, restore and delete for good. The store shows
 * no archived product, so the two lines about the store are left out for one.
 * Everything here is in Quick Look too: the menu is a shortcut, never the only way.
 */
export function useProductMenu({
  actions,
  onOpen,
  onPeek,
}: {
  actions: ProductActions;
  /** Open the product's own page. */
  onOpen: (row: ProductRowView) => void;
  onPeek: (row: ProductRowView) => void;
}) {
  const t = useT(STRINGS);

  return (row: ProductRowView): ContextMenuItem[] => {
    const { product } = row;
    const busy = actions.isBusy(product.id);
    const items: ContextMenuItem[] = [
      { id: "open", label: t.open, icon: IconProduct, onSelect: () => onOpen(row) },
      { id: "peek", label: t.peek, icon: IconQuickLook, onSelect: () => onPeek(row) },
    ];
    if (row.storeUrl) {
      items.push(
        { id: "store", label: t.seeInStore, icon: IconExternal, separatorBefore: true, onSelect: () => actions.openStore(row) },
        { id: "copy-link", label: t.copyLink, icon: IconLink, onSelect: () => void actions.copyLink(row) }
      );
    }
    items.push({
      id: "duplicate",
      label: t.duplicate,
      icon: IconCopy,
      separatorBefore: !row.storeUrl,
      disabled: busy,
      onSelect: () => void actions.duplicate(product),
    });
    if (product.status === "archived") {
      items.push(
        { id: "restore", label: t.restore, icon: IconUndo, separatorBefore: true, disabled: busy, onSelect: () => void actions.restore(product) },
        { id: "delete", label: t.deletePermanently, icon: IconDelete, destructive: true, disabled: busy, onSelect: () => actions.askRemove(product) }
      );
    } else {
      items.push({
        id: "archive",
        label: t.archive,
        icon: IconArchive,
        destructive: true,
        separatorBefore: true,
        onSelect: () => actions.askRemove(product),
      });
    }
    return items;
  };
}
