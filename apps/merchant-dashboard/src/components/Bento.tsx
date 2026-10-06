import type { ReactNode } from "react";
import { Link } from "react-router-dom";
import { ChevronLeft, type LucideIcon } from "lucide-react";
import { cn } from "@store-builder/ui";

/**
 * The bento grid of docs/ux/06-design-system.md §3: two columns on a phone
 * (small number tiles sit side by side, wide tiles take the row), four from
 * 1024px. Tiles say the answer in words first and
 * the number second.
 */
export function Bento({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <div className={cn("grid grid-flow-row-dense grid-cols-2 gap-[var(--bento-gap)] lg:grid-cols-4", className)}>
      {children}
    </div>
  );
}

export type BentoTone = "default" | "brand" | "attention" | "success" | "danger";

const SPAN = {
  1: "",
  2: "col-span-2",
  3: "col-span-2 lg:col-span-3",
  4: "col-span-2 lg:col-span-4",
} as const;

const TONE: Record<BentoTone, string> = {
  default: "bg-paper-raised",
  brand: "bg-primary text-primary-foreground",
  attention: "bg-accent-soft",
  success: "bg-success-soft",
  danger: "bg-danger-soft",
};

const EYEBROW_TONE: Record<BentoTone, string> = {
  default: "text-ink-soft",
  brand: "text-primary-foreground",
  attention: "text-accent-dark",
  success: "text-success",
  danger: "text-danger",
};

interface BentoTileProps {
  span?: keyof typeof SPAN;
  tone?: BentoTone;
  /** Small icon + label above the answer. */
  icon?: LucideIcon;
  eyebrow?: string;
  /** Makes the whole tile a link (with its own accessible name from the content). */
  to?: string;
  /** The single follow-up link at the end of the tile, when the tile itself isn't a link. */
  action?: { to: string; label: string };
  className?: string;
  children: ReactNode;
}

export function BentoTile({ span = 1, tone = "default", icon: Icon, eyebrow, to, action, className, children }: BentoTileProps) {
  const body = (
    <>
      {(Icon || eyebrow) && (
        <div className={cn("mb-3 flex items-center gap-2 text-[13px] font-medium", EYEBROW_TONE[tone])}>
          {Icon && <Icon className="size-4 shrink-0" strokeWidth={1.75} aria-hidden />}
          {eyebrow && <span className="min-w-0 truncate">{eyebrow}</span>}
        </div>
      )}
      <div className="flex min-w-0 flex-1 flex-col">{children}</div>
      {action && (
        <Link
          to={action.to}
          className={cn(
            "mt-4 inline-flex min-h-11 items-center gap-1 self-start text-sm font-semibold hover:underline",
            tone === "brand" ? "text-primary-foreground" : "text-primary-dark"
          )}
        >
          {action.label}
          <ChevronLeft className="size-4 ltr:rotate-180" aria-hidden />
        </Link>
      )}
    </>
  );
  const classes = cn(
    "flex min-w-0 flex-col rounded-[var(--radius-card)] p-4 shadow-[var(--shadow-card)] ring-1 ring-line sm:p-5",
    tone !== "default" && "ring-transparent",
    TONE[tone],
    SPAN[span],
    to && "transition-[box-shadow,transform] hover:-translate-y-0.5 hover:shadow-[var(--shadow-raised)] motion-reduce:transition-none motion-reduce:hover:translate-y-0",
    className
  );
  return to ? (
    <Link to={to} className={classes}>
      {body}
    </Link>
  ) : (
    <section className={classes}>{body}</section>
  );
}

/** The answer sentence of a tile. */
export function BentoAnswer({ children, className }: { children: ReactNode; className?: string }) {
  return <p className={cn("text-[15px] leading-6 font-medium text-pretty", className)}>{children}</p>;
}

/** The big number under (or beside) the answer. */
export function BentoFigure({ children, className }: { children: ReactNode; className?: string }) {
  return <p className={cn("mt-1 text-[28px] leading-9 font-semibold tabular-nums sm:text-3xl", className)}>{children}</p>;
}

/** A grey placeholder block while a tile loads. */
export function BentoSkeleton({ span = 1 }: { span?: keyof typeof SPAN }) {
  return (
    <div
      aria-hidden
      className={cn("h-36 animate-pulse rounded-[var(--radius-card)] bg-paper-sunken motion-reduce:animate-none", SPAN[span])}
    />
  );
}
