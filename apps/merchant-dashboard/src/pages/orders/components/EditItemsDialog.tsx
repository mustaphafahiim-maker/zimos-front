import { useEffect, useImperativeHandle, useMemo, useState, type Ref } from "react";
import { IconDelete } from "@/components/icons";
import { Alert, Button, Input } from "@store-builder/ui";
import {
  orderStaffDiscount,
  orderStaffPreviewItems,
  orderStaffPriceOverride,
  orderStaffUpdateItems,
  type Offer,
  type Order,
  type OrderStaffItemsPreview,
} from "@store-builder/api-client";
import { useWorkspace } from "@/context/WorkspaceContext";
// Handoff 382: staff prices, custom lines and the staff discount on the edit.
import { CustomLineAdder, CustomLineBadge, LinePriceField, StaffDiscountField, StaffDiscountRows } from "../staffPricing/StaffPricingFields";
import { STAFF_PRICING_STRINGS, canOverridePrices, type StaffDiscountForm } from "../staffPricing/staffPricing";
import { discountFormOf, editLinesOf, pricedEditLine, staffEditBlocked, staffEditOf, staffPricingError, type StaffEditLine } from "../staffPricing/editLines";
import { apiClient } from "@/lib/apiClient";
import { useWorkspaceId } from "@/lib/useWorkspaceId";
import { useAsync } from "@/lib/useAsync";
import { formatMoney, variantLabel } from "@/lib/format";
import { fmt, useT, type Messages } from "@/i18n/LocaleContext";
import { Modal } from "@/components/Modal";
import { Select } from "@/components/Select";
import { useToast } from "@/components/Toast";
import { useOrderErrorMessage } from "../orderErrors";
import { BookingLockLink } from "./courierBookingLock";

const STRINGS = {
  en: {
    button: "Edit items",
    title: "Edit the items of {number}",
    description: "Lines already on the order keep the price they were sold at. Nothing changes until you save.",
    quantity: "Quantity of {name}",
    remove: "Remove {name}",
    addProduct: "Add a product",
    chooseProduct: "Choose a product…",
    noOffer: "No offer",
    add: "Add",
    empty: "An order needs at least one item. To drop the order, cancel it.",
    before: "Total now",
    after: "New total",
    difference: "Difference",
    shipping: "Shipping",
    discount: "Discount",
    pricing: "Calculating…",
    cancel: "Cancel",
    save: "Save items",
    saving: "Saving…",
    saved: "Items updated.",
    ORDER_ALREADY_PAID: "This order has been paid; correct it with a refund instead.",
  },
  ar: {
    button: "تعديل المنتجات",
    title: "تعديل منتجات {number}",
    description: "المنتجات الموجودة في الأوردر تحتفظ بالسعر الذي بيعت به. لا يتغير شيء حتى تحفظ.",
    quantity: "كمية {name}",
    remove: "حذف {name}",
    addProduct: "إضافة منتج",
    chooseProduct: "اختار منتجًا…",
    noOffer: "بدون عرض",
    add: "إضافة",
    empty: "الأوردر يحتاج منتجًا واحدًا على الأقل. لإلغاء الأوردر استخدم الإلغاء.",
    before: "الإجمالي الآن",
    after: "الإجمالي الجديد",
    difference: "الفرق",
    shipping: "الشحن",
    discount: "الخصم",
    pricing: "بنحسب…",
    cancel: "إلغاء",
    save: "حفظ المنتجات",
    saving: "بنحفظ…",
    saved: "تم تحديث المنتجات.",
    ORDER_ALREADY_PAID: "الأوردر ده اتدفع؛ صحّحه باسترداد بدل التعديل.",
  },
} satisfies Messages;

/** Handoff 382: a line may carry the staff's own price, or be a custom line (staffPricing/editLines.ts). */
type Line = StaffEditLine;

const SHIPPED = ["fulfilled", "partially_fulfilled", "returned"];

