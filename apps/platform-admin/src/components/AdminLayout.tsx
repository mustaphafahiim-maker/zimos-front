import { useEffect, useRef, useState, type ComponentType } from "react";
import { NavLink, Outlet, useLocation, useNavigate } from "react-router-dom";
import {
  Activity,
  Ban,
  Building2,
  ChevronDown,
  CreditCard,
  Factory,
  Flag,
  LayoutDashboard,
  LayoutTemplate,
  Layers,
  LifeBuoy,
  LogOut,
  Megaphone,
  Menu,
  MessageCircle,
  Puzzle,
  ScrollText,
  Search,
  ShieldAlert,
  Truck,
  UserCog,
  Wallet,
  X,
} from "lucide-react";
import { Spinner, cn } from "@store-builder/ui";
import { useAuth } from "@/context/AuthContext";
import { ZimosLogo } from "@/components/ZimosLogo";
import { ThemeToggle } from "@/components/ThemeToggle";
import { Status } from "@/components/StatusBadge";
import * as adminApi from "@/lib/adminApi";
import type { AdminWorkspaceRow } from "@/lib/adminApi";
import { initials } from "@/lib/format";

interface NavItem {
  label: string;
  to: string;
  icon: ComponentType<{ className?: string }>;
}

const NAV_GROUPS: Array<{ label: string | null; items: NavItem[] }> = [
  { label: null, items: [{ label: "Overview", to: "/", icon: LayoutDashboard }] },
  {
    label: "Merchants",
    items: [
      { label: "Workspaces", to: "/workspaces", icon: Building2 },
      { label: "Subscriptions", to: "/subscriptions", icon: CreditCard },
      { label: "Plans", to: "/plans", icon: Layers },
    ],
  },
  {
    label: "Marketplace",
    items: [
      { label: "Templates", to: "/templates", icon: LayoutTemplate },
      { label: "Suppliers", to: "/suppliers", icon: Factory },
      { label: "Apps", to: "/apps", icon: Puzzle },
    ],
  },
  {
    label: "Operations",
    items: [
      { label: "Carriers", to: "/carriers", icon: Truck },
      { label: "Payment gateways", to: "/payment-gateways", icon: Wallet },
      { label: "WhatsApp numbers", to: "/whatsapp-numbers", icon: MessageCircle },
    ],
  },
  {
    label: "Risk",
    items: [
      { label: "Fraud signals", to: "/fraud-signals", icon: ShieldAlert },
      { label: "Blocklist (global)", to: "/blocklist", icon: Ban },
    ],
  },
  {
    label: "Support",
    items: [
      { label: "Tickets", to: "/tickets", icon: LifeBuoy },
      { label: "Announcements", to: "/announcements", icon: Megaphone },
    ],
  },
  {
    label: "System",
    items: [
      { label: "Feature flags", to: "/feature-flags", icon: Flag },
      { label: "Audit log", to: "/audit-log", icon: ScrollText },
      { label: "System health", to: "/system-health", icon: Activity },
      { label: "Admin users", to: "/admin-users", icon: UserCog },
    ],
  },
];

