import { cn } from "@store-builder/ui";
import { humanize } from "@/lib/format";
import { useLocale } from "@/i18n/LocaleContext";

type Tone = "neutral" | "info" | "success" | "warning" | "danger";

const TONE_CLASS: Record<Tone, string> = {
  neutral: "bg-paper text-ink-soft border-line",
  info: "bg-info-soft text-info border-info/25",
  success: "bg-success-soft text-success border-success/25",
  warning: "bg-warning-soft text-warning border-warning/30",
  danger: "bg-danger-soft text-danger border-danger/25",
};

const DOT_CLASS: Record<Tone, string> = {
  neutral: "bg-ink-muted",
  info: "bg-info",
  success: "bg-success",
  warning: "bg-warning",
  danger: "bg-danger",
};

// Every order / shipment / return / product status the dashboard can render.
// Arabic labels for each key live in lib/format.ts (humanize).
export const STATUS_TONE: Record<string, Tone> = {
  // product
  draft: "neutral",
  active: "success",
  archived: "neutral",
  // discount (computed from status + date range, not a backend enum value)
  scheduled: "info",
  expired: "neutral",
  disabled: "neutral",
  // shipping zone / rate isActive flag
  inactive: "neutral",
  // confirmation
  pending: "warning",
  confirmed: "success",
  rejected: "danger",
  unreachable: "danger",
  postponed: "warning",
  // financial
  partially_paid: "warning",
  paid: "success",
  failed: "danger",
  refunded: "neutral",
  partially_refunded: "warning",
  // fulfillment
  unfulfilled: "warning",
  partially_fulfilled: "info",
  fulfilled: "success",
  returned: "danger",
  // shipment
  created: "neutral",
  picked_up: "info",
  in_transit: "info",
  out_for_delivery: "info",
  delivered: "success",
  cancelled: "neutral",
  // return
  requested: "warning",
  approved: "info",
  received: "success",
};

interface StatusBadgeProps {
  value: string;
  /** Override the auto-picked tone. */
  tone?: Tone;
  /** Small caption before the value, e.g. "Payment". */
  label?: string;
  className?: string;
}

export function StatusBadge({ value, tone, label, className }: StatusBadgeProps) {
  // Subscribe to locale changes so the humanized label re-renders on switch.
  useLocale();
  const resolved = tone ?? STATUS_TONE[value] ?? "neutral";
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 whitespace-nowrap rounded-full border px-2 py-0.5 text-xs font-medium",
        TONE_CLASS[resolved],
        className
      )}
    >
      <span className={cn("size-1.5 rounded-full", DOT_CLASS[resolved])} aria-hidden />
      {label && <span className="opacity-70">{label}:</span>}
      {humanize(value)}
    </span>
  );
}
