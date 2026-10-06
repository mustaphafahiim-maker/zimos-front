import { cn } from "@store-builder/ui";
import { humanize } from "@/lib/format";

type Tone = "neutral" | "info" | "success" | "warning" | "danger";

/* A soft pill with a dot: the word carries the meaning, the colour only helps
   (docs/ux/06-design-system.md §2, never colour alone). */
const TONE_CLASS: Record<Tone, string> = {
  neutral: "bg-paper-sunken text-ink-soft",
  info: "bg-primary-soft text-primary-dark",
  success: "bg-success-soft text-success",
  warning: "bg-accent-soft text-accent-dark",
  danger: "bg-danger-soft text-danger",
};

// Every order / shipment / return / product status the dashboard can render.
const STATUS_TONE: Record<string, Tone> = {
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
  /** Small caption above the value, e.g. "Payment". */
  label?: string;
  /** Shown instead of the humanized value, e.g. a translated status. */
  text?: string;
  className?: string;
}

export function StatusBadge({ value, tone, label, text, className }: StatusBadgeProps) {
  const resolved = tone ?? STATUS_TONE[value] ?? "neutral";
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium whitespace-nowrap",
        TONE_CLASS[resolved],
        className
      )}
    >
      <span aria-hidden className="size-1.5 shrink-0 rounded-full bg-current opacity-80" />
      {label && <span className="font-normal">{label}:</span>}
      {text ?? humanize(value)}
    </span>
  );
}
