import { useId, useMemo } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { Button, Input, cn } from "@store-builder/ui";
import {
  DELIVERY_SLOT_WEEKDAYS,
  deliverySlotSchedule,
  deliverySlotSettingsGet,
  type DeliverySlotScheduleDay,
  type DeliverySlotScheduleOrder,
  type DeliverySlotSettings,
  type DeliverySlotWeekday,
} from "@store-builder/api-client";
import { AccordionGroup, AccordionSection } from "@/components/Accordion";
import { CardSkeleton, DataState } from "@/components/DataState";
import { EmptyState } from "@/components/EmptyState";
import { IconCaretLeft, IconCaretRight, IconSchedule, IconSliders } from "@/components/icons";
import { PageHeader } from "@/components/PageHeader";
import { Segmented } from "@/components/Segmented";
import { StatusBadge } from "@/components/StatusBadge";
import { ViewLink } from "@/components/ViewLink";
import { useWorkspace } from "@/context/WorkspaceContext";
import { fmt, useT } from "@/i18n/LocaleContext";
import { apiClient } from "@/lib/apiClient";
import { formatMoney } from "@/lib/format";
import { countOf, pluralOf } from "@/lib/plural";
import { useCachedAsync } from "@/lib/useCachedAsync";
import { useWorkspaceId } from "@/lib/useWorkspaceId";
import { useIsDesktop } from "@/pages/orders/list/useIsDesktop";
import { DELIVERY_SLOT_STRINGS, type DeliverySlotText } from "./deliverySlotStrings";
import { addDays, slotDayName, slotMinutes, slotRange, storeToday, weekdayOf } from "./slotText";

const SPANS = ["7", "14", "30"] as const;
type Span = (typeof SPANS)[number];

/** A calendar day as the page's link carries it: "YYYY-MM-DD", and a day that exists. */
function isDay(value: string | null): value is string {
  return value !== null && /^\d{4}-\d{2}-\d{2}$/.test(value) && !Number.isNaN(new Date(`${value}T12:00:00Z`).getTime());
}

interface SlotRow {
  slotId: string;
  from: string;
  to: string;
  /** null = unlimited; undefined = a slot the week no longer has (its limit is unknown). */
  capacity: number | null | undefined;
  orders: DeliverySlotScheduleOrder[];
}

interface DayRow {
  date: string;
  closed: boolean;
  slots: SlotRow[];
  orders: number;
}

/**
 * Every day between two dates with the week's slots of that weekday and the
 * orders booked into each. Bookings are counted by slot id, as the API counts
 * them against the capacity; an order booked into a slot the week no longer
 * has is kept, under the times it was booked with. A closed day keeps its
 * place in the plan — the team sees why nothing is due — with only the slots
 * that hold an order (the team may book a closed day; shoppers cannot).
 */
function buildDays(settings: DeliverySlotSettings, booked: DeliverySlotScheduleDay[], from: string, days: number): DayRow[] {
  const byDate = new Map(booked.map((d) => [d.date.slice(0, 10), d.slots]));
  const closed = new Set(settings.closedDates ?? []);
  const out: DayRow[] = [];
  for (let i = 0; i < days; i += 1) {
    const date = addDays(from, i);
    const weekSlots = settings.weekly?.[String(weekdayOf(date)) as DeliverySlotWeekday] ?? [];
    const bookings = byDate.get(date) ?? [];
    const isClosed = closed.has(date);
    let slots: SlotRow[] = weekSlots.map((slot) => ({
      slotId: slot.id ?? "",
      from: slot.from,
      to: slot.to,
      capacity: slot.capacity ?? null,
      orders: bookings.filter((b) => b.slotId === slot.id).flatMap((b) => b.orders),
    }));
    for (const b of bookings) {
      if (!weekSlots.some((slot) => slot.id === b.slotId)) slots.push({ slotId: b.slotId, from: b.from, to: b.to, capacity: undefined, orders: b.orders });
    }
    // Nothing is delivered on a weekday with no slot; a day nobody booked into is not listed for it.
    if (slots.length === 0) continue;
    if (isClosed) slots = slots.filter((slot) => slot.orders.length > 0);
    slots.sort((a, b) => slotMinutes(a.from) - slotMinutes(b.from) || slotMinutes(a.to) - slotMinutes(b.to));
    out.push({ date, closed: isClosed, slots, orders: slots.reduce((n, s) => n + s.orders.length, 0) });
  }
  return out;
}

