import { useState, type FormEvent } from "react";
import { Alert, Button, Input } from "@store-builder/ui";
import { ordersFulfill, ordersRefundQuote, type Order } from "@store-builder/api-client";
import { apiClient } from "@/lib/apiClient";
import { useWorkspaceId } from "@/lib/useWorkspaceId";
import { formatMoney, formatOptions } from "@/lib/format";
import { fmt, useT, type Messages } from "@/i18n/LocaleContext";
import { Modal } from "@/components/Modal";
import { TextField } from "@/components/Field";
import { useToast } from "@/components/Toast";
import { useOrderErrorMessage } from "../orderErrors";

const STRINGS = {
  en: {
    shipped: "Mark as shipped",
    shippedTitle: "Mark {number} as shipped",
    shippedDescription: "For a parcel you handed to a courier yourself. The customer's tracking page shows it as shipped.",
    courier: "Courier name",
    courierPlaceholder: "Own delivery",
    tracking: "Tracking number",
    trackingUrl: "Tracking link",
    cancel: "Cancel",
    confirm: "Mark as shipped",
    working: "Saving…",
    done: "Order marked as shipped.",
    byItems: "Refund by items",
    byItemsHint: "Choose how many of each item to refund; the amount is filled in for you and can still be changed.",
    refundQty: "Units of {name} to refund",
    of: "of {count}",
    calculate: "Calculate amount",
    calculating: "Calculating…",
    quoted: "These items come to {amount}.",
    reasonLine: "{quantity} × {name}",
  },
  ar: {
    shipped: "تعليم كمشحون",
    shippedTitle: "تعليم {number} كمشحون",
    shippedDescription: "لطرد سلّمته لشركة شحن بنفسك. صفحة التتبع عند العميل ستظهره كمشحون.",
    courier: "اسم شركة الشحن أو المندوب",
    courierPlaceholder: "توصيل خاص",
    tracking: "رقم التتبع",
    trackingUrl: "رابط التتبع",
    cancel: "إلغاء",
    confirm: "تعليم كمشحون",
    working: "بنحفظ…",
    done: "تم تعليم الأوردر كمشحون.",
    byItems: "استرداد حسب المنتجات",
    byItemsHint: "اختار عدد القطع المطلوب استردادها من كل منتج؛ المبلغ يُملأ تلقائيًا ويمكن تعديله.",
    refundQty: "عدد قطع {name} للاسترداد",
    of: "من {count}",
    calculate: "حساب المبلغ",
    calculating: "بنحسب…",
    quoted: "قيمة هذه المنتجات {amount}.",
    reasonLine: "{quantity} × {name}",
  },
} satisfies Messages;

/** "Shipped" by hand, with a tracking number and link (POST /orders/:id/fulfill). */
export function FulfillButton({ order, onChanged }: { order: Order; onChanged: () => void }) {
  const workspaceId = useWorkspaceId();
  const t = useT(STRINGS);
  const toast = useToast();
  const errorMessage = useOrderErrorMessage();
  const [open, setOpen] = useState(false);
  const [courier, setCourier] = useState("");
  const [tracking, setTracking] = useState("");
  const [url, setUrl] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (order.stage !== "ready_to_ship") return null;
  const waiting = (order.shipments ?? []).find((s) => s.status === "created");

  async function submit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await ordersFulfill(apiClient, workspaceId, order.id, {
        carrierCode: courier.trim() || undefined,
        trackingNumber: tracking.trim() || undefined,
        trackingUrl: url.trim() || undefined,
      });
      toast.success(t.done);
      setOpen(false);
      onChanged();
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <Button variant="outline" size="sm" className="min-h-11" onClick={() => setOpen(true)}>
        {t.shipped}
      </Button>
      <Modal
        open={open}
        onClose={() => (busy ? undefined : setOpen(false))}
        title={fmt(t.shippedTitle, { number: order.orderNumber })}
        description={t.shippedDescription}
      >
        <form onSubmit={submit} className="space-y-4" noValidate>
          {error && (
            <Alert variant="danger" role="alert">
              {error}
            </Alert>
          )}
          {!waiting && (
            <TextField
              label={t.courier}
              value={courier}
              maxLength={100}
              placeholder={t.courierPlaceholder}
              onChange={(e) => setCourier(e.target.value)}
            />
          )}
          <TextField label={t.tracking} dir="ltr" value={tracking} maxLength={100} onChange={(e) => setTracking(e.target.value)} />
          <TextField
            label={t.trackingUrl}
            dir="ltr"
            type="url"
            value={url}
            maxLength={500}
            placeholder="https://"
            onChange={(e) => setUrl(e.target.value)}
          />
          <div className="flex justify-end gap-3">
            <Button type="button" variant="outline" className="min-h-11" onClick={() => setOpen(false)} disabled={busy}>
              {t.cancel}
            </Button>
            <Button type="submit" className="min-h-11" disabled={busy}>
              {busy ? t.working : t.confirm}
            </Button>
          </div>
        </form>
      </Modal>
    </>
  );
}

