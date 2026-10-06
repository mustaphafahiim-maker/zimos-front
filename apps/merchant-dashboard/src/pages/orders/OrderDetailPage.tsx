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
import { OrderHero } from "./components/OrderHero";
import { OrderActions } from "./components/OrderActions";
import { WhatsappConfirmButton } from "./components/WhatsappConfirmButton";
import { OrderDiscountsCard } from "./components/OrderDiscountsCard";
import { ResendToWebhookButton } from "@/pages/settings/WebhookExtras";
import { ConfirmationPanel } from "./components/ConfirmationPanel";
import { ShipmentsSection } from "./components/ShipmentsSection";
import { OrderSupplierCard } from "./components/OrderSupplierCard";
import { ReturnsSection } from "./components/ReturnsSection";
import { PaymentsSection } from "./components/PaymentsSection";
import { StatusChanger } from "./components/StatusChanger";
import { OrderTimelineSection } from "./components/OrderTimelineSection";
import { OrderNotesCard } from "./components/OrderNotesCard";
import { EditItemsButton } from "./components/EditItemsDialog";
import { FulfillButton } from "./components/FulfillAndRefundLines";
import { OrderTagsCard } from "./components/OrderTagsCard";
import { OrderMetaActions, OrderMetaBadges, OrderNeighborArrows, useMarkSeen } from "./components/OrderHeaderTools";
import { STAGE_TONE, useOrderLabels } from "./orderLabels";
import { OrderProtectionSection } from "@/pages/fraud/OrderProtectionSection";
import { OrderAttributionSection } from "@/pages/marketing/OrderAttributionSection";
import { CustomerHistoryBadge, OrderSessionCard, useLastActionText, useOrderSessionDetails } from "./components/OrderSessionDetails";

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
    placed: "اتطلب {date}",
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
  // Session details, the customer's order count and the last action (SPEC §4.4).
  const session = useOrderSessionDetails(data?.id, `${data?.updatedAt}:${refreshCount}`);
  const lastAction = useLastActionText()(session.data?.lastAction);

  return (
    <div className="max-w-6xl space-y-[var(--bento-gap)]">
      <PageHeader
        title={data ? data.orderNumber : t.order}
        back={{ to: "/orders", label: t.back }}
        description={data ? [fmt(t.placed, { date: formatDateTime(data.createdAt) }), lastAction].filter(Boolean).join(" · ") : undefined}
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
          <div className="space-y-[var(--bento-gap)]">
            {/* Who, how to reach them, what they owe and the one next step. */}
            <OrderHero order={data} />

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
              <CustomerHistoryBadge details={session.data} />
            </div>

            {/* The order's actions; one swipeable row on a phone. */}
            <div className="-mx-4 flex items-center gap-2 overflow-x-auto px-4 pb-1 sm:mx-0 sm:flex-wrap sm:overflow-visible sm:px-0">
              <OrderActions order={data} onChanged={reload} />
              <WhatsappConfirmButton order={data} onChanged={reload} />
              <EditItemsButton order={data} onChanged={reload} />
              <FulfillButton order={data} onChanged={reload} />
              <OrderMetaActions order={data} onChanged={reload} />
              <ResendToWebhookButton orderId={data.id} />
            </div>

            {/* The work (confirm, items, ship, pay, return) on the wide side;
                notes, tags and the background details beside it. On a phone
                the work comes first. */}
            <div className="grid items-start gap-[var(--bento-gap)] lg:grid-cols-3">
              <div className="min-w-0 space-y-[var(--bento-gap)] lg:col-span-2">
                <div id="order-confirmation" className="scroll-mt-24">
                  <ConfirmationPanel order={data} onChanged={reload} />
                </div>

                <OrderSummary order={data} onChanged={reload} />

                <div id="order-shipments" className="scroll-mt-24">
                  <ShipmentsSection order={data} onChanged={reload} />
                </div>

                <div id="order-payments" className="scroll-mt-24">
                  <PaymentsSection order={data} onChanged={reload} />
                </div>

                <OrderDigitalSection orderId={data.id} paid={data.financialState === "paid"} />

                <ReturnsSection order={data} onOrderMaybeChanged={reload} />

                <OrderTimelineSection order={data} refreshKey={`${data.stage}:${data.updatedAt}:${refreshCount}`} />
              </div>

              <div className="min-w-0 space-y-[var(--bento-gap)]">
                <OrderNotesCard order={data} onChanged={reload} />
                <OrderTagsCard order={data} onChanged={reload} />
                <OrderDiscountsCard order={data} />
                <OrderProtectionSection order={data} />
                {/* Where the customer came from (first/last touch); nothing for an order without it. */}
                <OrderAttributionSection order={data} />
                <OrderSessionCard details={session.data} />
                <OrderSupplierCard order={data} onChanged={reload} />
              </div>
            </div>
          </div>
        )}
      </DataState>
    </div>
  );
}
