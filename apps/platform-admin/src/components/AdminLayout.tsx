import { useEffect, useRef, useState } from "react";
import { NavLink, Outlet, useLocation } from "react-router-dom";
import { ChevronDown, LogOut, Menu, RotateCcw, Search, X } from "lucide-react";
import { Kbd, ZimosLogo, cn } from "@store-builder/ui";
import { useAuth } from "@/context/AuthContext";
import { ThemeToggle } from "@/components/ThemeToggle";
import { CommandPalette } from "@/components/CommandPalette";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { NAV_GROUPS } from "@/components/navConfig";
import { adminApi } from "@/mock/adminApi";
import { initials } from "@/lib/format";

const COLLAPSE_KEY = "zimos.admin.navCollapsed";

function readCollapsed(): string[] {
  try {
    const raw = localStorage.getItem(COLLAPSE_KEY);
    return raw ? (JSON.parse(raw) as string[]) : [];
  } catch {
    return [];
  }
}

function SidebarContent({ onNavigate }: { onNavigate?: () => void }) {
  const location = useLocation();
  const [collapsed, setCollapsed] = useState<string[]>(readCollapsed);

  const toggle = (id: string) => {
    setCollapsed((prev) => {
      const next = prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id];
      try {
        localStorage.setItem(COLLAPSE_KEY, JSON.stringify(next));
      } catch {
        /* ignore */
      }
      return next;
    });
  };

  const isActive = (to: string) => (to === "/" ? location.pathname === "/" : location.pathname === to || location.pathname.startsWith(`${to}/`));

  return (
    <>
      <div className="flex items-center gap-2.5 px-5 pt-5 pb-4">
        <ZimosLogo height={28} />
        <span className="rounded-full border border-line bg-primary-soft px-2 py-0.5 text-[11px] font-semibold tracking-wide text-primary uppercase">
          Platform Admin
        </span>
      </div>
      <nav className="scroll-thin flex-1 overflow-y-auto px-3 pb-4" aria-label="Main">
        {NAV_GROUPS.map((group, gi) => {
          const hasActive = group.items.some((i) => isActive(i.to));
          const open = !group.label || hasActive || !collapsed.includes(group.id);
          const listId = `nav-group-${group.id}`;
          return (
            <div key={group.id} className={cn(gi > 0 && "mt-3")}>
              {group.label && (
                <button
                  type="button"
                  onClick={() => toggle(group.id)}
                  aria-expanded={open}
                  aria-controls={listId}
                  className="flex w-full cursor-pointer items-center justify-between rounded-md px-3 py-1 text-[11px] font-semibold tracking-wider text-ink-muted uppercase hover:text-ink"
                >
                  {group.label}
                  <ChevronDown className={cn("size-3.5 transition-transform", !open && "-rotate-90 rtl:rotate-90")} aria-hidden />
                </button>
              )}
              {open && (
                <ul id={listId} className="mt-0.5 space-y-0.5">
                  {group.items.map((item) => (
                    <li key={item.to}>
                      <NavLink
                        to={item.to}
                        end={item.to === "/"}
                        onClick={onNavigate}
                        className={({ isActive: active }) =>
                          cn(
                            "relative flex items-center gap-2.5 rounded-[10px] px-3 py-2 text-sm font-medium text-ink-soft transition-colors hover:bg-primary-soft hover:text-ink",
                            active && "bg-primary-soft text-primary before:absolute before:inset-y-1.5 before:start-0 before:w-[3px] before:rounded-full before:bg-primary"
                          )
                        }
                      >
                        <item.icon className="size-4 shrink-0" />
                        {item.label}
                      </NavLink>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          );
        })}
      </nav>
    </>
  );
}

function UserMenu() {
  const { user, logout } = useAuth();
  const [open, setOpen] = useState(false);
  const [confirmReset, setConfirmReset] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const name = user?.fullName || user?.email || "Admin";

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", onDown);
    window.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      window.removeEventListener("keydown", onKey);
    };
  }, [open]);

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-haspopup="menu"
        aria-expanded={open}
        className="flex cursor-pointer items-center gap-2 rounded-full border border-line bg-paper-raised py-1 ps-1 pe-2 text-sm text-ink transition-colors hover:border-line-strong"
      >
        <span className="flex size-7 items-center justify-center rounded-full bg-zimos-navy text-xs font-semibold text-white">{initials(name)}</span>
        <span className="hidden max-w-32 truncate sm:inline">{name}</span>
        <ChevronDown className="size-3.5 text-ink-soft" aria-hidden />
      </button>
      {open && (
        <div role="menu" className="animate-zimos-slide-up absolute end-0 top-11 z-40 w-64 overflow-hidden rounded-[12px] border border-line bg-paper-raised shadow-[var(--shadow-pop)]">
          <div className="border-b border-line px-4 py-3">
            <p className="truncate text-sm font-medium text-ink">{name}</p>
            <p className="truncate text-xs text-ink-soft">{user?.email}</p>
          </div>
          <button
            type="button"
            role="menuitem"
            onClick={() => {
              setOpen(false);
              setConfirmReset(true);
            }}
            className="flex w-full cursor-pointer items-center gap-2 px-4 py-2.5 text-start text-sm text-ink-soft hover:bg-primary-soft hover:text-ink"
          >
            <RotateCcw className="size-4" aria-hidden /> Reset demo data
          </button>
          <button
            type="button"
            role="menuitem"
            onClick={() => void logout()}
            className="flex w-full cursor-pointer items-center gap-2 px-4 py-2.5 text-start text-sm text-ink-soft hover:bg-danger-soft hover:text-danger"
          >
            <LogOut className="size-4" aria-hidden /> Sign out
          </button>
        </div>
      )}
      <ConfirmDialog
        open={confirmReset}
        title="Reset all demo data?"
        description="Clears every locally stored mock change and reloads the console."
        confirmLabel="Reset"
        destructive
        onCancel={() => setConfirmReset(false)}
        onConfirm={() => {
          adminApi.resetAllMockData();
          window.location.reload();
        }}
      />
    </div>
  );
}

