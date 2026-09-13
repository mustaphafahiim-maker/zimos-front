/**
 * ZIMOS brand primitives that the shadcn preset does not ship.
 * All styling uses the semantic tokens from brand/zimos.css and logical
 * (RTL-safe) utilities only.
 */
import * as React from "react"
import { cn } from "cn"

/* ------------------------------------------------------------ Skeleton -- */

export function Skeleton({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="skeleton"
      aria-hidden
      className={cn("animate-pulse rounded-[10px] bg-zimos-ice dark:bg-primary-soft", className)}
      {...props}
    />
  )
}

/** A table-shaped loading placeholder. */
export function SkeletonRows({ rows = 5, className }: { rows?: number; className?: string }) {
  return (
    <div className={cn("space-y-2", className)} role="status" aria-label="Loading">
      {Array.from({ length: rows }, (_, i) => (
        <Skeleton key={i} className="h-11 w-full" style={{ opacity: 1 - i * 0.12 }} />
      ))}
    </div>
  )
}

/* -------------------------------------------------------------- Avatar -- */

function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean)
  if (parts.length === 0) return "?"
  const first = Array.from(parts[0])[0] ?? ""
  const last = parts.length > 1 ? Array.from(parts[parts.length - 1])[0] ?? "" : ""
  return (first + last).toUpperCase()
}

export function Avatar({
  name,
  src,
  size = 32,
  className,
}: {
  name: string
  src?: string | null
  size?: number
  className?: string
}) {
  return (
    <span
      data-slot="avatar"
      className={cn(
        "inline-flex shrink-0 items-center justify-center overflow-hidden rounded-full bg-primary-soft font-semibold text-primary",
        className
      )}
      style={{ width: size, height: size, fontSize: Math.max(10, Math.round(size * 0.38)) }}
      title={name}
    >
      {src ? <img src={src} alt={name} className="size-full object-cover" /> : initials(name)}
    </span>
  )
}

/* ------------------------------------------------------------ Progress -- */

export function Progress({
  value,
  max = 100,
  tone = "primary",
  className,
  label,
}: {
  value: number
  max?: number
  tone?: "primary" | "success" | "warning" | "danger"
  className?: string
  label?: string
}) {
  const pct = Math.max(0, Math.min(100, (value / Math.max(max, 1)) * 100))
  const bar = {
    primary: "bg-primary",
    success: "bg-success",
    warning: "bg-warning",
    danger: "bg-danger",
  }[tone]
  return (
    <div
      role="progressbar"
      aria-valuemin={0}
      aria-valuemax={max}
      aria-valuenow={value}
      aria-label={label}
      className={cn("h-2 w-full overflow-hidden rounded-full bg-zimos-ice dark:bg-primary-soft", className)}
    >
      <div
        className={cn("h-full rounded-full transition-[width] duration-300 ease-[cubic-bezier(.2,.8,.2,1)]", bar)}
        style={{ width: `${pct}%` }}
      />
    </div>
  )
}

/* ---------------------------------------------------- SegmentedControl -- */

export interface SegmentOption<V extends string> {
  value: V
  label: React.ReactNode
}

export function SegmentedControl<V extends string>({
  options,
  value,
  onChange,
  size = "default",
  className,
  ariaLabel,
}: {
  options: ReadonlyArray<SegmentOption<V>>
  value: V
  onChange: (next: V) => void
  size?: "sm" | "default"
  className?: string
  ariaLabel?: string
}) {
  return (
    <div
      role="radiogroup"
      aria-label={ariaLabel}
      className={cn(
        "inline-flex items-center gap-0.5 rounded-[12px] border border-line bg-paper-raised p-0.5",
        className
      )}
    >
      {options.map((o) => {
        const active = o.value === value
        return (
          <button
            key={o.value}
            type="button"
            role="radio"
            aria-checked={active}
            onClick={() => onChange(o.value)}
            className={cn(
              "cursor-pointer rounded-[10px] font-medium transition-colors",
              size === "sm" ? "h-7 px-2.5 text-xs" : "h-8 px-3 text-sm",
              active ? "bg-primary text-white" : "text-ink-soft hover:bg-zimos-cloud hover:text-ink dark:hover:bg-primary-soft"
            )}
          >
            {o.label}
          </button>
        )
      })}
    </div>
  )
}

/* ----------------------------------------------------------------- Kbd -- */

export function Kbd({ className, ...props }: React.ComponentProps<"kbd">) {
  return (
    <kbd
      dir="ltr"
      className={cn(
        "inline-flex h-5 min-w-5 items-center justify-center rounded-md border border-line bg-zimos-cloud px-1 font-sans text-[11px] font-medium text-ink-soft dark:bg-primary-soft",
        className
      )}
      {...props}
    />
  )
}

/* ------------------------------------------------------------- Stepper -- */

export interface StepperStep {
  label: React.ReactNode
  description?: React.ReactNode
}

/** Horizontal (md+) / vertical (mobile) step indicator. `current` is 0-based. */
export function Stepper({
  steps,
  current,
  className,
}: {
  steps: ReadonlyArray<StepperStep>
  current: number
  className?: string
}) {
  return (
    <ol className={cn("flex flex-col gap-3 md:flex-row md:items-start md:gap-0", className)}>
      {steps.map((s, i) => {
        const done = i < current
        const active = i === current
        return (
          <li key={i} className="flex flex-1 items-start gap-3 md:flex-col md:items-center md:text-center">
            <div className="flex items-center md:w-full">
              <span
                className={cn(
                  "hidden h-0.5 flex-1 md:block",
                  i === 0 ? "invisible" : done || active ? "bg-primary" : "bg-line"
                )}
              />
              <span
                className={cn(
                  "flex size-8 shrink-0 items-center justify-center rounded-full border-2 text-xs font-semibold",
                  done && "border-primary bg-primary text-white",
                  active && "border-primary bg-primary-soft text-primary",
                  !done && !active && "border-line bg-paper-raised text-ink-muted"
                )}
                aria-current={active ? "step" : undefined}
              >
                {done ? "✓" : i + 1}
              </span>
              <span
                className={cn(
                  "hidden h-0.5 flex-1 md:block",
                  i === steps.length - 1 ? "invisible" : done ? "bg-primary" : "bg-line"
                )}
              />
            </div>
            <div className="min-w-0 md:mt-2 md:px-2">
              <p className={cn("text-sm font-medium", active || done ? "text-ink" : "text-ink-soft")}>{s.label}</p>
              {s.description && <p className="mt-0.5 text-xs text-ink-muted">{s.description}</p>}
            </div>
          </li>
        )
      })}
    </ol>
  )
}

/* ---------------------------------------------------------------- Chip -- */

export function Chip({
  active = false,
  className,
  ...props
}: React.ComponentProps<"button"> & { active?: boolean }) {
  return (
    <button
      type="button"
      aria-pressed={active}
      className={cn(
        "inline-flex h-8 cursor-pointer items-center gap-1.5 rounded-full border px-3 text-sm font-medium transition-colors",
        active
          ? "border-primary bg-primary-soft text-primary"
          : "border-line bg-paper-raised text-ink-soft hover:border-line-strong hover:text-ink",
        className
      )}
      {...props}
    />
  )
}
