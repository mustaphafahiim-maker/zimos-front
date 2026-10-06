import { useState } from "react";
import { Alert, Button, Input, Label } from "@store-builder/ui";
import { catalogBulkEditProducts, isSmartCollection, type CatalogBulkChanges } from "@store-builder/api-client";
import { apiClient } from "@/lib/apiClient";
import { useWorkspaceId } from "@/lib/useWorkspaceId";
import { useAsync } from "@/lib/useAsync";
import { useErrorMessage } from "@/lib/errorMessages";
import { majorToMinor } from "@/lib/format";
import { fmt, useT, type Messages } from "@/i18n/LocaleContext";
import { Modal } from "@/components/Modal";
import { Select } from "@/components/Select";
import { useToast } from "@/components/Toast";

/**
 * Bulk edit of the products ticked in the list (SPEC §7.5): status, free
 * shipping, a collection, or the price of every variant. Only the rows the
 * merchant switched on are sent; the server applies them to all the products
 * or to none.
 */

const STRINGS = {
  en: {
    title: "Edit {count} products",
    description: "Only what you change here is applied. Everything else stays as it is.",
    status: "Status",
    keep: "Don't change",
    status_draft: "Draft",
    status_active: "Active",
    status_archived: "Archived",
    shipping: "Shipping",
    shipping_standard: "Store's shipping prices",
    shipping_free: "Free shipping",
    collection: "Collection",
    collectionNone: "Don't change",
    collectionAdd: "Add to",
    collectionRemove: "Remove from",
    price: "Price",
    price_set: "Set to",
    price_increase_percent: "Increase by %",
    price_decrease_percent: "Decrease by %",
    priceHint: "Applies to every active variant of the selected products.",
    priceInvalid: "Enter a valid number.",
    nothing: "Choose at least one change.",
    cancel: "Cancel",
    apply: "Apply to {count} products",
    applying: "Applying…",
    done: "{count} products updated.",
  },
  ar: {
    title: "تعديل {count} منتج",
    description: "يُطبَّق فقط ما تغيّره هنا. كل شيء آخر يبقى كما هو.",
    status: "الحالة",
    keep: "بدون تغيير",
    status_draft: "مسودة",
    status_active: "نشط",
    status_archived: "مؤرشف",
    shipping: "الشحن",
    shipping_standard: "أسعار الشحن في المتجر",
    shipping_free: "شحن مجاني",
    collection: "المجموعة",
    collectionNone: "بدون تغيير",
    collectionAdd: "إضافة إلى",
    collectionRemove: "حذف من",
    price: "السعر",
    price_set: "تحديد السعر",
    price_increase_percent: "زيادة بنسبة %",
    price_decrease_percent: "تخفيض بنسبة %",
    priceHint: "يُطبَّق على كل المتغيرات النشطة للمنتجات المحددة.",
    priceInvalid: "اكتب رقمًا صحيحًا.",
    nothing: "اختار تغييرًا واحدًا على الأقل.",
    cancel: "إلغاء",
    apply: "تطبيق على {count} منتج",
    applying: "بنطبّق…",
    done: "تم تحديث {count} منتج.",
  },
} satisfies Messages;

type PriceMode = "" | "set" | "increase_percent" | "decrease_percent";

