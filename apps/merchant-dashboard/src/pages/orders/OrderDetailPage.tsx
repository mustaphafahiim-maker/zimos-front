import { useNavigate, useParams } from "react-router-dom";
import { Copy, MessageCircle } from "lucide-react";
import { Button, buttonVariants } from "@store-builder/ui";
import { apiClient } from "@/lib/apiClient";
import { useWorkspaceId } from "@/lib/useWorkspaceId";
import { useAsync } from "@store-builder/ui";
import { formatDateTime } from "@/lib/format";
import { useT, fmt, type Messages } from "@/i18n/LocaleContext";
import { PageHeader } from "@/components/PageHeader";
import { DataState } from "@/components/DataState";
import { StatusBadge } from "@/components/StatusBadge";
import { OrderSummary } from "./components/OrderSummary";
import { OrderActions } from "./components/OrderActions";
import { ShipmentsSection } from "./components/ShipmentsSection";
import { ReturnsSection } from "./components/ReturnsSection";
import { OrderTimeline } from "./components/OrderTimeline";
import { whatsappUrl } from "./newOrder";
import { ltr } from "./orderLabels";

const STRINGS = {
  en: {
    order: "Order",
    orders: "Orders",
    placed: "Placed {date}",
    confirmation: "Confirmation",
    payment: "Payment",
    fulfilment: "Fulfilment",
    duplicate: "Duplicate order",
    whatsapp: "WhatsApp customer",
  },
  ar: {
    order: "الطلب",
    orders: "الطلبات",
    placed: "تاريخ الطلب: {date}",
    confirmation: "التأكيد",
    payment: "الدفع",
    fulfilment: "الشحن",
    duplicate: "تكرار الطلب",
    whatsapp: "واتساب العميل",
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
  const navigate = useNavigate();
  const wa = whatsappUrl(data?.contactSnapshot?.phone);

  return (
    <div className="max-w-5xl min-w-0 space-y-6">
      <PageHeader
        title={data ? ltr(data.orderNumber) : t.order}
        back={{ to: "/orders", label: t.orders }}
        description={data ? fmt(t.placed, { date: formatDateTime(data.createdAt) }) : undefined}
        actions={
          data ? (
            <>
              {wa && (
                <a href={wa} target="_blank" rel="noopener noreferrer" className={buttonVariants({ variant: "outline", size: "sm" })}>
                  <MessageCircle aria-hidden /> {t.whatsapp}
                </a>
              )}
              <Button variant="outline" size="sm" onClick={() => navigate("/orders/new", { state: { duplicateFrom: data } })}>
                <Copy aria-hidden /> {t.duplicate}
              </Button>
            </>
          ) : undefined
        }
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

            <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_300px]">
              <div className="min-w-0">
                <OrderSummary order={data} />
              </div>
              <OrderTimeline order={data} />
            </div>

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
