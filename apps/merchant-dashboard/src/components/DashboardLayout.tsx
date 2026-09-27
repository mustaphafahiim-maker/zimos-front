import { Link, NavLink, Outlet, useLocation, useNavigate } from "react-router-dom";
import { useEffect, useMemo, useRef, useState } from "react";
import { ChevronDown, ChevronsRight, ExternalLink, Menu, Search, X } from "lucide-react";
import { cn } from "@store-builder/ui";
import { NAV_GROUPS, NAV_GROUP_LABELS, NAV_ITEMS, NAV_LABELS, isInSection, type NavItem, type NavKey } from "@/lib/navigation";
import { useAuth } from "@/context/AuthContext";
import { prefetchAnalyticsSummary } from "@/lib/analyticsPrefetch";
import { useWorkspace } from "@/context/WorkspaceContext";
import { useAsync } from "@/lib/useAsync";
import { apiClient } from "@/lib/apiClient";
import { storeHost, storeUrl } from "@/lib/storeAddress";
import { useT, fmt, type Messages } from "@/i18n/LocaleContext";
import { ThemeToggle } from "@/components/ThemeToggle";
import { LanguageSwitch } from "@/components/LanguageSwitch";
import { ZimosMark } from "@/components/ZimosLogo";
import { PageErrorBoundary } from "@/components/PageErrorBoundary";

const STRINGS = {
  en: {
    signOut: "Sign out",
    selectStore: "Select a store",
    newStore: "+ New store",
    openNav: "Open navigation",
    closeNav: "Close navigation",
    navLabel: "Main navigation",
    dashboardAria: "Zimos dashboard",
    dashboardAriaNamed: "{name} — Zimos dashboard",
    switchStore: "Switch store",
    search: "Search",
    searchPlaceholder: "Search pages",
    searchResults: "Pages",
    noResults: "No page called “{query}”",
    signedInAs: "Signed in as",
    hide: "Hide",
    show: "Show",
    collapseNav: "Collapse navigation",
    expandNav: "Expand navigation",
    account: "Account",
    viewStore: "View store",
    awaiting: "{n} awaiting confirmation",
    unread: "{n} unread",
  },
  ar: {
    signOut: "تسجيل الخروج",
    selectStore: "اختر متجرًا",
    newStore: "+ متجر جديد",
    openNav: "فتح القائمة",
    closeNav: "إغلاق القائمة",
    navLabel: "القائمة الرئيسية",
    dashboardAria: "لوحة تحكم زيموس",
    dashboardAriaNamed: "{name} — لوحة تحكم زيموس",
    switchStore: "تبديل المتجر",
    search: "بحث",
    searchPlaceholder: "دوّر على صفحة",
    searchResults: "الصفحات",
    noResults: "مفيش صفحة اسمها «{query}»",
    signedInAs: "داخل باسم",
    hide: "إخفاء",
    show: "إظهار",
    collapseNav: "طي القائمة",
    expandNav: "توسيع القائمة",
    account: "الحساب",
    viewStore: "افتح المتجر",
    awaiting: "{n} مستنية التأكيد",
    unread: "{n} غير مقروءة",
  },
} satisfies Messages;

const NAV_OPEN_KEY = "zimos.nav.open";

function readNavOpen(): boolean {
  try {
    return localStorage.getItem(NAV_OPEN_KEY) !== "0";
  } catch {
    return true;
  }
}

/** Live counts shown as badges beside a nav item — real numbers or nothing. */
function useNavBadges(workspaceId: string | undefined) {
  const badges = useAsync(async () => {
    if (!workspaceId) return {} as Partial<Record<NavKey, number>>;
    const [counts, inbox] = await Promise.all([
      apiClient.getOrderCounts(workspaceId, { cancelled: false }).catch(() => null),
      apiClient.listWhatsappConversations(workspaceId, { status: "open", limit: 50 }).catch(() => null),
    ]);
    const unread = inbox ? inbox.conversations.reduce((sum, c) => sum + (c.unreadCount || 0), 0) : 0;
    const out: Partial<Record<NavKey, number>> = {};
    if (counts && counts.pending > 0) out.orders = counts.pending;
    if (unread > 0) out.inbox = unread;
    return out;
  }, [workspaceId]);
  return badges.data ?? {};
}

