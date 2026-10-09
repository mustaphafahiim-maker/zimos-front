import { DELIVERY_SLOT_WEEKDAYS, deliverySlotSchedule, deliverySlotSettingsGet, pickupList, pickupSettingsGet } from "@store-builder/api-client";
import { apiClient } from "@/lib/apiClient";
import { useWorkspaceId } from "@/lib/useWorkspaceId";
import { useWorkspace } from "@/context/WorkspaceContext";
import { useAsync } from "@/lib/useAsync";
import { addDays, storeToday } from "@/pages/deliverySlots/slotText";

/** Which of the two daily work queues the store has a use for, and how many pickups are still open. */
export interface OrderQueues {
  /** «جدول التوصيل» — /orders/delivery-schedule. */
  schedule: boolean;
  /** «طلبات الاستلام» — /orders/pickups. */
  pickups: boolean;
  /** Pickups not handed over yet (waiting + ready). */
  open: number;
}

/**
 * The orders list's way in to the two daily work queues of the store's
 * delivery choices: «جدول التوصيل» (handoff 221) while shoppers choose a
 * delivery slot, and «طلبات الاستلام» (handoff 225) while they may pick up in
 * store — with how many pickups are still open. A queue stays after the
 * feature is switched off for as long as it still holds work: pickups not
 * handed over yet, orders booked into the coming days. A store that uses
 * neither gets null (and is asked nothing more than the two settings); both
 * pages stay reachable from their settings in Shipping. They are not sidebar
 * entries: only stores that switched the feature on need them.
 *
 * The list shows them as lines of its «أدوات» menu (OrdersHeaderTools.tsx).
 */
export function useOrderQueues(): OrderQueues | null {
  const workspaceId = useWorkspaceId();
  const { currentWorkspace } = useWorkspace();
  const today = storeToday(currentWorkspace?.timezone);
  const queues = useAsync(async (): Promise<OrderQueues> => {
    // A role that may not read them just gets no links.
    const [slots, pickup] = await Promise.all([
      deliverySlotSettingsGet(apiClient, workspaceId).catch(() => null),
      pickupSettingsGet(apiClient, workspaceId).catch(() => null),
    ]);
    // A store that switched pickup off may still hold orders to hand over: asked only when it once set a place up.
    let open = 0;
    if (pickup?.enabled || Object.keys(pickup?.locations ?? {}).length > 0) {
      const [pending, ready] = await Promise.all([
        pickupList(apiClient, workspaceId, { status: "pending", limit: 1 }).catch(() => null),
        pickupList(apiClient, workspaceId, { status: "ready", limit: 1 }).catch(() => null),
      ]);
      open = (pending?.total ?? 0) + (ready?.total ?? 0);
    }
    // The same for delivery times: orders already booked into the coming days are still due.
    let booked = false;
    if (slots && !slots.enabled && DELIVERY_SLOT_WEEKDAYS.some((d) => (slots.weekly?.[d] ?? []).length > 0)) {
      const days = await deliverySlotSchedule(apiClient, workspaceId, today, addDays(today, 60)).catch(() => []);
      booked = days.some((d) => d.slots.some((s) => s.orders.length > 0));
    }
    return { schedule: Boolean(slots?.enabled) || booked, pickups: Boolean(pickup?.enabled) || open > 0, open };
  }, [workspaceId, today]);

  const data = queues.data;
  if (!data || (!data.schedule && !data.pickups)) return null;
  return data;
}
