import type { Agent, CallLog, CallOutcome, ConfirmationItem } from "@/mock/types2";

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

export const AGENT_STATUS_DOT: Record<Agent["status"], string> = {
  online: "bg-success",
  on_call: "bg-primary",
  break: "bg-accent",
  offline: "bg-ink-soft/40",
};

export const AGENT_STATUS_TONE: Record<Agent["status"], BadgeTone> = {
  online: "success",
  on_call: "info",
  break: "warning",
  offline: "neutral",
};

/** 84 -> "01:24" */
export function formatDuration(seconds: number): string {
  const s = Math.max(0, Math.round(seconds));
  const m = Math.floor(s / 60);
  const r = s % 60;
  return `${String(m).padStart(2, "0")}:${String(r).padStart(2, "0")}`;
}

export function isDueNow(item: ConfirmationItem, now: number = Date.now()): boolean {
  return item.nextAttemptAt === null || new Date(item.nextAttemptAt).getTime() <= now;
}

/** "due now" / "due in 12m" / "due in 2h 05m" */
export function dueLabel(item: ConfirmationItem, now: number = Date.now()): string {
  if (item.nextAttemptAt === null) return "due now";
  const diff = new Date(item.nextAttemptAt).getTime() - now;
  if (diff <= 0) return "due now";
  const mins = Math.round(diff / 60000);
  if (mins < 60) return `due in ${mins}m`;
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return `due in ${h}h ${String(m).padStart(2, "0")}m`;
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
