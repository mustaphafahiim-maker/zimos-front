import { useRef, useState, type ReactNode } from "react";
import { ordersNextStages, type Order, type OrderStage } from "@store-builder/api-client";
import { ResendToWebhookButton } from "@/pages/settings/WebhookExtras";
import { OrderActions, type OrderActionsHandle } from "../components/OrderActions";
import { EditItemsButton } from "../components/EditItemsDialog";
import { FulfillButton } from "../components/FulfillAndRefundLines";
import { StatusDialog } from "../components/StatusChanger";
import { PackingSlipsDialog } from "../packing/PackingSlipsDialog";

/** The order's own actions, as the page's menus and its stage chip call them. Each opens the form or dialog it always had. */
export interface OrderPageActions {
  /** The change-status dialog, optionally with one of the allowed stages already chosen. */
  changeStatus: (preselect?: OrderStage) => void;
  /** The cancel-order dialog (reason, refund, notify). */
  cancelOrder: () => void;
  editAddress: () => void;
  downloadWaybill: () => void;
  /** "Mark as shipped" by hand; only does something while the order is ready to ship. */
  markShipped: () => void;
  editItems: () => void;
  printPackingSlip: () => void;
  resendWebhook: () => void;
  /** Whether the store has an active webhook this viewer may resend to. */
  webhookAvailable: boolean;
}

/**
 * Where the order page keeps the dialogs of its actions.
 *
 * The buttons that used to open them sat in a row on the page; now they are
 * rows of the «…» menu and of the stage chip's popover, which leave the page
 * as soon as something is chosen. So the components that own each dialog are
 * mounted here once, without their buttons (`host`, rendered by the page),
 * and `actions` opens them. Nothing about what they do has moved.
 */
export function useOrderPageActions(order: Order, onChanged: () => void): { actions: OrderPageActions; host: ReactNode } {
  const orderActions = useRef<OrderActionsHandle>(null);
  const fulfill = useRef<{ open: () => void }>(null);
  const editItems = useRef<{ open: () => void }>(null);
  const webhook = useRef<{ resend: () => void }>(null);
  const [webhookAvailable, setWebhookAvailable] = useState(false);
  const [slipOpen, setSlipOpen] = useState(false);
  const [statusDialog, setStatusDialog] = useState<{ preselect?: OrderStage } | null>(null);
  const next = ordersNextStages(order);

  const actions: OrderPageActions = {
    changeStatus: (preselect) => setStatusDialog({ preselect }),
    cancelOrder: () => orderActions.current?.cancelOrder(),
    editAddress: () => orderActions.current?.editAddress(),
    downloadWaybill: () => orderActions.current?.downloadWaybill(),
    markShipped: () => fulfill.current?.open(),
    editItems: () => editItems.current?.open(),
    printPackingSlip: () => setSlipOpen(true),
    resendWebhook: () => webhook.current?.resend(),
    webhookAvailable,
  };

  const host = (
    <>
      {/* Only dialogs come out of these, and dialogs are drawn in <body>: nothing here takes room on the page. */}
      <div hidden>
        <OrderActions order={order} onChanged={onChanged} only="dialogs" actionsRef={orderActions} />
        <FulfillButton order={order} onChanged={onChanged} hideTrigger actionRef={fulfill} />
        <EditItemsButton order={order} onChanged={onChanged} hideTrigger actionRef={editItems} />
        <ResendToWebhookButton orderId={order.id} hideTrigger actionRef={webhook} onAvailable={setWebhookAvailable} />
      </div>
      <PackingSlipsDialog single open={slipOpen} orderIds={[order.id]} onClose={() => setSlipOpen(false)} />
      {statusDialog && order.stage && next.length > 0 && (
        <StatusDialog
          order={order}
          next={next}
          initialTarget={statusDialog.preselect}
          onClose={() => setStatusDialog(null)}
          onDone={() => {
            setStatusDialog(null);
            onChanged();
          }}
        />
      )}
    </>
  );

  return { actions, host };
}