/** Whether the order page should offer the editor at all (the server decides for real). */
export function canEditItems(order: Order): boolean {
  if (order.cancelledAt || order.confirmationState === "rejected") return false;
  if (SHIPPED.includes(order.fulfillmentState)) return false;
  if (Number(order.amountPaid) > 0) return false;
  return !(order.shipments ?? []).some((s) => !["created", "cancelled", "failed"].includes(s.status));
}

/** `hideTrigger` leaves only the dialog, opened through `actionRef` (the order page's «…» menu). */
export function EditItemsButton({
  order,
  onChanged,
  actionRef,
  hideTrigger,
}: {
  order: Order;
  onChanged: () => void;
  actionRef?: Ref<{ open: () => void }>;
  hideTrigger?: boolean;
}) {
  const t = useT(STRINGS);
  const [open, setOpen] = useState(false);
  useImperativeHandle(actionRef, () => ({
    open: () => {
      if (canEditItems(order)) setOpen(true);
    },
  }));
  if (!canEditItems(order)) return null;
  return (
    <>
      {!hideTrigger && (
        <Button variant="outline" size="sm" className="min-h-11" onClick={() => setOpen(true)}>
          {t.button}
        </Button>
      )}
      {open && (
        <EditItemsDialog
          order={order}
          onClose={() => setOpen(false)}
          onSaved={() => {
            setOpen(false);
            onChanged();
          }}
        />
      )}
    </>
  );
}

