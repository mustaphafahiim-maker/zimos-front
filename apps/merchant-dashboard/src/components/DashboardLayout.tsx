import { Link, NavLink, Outlet, useLocation, useNavigate } from "react-router-dom";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  Bell,
  Check,
  ChevronDown,
  ChevronsUpDown,
  CreditCard,
  LogOut,
  Menu,
  PanelLeftClose,
  PanelLeftOpen,
  Plus,
  Search,
  Settings,
  Star,
  X,
} from "lucide-react";
import { ZimosLogo, ZimosMark, cn } from "@store-builder/ui";
import { NAV_GROUPS, NAV_ITEMS, findNavItem, type NavItem } from "@/lib/navigation";
import { useAuth } from "@/context/AuthContext";
import { useWorkspace } from "@/context/WorkspaceContext";
import { fmt, useLocale, useT } from "@/i18n/LocaleContext";
import { useDismiss, useLocalStorage } from "@/lib/useLocalStorage";
import { ThemeToggle } from "@/components/ThemeToggle";
import { LanguageSwitch } from "@/components/LanguageSwitch";
import { CommandPalette, useRecentPages } from "@/components/CommandPalette";
import { NotificationsDrawer, useNotifications } from "@/components/NotificationsDrawer";

const STRINGS = {
  en: {
    home: "ZIMOS home",
    mainNav: "Main navigation",
    openMenu: "Open menu",
    closeMenu: "Close menu",
    collapse: "Collapse sidebar",
    expand: "Expand sidebar",
    favorites: "Favorites",
    addFavorite: "Add {label} to favorites",
    removeFavorite: "Remove {label} from favorites",
    isNew: "New",
    selectStore: "Select a store",
    switchStore: "Switch store",
    newStore: "New store",
    search: "Search or jump to…",
    searchShort: "Search",
    notifications: "Notifications",
    unread: "{count} unread",
    account: "Account menu",
    settings: "Settings",
    billing: "Plan & billing",
    signOut: "Sign out",
  },
  ar: {
    home: "الرئيسية",
    mainNav: "التنقل الرئيسي",
    openMenu: "فتح القائمة",
    closeMenu: "إغلاق القائمة",
    collapse: "تصغير الشريط الجانبي",
    expand: "توسيع الشريط الجانبي",
    favorites: "المفضلة",
    addFavorite: "إضافة {label} إلى المفضلة",
    removeFavorite: "إزالة {label} من المفضلة",
    isNew: "جديد",
    selectStore: "اختر متجرًا",
    switchStore: "تبديل المتجر",
    newStore: "متجر جديد",
    search: "ابحث أو انتقل إلى…",
    searchShort: "بحث",
    notifications: "الإشعارات",
    unread: "{count} غير مقروءة",
    account: "قائمة الحساب",
    settings: "الإعدادات",
    billing: "الباقة والفوترة",
    signOut: "تسجيل الخروج",
  },
};

type Strings = (typeof STRINGS)["en"];

function initialsOf(name: string | null | undefined, email: string | null | undefined): string {
  const src = (name ?? "").trim();
  if (src) {
    const parts = src.split(/\s+/);
    return `${parts[0].charAt(0)}${parts[1]?.charAt(0) ?? ""}`.toUpperCase();
  }
  return (email ?? "?").charAt(0).toUpperCase();
}

const isMac = typeof navigator !== "undefined" && /Mac|iPhone|iPad/.test(navigator.platform);

// ------------------------------------------------------------------ nav --

interface NavItemLinkProps {
  item: NavItem;
  rail: boolean;
  favorite: boolean;
  onToggleFavorite: (to: string) => void;
  onNavigate?: () => void;
  t: Strings;
}