/**
 * Inside the refund dialog: pick units per item, and the amount (less the
 * items' share of the order's discount) is worked out by the server and
 * handed to the dialog, with a line-by-line reason.
 */
export function RefundLinesPicker({
  order,
  onQuote,
}: {
  order: Order;
  onQuote: (amountMinor: number, reason: string) => void;
}) {
  const workspaceId = useWorkspaceId();
  const t = useT(STRINGS);
  const errorMessage = useOrderErrorMessage();
  const [open, setOpen] = useState(false);
  const [quantities, setQuantities] = useState<Record<string, number>>({});
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const chosen = order.items
    .map((item) => ({ orderItemId: item.id, quantity: quantities[item.id] ?? 0 }))
    .filter((line) => line.quantity > 0);

  async function calculate() {
    setBusy(true);
    setError(null);
    try {
      const quote = await ordersRefundQuote(apiClient, workspaceId, order.id, chosen);
      const reason = quote.lines.map((l) => fmt(t.reasonLine, { quantity: l.quantity, name: l.name })).join("، ");
      onQuote(Number(quote.amount), reason.slice(0, 300));
      setNote(fmt(t.quoted, { amount: formatMoney(quote.amount, quote.currency) }));
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="rounded-[0.5rem] border border-line p-3">
      <button
        type="button"
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
        className="min-h-11 cursor-pointer text-sm font-medium text-primary-dark hover:underline dark:text-primary"
      >
        {t.byItems}
      </button>
      {open && (
        <div className="mt-2 space-y-3">
          <p className="text-xs text-ink-soft">{t.byItemsHint}</p>
          <ul className="space-y-2">
            {order.items.map((item) => {
              const name = [item.productNameSnapshot, formatOptions(item.variantOptionsSnapshot)].filter(Boolean).join(" · ");
              return (
                <li key={item.id} className="flex flex-wrap items-center gap-2 text-sm">
                  <span className="min-w-0 flex-1 text-ink">{name}</span>
                  <Input
                    type="number"
                    min={0}
                    max={item.quantity}
                    value={quantities[item.id] ?? 0}
                    aria-label={fmt(t.refundQty, { name })}
                    onChange={(e) => {
                      const value = Math.min(item.quantity, Math.max(0, Math.floor(Number(e.target.value) || 0)));
                      setQuantities((prev) => ({ ...prev, [item.id]: value }));
                    }}
                    className="h-11 w-20"
                  />
                  <span className="text-xs text-ink-soft">{fmt(t.of, { count: item.quantity })}</span>
                </li>
              );
            })}
          </ul>
          {error && <p className="text-sm text-danger">{error}</p>}
          {note && !error && <p className="text-sm text-ink-soft">{note}</p>}
          <Button type="button" variant="outline" size="sm" className="min-h-11" disabled={busy || chosen.length === 0} onClick={calculate}>
            {busy ? t.calculating : t.calculate}
          </Button>
        </div>
      )}
    </div>
  );
}
