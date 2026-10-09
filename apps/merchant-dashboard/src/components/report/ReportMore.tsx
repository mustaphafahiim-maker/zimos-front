import { Children, useId, type ReactNode } from "react";
import { cn } from "@store-builder/ui";
import { AccordionGroup } from "@/components/Accordion";
import { useT, type Messages } from "@/i18n/LocaleContext";

const STRINGS = {
  en: { more: "More detail" },
  ar: { more: "تفاصيل أكتر" },
} satisfies Messages;

export interface ReportMoreProps {
  /** `AccordionSection`s (components/Accordion.tsx), one per secondary chart or table. */
  children?: ReactNode;
  /** In place of «تفاصيل أكتر». */
  title?: string;
  className?: string;
}

/**
 * «تفاصيل أكتر»: everything else the old screens showed for this subject, as a
 * labelled group of `AccordionSection`s. Each stays one closed row until it is
 * opened, and its body is not mounted before that — so a section that loads
 * its own data (with `useTabData` inside the body's component) asks for it
 * only when the merchant opens it.
 *
 * Renders nothing when it has no children, so a tab can leave out the
 * sections a role may not read without leaving an empty heading behind.
 */
export function ReportMore({ children, title, className }: ReportMoreProps) {
  const t = useT(STRINGS);
  const headingId = useId();
  if (Children.toArray(children).length === 0) return null;
  return (
    <section data-slot="report-more" aria-labelledby={headingId} className={cn("min-w-0", className)}>
      <h3 id={headingId} className="mb-2 px-1 text-[13px] leading-5 font-semibold text-ink-soft">
        {title ?? t.more}
      </h3>
      <AccordionGroup>{children}</AccordionGroup>
    </section>
  );
}
