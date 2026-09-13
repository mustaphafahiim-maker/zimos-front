import { Link, NavLink, Outlet, useNavigate } from "react-router-dom";
import { useState } from "react";
import { Menu, Search, Bell, X } from "lucide-react";
import { cn } from "@store-builder/ui";
import { NAV_GROUPS } from "@/lib/navigation";
import { useAuth } from "@/context/AuthContext";
import { useWorkspace } from "@/context/WorkspaceContext";
import { ThemeToggle } from "@/components/ThemeToggle";

export function DashboardLayout() {
  const { user, logout } = useAuth();
  const { currentWorkspace, workspaces, selectWorkspace } = useWorkspace();
  const navigate = useNavigate();
  const [switcherOpen, setSwitcherOpen] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);

  const sidebar = (
    <>
      <div className="flex items-center justify-between px-5 py-5">
        <Link to="/" className="font-display text-lg text-ink transition-opacity hover:opacity-80">
          Zimos
        </Link>
        <button className="md:hidden" onClick={() => setMobileOpen(false)} aria-label="Close menu">
          <X className="size-5 text-ink-soft" />
        </button>
      </div>
      <nav className="flex-1 space-y-4 overflow-y-auto px-3 pb-4">
        {NAV_GROUPS.map((group, gi) => (
          <div key={gi}>
            {group.label && (
              <p className="mb-1 px-3 text-[11px] font-semibold uppercase tracking-wider text-ink-soft/70">
                {group.label}
              </p>
            )}
            <div className="space-y-0.5">
              {group.items.map((item) => (
                <NavLink
                  key={item.to}
                  to={item.to}
                  end={item.to === "/" || item.to === "/orders"}
                  onClick={() => setMobileOpen(false)}
                  className={({ isActive }) =>
                    cn(
                      "flex items-center gap-2.5 rounded-[0.5rem] px-3 py-1.5 text-sm font-medium text-ink-soft transition-colors hover:bg-primary-soft hover:text-primary-dark",
                      isActive && "bg-primary-soft text-primary-dark"
                    )
                  }
                >
                  <item.icon className="size-4 shrink-0 opacity-80" />
                  <span className="truncate">{item.label}</span>
                  {item.badge && (
                    <span className="ml-auto rounded-full bg-accent-soft px-1.5 text-[10px] font-semibold text-accent-dark">
                      {item.badge}
                    </span>
                  )}
                </NavLink>
              ))}
            </div>
          </div>
        ))}
      </nav>
      <div className="flex items-center gap-2 border-t border-line px-3 py-4">
        <button
          onClick={() => logout()}
          className="cursor-pointer flex-1 rounded-[0.5rem] px-3 py-2 text-left text-sm font-medium text-ink-soft hover:bg-danger-soft hover:text-danger"
        >
          Sign out
        </button>
        <ThemeToggle />
      </div>
    </>
  );

  return (
    <div className="flex min-h-screen bg-paper">
      <aside className="hidden w-60 shrink-0 border-r border-line bg-paper-raised md:sticky md:top-0 md:flex md:h-screen md:flex-col">
        {sidebar}
      </aside>

      {mobileOpen && (
        <div className="fixed inset-0 z-40 flex md:hidden">
          <div className="absolute inset-0 bg-ink/40" onClick={() => setMobileOpen(false)} />
          <aside className="relative flex h-full w-64 flex-col bg-paper-raised shadow-xl">{sidebar}</aside>
        </div>
      )}

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-30 flex h-16 items-center justify-between gap-3 border-b border-line bg-paper-raised/95 px-4 backdrop-blur md:px-6">
          <div className="flex items-center gap-2">
            <button className="md:hidden" onClick={() => setMobileOpen(true)} aria-label="Open menu">
              <Menu className="size-5 text-ink-soft" />
            </button>
            <div className="relative">
              <button
                onClick={() => setSwitcherOpen((v) => !v)}
                className="cursor-pointer flex items-center gap-2 rounded-[0.5rem] px-2 py-1.5 text-sm font-medium text-ink hover:bg-paper"
              >
                <span className="flex size-6 items-center justify-center rounded bg-primary text-[11px] font-semibold text-white">
                  {(currentWorkspace?.name ?? "S").charAt(0).toUpperCase()}
                </span>
                {currentWorkspace?.name ?? "Select a store"}
                <span className="text-ink-soft">▾</span>
              </button>
              {switcherOpen && (
                <div className="absolute left-0 top-full z-20 mt-1 w-64 rounded-[0.5rem] border border-line bg-paper-raised py-1 shadow-lg">
                  {workspaces.map((workspace) => (
                    <button
                      key={workspace.id}
                      onClick={() => {
                        selectWorkspace(workspace.id);
                        setSwitcherOpen(false);
                      }}
                      className={cn(
                        "block w-full cursor-pointer px-3 py-2 text-left text-sm hover:bg-primary-soft",
                        workspace.id === currentWorkspace?.id && "font-medium text-primary-dark"
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
                    className="cursor-pointer block w-full px-3 py-2 text-left text-sm text-primary hover:bg-primary-soft"
                  >
                    + New store
                  </button>
                </div>
              )}
            </div>
          </div>

          <div className="hidden flex-1 justify-center md:flex">
            <label className="flex w-full max-w-md items-center gap-2 rounded-[0.5rem] border border-line bg-paper px-3 py-1.5 text-sm text-ink-soft">
              <Search className="size-4" />
              <input
                className="w-full bg-transparent text-ink outline-none placeholder:text-ink-soft/70"
                placeholder="Search orders, products, customers…"
                onKeyDown={(e) => {
                  if (e.key === "Enter") navigate(`/orders?q=${encodeURIComponent((e.target as HTMLInputElement).value)}`);
                }}
              />
            </label>
          </div>

          <div className="flex items-center gap-3 text-sm text-ink-soft">
            <button className="relative rounded-full p-1.5 hover:bg-paper" aria-label="Notifications">
              <Bell className="size-4" />
              <span className="absolute right-1 top-1 size-2 rounded-full bg-accent" />
            </button>
            <span className="hidden sm:inline">{user?.fullName ?? user?.email}</span>
            <div className="flex size-8 items-center justify-center rounded-full bg-primary-soft font-medium text-primary-dark">
              {(user?.fullName ?? user?.email ?? "?").charAt(0).toUpperCase()}
            </div>
          </div>
        </header>

        <main className="flex-1 p-4 md:p-6">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
