import { useState } from "react";
import { Link } from "react-router-dom";
import type {
  ConfirmationState,
  FinancialState,
  FulfillmentState,
  Order,
} from "@store-builder/api-client";
import { apiClient } from "@/lib/apiClient";
import { useWorkspaceId } from "@/lib/useWorkspaceId";
import { useCursorList } from "@/lib/useCursorList";
import { formatDate, formatMoney } from "@/lib/format";
import { useT, type Messages } from "@/i18n/LocaleContext";
import { PageHeader } from "@/components/PageHeader";
import { DataState } from "@/components/DataState";
import { StatusBadge } from "@/components/StatusBadge";
import { LoadMore } from "@/components/LoadMore";
import { Select } from "@/components/Select";
import { useEnumLabel } from "./orderLabels";

const STRINGS = {
  en: {
    title: "Orders",
    description: "Every order, with its confirmation, payment, and fulfilment state.",
    anyConfirmation: "Any confirmation",
    anyPayment: "Any payment",
    anyFulfilment: "Any fulfilment",
    confirmationFilter: "Filter by confirmation",
    paymentFilter: "Filter by payment",
    fulfilmentFilter: "Filter by fulfilment",
    empty: "No orders match these filters.",
    colOrder: "Order",
    colCustomer: "Customer",
    colTotal: "Total",
    colState: "State",
    colDate: "Date",
    badgeConf: "Conf",
    badgePay: "Pay",
    badgeShip: "Ship",
  },
  ar: {
    title: "الطلبات",
    description: "كل الطلبات مع حالة التأكيد والدفع والشحن لكل طلب.",
    anyConfirmation: "أي حالة تأكيد",
    anyPayment: "أي حالة دفع",
    anyFulfilment: "أي حالة شحن",
    confirmationFilter: "تصفية حسب التأكيد",
    paymentFilter: "تصفية حسب الدفع",
    fulfilmentFilter: "تصفية حسب الشحن",
    empty: "لا توجد طلبات تطابق عوامل التصفية هذه.",
    colOrder: "الطلب",
    colCustomer: "العميل",
    colTotal: "الإجمالي",
    colState: "الحالة",
    colDate: "التاريخ",
    badgeConf: "التأكيد",
    badgePay: "الدفع",
    badgeShip: "الشحن",
  },
} satisfies Messages;

const CONFIRMATION: ConfirmationState[] = [
  "pending",
  "confirmed",
  "rejected",
  "unreachable",
  "postponed",
];
const FINANCIAL: FinancialState[] = [
  "pending",
  "partially_paid",
  "paid",
  "failed",
  "refunded",
  "partially_refunded",
];
const FULFILLMENT: FulfillmentState[] = [
  "unfulfilled",
  "partially_fulfilled",
  "fulfilled",
  "returned",
];

export function OrdersListPage() {
  const t = useT(STRINGS);
  const label = useEnumLabel();
  const workspaceId = useWorkspaceId();
  const [confirmationState, setConfirmationState] = useState<ConfirmationState | "">("");
  const [financialState, setFinancialState] = useState<FinancialState | "">("");
  const [fulfillmentState, setFulfillmentState] = useState<FulfillmentState | "">("");

  const list = useCursorList<Order>(
    (cursor) =>
      apiClient
        .listOrders(workspaceId, {
          cursor,
          limit: 50,
          confirmationState: confirmationState || undefined,
          financialState: financialState || undefined,
          fulfillmentState: fulfillmentState || undefined,
        })
        .then((r) => ({ items: r.orders, nextCursor: r.nextCursor })),
    [workspaceId, confirmationState, financialState, fulfillmentState]
  );

  return (
    <div className="max-w-6xl min-w-0">
      <PageHeader title={t.title} description={t.description} />

      <div className="mb-4 grid gap-3 sm:grid-cols-3">
        <Select
          aria-label={t.confirmationFilter}
          value={confirmationState}
          onChange={(e) => setConfirmationState(e.target.value as ConfirmationState | "")}
        >
          <option value="">{t.anyConfirmation}</option>
          {CONFIRMATION.map((s) => (
            <option key={s} value={s}>
              {label(s)}
            </option>
          ))}
        </Select>
        <Select
          aria-label={t.paymentFilter}
          value={financialState}
          onChange={(e) => setFinancialState(e.target.value as FinancialState | "")}
        >
          <option value="">{t.anyPayment}</option>
          {FINANCIAL.map((s) => (
            <option key={s} value={s}>
              {label(s)}
            </option>
          ))}
        </Select>
        <Select
          aria-label={t.fulfilmentFilter}
          value={fulfillmentState}
          onChange={(e) => setFulfillmentState(e.target.value as FulfillmentState | "")}
        >
          <option value="">{t.anyFulfilment}</option>
          {FULFILLMENT.map((s) => (
            <option key={s} value={s}>
              {label(s)}
            </option>
          ))}
        </Select>
      </div>

      <DataState
        loading={list.loading}
        error={list.items.length ? null : list.error}
        empty={list.items.length === 0}
        emptyMessage={t.empty}
        onRetry={list.reload}
      >
        <div className="overflow-x-auto rounded-2xl border border-line bg-paper-raised">
          <table className="w-full min-w-[820px] text-sm">
            <thead>
              <tr className="sticky top-0 z-10 border-b border-line bg-paper-raised text-start text-xs uppercase tracking-wide text-ink-soft">
                <th className="px-4 py-3 text-start font-medium">{t.colOrder}</th>
                <th className="px-4 py-3 text-start font-medium">{t.colCustomer}</th>
                <th className="px-4 py-3 text-end font-medium">{t.colTotal}</th>
                <th className="px-4 py-3 text-start font-medium">{t.colState}</th>
                <th className="px-4 py-3 text-start font-medium">{t.colDate}</th>
              </tr>
            </thead>
            <tbody>
              {list.items.map((order) => (
                <tr
                  key={order.id}
                  className="border-b border-line bg-paper last:border-0 hover:bg-paper-raised"
                >
                  <td className="px-4 py-3 text-start">
                    <Link
                      to={`/orders/${order.id}`}
                      className="font-medium text-ink hover:text-primary"
                    >
                      <span dir="ltr">{order.orderNumber}</span>
                    </Link>
                  </td>
                  <td className="px-4 py-3 text-start text-ink-soft">
                    {order.contactSnapshot?.fullName || "—"}
                  </td>
                  <td className="px-4 py-3 text-end tabular-nums text-ink-soft">
                    <bdi>{formatMoney(order.totalAmount, order.currency)}</bdi>
                  </td>
                  <td className="px-4 py-3 text-start">
                    <div className="flex flex-wrap gap-1">
                      <StatusBadge label={t.badgeConf} value={order.confirmationState} />
                      <StatusBadge label={t.badgePay} value={order.financialState} />
                      <StatusBadge label={t.badgeShip} value={order.fulfillmentState} />
                    </div>
                  </td>
                  <td className="px-4 py-3 text-start text-ink-soft">{formatDate(order.createdAt)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <LoadMore hasMore={list.hasMore} loading={list.loadingMore} onClick={list.loadMore} />
      </DataState>
    </div>
  );
}
