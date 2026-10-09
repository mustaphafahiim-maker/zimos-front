import { apiErrorCode, type Order, type Shipment } from "@store-builder/api-client";
import { Alert } from "@store-builder/ui";
import { useT, type Messages } from "@/i18n/LocaleContext";
import { isCarrierBooked } from "@/pages/shipping/carriers";

const STRINGS = {
  en: {
    hint: "This order is booked with a courier. Cancel the shipment first to edit the order, then book it again",
    cancelShipment: "Cancel shipment",
  },
  ar: {
    hint: "الطلب محجوز مع شركة الشحن. ألغِ الشحنة الأول عشان تعدّل الطلب، وبعدين احجزه تاني",
    cancelShipment: "إلغاء الشحنة",
  },
} satisfies Messages;

/**
 * The courier booking that stops the order's items, address and receiver from
 * being edited (handoff 352): a shipment booked with a connected courier that
 * still waits for pickup (`created`) or sits in an exception (`failed`). The
 * courier would collect the old amount at the old address. A manual row never
 * blocks. null when nothing does.
 */
export function bookingLockOf(order: Pick<Order, "shipments">): Shipment | null {
  return (order.shipments ?? []).find((s) => (s.status === "created" || s.status === "failed") && isCarrierBooked(s)) ?? null;
}

/** True for the 409 the three edit calls answer when another tab booked the order meanwhile. */
export function isBookingLockError(err: unknown): boolean {
  return apiErrorCode(err) === "SHIPMENT_BOOKED";
}

/**
 * Opens a folding section of the order page by its element id and brings it
 * into view; with `focus`, puts the keyboard on the first match inside it.
 * (The page's own `sections.reveal` is not in reach of a menu or a dialog.)
 */
export function revealOrderSection(elementId: string, focus?: string) {
  const section = document.getElementById(elementId);
  if (!section) return;
  section.querySelector<HTMLElement>('button[aria-expanded="false"]')?.click();
  // Two frames: the section has to be drawn open before it can be scrolled to and focused.
  window.requestAnimationFrame(() =>
    window.requestAnimationFrame(() => {
      const calm = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches === true;
      section.scrollIntoView({ behavior: calm ? "instant" : "smooth", block: "start" });
      if (focus) section.querySelector<HTMLElement>(focus)?.focus({ preventScroll: true });
    })
  );
}

/** Takes the merchant to the Shipment card's "Cancel shipment" button. */
export function revealShipmentCancel() {
  revealOrderSection("order-shipments", "[data-shipment-cancel]");
}

export function useBookingLockText() {
  return useT(STRINGS);
}

/** The same sentence as a box with the way out, for a form that got 409 SHIPMENT_BOOKED. */
export function BookingLockNotice({ onGo, className }: { onGo?: () => void; className?: string }) {
  const t = useT(STRINGS);
  return (
    <Alert variant="danger" role="alert" className={className}>
      <p>{t.hint}</p>
      <button
        type="button"
        onClick={() => {
          onGo?.();
          revealShipmentCancel();
        }}
        className="mt-1 inline-flex min-h-11 cursor-pointer items-center font-medium underline underline-offset-4 focus-visible:outline-2 focus-visible:outline-current"
      >
        {t.cancelShipment}
      </button>
    </Alert>
  );
}

/**
 * "Cancel shipment" under a form's error, shown only when that error is the booking lock
 * (lib/errorMessages.ts says SHIPMENT_BOOKED with this same sentence). `onGo` closes the form first.
 */
export function BookingLockLink({ message, onGo }: { message: string | null; onGo?: () => void }) {
  const t = useT(STRINGS);
  if (!message || message !== t.hint) return null;
  return (
    <button
      type="button"
      onClick={() => {
        onGo?.();
        revealShipmentCancel();
      }}
      className="ms-2 inline-flex min-h-11 cursor-pointer items-center font-medium underline underline-offset-4 focus-visible:outline-2 focus-visible:outline-current"
    >
      {t.cancelShipment}
    </button>
  );
}
