import { Link, NavLink, Outlet, useLocation, useNavigate } from "react-router-dom";
import { useEffect, useState } from "react";
import { Check, ChevronDown, ChevronsUpDown, LogOut, Menu, X } from "lucide-react";
import { cn } from "@store-builder/ui";
import {
  NAV_GROUPS,
  NAV_GROUP_LABELS,
  NAV_LABELS,
  findNavGroup,
  findNavItem,
  isNavItemVisible,
} from "@/lib/navigation";
import { useAuth } from "@/context/AuthContext";
import { AccessBanner } from "@/components/AccessBanner";
import { useWorkspace } from "@/context/WorkspaceContext";
import { useT, fmt, type Messages } from "@/i18n/LocaleContext";
import { StoreLinkBar } from "@/components/StoreLinkBar";
import { ZimosLogo } from "@/components/ZimosLogo";
import { RouteErrorBoundary } from "@/components/RouteErrorBoundary";
import { NotificationsBell } from "@/components/NotificationsBell";
import { CommandPalette } from "@/components/CommandPalette";
import { SidebarShortcuts } from "@/components/SidebarShortcuts";
import { InstallAppPrompt } from "@/components/InstallAppPrompt";

const STRINGS = {
  en: {
    signOut: "Sign out",
    selectStore: "Select a store",
    newStore: "+ New store",
    allStores: "All my stores",
    openNav: "Open navigation",
    closeNav: "Close navigation",
    navLabel: "Main navigation",
    breadcrumb: "You are here",
    dashboardAria: "Zimos dashboard",
    dashboardAriaNamed: "{name} — Zimos dashboard",
    switchStore: "Switch store",
    collapseGroup: "Collapse {group}",
    expandGroup: "Expand {group}",
  },
  ar: {
    signOut: "تسجيل الخروج",
    selectStore: "اختر متجرًا",
    newStore: "+ متجر جديد",
    allStores: "كل متاجري",
    openNav: "فتح القائمة",
    closeNav: "إغلاق القائمة",
    navLabel: "القائمة الرئيسية",
    breadcrumb: "مكانك الحالي",
    dashboardAria: "لوحة تحكم زيموس",
    dashboardAriaNamed: "{name} — لوحة تحكم زيموس",
    switchStore: "تبديل المتجر",
    collapseGroup: "طي {group}",
    expandGroup: "توسيع {group}",
  },
} satisfies Messages;

const NAV_COLLAPSED_KEY = "zimos.nav.groups.collapsed.v2";
/** Groups that start open. The rest start closed and still show the page you are on. */
const NAV_OPEN_BY_DEFAULT = new Set(["main", "orders", "products"]);

function readCollapsedGroups(): Record<string, boolean> {
  try {
    const raw = localStorage.getItem(NAV_COLLAPSED_KEY);
    if (raw) return JSON.parse(raw) as Record<string, boolean>;
  } catch {
    /* private mode or malformed — fall through to the default below */
  }
  return Object.fromEntries(NAV_GROUPS.filter((group) => !NAV_OPEN_BY_DEFAULT.has(group.id)).map((group) => [group.id, true]));
}

/**
 * Sidebar body — rendered twice: once in the desktop rail and once inside the
 * mobile drawer. `onNavigate` lets the drawer close itself when a link is
 * followed. Same approach as the platform-admin console.
 *
 * The sidebar and the top bar are Glass panels over the app backdrop
 * (`.glass-app`, `.glass-nav` in index.css): they follow the theme, so the
 * controls inside them draw with the ordinary tokens.
 */
