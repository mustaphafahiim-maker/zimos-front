import { useState } from "react";
import { IconCaretLeft, IconCaretRight, IconClose } from "@/components/icons";
import { Button, cn } from "@store-builder/ui";
import { DELIVERY_SLOT_CLOSED_DATES_MAX, type DeliverySlotWeekday } from "@store-builder/api-client";
import { fmt, getIntlLocale } from "@/i18n/LocaleContext";
import type { DeliverySlotText } from "./deliverySlotStrings";
import type { WeekDraft } from "./slotDraft";
import { WEEK_ORDER, slotDayName, weekdayName, weekdayOf } from "./slotText";

const pad = (n: number) => String(n).padStart(2, "0");

/** "2026-10" → the month before / after it. */
function shiftMonth(month: string, by: number): string {
  const [y, m] = month.split("-").map(Number);
  const d = new Date(Date.UTC(y, m - 1 + by, 1));
  return `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}`;
}

function monthName(month: string): string {
  const [y, m] = month.split("-").map(Number);
  return new Intl.DateTimeFormat(getIntlLocale(), { month: "long", year: "numeric", timeZone: "UTC" }).format(Date.UTC(y, m - 1, 1, 12));
}

function daysOf(month: string): string[] {
  const [y, m] = month.split("-").map(Number);
  const count = new Date(Date.UTC(y, m, 0)).getUTCDate();
  return Array.from({ length: count }, (_, i) => `${month}-${pad(i + 1)}`);
}

/** How far ahead the calendar turns: a year of closed days is all the API keeps. */
const MONTHS_AHEAD = 12;

/**
 * The closed days of the delivery slots (handoff 221): a month at a time, a
 * tap closes a day and another reopens it; the closed days are listed under
 * it too, so they can be read and removed without paging through months.
 * Days behind us can't be changed, and a day of the week that has no slot is
 * drawn fainter — nothing is delivered then anyway.
 */
export function ClosedDaysCalendar({
  closed,
  week,
  today,
  disabled,
  t,
  onChange,
}: {
  closed: string[];
  week: WeekDraft;
  /** Today in the store's calendar ("YYYY-MM-DD"). */
  today: string;
  disabled: boolean;
  t: DeliverySlotText;
  onChange: (next: string[]) => void;
}) {
  const firstMonth = today.slice(0, 7);
  const [month, setMonth] = useState(firstMonth);
  const lastMonth = shiftMonth(firstMonth, MONTHS_AHEAD);
  const closedSet = new Set(closed);
  const days = daysOf(month);
  // The week starts on Saturday here: the first day's column among the seven.
  const lead = WEEK_ORDER.indexOf(String(weekdayOf(days[0])) as DeliverySlotWeekday);
  const full = closed.length >= DELIVERY_SLOT_CLOSED_DATES_MAX;
  const upcoming = closed.filter((d) => d >= today).sort();

  function toggle(day: string) {
    if (closedSet.has(day)) onChange(closed.filter((d) => d !== day));
    else if (!full) onChange([...closed, day].sort());
  }

  return (
    <div className="space-y-3">
      <div className="max-w-sm">
        <div className="flex items-center justify-between gap-2">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="size-11 rounded-full p-0"
            disabled={month <= firstMonth}
            aria-label={t.prevMonth}
            onClick={() => setMonth((m) => shiftMonth(m, -1))}
          >
            <IconCaretRight className="size-5 ltr:rotate-180" aria-hidden />
          </Button>
          <p className="text-sm font-semibold text-ink" aria-live="polite">
            {monthName(month)}
          </p>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="size-11 rounded-full p-0"
            disabled={month >= lastMonth}
            aria-label={t.nextMonth}
            onClick={() => setMonth((m) => shiftMonth(m, 1))}
          >
            <IconCaretLeft className="size-5 ltr:rotate-180" aria-hidden />
          </Button>
        </div>

        <div className="mt-1 grid grid-cols-7 gap-1 text-center">
          {WEEK_ORDER.map((d) => (
            <span key={d} className="py-1 text-[11px] font-medium text-ink-soft" aria-hidden>
              {weekdayName(d, "short")}
            </span>
          ))}
          {Array.from({ length: lead }, (_, i) => (
            <span key={`lead-${i}`} aria-hidden />
          ))}
          {days.map((day) => {
            const isClosed = closedSet.has(day);
            const past = day < today;
            const noSlots = week[String(weekdayOf(day)) as DeliverySlotWeekday].length === 0;
            const name = slotDayName(day);
            return (
              <button
                key={day}
                type="button"
                aria-pressed={isClosed}
                aria-label={isClosed ? fmt(t.dayClosed, { day: name }) : noSlots ? fmt(t.dayNoSlots, { day: name }) : name}
                disabled={disabled || past || (!isClosed && full)}
                onClick={() => toggle(day)}
                className={cn(
                  "relative flex h-11 cursor-pointer items-center justify-center rounded-[var(--radius)] text-sm tabular-nums transition-colors focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-primary disabled:cursor-not-allowed",
                  isClosed
                    ? "bg-danger-soft font-semibold text-danger line-through ring-1 ring-danger/40"
                    : past
                      ? "text-ink-soft/50"
                      : noSlots
                        ? "text-ink-soft/70 hover:bg-paper-sunken"
                        : "text-ink hover:bg-paper-sunken",
                  day === today && !isClosed && "ring-1 ring-line-strong"
                )}
              >
                {new Intl.NumberFormat(getIntlLocale()).format(Number(day.slice(8)))}
              </button>
            );
          })}
        </div>
      </div>

      {upcoming.length === 0 ? (
        <p className="text-xs text-ink-soft">{t.closedNone}</p>
      ) : (
        <div role="group" aria-label={t.closedTitle} className="flex flex-wrap items-center gap-1.5">
          <span className="text-xs font-medium text-ink-soft">{t.closedList}</span>
          {upcoming.map((day) => (
            <button
              key={day}
              type="button"
              disabled={disabled}
              aria-label={fmt(t.reopenDay, { day: slotDayName(day) })}
              onClick={() => toggle(day)}
              className="inline-flex min-h-11 cursor-pointer items-center gap-1 rounded-[var(--radius-pill)] bg-danger-soft px-3 text-xs font-medium text-danger transition-colors hover:bg-danger-soft/70 disabled:cursor-not-allowed disabled:opacity-60 pointer-fine:min-h-8"
            >
              {slotDayName(day)}
              <IconClose className="size-3.5" aria-hidden />
            </button>
          ))}
        </div>
      )}
      {full && <p className="text-xs text-ink-soft">{fmt(t.closedMax, { max: DELIVERY_SLOT_CLOSED_DATES_MAX })}</p>}
    </div>
  );
}
