import { useEffect, useState } from "react";
import { NavLink, useLocation } from "react-router-dom";
import { ClipboardCheck, LayoutDashboard, Menu, Package, ShoppingBag, type LucideIcon } from "lucide-react";
import { cn } from "@store-builder/ui";
import { apiClient } from "@/lib/apiClient";
import { useWorkspaceId } from "@/lib/useWorkspaceId";
import { useWorkspace } from "@/context/WorkspaceContext";
import { fmt, getIntlLocale, useT, type Messages } from "@/i18n/LocaleContext";

const STRINGS = {
  en: {
    nav: "Quick navigation",
    home: "Home",
    orders: "Orders",
    confirm: "Confirm",
    products: "Products",
    more: "More",
    waiting: "{n} waiting for a call",
  },
  ar: {
    nav: "التنقل السريع",
    home: "الرئيسية",
    orders: "الأوردرات",
    confirm: "التأكيد",
    products: "المنتجات",
    more: "المزيد",
    waiting: "{n} مستنيين مكالمة",
  },
} satisfies Messages;

type TabKey = "home" | "orders" | "confirm" | "products";

/**
 * The bar's tabs and the system roles that have no use for one
 * (backend core/security/permissions.js SYSTEM_ROLES: an editor can't open
 * orders; fulfillment and accountants don't make confirmation calls;
 * confirmation agents and accountants can't open products). A custom role
 * sees every tab; the server still decides what it may do (re-audit N-06).
 */
const TABS: { key: TabKey; to: string; end?: boolean; icon: LucideIcon; hiddenFor: readonly string[] }[] = [
  { key: "home", to: "/", end: true, icon: LayoutDashboard, hiddenFor: [] },
  { key: "orders", to: "/orders", icon: ShoppingBag, hiddenFor: ["editor"] },
  { key: "confirm", to: "/confirmation-queue", icon: ClipboardCheck, hiddenFor: ["editor", "fulfillment", "accountant"] },
  { key: "products", to: "/catalog", icon: Package, hiddenFor: ["confirmation_agent", "accountant"] },
];

/** The routes the bar shows for this role; the phone menu leaves them out so nothing is listed twice. */
export function tabRoutesFor(role: string | null | undefined): string[] {
  return TABS.filter((tab) => !tab.hiddenFor.includes(role ?? "")).map((tab) => tab.to);
}

function onTab(pathname: string, tab: { to: string; end?: boolean }): boolean {
  return tab.end ? pathname === tab.to : pathname === tab.to || pathname.startsWith(`${tab.to}/`);
}

/** How often the waiting-call badge refreshes while the dashboard is open. */
const BADGE_REFRESH_MS = 60_000;

/**
 * The phone's main navigation: the four places a COD merchant visits every
 * day, under the thumb, plus "More" which opens the full side menu. Hidden
 * from `md` up, where the sidebar is always on screen.
 */
export function MobileTabBar({ onMore, moreOpen }: { onMore: () => void; moreOpen: boolean }) {
  const t = useT(STRINGS);
  const workspaceId = useWorkspaceId();
  const { currentWorkspace } = useWorkspace();
  const { pathname } = useLocation();
  const [waiting, setWaiting] = useState<number | null>(null);
  const tabs = TABS.filter((tab) => !tab.hiddenFor.includes(currentWorkspace?.role ?? ""));
  const showsConfirm = tabs.some((tab) => tab.key === "confirm");
  // On a page with no tab of its own, «المزيد» is where you are.
  const moreActive = moreOpen || !tabs.some((tab) => onTab(pathname, tab));
  const label: Record<TabKey, string> = { home: t.home, orders: t.orders, confirm: t.confirm, products: t.products };

  // Calls that are due now (not ones booked for later). A role that can't read the queue gets no badge.
  useEffect(() => {
    if (!workspaceId || !showsConfirm) return;
    let alive = true;
    const load = () =>
      apiClient
        .getConfirmationQueueCounts(workspaceId)
        .then((counts) => alive && setWaiting(counts.pendingDue))
        .catch(() => alive && setWaiting(null));
    void load();
    const timer = window.setInterval(() => {
      if (document.visibilityState === "visible") void load();
    }, BADGE_REFRESH_MS);
    return () => {
      alive = false;
      window.clearInterval(timer);
    };
  }, [workspaceId, showsConfirm]);

  return (
    <nav
      aria-label={t.nav}
      className="fixed inset-x-0 bottom-0 z-40 border-t border-line bg-paper-raised/95 pb-[env(safe-area-inset-bottom)] shadow-[0_-8px_24px_-16px_rgb(20_22_26/0.18)] backdrop-blur-sm md:hidden"
    >
      <div className="mx-auto grid h-16 max-w-md" style={{ gridTemplateColumns: `repeat(${tabs.length + 1}, minmax(0, 1fr))` }}>
        {tabs.map((tab) => (
          <Tab
            key={tab.key}
            to={tab.to}
            end={tab.end}
            icon={tab.icon}
            label={label[tab.key]}
            badge={tab.key === "confirm" ? waiting : undefined}
            badgeLabel={tab.key === "confirm" && waiting ? fmt(t.waiting, { n: waiting }) : undefined}
          />
        ))}
        <button
          type="button"
          onClick={onMore}
          aria-expanded={moreOpen}
          className={cn(
            "flex cursor-pointer flex-col items-center justify-center gap-1 text-xs font-medium text-ink-soft transition-colors",
            moreActive && "text-primary"
          )}
        >
          <span className={cn("flex h-7 w-12 items-center justify-center rounded-full transition-colors", moreActive && "bg-primary-soft")}>
            <Menu className="size-[22px]" strokeWidth={moreActive ? 2 : 1.75} aria-hidden />
          </span>
          {t.more}
        </button>
      </div>
    </nav>
  );
}

function Tab({
  to,
  end,
  icon: Icon,
  label,
  badge,
  badgeLabel,
}: {
  to: string;
  end?: boolean;
  icon: LucideIcon;
  label: string;
  badge?: number | null;
  badgeLabel?: string;
}) {
  return (
    <NavLink
      to={to}
      end={end}
      className={({ isActive }) =>
        cn(
          "relative flex flex-col items-center justify-center gap-1 text-xs font-medium text-ink-soft transition-colors",
          isActive && "text-primary"
        )
      }
    >
      {({ isActive }) => (
        <>
          <span
            className={cn(
              "relative flex h-7 w-12 items-center justify-center rounded-full transition-colors",
              isActive && "bg-primary-soft"
            )}
          >
            <Icon className="size-[22px]" strokeWidth={isActive ? 2 : 1.75} aria-hidden />
            {badge ? (
              <span
                className="absolute -top-1 end-0.5 min-w-[18px] rounded-full bg-danger px-1 text-center text-[10px] leading-[18px] font-semibold text-paper-raised tabular-nums"
                aria-hidden
              >
                {new Intl.NumberFormat(getIntlLocale()).format(Math.min(badge, 99))}
                {badge > 99 ? "+" : ""}
              </span>
            ) : null}
          </span>
          <span>{label}</span>
          {badgeLabel && <span className="sr-only">{badgeLabel}</span>}
        </>
      )}
    </NavLink>
  );
}
