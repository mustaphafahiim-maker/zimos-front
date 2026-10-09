import { useState } from "react";
import { IconCash } from "@/components/icons";
import { Button, cn } from "@store-builder/ui";
import { isOnAccountOrder, orderPaymentDueAt, type Order } from "@store-builder/api-client";
import { useWorkspace } from "@/context/WorkspaceContext";
import { formatDate, formatMoney, parseMoney } from "@/lib/format";
import { useT } from "@/i18n/LocaleContext";
import { CardFrame } from "@/pages/orders/detail/CardFrame";
import { StatusBadge } from "@/components/StatusBadge";
import { canRecordPayments } from "./b2bAccess";
import { B2B_STRINGS } from "./b2bStrings";
import { RecordPaymentDialog } from "./RecordPaymentDialog";

/**
 * The order page's «الدفع الآجل» card (handoff 229), on an on-account order
 * only: when it is due, what was paid and what is left — late in the danger
 * colour with the word «متأخر» — and «سجّل دفعة» (orders.manage). The courier
 * collects nothing for such an order.
 */
export function OrderOnAccountCard({
  order,
  onChanged,
  frameless,
}: {
  order: Order;
  onChanged: () => void | Promise<void>;
  /** Inside a folding section of the order page: no card and no title of its own. */ frameless?: boolean;
}) {
  const t = useT(B2B_STRINGS);
  const { currentWorkspace } = useWorkspace();
  const [paying, setPaying] = useState(false);
  if (!isOnAccountOrder(order)) return null;

  const money = (n: number | string) => formatMoney(n, order.currency);
  const dueAt = orderPaymentDueAt(order);
  const paid = parseMoney(order.amountPaid);
  const left = Math.max(0, parseMoney(order.totalAmount) - paid);
  const cancelled = Boolean(order.cancelledAt);
  const overdue = !cancelled && left > 0 && dueAt !== null && new Date(dueAt).getTime() < Date.now();
  const canRecord = canRecordPayments(currentWorkspace?.role) && !cancelled && left > 0;

  return (
    <CardFrame
      frameless={frameless}
      title={t.orderOnAccountTitle}
      description={t.orderOnAccountHint}
      actions={
        canRecord ? (
          <Button type="button" variant="outline" className="min-h-11" onClick={() => setPaying(true)}>
            <IconCash className="size-4" aria-hidden />
            {t.recordPayment}
          </Button>
        ) : undefined
      }
    >
      <dl className="grid gap-3 text-sm sm:grid-cols-3">
        <div className="rounded-[0.5rem] bg-paper px-3 py-2">
          <dt className="text-xs text-ink-soft">{t.orderDue}</dt>
          <dd className="flex flex-wrap items-center gap-2">
            <span className={cn("font-medium", overdue ? "text-danger" : "text-ink")}>{formatDate(dueAt)}</span>
            {/* Never the colour alone: the word says it too. */}
            {overdue && <StatusBadge value="overdue" tone="danger" text={t.overdue} />}
          </dd>
        </div>
        <div className="rounded-[0.5rem] bg-paper px-3 py-2">
          <dt className="text-xs text-ink-soft">{t.orderPaidSoFar}</dt>
          <dd className="font-medium text-ink tabular-nums">{money(paid)}</dd>
        </div>
        <div className="rounded-[0.5rem] bg-paper px-3 py-2">
          <dt className="text-xs text-ink-soft">{t.orderLeft}</dt>
          <dd className={cn("font-medium tabular-nums", overdue ? "text-danger" : "text-ink")}>{left > 0 ? money(left) : t.orderFullyPaid}</dd>
        </div>
      </dl>

      <RecordPaymentDialog
        target={paying ? { orderId: order.id, orderNumber: order.orderNumber, due: left, currency: order.currency } : null}
        onClose={() => setPaying(false)}
        onRecorded={() => onChanged()}
        onStale={() => onChanged()}
      />
    </CardFrame>
  );
}
