import type { Agent, CallLog, CallOutcome, ConfirmationItem } from "@/mock/types2";
import type { Locale } from "@/i18n/LocaleContext";

export type BadgeTone = "neutral" | "info" | "success" | "warning" | "danger";

export const OUTCOME_TONE: Record<CallOutcome, BadgeTone> = {
  confirmed: "success",
  no_answer: "warning",
  busy: "warning",
  cancelled: "danger",
  wrong_number: "danger",
  postponed: "info",
  duplicate: "neutral",
};

export const OUTCOME_LABELS: Record<Locale, Record<CallOutcome, string>> = {
  en: {
    confirmed: "Confirmed",
    no_answer: "No answer",
    busy: "Busy",
    cancelled: "Cancelled",
    wrong_number: "Wrong number",
    postponed: "Postponed",
    duplicate: "Duplicate",
  },
  ar: {
    confirmed: "تم التأكيد",
    no_answer: "لم يرد",
    busy: "مشغول",
    cancelled: "ملغي",
    wrong_number: "رقم خاطئ",
    postponed: "مؤجل",
    duplicate: "مكرر",
  },
};

export function outcomeLabel(outcome: CallOutcome, locale: Locale): string {
  return OUTCOME_LABELS[locale][outcome];
}

export const AGENT_STATUS_DOT: Record<Agent["status"], string> = {
  online: "bg-success",
  on_call: "bg-primary",
  break: "bg-warning",
  offline: "bg-ink-soft/40",
};

export const AGENT_STATUS_TONE: Record<Agent["status"], BadgeTone> = {
  online: "success",
  on_call: "info",
  break: "warning",
  offline: "neutral",
};

export const AGENT_STATUS_LABELS: Record<Locale, Record<Agent["status"], string>> = {
  en: {
    online: "Online",
    on_call: "On call",
    break: "Break",
    offline: "Offline",
  },
  ar: {
    online: "متصل",
    on_call: "في مكالمة",
    break: "استراحة",
    offline: "غير متصل",
  },
};

export function agentStatusLabel(status: Agent["status"], locale: Locale): string {
  return AGENT_STATUS_LABELS[locale][status];
}

/** 84 -> "01:24" */
export function formatDuration(seconds: number): string {
  const s = Math.max(0, Math.round(seconds));
  const m = Math.floor(s / 60);
  const r = s % 60;
  return `${String(m).padStart(2, "0")}:${String(r).padStart(2, "0")}`;
}

/** Anything with a next-attempt time: the mock ConfirmationItem or the real queue item. */
type Schedulable = Pick<ConfirmationItem, "nextAttemptAt">;

export function isDueNow(item: Schedulable, now: number = Date.now()): boolean {
  return item.nextAttemptAt === null || new Date(item.nextAttemptAt).getTime() <= now;
}

/**
 * en: "due now" / "due in 12m" / "due in 2h 05m"
 * ar: "مستحق الآن" / "مستحق خلال 12 د" / "مستحق خلال 2 س 05 د"
 */
export function dueLabel(item: Schedulable,locale: Locale, now: number = Date.now()): string {
  const dueNow = locale === "ar" ? "مستحق الآن" : "due now";
  if (item.nextAttemptAt === null) return dueNow;
  const diff = new Date(item.nextAttemptAt).getTime() - now;
  if (diff <= 0) return dueNow;
  const mins = Math.round(diff / 60000);
  if (mins < 60) return locale === "ar" ? `مستحق خلال ${mins} د` : `due in ${mins}m`;
  const h = Math.floor(mins / 60);
  const m = String(mins % 60).padStart(2, "0");
  return locale === "ar" ? `مستحق خلال ${h} س ${m} د` : `due in ${h}h ${m}m`;
}

export function isToday(iso: string, now: Date = new Date()): boolean {
  const d = new Date(iso);
  return d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth() && d.getDate() === now.getDate();
}

export function agentInitials(name: string): string {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p.charAt(0))
    .join("");
}

export function avgHandleSeconds(logs: CallLog[]): number {
  const answered = logs.filter((l) => l.durationSeconds > 0);
  if (answered.length === 0) return 0;
  return Math.round(answered.reduce((a, l) => a + l.durationSeconds, 0) / answered.length);
}
