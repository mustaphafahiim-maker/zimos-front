import { Link, useLocation } from "react-router-dom";
import { ChevronRight } from "lucide-react";
import { useT } from "@/i18n/LocaleContext";
import { findNavGroup, findNavItem } from "@/lib/nav";
import { SHELL_STRINGS } from "@/lib/shellStrings";
import { useNavLabel } from "./SidebarNav";

const PAGE = "min-w-0 truncate text-[17px] leading-6 font-semibold text-ink md:text-sm";

/**
 * Where the page sits, at the start of the toolbar: its menu group, then the
 * page. On a phone there is room for one thing, so it is the page's name
 * alone. The merchant dashboard's breadcrumb, over the console's menu.
 */
export function Breadcrumbs() {
  const location = useLocation();
  const t = useT(SHELL_STRINGS);
  const label = useNavLabel();
  const item = findNavItem(location.pathname);
  if (!item) return <span />;
  const group = findNavGroup(item);
  const groupLabel = group?.label ? label(group.label) : null;
  const pageLabel = label(item.label);

  return (
    <nav aria-label={t.breadcrumb} className="flex min-w-0 items-center gap-1.5">
      {groupLabel && groupLabel !== pageLabel && (
        <>
          <span className="hidden shrink-0 text-[13px] font-medium text-ink-soft md:inline">{groupLabel}</span>
          <ChevronRight className="hidden size-3 shrink-0 text-ink-soft/70 md:block rtl:-scale-x-100" aria-hidden />
        </>
      )}
      {location.pathname === item.to ? (
        <span className={PAGE} aria-current="page">
          {pageLabel}
        </span>
      ) : (
        // Deeper than the entry itself (a workspace, a ticket): the crumb leads back to the list.
        <Link
          to={item.to}
          className={`${PAGE} rounded-full transition-colors hover:text-primary focus-visible:outline-2 focus-visible:outline-primary motion-reduce:transition-none`}
        >
          {pageLabel}
        </Link>
      )}
    </nav>
  );
}