function NavItemLink({ item, rail, favorite, onToggleFavorite, onNavigate, t }: NavItemLinkProps) {
  const { locale } = useLocale();
  const label = item.label[locale];
  return (
    <div className="group/nav relative">
      <NavLink
        to={item.to}
        end={item.to === "/" || item.to === "/orders"}
        onClick={onNavigate}
        title={rail ? label : undefined}
        aria-label={rail ? label : undefined}
        className={({ isActive }) =>
          cn(
            "relative flex h-9 items-center gap-2.5 rounded-[10px] text-sm font-medium transition-colors",
            rail ? "justify-center" : "ps-3 pe-8",
            isActive ? "bg-primary-soft text-primary" : "text-ink-soft hover:bg-primary-soft/60 hover:text-ink"
          )
        }
      >
        {({ isActive }) => (
          <>
            {isActive && <span aria-hidden className="absolute inset-y-1.5 start-0 w-[3px] rounded-full bg-primary" />}
            <item.icon className="size-[18px] shrink-0" aria-hidden />
            {!rail && <span className="min-w-0 truncate">{label}</span>}
            {!rail && item.isNew && (
              <span className="ms-auto shrink-0 rounded-full bg-accent-soft px-1.5 py-px text-[10px] font-semibold text-accent-dark">
                {t.isNew}
              </span>
            )}
          </>
        )}
      </NavLink>
      {!rail && (
        <button
          type="button"
          onClick={() => onToggleFavorite(item.to)}
          aria-pressed={favorite}
          aria-label={fmt(favorite ? t.removeFavorite : t.addFavorite, { label })}
          title={fmt(favorite ? t.removeFavorite : t.addFavorite, { label })}
          className={cn(
            "absolute end-1.5 top-1/2 flex size-6 -translate-y-1/2 cursor-pointer items-center justify-center rounded-md transition-opacity hover:bg-paper-raised focus-visible:opacity-100",
            favorite ? "text-primary opacity-100" : "text-ink-muted opacity-0 group-hover/nav:opacity-100"
          )}
        >
          <Star className={cn("size-3.5", favorite && "fill-current")} aria-hidden />
        </button>
      )}
    </div>
  );
}

interface SidebarProps {
  rail: boolean;
  mobile: boolean;
  onClose?: () => void;
  onToggleRail?: () => void;
  t: Strings;
}

