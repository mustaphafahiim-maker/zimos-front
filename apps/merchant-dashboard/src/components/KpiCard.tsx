import type { ReactNode } from "react";
import { Card, cn } from "@store-builder/ui";
import { useT } from "@/i18n/LocaleContext";
import { formatPercentValue } from "@/lib/format";
import { Sparkline, type SparklineTone } from "@/components/charts";
import { IconArrowOut, IconCaretDown, IconCaretUp, IconContext } from "@/components/icons";
import { ViewLink } from "@/components/ViewLink";

const STRINGS = {
  en: {
    vsPrevious: "vs the period before",
    nothingToCompare: "Nothing earlier to compare with",
    up: "Up",
    down: "Down",
    loading: "Loading…",
  },
  ar: {
    vsPrevious: "عن الفترة اللي قبلها",
    nothingToCompare: "مفيش فترة قبلها نقارن بيها",
    up: "زاد",
    down: "قلّ",
    loading: "بنحمّل…",
  },
};

export interface KpiCardProps {
  label: string;
  value: ReactNode;
  /** Change vs previous period, in basis points (250 = +2.5%). Null or absent: there is nothing to compare with. */
  deltaBasisPoints?: number | null;
  /** What the change is measured against. "vs the period before" unless the page says otherwise. */
  deltaLabel?: string;
  /** Shown in place of the change when there is none to show. */
  hint?: string;
  /**
   * The values of the period in order, drawn as a small area chart along the
   * bottom of the card (decorative; the value and the change carry the numbers).
   * Drawn from two points up.
   */
  trend?: number[];
  /** The same for the period before, thin and dashed behind it. */
  previousTrend?: number[];
  /**
   * Which direction is the good news. "down" for a return rate or a cost per
   * order: a fall turns the chip green and a rise turns it red, while the arrow
   * still shows the real direction.
   */
  goodWhen?: "up" | "down";
  size?: "md" | "lg";
  /**
   * The card as a skeleton of its own shape while the figure loads, so nothing
   * moves when the number arrives. Pass `trend` (an empty list will do) when a
   * trend will follow, and its room is held too.
   */
  loading?: boolean;
  to?: string;
  icon?: ReactNode;
  className?: string;
}

/** Whether the change is good news, bad news, or no change at all. */
type Mood = "good" | "bad" | "flat";

/** The chip on a solid card. On glass, glass/stats.css re-tints it through data-tone. */
const CHIP: Record<Mood, string> = {
  good: "bg-success-soft text-success",
  bad: "bg-danger-soft text-danger",
  flat: "bg-paper-sunken text-ink-soft",
};

/**
 * The figure: 28px (34px when large) on a line of fixed height. In a card too
 * narrow for that (two to a row on a phone) it steps down with the width of the
 * card, so an amount and its currency stay on one line.
 */
const FIGURE = {
  md: "min-h-9 text-[length:clamp(1.375rem,17cqi,1.75rem)] leading-9",
  lg: "min-h-10 text-[length:clamp(1.625rem,21cqi,2.125rem)] leading-10",
} as const;

/**
 * Icons in the chip are drawn duotone unless the caller names a weight. The
 * size is the default of the family, restated because a context replaces it.
 */
const DUOTONE = { weight: "duotone", size: "1em" } as const;

/** One grey shape of the skeleton. */
function Bone({ className }: { className?: string }) {
  return (
    <span
      aria-hidden
      data-slot="kpi-bone"
      className={cn("block max-w-full animate-pulse rounded-full bg-paper-sunken motion-reduce:animate-none", className)}
    />
  );
}

/**
 * The stat card every figure in the product uses: a quiet label with its icon
 * chip, one big figure, a chip with the change against the period before, and
 * an area sparkline along the bottom edge. A figure never stands alone: with
 * no change to show, the card says what it is (the hint) or that there is
 * nothing earlier to compare with.
 */
