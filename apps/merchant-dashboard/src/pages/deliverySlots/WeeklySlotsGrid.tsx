import { IconCopy, IconDelete, IconPlus } from "@/components/icons";
import { Button, Input, cn } from "@store-builder/ui";
import { DELIVERY_SLOT_PER_DAY_MAX, DELIVERY_SLOT_WEEKDAYS, type DeliverySlotWeekday } from "@store-builder/api-client";
import { fmt } from "@/i18n/LocaleContext";
import type { DeliverySlotText } from "./deliverySlotStrings";
import { emptySlot, newSlotKey, type SlotDraft, type SlotErrors, type WeekDraft } from "./slotDraft";
import { WEEK_ORDER, weekdayName } from "./slotText";

/**
 * The week's delivery slots (handoff 221): for each day, its slots — when
 * each starts and ends and how many orders it takes («عدد الأوردرات في
 * الميعاد», empty = unlimited). A day with no slot has no delivery. Up to 12
 * slots a day. A slot keeps the id the API gave it; "Copy to empty days"
 * makes new slots (no id) on the days that have none.
 */
export function WeeklySlotsGrid({
  week,
  errors,
  disabled,
  idPrefix,
  t,
  onChange,
}: {
  week: WeekDraft;
  errors: SlotErrors;
  disabled: boolean;
  idPrefix: string;
  t: DeliverySlotText;
  onChange: (next: WeekDraft, touched?: string) => void;
}) {
  const setDay = (day: DeliverySlotWeekday, rows: SlotDraft[], touched?: string) => onChange({ ...week, [day]: rows }, touched);
  const hasEmptyDay = DELIVERY_SLOT_WEEKDAYS.some((d) => week[d].length === 0);

  function copyToEmptyDays(from: DeliverySlotWeekday) {
    const next = { ...week };
    for (const day of DELIVERY_SLOT_WEEKDAYS) {
      // New slots, not the same ones: each day's slots get their own ids on save.
      if (next[day].length === 0) next[day] = week[from].map((row) => ({ key: newSlotKey(), from: row.from, to: row.to, capacity: row.capacity }));
    }
    onChange(next);
  }

  return (
    <ul className="divide-y divide-line">
      {WEEK_ORDER.map((day) => {
        const rows = week[day];
        const name = weekdayName(day);
        const full = rows.length >= DELIVERY_SLOT_PER_DAY_MAX;
        return (
          <li key={day} className="py-3 first:pt-0 last:pb-0">
            <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1">
              <p className="text-sm font-semibold text-ink">
                {name}
                {rows.length === 0 && <span className="ms-2 text-xs font-normal text-ink-soft">{t.noSlots}</span>}
              </p>
              <div className="flex flex-wrap items-center gap-1">
                {rows.length > 0 && hasEmptyDay && (
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="min-h-11 gap-1.5 rounded-full px-3 text-ink-soft pointer-fine:min-h-9"
                    disabled={disabled}
                    aria-label={fmt(t.copyToEmptyOn, { day: name })}
                    onClick={() => copyToEmptyDays(day)}
                  >
                    <IconCopy className="size-4" aria-hidden />
                    {t.copyToEmpty}
                  </Button>
                )}
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="min-h-11 gap-1.5 rounded-full px-3.5 pointer-fine:min-h-9"
                  disabled={disabled || full}
                  title={full ? fmt(t.maxSlots, { max: DELIVERY_SLOT_PER_DAY_MAX }) : undefined}
                  aria-label={fmt(t.addSlotOn, { day: name })}
                  onClick={() => {
                    const added = emptySlot();
                    setDay(day, [...rows, added]);
                    // The new row's first field takes the cursor once it is drawn.
                    window.setTimeout(() => document.getElementById(`${idPrefix}-${added.key}-from`)?.focus(), 0);
                  }}
                >
                  <IconPlus className="size-4" aria-hidden />
                  {t.addSlot}
                </Button>
              </div>
            </div>

            {rows.length > 0 && (
              <ul className="mt-2 space-y-2">
                {rows.map((row, i) => {
                  const error = errors[row.key];
                  const n = i + 1;
                  const patch = (change: Partial<SlotDraft>) =>
                    setDay(
                      day,
                      rows.map((r) => (r.key === row.key ? { ...r, ...change } : r)),
                      row.key
                    );
                  return (
                    <li key={row.key}>
                      <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
                        <span className="inline-flex items-center gap-1.5 text-sm text-ink-soft">
                          <span aria-hidden>{t.slotFrom}</span>
                          <Input
                            id={`${idPrefix}-${row.key}-from`}
                            type="time"
                            dir="ltr"
                            value={row.from}
                            disabled={disabled}
                            aria-label={fmt(t.slotFromOn, { n, day: name })}
                            aria-invalid={error ? true : undefined}
                            onChange={(e) => patch({ from: e.target.value })}
                            className="h-11 w-32 tabular-nums"
                          />
                        </span>
                        <span className="inline-flex items-center gap-1.5 text-sm text-ink-soft">
                          <span aria-hidden>{t.slotTo}</span>
                          <Input
                            type="time"
                            dir="ltr"
                            value={row.to}
                            disabled={disabled}
                            aria-label={fmt(t.slotToOn, { n, day: name })}
                            aria-invalid={error ? true : undefined}
                            onChange={(e) => patch({ to: e.target.value })}
                            className="h-11 w-32 tabular-nums"
                          />
                        </span>
                        <span className="inline-flex items-center gap-1.5 text-sm text-ink-soft">
                          <span aria-hidden>{t.capacity}</span>
                          <Input
                            type="text"
                            inputMode="numeric"
                            dir="ltr"
                            autoComplete="off"
                            maxLength={5}
                            value={row.capacity}
                            placeholder={t.unlimited}
                            disabled={disabled}
                            aria-label={fmt(t.capacityOn, { n, day: name })}
                            aria-invalid={error ? true : undefined}
                            onChange={(e) => patch({ capacity: e.target.value })}
                            className={cn("h-11 w-24 text-center tabular-nums placeholder:text-xs", row.capacity.trim() === "" && "bg-paper")}
                          />
                        </span>
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          className="ms-auto size-11 shrink-0 rounded-full p-0 text-ink-soft hover:bg-danger-soft hover:text-danger"
                          disabled={disabled}
                          aria-label={fmt(t.removeSlotOn, { n, day: name })}
                          title={t.removeSlot}
                          onClick={() =>
                            setDay(
                              day,
                              rows.filter((r) => r.key !== row.key),
                              row.key
                            )
                          }
                        >
                          <IconDelete className="size-4" aria-hidden />
                        </Button>
                      </div>
                      {error && (
                        <p role="alert" className="mt-1 text-xs font-medium text-danger">
                          {error}
                        </p>
                      )}
                    </li>
                  );
                })}
              </ul>
            )}
          </li>
        );
      })}
    </ul>
  );
}
