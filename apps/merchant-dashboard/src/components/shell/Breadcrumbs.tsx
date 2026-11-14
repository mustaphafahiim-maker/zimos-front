import { useLocation } from "react-router-dom";
import { IconCaretRight } from "@/components/icons";
import { ViewLink } from "@/components/ViewLink";
import { useT, type Messages } from "@/i18n/LocaleContext";
import { NAV_GROUP_LABELS, NAV_LABELS, findNavGroup, findNavItem } from "@/lib/navigation";

const STRINGS = {
  en: { breadcrumb: "You are here" },
  ar: { breadcrumb: "مكانك الحالي" },
} satisfies Messages;

const PAGE = "min-w-0 truncate text-[17px] leading-6 font-semibold text-ink md:text-sm";

/**
 * Where the page sits, at the start of the toolbar: its menu group, then the
 * page. On a phone there is room for one thing, so it is the page's name
 * alone, at the size of an iPhone navigation title.
 */
export function Breadcrumbs() {
  const location = useLocation();
  const t = useT(STRINGS);
  const navLabels = useT(NAV_LABELS);
  const groupLabels = useT(NAV_GROUP_LABELS);
  const item = findNavItem(location.pathname);
  if (!item) return <span />;
  const group = findNavGroup(item);
  const groupLabel = group?.labelKey ? groupLabels[group.labelKey] : null;
  const label = navLabels[item.key];

  return (
    <nav aria-label={t.breadcrumb} className="flex min-w-0 items-center gap-1.5">
      {groupLabel && groupLabel !== label && (
        <>
          <span className="hidden shrink-0 text-[13px] font-medium text-ink-soft md:inline">{groupLabel}</span>
          <IconCaretRight className="hidden size-3 shrink-0 text-ink-soft/70 md:block rtl:-scale-x-100" aria-hidden />
        </>
      )}
      {location.pathname === item.to ? (
        <span className={PAGE} aria-current="page">
          {label}
        </span>
      ) : (
        // Deeper than the entry itself (an order, a product): the crumb leads back to the list.
        <ViewLink
          to={item.to}
          className={`${PAGE} rounded-full transition-colors hover:text-primary focus-visible:outline-2 focus-visible:outline-primary motion-reduce:transition-none`}
        >
          {label}
        </ViewLink>
      )}
    </nav>
  );
}
