import { useState, type FormEvent } from "react";
import { Alert, Button, Card, CardContent, Spinner } from "@store-builder/ui";
import type { Order, ReturnReasonCode, ReturnRequest } from "@store-builder/api-client";
import { apiClient } from "@/lib/apiClient";
import { useWorkspaceId } from "@/lib/useWorkspaceId";
import { useAsync } from "@store-builder/ui";
import { getErrorMessage, getFieldErrors } from "@/lib/errors";
import { formatDateTime } from "@/lib/format";
import { useT, fmt, type Messages } from "@/i18n/LocaleContext";
import { useToast } from "@/components/Toast";
import { StatusBadge } from "@/components/StatusBadge";
import { EmptyState } from "@/components/EmptyState";
import { Field } from "@/components/Field";
import { Select } from "@/components/Select";
import { Textarea } from "@/components/Textarea";
import { useEnumLabel } from "../orderLabels";

const STRINGS = {
  en: {
    returns: "Returns",
    loading: "Loading returns…",
    empty: "No returns on this order.",
    restocked: "Restocked {date}",
    approve: "Approve",
    reject: "Reject",
    restockUnits: "Restock units",
    approvedToast: "Return approved.",
    rejectedToast: "Return rejected.",
    restockedToast: "Returned units added back to stock.",
    openedToast: "Return opened.",
    notDelivered: "A return can only be opened once the order has been delivered.",
    openReturn: "Open a return",
    chooseItems: "Choose at least one item and quantity to return.",
    reason: "Reason",
    detail: "Detail",
    detailPlaceholder: "Optional — box crushed in transit",
    items: "Items",
    ordered: "(ordered {n})",
    qtyFor: "Quantity to return for {name}",
    opening: "Opening…",
    submit: "Open return",
  },
  ar: {
    returns: "المرتجعات",
    loading: "جارٍ تحميل المرتجعات…",
    empty: "لا توجد مرتجعات على هذا الطلب.",
    restocked: "أُعيد للمخزون {date}",
    approve: "قبول",
    reject: "رفض",
    restockUnits: "إعادة الوحدات للمخزون",
    approvedToast: "تم قبول المرتجع.",
    rejectedToast: "تم رفض المرتجع.",
    restockedToast: "تمت إعادة الوحدات المرتجعة إلى المخزون.",
    openedToast: "تم فتح المرتجع.",
    notDelivered: "لا يمكن فتح مرتجع إلا بعد تسليم الطلب.",
    openReturn: "فتح مرتجع",
    chooseItems: "اختر منتجًا واحدًا على الأقل والكمية المراد إرجاعها.",
    reason: "السبب",
    detail: "التفاصيل",
    detailPlaceholder: "اختياري — الكرتونة اتضربت أثناء الشحن",
    items: "المنتجات",
    ordered: "(الكمية المطلوبة {n})",
    qtyFor: "الكمية المرتجعة من {name}",
    opening: "جارٍ الفتح…",
    submit: "فتح المرتجع",
  },
} satisfies Messages;

const REASON_CODES: ReturnReasonCode[] = [
  "damaged",
  "defective",
  "wrong_item",
  "not_as_described",
  "no_longer_wanted",
  "arrived_late",
  "other",
];

interface Props {
  order: Order;
  onOrderMaybeChanged: () => void;
}

export function ReturnsSection({ order, onOrderMaybeChanged }: Props) {
  const t = useT(STRINGS);
  const label = useEnumLabel();
  const workspaceId = useWorkspaceId();
  const toast = useToast();
  const returns = useAsync(
    () => apiClient.listOrderReturns(workspaceId, order.id),
    [workspaceId, order.id]
  );
  const [busyId, setBusyId] = useState<string | null>(null);

  const delivered =
    order.fulfillmentState === "fulfilled" ||
    (order.shipments ?? []).some((s) => s.status === "delivered");

  const itemName = (orderItemId: string) => {
    const oi = order.items.find((i) => i.id === orderItemId);
    return oi ? oi.productNameSnapshot : orderItemId.slice(0, 8);
  };

  async function moderate(ret: ReturnRequest, action: "approve" | "reject") {
    setBusyId(ret.id);
    try {
      await apiClient.moderateReturn(workspaceId, ret.id, action);
      toast.success(action === "approve" ? t.approvedToast : t.rejectedToast);
      returns.refresh({ silent: true });
    } catch (err) {
      toast.error(getErrorMessage(err));
    } finally {
      setBusyId(null);
    }
  }

  async function restock(ret: ReturnRequest) {
    setBusyId(ret.id);
    try {
      await apiClient.restockReturn(workspaceId, ret.id);
      toast.success(t.restockedToast);
      returns.refresh({ silent: true });
      onOrderMaybeChanged();
    } catch (err) {
      toast.error(getErrorMessage(err));
    } finally {
      setBusyId(null);
    }
  }

  const list = returns.data ?? [];

  return (
    <Card className="rounded-2xl">
      <CardContent className="pt-6">
        <h2 className="mb-3 font-display text-lg font-semibold text-ink">{t.returns}</h2>

        {returns.loading ? (
          <Spinner className="size-5" aria-label={t.loading} />
        ) : returns.error ? (
          <Alert variant="danger">{getErrorMessage(returns.error)}</Alert>
        ) : list.length === 0 ? (
          <EmptyState title={t.empty} />
        ) : (
          <ul className="space-y-3">
            {list.map((ret) => (
              <li key={ret.id} className="rounded-xl border border-line px-4 py-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="text-sm text-ink">{label(ret.reason)}</span>
                  <StatusBadge value={ret.status} />
                </div>
                <div className="mt-1 text-xs text-ink-soft">
                  {ret.items
                    .map((it) => `${it.quantity}× ${itemName(it.orderItemId)}`)
                    .join("، ")}
                  {ret.restockedAt && (
                    <span> · {fmt(t.restocked, { date: formatDateTime(ret.restockedAt) })}</span>
                  )}
                </div>
                <div className="mt-2 flex flex-wrap gap-2">
                  {ret.status === "requested" && (
                    <>
                      <Button
                        size="sm"
                        onClick={() => moderate(ret, "approve")}
                        disabled={busyId === ret.id}
                      >
                        {t.approve}
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => moderate(ret, "reject")}
                        disabled={busyId === ret.id}
                      >
                        {t.reject}
                      </Button>
                    </>
                  )}
                  {ret.status === "approved" && !ret.restockedAt && (
                    <Button size="sm" onClick={() => restock(ret)} disabled={busyId === ret.id}>
                      {t.restockUnits}
                    </Button>
                  )}
                </div>
              </li>
            ))}
          </ul>
        )}

        {delivered ? (
          <NewReturnForm
            order={order}
            onDone={() => {
              toast.success(t.openedToast);
              returns.refresh({ silent: true });
            }}
          />
        ) : (
          <p className="mt-4 border-t border-line pt-4 text-sm text-ink-soft">{t.notDelivered}</p>
        )}
      </CardContent>
    </Card>
  );
}

