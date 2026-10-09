import { HOLIDAY_ORDER_TAG, PICKUP_ORDER_TAG } from "@store-builder/api-client";
import { useT, type Messages } from "@/i18n/LocaleContext";

const STRINGS = {
  en: { holiday: "Holiday", pickup: "Pickup" },
  ar: { holiday: "إجازة", pickup: "استلام من الفرع" },
} satisfies Messages;

/**
 * The chip for the tags the store's own features put on an order, in the
 * dashboard's language: `holiday` (placed during a "take orders, ship later"
 * holiday, handoff 216) and `pickup` (click and collect, handoff 225). null
 * for any other tag. Read by the orders list's tag chip
 * (packing/PackingEntryPoints OrderTagBadge).
 */
export function useFulfilmentTag(tag: string): { text: string; tone: "warning" | "info" } | null {
  const t = useT(STRINGS);
  const key = tag.trim().toLowerCase();
  if (key === HOLIDAY_ORDER_TAG) return { text: t.holiday, tone: "warning" };
  if (key === PICKUP_ORDER_TAG) return { text: t.pickup, tone: "info" };
  return null;
}
