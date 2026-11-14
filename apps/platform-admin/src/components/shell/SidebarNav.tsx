import { useEffect, useRef, useState } from "react";
import { Link, useLocation } from "react-router-dom";
import { ChevronDown, ShieldCheck } from "lucide-react";
import { cn } from "@store-builder/ui";
import { ZimosLogo } from "@/components/ZimosLogo";
import { fmt, useLocale, useT } from "@/i18n/LocaleContext";
import { findNavItem, useVisibleNav, type NavItem } from "@/lib/nav";
import { NAV_LABELS_AR, SHELL_STRINGS } from "@/lib/shellStrings";

const NAV_COLLAPSED_KEY = "zimos.console.nav.groups.collapsed";

function readCollapsedGroups(): Record<string, boolean> {
  try {
    const raw = localStorage.getItem(NAV_COLLAPSED_KEY);
    if (raw) return JSON.parse(raw) as Record<string, boolean>;
  } catch {
    /* private mode or malformed — every group starts open */
  }
  return {};
}

/** A menu label in the console's language (lib/nav.ts keeps them in English). */
export function useNavLabel(): (en: string) => string {
  const { locale } = useLocale();
  return (en) => (locale === "ar" ? NAV_LABELS_AR[en] ?? en : en);
}

/* The merchant dashboard's row, class for class (its components/shell/SidebarNav.tsx):
   the theme draws the brand pill, the hover pane and the motion on these hooks. */
const ROW =
  "group/row relative flex items-center gap-2.5 rounded-full text-sm font-medium transition-[background-color,color,scale] duration-150 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary active:scale-[0.97] motion-reduce:transition-none motion-reduce:active:scale-100";
/** Side menu: 36px with a mouse, 44px under a finger. */
const ROW_RAIL = "zimos-menu-row h-9 px-3 pointer-coarse:h-11";
/** Phone menu: a 48px tile; a long Arabic label takes a second line instead of being cut. */
const ROW_SHEET = "zimos-menu-tile min-h-12 py-1.5 ps-3.5 pe-3";

export interface NavRowProps {
  item: NavItem;
  label: string;
  /** This row is where you are: the filled brand pill. */
  current?: boolean;
  /** `rail` — a line of the side menu. `sheet` — a tile of the phone menu. */
  variant?: "rail" | "sheet";
  onNavigate?: () => void;
}

/** One destination: icon and label. The same row draws the side menu and the phone menu. */
export function NavRow({ item, label, current = false, variant = "rail", onNavigate }: NavRowProps) {
  const sheet = variant === "sheet";
  const Icon = item.icon;
  return (
    <Link
      to={item.to}
      aria-current={current ? "page" : undefined}
      onClick={onNavigate}
      data-slot="menu-row"
      className={cn(
        ROW,
        sheet ? ROW_SHEET : ROW_RAIL,
        current ? "bg-primary text-primary-foreground" : sheet ? "bg-paper-sunken text-ink" : "text-ink hover:bg-paper-sunken"
      )}
    >
      <Icon
        // The current row's glyph is drawn heavier, the way a filled one reads.
        strokeWidth={current ? 2.25 : 1.75}
        className={cn("shrink-0", sheet ? "size-5" : "size-[18px]", !current && "text-ink-soft group-hover/row:text-ink")}
        aria-hidden
      />
      <span className={cn("min-w-0 flex-1", sheet ? "line-clamp-2 leading-tight" : "truncate")}>{label}</span>
    </Link>
  );
}

/**
 * What stands where the merchant dashboard shows the store being worked on:
 * this is the platform console, and which environment it is. Not a control,
 * so it takes no pointer.
 */
export function ConsoleBadge({ size = "md", className }: { size?: "md" | "lg"; className?: string }) {
  const t = useT(SHELL_STRINGS);
  const large = size === "lg";
  return (
    <div
      className={cn(
        "zimos-store-switch pointer-events-none flex w-full items-center text-start",
        large ? "h-14 gap-3 rounded-[1.25rem] bg-paper-sunken ps-2 pe-3.5" : "h-11 gap-2.5 rounded-[1rem] bg-paper ps-1.5 pe-2.5 ring-1 ring-line",
        className
      )}
    >
      <span
        aria-hidden
        className={cn(
          "zimos-store-tile flex shrink-0 items-center justify-center bg-primary font-semibold text-primary-foreground!",
          large ? "size-10 rounded-[0.75rem]" : "size-8 rounded-[0.625rem]"
        )}
      >
        <ShieldCheck className={large ? "size-5" : "size-[18px]"} />
      </span>
      <span className={cn("min-w-0 flex-1 truncate font-semibold text-ink", large ? "text-[15px]" : "text-sm")}>{t.platformAdmin}</span>
    </div>
  );
}

