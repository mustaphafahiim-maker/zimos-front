import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { X } from "lucide-react";
import { Button, Card, CardContent, Spinner } from "@store-builder/ui";
import type { CollectionSummary } from "@store-builder/api-client";
import { apiClient } from "@/lib/apiClient";
import { useWorkspaceId } from "@/lib/useWorkspaceId";
import { useAsync } from "@store-builder/ui";
import { getErrorMessage } from "@/lib/errors";
import { useToast } from "@/components/Toast";
import { Select } from "@/components/Select";
import { fmt, useCommon, useT, type Messages } from "@/i18n/LocaleContext";

const STRINGS = {
  en: {
    title: "Collections",
    subtitle: "Storefront groupings this product appears in.",
    notInAny: "Not in any collection yet.",
    removeFrom: "Remove from {name}",
    noneExist: "No collections exist yet — create one on the",
    collectionsPage: "Collections page",
    inAll: "In every collection already.",
    addPlaceholder: "Add to a collection…",
    addedToast: "Added to collection.",
    removedToast: "Removed from collection.",
  },
  ar: {
    title: "المجموعات",
    subtitle: "مجموعات المتجر التي يظهر فيها هذا المنتج.",
    notInAny: "المنتج غير مضاف لأي مجموعة بعد.",
    removeFrom: "إزالة من {name}",
    noneExist: "لا توجد مجموعات بعد — أنشئ واحدة من",
    collectionsPage: "صفحة المجموعات",
    inAll: "المنتج موجود في كل المجموعات بالفعل.",
    addPlaceholder: "إضافة إلى مجموعة…",
    addedToast: "تمت الإضافة إلى المجموعة.",
    removedToast: "تمت الإزالة من المجموعة.",
  },
} satisfies Messages;

interface Props {
  productId: string;
  /** Collections the product currently belongs to (from product detail). */
  memberships: CollectionSummary[];
  onChanged: () => void;
}

export function ProductCollectionsSection({ productId, memberships, onChanged }: Props) {
  const t = useT(STRINGS);
  const c = useCommon();
  const workspaceId = useWorkspaceId();
  const toast = useToast();
  const all = useAsync(() => apiClient.listCollections(workspaceId), [workspaceId]);
  const [pick, setPick] = useState("");
  const [busy, setBusy] = useState(false);

  const memberIds = useMemo(() => new Set(memberships.map((m) => m.id)), [memberships]);
  const available = (all.data ?? []).filter((col) => !memberIds.has(col.id));

  async function add() {
    if (!pick) return;
    setBusy(true);
    try {
      await apiClient.addProductToCollection(workspaceId, productId, pick);
      toast.success(t.addedToast);
      setPick("");
      onChanged();
    } catch (err) {
      toast.error(getErrorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  async function remove(collectionId: string) {
    setBusy(true);
    try {
      await apiClient.removeProductFromCollection(workspaceId, productId, collectionId);
      toast.success(t.removedToast);
      onChanged();
    } catch (err) {
      toast.error(getErrorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <Card className="rounded-2xl">
      <CardContent className="pt-6">
        <h2 className="font-display text-lg font-semibold text-ink">{t.title}</h2>
        <p className="text-sm text-ink-soft">{t.subtitle}</p>

        <div className="mt-4 flex flex-wrap gap-2">
          {memberships.length === 0 && <span className="text-sm text-ink-soft">{t.notInAny}</span>}
          {memberships.map((col) => (
            <span
              key={col.id}
              className="inline-flex items-center gap-2 rounded-full border border-line bg-primary-soft px-3 py-1 text-sm text-ink"
            >
              {col.name}
              <button
                onClick={() => remove(col.id)}
                disabled={busy}
                className="cursor-pointer text-ink-soft hover:text-danger disabled:opacity-50"
                aria-label={fmt(t.removeFrom, { name: col.name })}
                title={fmt(t.removeFrom, { name: col.name })}
              >
                <X className="size-3.5" aria-hidden />
              </button>
            </span>
          ))}
        </div>

        <div className="mt-4 flex flex-wrap items-center gap-2">
          {all.loading ? (
            <Spinner className="size-4" />
          ) : all.error ? (
            <span className="text-sm text-danger">{getErrorMessage(all.error)}</span>
          ) : available.length === 0 ? (
            <span className="text-sm text-ink-soft">
              {(all.data ?? []).length === 0 ? (
                <>
                  {t.noneExist}{" "}
                  <Link to="/catalog/collections" className="text-primary hover:underline">
                    {t.collectionsPage}
                  </Link>
                  .
                </>
              ) : (
                t.inAll
              )}
            </span>
          ) : (
            <>
              <Select
                value={pick}
                onChange={(e) => setPick(e.target.value)}
                className="w-full max-w-xs"
                aria-label={t.addPlaceholder}
              >
                <option value="">{t.addPlaceholder}</option>
                {available.map((col) => (
                  <option key={col.id} value={col.id}>
                    {col.name}
                  </option>
                ))}
              </Select>
              <Button size="sm" onClick={add} disabled={!pick || busy}>
                {c.add}
              </Button>
            </>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
