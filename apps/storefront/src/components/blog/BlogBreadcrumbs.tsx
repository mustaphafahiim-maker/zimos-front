import { ChevronIcon } from "@/components/Icons";
import { StoreLink } from "@/components/StoreRoute";
import { focusRing } from "@/components/ui";
import type { Dictionary } from "@/lib/i18n";

/** Home › Blog › …, the way the product listing draws its trail; the last crumb is the page itself. */
export function BlogBreadcrumbs({ t, trail }: { t: Dictionary; trail: Array<{ label: string; href?: string }> }) {
  const crumbs = [{ label: t.common.home, href: "/" }, ...trail];
  return (
    <nav aria-label={t.catalog.breadcrumbs}>
      <ol className="flex flex-wrap items-center gap-1 text-sm text-ink-soft">
        {crumbs.map((crumb, i) => (
          <li key={`${crumb.label}-${i}`} className="flex min-w-0 items-center gap-1">
            {i > 0 && <ChevronIcon size={14} className="shrink-0 -rotate-90 rtl:rotate-90" aria-hidden />}
            {crumb.href ? (
              <StoreLink href={crumb.href} className={`inline-flex min-h-11 items-center rounded-md px-1 hover:text-primary ${focusRing}`}>
                {crumb.label}
              </StoreLink>
            ) : (
              <span aria-current="page" className="inline-flex min-h-11 min-w-0 items-center truncate px-1 font-medium text-ink">
                {crumb.label}
              </span>
            )}
          </li>
        ))}
      </ol>
    </nav>
  );
}
