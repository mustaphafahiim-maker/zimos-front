import type { ReactNode } from "react";
import { cn } from "@store-builder/ui";

export type Tone = "success" | "warning" | "danger" | "info" | "neutral" | "primary";

const TONE_CLASS: Record<Tone, string> = {
  success: "bg-success-soft text-success border-success/20",
  warning: "bg-warning-soft text-warning border-warning/20",
  danger: "bg-danger-soft text-danger border-danger/20",
  info: "bg-info-soft text-info border-info/20",
  primary: "bg-primary-soft text-primary border-primary/20",
  neutral: "bg-paper text-ink-soft border-line",
};

const DOT_CLASS: Record<Tone, string> = {
  success: "bg-success",
  warning: "bg-warning",
  danger: "bg-danger",
  info: "bg-info",
  primary: "bg-primary",
  neutral: "bg-ink-muted",
};

export function StatusBadge({
  tone,
  children,
  dot = false,
  className,
}: {
  tone: Tone;
  children: ReactNode;
  dot?: boolean;
  className?: string;
}) {
  return (
    <span
      className={cn(
        "inline-flex h-6 w-fit shrink-0 items-center gap-1.5 whitespace-nowrap rounded-full border px-2 text-xs font-medium",
        TONE_CLASS[tone],
        className
      )}
    >
      {dot && <span className={cn("size-1.5 rounded-full", DOT_CLASS[tone])} aria-hidden />}
      {children}
    </span>
  );
}

/** Human label from a snake_case / kebab value. */
export function humanize(value: string): string {
  const s = value.replace(/[_-]+/g, " ");
  return s.charAt(0).toUpperCase() + s.slice(1);
}

const STATUS_TONES: Record<string, Tone> = {
  // subscriptions
  trialing: "info",
  active: "success",
  past_due: "warning",
  canceled: "neutral",
  suspended: "danger",
  // health
  operational: "success",
  degraded: "warning",
  down: "danger",
  unknown: "neutral",
  // moderation
  pending: "warning",
  approved: "success",
  rejected: "danger",
  // apps
  live: "success",
  beta: "info",
  hidden: "neutral",
  // tickets
  open: "primary",
  resolved: "success",
  closed: "neutral",
  // priority
  low: "neutral",
  normal: "info",
  high: "warning",
  urgent: "danger",
  // announcements
  scheduled: "info",
  ended: "neutral",
  // credentials
  configured: "success",
  missing: "danger",
  expired: "warning",
  // admin users
  invited: "warning",
  disabled: "neutral",
};

/** Status pill with the tone looked up from a shared status vocabulary. */
export function Status({ value, label, className }: { value: string; label?: string; className?: string }) {
  return (
    <StatusBadge tone={STATUS_TONES[value] ?? "neutral"} dot className={className}>
      {label ?? humanize(value)}
    </StatusBadge>
  );
}
