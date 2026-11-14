import type { Order } from "@store-builder/api-client";

/**
 * When an order was placed and confirmed, for the rows of the orders list and
 * the confirmation queue — pure, so the rules and the wording are tested in
 * orderTimeline.test.ts.
 *
 * `confirmedAt` comes from the server (orders.confirmed_at) and is set only
 * while the order is confirmed. A prepaid order has no confirmation step, and
 * an order confirmed before the column existed with no trace in its history
 * has none either: neither gets a confirmation line — nothing is guessed.
 */
export interface ConfirmationTiming {
  placedAt: string;
  confirmedAt: string | null;
  /** Whole minutes from placement to confirmation; null when not confirmed. */
  minutesToConfirm: number | null;
}

export function confirmationTiming(
  order: Pick<Order, "createdAt" | "confirmationState"> & { confirmedAt?: string | null }
): ConfirmationTiming {
  const confirmedAt = order.confirmationState === "confirmed" && order.confirmedAt ? order.confirmedAt : null;
  if (!confirmedAt) return { placedAt: order.createdAt, confirmedAt: null, minutesToConfirm: null };
  const ms = new Date(confirmedAt).getTime() - new Date(order.createdAt).getTime();
  return {
    placedAt: order.createdAt,
    confirmedAt,
    minutesToConfirm: Number.isFinite(ms) ? Math.max(0, Math.round(ms / 60_000)) : null,
  };
}

const MINUTE = 60;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;

/**
 * "3 hours ago" / "قبل ٣ ساعات", from `now`. A time in the future (a clock a
 * little ahead of the server) reads as "now".
 */
export function formatRelative(iso: string, now: number, intlLocale: string): string {
  const seconds = Math.round((now - new Date(iso).getTime()) / 1000);
  const rtf = new Intl.RelativeTimeFormat(intlLocale, { numeric: "auto" });
  if (!Number.isFinite(seconds) || seconds < 45) return rtf.format(0, "second");
  if (seconds < HOUR) return rtf.format(-Math.max(1, Math.round(seconds / MINUTE)), "minute");
  if (seconds < DAY) return rtf.format(-Math.round(seconds / HOUR), "hour");
  if (seconds < 30 * DAY) return rtf.format(-Math.round(seconds / DAY), "day");
  if (seconds < 365 * DAY) return rtf.format(-Math.round(seconds / (30 * DAY)), "month");
  return rtf.format(-Math.round(seconds / (365 * DAY)), "year");
}

/**
 * A length of time: "25 min", "2 hr, 5 min", "3 days" — and the Arabic
 * forms with their proper plurals ("٢٥ دقيقة", "ساعتان و٥ دقائق"), from Intl
 * rather than hand-made suffixes.
 */
export function formatDuration(minutes: number, intlLocale: string, arabic: boolean): string {
  const unit = (value: number, name: "minute" | "hour" | "day") =>
    new Intl.NumberFormat(intlLocale, { style: "unit", unit: name, unitDisplay: arabic ? "long" : "short" }).format(value);
  const m = Math.max(0, Math.round(minutes));
  if (m < 60) return unit(m, "minute");
  if (m < 48 * 60) {
    const hours = Math.floor(m / 60);
    const rest = m % 60;
    if (rest === 0) return unit(hours, "hour");
    return new Intl.ListFormat(intlLocale, { type: "unit", style: arabic ? "long" : "short" }).format([
      unit(hours, "hour"),
      unit(rest, "minute"),
    ]);
  }
  return unit(Math.round(m / (60 * 24)), "day");
}
