import { useEffect, useMemo, useRef, useState } from "react";
import { Button, Spinner } from "@store-builder/ui";
import { isSmartCollection, type CollectionSummary } from "@store-builder/api-client";
import { apiClient } from "@/lib/apiClient";
import { useWorkspaceId } from "@/lib/useWorkspaceId";
import { useAsync } from "@/lib/useAsync";
import { useErrorMessage } from "@/lib/errorMessages";
import { useT, fmt, type Messages } from "@/i18n/LocaleContext";
import { IconClose, IconPlus } from "@/components/icons";
import { useToast } from "@/components/Toast";
import { Select } from "@/components/Select";
import { ViewLink } from "@/components/ViewLink";
import { ProductPageCard } from "./ProductPageCard";

const STRINGS = {
  en: {
    title: "Collections",
    description: "Storefront groupings this product appears in.",
    none: "Not in any collection yet.",
    removeFrom: "Remove from {name}",
    smart: "Fills itself from its rules",
    noCollections: "No collections exist yet.",
    openCollections: "Open collections",
    inAll: "In every collection already.",
    pickLabel: "Collection to add this product to",
    pick: "Add to a collection…",
    add: "Add",
    addedToast: "Added to “{name}”.",
    removedToast: "Removed from “{name}”.",
  },
  ar: {
    title: "المجموعات",
    description: "مجموعات المتجر اللي المنتج ده بيظهر فيها.",
    none: "مش في أي مجموعة لسه.",
    removeFrom: "شيله من {name}",
    smart: "بتتملي لوحدها من قواعدها",
    noCollections: "مفيش مجموعات لسه.",
    openCollections: "افتح المجموعات",
    inAll: "موجود في كل المجموعات.",
    pickLabel: "المجموعة اللي هتضيف لها المنتج",
    pick: "ضيفه لمجموعة…",
    add: "ضيف",
    addedToast: "اتضاف لـ«{name}».",
    removedToast: "اتشال من «{name}».",
  },
} satisfies Messages;

interface Props {
  productId: string;
  /** Collections the product currently belongs to (from product detail). */
  memberships: CollectionSummary[];
  onChanged: () => void;
}

/**
 * The collections a product is in. Adding and removing are saved at once (the
 * same two calls as before); each answers with a toast that offers Undo — the
 * opposite call.
 */
export function ProductCollectionsSection({ productId, memberships, onChanged }: Props) {
  const t = useT(STRINGS);
  const errorMessage = useErrorMessage();
  const workspaceId = useWorkspaceId();
  const toast = useToast();
  const all = useAsync(() => apiClient.listCollections(workspaceId), [workspaceId]);
  const [pick, setPick] = useState("");
  const [busy, setBusy] = useState(false);

  // Undo is pressed seconds later, from a toast that outlives this render.
  const latest = useRef({ onChanged });
  useEffect(() => {
    latest.current = { onChanged };
  });

  const memberIds = useMemo(() => new Set(memberships.map((c) => c.id)), [memberships]);
  // Smart collections fill themselves from their rules: no hand add or remove (409 SMART_COLLECTION).
  const available = (all.data ?? []).filter((c) => !memberIds.has(c.id) && !isSmartCollection(c));

  async function add() {
    if (!pick || busy) return;
    const collectionId = pick;
    const name = available.find((c) => c.id === collectionId)?.name ?? "";
    setBusy(true);
    try {
      await apiClient.addProductToCollection(workspaceId, productId, collectionId);
      setPick("");
      onChanged();
      // A failed undo rejects: the toast then says the change is still in place.
      toast.undo(fmt(t.addedToast, { name }), async () => {
        await apiClient.removeProductFromCollection(workspaceId, productId, collectionId);
        latest.current.onChanged();
      });
    } catch (err) {
      toast.error(errorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  async function remove(collection: CollectionSummary) {
    if (busy) return;
    setBusy(true);
    try {
      await apiClient.removeProductFromCollection(workspaceId, productId, collection.id);
      onChanged();
      toast.undo(fmt(t.removedToast, { name: collection.name }), async () => {
        await apiClient.addProductToCollection(workspaceId, productId, collection.id);
        latest.current.onChanged();
      });
    } catch (err) {
      toast.error(errorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <ProductPageCard title={t.title} description={t.description}>
      {memberships.length === 0 ? (
        <p className="text-sm text-ink-soft">{t.none}</p>
      ) : (
        <ul className="flex flex-wrap gap-2">
          {memberships.map((c) => {
            const smart = isSmartCollection(c);
            return (
              <li
                key={c.id}
                title={smart ? t.smart : undefined}
                className="zimos-product-chip inline-flex min-h-11 max-w-full items-center gap-1 rounded-full bg-paper-sunken ps-4 text-sm font-medium text-ink ring-1 ring-line ring-inset"
              >
                <bdi className={smart ? "min-w-0 truncate pe-4" : "min-w-0 truncate"}>{c.name}</bdi>
                {!smart && (
                  <button
                    type="button"
                    onClick={() => void remove(c)}
                    disabled={busy}
                    aria-label={fmt(t.removeFrom, { name: c.name })}
                    className="inline-flex size-11 shrink-0 cursor-pointer items-center justify-center rounded-full text-ink-soft transition-colors duration-[var(--dur-fade)] ease-[var(--ease-out)] hover:bg-danger-soft hover:text-danger focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-primary disabled:cursor-default disabled:opacity-50 motion-reduce:transition-none"
                  >
                    <IconClose className="size-4" weight="bold" aria-hidden />
                  </button>
                )}
              </li>
            );
          })}
        </ul>
      )}

      <div className="mt-4 flex min-h-11 flex-wrap items-center gap-2">
        {all.loading && !all.data ? (
          <Spinner className="size-4" />
        ) : all.error ? (
          <span role="alert" className="text-sm text-danger">
            {errorMessage(all.error)}
          </span>
        ) : available.length === 0 ? (
          <span className="flex flex-wrap items-center gap-x-3 text-sm text-ink-soft">
            {(all.data ?? []).length === 0 ? t.noCollections : t.inAll}
            {(all.data ?? []).length === 0 && (
              <ViewLink to="/catalog/collections" className="inline-flex min-h-11 items-center font-medium text-primary hover:underline">
                {t.openCollections}
              </ViewLink>
            )}
          </span>
        ) : (
          <>
            <Select aria-label={t.pickLabel} value={pick} onChange={(e) => setPick(e.target.value)} className="h-11 min-w-0 flex-1 sm:max-w-xs">
              <option value="">{t.pick}</option>
              {available.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </Select>
            <Button type="button" className="min-h-11 shrink-0" onClick={() => void add()} disabled={!pick || busy}>
              <IconPlus className="size-4" weight="bold" aria-hidden />
              {t.add}
            </Button>
          </>
        )}
      </div>
    </ProductPageCard>
  );
}