function Badge({ n }: { n: number }) {
  return (
    <span className="tabular-nums flex h-5 min-w-5 items-center justify-center rounded-full bg-primary px-1.5 text-[11px] font-medium text-white">
      <bdi dir="ltr">{n > 99 ? "99+" : n}</bdi>
    </span>
  );
}

/**
 * Sidebar body — rendered in the desktop rail (collapsible) and inside the
 * mobile drawer (always open). `onNavigate` lets the drawer close itself.
 */
function SidebarContent({
  open,
  onToggle,
  onNavigate,
}: {
  open: boolean;
  onToggle?: () => void;
  onNavigate?: () => void;
}) {
  const { logout } = useAuth();
  const { currentWorkspace } = useWorkspace();
  const location = useLocation();
  const t = useT(STRINGS);
  const navLabels = useT(NAV_LABELS);
  const groupLabels = useT(NAV_GROUP_LABELS);
  const badges = useNavBadges(currentWorkspace?.id);

  // Analytics fetches two windows of data on mount; starting that request on
  // hover/focus lets it run alongside the lazy-loaded page chunk instead of
  // after it, so the numbers are often already there by the time it renders.
  const workspaceId = currentWorkspace?.id;
  const prefetchAnalytics = workspaceId ? () => prefetchAnalyticsSummary(workspaceId, "30d") : undefined;

  const badgeTitle = (key: NavKey, n: number) =>
    key === "orders" ? fmt(t.awaiting, { n }) : key === "inbox" ? fmt(t.unread, { n }) : String(n);

  const renderItem = (item: NavItem, child = false) => {
    const inSection = isInSection(item, location.pathname);
    const children = item.children ?? [];
    const n = badges[item.key];
    return (
      <div key={item.to}>
        <NavLink
          to={item.to}
          end={item.to === "/"}
          onClick={onNavigate}
          title={open ? undefined : navLabels[item.key]}
          onMouseEnter={item.key === "analytics" ? prefetchAnalytics : undefined}
          onFocus={item.key === "analytics" ? prefetchAnalytics : undefined}
          className={({ isActive }) =>
            cn(
              "relative flex h-11 w-full items-center rounded-md border-s-2 border-transparent text-sm font-medium transition-all duration-200",
              child && "h-9",
              isActive
                ? "border-primary bg-primary-soft text-primary-dark shadow-xs dark:text-primary"
                : inSection
                  ? "text-ink hover:bg-paper"
                  : "text-ink-soft hover:bg-paper hover:text-ink"
            )
          }
        >
          <div className={cn("grid h-full w-12 shrink-0 place-content-center", child && "w-12 ps-4")}>
            {child ? <span className="size-1.5 rounded-full bg-current opacity-60" aria-hidden /> : <item.icon className="size-4" aria-hidden />}
          </div>
          {open && <span className="min-w-0 truncate">{navLabels[item.key]}</span>}
          {n !== undefined && open && (
            <span className="absolute end-3" title={badgeTitle(item.key, n)}>
              <Badge n={n} />
            </span>
          )}
          {n !== undefined && !open && (
            <span className="absolute -top-0.5 end-1" title={badgeTitle(item.key, n)}>
              <Badge n={n} />
            </span>
          )}
        </NavLink>
        {open && inSection && children.length > 0 && (
          <div className="mt-px mb-1 space-y-px">{children.map((c) => renderItem(c, true))}</div>
        )}
      </div>
    );
  };

  const groups = NAV_GROUPS.filter((g) => !g.pinned);
  const pinned = NAV_GROUPS.filter((g) => g.pinned);
  const storeName = currentWorkspace?.name;

  return (
    <div className="flex h-full flex-col">
      <div className="mb-4 border-b border-line pb-3">
        <Link
          to="/"
          onClick={onNavigate}
          aria-label={storeName ? fmt(t.dashboardAriaNamed, { name: storeName }) : t.dashboardAria}
          className="flex items-center gap-3 rounded-md p-2 transition-colors hover:bg-paper"
        >
          <ZimosMark size={40} className="shadow-xs" />
          {open && (
            <div className="min-w-0">
              <span className="block truncate text-sm font-semibold text-ink">{storeName ?? "Zimos"}</span>
              {currentWorkspace?.slug && (
                <span className="block truncate text-xs text-ink-soft" dir="ltr">
                  {storeHost(currentWorkspace.slug)}
                </span>
              )}
            </div>
          )}
        </Link>
        {open && currentWorkspace?.slug && (
          <a
            href={storeUrl(currentWorkspace.slug)}
            target="_blank"
            rel="noreferrer"
            className="mt-1 flex h-8 items-center gap-2 rounded-md px-3 text-xs font-medium text-ink-soft transition-colors hover:bg-paper hover:text-primary"
          >
            <ExternalLink className="size-3.5" aria-hidden /> {t.viewStore}
          </a>
        )}
      </div>

      <nav aria-label={t.navLabel} className="flex flex-1 flex-col overflow-y-auto overflow-x-hidden">
        {groups.map((group, index) => (
          <div key={group.id} className={cn(index > 0 && "mt-4")}>
            {group.labelKey && open && (
              <p className="px-3 py-1 text-xs font-medium tracking-wide text-ink-soft uppercase rtl:tracking-normal">{groupLabels[group.labelKey]}</p>
            )}
            {group.labelKey && !open && <div className="mx-3 my-2 border-t border-line" />}
            <div className="space-y-1">{group.items.map((item) => renderItem(item))}</div>
          </div>
        ))}
        {pinned.map((group) => (
          <div key={group.id} className="mt-auto border-t border-line pt-3">
            {open && <p className="px-3 py-1 text-xs font-medium tracking-wide text-ink-soft uppercase rtl:tracking-normal">{t.account}</p>}
            <div className="space-y-1">{group.items.map((item) => renderItem(item))}</div>
            <button
              onClick={() => logout()}
              title={open ? undefined : t.signOut}
              className={cn(
                "flex h-11 w-full cursor-pointer items-center rounded-md text-sm font-medium text-ink-soft transition-colors hover:bg-danger-soft hover:text-danger",
                !open && "justify-center"
              )}
            >
              <span className="grid h-full w-12 shrink-0 place-content-center">
                <X className="size-4" aria-hidden />
              </span>
              {open && t.signOut}
            </button>
          </div>
        ))}
      </nav>

      {onToggle && (
        <button
          type="button"
          onClick={onToggle}
          aria-label={open ? t.collapseNav : t.expandNav}
          aria-expanded={open}
          className="-mx-2 -mb-2 mt-2 flex cursor-pointer items-center border-t border-line p-3 transition-colors hover:bg-paper"
        >
          <span className="grid size-10 place-content-center">
            <ChevronsRight className={cn("size-4 text-ink-soft transition-transform duration-300 rtl:rotate-180", open && "rotate-180 rtl:rotate-0")} aria-hidden />
          </span>
          {open && <span className="text-sm font-medium text-ink-soft">{t.hide}</span>}
        </button>
      )}
    </div>
  );
}