function Sidebar({ rail, mobile, onClose, onToggleRail, t }: SidebarProps) {
  const { locale } = useLocale();
  const location = useLocation();
  const [closedGroups, setClosedGroups] = useLocalStorage<Record<string, boolean>>("zimos.nav.groups.collapsed", {});
  const [favorites, setFavorites] = useLocalStorage<string[]>("zimos.nav.favorites", []);
  const activeTo = findNavItem(location.pathname)?.to;

  const toggleFavorite = useCallback(
    (to: string) => setFavorites((prev) => (prev.includes(to) ? prev.filter((x) => x !== to) : [...prev, to])),
    [setFavorites]
  );
  const toggleGroup = (id: string) => setClosedGroups((prev) => ({ ...prev, [id]: !prev[id] }));

  const favoriteItems = favorites
    .map((to) => NAV_ITEMS.find((i) => i.to === to))
    .filter((i): i is NavItem => Boolean(i));

  const groups = [
    ...(favoriteItems.length > 0
      ? [{ id: "favorites", label: { en: STRINGS.en.favorites, ar: STRINGS.ar.favorites }, items: favoriteItems, favorites: true }]
      : []),
    ...NAV_GROUPS.map((g) => ({ ...g, favorites: false })),
  ];

  return (
    <>
      <div className={cn("flex h-16 shrink-0 items-center", rail ? "justify-center px-2" : "justify-between px-5")}>
        <Link to="/" onClick={onClose} aria-label={t.home} className="rounded-md transition-opacity hover:opacity-85">
          {rail ? <ZimosMark size={32} alt="" /> : <ZimosLogo height={30} />}
        </Link>
        {mobile && (
          <button
            type="button"
            onClick={onClose}
            aria-label={t.closeMenu}
            className="flex size-9 cursor-pointer items-center justify-center rounded-[10px] text-ink-soft hover:bg-primary-soft"
          >
            <X className="size-5" aria-hidden />
          </button>
        )}
      </div>

      <nav aria-label={t.mainNav} className={cn("scroll-thin flex-1 overflow-y-auto pb-4", rail ? "px-3" : "px-3")}>
        {groups.map((group, gi) => {
          const closed = !rail && Boolean(closedGroups[group.id]);
          const items = closed ? group.items.filter((i) => i.to === activeTo) : group.items;
          const groupLabel = group.label ? group.label[locale] : null;
          return (
            <div key={group.id} className={cn(gi > 0 && (rail ? "mt-2 border-t border-line pt-2" : "mt-4"))}>
              {groupLabel && !rail && (
                <button
                  type="button"
                  onClick={() => toggleGroup(group.id)}
                  aria-expanded={!closed}
                  className="mb-1 flex w-full cursor-pointer items-center gap-1.5 rounded-md px-3 py-1 text-[11px] font-semibold uppercase tracking-wider text-ink-muted transition-colors hover:text-ink rtl:tracking-normal"
                >
                  {group.favorites && <Star className="size-3 fill-current text-primary" aria-hidden />}
                  <span className="flex-1 text-start">{groupLabel}</span>
                  <ChevronDown
                    className={cn("size-3.5 transition-transform", closed && "-rotate-90 rtl:rotate-90")}
                    aria-hidden
                  />
                </button>
              )}
              <div className="space-y-0.5">
                {items.map((item) => (
                  <NavItemLink
                    key={`${group.id}-${item.to}`}
                    item={item}
                    rail={rail}
                    favorite={favorites.includes(item.to)}
                    onToggleFavorite={toggleFavorite}
                    onNavigate={onClose}
                    t={t}
                  />
                ))}
              </div>
            </div>
          );
        })}
      </nav>

      {!mobile && onToggleRail && (
        <div className={cn("border-t border-line p-3", rail && "flex justify-center")}>
          <button
            type="button"
            onClick={onToggleRail}
            aria-label={rail ? t.expand : t.collapse}
            title={rail ? t.expand : t.collapse}
            className={cn(
              "flex h-9 cursor-pointer items-center gap-2.5 rounded-[10px] text-sm font-medium text-ink-soft transition-colors hover:bg-primary-soft hover:text-primary",
              rail ? "w-9 justify-center" : "w-full px-3"
            )}
          >
            {rail ? (
              <PanelLeftOpen className="size-[18px] rtl:-scale-x-100" aria-hidden />
            ) : (
              <PanelLeftClose className="size-[18px] rtl:-scale-x-100" aria-hidden />
            )}
            {!rail && <span>{t.collapse}</span>}
          </button>
        </div>
      )}
    </>
  );
}

// --------------------------------------------------------------- topbar --

function StoreSwitcher({ t }: { t: Strings }) {
  const { currentWorkspace, workspaces, selectWorkspace } = useWorkspace();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const close = useCallback(() => setOpen(false), []);
  useDismiss(ref, open, close);

  return (
    <div className="relative min-w-0" ref={ref}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label={t.switchStore}
        className="flex h-9 max-w-[14rem] cursor-pointer items-center gap-2 rounded-[10px] border border-line bg-paper-raised ps-1.5 pe-2 text-sm font-medium text-ink transition-colors hover:border-line-strong"
      >
        <span className="flex size-6 shrink-0 items-center justify-center rounded-md bg-primary text-[11px] font-semibold text-white">
          {(currentWorkspace?.name ?? "S").charAt(0).toUpperCase()}
        </span>
        <span className="truncate">{currentWorkspace?.name ?? t.selectStore}</span>
        <ChevronsUpDown className="size-3.5 shrink-0 text-ink-muted" aria-hidden />
      </button>
      {open && (
        <div
          role="menu"
          className="animate-zimos-slide-up absolute start-0 top-full z-40 mt-2 w-64 rounded-2xl border border-line bg-paper-raised p-1.5 shadow-[var(--shadow-pop)]"
        >
          <div className="scroll-thin max-h-72 overflow-y-auto">
            {workspaces.map((workspace) => {
              const current = workspace.id === currentWorkspace?.id;
              return (
                <button
                  key={workspace.id}
                  type="button"
                  role="menuitemradio"
                  aria-checked={current}
                  onClick={() => {
                    selectWorkspace(workspace.id);
                    setOpen(false);
                  }}
                  className={cn(
                    "flex w-full cursor-pointer items-center gap-2 rounded-[10px] px-2.5 py-2 text-start text-sm hover:bg-primary-soft",
                    current ? "font-medium text-primary" : "text-ink"
                  )}
                >
                  <span className="flex size-6 shrink-0 items-center justify-center rounded-md bg-primary-soft text-[11px] font-semibold text-primary">
                    {workspace.name.charAt(0).toUpperCase()}
                  </span>
                  <span className="min-w-0 flex-1 truncate">{workspace.name}</span>
                  {current && <Check className="size-4 shrink-0" aria-hidden />}
                </button>
              );
            })}
          </div>
          <div className="my-1 border-t border-line" />
          <button
            type="button"
            role="menuitem"
            onClick={() => {
              setOpen(false);
              navigate("/workspaces");
            }}
            className="flex w-full cursor-pointer items-center gap-2 rounded-[10px] px-2.5 py-2 text-start text-sm font-medium text-primary hover:bg-primary-soft"
          >
            <Plus className="size-4" aria-hidden />
            {t.newStore}
          </button>
        </div>
      )}
    </div>
  );
}