/** The round button of the date stepper: a small pane, 44px, that gives a little under the thumb. */
const STEP =
  "zimos-slot-step inline-flex size-11 shrink-0 cursor-pointer items-center justify-center rounded-full bg-paper-raised text-ink ring-1 ring-line transition-[scale,background-color] duration-[var(--dur-fade)] ease-[var(--ease-out)] hover:bg-paper-sunken focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary motion-safe:active:scale-[0.97] motion-reduce:transition-none";

/**
 * Orders → «جدول التوصيل» (handoff 221, orders.view): per day and slot, the
 * orders booked and how many of the slot's places are taken. It opens on
 * today and the six days after; the range moves a week (or the chosen span)
 * at a time. A work queue for whoever prepares deliveries, reached from the
 * orders list and from Shipping → Delivery times.
 *
 * Top to bottom: the date stepper and the span, one line of how many orders
 * are booked, then the days — each a row that folds: a day with orders (and
 * today) is open, an empty day is its one line. The range lives in the link
 * (`?from=`, `?days=`), so coming back from an order lands on the same week,
 * and a week already looked at shows at once and refreshes behind.
 */
export function DeliverySchedulePage() {
  const workspaceId = useWorkspaceId();
  const { currentWorkspace } = useWorkspace();
  const t = useT(DELIVERY_SLOT_STRINGS);
  const fromId = useId();
  const desktop = useIsDesktop();
  const today = storeToday(currentWorkspace?.timezone);

  const [params, setParams] = useSearchParams();
  const asked = params.get("from");
  const from = isDay(asked) ? asked : today;
  const askedSpan = params.get("days");
  const span: Span = (SPANS as readonly string[]).includes(askedSpan ?? "") ? (askedSpan as Span) : "7";
  const days = Number(span);
  const to = addDays(from, days - 1);

  function setRange(next: { from?: string; span?: Span }) {
    const nextFrom = next.from ?? from;
    const nextSpan = next.span ?? span;
    setParams(
      (prev) => {
        const out = new URLSearchParams(prev);
        // Today and a week are what the page opens on: the link stays clean for them.
        if (nextFrom === today) out.delete("from");
        else out.set("from", nextFrom);
        if (nextSpan === "7") out.delete("days");
        else out.set("days", nextSpan);
        return out;
      },
      { replace: true }
    );
  }

  const settings = useCachedAsync(`delivery-slots:settings:${workspaceId}`, () => deliverySlotSettingsGet(apiClient, workspaceId), [workspaceId]);
  // The answer is tagged with the store and the dates it is for: while another range is on its way (or failed),
  // the last range's bookings are never laid under the new dates.
  const rangeTag = `${workspaceId}:${from}:${to}`;
  const schedule = useCachedAsync(
    `delivery-slots:schedule:${rangeTag}`,
    async () => ({ range: rangeTag, days: await deliverySlotSchedule(apiClient, workspaceId, from, to) }),
    [workspaceId, from, to]
  );
  const booked = schedule.data && schedule.data.range === rangeTag ? schedule.data.days : null;

  const rows = useMemo(
    () => (settings.data && booked ? buildDays(settings.data, booked, from, days) : []),
    [settings.data, booked, from, days]
  );
  const total = rows.reduce((n, d) => n + d.orders, 0);
  const hasWeek = settings.data ? DELIVERY_SLOT_WEEKDAYS.some((d) => (settings.data?.weekly?.[d] ?? []).length > 0) : false;
  // A week not seen yet is on its way: its place is held until it lands.
  const loading = (settings.loading && !settings.data) || (booked === null && schedule.error == null);
  const error = settings.data ? (booked ? null : schedule.error) : settings.error;
  const pill = "min-h-11 rounded-full px-5";

  return (
    <div className="max-w-4xl">
      <PageHeader
        title={t.scheduleTitle}
        // A phone keeps the first screen for the days: the sentence is for wider screens.
        description={desktop ? t.scheduleDescription : undefined}
        back={{ to: "/orders", label: t.backToOrders }}
        actions={
          <Button asChild variant="outline" className="h-11 gap-2 rounded-full px-3 sm:px-4">
            <Link to="/shipping?tab=delivery" aria-label={t.settingsLink} title={t.settingsLink}>
              <IconSliders className="size-4" aria-hidden />
              <span className="max-sm:sr-only">{t.settingsLink}</span>
            </Link>
          </Button>
        }
      />

      <div className="flex flex-col gap-3">
        {/* One row of controls: step a span back or forward, pick a day, come back to today — and how many days to show. */}
        <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
          <div className="flex min-w-0 items-center gap-2">
            <button type="button" className={STEP} aria-label={t.earlier} title={t.earlier} onClick={() => setRange({ from: addDays(from, -days) })}>
              <IconCaretLeft className="size-5 rtl:-scale-x-100" weight="bold" aria-hidden />
            </button>
            <label htmlFor={fromId} className="sr-only">
              {t.fromDay}
            </label>
            <Input
              id={fromId}
              type="date"
              value={from}
              onChange={(e) => {
                if (isDay(e.target.value)) setRange({ from: e.target.value });
              }}
              className="h-11 w-[10.5rem] min-w-0 rounded-[0.875rem] text-base"
            />
            <button type="button" className={STEP} aria-label={t.later} title={t.later} onClick={() => setRange({ from: addDays(from, days) })}>
              <IconCaretRight className="size-5 rtl:-scale-x-100" weight="bold" aria-hidden />
            </button>
          </div>
          {from !== today && (
            <Button type="button" variant="ghost" className="min-h-11 rounded-full px-4" onClick={() => setRange({ from: today })}>
              {t.jumpToday}
            </Button>
          )}
          <Segmented
            value={span}
            onChange={(next) => setRange({ span: next })}
            label={t.rangeLabel}
            size="sm"
            options={[
              { value: "7", label: t.range7 },
              { value: "14", label: t.range14 },
              { value: "30", label: t.range30 },
            ]}
            className="max-sm:w-full sm:ms-auto"
          />
        </div>

        <DataState
          loading={loading}
          error={error}
          onRetry={() => {
            if (settings.error) void settings.refresh();
            void schedule.refresh();
          }}
          skeleton={
            <div className="flex flex-col gap-3">
              <CardSkeleton lines={3} />
              <CardSkeleton lines={1} />
              <CardSkeleton lines={1} />
            </div>
          }
        >
          {settings.data && rows.length === 0 ? (
            !settings.data.enabled ? (
              <EmptyState
                tone="attention"
                icon={<IconSchedule aria-hidden />}
                title={t.offTitle}
                description={t.offBody}
                action={
                  <Button asChild className={pill}>
                    <Link to="/shipping?tab=delivery">{t.offAction}</Link>
                  </Button>
                }
              />
            ) : !hasWeek ? (
              <EmptyState
                tone="attention"
                icon={<IconSchedule aria-hidden />}
                title={t.noWeekTitle}
                description={t.noWeekBody}
                action={
                  <Button asChild className={pill}>
                    <Link to="/shipping?tab=delivery">{t.offAction}</Link>
                  </Button>
                }
              />
            ) : (
              <EmptyState
                icon={<IconSchedule aria-hidden />}
                title={t.nothingTitle}
                description={t.nothingBody}
                action={
                  from !== today ? (
                    <Button type="button" variant="outline" className={pill} onClick={() => setRange({ from: today })}>
                      {t.backToToday}
                    </Button>
                  ) : undefined
                }
              />
            )
          ) : (
            <div className="flex flex-col gap-3">
              <p className="px-1 text-sm leading-6 text-ink-soft tabular-nums" aria-live="polite">
                {total > 0 ? pluralOf(t, "ordersBooked", total) : t.noneBooked}
              </p>
              <AccordionGroup className="gap-3">
                {rows.map((day) => (
                  <DayRowCard key={day.date} day={day} today={day.date === today} t={t} />
                ))}
              </AccordionGroup>
            </div>
          )}
        </DataState>
      </div>
    </div>
  );
}

