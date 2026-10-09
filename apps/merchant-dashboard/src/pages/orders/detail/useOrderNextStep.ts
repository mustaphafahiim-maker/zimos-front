import { useState } from "react";
import type { Order, OrderStage } from "@store-builder/api-client";
import { IconCash, IconConfirm, IconCourier, IconPackageSearch, IconRepeat, type IconComponent } from "@/components/icons";
import { useWorkspace } from "@/context/WorkspaceContext";
import { fmt, useT, type Messages } from "@/i18n/LocaleContext";
import { FINISHED_SHIPMENT_STATUSES, SHIPPING_ROLES } from "@/pages/shipping/carriers";
import type { ConfirmationGate } from "./useConfirmationGate";
import type { OrderSectionControl } from "./useSectionOpen";

const STRINGS = {
  en: {
    awaiting_payment: "Waiting for the customer to pay online.",
    pending_confirmation: "Confirm the order with the customer before shipping it.",
    needs_follow_up: "The customer didn't answer or asked to wait. Call again.",
    ready_to_ship: "Confirmed. Book the courier and print the waybill.",
    ready_to_ship_booked: "Confirmed, and a shipment is already booked for it.",
    shipped: "With the courier. Nothing to do until it is delivered.",
    out_for_delivery: "Out for delivery today.",
    delivery_failed: "Delivery failed. Call the customer and agree on a new time.",
    delivered: "Delivered. The cash arrives with the courier's settlement.",
    returned: "Came back as a return.",
    cancelled: "Cancelled.",
    cancelledBecause: "Cancelled: {reason}",
    confirm: "Confirm the order",
    confirming: "Confirming…",
    book: "Book the courier",
    track: "Track the shipment",
    retry: "Try the delivery again",
    payment: "Check the payment",
    heldBy: "{name} is on this call now.",
    assignedTo: "Assigned to {name}.",
    someone: "A teammate",
    waiting: "Waiting for the sales funnel's offers to end.",
  },
  ar: {
    awaiting_payment: "مستني العميل يدفع أونلاين.",
    pending_confirmation: "أكّد الأوردر مع العميل قبل ما تشحنه.",
    needs_follow_up: "العميل مردّش أو طلب يأجّل. كلّمه تاني.",
    ready_to_ship: "متأكد. احجز المندوب واطبع البوليصة.",
    ready_to_ship_booked: "متأكد، وفيه شحنة محجوزة له.",
    shipped: "مع المندوب. مفيش حاجة تعملها لحد ما يتسلّم.",
    out_for_delivery: "خرج للتوصيل النهارده.",
    delivery_failed: "التوصيل فشل. كلّم العميل واتفقوا على ميعاد تاني.",
    delivered: "اتسلّم. الفلوس هتيجي مع تحصيل شركة الشحن.",
    returned: "رجع مرتجع.",
    cancelled: "اتلغى.",
    cancelledBecause: "اتلغى: {reason}",
    confirm: "أكّد الأوردر",
    confirming: "بنأكّد…",
    book: "احجز المندوب",
    track: "تابع الشحنة",
    retry: "جرّب التوصيل تاني",
    payment: "راجع الدفع",
    heldBy: "{name} بيكلّم العميل دلوقتي.",
    assignedTo: "متوزّع على {name}.",
    someone: "حد من الفريق",
    waiting: "مستني عروض مسار البيع تخلص.",
  },
} satisfies Messages;

export type NextStepTone = "attention" | "primary" | "danger" | "success" | "neutral";

const STAGE_TONE: Record<OrderStage, NextStepTone> = {
  awaiting_payment: "attention",
  pending_confirmation: "attention",
  needs_follow_up: "attention",
  ready_to_ship: "primary",
  shipped: "neutral",
  out_for_delivery: "neutral",
  delivery_failed: "danger",
  delivered: "success",
  returned: "neutral",
  cancelled: "neutral",
};

/** The one button. Either it runs something (`onClick`) or it leaves for the courier's own tracking page (`href`). */
export interface NextStepAction {
  label: string;
  icon: IconComponent;
  onClick?: () => void;
  href?: string;
  busy?: boolean;
  disabled?: boolean;
}