export function KpiCard({
  label,
  value,
  deltaBasisPoints,
  deltaLabel,
  hint,
  trend,
  previousTrend,
  goodWhen = "up",
  size = "md",
  loading = false,
  to,
  icon,
  className,
}: KpiCardProps) {
  const t = useT(STRINGS);
  const delta = typeof deltaBasisPoints === "number" && Number.isFinite(deltaBasisPoints) ? deltaBasisPoints : null;
  const rose = !loading && delta !== null && delta > 0;
  const fell = !loading && delta !== null && delta < 0;
  const good = goodWhen === "down" ? fell : rose;
  const bad = goodWhen === "down" ? rose : fell;
  const mood: Mood = good ? "good" : bad ? "bad" : "flat";
  const series = !loading && trend && trend.length > 1 ? trend : null;
  // The line takes the colour of the chip; with nothing to compare it is the brand.
  const sparkTone: SparklineTone = delta === null ? "primary" : good ? "success" : bad ? "danger" : "neutral";
  // While loading: a card that will show a hint holds one line, any other holds the chip and its caption.
  const hintShaped = Boolean(hint) && deltaBasisPoints == null;

  const card = (
    <Card
      // Hooks for the glass layer (liquid-glass.css, glass/stats.css): the staggered settle-in, and the
      // tint under the pointer, green when the change is good news and red when it is bad.
      data-kpi=""
      data-trend={good ? "up" : bad ? "down" : undefined}
      aria-busy={loading || undefined}
      // A size container, so the figure can follow the width of the card. That takes the content out of
      // the width of the card, so a width is named for the rare place that sizes a card by its content.
      className={cn("@container/kpi h-full gap-0 p-4 [contain-intrinsic-inline-size:11rem]", className)}
    >
      <div className="flex items-center justify-between gap-2">
        <div className="flex min-w-0 items-center gap-1">
          <p className="truncate text-[13px] leading-5 font-medium text-ink-soft" title={label}>
            {label}
          </p>
          {to && (
            // Says "this opens": under the pointer or the keyboard, and always on a touch screen, where nothing hovers.
            <IconArrowOut
              aria-hidden
              className="size-3.5 shrink-0 text-ink-soft opacity-0 transition-opacity duration-(--dur-fade) ease-(--ease-out) group-hover/kpi:opacity-100 group-focus-visible/kpi:opacity-100 motion-reduce:transition-none rtl:-scale-x-100 [@media(hover:none)]:opacity-70"
            />
          )}
        </div>
        {icon && (
          <span
            aria-hidden
            data-slot="kpi-icon"
            className="flex size-8 shrink-0 items-center justify-center rounded-[10px] bg-primary-soft text-primary [&>svg]:size-4"
          >
            <IconContext.Provider value={DUOTONE}>{icon}</IconContext.Provider>
          </span>
        )}
      </div>

      {loading ? (
        <>
          <div className={cn("mt-1 flex items-center", size === "lg" ? "h-10" : "h-9")}>
            <Bone className={size === "lg" ? "h-7 w-28" : "h-6 w-24"} />
          </div>
          <div className="mt-2 flex min-h-6 flex-wrap items-center gap-x-1.5 gap-y-1">
            {hintShaped ? (
              <Bone className="h-3 w-32" />
            ) : (
              <>
                <Bone className="h-6 w-14" />
                <Bone className="my-0.5 h-3 w-28" />
              </>
            )}
          </div>
          {trend !== undefined && (
            <div className="-mx-4 -mb-4 mt-auto pt-3">
              <span
                aria-hidden
                data-slot="kpi-bone-wash"
                className="block h-11 animate-pulse bg-linear-to-t from-paper-sunken to-transparent motion-reduce:animate-none"
              />
            </div>
          )}
          <span className="sr-only">{t.loading}</span>
        </>
      ) : (
        <>
          {/* <bdi>: a number, its sign and its currency keep their own order inside an Arabic line. */}
          <p
            data-slot="kpi-figure"
            className={cn("mt-1 min-w-0 font-semibold tracking-tight wrap-anywhere text-ink tabular-nums", FIGURE[size])}
          >
            <bdi>{value}</bdi>
          </p>

          {delta !== null ? (
            <p className="mt-2 flex min-h-6 flex-wrap items-center gap-x-1.5 gap-y-1 text-xs leading-4 text-ink-soft">
              <span
                data-slot="kpi-chip"
                data-tone={mood}
                className={cn("inline-flex h-6 shrink-0 items-center gap-0.5 rounded-full px-2 font-semibold tabular-nums", CHIP[mood])}
              >
                {rose ? (
                  <IconCaretUp weight="fill" aria-hidden className="-ms-0.5 size-3.5 shrink-0" />
                ) : fell ? (
                  <IconCaretDown weight="fill" aria-hidden className="-ms-0.5 size-3.5 shrink-0" />
                ) : (
                  <span aria-hidden className="me-0.5">
                    •
                  </span>
                )}
                {(rose || fell) && <span className="sr-only">{rose ? t.up : t.down}</span>}
                <bdi>{formatPercentValue(Math.abs(delta) / 10000)}</bdi>
              </span>
              <span className="min-w-0">{deltaLabel ?? t.vsPrevious}</span>
            </p>
          ) : (
            <p className="mt-2 flex min-h-6 items-center text-xs leading-4 text-pretty text-ink-soft">
              {hint ? hint : t.nothingToCompare}
            </p>
          )}

          {series && (
            // Runs off the start, end and bottom edges; the card clips it to its own corners. Time
            // reads left to right in Arabic too, and the room at the end is for the dot on the last point.
            <div dir="ltr" data-slot="kpi-trend" className="-mx-4 -mb-4 mt-auto pt-3 pe-3.5">
              <Sparkline current={series} previous={previousTrend} height={44} area bleed tone={sparkTone} className="block h-11" />
            </div>
          )}
        </>
      )}
    </Card>
  );

  if (!to) return card;
  return (
    // The radius is written without var() on purpose: the glass layer lifts any link whose class
    // names rounded-[var(--radius-card)], and the card inside already lifts 2px under the pointer.
    <ViewLink
      to={to}
      className="group/kpi block rounded-(--radius-card) transition-[scale] duration-(--dur-fade) ease-(--ease-out) focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary active:scale-[0.97] motion-reduce:transition-none motion-reduce:active:scale-100"
    >
      {card}
    </ViewLink>
  );
}
