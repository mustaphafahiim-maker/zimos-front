import type { ReactNode } from "react";
import { cn } from "@store-builder/ui";
import { ViewLink } from "@/components/ViewLink";
import { IconCaretLeft } from "@/components/icons";

interface HomeSectionProps {
  /** The quiet label above the section: «النهارده», «فلوسك», «رحلة الأوردر». */
  title: string;
  /** One short line after the title, in secondary ink (the range in words, a count). */
  note?: ReactNode;
  /** The one place this section leads to, at the end of the title line. */
  link?: { to: string; label: string };
  children: ReactNode;
  className?: string;
  /** For `aria-labelledby`; pass when two sections could share a title. */
  id?: string;
}

/**
 * The frame every section of «اليوم» sits in: a small, quiet label (the
 * dashboards the owner sent use one above each group of cards), an optional
 * "see all" link, then the cards. The section itself is not a pane — the
 * cards inside it are — so the label sits on the page pane's own glass.
 */
export function HomeSection({ title, note, link, children, className, id }: HomeSectionProps) {
  const headingId = id ?? `home-${title.replace(/\s+/g, "-")}`;
  return (
    <section aria-labelledby={headingId} className={cn("min-w-0", className)}>
      <div className="mb-2.5 flex min-h-8 items-center justify-between gap-3 px-1">
        <div className="flex min-w-0 items-baseline gap-2">
          <h2 id={headingId} className="shrink-0 text-[13px] font-semibold tracking-wide text-ink-soft rtl:tracking-normal">
            {title}
          </h2>
          {note && <span className="min-w-0 truncate text-xs text-ink-soft">{note}</span>}
        </div>
        {link && (
          <ViewLink
            to={link.to}
            className="inline-flex min-h-8 shrink-0 items-center gap-1 rounded-full px-2 text-[13px] font-medium text-primary transition-colors hover:text-primary pointer-coarse:min-h-11"
          >
            {link.label}
            <IconCaretLeft className="size-3.5 ltr:rotate-180" weight="bold" aria-hidden />
          </ViewLink>
        )}
      </div>
      {children}
    </section>
  );
}

/**
 * The space a section holds while its numbers load, in the shape of what is
 * coming, so nothing below it moves when they arrive. `className` sets the
 * height (`h-28`, `h-40`…); `count` cards side by side follow the same grid
 * the section uses.
 */
export function HomeSkeleton({ count = 1, className, gridClassName }: { count?: number; className?: string; gridClassName?: string }) {
  return (
    <div data-skeleton className={cn("grid gap-[var(--bento-gap)]", gridClassName)} aria-hidden>
      {Array.from({ length: count }, (_, i) => (
        <div
          key={i}
          className={cn("rounded-[var(--radius-card)] bg-paper-raised p-4 shadow-[var(--shadow-card)] ring-1 ring-line", className)}
        >
          <div className="h-3 w-1/3 animate-pulse rounded-full bg-paper-sunken motion-reduce:animate-none" />
          <div className="mt-4 h-6 w-1/2 animate-pulse rounded-full bg-paper-sunken motion-reduce:animate-none" />
          <div className="mt-3 h-3 w-2/3 animate-pulse rounded-full bg-paper-sunken motion-reduce:animate-none" />
        </div>
      ))}
    </div>
  );
}

/** What a section shows when its request failed for a reason other than "not for this role". */
export function HomeSectionError({ message, retryLabel, onRetry }: { message: string; retryLabel: string; onRetry: () => void }) {
  return (
    <div
      role="alert"
      className="flex flex-wrap items-center justify-between gap-3 rounded-[var(--radius-card)] bg-paper-raised px-4 py-3 text-sm text-ink-soft shadow-[var(--shadow-card)] ring-1 ring-line"
    >
      <span className="min-w-0">{message}</span>
      <button
        type="button"
        onClick={onRetry}
        className="min-h-11 shrink-0 cursor-pointer rounded-full px-4 text-sm font-semibold text-primary ring-1 ring-line-strong transition-colors hover:bg-paper-sunken"
      >
        {retryLabel}
      </button>
    </div>
  );
}