function SidebarContent({ onNavigate }: { onNavigate?: () => void }) {
  const { logout, user } = useAuth();
  const { currentWorkspace } = useWorkspace();
  const location = useLocation();
  const t = useT(STRINGS);
  const navLabels = useT(NAV_LABELS);
  const groupLabels = useT(NAV_GROUP_LABELS);
  const storeName = currentWorkspace?.name;
  const role = currentWorkspace?.role;

  const [collapsed, setCollapsed] = useState<Record<string, boolean>>(readCollapsedGroups);
  useEffect(() => {
    try {
      localStorage.setItem(NAV_COLLAPSED_KEY, JSON.stringify(collapsed));
    } catch {
      /* private mode — non-fatal */
    }
  }, [collapsed]);

  // Collapsing a group hides everything in it except the page you are on, so
  // the sidebar never loses track of where you are.
  const activeTo = findNavItem(location.pathname)?.to;
  const userLabel = user?.fullName ?? user?.email ?? "";

  return (
    <>
      <div className="px-4 pt-5 pb-3">
        <Link
          to="/"
          onClick={onNavigate}
          className="block px-1 transition-opacity hover:opacity-80"
          aria-label={storeName ? fmt(t.dashboardAriaNamed, { name: storeName }) : t.dashboardAria}
        >
          <ZimosLogo height={24} />
        </Link>
        <StoreSwitcher onNavigate={onNavigate} />
        {currentWorkspace?.slug && <StoreLinkBar slug={currentWorkspace.slug} className="mt-2 lg:hidden" />}
      </div>
      <nav aria-label={t.navLabel} className="shell-scroll flex-1 overflow-y-auto px-3 pb-4">
        <SidebarShortcuts onNavigate={onNavigate} />
        {NAV_GROUPS.map((group, index) => {
          const heading = group.labelKey ? groupLabels[group.labelKey] : null;
          const isClosed = Boolean(collapsed[group.id]);
          // Entries this role can't use are left out; a group left empty goes too.
          const visible = group.items.filter((i) => isNavItemVisible(i, role));
          if (visible.length === 0) return null;
          const items = isClosed ? visible.filter((i) => i.to === activeTo) : visible;

          return (
            <div
              key={group.id}
              className={cn(index > 0 && (heading ? "mt-5" : "mt-5 border-t border-line pt-4"))}
            >
              {heading && (
                <button
                  type="button"
                  onClick={() => setCollapsed((prev) => ({ ...prev, [group.id]: !prev[group.id] }))}
                  aria-expanded={!isClosed}
                  aria-label={fmt(isClosed ? t.expandGroup : t.collapseGroup, { group: heading })}
                  className="mb-1 flex w-full cursor-pointer items-center gap-1.5 rounded-md px-3 py-1 font-mono text-[10px] font-semibold tracking-[0.16em] text-ink-soft/80 uppercase transition-colors hover:text-ink rtl:font-sans rtl:text-[11px] rtl:tracking-normal"
                >
                  <span className="flex-1 text-start">{heading}</span>
                  <ChevronDown
                    className={cn("size-3 transition-transform", isClosed && "-rotate-90 rtl:rotate-90")}
                    aria-hidden
                  />
                </button>
              )}
              <div className="space-y-0.5">
                {items.map((item) => (
                  <NavLink
                    key={item.to}
                    to={item.to}
                    end={item.to === "/" || item.to === "/analytics"}
                    onClick={onNavigate}
                    className={({ isActive }) =>
                      cn(
                        "group relative flex items-center gap-3 rounded-[10px] px-3 py-[7px] text-sm font-medium text-ink-soft transition-colors hover:bg-primary-soft/70 hover:text-ink",
                        isActive && "bg-primary-soft font-semibold text-primary-dark dark:text-primary"
                      )
                    }
                  >
                    {({ isActive }) => (
                      <>
                        {isActive && (
                          <span
                            aria-hidden
                            className="absolute start-0 top-1/2 h-[18px] w-[3px] -translate-y-1/2 rounded-full bg-primary"
                          />
                        )}
                        <item.icon
                          className={cn(
                            "size-[18px] shrink-0 text-ink-soft/80 group-hover:text-ink",
                            isActive && "text-primary"
                          )}
                          strokeWidth={1.75}
                          aria-hidden
                        />
                        <span className="min-w-0 truncate">{navLabels[item.key]}</span>
                      </>
                    )}
                  </NavLink>
                ))}
              </div>
            </div>
          );
        })}
      </nav>
      <div className="flex items-center gap-3 border-t border-line px-4 py-3">
        <div className="flex size-9 shrink-0 items-center justify-center rounded-full bg-primary-soft text-sm font-semibold text-primary-dark dark:text-primary">
          {(userLabel || "?").charAt(0).toUpperCase()}
        </div>
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-medium text-ink">{userLabel}</p>
          {user?.fullName && user.email && (
            <p className="truncate text-xs text-ink-soft" dir="ltr">
              {user.email}
            </p>
          )}
        </div>
        <button
          type="button"
          onClick={() => logout()}
          aria-label={t.signOut}
          title={t.signOut}
          className="shrink-0 cursor-pointer rounded-md p-2 text-ink-soft transition-colors hover:bg-primary-soft hover:text-ink"
        >
          <LogOut className="size-4 rtl:-scale-x-100" aria-hidden />
        </button>
      </div>
    </>
  );
}

