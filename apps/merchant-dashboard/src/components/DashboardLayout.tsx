import { Link, NavLink, Outlet, useLocation, useNavigate } from "react-router-dom";
import { useEffect, useMemo, useRef, useState } from "react";
import { ChevronDown, Menu, Search, X } from "lucide-react";
import { cn } from "@store-builder/ui";
import { NAV_GROUPS, NAV_GROUP_LABELS, NAV_ITEMS, NAV_LABELS, isInSection, type NavItem } from "@/lib/navigation";
import { useAuth } from "@/context/AuthContext";
import { prefetchAnalyticsSummary } from "@/lib/analyticsPrefetch";
import { useWorkspace } from "@/context/WorkspaceContext";
import { useT, fmt, type Messages } from "@/i18n/LocaleContext";
import { ThemeToggle } from "@/components/ThemeToggle";
import { LanguageSwitch } from "@/components/LanguageSwitch";
import { StoreLinkBar } from "@/components/StoreLinkBar";
import { ZimosLogo } from "@/components/ZimosLogo";
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
  },
} satisfies Messages;

/**
 * Sidebar body — rendered twice: once in the desktop rail and once inside the
 * mobile drawer. `onNavigate` lets the drawer close itself when a link is
 * followed. Same approach as the platform-admin console.
 */
function SidebarContent({ onNavigate }: { onNavigate?: () => void }) {
  const { logout } = useAuth();
  const { currentWorkspace } = useWorkspace();
  const location = useLocation();
  const t = useT(STRINGS);
  const navLabels = useT(NAV_LABELS);
  const groupLabels = useT(NAV_GROUP_LABELS);

  // Analytics fetches two windows of data on mount; starting that request on
  // hover/focus lets it run alongside the lazy-loaded page chunk instead of
  // after it, so the numbers are often already there by the time it renders.
  const workspaceId = currentWorkspace?.id;
  const prefetchAnalytics = workspaceId ? () => prefetchAnalyticsSummary(workspaceId, "30d") : undefined;

  const renderItem = (item: NavItem) => {
    // A section stays "on" while any of its sub-pages is open, so the parent
    // reads as the place you are in and its children stay listed under it.
    const inSection = isInSection(item, location.pathname);
    const children = item.children ?? [];
    return (
      <div key={item.to}>
        <NavLink
          to={item.to}
          end={item.to === "/"}
          onClick={onNavigate}
          onMouseEnter={item.key === "analytics" ? prefetchAnalytics : undefined}
          onFocus={item.key === "analytics" ? prefetchAnalytics : undefined}
          className={({ isActive }) =>
            cn(
              "flex items-center gap-2 rounded-lg px-2 py-1.5 text-[13px] font-medium text-ink-soft transition-colors hover:bg-paper-raised/70 hover:text-ink",
              (isActive || inSection) && "text-ink",
              isActive && "bg-paper-raised font-semibold shadow-xs ring-1 ring-foreground/5"
            )
          }
        >
          <item.icon className="size-5 shrink-0" strokeWidth={1.75} aria-hidden />
          <span className="min-w-0 truncate">{navLabels[item.key]}</span>
        </NavLink>
        {inSection && children.length > 0 && (
          <div className="mt-px mb-1 space-y-px">
            {children.map((child) => (
              <NavLink
                key={child.to}
                to={child.to}
                onClick={onNavigate}
                className={({ isActive }) =>
                  cn(
                    "flex items-center gap-2 rounded-lg py-1.5 ps-9 pe-2 text-[13px] text-ink-soft transition-colors hover:bg-paper-raised/70 hover:text-ink",
                    isActive && "bg-paper-raised font-semibold text-ink shadow-xs ring-1 ring-foreground/5"
                  )
                }
              >
                <span className="min-w-0 truncate">{navLabels[child.key]}</span>
              </NavLink>
            ))}
          </div>
        )}
      </div>
    );
  };

  const groups = NAV_GROUPS.filter((g) => !g.pinned);
  const pinned = NAV_GROUPS.filter((g) => g.pinned);

  return (
    <>
      {/* The store's public link, where a merchant looks for it first. */}
      {currentWorkspace?.slug && (
        <div className="px-3 pt-3">
          <StoreLinkBar
            slug={currentWorkspace.slug}
            className="rounded-lg bg-paper-raised px-1 py-0.5 shadow-xs ring-1 ring-foreground/5"
          />
        </div>
      )}
      <nav aria-label={t.navLabel} className="flex flex-1 flex-col overflow-y-auto px-3 py-3">
        {groups.map((group, index) => (
          <div key={group.id} className={cn(index > 0 && "mt-4")}>
            {group.labelKey && (
              <p className="mb-0.5 px-2 py-1 text-xs font-medium text-ink-soft">{groupLabels[group.labelKey]}</p>
            )}
            <div className="space-y-px">{group.items.map(renderItem)}</div>
          </div>
        ))}
        {pinned.map((group) => (
          <div key={group.id} className="mt-auto space-y-px pt-4">
            {group.items.map(renderItem)}
          </div>
        ))}
      </nav>
      <div className="flex items-center gap-2 border-t border-line px-3 py-3">
        <button
          onClick={() => logout()}
          className="flex-1 cursor-pointer rounded-lg px-2 py-1.5 text-start text-[13px] font-medium text-ink-soft hover:bg-danger-soft hover:text-danger"
        >
          {t.signOut}
        </button>
        <ThemeToggle />
      </div>
    </>
  );
}

