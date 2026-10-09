import { useId, useState, type FormEvent } from "react";
import { Alert, Button, Input, cn } from "@store-builder/ui";
import {
  apiFieldProblems,
  deliverySlotMoveOrder,
  deliverySlotSchedule,
  isDeliverySlotFull,
  type DeliverySlot,
  type DeliverySlotSettings,
  type DeliverySlotWeekday,
  type OrderDeliverySlot,
} from "@store-builder/api-client";
import { apiClient } from "@/lib/apiClient";
import { useWorkspaceId } from "@/lib/useWorkspaceId";
import { useAsync } from "@/lib/useAsync";
import { isPermissionError } from "@/lib/errors";
import { useErrorMessage } from "@/lib/errorMessages";
import { fmt, useT } from "@/i18n/LocaleContext";
import { Modal } from "@/components/Modal";
import { StatusBadge } from "@/components/StatusBadge";
import { useToast } from "@/components/Toast";
import { DELIVERY_SLOT_STRINGS } from "./deliverySlotStrings";
import { addDays, slotDayName, slotMinutes, slotRange, weekdayOf } from "./slotText";

/**
 * The order page's «تغيير» for the delivery time (handoff 221, orders.manage):
 * a day, then that weekday's slots with how many orders each already holds.
 * A full slot asks first — «الميعاد مليان — احجز برضه؟» — and is then booked
 * with `force`. The team's move is not held to the lead days, the horizon or
 * the closed days (the API's rule), so any day whose weekday has the slot can
 * be chosen; a closed day only gets a note. "Remove the time" takes the slot
 * off the order.
 */