function DayRowCard({ day, today, t }: { day: DayRow; today: boolean; t: DeliverySlotText }) {
  const ordersText = day.orders > 0 ? countOf("order", day.orders) : t.slotEmpty;
  return (
    <AccordionSection
      title={slotDayName(day.date)}
      icon={IconSchedule}
      summary={day.slots.length > 0 ? fmt(t.daySummary, { orders: ordersText, slots: pluralOf(t, "slots", day.slots.length) }) : ordersText}
      badge={
        <span className="flex items-center gap-1.5">
          {today && <StatusBadge value="today" tone="info" text={t.todayBadge} />}
          {day.closed && <StatusBadge value="closed" tone="warning" text={t.closedDay} />}
          {day.orders > 0 && <span className="text-xs font-medium whitespace-nowrap text-ink-soft tabular-nums max-sm:hidden">{ordersText}</span>}
        </span>
      }
      // What has work in it is open; an empty day is its one line until asked.
      defaultOpen={day.orders > 0 || today}
      flush
    >
      {/* A closed day nobody is booked into has no slot to show. */}
      {day.slots.length > 0 ? (
        <ul className="divide-y divide-line">
          {day.slots.map((slot) => (
            <SlotBlock key={`${slot.slotId}-${slot.from}-${slot.to}`} slot={slot} t={t} />
          ))}
        </ul>
      ) : (
        <p className="px-4 py-3 text-sm text-ink-soft">{t.slotEmpty}</p>
      )}
    </AccordionSection>
  );
}

