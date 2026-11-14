import { useId } from "react";
import { Card, cn } from "@store-builder/ui";
import { IconCaretRight, IconLink, type IconComponent } from "@/components/icons";
import { ViewLink } from "@/components/ViewLink";
import { useT, type Messages } from "@/i18n/LocaleContext";

const STRINGS = {
  en: { title: "Go deeper" },
  ar: { title: "للتفاصيل والإدارة" },
} satisfies Messages;

export interface ReportLinkItem {
  to: string;
  title: string;
  /** One line: what is behind the link. Cut with an ellipsis when it does not fit. */
  description?: string;
  icon?: IconComponent;
}

export interface ReportLinksProps {
  items: ReadonlyArray<ReportLinkItem>;
  /** In place of «للتفاصيل والإدارة». */
  title?: string;
  className?: string;
}

/**
 * The way out of a tab: links to the detailed store reports that belong to its
 * subject and to the page where the thing is managed («سجّل مصاريف الإعلانات»
 * → `/ads`). One card of rows — icon, title, a one-line description, a caret —
 * each 56px tall for the thumb. Renders nothing without items.
 */
export function ReportLinks({ items, title, className }: ReportLinksProps) {
  const t = useT(STRINGS);
  const headingId = useId();
  if (items.length === 0) return null;
  return (
    <nav data-slot="report-links-group" aria-labelledby={headingId} className={cn("min-w-0", className)}>
      <h3 id={headingId} className="mb-2 px-1 text-[13px] leading-5 font-semibold text-ink-soft">
        {title ?? t.title}
      </h3>
      <Card className="min-w-0 gap-0 p-0">
        <ul data-slot="report-links">
          {items.map((item, index) => {
            const ItemIcon = item.icon ?? IconLink;
            return (
              <li key={`${item.to}:${index}`} className="border-b border-line last:border-b-0">
                <ViewLink
                  to={item.to}
                  data-slot="report-link"
                  className="flex min-h-14 items-center gap-3 px-4 py-2.5 transition-colors duration-[var(--dur-fade)] ease-[var(--ease-out)] hover:bg-paper-sunken focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-primary active:bg-paper-sunken motion-reduce:transition-none"
                >
                  <span
                    aria-hidden
                    data-slot="report-link-icon"
                    className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-primary-soft text-primary"
                  >
                    <ItemIcon className="size-[18px]" />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-[15px] leading-6 font-semibold text-ink">{item.title}</span>
                    {item.description && (
                      <span className="block truncate text-[13px] leading-5 text-ink-soft">{item.description}</span>
                    )}
                  </span>
                  <IconCaretRight className="size-4 shrink-0 text-ink-soft rtl:-scale-x-100" aria-hidden />
                </ViewLink>
              </li>
            );
          })}
        </ul>
      </Card>
    </nav>
  );
}