/** Header search: finds a dashboard page by name and jumps to it. */
function NavSearch({ className }: { className?: string }) {
  const t = useT(STRINGS);
  const navLabels = useT(NAV_LABELS);
  const navigate = useNavigate();
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const boxRef = useRef<HTMLDivElement>(null);

  const matches = useMemo(() => {
    const q = query.trim().toLocaleLowerCase();
    if (!q) return [];
    return NAV_ITEMS.filter((item) => navLabels[item.key].toLocaleLowerCase().includes(q)).slice(0, 8);
  }, [query, navLabels]);

  useEffect(() => {
    if (!open) return;
    const onDown = (event: MouseEvent) => {
      if (!boxRef.current?.contains(event.target as Node)) setOpen(false);
    };
    window.addEventListener("mousedown", onDown);
    return () => window.removeEventListener("mousedown", onDown);
  }, [open]);

  const go = (to: string) => {
    setQuery("");
    setOpen(false);
    navigate(to);
  };

  return (
    <div ref={boxRef} className={cn("relative", className)}>
      <label className="relative block">
        <span className="sr-only">{t.search}</span>
        <Search className="pointer-events-none absolute start-3 top-1/2 size-4 -translate-y-1/2 text-ink-soft" aria-hidden />
        <input
          type="search"
          value={query}
          placeholder={t.searchPlaceholder}
          onChange={(event) => {
            setQuery(event.target.value);
            setOpen(true);
          }}
          onFocus={() => setOpen(true)}
          onKeyDown={(event) => {
            if (event.key === "Enter" && matches[0]) go(matches[0].to);
            if (event.key === "Escape") setOpen(false);
          }}
          className="h-10 w-full rounded-lg border border-line bg-paper-raised ps-9 pe-3 text-sm text-ink shadow-xs placeholder:text-ink-soft focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/30"
        />
      </label>
      {open && query.trim() && (
        <div className="absolute inset-x-0 top-full z-30 mt-1 rounded-lg bg-paper-raised py-1 text-ink shadow-lg ring-1 ring-foreground/10">
          {matches.length === 0 ? (
            <p className="px-3 py-2 text-sm text-ink-soft">{fmt(t.noResults, { query: query.trim() })}</p>
          ) : (
            <>
              <p className="px-3 pt-1.5 pb-1 text-xs font-medium text-ink-soft">{t.searchResults}</p>
              {matches.map((item) => (
                <button
                  key={item.to}
                  type="button"
                  onClick={() => go(item.to)}
                  className="flex w-full cursor-pointer items-center gap-2 px-3 py-1.5 text-start text-sm hover:bg-muted"
                >
                  <item.icon className="size-4 text-ink-soft" aria-hidden />
                  {navLabels[item.key]}
                </button>
              ))}
            </>
          )}
        </div>
      )}
    </div>
  );
}