/**
 * The store being worked on, at the top of the sidebar: its name on a glass
 * card, and behind it the list of the merchant's other stores.
 */
function StoreSwitcher({ onNavigate }: { onNavigate?: () => void }) {
  const { currentWorkspace, workspaces, selectWorkspace } = useWorkspace();
  const navigate = useNavigate();
  const t = useT(STRINGS);
  const [open, setOpen] = useState(false);
  const name = currentWorkspace?.name ?? t.selectStore;

  function go(to: string) {
    setOpen(false);
    onNavigate?.();
    navigate(to);
  }

  return (
    <div className="relative mt-4">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-label={t.switchStore}
        aria-expanded={open}
        className="flex w-full cursor-pointer items-center gap-2.5 rounded-xl border border-line bg-paper-raised/60 px-2.5 py-2 text-start transition-colors hover:bg-primary-soft"
      >
        <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-primary text-sm font-semibold text-primary-foreground">
          {name.charAt(0).toUpperCase()}
        </span>
        <span className="min-w-0 flex-1 truncate text-sm font-semibold text-ink">{name}</span>
        <ChevronsUpDown className="size-4 shrink-0 text-ink-soft" aria-hidden />
      </button>
      {open && (
        <>
          <div className="fixed inset-0 z-10" onMouseDown={() => setOpen(false)} aria-hidden />
          <div className="absolute inset-x-0 top-full z-20 mt-1 max-h-72 overflow-y-auto zimos-glass rounded-xl py-1 shadow-xl">
            {workspaces.map((workspace) => (
              <button
                key={workspace.id}
                onClick={() => {
                  selectWorkspace(workspace.id);
                  setOpen(false);
                }}
                className={cn(
                  "flex w-full cursor-pointer items-center gap-2 px-3 py-2 text-start text-sm text-ink-soft hover:bg-primary-soft hover:text-ink",
                  workspace.id === currentWorkspace?.id && "font-semibold text-ink"
                )}
              >
                <span className="min-w-0 flex-1 truncate">{workspace.name}</span>
                {workspace.id === currentWorkspace?.id && (
                  <Check className="size-4 shrink-0 text-accent" aria-hidden />
                )}
              </button>
            ))}
            <div className="my-1 border-t border-line" />
            <button
              onClick={() => go("/stores")}
              className="block w-full cursor-pointer px-3 py-2 text-start text-sm text-ink-soft hover:bg-primary-soft hover:text-ink"
            >
              {t.allStores}
            </button>
            <button
              onClick={() => go("/workspaces")}
              className="block w-full cursor-pointer px-3 py-2 text-start text-sm font-medium text-ink hover:bg-primary-soft"
            >
              {t.newStore}
            </button>
          </div>
        </>
      )}
    </div>
  );
}

