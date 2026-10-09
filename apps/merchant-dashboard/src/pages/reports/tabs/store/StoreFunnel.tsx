import type { ReportsFunnelStep, ReportsFunnelStepKey } from "@store-builder/api-client";
import { cn } from "@store-builder/ui";
import { IconTrendDown } from "@/components/icons";
import { fmt, useT } from "@/i18n/LocaleContext";
import { formatCount } from "@/lib/analytics";
import { pluralOf } from "@/lib/plural";
import { formatRate } from "./model";
import { STORE_STRINGS } from "./strings";

/** The line of a step — its name, how many reached it, the share of the step before — is always this tall. */
const LINE = 20;

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));

/**
 * The tab's ONE chart: the store's purchase path as connected bars. One row
 * per step, top to bottom — a line of words over a bar as wide as the step's
 * share of the widest one — and between two bars a sloped band that shows what
 * was lost on the way: the steeper the slope, the more people left there.
 *
 * It is not a time axis, so it follows the reading direction: the bars grow
 * from the start edge (the right, in Arabic) and the bands are mirrored with
 * them. Every figure is real text; the picture behind it is decoration, and
 * each bar carries its numbers as a tooltip as well.
 *
 * The step the tab's sentence names (`leak`) is drawn in the danger colour and
 * its chip carries an icon and a spoken label, so colour is never the only cue.
 *
 * `height` is the chart card's body (220px on a phone): the lines keep their
 * size, and the bars and the bands between them share what is left.
 */
export function StoreFunnel({
  steps,
  height,
  leak,
  labels,
}: {
  steps: readonly ReportsFunnelStep[];
  height: number;
  /** The step that keeps the smallest share of the one before it, when there is enough data to say. */
  leak: ReportsFunnelStepKey | null;
  labels: Record<ReportsFunnelStepKey, string>;
}) {
  const t = useT(STORE_STRINGS);
  const count = steps.length;
  if (count === 0) return null;

  const spare = Math.max(0, height - count * LINE);
  const bar = clamp(Math.floor(spare / (2 * count)), 6, 28);
  const gap = count > 1 ? clamp(Math.floor((spare - bar * count) / (count - 1)), 2, 32) : 0;
  const pitch = LINE + bar + gap;
  const total = count * (LINE + bar) + (count - 1) * gap;

  // A later step can be wider than the first (a "buy now" button skips the cart): the widest one is the full width.
  const widest = Math.max(1, ...steps.map((step) => step.sessions));
  const widthOf = (sessions: number) => (Math.max(0, sessions) / widest) * 100;

  return (
    <div className="relative min-w-0" style={{ height: total }}>
      {/* The bands. One unit across is one percent of the width; one unit down is one pixel. */}
      <svg
        aria-hidden
        viewBox={`0 0 100 ${total}`}
        preserveAspectRatio="none"
        className="pointer-events-none absolute inset-0 h-full w-full rtl:-scale-x-100"
      >
        {steps.slice(1).map((step, index) => {
          const before = steps[index];
          const from = index * pitch + LINE + bar;
          const to = (index + 1) * pitch + LINE;
          const hot = step.step === leak;
          return (
            <polygon
              key={step.step}
              points={`0,${from} ${widthOf(before.sessions).toFixed(2)},${from} ${widthOf(step.sessions).toFixed(2)},${to} 0,${to}`}
              fill={hot ? "var(--color-danger)" : "var(--color-primary)"}
              fillOpacity={hot ? 0.16 : 0.1}
            />
          );
        })}
      </svg>

      <ol aria-label={t.funnelSummary} className="relative flex list-none flex-col" style={{ rowGap: gap }}>
        {steps.map((step, index) => {
          const hot = step.step === leak;
          const lost = index > 0 ? steps[index - 1].sessions - step.sessions : 0;
          const width = widthOf(step.sessions);
          return (
            <li key={step.step} className="min-w-0">
              <div className="flex min-w-0 items-center justify-between gap-2" style={{ height: LINE }}>
                <p className="flex min-w-0 items-baseline gap-2 text-[13px] leading-5">
                  <span className="truncate font-medium text-ink">{labels[step.step]}</span>
                  <bdi dir="ltr" className="shrink-0 font-semibold text-ink tabular-nums">
                    {formatCount(step.sessions)}
                  </bdi>
                  {index > 0 && step.rateOfSessions !== null && (
                    // On a phone the line has room for the step, its count and its chip; this share is in «تفاصيل أكتر» too.
                    <span className="shrink-0 text-xs text-ink-soft max-sm:hidden">
                      <bdi dir="ltr" className="tabular-nums">
                        {formatRate(step.rateOfSessions)}
                      </bdi>{" "}
                      {t.ofAll}
                    </span>
                  )}
                </p>
                {index > 0 && step.rateOfPrevious !== null && (
                  <p className="flex shrink-0 items-center gap-2 text-xs leading-4">
                    {lost > 0 && <span className="text-ink-soft max-sm:hidden">{pluralOf(t, "left", lost)}</span>}
                    <span
                      data-slot="funnel-chip"
                      data-tone={hot ? "bad" : undefined}
                      className={cn(
                        "inline-flex h-[18px] items-center gap-1 rounded-full px-2 font-semibold",
                        hot ? "bg-danger-soft text-danger" : "bg-paper-sunken text-ink-soft"
                      )}
                    >
                      {hot && <IconTrendDown weight="bold" className="size-3 shrink-0" aria-hidden />}
                      {hot && <span className="sr-only">{t.biggestLeak}</span>}
                      <bdi dir="ltr" className="tabular-nums">
                        {formatRate(step.rateOfPrevious)}
                      </bdi>
                      <span>{t.ofPrevious}</span>
                    </span>
                  </p>
                )}
              </div>
              <div
                style={{ height: bar }}
                title={fmt(t.barTitle, {
                  step: labels[step.step],
                  count: formatCount(step.sessions),
                  rate: formatRate(step.rateOfSessions),
                })}
              >
                <div
                  data-slot="funnel-bar"
                  // The bar is the people who made it, so it keeps the brand colour; only the band into a leaking step turns red.
                  className={cn("h-full rounded-[5px]", step.sessions > 0 ? "bg-primary" : "bg-line-strong")}
                  // A step somebody reached is never thinner than a hairline's worth; an empty one is a tick on the start edge.
                  style={{ width: step.sessions > 0 ? `max(${width.toFixed(2)}%, 4px)` : "2px" }}
                />
              </div>
            </li>
          );
        })}
      </ol>
    </div>
  );
}