function SidebarContent({ onNavigate }: { onNavigate?: () => void }) {
  return (
    <>
      <div className="flex items-center gap-2.5 px-5 pt-5 pb-4">
        <ZimosLogo height={28} />
        <span className="rounded-full border border-line bg-primary-soft px-2 py-0.5 text-[11px] font-semibold tracking-wide text-primary uppercase">
          Platform Admin
        </span>
      </div>
      <nav className="scroll-thin flex-1 overflow-y-auto px-3 pb-4" aria-label="Main">
        {NAV_GROUPS.map((group, gi) => (
          <div key={gi} className={cn(gi > 0 && "mt-4")}>
            {group.label && (
              <p className="mb-1 px-3 text-[11px] font-semibold tracking-wider text-ink-soft uppercase">{group.label}</p>
            )}
            <ul className="space-y-0.5">
              {group.items.map((item) => (
                <li key={item.to}>
                  <NavLink
                    to={item.to}
                    end={item.to === "/"}
                    onClick={onNavigate}
                    className={({ isActive }) =>
                      cn(
                        "flex items-center gap-2.5 rounded-[10px] px-3 py-2 text-sm font-medium text-ink-soft transition-colors hover:bg-primary-soft hover:text-ink",
                        isActive && "bg-primary-soft text-primary"
                      )
                    }
                  >
                    <item.icon className="size-4 shrink-0" />
                    {item.label}
                  </NavLink>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </nav>
    </>
  );
}

function GlobalSearch() {
  const navigate = useNavigate();
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<AdminWorkspaceRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const wrapRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const q = query.trim();
    if (!q) {
      setResults([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    let cancelled = false;
    const t = window.setTimeout(() => {
      adminApi
        .searchWorkspaces(q)
        .then((rows) => {
          if (!cancelled) {
            setResults(rows);
            setActive(0);
          }
        })
        .catch(() => {
          if (!cancelled) setResults([]);
        })
        .finally(() => {
          if (!cancelled) setLoading(false);
        });
    }, 180);
    return () => {
      cancelled = true;
      window.clearTimeout(t);
    };
  }, [query]);

  useEffect(() => {
    const onDown = (e: MouseEvent) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        wrapRef.current?.querySelector("input")?.focus();
      }
    };
    document.addEventListener("mousedown", onDown);
    window.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      window.removeEventListener("keydown", onKey);
    };
  }, []);

  function go(row: AdminWorkspaceRow) {
    setOpen(false);
    setQuery("");
    navigate(`/workspaces/${row.workspace.id}`);
  }

  return (
    <div ref={wrapRef} className="relative w-full max-w-md">
      <Search className="pointer-events-none absolute start-3 top-1/2 size-4 -translate-y-1/2 text-ink-soft" aria-hidden />
      <input
        type="search"
        value={query}
        onChange={(e) => {
          setQuery(e.target.value);
          setOpen(true);
        }}
        onFocus={() => setOpen(true)}
        onKeyDown={(e) => {
          if (e.key === "ArrowDown") {
            e.preventDefault();
            setActive((i) => Math.min(i + 1, Math.max(results.length - 1, 0)));
          } else if (e.key === "ArrowUp") {
            e.preventDefault();
            setActive((i) => Math.max(i - 1, 0));
          } else if (e.key === "Enter" && results[active]) {
            e.preventDefault();
            go(results[active]);
          } else if (e.key === "Escape") {
            setOpen(false);
          }
        }}
        placeholder="Search workspaces…"
        aria-label="Search workspaces by name or address"
        role="combobox"
        aria-expanded={open && query.trim().length > 0}
        aria-controls="global-search-results"
        className="h-9 w-full rounded-[10px] border border-input bg-paper px-3 ps-9 text-sm text-ink outline-none placeholder:text-ink-soft focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
      />
      {open && query.trim() && (
        <div
          id="global-search-results"
          role="listbox"
          className="animate-slide-up absolute inset-x-0 top-11 z-40 overflow-hidden rounded-[12px] border border-line bg-paper-raised shadow-lg"
        >
          {loading ? (
            <div className="flex items-center gap-2 px-4 py-3 text-sm text-ink-soft">
              <Spinner /> Searching…
            </div>
          ) : results.length === 0 ? (
            <p className="px-4 py-3 text-sm text-ink-soft">No workspaces match “{query.trim()}”.</p>
          ) : (
            <ul className="max-h-80 overflow-y-auto py-1">
              {results.map((row, i) => (
                <li key={row.workspace.id} role="option" aria-selected={i === active}>
                  <button
                    type="button"
                    onMouseEnter={() => setActive(i)}
                    onClick={() => go(row)}
                    className={cn(
                      "flex w-full cursor-pointer items-center justify-between gap-3 px-4 py-2 text-start text-sm",
                      i === active && "bg-primary-soft"
                    )}
                  >
                    <span className="min-w-0">
                      <span className="block truncate font-medium text-ink">{row.workspace.name}</span>
                      <span className="block truncate text-xs text-ink-soft">{row.workspace.slug}</span>
                    </span>
                    {row.subscription && <Status value={row.subscription.status} />}
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}

function UserMenu() {
  const { user, logout } = useAuth();
  const [open, setOpen] = useState(false);
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
        className="flex cursor-pointer items-center gap-2 rounded-full border border-line bg-paper-raised py-1 ps-1 pe-2 text-sm text-ink transition-colors hover:border-ink-soft"
      >
        <span className="flex size-7 items-center justify-center rounded-full bg-primary-dark dark:bg-primary-soft text-xs font-semibold text-white">
          {initials(name)}
        </span>
        <span className="hidden max-w-32 truncate sm:inline">{name}</span>
        <ChevronDown className="size-3.5 text-ink-soft" aria-hidden />
      </button>
      {open && (
        <div
          role="menu"
          className="animate-slide-up absolute end-0 top-11 z-40 w-64 overflow-hidden rounded-[12px] border border-line bg-paper-raised shadow-lg"
        >
          <div className="border-b border-line px-4 py-3">
            <p className="truncate text-sm font-medium text-ink">{name}</p>
            <p className="truncate text-xs text-ink-soft">{user?.email}</p>
          </div>
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
    </div>
  );
}

export function AdminLayout() {
  const [mobileOpen, setMobileOpen] = useState(false);
  const location = useLocation();

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

  const envLabel = import.meta.env.DEV ? "Development" : import.meta.env.MODE === "production" ? "Production" : import.meta.env.MODE;

  return (
    <div className="flex min-h-screen bg-paper">
      <aside className="sticky top-0 hidden h-screen w-64 shrink-0 flex-col border-e border-line bg-paper-raised lg:flex">
        <SidebarContent />
      </aside>

      {mobileOpen && (
        <div className="fixed inset-0 z-50 bg-primary-dark/40 dark:bg-black/60 lg:hidden" onMouseDown={() => setMobileOpen(false)}>
          <aside
            role="dialog"
            aria-modal="true"
            aria-label="Navigation"
            onMouseDown={(e) => e.stopPropagation()}
            className="animate-slide-in-start absolute inset-y-0 start-0 flex w-72 max-w-[85vw] flex-col border-e border-line bg-paper-raised shadow-lg"
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
          <GlobalSearch />
          <div className="ms-auto flex items-center gap-2 sm:gap-3">
            <span
              className="hidden items-center gap-1.5 rounded-full border border-accent/25 bg-accent-soft px-2.5 py-1 text-xs font-semibold text-accent-dark sm:inline-flex"
              title="Environment"
            >
              <span className="size-1.5 rounded-full bg-accent" aria-hidden />
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
    </div>
  );
}
