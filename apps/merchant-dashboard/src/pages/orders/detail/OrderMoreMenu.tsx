import { Fragment } from "react";
import { DirectionProvider } from "@base-ui/react/direction-provider";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@store-builder/ui";
import { ordersNextStages, type Order } from "@store-builder/api-client";
import {
  IconArchive,
  IconCancelled,
  IconCourier,
  IconDownload,
  IconEdit,
  IconExperiment,
  IconInvoice,
  IconLink,
  IconMoreActions,
  IconPlace,
  IconPrint,
  IconScan,
  IconSend,
  IconSwap,
  type IconComponent,
} from "@/components/icons";
import { useLocale, useT, type Messages } from "@/i18n/LocaleContext";
import { useViewNavigate } from "@/lib/viewTransition";
import { canEditItems } from "../components/EditItemsDialog";
import { bookingLockOf, revealShipmentCancel, useBookingLockText } from "../components/courierBookingLock";
import { orderActionGates } from "../components/OrderActions";
import { useOrderMetaActions } from "../components/OrderHeaderTools";
import { PACKING_STRINGS } from "../packing/packingStrings";
import type { OrderPageActions } from "./useOrderPageActions";

const STRINGS = {
  en: {
    tools: "Order tools",
    changeStatus: "Change status…",
    markShipped: "Mark as shipped…",
    editAddress: "Edit address and notes…",
    editItems: "Edit items…",
    waybill: "Download the waybill",
    invoice: "Invoice",
    invoiceBusy: "Preparing the invoice…",
    copyLink: "Copy the customer's tracking link",
    markTest: "Mark as a test order",
    unmarkTest: "Not a test order",
    webhook: "Resend to the webhook",
    archive: "Archive…",
    unarchive: "Restore from the archive",
    cancel: "Cancel the order…",
    cancelShipped: "It has shipped, so cancelling and editing are off. Open a return instead.",
  },
  ar: {
    tools: "أدوات الأوردر",
    changeStatus: "غيّر الحالة…",
    markShipped: "علّمه كمشحون…",
    editAddress: "عدّل العنوان والملاحظات…",
    editItems: "عدّل المنتجات…",
    waybill: "نزّل بوليصة الشحن",
    invoice: "الفاتورة",
    invoiceBusy: "بنجهّز الفاتورة…",
    copyLink: "انسخ لينك التتبع للعميل",
    markTest: "علّمه أوردر تجريبي",
    unmarkTest: "مش أوردر تجريبي",
    webhook: "ابعته للـ webhook تاني",
    archive: "أرشفة…",
    unarchive: "رجّعه من الأرشيف",
    cancel: "إلغاء الأوردر…",
    cancelShipped: "اتشحن، فالإلغاء والتعديل مقفولين. افتح مرتجع بداله.",
  },
} satisfies Messages;

interface Row {
  id: string;
  label: string;
  icon: IconComponent;
  onSelect: () => void;
  destructive?: boolean;
  disabled?: boolean;
  /** Why a disabled row is off; stays at full strength, it is the part to read. */
  reason?: string;
}

// The row of the list kit's menus (components/list/BulkBar.tsx): 36px under a mouse, 44px under a thumb.
const ITEM = "min-h-9 cursor-pointer items-start gap-3 rounded-[0.625rem] px-2.5 py-2 pointer-coarse:min-h-11 pointer-coarse:py-3";

/**
 * «…» in the order page's header: everything that used to sit in the action
 * row and under «أكتر», one tap away instead of on the page — change status
 * (the full dialog), mark as shipped, edit the address and notes, edit the
 * items, the waybill, the packing slip, scan to pack, the invoice, the
 * customer's tracking link, test order, resend to the webhook, archive, and
 * cancel last and apart. Each row shows only when its button used to: the
 * gates are the components' own (`orderActionGates`, `canEditItems`, the
 * server's `nextStages`, an active webhook).
 */