export function ChangeDeliverySlotDialog({
  open,
  orderId,
  current,
  settings,
  today,
  onClose,
  onSaved,
  onSlotsChanged,
}: {
  open: boolean;
  orderId: string;
  current: OrderDeliverySlot | null;
  settings: DeliverySlotSettings;
  /** Today in the store's calendar. */
  today: string;
  onClose: () => void;
  onSaved: () => void;
  /** The week's slots turned out to differ from what this page read: read them again. */
  onSlotsChanged: () => void;
}) {
  const t = useT(DELIVERY_SLOT_STRINGS);
  const workspaceId = useWorkspaceId();
  const toast = useToast();
  const errorMessage = useErrorMessage();
  const formId = useId();
  const dayId = useId();
  const group = useId();

  const startDay = current?.date ?? addDays(today, Math.max(0, settings.leadDays ?? 0));
  const [date, setDate] = useState(startDay);
  const [slotId, setSlotId] = useState(current?.slotId ?? "");
  const [askFull, setAskFull] = useState(false);
  const [failure, setFailure] = useState<string | null>(null);
  const [busy, setBusy] = useState<"save" | "remove" | null>(null);
  const [openedFor, setOpenedFor] = useState(false);

  // Each opening starts from the order's own day and slot.
  if (open !== openedFor) {
    setOpenedFor(open);
    if (open) {
      setDate(startDay);
      setSlotId(current?.slotId ?? "");
      setAskFull(false);
      setFailure(null);
      setBusy(null);
    }
  }

  const validDay = /^\d{4}-\d{2}-\d{2}$/.test(date);
  const slots: DeliverySlot[] = validDay
    ? [...(settings.weekly?.[String(weekdayOf(date)) as DeliverySlotWeekday] ?? [])].sort((a, b) => slotMinutes(a.from) - slotMinutes(b.from))
    : [];
  const chosen = slots.find((s) => s.id === slotId) ?? null;
  const closed = validDay && (settings.closedDates ?? []).includes(date);

  // How many orders each slot of that day already holds — this order aside, since moving frees its own place.
  const booked = useAsync(
    () => (open && validDay ? deliverySlotSchedule(apiClient, workspaceId, date, date).catch(() => []) : Promise.resolve([])),
    [open, workspaceId, date, validDay]
  );
  const countOf = (id: string | undefined) =>
    (booked.data ?? [])
      .flatMap((d) => d.slots)
      .filter((s) => s.slotId === id)
      .reduce((n, s) => n + s.orders.filter((o) => o.id !== orderId).length, 0);
  const isFull = (slot: DeliverySlot) => typeof slot.capacity === "number" && countOf(slot.id) >= slot.capacity;

  async function save(force: boolean) {
    if (!chosen?.id || busy) return;
    setBusy("save");
    setFailure(null);
    try {
      await deliverySlotMoveOrder(apiClient, workspaceId, orderId, { date, slotId: chosen.id, force });
      toast.success(t.timeSaved);
      onSaved();
      onClose();
    } catch (err) {
      if (isDeliverySlotFull(err)) {
        // Someone took the last place since the counts were read.
        setAskFull(true);
        void booked.refresh({ silent: true });
      } else if (apiFieldProblems(err).some((p) => p.field === "slotId")) {
        setFailure(t.slotMissing);
        setSlotId("");
        onSlotsChanged();
      } else {
        setFailure(isPermissionError(err) ? t.noOrderManage : errorMessage(err));
      }
    } finally {
      setBusy(null);
    }
  }

  async function remove() {
    if (busy) return;
    setBusy("remove");
    setFailure(null);
    try {
      await deliverySlotMoveOrder(apiClient, workspaceId, orderId, null);
      toast.success(t.timeRemoved);
      onSaved();
      onClose();
    } catch (err) {
      setFailure(isPermissionError(err) ? t.noOrderManage : errorMessage(err));
    } finally {
      setBusy(null);
    }
  }

  function submit(e: FormEvent) {
    e.preventDefault();
    if (!chosen) return;
    // A slot already known to be full asks before anything is sent.
    if (isFull(chosen)) setAskFull(true);
    else void save(false);
  }

  const unchanged = Boolean(current && current.date === date && current.slotId === slotId);

  return (
    <Modal
      open={open}
      onClose={() => {
        if (!busy) onClose();
      }}
      title={current ? t.dialogTitle : t.dialogSetTitle}
      footer={
        askFull ? (
          <>
            <Button type="button" variant="outline" className="rounded-full px-5" disabled={busy !== null} onClick={() => setAskFull(false)}>
              {t.chooseAnother}
            </Button>
            <Button type="button" className="rounded-full px-5" disabled={busy !== null} onClick={() => void save(true)}>
              {busy === "save" ? t.saving : t.bookAnyway}
            </Button>
          </>
        ) : (
          <>
            {current && (
              <Button
                type="button"
                variant="ghost"
                className="rounded-full px-4 text-danger hover:bg-danger-soft hover:text-danger sm:me-auto"
                disabled={busy !== null}
                onClick={() => void remove()}
              >
                {busy === "remove" ? t.saving : t.removeTime}
              </Button>
            )}
            <Button type="button" variant="outline" className="rounded-full px-5" disabled={busy !== null} onClick={onClose}>
              {t.cancel}
            </Button>
            <Button type="submit" form={formId} className="rounded-full px-5" disabled={busy !== null || !chosen || unchanged}>
              {busy === "save" ? t.saving : t.saveTime}
            </Button>
          </>
        )
      }
    >
      {askFull && chosen ? (
        <div role="alertdialog" aria-labelledby={`${formId}-full`} className="rounded-[1.25rem] bg-accent-soft p-4">
          <p id={`${formId}-full`} className="text-[15px] font-semibold text-accent-dark">
            {t.fullConfirmTitle}
          </p>
          <p className="mt-1 text-sm text-ink-soft">{fmt(t.fullConfirmBody, { slot: slotRange(chosen.from, chosen.to), day: slotDayName(date) })}</p>
          {failure && (
            <Alert variant="danger" className="mt-3">
              {failure}
            </Alert>
          )}
        </div>
      ) : (
        <form id={formId} onSubmit={submit} noValidate className="space-y-4">
          <div className="space-y-1.5">
            <label htmlFor={dayId} className="block text-sm font-medium text-ink">
              {t.day}
            </label>
            <Input
              id={dayId}
              type="date"
              value={date}
              min={today}
              disabled={busy !== null}
              onChange={(e) => {
                setDate(e.target.value);
                setSlotId("");
                setFailure(null);
              }}
              className="h-11 w-full rounded-[0.875rem] text-base sm:w-56"
            />
            {validDay && <p className="text-sm font-medium text-ink">{slotDayName(date)}</p>}
            {closed && <p className="text-xs font-medium text-accent-dark">{t.closedThatDay}</p>}
          </div>

          <fieldset disabled={busy !== null} className="space-y-2">
            <legend className="text-sm font-medium text-ink">{t.slot}</legend>
            {!validDay ? (
              <p className="text-sm text-ink-soft">{t.pickDayFirst}</p>
            ) : slots.length === 0 ? (
              <p className="text-sm text-ink-soft">{t.noSlotsThatDay}</p>
            ) : (
              <ul className="space-y-2">
                {slots.map((slot) => {
                  const count = countOf(slot.id);
                  const full = isFull(slot);
                  const selected = slot.id === slotId;
                  return (
                    <li key={slot.id ?? `${slot.from}-${slot.to}`}>
                      <label
                        className={cn(
                          "zimos-slot-choice flex min-h-13 cursor-pointer items-center gap-3 rounded-[0.875rem] px-3 py-2 ring-1 transition-[background-color,box-shadow] duration-[var(--dur-fade)] ease-[var(--ease-out)] motion-reduce:transition-none",
                          selected ? "bg-primary-soft ring-2 ring-primary" : "ring-line-strong hover:bg-paper-sunken"
                        )}
                      >
                        <input
                          type="radio"
                          name={group}
                          className="size-5 shrink-0 cursor-pointer accent-primary"
                          checked={selected}
                          onChange={() => {
                            setSlotId(slot.id ?? "");
                            setFailure(null);
                          }}
                        />
                        <span className="min-w-0 flex-1">
                          <span className="block text-[15px] font-semibold text-ink tabular-nums">
                            {slotRange(slot.from, slot.to)}
                          </span>
                          <span className="block text-xs text-ink-soft">
                            {typeof slot.capacity === "number"
                              ? fmt(t.booked, { count, capacity: slot.capacity })
                              : fmt(t.bookedUnlimited, { count })}
                          </span>
                        </span>
                        {full && <StatusBadge value="full" tone="warning" text={t.full} />}
                      </label>
                    </li>
                  );
                })}
              </ul>
            )}
          </fieldset>

          {failure && <Alert variant="danger">{failure}</Alert>}
        </form>
      )}
    </Modal>
  );
}