export function AdminLayout() {
  const { user } = useAuth();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [paletteOpen, setPaletteOpen] = useState(false);
  const location = useLocation();

  useEffect(() => {
    if (user) adminApi.setMockActor({ name: user.fullName || user.email, email: user.email });
  }, [user]);

  useEffect(() => {
    setMobileOpen(false);
  }, [location.pathname]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setPaletteOpen((v) => !v);
      } else if (e.key === "Escape") {
        setMobileOpen(false);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const isMac = typeof navigator !== "undefined" && /Mac|iPhone|iPad/.test(navigator.platform);
  const envLabel = import.meta.env.DEV ? "Development" : import.meta.env.MODE === "production" ? "Production" : import.meta.env.MODE;

  return (
    <div className="flex min-h-screen bg-paper">
      <aside className="sticky top-0 hidden h-screen w-64 shrink-0 flex-col border-e border-line bg-paper-raised lg:flex">
        <SidebarContent />
      </aside>

      {mobileOpen && (
        <div className="fixed inset-0 z-50 bg-zimos-navy/40 lg:hidden" onMouseDown={() => setMobileOpen(false)}>
          <aside
            role="dialog"
            aria-modal="true"
            aria-label="Navigation"
            onMouseDown={(e) => e.stopPropagation()}
            className="animate-zimos-slide-in-start absolute inset-y-0 start-0 flex w-72 max-w-[85vw] flex-col border-e border-line bg-paper-raised shadow-[var(--shadow-pop)]"
          >
            <button
              type="button"
              onClick={() => setMobileOpen(false)}
              aria-label="Close navigation"
              className="absolute end-3 top-4 cursor-pointer rounded-md p-1 text-ink-soft hover:bg-primary-soft hover:text-ink"
            >
              <X className="size-4" aria-hidden />
            </button>
            <SidebarContent onNavigate={() => setMobileOpen(false)} />
          </aside>
        </div>
      )}

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-30 flex h-16 items-center gap-3 border-b border-line bg-paper-raised/95 px-4 backdrop-blur sm:px-6">
          <button
            type="button"
            onClick={() => setMobileOpen(true)}
            aria-label="Open navigation"
            className="cursor-pointer rounded-md p-2 text-ink-soft hover:bg-primary-soft hover:text-ink lg:hidden"
          >
            <Menu className="size-5" aria-hidden />
          </button>
          <button
            type="button"
            onClick={() => setPaletteOpen(true)}
            aria-label="Open command palette"
            className="flex h-9 w-full max-w-md cursor-pointer items-center gap-2 rounded-[10px] border border-input bg-paper px-3 text-start text-sm text-ink-muted transition-colors hover:border-line-strong"
          >
            <Search className="size-4 shrink-0" aria-hidden />
            <span className="flex-1 truncate">Search workspaces, pages, actions…</span>
            <span className="hidden gap-1 sm:flex">
              <Kbd>{isMac ? "⌘" : "Ctrl"}</Kbd>
              <Kbd>K</Kbd>
            </span>
          </button>
          <div className="ms-auto flex items-center gap-2 sm:gap-3">
            <span className="hidden items-center gap-1.5 rounded-full border border-warning/25 bg-warning-soft px-2.5 py-1 text-xs font-semibold text-warning sm:inline-flex" title="Environment">
              <span className="size-1.5 rounded-full bg-warning" aria-hidden />
              {envLabel}
            </span>
            <ThemeToggle />
            <UserMenu />
          </div>
        </header>
        <main className="min-w-0 flex-1 p-4 sm:p-6">
          <div className="mx-auto w-full max-w-7xl">
            <Outlet />
          </div>
        </main>
      </div>

      <CommandPalette open={paletteOpen} onClose={() => setPaletteOpen(false)} />
    </div>
  );
}