/** Where the page sits: its sidebar group, then the page. */
function Breadcrumbs() {
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
    <nav aria-label={t.breadcrumb} className="flex min-w-0 items-center gap-2 text-[13px] font-medium text-ink-soft">
      {groupLabel && groupLabel !== label && (
        <>
          <span className="truncate">{groupLabel}</span>
          <span aria-hidden className="text-ink-soft/50">
            /
          </span>
        </>
      )}
      {location.pathname === item.to ? (
        <span className="truncate font-semibold text-ink" aria-current="page">
          {label}
        </span>
      ) : (
        <Link to={item.to} className="truncate font-semibold text-ink hover:text-primary">
          {label}
        </Link>
      )}
    </nav>
  );
}

export function DashboardLayout() {
  const { currentWorkspace } = useWorkspace();
  const location = useLocation();
  const t = useT(STRINGS);
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

  return (
    <div className="glass-app flex min-h-screen">
      <aside className="zimos-glass zimos-glass-panel glass-nav sticky top-3 my-3 ms-3 hidden h-[calc(100dvh-1.5rem)] w-[264px] shrink-0 md:flex md:flex-col">
        <SidebarContent />
      </aside>

      {/* Mobile drawer — below `md` the rail above is hidden, so without this
          the dashboard has no navigation at all on a phone. */}
      {mobileOpen && (
        <div className="fixed inset-0 z-50 bg-black/50 md:hidden" onMouseDown={() => setMobileOpen(false)}>
          <aside
            role="dialog"
            aria-modal="true"
            aria-label={t.navLabel}
            onMouseDown={(e) => e.stopPropagation()}
            className="zimos-glass glass-nav animate-slide-in-start absolute inset-y-0 start-0 flex w-72 max-w-[85vw] flex-col overflow-y-auto shadow-lg"
          >
            <button
              type="button"
              onClick={() => setMobileOpen(false)}
              aria-label={t.closeNav}
              className="absolute end-3 top-4 cursor-pointer rounded-md p-1 text-ink-soft hover:bg-primary-soft hover:text-ink"
            >
              <X className="size-4" aria-hidden />
            </button>
            <SidebarContent onNavigate={() => setMobileOpen(false)} />
          </aside>
        </div>
      )}

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="zimos-glass glass-nav glass-topbar sticky top-0 z-30 flex h-14 items-center justify-between gap-2 px-3 sm:gap-4 sm:px-5 md:top-3 md:mx-3 md:mt-3">
          <div className="flex min-w-0 items-center gap-2">
            <button
              type="button"
              onClick={() => setMobileOpen(true)}
              aria-label={t.openNav}
              aria-expanded={mobileOpen}
              className="shrink-0 cursor-pointer rounded-md p-2 text-ink-soft hover:bg-primary-soft hover:text-ink md:hidden"
            >
              <Menu className="size-5" aria-hidden />
            </button>
            <Breadcrumbs />
          </div>

          <div className="flex shrink-0 items-center gap-1.5 sm:gap-2">
            {/* Search, the store's link and alerts. Language and theme are in Settings. */}
            <CommandPalette />
            {currentWorkspace?.slug && <StoreLinkBar slug={currentWorkspace.slug} className="hidden lg:flex" />}
            <NotificationsBell />
          </div>
        </header>

        {/* The page sits straight on the backdrop. */}
        <div className="flex min-w-0 flex-1 flex-col">
          <main className="flex-1 p-4 pb-14 sm:p-6 sm:pb-16">
            {/* Subscription expiring / expired, or the store suspended. */}
            <AccessBanner />
            <InstallAppPrompt />
            {/* One crashing page shows an error here; the sidebar and header
                stay up so the merchant can move on. */}
            <RouteErrorBoundary resetKey={location.pathname}>
              <div key={location.pathname.split("/")[1] ?? ""} className="page-in">
                <Outlet />
              </div>
            </RouteErrorBoundary>
          </main>
        </div>
      </div>
    </div>
  );
}