/** Top-bar search: finds a dashboard page by name and jumps to it. */
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
        <Search className="pointer-events-none absolute start-3 top-1/2 size-4 -translate-y-1/2 text-topbar-ink/60" aria-hidden />
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
          className="h-8 w-full rounded-lg border border-white/10 bg-white/10 ps-9 pe-3 text-sm text-topbar-ink placeholder:text-topbar-ink/50 focus:border-white/30 focus:bg-white/15 focus:outline-none"
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

export function DashboardLayout() {
  const { user } = useAuth();
  const { currentWorkspace, workspaces, selectWorkspace } = useWorkspace();
  const navigate = useNavigate();
  const location = useLocation();
  const t = useT(STRINGS);
  const [switcherOpen, setSwitcherOpen] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);

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

  const initial = (storeName ?? user?.fullName ?? user?.email ?? "?").charAt(0).toUpperCase();

  return (
    <div className="flex min-h-screen flex-col bg-paper">
      <header className="sticky top-0 z-40 flex h-14 shrink-0 items-center gap-3 bg-topbar px-3 text-topbar-ink sm:px-4">
        <button
          type="button"
          onClick={() => setMobileOpen(true)}
          aria-label={t.openNav}
          aria-expanded={mobileOpen}
          className="-ms-1 shrink-0 cursor-pointer rounded-md p-2 text-topbar-ink/80 hover:bg-white/10 hover:text-white md:hidden"
        >
          <Menu className="size-5" aria-hidden />
        </button>

        <Link
          to="/"
          className="shrink-0 transition-opacity hover:opacity-80"
          aria-label={storeName ? fmt(t.dashboardAriaNamed, { name: storeName }) : t.dashboardAria}
        >
          <ZimosLogo height={22} surface="dark" />
        </Link>

        <NavSearch className="mx-auto hidden w-full max-w-xl sm:block" />

        <div className="ms-auto flex shrink-0 items-center gap-2">
          <LanguageSwitch className="hidden h-8 border-transparent bg-white/10 text-topbar-ink hover:border-white/20 hover:text-white sm:inline-flex" />
          <LanguageSwitch compact className="h-8 w-8 border-transparent bg-white/10 text-topbar-ink hover:border-white/20 hover:text-white sm:hidden" />

          <div className="relative">
            <button
              onClick={() => setSwitcherOpen((v) => !v)}
              aria-label={t.switchStore}
              aria-expanded={switcherOpen}
              className="flex h-8 max-w-[40vw] cursor-pointer items-center gap-2 rounded-lg bg-white/10 ps-1 pe-2 text-sm font-medium text-topbar-ink transition-colors hover:bg-white/15 hover:text-white sm:max-w-none"
            >
              <span className="flex size-6 shrink-0 items-center justify-center rounded-md bg-primary text-xs font-semibold text-white">
                {initial}
              </span>
              <span className="truncate">{storeName ?? t.selectStore}</span>
              <ChevronDown className="size-4 shrink-0 opacity-70" aria-hidden />
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

      <div className="flex flex-1">
        <aside className="sticky top-14 hidden h-[calc(100vh-3.5rem)] w-60 shrink-0 bg-rail md:flex md:flex-col">
          <SidebarContent />
        </aside>

        {/* Mobile drawer — below `md` the rail above is hidden, so without this
            the dashboard has no navigation at all on a phone. */}
        {mobileOpen && (
          <div
            className="fixed inset-0 z-50 bg-black/40 md:hidden dark:bg-black/60"
            onMouseDown={() => setMobileOpen(false)}
          >
            <aside
              role="dialog"
              aria-modal="true"
              aria-label={t.navLabel}
              onMouseDown={(e) => e.stopPropagation()}
              className="animate-slide-in-start absolute inset-y-0 start-0 flex w-72 max-w-[85vw] flex-col overflow-y-auto bg-rail shadow-lg"
            >
              <button
                type="button"
                onClick={() => setMobileOpen(false)}
                aria-label={t.closeNav}
                className="absolute end-3 top-3 z-10 cursor-pointer rounded-md p-1 text-ink-soft hover:bg-paper-raised hover:text-ink"
              >
                <X className="size-4" aria-hidden />
              </button>
              <div className="px-3 pt-3 sm:hidden">
                <NavSearch className="[&_input]:border-line [&_input]:bg-paper-raised [&_input]:text-ink [&_input]:placeholder:text-ink-soft [&_svg]:text-ink-soft" />
              </div>
              <SidebarContent onNavigate={() => setMobileOpen(false)} />
            </aside>
          </div>
        )}

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
