import { useState } from "react";
import { cn } from "@store-builder/ui";
import {
  ORDER_STAGES_THAT_NOTIFY,
  manualCancelShipments,
  ordersChangeStatus,
  ordersNextStages,
  type Order,
  type OrderStage,
} from "@store-builder/api-client";
import { IconCaretDown, IconSpinner } from "@/components/icons";
import { Popover } from "@/components/Popover";
import { useToast } from "@/components/Toast";
import { apiClient } from "@/lib/apiClient";
import { useWorkspaceId } from "@/lib/useWorkspaceId";
import { fmt, useT, type Messages } from "@/i18n/LocaleContext";
import { orderActionGates } from "../components/OrderActions";
import { useOrderErrorMessage } from "../orderErrors";
import { STAGE_TONE, useOrderLabels, type BadgeTone } from "../orderLabels";
import { moveNeedsDialog } from "./orderMoves";
import type { OrderPageActions } from "./useOrderPageActions";

const STRINGS = {
  en: {
    change: "Status: {stage}. Change it",
    popover: "Move the order to another status",
    moveTo: "Move to",
    reopen: "Reopen the order",
    hint: "A move with nothing to ask happens at once, and you can undo it.",
    moved: "Moved to “{stage}”.",
  },
  ar: {
    change: "الحالة: {stage}. غيّرها",
    popover: "انقل الأوردر لحالة تانية",
    moveTo: "انقله لـ",
    reopen: "افتح الأوردر تاني",
    hint: "النقلة اللي مش محتاجة تفاصيل بتتم على طول، وتقدر تتراجع عنها.",
    moved: "اتنقل لـ «{stage}».",
  },
} satisfies Messages;

// The pill of components/StatusBadge.tsx, with room for a caret: same tints, so the glass layer treats both alike.
const TONE: Record<BadgeTone, string> = {
  neutral: "bg-paper-sunken text-ink-soft",
  info: "bg-primary-soft text-primary-dark",
  success: "bg-success-soft text-success",
  warning: "bg-accent-soft text-accent-dark",
  danger: "bg-danger-soft text-danger",
};

const DOT: Record<BadgeTone, string> = {
  neutral: "bg-ink-soft",
  info: "bg-primary",
  success: "bg-success",
  warning: "bg-accent",
  danger: "bg-danger",
};

const ROW =
  "flex min-h-11 w-full cursor-pointer items-center gap-2.5 rounded-[0.625rem] px-2.5 text-start text-sm font-medium text-ink transition-colors duration-[var(--dur-fade)] ease-[var(--ease-out)] hover:bg-paper-sunken focus-visible:outline-2 focus-visible:outline-primary pointer-fine:min-h-9 motion-reduce:transition-none";

/**
 * The order's stage, in the page header — and the way to change it in place.
 *
 * Pressing the chip lists the moves the server allows from here
 * (`order.nextStages`, the same list the change-status dialog offers). A
 * move that asks nothing is made at once: the chip shows the new stage right
 * away, the same `PATCH /orders/:id/status` the dialog sends goes out with
 * the status alone, and the toast offers Undo when the server lists the old
 * stage among the next ones. A move that asks something — a reason, the kind
 * of follow-up, a courier for an order with no shipment, reopening — opens
 * the dialog it always had with that stage chosen (a row ending in «…»), and
 * cancelling opens the cancel-order dialog (reason, refund, notify).
 */