/**
 * The side menu's contents: the ZIMOS logo, the console's badge, then the
 * groups of lib/nav.ts as this account sees them. A group folds from its
 * heading and stays folded next time; a folded group still shows the row of
 * the page you are on, so the menu never loses track of where you are.
 */
export function SidebarNav() {
  const groups = useVisibleNav();
  const location = useLocation();
  const t = useT(SHELL_STRINGS);
  const label = useNavLabel();

  const [collapsed, setCollapsed] = useState<Record<string, boolean>>(readCollapsedGroups);
  useEffect(() => {
    try {
      localStorage.setItem(NAV_COLLAPSED_KEY, JSON.stringify(collapsed));
    } catch {
      /* private mode — non-fatal */
    }
  }, [collapsed]);
  // The group that was just unfolded: its rows settle in (the theme's glass/menu.css).
  const [revealed, setRevealed] = useState<string | null>(null);

  const activeTo = findNavItem(location.pathname)?.to;

  // The list is longer than the pane: bring the current row into view when the page changes.
  const scrollRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const scroller = scrollRef.current;
    const current = scroller?.querySelector<HTMLElement>('a[aria-current="page"]');
    if (!scroller || !current) return;
    const pane = scroller.getBoundingClientRect();
    const at = current.getBoundingClientRect();
    if (at.top < pane.top + 12) scroller.scrollTop -= pane.top + 12 - at.top;
    else if (at.bottom > pane.bottom - 24) scroller.scrollTop += at.bottom - (pane.bottom - 24);
  }, [activeTo]);

  function toggle(groupId: string) {
    setRevealed(collapsed[groupId] ? groupId : null);
    setCollapsed((prev) => ({ ...prev, [groupId]: !prev[groupId] }));
  }

  return (
    <>
      <div className="shrink-0 px-2.5 pt-3">
        <Link
          to="/"
          className="flex h-10 items-center rounded-full px-3 transition-opacity hover:opacity-80 motion-reduce:transition-none"
          aria-label={t.platformAdmin}
        >
          <ZimosLogo height={22} />
        </Link>
        <ConsoleBadge className="mt-1.5" />
      </div>

      <nav aria-label={t.mainNav} className="mt-1 flex min-h-0 flex-1 flex-col">
        {/* No scrollbar is drawn (it would take a strip off the rows on Windows);
            the list fades out at both ends instead. */}
        <div
          ref={scrollRef}
          className="zimos-menu-scroll min-h-0 flex-1 overflow-y-auto overscroll-contain px-2.5 pt-2.5 pb-5 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
        >
          {groups.map((group) => {
            const heading = group.label ? label(group.label) : null;
            // A group without a heading has nothing to click, so it is never folded away.
            const isClosed = Boolean(heading && collapsed[group.id]);
            // Folding hides everything in the group except the page you are on.
            const items = isClosed ? group.items.filter((item) => item.to === activeTo) : group.items;
            const rowsId = `zimos-nav-${group.id}`;

            return (
              <div key={group.id} className="mt-3 first:mt-0">
                {heading && (
                  <button
                    type="button"
                    onClick={() => toggle(group.id)}
                    aria-expanded={!isClosed}
                    aria-controls={rowsId}
                    aria-label={fmt(isClosed ? t.expandGroup : t.collapseGroup, { group: heading })}
                    className="zimos-menu-heading group/heading flex h-7 w-full cursor-pointer items-center gap-1 rounded-full ps-3 pe-2 text-start text-[12px] font-semibold text-primary transition-colors hover:text-ink focus-visible:outline-2 focus-visible:outline-primary motion-reduce:transition-none pointer-coarse:h-11"
                  >
                    <span className="min-w-0 flex-1 truncate">{heading}</span>
                    {/* The caret shows when the heading is pointed at or focused. A finger has
                        no hover, and a folded group has to say there is more inside. */}
                    <ChevronDown
                      className={cn(
                        "size-3 shrink-0 transition-[opacity,rotate] duration-150 motion-reduce:transition-none pointer-coarse:opacity-100",
                        isClosed
                          ? "-rotate-90 opacity-70 rtl:rotate-90"
                          : "opacity-0 group-hover/heading:opacity-100 group-focus-visible/heading:opacity-100"
                      )}
                      aria-hidden
                    />
                  </button>
                )}
                <div id={rowsId} data-reveal={revealed === group.id ? "" : undefined} className="flex flex-col gap-0.5">
                  {items.map((item) => (
                    <NavRow key={item.to} item={item} label={label(item.label)} current={item.to === activeTo} />
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      </nav>
    </>
  );
}
