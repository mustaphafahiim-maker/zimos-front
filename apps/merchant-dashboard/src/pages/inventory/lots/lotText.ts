import { todayDay } from "@/lib/wholeNumber";

/** The date field of the lot dialogs: the same box as the purchase order's "Expected on". */
export const LOT_DATE_INPUT =
  "flex h-11 w-full max-w-[14rem] rounded-[var(--radius)] border border-line-strong bg-paper-raised px-3 text-sm text-ink focus-visible:border-primary focus-visible:ring-2 focus-visible:ring-primary/40 focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-50";

const DAY_MS = 86_400_000;

/** Whole days from today (the device's calendar) to a "YYYY-MM-DD" day; negative once it has passed. */
export function daysUntil(ymd: string): number {
  return Math.round((Date.parse(`${ymd}T00:00:00Z`) - Date.parse(`${todayDay()}T00:00:00Z`)) / DAY_MS);
}
