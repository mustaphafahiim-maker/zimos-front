import { useState } from "react";
import { Link } from "react-router-dom";
import { IconSchedule } from "@/components/icons";
import { Button } from "@store-builder/ui";
import { deliverySlotOf, deliverySlotSettingsGet, orderPickupOf, type DeliverySlotSettings, type Order } from "@store-builder/api-client";
import { apiClient } from "@/lib/apiClient";
import { useWorkspaceId } from "@/lib/useWorkspaceId";
import { useWorkspace } from "@/context/WorkspaceContext";
import { useAsync } from "@/lib/useAsync";
import { canManageOrderFulfilment } from "@/lib/fulfilmentAccess";
import { useT } from "@/i18n/LocaleContext";
import { Section } from "@/components/Section";
import { ChangeDeliverySlotDialog } from "./ChangeDeliverySlotDialog";
import { DELIVERY_SLOT_STRINGS } from "./deliverySlotStrings";
import { slotDayName, slotRange, storeToday } from "./slotText";

// The store's slots, kept a minute per store: paging through orders asks once, not once per order.
const CACHE_MS = 60_000;
const cache = new Map<string, { at: number; request: Promise<DeliverySlotSettings | null> }>();

function slotSettings(workspaceId: string): Promise<DeliverySlotSettings | null> {
  const hit = cache.get(workspaceId);
  if (hit && Date.now() - hit.at < CACHE_MS) return hit.request;
  // A role that may not read them (or a failed call) simply shows the order's own time, without "Change".
  const request = deliverySlotSettingsGet(apiClient, workspaceId).catch(() => null);
  cache.set(workspaceId, { at: Date.now(), request });
  return request;
}

/**
 * The order page's «ميعاد التوصيل» (handoff 221): the day and slot the shopper
 * chose (`shippingSnapshot.deliverySlot`), with «تغيير» for whoever may manage
 * orders. An order without one shows "Set a time" while the store offers
 * slots and the order is still to be delivered — a phone order, or one placed
 * where a slot was optional. Nothing for a pickup order without a slot, and
 * nothing for a store that has no slots.
 */
export function OrderDeliveryTime({ order, onChanged }: { order: Order; onChanged: () => void }) {
  const t = useT(DELIVERY_SLOT_STRINGS);
  const workspaceId = useWorkspaceId();
  const { currentWorkspace } = useWorkspace();
  const [open, setOpen] = useState(false);
  const settings = useAsync(() => slotSettings(workspaceId), [workspaceId]);

  const slot = deliverySlotOf(order);
  // Still to be delivered: not cancelled, not handed over, not returned.
  const pending = !order.cancelledAt && order.fulfillmentState !== "fulfilled" && order.fulfillmentState !== "returned";
  const hasWeek = Object.values(settings.data?.weekly ?? {}).some((day) => (day ?? []).length > 0);
  // "Set a time" only where it means something: the store offers slots and this order is delivered to an address.
  const canSet = !slot && pending && Boolean(settings.data?.enabled) && hasWeek && !orderPickupOf(order);
  if (!slot && !canSet) return null;

  const canChange = pending && hasWeek && canManageOrderFulfilment(currentWorkspace?.role);

  return (
    <Section
      title={t.deliveryTime}
      actions={
        canChange ? (
          <Button type="button" variant="outline" size="sm" className="min-h-11 rounded-full px-4 pointer-fine:min-h-9" aria-haspopup="dialog" onClick={() => setOpen(true)}>
            {slot ? t.change : t.setTime}
          </Button>
        ) : undefined
      }
    >
      <div className="flex items-start gap-2.5">
        <IconSchedule className="mt-0.5 size-5 shrink-0 text-ink-soft" aria-hidden />
        {slot ? (
          <p className="min-w-0 text-[15px] font-semibold text-ink">
            {slotDayName(slot.date)}
            <span className="mx-1.5 font-normal text-ink-soft" aria-hidden>
              ·
            </span>
            <span className="tabular-nums">{slotRange(slot.from, slot.to)}</span>
          </p>
        ) : (
          <p className="text-sm text-ink-soft">{t.noTime}</p>
        )}
      </div>
      {slot && (
        <Link to="/orders/delivery-schedule" className="mt-1 inline-flex min-h-11 items-center rounded-sm text-sm font-medium text-primary hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary pointer-fine:min-h-8">
          {t.openSchedule}
        </Link>
      )}

      {settings.data && (
        <ChangeDeliverySlotDialog
          open={open}
          orderId={order.id}
          current={slot}
          settings={settings.data}
          today={storeToday(currentWorkspace?.timezone)}
          onClose={() => setOpen(false)}
          onSaved={onChanged}
          onSlotsChanged={() => {
            cache.delete(workspaceId);
            void settings.refresh({ silent: true });
          }}
        />
      )}
    </Section>
  );
}
