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
import { profileAvatarOf } from "@store-builder/api-client";
import { useAuth } from "@/context/AuthContext";
import { AccessBanner } from "@/components/AccessBanner";
import { useWorkspace } from "@/context/WorkspaceContext";
import { useT, fmt, type Messages } from "@/i18n/LocaleContext";
import { ThemeToggle } from "@/components/ThemeToggle";
import { LanguageSwitch } from "@/components/LanguageSwitch";
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

const NAV_COLLAPSED_KEY = "zimos.nav.groups.collapsed";

function readCollapsedGroups(): Record<string, boolean> {
  try {
    const raw = localStorage.getItem(NAV_COLLAPSED_KEY);
    if (raw) return JSON.parse(raw) as Record<string, boolean>;
  } catch {
    /* private mode or malformed — fall through to every group open */
  }
  return {};
}

/**
 * Sidebar body — rendered twice: once in the desktop rail and once inside the
 * mobile drawer. `onNavigate` lets the drawer close itself when a link is
 * followed. Same approach as the platform-admin console.
 *
 * The sidebar is a dark surface in both themes: its container carries the
 * `dark` class, so the shared controls inside it draw with the dark tokens.
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
              className={cn(index > 0 && (heading ? "mt-5" : "mt-5 border-t border-white/10 pt-4"))}
            >
              {heading && (
                <button
                  type="button"
                  onClick={() => setCollapsed((prev) => ({ ...prev, [group.id]: !prev[group.id] }))}
                  aria-expanded={!isClosed}
                  aria-label={fmt(isClosed ? t.expandGroup : t.collapseGroup, { group: heading })}
                  className="mb-1 flex w-full cursor-pointer items-center gap-1.5 rounded-md px-3 py-1 font-mono text-[10px] font-semibold tracking-[0.16em] text-white/45 uppercase transition-colors hover:text-white/80 rtl:font-sans rtl:text-[11px] rtl:tracking-normal"
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
                        "group relative flex items-center gap-3 rounded-[10px] px-3 py-[7px] text-sm font-medium text-white/75 transition-colors hover:bg-white/[0.07] hover:text-white",
                        isActive && "bg-white/[0.11] font-semibold text-white"
                      )
                    }
                  >
                    {({ isActive }) => (
                      <>
                        {isActive && (
                          <span
                            aria-hidden
                            className="absolute start-0 top-1/2 h-[18px] w-[3px] -translate-y-1/2 rounded-full bg-accent"
                          />
                        )}
                        <item.icon
                          className={cn(
                            "size-[18px] shrink-0 text-white/55 group-hover:text-white/90",
                            isActive && "text-white"
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
      <div className="flex items-center gap-3 border-t border-white/10 px-4 py-3">
        {profileAvatarOf(user) ? (
          <img src={profileAvatarOf(user) ?? undefined} alt="" className="size-9 shrink-0 rounded-full object-cover" />
        ) : (
          <div className="flex size-9 shrink-0 items-center justify-center rounded-full bg-white/[0.12] text-sm font-semibold text-white">
            {(userLabel || "?").charAt(0).toUpperCase()}
          </div>
        )}
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-medium text-white">{userLabel}</p>
          {user?.fullName && user.email && (
            <p className="truncate text-xs text-white/50" dir="ltr">
              {user.email}
            </p>
          )}
        </div>
        <button
          type="button"
          onClick={() => logout()}
          aria-label={t.signOut}
          title={t.signOut}
          className="shrink-0 cursor-pointer rounded-md p-2 text-white/60 transition-colors hover:bg-white/[0.08] hover:text-white"
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
        className="flex w-full cursor-pointer items-center gap-2.5 rounded-xl border border-white/15 bg-white/[0.08] px-2.5 py-2 text-start transition-colors hover:bg-white/[0.12]"
      >
        <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-[#2563eb] text-sm font-semibold text-white">
          {name.charAt(0).toUpperCase()}
        </span>
        <span className="min-w-0 flex-1 truncate text-sm font-semibold text-white">{name}</span>
        <ChevronsUpDown className="size-4 shrink-0 text-white/50" aria-hidden />
      </button>
      {open && (
        <>
          <div className="fixed inset-0 z-10" onMouseDown={() => setOpen(false)} aria-hidden />
          <div className="absolute inset-x-0 top-full z-20 mt-1 max-h-72 overflow-y-auto rounded-xl border border-line bg-paper-raised py-1 shadow-xl">
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
    <div className="shell-bar flex min-h-screen">
      <aside className="dark shell-surface sticky top-0 hidden h-dvh w-[264px] shrink-0 md:flex md:flex-col">
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
            className="dark shell-surface animate-slide-in-start absolute inset-y-0 start-0 flex w-72 max-w-[85vw] flex-col overflow-y-auto shadow-lg"
          >
            <button
              type="button"
              onClick={() => setMobileOpen(false)}
              aria-label={t.closeNav}
              className="absolute end-3 top-4 cursor-pointer rounded-md p-1 text-white/70 hover:bg-white/10 hover:text-white"
            >
              <X className="size-4" aria-hidden />
            </button>
            <SidebarContent onNavigate={() => setMobileOpen(false)} />
          </aside>
        </div>
      )}

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="dark shell-bar sticky top-0 z-30 flex h-14 items-center justify-between gap-2 px-3 sm:gap-4 sm:px-5">
          <div className="flex min-w-0 items-center gap-2">
            <button
              type="button"
              onClick={() => setMobileOpen(true)}
              aria-label={t.openNav}
              aria-expanded={mobileOpen}
              className="shrink-0 cursor-pointer rounded-md p-2 text-white/75 hover:bg-white/10 hover:text-white md:hidden"
            >
              <Menu className="size-5" aria-hidden />
            </button>
            <span className="truncate text-sm font-semibold text-white md:hidden">{storeName}</span>
            <CommandPalette />
          </div>

          <div className="flex shrink-0 items-center gap-1.5 sm:gap-2">
            {/* Dashboard-wide locale switch. Lives in the header so it stays
                reachable on mobile, where the sidebar collapses into the drawer. */}
            <NotificationsBell />
            <LanguageSwitch className="hidden sm:inline-flex" />
            <LanguageSwitch compact className="sm:hidden" />
            <ThemeToggle />
          </div>
        </header>

        {/* The page: an inset panel in the frame, with the breadcrumb strip on top. */}
        <div className="flex min-w-0 flex-1 flex-col bg-paper md:rounded-ss-2xl">
          <div className="flex min-h-11 items-center justify-between gap-3 border-b border-line bg-paper-raised px-4 py-1.5 sm:px-6 md:rounded-ss-2xl">
            <Breadcrumbs />
            {/* The store's public link: on every page, and it follows the store switcher. */}
            {currentWorkspace?.slug && <StoreLinkBar slug={currentWorkspace.slug} />}
          </div>
          <main className="flex-1 p-4 pb-14 sm:p-6 sm:pb-16">
            {/* Subscription expiring / expired, or the store suspended. */}
            <AccessBanner />
            <InstallAppPrompt />
            {/* One crashing page shows an error here; the sidebar and header
                stay up so the merchant can move on. */}
            <RouteErrorBoundary resetKey={location.pathname}>
              <Outlet />
            </RouteErrorBoundary>
          </main>
        </div>
      </div>
    </div>
  );
}