function EditItemsDialog({ order, onClose, onSaved }: { order: Order; onClose: () => void; onSaved: () => void }) {
  const workspaceId = useWorkspaceId();
  const t = useT(STRINGS);
  const toast = useToast();
  const orderError = useOrderErrorMessage();
  const errorMessage = (err: unknown) => {
    const code = err && typeof err === "object" && "code" in err ? String((err as { code?: string }).code) : "";
    return code === "ORDER_ALREADY_PAID" ? t.ORDER_ALREADY_PAID : (staffPricingError(err, staffText) ?? orderError(err));
  };

  // The order's catalogue lines, and (handoff 382) its custom lines, which go back by their id so they are kept.
  const [lines, setLines] = useState<Line[]>(() => editLinesOf(order));
  const staffText = useT(STAFF_PRICING_STRINGS);
  const { currentWorkspace } = useWorkspace();
  const canPrice = canOverridePrices(currentWorkspace?.role);
  // The staff discount: the order's own until it is touched; then what is typed, or null for «إزالة الخصم اليدوي».
  const [discount, setDiscount] = useState<StaffDiscountForm | null>(() => discountFormOf(order));
  const [discountTouched, setDiscountTouched] = useState(false);
  const [preview, setPreview] = useState<OrderStaffItemsPreview | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pricing, setPricing] = useState(false);
  const [saving, setSaving] = useState(false);

  // add-a-product row
  const products = useAsync(
    () => apiClient.listProducts(workspaceId, { status: "active", limit: 200 }).then((r) => r.products),
    [workspaceId]
  );
  const [productId, setProductId] = useState("");
  const [variantId, setVariantId] = useState("");
  const [offerId, setOfferId] = useState("");
  const [offers, setOffers] = useState<Offer[]>([]);
  const product = (products.data ?? []).find((p) => p.id === productId);
  const variants = (product?.variants ?? []).filter((v) => v.status === "active");

  useEffect(() => {
    setOfferId("");
    setOffers([]);
    if (!product) return;
    setVariantId(variants[0]?.id ?? "");
    let cancelled = false;
    apiClient
      .listOffers(workspaceId, product.id)
      .then((list) => !cancelled && setOffers(list.filter((o) => o.status === "active")))
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [productId]);

  const payload = useMemo(() => staffEditOf(lines, discount, discountTouched), [lines, discount, discountTouched]);
  const blocked = staffEditBlocked(discount, discountTouched);

  // The server prices every change; the dialog only shows its answer.
  useEffect(() => {
    if (payload.items.length === 0) {
      setPreview(null);
      setError(null);
      return;
    }
    let cancelled = false;
    setPricing(true);
    const timer = window.setTimeout(() => {
      orderStaffPreviewItems(apiClient, workspaceId, order.id, payload)
        .then((p) => {
          if (cancelled) return;
          setPreview(p);
          setError(null);
        })
        .catch((err) => {
          if (cancelled) return;
          setPreview(null);
          setError(errorMessage(err));
        })
        .finally(() => !cancelled && setPricing(false));
    }, 300);
    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [payload, workspaceId, order.id]);

  function addLine() {
    const variant = variants.find((v) => v.id === variantId);
    if (!product || !variant) return;
    const offer = offers.find((o) => o.id === offerId);
    const same = lines.find((l) => l.variantId === variant.id && (l.offerId ?? "") === (offer?.id ?? ""));
    if (same) {
      setLines((prev) => prev.map((l) => (l.key === same.key ? { ...l, quantity: l.quantity + 1 } : l)));
      return;
    }
    setLines((prev) => [
      ...prev,
      {
        key: `new-${Date.now()}`,
        variantId: variant.id,
        offerId: offer?.id ?? null,
        quantity: 1,
        label: [product.name, variantLabel(variant), offer?.name].filter(Boolean).join(" · "),
      },
    ]);
  }

  async function save() {
    setSaving(true);
    setError(null);
    try {
      await orderStaffUpdateItems(apiClient, workspaceId, order.id, payload);
      toast.success(t.saved);
      onSaved();
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setSaving(false);
    }
  }

  const money = (n: string) => formatMoney(n, preview?.currency ?? order.currency);
  const diff = preview ? Number(preview.differenceAmount) : 0;

  return (
    <Modal
      open
      onClose={saving ? () => undefined : onClose}
      title={fmt(t.title, { number: order.orderNumber })}
      description={t.description}
      className="max-w-2xl"
      footer={
        <>
          <Button variant="outline" className="min-h-11" onClick={onClose} disabled={saving}>
            {t.cancel}
          </Button>
          <Button className="min-h-11" onClick={save} disabled={saving || pricing || !preview || lines.length === 0 || blocked}>
            {saving ? t.saving : t.save}
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        {error && (
          <Alert variant="danger" role="alert">
            {error}
            <BookingLockLink message={error} onGo={onClose} />
          </Alert>
        )}

        {lines.length === 0 ? (
          <p className="text-sm text-ink-soft">{t.empty}</p>
        ) : (
          <ul className="divide-y divide-line rounded-[0.5rem] border border-line">
            {lines.map((line, index) => {
              const priced = pricedEditLine(preview, lines, line);
              const override = orderStaffPriceOverride(priced);
              return (
                <li key={line.key} className="flex flex-wrap items-center gap-3 px-3 py-2 text-sm">
                  <span className="min-w-0 flex-1 text-ink">
                    <span className="block" dir="auto">{line.label}</span>
                    {/* Handoff 382: «مخصص» on a custom line; the pencil that changes a catalogue line's price. */}
                    {line.custom ? (
                      <CustomLineBadge className="mt-1" />
                    ) : (
                      canPrice && (
                        <LinePriceField
                          name={line.label}
                          value={line.unitPrice}
                          onChange={(next) => setLines((prev) => prev.map((l) => (l.key === line.key ? { ...l, unitPrice: next } : l)))}
                          pricedMinor={priced?.unitPriceAmount}
                          catalogMinor={override?.kind === "override" ? override.catalogUnitPriceAmount : null}
                          currency={preview?.currency ?? order.currency}
                          disabled={saving}
                        />
                      )
                    )}
                  </span>
                  <Input
                    type="number"
                    min={1}
                    value={line.quantity}
                    aria-label={fmt(t.quantity, { name: line.label })}
                    onChange={(e) => {
                      const quantity = Math.max(1, Math.floor(Number(e.target.value) || 1));
                      setLines((prev) => prev.map((l, i) => (i === index ? { ...l, quantity } : l)));
                    }}
                    className="h-11 w-20"
                  />
                  <span className="w-28 text-end text-ink">{priced ? money(priced.lineTotalAmount) : "—"}</span>
                  {/* Removing a custom line is a price change: not offered without the permission. */}
                  <button
                    hidden={Boolean(line.custom) && !canPrice}
                    type="button"
                    onClick={() => setLines((prev) => prev.filter((l) => l.key !== line.key))}
                    aria-label={fmt(t.remove, { name: line.label })}
                    className="inline-flex size-9 cursor-pointer items-center justify-center rounded-md text-ink-soft hover:text-danger focus-visible:outline-2 focus-visible:outline-primary"
                  >
                    <IconDelete className="size-4" aria-hidden />
                  </button>
                </li>
              );
            })}
          </ul>
        )}

        <fieldset>
          <legend className="mb-1.5 text-sm font-medium text-ink">{t.addProduct}</legend>
          <div className="grid gap-2 sm:grid-cols-[minmax(0,2fr)_minmax(0,1.5fr)_minmax(0,1.5fr)_auto]">
            <Select value={productId} onChange={(e) => setProductId(e.target.value)} className="h-11" aria-label={t.addProduct}>
              <option value="">{t.chooseProduct}</option>
              {(products.data ?? []).map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </Select>
            <Select value={variantId} disabled={!product} onChange={(e) => setVariantId(e.target.value)} className="h-11">
              {variants.map((v) => (
                <option key={v.id} value={v.id}>
                  {variantLabel(v)} — {formatMoney(v.priceAmount, v.currency)}
                </option>
              ))}
            </Select>
            <Select
              value={offerId}
              disabled={!product || offers.length === 0}
              onChange={(e) => setOfferId(e.target.value)}
              className="h-11"
            >
              <option value="">{t.noOffer}</option>
              {offers.map((o) => (
                <option key={o.id} value={o.id}>
                  {o.name}
                </option>
              ))}
            </Select>
            <Button type="button" variant="outline" className="min-h-11" disabled={!variantId} onClick={addLine}>
              {t.add}
            </Button>
          </div>
        </fieldset>

        {/* Handoff 382 (orders.price_override): a line that is not in the catalogue, and a discount off the whole order. */}
        {canPrice && (
          <div className="flex flex-col items-start gap-3 [&>fieldset]:w-full">
            <CustomLineAdder
              currency={preview?.currency ?? order.currency}
              onAdd={(custom, quantity) =>
                setLines((prev) => [...prev, { key: `custom-${Date.now()}`, variantId: "", offerId: null, quantity, label: custom.title.trim(), custom }])
              }
            />
            <StaffDiscountField
              value={discount}
              currency={preview?.currency ?? order.currency}
              showProblems={blocked}
              disabled={saving}
              onChange={(next) => {
                setDiscount(next);
                setDiscountTouched(true);
              }}
            />
          </div>
        )}

        {preview ? (
          <dl className="space-y-1.5 border-t border-line pt-3 text-sm" aria-busy={pricing || undefined}>
            <Row label={t.before} value={money(preview.before.totalAmount)} />
            <Row label={t.shipping} value={money(preview.after.shippingAmount)} />
            {/* One row, or «كود الخصم» and «خصم يدوي (السبب)» as two (handoff 382). */}
            <StaffDiscountRows
              discountAmount={preview.after.discountAmount}
              manual={orderStaffDiscount(preview)}
              currency={preview.currency ?? order.currency}
              discountLabel={t.discount}
            />
            <div className="flex justify-between text-base font-semibold text-ink">
              <dt>{t.after}</dt>
              <dd>{money(preview.after.totalAmount)}</dd>
            </div>
            <div className={`flex justify-between ${diff > 0 ? "text-accent-dark" : diff < 0 ? "text-success" : "text-ink-soft"}`}>
              <dt>{t.difference}</dt>
              <dd>
                <bdi dir="ltr">
                  {diff > 0 ? "+" : diff < 0 ? "−" : ""}
                  {money(String(Math.abs(diff)))}
                </bdi>
              </dd>
            </div>
          </dl>
        ) : (
          pricing && <p className="text-sm text-ink-soft">{t.pricing}</p>
        )}
      </div>
    </Modal>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between">
      <dt className="text-ink-soft">{label}</dt>
      <dd className="text-ink">{value}</dd>
    </div>
  );
}