export function OrderMoreMenu({
  order,
  onChanged,
  actions,
}: {
  order: Order;
  onChanged: () => void;
  actions: OrderPageActions;
}) {
  const t = useT(STRINGS);
  const packing = useT(PACKING_STRINGS);
  const { dir } = useLocale();
  const navigate = useViewNavigate();
  const meta = useOrderMetaActions(order, onChanged);
  const gates = orderActionGates(order);
  // Booked with a courier and not picked up yet: the items, address and receiver wait for the booking to be cancelled (handoff 352).
  const lockText = useBookingLockText();
  const locked = bookingLockOf(order) !== null;
  const lock = locked ? { disabled: true, reason: lockText.hint } : {};

  const groups: Row[][] = [
    [
      ...(order.stage && ordersNextStages(order).length > 0
        ? [{ id: "status", label: t.changeStatus, icon: IconSwap, onSelect: () => actions.changeStatus() }]
        : []),
      ...(order.stage === "ready_to_ship"
        ? [{ id: "shipped", label: t.markShipped, icon: IconCourier, onSelect: actions.markShipped }]
        : []),
    ],
    [
      ...(gates.canEdit ? [{ id: "address", label: t.editAddress, icon: IconPlace, onSelect: actions.editAddress, ...lock }] : []),
      ...(canEditItems(order) ? [{ id: "items", label: t.editItems, icon: IconEdit, onSelect: actions.editItems, ...lock }] : []),
      ...(locked && (gates.canEdit || canEditItems(order))
        ? [{ id: "cancel-shipment", label: lockText.cancelShipment, icon: IconCourier, onSelect: revealShipmentCancel }]
        : []),
    ],
    [
      { id: "waybill", label: t.waybill, icon: IconDownload, onSelect: actions.downloadWaybill },
      ...(order.cancelledAt
        ? []
        : [
            { id: "slip", label: packing.printPackingSlip, icon: IconPrint, onSelect: actions.printPackingSlip },
            { id: "scan", label: packing.scanToPack, icon: IconScan, onSelect: () => navigate(`/orders/${order.id}/pack`) },
          ]),
      {
        id: "invoice",
        label: meta.invoiceBusy ? t.invoiceBusy : t.invoice,
        icon: IconInvoice,
        onSelect: meta.openInvoice,
        disabled: meta.invoiceBusy,
      },
      { id: "link", label: t.copyLink, icon: IconLink, onSelect: meta.copyTrackingLink },
    ],
    [
      {
        id: "test",
        label: meta.isTest ? t.unmarkTest : t.markTest,
        icon: IconExperiment,
        onSelect: meta.toggleTest,
        disabled: meta.testBusy,
      },
      ...(actions.webhookAvailable ? [{ id: "webhook", label: t.webhook, icon: IconSend, onSelect: actions.resendWebhook }] : []),
      meta.isArchived
        ? { id: "unarchive", label: t.unarchive, icon: IconArchive, onSelect: meta.unarchive }
        : { id: "archive", label: t.archive, icon: IconArchive, onSelect: meta.archive },
    ],
    [
      ...(gates.canCancel
        ? [{ id: "cancel", label: t.cancel, icon: IconCancelled, onSelect: actions.cancelOrder, destructive: true }]
        : gates.isShipped && !gates.isCancelled
          ? [{ id: "cancel", label: t.cancel, icon: IconCancelled, onSelect: () => undefined, disabled: true, reason: t.cancelShipped }]
          : []),
    ],
  ];
  const shown = groups.filter((group) => group.length > 0);

  return (
    <>
      <DirectionProvider direction={dir}>
        <DropdownMenu>
          <DropdownMenuTrigger
            render={
              <button
                type="button"
                aria-label={t.tools}
                title={t.tools}
                className="zimos-order-tool inline-flex size-11 shrink-0 cursor-pointer items-center justify-center rounded-full bg-paper-raised text-ink-soft ring-1 ring-line transition-[color,background-color,scale] duration-[var(--dur-fade)] ease-[var(--ease-out)] hover:text-ink focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary aria-expanded:text-ink motion-safe:active:scale-[0.97] pointer-fine:size-10 motion-reduce:transition-none"
              />
            }
          >
            <IconMoreActions className="size-5" weight="bold" aria-hidden />
          </DropdownMenuTrigger>
          <DropdownMenuContent
            side="bottom"
            align="end"
            sideOffset={8}
            className="w-auto max-w-[min(21rem,calc(100vw_-_1.5rem))] min-w-60 rounded-[1.125rem] p-1.5"
          >
            {shown.map((group, index) => (
              <Fragment key={group[0].id}>
                {index > 0 && <DropdownMenuSeparator className="mx-1.5" />}
                {group.map((row) => {
                  const RowIcon = row.icon;
                  const off = row.disabled === true;
                  return (
                    <DropdownMenuItem
                      key={row.id}
                      variant={row.destructive ? "destructive" : "default"}
                      disabled={off}
                      onClick={() => {
                        if (!off) row.onSelect();
                      }}
                      className={ITEM}
                    >
                      <RowIcon className="mt-px size-[18px] group-data-disabled/dropdown-menu-item:opacity-50" aria-hidden />
                      <span className="min-w-0 flex-1">
                        <span className="block group-data-disabled/dropdown-menu-item:opacity-50">{row.label}</span>
                        {off && row.reason && <span className="mt-0.5 block text-xs leading-4 text-ink-soft">{row.reason}</span>}
                      </span>
                    </DropdownMenuItem>
                  );
                })}
              </Fragment>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>
      </DirectionProvider>
      {/* The archive question lives outside the menu: the menu is gone by the time it is asked. */}
      {meta.dialog}
    </>
  );
}