function NewReturnForm({ order, onDone }: { order: Order; onDone: () => void }) {
  const t = useT(STRINGS);
  const label = useEnumLabel();
  const workspaceId = useWorkspaceId();
  const [reasonCode, setReasonCode] = useState<ReturnReasonCode>("damaged");
  const [reasonDetail, setReasonDetail] = useState("");
  const [qty, setQty] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

  async function submit(e: FormEvent) {
    e.preventDefault();
    setFormError(null);
    setFieldErrors({});
    const items = order.items
      .map((it) => ({ orderItemId: it.id, quantity: Math.floor(Number(qty[it.id] ?? "0") || 0) }))
      .filter((l) => l.quantity > 0);
    if (items.length === 0) {
      setFormError(t.chooseItems);
      return;
    }
    setSaving(true);
    try {
      await apiClient.createReturn(workspaceId, order.id, {
        reasonCode,
        reasonDetail: reasonDetail.trim() || undefined,
        items,
      });
      setQty({});
      setReasonDetail("");
      onDone();
    } catch (err) {
      const fields = getFieldErrors(err);
      setFieldErrors(fields);
      if (Object.keys(fields).length === 0) setFormError(getErrorMessage(err));
    } finally {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={submit} className="mt-4 space-y-3 border-t border-line pt-4">
      <h3 className="text-sm font-medium text-ink">{t.openReturn}</h3>
      {formError && <Alert variant="danger">{formError}</Alert>}

      <div className="grid gap-3 sm:grid-cols-2">
        <Field label={t.reason} error={fieldErrors.reasonCode}>
          {({ id }) => (
            <Select
              id={id}
              value={reasonCode}
              onChange={(e) => setReasonCode(e.target.value as ReturnReasonCode)}
            >
              {REASON_CODES.map((r) => (
                <option key={r} value={r}>
                  {label(r)}
                </option>
              ))}
            </Select>
          )}
        </Field>
      </div>

      <Field label={t.detail} error={fieldErrors.reasonDetail}>
        {({ id }) => (
          <Textarea
            id={id}
            value={reasonDetail}
            onChange={(e) => setReasonDetail(e.target.value)}
            placeholder={t.detailPlaceholder}
          />
        )}
      </Field>

      <div className="space-y-2">
        <span className="text-sm font-medium text-ink-soft">{t.items}</span>
        {order.items.map((it) => (
          <div key={it.id} className="flex items-center gap-3 text-sm">
            <span className="min-w-0 flex-1 text-ink">
              {it.productNameSnapshot}
              <span className="text-ink-soft"> {fmt(t.ordered, { n: it.quantity })}</span>
            </span>
            <input
              type="number"
              min={0}
              max={it.quantity}
              value={qty[it.id] ?? ""}
              onChange={(e) => setQty((prev) => ({ ...prev, [it.id]: e.target.value }))}
              placeholder="0"
              aria-label={fmt(t.qtyFor, { name: it.productNameSnapshot })}
              className="h-9 w-20 shrink-0 rounded-lg border border-line bg-paper-raised px-2 text-sm tabular-nums"
            />
          </div>
        ))}
        {fieldErrors["items.quantity"] && (
          <p className="text-xs font-medium text-danger">{fieldErrors["items.quantity"]}</p>
        )}
      </div>

      <div className="flex justify-end">
        <Button type="submit" size="sm" disabled={saving}>
          {saving ? t.opening : t.submit}
        </Button>
      </div>
    </form>
  );
}