const headerButton =
  "flex h-10 cursor-pointer items-center justify-center gap-2 rounded-lg border border-line bg-paper-raised px-3 text-sm font-medium text-ink-soft shadow-xs transition-colors hover:bg-paper hover:text-ink";

export function DashboardLayout() {
  const { user } = useAuth();
  const { currentWorkspace, workspaces, selectWorkspace } = useWorkspace();
  const navigate = useNavigate();
  const location = useLocation();
  const t = useT(STRINGS);
  const [switcherOpen, setSwitcherOpen] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [navOpen, setNavOpen] = useState(readNavOpen);

  useEffect(() => {
    try {
      localStorage.setItem(NAV_OPEN_KEY, navOpen ? "1" : "0");
    } catch {
      /* private mode — non-fatal */
    }
  }, [navOpen]);

  // The tab names the store being worked on, not the product — a merchant with
  // several stores open in several tabs can tell them apart. Falls back to the
  // product name until the workspace list resolves.
  const storeName = currentWorkspace?.name;
  useEffect(() => {
    document.title = storeName ? `${storeName} — Dashboard` : "Zimos — Merchant Dashboard";
  }, [storeName]);

  // A drawer left open across navigation would cover the page it just opened.
  useEffect(() => {
    setMobileOpen(false);
  }, [location.pathname]);

  useEffect(() => {
    if (!mobileOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setMobileOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [mobileOpen]);

  const initial = (user?.fullName ?? user?.email ?? "?").charAt(0).toUpperCase();

  return (
    <div className="flex min-h-screen w-full bg-paper text-ink">
      <aside
        className={cn(
          "sticky top-0 hidden h-screen shrink-0 border-e border-line bg-paper-raised p-2 shadow-xs transition-all duration-300 ease-in-out md:block",
          navOpen ? "w-64" : "w-16"
        )}
      >
        <SidebarContent open={navOpen} onToggle={() => setNavOpen((v) => !v)} />
      </aside>

      {/* Mobile drawer — below `md` the rail above is hidden, so without this
          the dashboard has no navigation at all on a phone. */}
      {mobileOpen && (
        <div className="fixed inset-0 z-50 bg-black/40 md:hidden dark:bg-black/60" onMouseDown={() => setMobileOpen(false)}>
          <aside
            role="dialog"
            aria-modal="true"
            aria-label={t.navLabel}
            onMouseDown={(e) => e.stopPropagation()}
            className="animate-slide-in-start absolute inset-y-0 start-0 flex w-72 max-w-[85vw] flex-col overflow-y-auto bg-paper-raised p-2 shadow-lg"
          >
            <button
              type="button"
              onClick={() => setMobileOpen(false)}
              aria-label={t.closeNav}
              className="absolute end-3 top-3 z-10 cursor-pointer rounded-md p-1 text-ink-soft hover:bg-paper hover:text-ink"
            >
              <X className="size-4" aria-hidden />
            </button>
            <SidebarContent open onNavigate={() => setMobileOpen(false)} />
          </aside>
        </div>
      )}

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-40 flex h-16 shrink-0 items-center gap-3 border-b border-line bg-paper-raised/90 px-4 backdrop-blur sm:px-6">
          <button
            type="button"
            onClick={() => setMobileOpen(true)}
            aria-label={t.openNav}
            aria-expanded={mobileOpen}
            className={cn(headerButton, "w-10 px-0 md:hidden")}
          >
            <Menu className="size-5" aria-hidden />
          </button>

          <NavSearch className="hidden w-full max-w-md sm:block" />

          <div className="ms-auto flex shrink-0 items-center gap-2">
            <LanguageSwitch className="hidden h-10 rounded-lg sm:inline-flex" />
            <LanguageSwitch compact className="h-10 w-10 rounded-lg sm:hidden" />
            <ThemeToggle className="h-10 w-10 rounded-lg" />

            <div className="relative">
              <button
                onClick={() => setSwitcherOpen((v) => !v)}
                aria-label={t.switchStore}
                aria-expanded={switcherOpen}
                className={cn(headerButton, "max-w-[45vw] ps-1.5 sm:max-w-none")}
              >
                <span className="flex size-7 shrink-0 items-center justify-center rounded-md bg-primary text-xs font-semibold text-white">{initial}</span>
                <span className="hidden truncate text-ink sm:inline">{storeName ?? t.selectStore}</span>
                <ChevronDown className="size-4 shrink-0" aria-hidden />
              </button>
              {switcherOpen && (
                <div className="absolute end-0 top-full z-30 mt-1 w-64 rounded-lg bg-paper-raised py-1 text-ink shadow-lg ring-1 ring-foreground/10">
                  <p className="px-3 pt-1.5 pb-1 text-xs text-ink-soft">
                    {t.signedInAs} <span className="font-medium text-ink">{user?.fullName ?? user?.email}</span>
                  </p>
                  <div className="my-1 border-t border-line" />
                  {workspaces.map((workspace) => (
                    <button
                      key={workspace.id}
                      onClick={() => {
                        selectWorkspace(workspace.id);
                        setSwitcherOpen(false);
                      }}
                      className={cn(
                        "block w-full cursor-pointer px-3 py-2 text-start text-sm hover:bg-muted",
                        workspace.id === currentWorkspace?.id && "font-semibold"
                      )}
                    >
                      {workspace.name}
                    </button>
                  ))}
                  <div className="my-1 border-t border-line" />
                  <button
                    onClick={() => {
                      setSwitcherOpen(false);
                      navigate("/workspaces");
                    }}
                    className="block w-full cursor-pointer px-3 py-2 text-start text-sm text-primary hover:bg-muted"
                  >
                    {t.newStore}
                  </button>
                </div>
              )}
            </div>
          </div>
        </header>

        <main className="min-w-0 flex-1 p-4 sm:p-6">
          <div className="mx-auto w-full max-w-[1280px]">
            <PageErrorBoundary path={location.pathname}>
              <Outlet />
            </PageErrorBoundary>
          </div>
        </main>
      </div>
    </div>
  );
}