function SlotBlock({ slot, t }: { slot: SlotRow; t: DeliverySlotText }) {
  const count = slot.orders.length;
  const capacity = typeof slot.capacity === "number" ? slot.capacity : null;
  const full = capacity !== null && count >= capacity;
  const over = capacity !== null && count > capacity;
  const share = capacity !== null ? Math.min(1, count / Math.max(1, capacity)) : 0;
  return (
    <li className={cn("px-4", count > 0 ? "py-3" : "py-2.5")}>
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
        <p className={cn("text-[15px] leading-6 tabular-nums", count > 0 ? "font-semibold text-ink" : "font-medium text-ink-soft")}>{slotRange(slot.from, slot.to)}</p>
        <span className={cn("text-sm tabular-nums", count === 0 ? "text-ink-soft" : "text-ink")}>
          {capacity !== null ? <bdi>{fmt(t.slotCount, { count, capacity })}</bdi> : count > 0 ? countOf("order", count) : t.slotEmpty}
        </span>
        {over ? (
          <StatusBadge value="over" tone="danger" text={t.slotOver} />
        ) : full ? (
          <StatusBadge value="full" tone="warning" text={t.slotFull} />
        ) : null}
        {slot.capacity === undefined && <span className="text-xs text-ink-soft">{t.slotGone}</span>}
      </div>
      {/* How much of the slot is taken, once anything is. It does not animate: the figure beside it is the news. */}
      {capacity !== null && count > 0 && (
        <div className="zimos-meter mt-2 h-1.5 w-full max-w-xs overflow-hidden rounded-full bg-paper-sunken" aria-hidden>
          <div
            data-tone={over ? "danger" : full ? "attention" : undefined}
            className={cn("zimos-meter-fill h-full w-full rounded-full [transform-origin:0_50%] rtl:[transform-origin:100%_50%]", over ? "bg-danger" : full ? "bg-accent" : "bg-primary")}
            style={{ transform: `scaleX(${share})` }}
          />
        </div>
      )}
      {count > 0 && (
        <ul className="zimos-slot-orders mt-2.5 divide-y divide-line overflow-hidden rounded-[0.875rem] ring-1 ring-line">
          {slot.orders.map((order) => (
            <li key={order.id}>
              {/* The whole line is the way into the order: one 48px target, not a small number to aim at. */}
              <ViewLink
                to={`/orders/${order.id}`}
                aria-label={fmt(t.openOrder, { number: order.orderNumber })}
                className="zimos-slot-order flex min-h-12 items-center gap-3 px-3 py-2 text-sm transition-[background-color] duration-[var(--dur-fade)] ease-[var(--ease-out)] hover:bg-paper-sunken focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-primary active:bg-paper-sunken motion-reduce:transition-none"
              >
                <span className="shrink-0 font-semibold text-ink tabular-nums">
                  <bdi dir="ltr">{order.orderNumber}</bdi>
                </span>
                <span className="min-w-0 flex-1 truncate text-ink-soft">
                  <bdi>{order.customerName || t.noCustomer}</bdi>
                </span>
                <span className="shrink-0 font-medium text-ink tabular-nums">
                  <bdi>{formatMoney(order.totalAmount, order.currency)}</bdi>
                </span>
                <IconCaretRight className="size-4 shrink-0 text-ink-soft rtl:-scale-x-100" aria-hidden />
              </ViewLink>
            </li>
          ))}
        </ul>
      )}
    </li>
  );
}