function UserMenu({ t }: { t: Strings }) {
  const { user, logout } = useAuth();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const close = useCallback(() => setOpen(false), []);
  useDismiss(ref, open, close);
  const initials = initialsOf(user?.fullName, user?.email);

  const itemClass =
    "flex w-full cursor-pointer items-center gap-2.5 rounded-[10px] px-2.5 py-2 text-start text-sm text-ink transition-colors hover:bg-primary-soft";

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label={t.account}
        className="flex size-9 cursor-pointer items-center justify-center rounded-full bg-primary-soft text-xs font-semibold text-primary ring-offset-2 ring-offset-paper-raised transition-shadow hover:ring-2 hover:ring-line-strong"
      >
        {initials}
      </button>
      {open && (
        <div
          role="menu"
          className="animate-zimos-slide-up absolute end-0 top-full z-40 mt-2 w-64 rounded-2xl border border-line bg-paper-raised p-1.5 shadow-[var(--shadow-pop)]"
        >
          <div className="flex items-center gap-3 px-2.5 py-2">
            <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-primary-soft text-xs font-semibold text-primary">
              {initials}
            </span>
            <div className="min-w-0">
              {user?.fullName && <p className="truncate text-sm font-semibold text-ink">{user.fullName}</p>}
              <p className="truncate text-xs text-ink-muted" dir="ltr">
                {user?.email}
              </p>
            </div>
          </div>
          <div className="my-1 border-t border-line" />
          <Link to="/settings" role="menuitem" onClick={close} className={itemClass}>
            <Settings className="size-4 text-ink-muted" aria-hidden />
            {t.settings}
          </Link>
          <Link to="/settings" role="menuitem" onClick={close} className={itemClass}>
            <CreditCard className="size-4 text-ink-muted" aria-hidden />
            {t.billing}
          </Link>
          <div className="my-1 border-t border-line" />
          <button
            type="button"
            role="menuitem"
            onClick={() => {
              close();
              void logout();
            }}
            className={cn(itemClass, "hover:bg-danger-soft hover:text-danger")}
          >
            <LogOut className="size-4 rtl:-scale-x-100" aria-hidden />
            {t.signOut}
          </button>
        </div>
      )}
    </div>
  );
}

// --------------------------------------------------------------- layout --

