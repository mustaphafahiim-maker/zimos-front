import {
  DELIVERY_SLOT_CAPACITY_MAX,
  DELIVERY_SLOT_CLOSED_DATES_MAX,
  DELIVERY_SLOT_HORIZON_DAYS_MAX,
  DELIVERY_SLOT_NOTE_MAX,
  DELIVERY_SLOT_NOTICE_MINUTES_MAX,
  DELIVERY_SLOT_WEEKDAYS,
  type DeliverySlot,
  type DeliverySlotSettings,
  type DeliverySlotWeekday,
} from "@store-builder/api-client";
import { numberField, parseWholeNumber } from "@/lib/wholeNumber";
import type { DeliverySlotText } from "./deliverySlotStrings";
import { addDays, isSlotTime, slotMinutes } from "./slotText";

/**
 * The delivery slot settings as the form holds them (handoff 221), and the
 * way back to the API's shape. A slot keeps the `id` the API gave it, so the
 * orders booked into it keep pointing at it; a slot added here has none and
 * is given one on save.
 */

export interface SlotDraft {
  /** The form's own handle on the row (never sent). */
  key: string;
  /** The API's id; absent on a slot added in this form. */
  id?: string;
  from: string;
  to: string;
  /** "" = unlimited. */
  capacity: string;
}

export type WeekDraft = Record<DeliverySlotWeekday, SlotDraft[]>;

export interface SlotSettingsDraft {
  enabled: boolean;
  required: boolean;
  leadDays: number;
  /** "" = no cutoff. */
  cutoffTime: string;
  notice: string;
  horizon: string;
  weekly: WeekDraft;
  closedDates: string[];
  noteAr: string;
  noteEn: string;
}

/** Field problems, by the form's own keys: "horizon", "notice", "weekly", and a slot row's `key`. */
export type SlotErrors = Record<string, string>;

let nextKey = 1;
export function newSlotKey(): string {
  return `slot-${nextKey++}`;
}

export function emptySlot(): SlotDraft {
  return { key: newSlotKey(), from: "", to: "", capacity: "" };
}

/**
 * The saved settings as a draft. Closed days already behind us (before
 * `keepFrom`, yesterday) are left out: they change nothing any more, and the
 * list has a limit.
 */
export function toSlotDraft(s: DeliverySlotSettings, today: string): SlotSettingsDraft {
  const keepFrom = addDays(today, -1);
  const weekly = Object.fromEntries(
    DELIVERY_SLOT_WEEKDAYS.map((day) => [
      day,
      (s.weekly?.[day] ?? []).map((slot) => ({
        key: newSlotKey(),
        ...(slot.id ? { id: slot.id } : {}),
        from: slot.from ?? "",
        to: slot.to ?? "",
        capacity: numberField(slot.capacity),
      })),
    ])
  ) as WeekDraft;
  return {
    enabled: s.enabled === true,
    required: s.required === true,
    leadDays: Number.isInteger(s.leadDays) ? s.leadDays : 1,
    cutoffTime: s.cutoffTime ?? "",
    notice: String(s.sameDayNoticeMinutes ?? 120),
    horizon: String(s.horizonDays ?? 7),
    weekly,
    closedDates: [...new Set(s.closedDates ?? [])].filter((d) => d >= keepFrom).sort(),
    noteAr: s.note?.ar ?? "",
    noteEn: s.note?.en ?? "",
  };
}

export function slotCount(week: WeekDraft): number {
  return DELIVERY_SLOT_WEEKDAYS.reduce((n, day) => n + week[day].length, 0);
}

/**
 * The body the API takes, or what is wrong with the form. A day's slots go
 * out sorted by their start, so the checkout lists them in order; `sent`
 * names each day's rows in that order, for a 422 that points at
 * `weekly.<day>.<index>`.
 */
export function toSlotBody(
  draft: SlotSettingsDraft,
  t: DeliverySlotText
): { body: DeliverySlotSettings; sent: Record<string, string[]> } | { errors: SlotErrors } {
  const errors: SlotErrors = {};

  const horizon = parseWholeNumber(draft.horizon, 1, DELIVERY_SLOT_HORIZON_DAYS_MAX);
  if (horizon === null || Number.isNaN(horizon)) errors.horizon = t.errHorizon;
  // Only asked for when today can be chosen; otherwise the saved value rides along untouched.
  const notice = parseWholeNumber(draft.notice, 0, DELIVERY_SLOT_NOTICE_MINUTES_MAX);
  if (notice === null || Number.isNaN(notice)) errors.notice = t.errNotice;

  const weekly: DeliverySlotSettings["weekly"] = {};
  const sent: Record<string, string[]> = {};
  for (const day of DELIVERY_SLOT_WEEKDAYS) {
    const rows = draft.weekly[day];
    if (rows.length === 0) continue;
    const out: Array<{ key: string; slot: DeliverySlot }> = [];
    for (const row of rows) {
      const capacity = parseWholeNumber(row.capacity, 1, DELIVERY_SLOT_CAPACITY_MAX);
      if (!isSlotTime(row.from) || !isSlotTime(row.to)) errors[row.key] = t.errTime;
      else if (slotMinutes(row.to) <= slotMinutes(row.from)) errors[row.key] = t.errOrder;
      else if (Number.isNaN(capacity)) errors[row.key] = t.errCapacity;
      else out.push({ key: row.key, slot: { ...(row.id ? { id: row.id } : {}), from: row.from, to: row.to, capacity } });
    }
    out.sort((a, b) => slotMinutes(a.slot.from) - slotMinutes(b.slot.from) || slotMinutes(a.slot.to) - slotMinutes(b.slot.to));
    weekly[day] = out.map((x) => x.slot);
    sent[day] = out.map((x) => x.key);
  }
  // On with nothing to choose from: the checkout would show no slot, and a required one could not be met.
  if (draft.enabled && slotCount(draft.weekly) === 0) errors.weekly = t.errNoSlots;

  if (Object.keys(errors).length > 0) return { errors };

  const ar = draft.noteAr.trim().slice(0, DELIVERY_SLOT_NOTE_MAX);
  const en = draft.noteEn.trim().slice(0, DELIVERY_SLOT_NOTE_MAX);
  return {
    sent,
    body: {
      enabled: draft.enabled,
      required: draft.required,
      leadDays: draft.leadDays,
      cutoffTime: draft.cutoffTime || null,
      sameDayNoticeMinutes: notice as number,
      horizonDays: horizon as number,
      weekly,
      closedDates: [...new Set(draft.closedDates)].sort().slice(0, DELIVERY_SLOT_CLOSED_DATES_MAX),
      note: ar || en ? { ar, en } : null,
    },
  };
}

/** A comparable form of the draft: what would be sent, or its raw text while it cannot be. */
export function slotSignature(draft: SlotSettingsDraft): string {
  const rows = DELIVERY_SLOT_WEEKDAYS.map((day) => draft.weekly[day].map((r) => [r.id ?? "", r.from, r.to, r.capacity.trim()]));
  return JSON.stringify([
    draft.enabled,
    draft.required,
    draft.leadDays,
    draft.cutoffTime,
    draft.notice.trim(),
    draft.horizon.trim(),
    rows,
    [...draft.closedDates].sort(),
    draft.noteAr.trim(),
    draft.noteEn.trim(),
  ]);
}
