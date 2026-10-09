import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import { catalogDuplicateProduct, type Product, type ProductStatus } from "@store-builder/api-client";
import { useToast } from "@/components/Toast";
import { fmt, useT, type Messages } from "@/i18n/LocaleContext";
import { apiClient } from "@/lib/apiClient";
import { useErrorMessage } from "@/lib/errorMessages";
import { useWorkspaceId } from "@/lib/useWorkspaceId";
import { useViewNavigate } from "@/lib/viewTransition";
import { ProductRemoveDialog } from "../components/ProductRemoveDialog";
import { copyText, type ProductRowView } from "./productRow";

const STRINGS = {
  en: {
    restoredToast: "“{name}” restored as a draft. Set it to Active when it's ready to sell.",
    duplicated: "“{name}” created as a draft.",
    nowActive: "“{name}” is active: shoppers can see it.",
    nowDraft: "“{name}” is a draft: hidden from the store.",
    statusFailed: "The status didn't change, so it is as it was. {reason}",
    linkCopied: "The product's link is copied.",
    copyFailed: "We couldn't copy that. Try again.",
  },
  ar: {
    restoredToast: "«{name}» رجع كمسودة. خليه شغّال لما يبقى جاهز للبيع.",
    duplicated: "تم إنشاء «{name}» كمسودة.",
    nowActive: "«{name}» بقى شغّال: العملاء شايفينه.",
    nowDraft: "«{name}» بقى مسودة: مش ظاهر في المتجر.",
    statusFailed: "الحالة متغيّرتش، فهي زي ما كانت. {reason}",
    linkCopied: "لينك المنتج اتنسخ.",
    copyFailed: "معرفناش ننسخ. جرّب تاني.",
  },
} satisfies Messages;

interface Options {
  /** Writes a change into the rows on screen (list/useCatalogData.ts). */
  patchProduct: (productId: string, change: (product: Product) => Product) => void;
  /** Products moved between lists (an archive, a restore, a delete): read the list again. */
  afterChange: () => void;
  /** A product left the list or the page is about to change: close what is open over the list. */
  onGone?: () => void;
}

/**
 * What can be done to one product from the list — its row menu, its Quick
 * Look — through the calls the page always made:
 *
 *  - restore an archived product as a draft (POST …/restore);
 *  - copy it as a draft and open the copy (POST …/duplicate);
 *  - archive or delete it: the existing dialog (ProductRemoveDialog), which
 *    names what will be lost and asks once;
 *  - شغّال ⇄ مسودة: `apiClient.updateProduct` with `{ status }`, the field the
 *    basics form saves — shown at once, with «تراجع», and put back if refused;
 *  - copy its link in the store.
 */
export function useProductActions({ patchProduct, afterChange, onGone }: Options) {
  const t = useT(STRINGS);
  const workspaceId = useWorkspaceId();
  const toast = useToast();
  const errorMessage = useErrorMessage();
  const navigate = useViewNavigate();

  const [toRemove, setToRemove] = useState<Product | null>(null);
  // Products with a request in flight, so a second press cannot send it twice.
  const [busy, setBusy] = useState<ReadonlySet<string>>(new Set());
  const busyRef = useRef(busy);
  busyRef.current = busy;

  // «تراجع» is pressed seconds later: it answers through the latest callbacks and language.
  const latest = useRef({ t, errorMessage, patchProduct, afterChange, onGone });
  useEffect(() => {
    latest.current = { t, errorMessage, patchProduct, afterChange, onGone };
  });

  const mark = (id: string, on: boolean) =>
    setBusy((prev) => {
      const next = new Set(prev);
      if (on) next.add(id);
      else next.delete(id);
      return next;
    });

  async function restore(product: Product) {
    if (busyRef.current.has(product.id)) return;
    mark(product.id, true);
    try {
      await apiClient.restoreProduct(workspaceId, product.id);
      toast.success(fmt(t.restoredToast, { name: product.name }));
      onGone?.();
    } catch (err) {
      toast.error(errorMessage(err));
    } finally {
      mark(product.id, false);
      // Either way the row's real state is worth re-reading: a
      // PRODUCT_NOT_ARCHIVED means someone else already moved it.
      afterChange();
    }
  }

  async function duplicate(product: Product) {
    if (busyRef.current.has(product.id)) return;
    mark(product.id, true);
    try {
      const copy = await catalogDuplicateProduct(apiClient, workspaceId, product.id);
      toast.success(fmt(t.duplicated, { name: copy.name }));
      onGone?.();
      afterChange();
      navigate(`/catalog/${copy.id}`);
    } catch (err) {
      toast.error(errorMessage(err));
    } finally {
      mark(product.id, false);
    }
  }

  const setStatus = useCallback(
    async (product: Product, next: ProductStatus, undoable = true): Promise<void> => {
      const previous = product.status;
      if (previous === next) return;
      const write = (status: ProductStatus) => latest.current.patchProduct(product.id, (current) => ({ ...current, status }));
      write(next);
      try {
        await apiClient.updateProduct(workspaceId, product.id, { status: next });
      } catch (err) {
        write(previous);
        const now = latest.current;
        toast.error(fmt(now.t.statusFailed, { reason: now.errorMessage(err) }));
        return;
      }
      if (!undoable) return;
      const now = latest.current;
      toast.undo(fmt(next === "active" ? now.t.nowActive : now.t.nowDraft, { name: product.name }), () =>
        setStatus({ ...product, status: next }, previous, false)
      );
    },
    [workspaceId, toast]
  );

  async function copyLink(row: ProductRowView) {
    if (!row.storeUrl) return;
    if (await copyText(row.storeUrl)) toast.success(t.linkCopied);
    else toast.error(t.copyFailed);
  }

  function openStore(row: ProductRowView) {
    if (row.storeUrl) window.open(row.storeUrl, "_blank", "noopener,noreferrer");
  }

  const dialogs: ReactNode = toRemove ? (
    <ProductRemoveDialog
      key={toRemove.id}
      product={toRemove}
      onClose={() => setToRemove(null)}
      onDone={() => {
        setToRemove(null);
        onGone?.();
        afterChange();
      }}
    />
  ) : null;

  return {
    /** Brings an archived product back as a draft. */
    restore,
    /** Copies the product as a draft and opens the copy. */
    duplicate,
    /** Opens the archive / delete dialog for it. */
    askRemove: (product: Product) => setToRemove(product),
    setStatus,
    copyLink,
    openStore,
    /** A request for this product is on its way. */
    isBusy: (productId: string) => busy.has(productId),
    /** Outside the list's own states: the dialog must survive the list reloading. */
    dialogs,
  };
}

export type ProductActions = ReturnType<typeof useProductActions>;