export function DashboardLayout() {
  const t = useT(STRINGS);
  const location = useLocation();
  const [rail, setRail] = useLocalStorage<boolean>("zimos.sidebar.collapsed", false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [paletteOpen, setPaletteOpen] = useState(false);
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const recent = useRecentPages();
  const notifications = useNotifications();

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

  const iconButton =
    "relative inline-flex size-9 shrink-0 cursor-pointer items-center justify-center rounded-[10px] text-ink-soft transition-colors hover:bg-primary-soft hover:text-primary";

  return (
    <div className="flex min-h-screen bg-paper">
      <aside
        className={cn(
          "hidden shrink-0 flex-col border-e border-line bg-paper-raised transition-[width] duration-200 md:sticky md:top-0 md:flex md:h-screen",
          rail ? "w-[72px]" : "w-64"
        )}
      >
        <Sidebar rail={rail} mobile={false} onToggleRail={() => setRail((v) => !v)} t={t} />
      </aside>

      {mobileOpen && (
        <div className="fixed inset-0 z-50 md:hidden">
          <div className="absolute inset-0 bg-zimos-navy/40" onClick={() => setMobileOpen(false)} aria-hidden />
          <aside className="absolute inset-y-0 start-0 flex w-72 max-w-[85vw] animate-[zimos-slide-in-start_200ms_var(--ease-zimos)_both] flex-col bg-paper-raised pb-[env(safe-area-inset-bottom)] shadow-[var(--shadow-pop)] rtl:animate-[zimos-slide-in-end_200ms_var(--ease-zimos)_both]">
            <Sidebar rail={false} mobile onClose={() => setMobileOpen(false)} t={t} />
          </aside>
        </div>
      )}

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-30 flex h-16 items-center gap-2 border-b border-line bg-paper-raised/95 px-3 backdrop-blur-sm sm:gap-3 md:px-6">
          <button type="button" className={cn(iconButton, "md:hidden")} onClick={() => setMobileOpen(true)} aria-label={t.openMenu}>
            <Menu className="size-5" aria-hidden />
          </button>

          <StoreSwitcher t={t} />

          <div className="flex flex-1 justify-center">
            <button
              type="button"
              onClick={() => setPaletteOpen(true)}
              className="hidden h-9 w-full max-w-md cursor-pointer items-center gap-2 rounded-[10px] border border-line bg-paper px-3 text-sm text-ink-muted transition-colors hover:border-line-strong hover:text-ink-soft md:flex"
            >
              <Search className="size-4 shrink-0" aria-hidden />
              <span className="flex-1 truncate text-start">{t.search}</span>
              <kbd className="rounded-md border border-line bg-paper-raised px-1.5 py-0.5 font-sans text-[11px] text-ink-muted" dir="ltr">
                {isMac ? "⌘K" : "Ctrl K"}
              </kbd>
            </button>
          </div>

          <div className="flex items-center gap-0.5 sm:gap-1">
            <button type="button" className={cn(iconButton, "md:hidden")} onClick={() => setPaletteOpen(true)} aria-label={t.searchShort}>
              <Search className="size-[18px]" aria-hidden />
            </button>
            <LanguageSwitch className="hidden sm:inline-flex" />
            <LanguageSwitch compact className="sm:hidden" />
            <ThemeToggle className="hidden sm:inline-flex" />
            <button
              type="button"
              className={iconButton}
              onClick={() => setNotificationsOpen(true)}
              aria-label={
                notifications.unreadCount > 0
                  ? `${t.notifications} (${fmt(t.unread, { count: notifications.unreadCount })})`
                  : t.notifications
              }
            >
              <Bell className="size-[18px]" aria-hidden />
              {notifications.unreadCount > 0 && (
                <span className="tabular absolute -top-0.5 -end-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-primary px-1 text-[10px] font-semibold leading-none text-white ring-2 ring-paper-raised">
                  {notifications.unreadCount > 9 ? "9+" : notifications.unreadCount}
                </span>
              )}
            </button>
            <div className="ms-1">
              <UserMenu t={t} />
            </div>
          </div>
        </header>

        <main className="flex-1 pb-[env(safe-area-inset-bottom)]">
          <div className="mx-auto w-full max-w-[1440px] p-4 md:p-6 lg:p-8">
            <Outlet />
          </div>
        </main>
      </div>

      <CommandPalette open={paletteOpen} onOpenChange={setPaletteOpen} recent={recent} />
      <NotificationsDrawer open={notificationsOpen} onClose={() => setNotificationsOpen(false)} state={notifications} />
    </div>
  );
}
