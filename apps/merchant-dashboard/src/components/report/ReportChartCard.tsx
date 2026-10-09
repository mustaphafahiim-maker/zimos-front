import type { ReactNode } from "react";
import { Card, cn } from "@store-builder/ui";
import { useT, type Messages } from "@/i18n/LocaleContext";
import { ChartBones } from "./bones";
import { PHONE_QUERY, useMediaQuery } from "./useMediaQuery";

const STRINGS = {
  en: { loading: "Loading the chart…" },
  ar: { loading: "بنحمّل الرسم…" },
} satisfies Messages;

/** The body is never taller than this on a phone, whatever `height` asks for. */
const PHONE_HEIGHT = 220;

export interface ReportChartCardProps {
  /** What is plotted («المبيعات يوم بيوم»). */
  title: string;
  /** A quiet line under the title: the unit, the source, what the dashed line is. */
  note?: ReactNode;
  /** At the end of the title line: `ReportLegend`, or a small switch. */
  legend?: ReactNode;
  /** Height of the body in px from sm up. Default 280; on a phone it is 220 at most. */
  height?: number;
  /** Draws the outline of a chart, at the same height, in place of the children. */
  loading?: boolean;
  /** A sentence shown in place of the chart when there is nothing to plot. */
  empty?: string | null | false;
  /**
   * The chart. Pass a function to be told the height it has to fill — the
   * charts of components/charts.tsx take a `height` in px:
   * `{(height) => <ComparisonLineChart height={height} … />}`.
   */
  children?: ReactNode | ((height: number) => ReactNode);
  className?: string;
}

/**
 * The frame of the tab's ONE chart: a card with a title line (title, a quiet
 * note, a legend at the end) over a body of fixed height — 280px, 220px on a
 * phone — so the page does not move when the chart arrives, is empty, or
 * changes with the range. A body taller than its box scrolls inside it.
 */
export function ReportChartCard({ title, note, legend, height = 280, loading = false, empty, children, className }: ReportChartCardProps) {
  const t = useT(STRINGS);
  const phone = useMediaQuery(PHONE_QUERY);
  const bodyHeight = phone ? Math.min(height, PHONE_HEIGHT) : height;

  return (
    <Card data-report-chart="" className={cn("min-w-0 gap-0 p-4", className)}>
      <div className="flex flex-wrap items-start justify-between gap-x-4 gap-y-2">
        <div className="min-w-0">
          <h3 className="text-[15px] leading-6 font-semibold text-ink">
            {title}
          </h3>
          {note && <p className="mt-0.5 text-[13px] leading-5 text-pretty text-ink-soft">{note}</p>}
        </div>
        {legend && <div className="flex min-w-0 shrink-0 flex-wrap items-center gap-x-3 gap-y-1">{legend}</div>}
      </div>

      <div
        data-slot="report-chart-body"
        style={{ height: bodyHeight }}
        // relative: what is hidden for screen readers inside is clipped with this box.
        className="relative mt-3 min-w-0 overflow-x-hidden overflow-y-auto"
        role={loading ? "status" : undefined}
        aria-live={loading ? "polite" : undefined}
        aria-busy={loading || undefined}
      >
        {loading ? (
          <>
            <span className="sr-only">{t.loading}</span>
            <ChartBones />
          </>
        ) : empty ? (
          <p className="flex h-full items-center justify-center px-4 text-center text-sm leading-6 text-pretty text-ink-soft">
            {empty}
          </p>
        ) : typeof children === "function" ? (
          children(bodyHeight)
        ) : (
          children
        )}
      </div>
    </Card>
  );
}

/** The inks a series may be drawn in — the tokens the charts of components/charts.tsx use. */
const SWATCH = {
  primary: "var(--color-primary)",
  success: "var(--color-success)",
  danger: "var(--color-danger)",
  accent: "var(--color-accent)",
  neutral: "var(--color-ink-soft)",
} as const;

export interface ReportLegendItem {
  label: string;
  /** The colour of the series. Default: the brand. */
  swatch?: keyof typeof SWATCH;
  /** A dashed line instead of a solid one: the period before. */
  dashed?: boolean;
}

/** A row of "line + name" for the chart's legend slot. Colour is never the only cue: each series is named. */
export function ReportLegend({ items }: { items: ReadonlyArray<ReportLegendItem> }) {
  return (
    <ul className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs leading-5 text-ink-soft">
      {items.map((item) => (
        <li key={item.label} className="inline-flex items-center gap-1.5">
          <span
            aria-hidden
            style={{ borderColor: SWATCH[item.swatch ?? "primary"] }}
            className={cn("inline-block w-3.5 shrink-0 rounded-full border-t-2", item.dashed && "border-dashed")}
          />
          {item.label}
        </li>
      ))}
    </ul>
  );
}
