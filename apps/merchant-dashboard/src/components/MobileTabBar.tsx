import { useEffect, useState } from "react";
import { NavLink } from "react-router-dom";
import { ClipboardCheck, LayoutDashboard, Menu, Package, ShoppingBag, type LucideIcon } from "lucide-react";
import { cn } from "@store-builder/ui";
import { apiClient } from "@/lib/apiClient";
import { useWorkspaceId } from "@/lib/useWorkspaceId";
import { fmt, useT, type Messages } from "@/i18n/LocaleContext";

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
  const [waiting, setWaiting] = useState<number | null>(null);

  // Calls that are due now (not ones booked for later). A role that can't read the queue gets no badge.
  useEffect(() => {
    if (!workspaceId) return;
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
  }, [workspaceId]);

  return (
    <nav
      aria-label={t.nav}
      className="fixed inset-x-0 bottom-0 z-40 border-t border-line bg-paper-raised/95 pb-[env(safe-area-inset-bottom)] shadow-[0_-8px_24px_-16px_rgb(20_22_26/0.18)] backdrop-blur-sm md:hidden"
    >
      <div className="mx-auto grid h-16 max-w-md grid-cols-5">
        <Tab to="/" end icon={LayoutDashboard} label={t.home} />
        <Tab to="/orders" icon={ShoppingBag} label={t.orders} />
        <Tab
          to="/confirmation-queue"
          icon={ClipboardCheck}
          label={t.confirm}
          badge={waiting}
          badgeLabel={waiting ? fmt(t.waiting, { n: waiting }) : undefined}
        />
        <Tab to="/catalog" icon={Package} label={t.products} />
        <button
          type="button"
          onClick={onMore}
          aria-expanded={moreOpen}
          className="flex cursor-pointer flex-col items-center justify-center gap-1 text-[11px] font-medium text-ink-soft"
        >
          <Menu className="size-[22px]" strokeWidth={1.75} aria-hidden />
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
          "relative flex flex-col items-center justify-center gap-1 text-[11px] font-medium text-ink-soft transition-colors",
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
                {badge > 99 ? "99+" : badge}
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
