import { useState } from "react";
import { useParams } from "react-router-dom";
import { OrderDigitalSection } from "@/pages/digital/OrderDigitalSection";
import { apiClient } from "@/lib/apiClient";
import { useWorkspaceId } from "@/lib/useWorkspaceId";
import { useAsync } from "@/lib/useAsync";
import { formatDateTime } from "@/lib/format";
import { fmt, useT, type Messages } from "@/i18n/LocaleContext";
import { PageHeader } from "@/components/PageHeader";
import { DataState } from "@/components/DataState";
import { StatusBadge } from "@/components/StatusBadge";
import { OrderSummary } from "./components/OrderSummary";
import { OrderActions } from "./components/OrderActions";
import { ConfirmationPanel } from "./components/ConfirmationPanel";
import { ShipmentsSection } from "./components/ShipmentsSection";
import { ReturnsSection } from "./components/ReturnsSection";
import { PaymentsSection } from "./components/PaymentsSection";
import { StatusChanger } from "./components/StatusChanger";
import { OrderTimelineSection } from "./components/OrderTimelineSection";
import { OrderNotesCard } from "./components/OrderNotesCard";
import { OrderTagsCard } from "./components/OrderTagsCard";
import { OrderMetaActions, OrderMetaBadges, OrderNeighborArrows, useMarkSeen } from "./components/OrderHeaderTools";
import { STAGE_TONE, useOrderLabels } from "./orderLabels";
import { OrderProtectionSection } from "@/pages/fraud/OrderProtectionSection";
import { OrderAttributionSection } from "@/pages/marketing/OrderAttributionSection";

const STRINGS = {
  en: {
    order: "Order",
    back: "Orders",
    placed: "Placed {date}",
    confirmation: "Confirmation",
    payment: "Payment",
    fulfillment: "Fulfillment",
  },
  ar: {
    order: "الأوردر",
    back: "الأوردرات",
    placed: "تم الطلب {date}",
    confirmation: "التأكيد",
    payment: "الدفع",
    fulfillment: "التنفيذ",
  },
} satisfies Messages;

export function OrderDetailPage() {
  const { orderId } = useParams<{ orderId: string }>();
  const workspaceId = useWorkspaceId();
  const t = useT(STRINGS);
  const labels = useOrderLabels();

  const order = useAsync(
    () => apiClient.getOrder(workspaceId, orderId as string),
    [workspaceId, orderId]
  );
  const data = order.data;
  // Bumped on every reload: notes and seen do not move the order's updatedAt.
  const [refreshCount, setRefreshCount] = useState(0);
  const reload = () => {
    setRefreshCount((n) => n + 1);
    return order.refresh({ silent: true });
  };
  // Opening the page is what "seen" means.
  useMarkSeen(data, reload);

  return (
    <div className="max-w-5xl space-y-6">
      <PageHeader
        title={data ? data.orderNumber : t.order}
        back={{ to: "/orders", label: t.back }}
        description={data ? fmt(t.placed, { date: formatDateTime(data.createdAt) }) : undefined}
        titleBadge={
          data?.stage ? (
            <StatusBadge value={data.stage} tone={STAGE_TONE[data.stage]} text={labels.stage(data.stage)} />
          ) : undefined
        }
        actions={
          data ? (
            <>
              <OrderNeighborArrows order={data} />
              <StatusChanger order={data} onChanged={reload} />
            </>
          ) : undefined
        }
      />

      <DataState loading={order.loading} error={order.error} onRetry={() => order.refresh()}>
        {data && (
          <div className="space-y-6">
            <div className="flex flex-wrap items-center gap-2">
              <StatusBadge
                label={t.confirmation}
                value={data.confirmationState}
                text={labels.confirmation(data.confirmationState)}
              />
              <StatusBadge label={t.payment} value={data.financialState} text={labels.financial(data.financialState)} />
              <StatusBadge
                label={t.fulfillment}
                value={data.fulfillmentState}
                text={labels.fulfillment(data.fulfillmentState)}
              />
              <OrderMetaBadges order={data} />
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <OrderActions order={data} onChanged={reload} />
              <OrderMetaActions order={data} onChanged={reload} />
            </div>

            <ConfirmationPanel order={data} onChanged={reload} />

            <OrderSummary order={data} />

            <OrderProtectionSection order={data} />

            {/* Where the customer came from (first/last touch); nothing for an order without it. */}
            <OrderAttributionSection order={data} />

            <PaymentsSection order={data} onChanged={reload} />

            <OrderDigitalSection orderId={data.id} paid={data.financialState === "paid"} />

            <ShipmentsSection order={data} onChanged={reload} />

            <ReturnsSection order={data} onOrderMaybeChanged={reload} />

            <div className="grid gap-6 lg:grid-cols-2">
              <OrderNotesCard order={data} onChanged={reload} />
              <OrderTagsCard order={data} onChanged={reload} />
            </div>

            <OrderTimelineSection order={data} refreshKey={`${data.stage}:${data.updatedAt}:${refreshCount}`} />
          </div>
        )}
      </DataState>
    </div>
  );
}
