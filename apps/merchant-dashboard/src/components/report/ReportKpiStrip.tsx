import { Children, type ReactNode } from "react";
import { cn } from "@store-builder/ui";
import { useT, type Messages } from "@/i18n/LocaleContext";
import { KpiBones, kpiGridClass } from "./bones";

const STRINGS = {
  en: { loading: "Loading the figures…" },
  ar: { loading: "بنحمّل الأرقام…" },
} satisfies Messages;

export interface ReportKpiStripProps {
  /** The stat cards: `KpiCard`s (figure, change chip, sparkline). */
  children?: ReactNode;
  /** Draws `count` cards as skeletons of their own shape in place of the children. */
  loading?: boolean;
  /** How many cards the strip holds. Left out: the number of children, or four while loading. */
  count?: number;
  /** Whether the skeleton holds room for a sparkline under the figure. Default true; pass false when the cards have no trend. */
  sparkline?: boolean;
  className?: string;
}

/**
 * The tab's row of stat cards: two to a row on a phone, four across from lg
 * (three for three cards; five are one row from xl). While `loading` it draws
 * the cards as skeletons, so nothing moves when the figures arrive.
 */
export function ReportKpiStrip({ children, loading = false, count, sparkline = true, className }: ReportKpiStripProps) {
  const t = useT(STRINGS);
  const cards = count ?? (Children.toArray(children).length || 4);

  if (loading) {
    return (
      <div role="status" aria-live="polite" aria-busy="true" className={cn("min-w-0", className)}>
        <span className="sr-only">{t.loading}</span>
        <KpiBones count={cards} sparkline={sparkline} />
      </div>
    );
  }

  return (
    <div data-slot="report-kpis" className={cn(kpiGridClass(cards), className)}>
      {children}
    </div>
  );
}
