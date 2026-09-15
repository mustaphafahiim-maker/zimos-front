import type { ReactNode } from "react";
import { cn } from "@store-builder/ui";
import { useLocale } from "@/i18n/LocaleContext";

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

export function StatusBadge({ tone, children, dot = false, className }: { tone: Tone; children: ReactNode; dot?: boolean; className?: string }) {
  return (
    <span className={cn("inline-flex h-6 w-fit shrink-0 items-center gap-1.5 whitespace-nowrap rounded-full border px-2 text-xs font-medium", TONE_CLASS[tone], className)}>
      {dot && <span className={cn("size-1.5 rounded-full", DOT_CLASS[tone])} aria-hidden />}
      {children}
    </span>
  );
}

const STATUS_TONES: Record<string, Tone> = {
  trialing: "info",
  active: "success",
  past_due: "warning",
  cancelled: "neutral",
  canceled: "neutral",
  suspended: "danger",
  closed: "neutral",
  pending_verification: "warning",
  published: "success",
  draft: "neutral",
  unpublished: "neutral",
};

const STATUS_LABELS: Record<string, { en: string; ar: string }> = {
  trialing: { en: "Trialing", ar: "فترة تجريبية" },
  active: { en: "Active", ar: "نشط" },
  past_due: { en: "Past due", ar: "متأخر في الدفع" },
  cancelled: { en: "Cancelled", ar: "ملغي" },
  canceled: { en: "Cancelled", ar: "ملغي" },
  suspended: { en: "Suspended", ar: "موقوف" },
  closed: { en: "Closed", ar: "مقفول" },
  pending_verification: { en: "Pending verification", ar: "مستني التأكيد" },
  published: { en: "Published", ar: "منشور" },
  draft: { en: "Draft", ar: "مسودة" },
  unpublished: { en: "Unpublished", ar: "مش منشور" },
  monthly: { en: "Monthly", ar: "شهري" },
  yearly: { en: "Yearly", ar: "سنوي" },
};

/** Human label from a snake_case value. */
export function humanize(value: string): string {
  const s = value.replace(/[_-]+/g, " ");
  return s.charAt(0).toUpperCase() + s.slice(1);
}

/** Localized label for a backend status value. */
export function useStatusLabel() {
  const { locale } = useLocale();
  return (value: string) => STATUS_LABELS[value]?.[locale] ?? humanize(value);
}

export function Status({ value, className }: { value: string; className?: string }) {
  const label = useStatusLabel();
  return (
    <StatusBadge tone={STATUS_TONES[value] ?? "neutral"} dot className={className}>
      {label(value)}
    </StatusBadge>
  );
}