export interface OrderNextStep {
  stage: OrderStage;
  /** What happens next, in one sentence. Always there, button or not. */
  sentence: string;
  tone: NextStepTone;
  action: NextStepAction | null;
  /** Why the button is held back, in a few words; the whole story is in the Confirmation section. */
  note: string | null;
  /** True while the button is the page's confirm button, so the Confirmation card does not draw a second one. */
  ownsConfirm: boolean;
}

/**
 * What happens next to this order, as one button (docs/ux/REDESIGN_PROMPT.md
 * §6: "the next step is one button"). Nothing here is a new move: each button
 * is an action the page already had, picked by the order's stage —
 *
 *   waiting for the call / follow-up → the Confirmation card's own confirm
 *     (same channel, same lock and assignment rules, same errors);
 *   ready to ship → the Shipments section's new-shipment form, opened in place;
 *   delivery failed → the Shipments section again;
 *   shipped / out for delivery → the shipment's tracking link, or its section;
 *   waiting for payment → the Payments section (sync, payment link, transfers);
 *   delivered, returned, cancelled → no button, one sentence.
 *
 * Role gates are the cards' own: no confirm button for a role the card gives
 * none, no booking button for a role the Shipments section shows read-only.
 */
export function useOrderNextStep(
  order: Order,
  {
    gate,
    confirm,
    sections,
  }: {
    gate: ConfirmationGate;
    /** Runs the Confirmation card's confirm; resolves false when it failed. */
    confirm: () => Promise<boolean>;
    sections: Pick<OrderSectionControl, "reveal">;
  }
): OrderNextStep | null {
  const t = useT(STRINGS);
  const { currentWorkspace } = useWorkspace();
  const [confirming, setConfirming] = useState(false);
  const stage = order.stage;
  if (!stage) return null;

  const canShip = SHIPPING_ROLES.has(currentWorkspace?.role ?? "");
  // The shipment that is still on its way (or still to be collected), if any.
  const active = (order.shipments ?? []).find((s) => !FINISHED_SHIPMENT_STATUSES.has(s.status));
  const track: NextStepAction = active?.trackingUrl
    ? { label: t.track, icon: IconPackageSearch, href: active.trackingUrl }
    : { label: t.track, icon: IconPackageSearch, onClick: () => sections.reveal("shipments") };

  async function runConfirm() {
    setConfirming(true);
    try {
      // On a refusal (someone else holds the call, the offers window…) the card says why: show it.
      if (!(await confirm())) sections.reveal("confirmation");
    } finally {
      setConfirming(false);
    }
  }

  let sentence: string = t[stage];
  let action: NextStepAction | null = null;
  let note: string | null = null;
  let ownsConfirm = false;

  switch (stage) {
    case "pending_confirmation":
    case "needs_follow_up": {
      if (gate.open && gate.canConfirm) {
        ownsConfirm = true;
        const task = order.confirmationTask ?? null;
        action = {
          label: confirming ? t.confirming : t.confirm,
          icon: IconConfirm,
          onClick: () => void runConfirm(),
          busy: confirming,
          disabled: confirming || gate.heldByOther || gate.assignedToOther || gate.waiting,
        };
        if (gate.heldByOther) note = fmt(t.heldBy, { name: task?.lockedBy?.fullName ?? t.someone });
        else if (gate.assignedToOther) note = fmt(t.assignedTo, { name: gate.assignee?.fullName ?? t.someone });
        else if (gate.waiting) note = t.waiting;
      }
      break;
    }
    case "ready_to_ship": {
      if (active) {
        sentence = t.ready_to_ship_booked;
        action = track;
      } else if (canShip) {
        action = { label: t.book, icon: IconCourier, onClick: () => sections.reveal("shipments", true) };
      }
      break;
    }
    case "delivery_failed": {
      if (canShip) action = { label: t.retry, icon: IconRepeat, onClick: () => sections.reveal("shipments", true) };
      break;
    }
    case "shipped":
    case "out_for_delivery": {
      action = track;
      break;
    }
    case "awaiting_payment": {
      action = { label: t.payment, icon: IconCash, onClick: () => sections.reveal("payments") };
      break;
    }
    case "cancelled": {
      if (order.cancellationReason) sentence = fmt(t.cancelledBecause, { reason: order.cancellationReason });
      break;
    }
    default:
      break;
  }

  return { stage, sentence, tone: STAGE_TONE[stage], action, note, ownsConfirm };
}
