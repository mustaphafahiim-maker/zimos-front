import { useParams } from "react-router-dom";
import { apiClient } from "@/lib/apiClient";
import { useWorkspaceId } from "@/lib/useWorkspaceId";
import { useAsync } from "@/lib/useAsync";
import { formatDateTime } from "@/lib/format";
import { useT, fmt, type Messages } from "@/i18n/LocaleContext";
import { PageHeader } from "@/components/PageHeader";
import { DataState } from "@/components/DataState";
import { StatusBadge } from "@/components/StatusBadge";
import { OrderSummary } from "./components/OrderSummary";
import { OrderActions } from "./components/OrderActions";
import { ShipmentsSection } from "./components/ShipmentsSection";
import { ReturnsSection } from "./components/ReturnsSection";
import { ltr } from "./orderLabels";

const STRINGS = {
  en: {
    order: "Order",
    orders: "Orders",
    placed: "Placed {date}",
    confirmation: "Confirmation",
    payment: "Payment",
    fulfilment: "Fulfilment",
  },
  ar: {
    order: "الطلب",
    orders: "الطلبات",
    placed: "تاريخ الطلب: {date}",
    confirmation: "التأكيد",
    payment: "الدفع",
    fulfilment: "الشحن",
  },
} satisfies Messages;

export function OrderDetailPage() {
  const t = useT(STRINGS);
  const { orderId } = useParams<{ orderId: string }>();
  const workspaceId = useWorkspaceId();

  const order = useAsync(
    () => apiClient.getOrder(workspaceId, orderId as string),
    [workspaceId, orderId]
  );
  const data = order.data;
  const reload = () => order.refresh({ silent: true });

  return (
    <div className="max-w-5xl min-w-0 space-y-6">
      <PageHeader
        title={data ? ltr(data.orderNumber) : t.order}
        back={{ to: "/orders", label: t.orders }}
        description={data ? fmt(t.placed, { date: formatDateTime(data.createdAt) }) : undefined}
      />

      <DataState loading={order.loading} error={order.error} onRetry={() => order.refresh()}>
        {data && (
          <div className="space-y-6">
            <div className="flex flex-wrap items-center gap-2">
              <StatusBadge label={t.confirmation} value={data.confirmationState} />
              <StatusBadge label={t.payment} value={data.financialState} />
              <StatusBadge label={t.fulfilment} value={data.fulfillmentState} />
            </div>

            <OrderActions order={data} onChanged={reload} />

            <OrderSummary order={data} />

            <ShipmentsSection
              orderId={data.id}
              shipments={data.shipments ?? []}
              orderCancelled={Boolean(data.cancelledAt)}
              onChanged={reload}
            />

            <ReturnsSection order={data} onOrderMaybeChanged={reload} />
          </div>
        )}
      </DataState>
    </div>
  );
}