export function ProductBulkEditDialog({
  productIds,
  onClose,
  onDone,
}: {
  productIds: string[];
  onClose: () => void;
  onDone: () => void;
}) {
  const t = useT(STRINGS);
  const workspaceId = useWorkspaceId();
  const toast = useToast();
  const errorMessage = useErrorMessage();
  const collections = useAsync(() => apiClient.listCollections(workspaceId), [workspaceId]);

  const [status, setStatus] = useState("");
  const [shipping, setShipping] = useState("");
  const [collectionId, setCollectionId] = useState("");
  const [collectionAction, setCollectionAction] = useState<"add" | "remove">("add");
  const [priceMode, setPriceMode] = useState<PriceMode>("");
  const [priceValue, setPriceValue] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const count = productIds.length;

  async function apply() {
    const changes: CatalogBulkChanges = {};
    if (status) changes.status = status as CatalogBulkChanges["status"];
    if (shipping) changes.shippingMode = shipping as CatalogBulkChanges["shippingMode"];
    if (collectionId) changes.collection = { id: collectionId, action: collectionAction };
    if (priceMode) {
      const value = priceMode === "set" ? majorToMinor(priceValue) : Number(priceValue);
      if (!Number.isFinite(value) || value < 0 || (priceMode !== "set" && value <= 0)) {
        setError(t.priceInvalid);
        return;
      }
      changes.price = { mode: priceMode, value };
    }
    if (Object.keys(changes).length === 0) {
      setError(t.nothing);
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const result = await catalogBulkEditProducts(apiClient, workspaceId, productIds, changes);
      toast.success(fmt(t.done, { count: result.updated }));
      onDone();
    } catch (err) {
      setError(errorMessage(err));
      setBusy(false);
    }
  }

  return (
    <Modal
      open
      onClose={busy ? () => {} : onClose}
      title={fmt(t.title, { count })}
      description={t.description}
      footer={
        <>
          <Button type="button" variant="outline" disabled={busy} onClick={onClose}>
            {t.cancel}
          </Button>
          <Button type="button" disabled={busy} onClick={() => void apply()}>
            {busy ? t.applying : fmt(t.apply, { count })}
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label htmlFor="bulk-status">{t.status}</Label>
            <Select id="bulk-status" value={status} disabled={busy} onChange={(e) => setStatus(e.target.value)}>
              <option value="">{t.keep}</option>
              <option value="active">{t.status_active}</option>
              <option value="draft">{t.status_draft}</option>
              <option value="archived">{t.status_archived}</option>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="bulk-shipping">{t.shipping}</Label>
            <Select id="bulk-shipping" value={shipping} disabled={busy} onChange={(e) => setShipping(e.target.value)}>
              <option value="">{t.keep}</option>
              <option value="free">{t.shipping_free}</option>
              <option value="standard">{t.shipping_standard}</option>
            </Select>
          </div>
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="bulk-collection">{t.collection}</Label>
          <div className="grid gap-2 sm:grid-cols-[10rem_1fr]">
            <Select
              aria-label={t.collection}
              value={collectionAction}
              disabled={busy || !collectionId}
              onChange={(e) => setCollectionAction(e.target.value as "add" | "remove")}
            >
              <option value="add">{t.collectionAdd}</option>
              <option value="remove">{t.collectionRemove}</option>
            </Select>
            <Select
              id="bulk-collection"
              value={collectionId}
              disabled={busy || collections.loading}
              onChange={(e) => setCollectionId(e.target.value)}
            >
              <option value="">{t.collectionNone}</option>
              {/* A smart collection fills itself from its rules (409 SMART_COLLECTION by hand). */}
              {(collections.data ?? []).filter((c) => !isSmartCollection(c)).map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </Select>
          </div>
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="bulk-price">{t.price}</Label>
          <div className="grid gap-2 sm:grid-cols-[1fr_10rem]">
            <Select
              id="bulk-price"
              value={priceMode}
              disabled={busy}
              onChange={(e) => setPriceMode(e.target.value as PriceMode)}
            >
              <option value="">{t.keep}</option>
              <option value="set">{t.price_set}</option>
              <option value="increase_percent">{t.price_increase_percent}</option>
              <option value="decrease_percent">{t.price_decrease_percent}</option>
            </Select>
            <Input
              aria-label={t.price}
              type="number"
              inputMode="decimal"
              min={0}
              step="0.01"
              dir="ltr"
              value={priceValue}
              disabled={busy || !priceMode}
              onChange={(e) => setPriceValue(e.target.value)}
            />
          </div>
          <p className="text-xs text-ink-soft">{t.priceHint}</p>
        </div>

        {error && <Alert variant="danger">{error}</Alert>}
      </div>
    </Modal>
  );
}
