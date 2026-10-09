import { useState } from "react";
import { Link } from "react-router-dom";
import { IconPlace, IconStore } from "@/components/icons";
import { Button } from "@store-builder/ui";
import { PICKUP_LIST_LIMIT_MAX, isPickupStale, orderPickupOf, pickupList, pickupMarkReady, type Order, type PickupStatus } from "@store-builder/api-client";
import { apiClient } from "@/lib/apiClient";
import { useWorkspaceId } from "@/lib/useWorkspaceId";
import { useWorkspace } from "@/context/WorkspaceContext";
import { useAsync } from "@/lib/useAsync";
import { isPermissionError } from "@/lib/errors";
import { useErrorMessage } from "@/lib/errorMessages";
import { canManageOrderFulfilment } from "@/lib/fulfilmentAccess";
import { formatDateTime } from "@/lib/format";
import { fmt, useT } from "@/i18n/LocaleContext";
import { Section } from "@/components/Section";
import { StatusBadge } from "@/components/StatusBadge";
import { useToast } from "@/components/Toast";
import { HandOverDialog, type HandOverOrder } from "./HandOverDialog";
import { PICKUP_STATUS_KEY, PICKUP_STATUS_TONE, PICKUP_STRINGS } from "./pickupStrings";

/**
 * The order page of a click-and-collect order (handoff 225): where the
 * shopper collects it, in the place a delivery address would be — a pickup
 * order has none — with how far the pickup is and the two steps, «جاهز» and
 * «تسليم» (the shopper's 6-digit code). Nothing for a delivered order.
 *
 * The staff API has no "this order's pickup" call, so the state is read from
 * the place's two open queues (to prepare, ready); an order in neither is
 * collected or cancelled, as the order itself says.
 */
export function OrderPickupBlock({ order, onChanged }: { order: Order; onChanged: () => void }) {
  const t = useT(PICKUP_STRINGS);
  const workspaceId = useWorkspaceId();
  const { currentWorkspace } = useWorkspace();
  const canManage = canManageOrderFulfilment(currentWorkspace?.role);
  const toast = useToast();
  const errorMessage = useErrorMessage();
  const place = orderPickupOf(order);
  const [marking, setMarking] = useState(false);
  const [handingOver, setHandingOver] = useState<HandOverOrder | null>(null);

  const closed: PickupStatus | null = !place ? null : order.cancelledAt ? "cancelled" : order.fulfillmentState === "fulfilled" ? "collected" : null;
  const open = useAsync(
    async () => {
      if (!place || closed) return null;
      const query = { locationId: place.locationId, limit: PICKUP_LIST_LIMIT_MAX };
      const [ready, pending] = await Promise.all([
        pickupList(apiClient, workspaceId, { ...query, status: "ready" }).catch(() => null),
        pickupList(apiClient, workspaceId, { ...query, status: "pending" }).catch(() => null),
      ]);
      return ready?.pickups.find((p) => p.orderId === order.id) ?? pending?.pickups.find((p) => p.orderId === order.id) ?? null;
    },
    [workspaceId, order.id, order.updatedAt, place?.locationId, closed]
  );

  if (!place) return null;
  // An open order found in neither queue (a long queue's far end): it is still being prepared.
  const status: PickupStatus = closed ?? open.data?.status ?? "pending";
  const known = closed !== null || !open.loading;

  function changed() {
    void open.refresh({ silent: true });
    onChanged();
  }

  async function markReady() {
    if (marking) return;
    setMarking(true);
    try {
      const { emailed } = await pickupMarkReady(apiClient, workspaceId, order.id);
      toast.success(fmt(emailed ? t.readyDone : t.readyDoneNoEmail, { number: order.orderNumber }));
      changed();
    } catch (err) {
      if (isPickupStale(err)) {
        toast.error(t.stale);
        changed();
      } else {
        toast.error(isPermissionError(err) ? t.noOrderManage : errorMessage(err));
      }
    } finally {
      setMarking(false);
    }
  }

  return (
    <Section
      title={t.blockTitle}
      description={t.blockHint}
      actions={known ? <StatusBadge value={status} tone={PICKUP_STATUS_TONE[status]} text={t[PICKUP_STATUS_KEY[status]]} /> : undefined}
    >
      <div className="flex items-start gap-2.5">
        <IconStore className="mt-0.5 size-5 shrink-0 text-ink-soft" aria-hidden />
        <div className="min-w-0">
          <p className="text-[15px] font-semibold text-ink">
            <bdi>{place.name}</bdi>
          </p>
          {place.address && (
            <p className="mt-0.5 flex items-start gap-1.5 text-sm text-ink-soft">
              <IconPlace className="mt-0.5 size-4 shrink-0" aria-hidden />
              <bdi>{place.address}</bdi>
            </p>
          )}
          {status === "ready" && open.data?.readyAt && <p className="mt-1 text-xs text-ink-soft">{fmt(t.readySince, { time: formatDateTime(open.data.readyAt) })}</p>}
        </div>
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-2">
        {canManage && known && status === "pending" && (
          <Button type="button" variant="outline" className="min-h-11 rounded-full px-5" disabled={marking} aria-busy={marking || undefined} onClick={() => void markReady()}>
            {marking ? t.marking : t.markReady}
          </Button>
        )}
        {canManage && known && (status === "pending" || status === "ready") && (
          <Button
            type="button"
            className="min-h-11 rounded-full px-5"
            aria-haspopup="dialog"
            disabled={marking}
            onClick={() =>
              setHandingOver({
                id: order.id,
                orderNumber: order.orderNumber,
                customerName: order.contactSnapshot?.fullName,
                totalAmount: order.totalAmount,
                currency: order.currency,
                paid: order.financialState === "paid",
              })
            }
          >
            {t.handOver}
          </Button>
        )}
        <Link to="/orders/pickups" className="inline-flex min-h-11 items-center rounded-sm px-1 text-sm font-medium text-primary hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary">
          {t.openQueue}
        </Link>
      </div>

      <HandOverDialog order={handingOver} onClose={() => setHandingOver(null)} onDone={changed} />
    </Section>
  );
}
