import { useId, type ReactNode } from "react";
import { cn } from "@store-builder/ui";

export interface ReportTabFrameProps {
  /** The question the tab answers, as its heading («كسبت كام فعلاً؟») — from `REPORT_TAB_QUESTIONS`. */
  question: string;
  /** One quiet line under the question: which numbers these are, or what they leave out. */
  note?: ReactNode;
  /** The parts of the tab, top to bottom: KPI strip, chart, table, takeaway, more, links. */
  children: ReactNode;
  className?: string;
}

/**
 * The frame every report tab shares: the question as the heading, an optional
 * one-line note, then the parts in one column with the page's gap. The root
 * is marked `data-report-tab`.
 */
export function ReportTab({ question, note, children, className }: ReportTabFrameProps) {
  const headingId = useId();
  return (
    <section
      data-report-tab=""
      aria-labelledby={headingId}
      className={cn("flex min-w-0 flex-col gap-[var(--bento-gap)]", className)}
    >
      <header className="min-w-0">
        <h2 id={headingId} className="font-display text-xl leading-7 font-semibold text-balance text-ink">
          {question}
        </h2>
        {note && <p className="mt-1 text-sm leading-6 text-pretty text-ink-soft">{note}</p>}
      </header>
      {children}
    </section>
  );
}