export function OrderStageChip({
  order,
  onChanged,
  actions,
}: {
  order: Order;
  onChanged: () => void | Promise<void>;
  actions: Pick<OrderPageActions, "changeStatus" | "cancelOrder">;
}) {
  const t = useT(STRINGS);
  const labels = useOrderLabels();
  const workspaceId = useWorkspaceId();
  const toast = useToast();
  const errorMessage = useOrderErrorMessage();
  const [open, setOpen] = useState(false);
  // The stage the order is on its way to: shown at once, before the server answers.
  const [moving, setMoving] = useState<OrderStage | null>(null);

  const stage = order.stage;
  if (!stage) return null;
  const shown = moving ?? stage;
  const next = ordersNextStages(order);
  const reopening = stage === "cancelled";
  const interactive = next.length > 0;

  async function moveNow(target: OrderStage, previous: OrderStage) {
    setMoving(target);
    try {
      // Status alone: no reason, and the store's own settings decide what the customer hears.
      const updated = await ordersChangeStatus(apiClient, workspaceId, order.id, { status: target });
      const message = fmt(t.moved, { stage: labels.stage(updated.stage ?? target) });
      // Undo only where the way back is as plain as the way here.
      if (ordersNextStages(updated).includes(previous) && !moveNeedsDialog(updated, previous)) {
        toast.undo(message, async () => {
          await ordersChangeStatus(apiClient, workspaceId, order.id, {
            status: previous,
            // Taking a move back is a correction, not news for the customer.
            ...(ORDER_STAGES_THAT_NOTIFY.includes(previous) ? { notifyCustomer: false } : {}),
          });
          await onChanged();
        });
      } else {
        toast.success(message);
      }
      await onChanged();
    } catch (err) {
      // A courier booking that has to be cancelled by hand first: the dialog walks through it.
      if (manualCancelShipments(err).length > 0) actions.changeStatus(target);
      else toast.error(errorMessage(err));
    } finally {
      setMoving(null);
    }
  }

  function choose(target: OrderStage, current: OrderStage) {
    setOpen(false);
    if (target === "cancelled" && orderActionGates(order).canCancel) {
      actions.cancelOrder();
      return;
    }
    if (moveNeedsDialog(order, target)) {
      actions.changeStatus(target);
      return;
    }
    void moveNow(target, current);
  }

  const chip = (
    <span
      data-vt-part="status"
      data-slot="order-stage"
      className={cn(
        "inline-flex h-7 items-center gap-1.5 rounded-full ps-2.5 text-xs font-semibold whitespace-nowrap",
        interactive ? "pe-1.5" : "pe-2.5",
        TONE[STAGE_TONE[shown]]
      )}
    >
      <span aria-hidden className="size-1.5 shrink-0 rounded-full bg-current opacity-80" />
      {labels.stage(shown)}
      {interactive &&
        (moving ? (
          <IconSpinner className="size-3.5 shrink-0 animate-spin motion-reduce:animate-none" aria-hidden />
        ) : (
          <IconCaretDown className="size-3.5 shrink-0" weight="bold" aria-hidden />
        ))}
    </span>
  );

  if (!interactive) return <span className="inline-flex align-middle">{chip}</span>;

  return (
    <Popover
      open={open}
      onOpenChange={setOpen}
      side="bottom"
      align="start"
      label={t.popover}
      className="w-64 p-1.5"
      trigger={
        <button
          type="button"
          disabled={moving !== null}
          aria-busy={moving !== null || undefined}
          aria-label={fmt(t.change, { stage: labels.stage(shown) })}
          // The pill is 28px; the button around it gives a thumb its 44.
          className="zimos-order-stage inline-flex min-h-11 cursor-pointer items-center rounded-full align-middle transition-[scale] duration-[var(--dur-fade)] ease-[var(--ease-out)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary disabled:cursor-default motion-safe:active:scale-[0.97] pointer-fine:min-h-8 motion-reduce:transition-none"
        >
          {chip}
        </button>
      }
    >
      <p className="px-2.5 pt-1 pb-1.5 text-xs font-medium text-ink-soft">{t.moveTo}</p>
      <ul className="flex flex-col gap-1">
        {next.map((target) => {
          const asks = target === "cancelled" || moveNeedsDialog(order, target);
          return (
            <li key={target}>
              <button type="button" onClick={() => choose(target, stage)} className={cn(ROW, target === "cancelled" && "text-danger")}>
                <span aria-hidden className={cn("size-2 shrink-0 rounded-full", DOT[STAGE_TONE[target]])} />
                <span className="min-w-0 flex-1 truncate">
                  {reopening ? t.reopen : labels.stage(target)}
                  {/* The Mac's own sign for "this will ask you something first". */}
                  {asks ? "…" : ""}
                </span>
              </button>
            </li>
          );
        })}
      </ul>
      <p className="px-2.5 pt-2 pb-1 text-xs leading-5 text-ink-soft">{t.hint}</p>
    </Popover>
  );
}
