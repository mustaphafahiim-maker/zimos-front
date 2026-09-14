import { useEffect, useMemo, useRef, useState, type ComponentType } from "react";
import { useNavigate } from "react-router-dom";
import { Building2, CornerDownLeft, DatabaseBackup, Megaphone, Power, RotateCcw, Search, UserPlus } from "lucide-react";
import { Kbd, Spinner, cn } from "@store-builder/ui";
import { NAV_GROUPS } from "@/components/navConfig";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { Status } from "@/components/StatusBadge";
import { useToast } from "@/components/Toast";
import { statusValue } from "@/components/workspace";
import { adminApi } from "@/mock/adminApi";
import { controlApi } from "@/mock/controlApi";
import type { AdminWorkspace } from "@/mock/types";

interface PaletteItem {
  id: string;
  section: "Workspaces" | "Pages" | "Quick actions";
  label: string;
  hint?: string;
  icon: ComponentType<{ className?: string }>;
  keywords: string;
  ws?: AdminWorkspace;
  run: () => void;
}

type PendingConfirm = "maintenance" | "reset" | null;

export function CommandPalette({ open, onClose }: { open: boolean; onClose: () => void }) {
  const navigate = useNavigate();
  const toast = useToast();
  const [query, setQuery] = useState("");
  const [active, setActive] = useState(0);
  const [workspaces, setWorkspaces] = useState<AdminWorkspace[] | null>(null);
  const [maintenanceOn, setMaintenanceOn] = useState(false);
  const [confirm, setConfirm] = useState<PendingConfirm>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLUListElement>(null);

  useEffect(() => {
    if (!open) return;
    setQuery("");
    setActive(0);
    window.setTimeout(() => inputRef.current?.focus(), 0);
    let cancelled = false;
    adminApi
      .listWorkspaces({ force: false })
      .then((r) => !cancelled && setWorkspaces(r.rows))
      .catch(() => !cancelled && setWorkspaces([]));
    controlApi
      .getSettings()
      .then((s) => !cancelled && setMaintenanceOn(s.platform.maintenanceMode))
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, [open]);

  const go = (to: string) => {
    onClose();
    navigate(to);
  };

  const items = useMemo<PaletteItem[]>(() => {
    const q = query.trim().toLowerCase();
    const match = (s: string) => !q || s.toLowerCase().includes(q);
    const wsItems: PaletteItem[] = q
      ? (workspaces ?? [])
          .filter((w) => match(`${w.name} ${w.slug} ${w.id} ${w.meta.ownerEmail ?? ""} ${w.meta.ownerName ?? ""}`))
          .slice(0, 6)
          .map((w) => ({ id: `ws-${w.id}`, section: "Workspaces", label: w.name, hint: `${w.meta.ownerEmail ?? "Owner —"} · ${w.id}${w.origin === "demo" ? " · Demo data" : ""}`, icon: Building2, keywords: "", ws: w, run: () => go(`/workspaces/${w.id}`) }))
      : [];
    const pages: PaletteItem[] = NAV_GROUPS.flatMap((g) =>
      g.items.map((i) => ({ id: `page-${i.to}`, section: "Pages" as const, label: i.label, hint: g.label ?? undefined, icon: i.icon, keywords: `${i.label} ${g.label ?? ""} ${i.keywords ?? ""}`, run: () => go(i.to) }))
    ).filter((p) => match(p.keywords));
    const actions: PaletteItem[] = [
      { id: "a-maint", section: "Quick actions" as const, label: maintenanceOn ? "Turn maintenance mode OFF" : "Turn maintenance mode ON", icon: Power, keywords: "maintenance mode downtime", run: () => setConfirm("maintenance") },
      { id: "a-snap", section: "Quick actions" as const, label: "Create backup snapshot", icon: DatabaseBackup, keywords: "backup snapshot", run: () => { onClose(); void controlApi.createSnapshot("").then(() => toast.success("Snapshot created."), () => toast.error("Snapshot failed.")); } },
      { id: "a-invite", section: "Quick actions" as const, label: "Invite admin", icon: UserPlus, keywords: "invite admin staff role", run: () => go("/admin-users?invite=1") },
      { id: "a-ann", section: "Quick actions" as const, label: "New announcement", icon: Megaphone, keywords: "announcement banner broadcast", run: () => go("/announcements") },
      { id: "a-reset", section: "Quick actions" as const, label: "Reset demo data", icon: RotateCcw, keywords: "reset mock demo", run: () => setConfirm("reset") },
    ].filter((a) => match(a.keywords + " " + a.label));
    return [...wsItems, ...pages, ...actions];
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [query, workspaces, maintenanceOn]);

  useEffect(() => {
    setActive(0);
  }, [query]);

  useEffect(() => {
    listRef.current?.querySelector<HTMLElement>(`[data-index="${active}"]`)?.scrollIntoView({ block: "nearest" });
  }, [active]);

  if (!open && !confirm) return null;

  let lastSection = "";

  return (
    <>
      {open && (
        <div className="fixed inset-0 z-50 flex items-start justify-center bg-zimos-navy/40 p-4 pt-[12vh] backdrop-blur-[2px]" onMouseDown={onClose}>
          <div
            role="dialog"
            aria-modal="true"
            aria-label="Command palette"
            onMouseDown={(e) => e.stopPropagation()}
            className="animate-zimos-slide-up w-full max-w-xl overflow-hidden rounded-[var(--radius-modal)] border border-line bg-paper-raised shadow-[var(--shadow-pop)]"
          >
            <div className="flex items-center gap-2 border-b border-line px-4">
              <Search className="size-4 text-ink-muted" aria-hidden />
              <input
                ref={inputRef}
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "ArrowDown") {
                    e.preventDefault();
                    setActive((i) => Math.min(i + 1, items.length - 1));
                  } else if (e.key === "ArrowUp") {
                    e.preventDefault();
                    setActive((i) => Math.max(i - 1, 0));
                  } else if (e.key === "Enter") {
                    e.preventDefault();
                    items[active]?.run();
                  } else if (e.key === "Escape") {
                    onClose();
                  }
                }}
                placeholder="Search pages, workspaces (name, owner, id) or actions…"
                aria-label="Command"
                role="combobox"
                aria-expanded="true"
                aria-controls="palette-list"
                className="h-12 flex-1 bg-transparent text-sm text-ink outline-none placeholder:text-ink-muted"
              />
              <Kbd>Esc</Kbd>
            </div>
            {workspaces === null && query.trim() ? (
              <div className="flex items-center gap-2 px-4 py-6 text-sm text-ink-soft">
                <Spinner /> Loading workspaces…
              </div>
            ) : items.length === 0 ? (
              <p className="px-4 py-6 text-center text-sm text-ink-soft">No results for “{query.trim()}”.</p>
            ) : (
              <ul id="palette-list" ref={listRef} role="listbox" className="scroll-thin max-h-[60vh] overflow-y-auto py-2">
                {items.map((item, i) => {
                  const header = item.section !== lastSection ? item.section : null;
                  lastSection = item.section;
                  return (
                    <li key={item.id} role="presentation">
                      {header && <p className="px-4 pt-2 pb-1 text-[11px] font-semibold tracking-wider text-ink-muted uppercase">{header}</p>}
                      <button
                        type="button"
                        role="option"
                        data-index={i}
                        aria-selected={i === active}
                        onMouseEnter={() => setActive(i)}
                        onClick={item.run}
                        className={cn("flex w-full cursor-pointer items-center gap-3 px-4 py-2 text-start text-sm", i === active && "bg-primary-soft")}
                      >
                        <item.icon className="size-4 shrink-0 text-ink-soft" />
                        <span className="min-w-0 flex-1">
                          <span className="block truncate font-medium text-ink">{item.label}</span>
                          {item.hint && <span className="block truncate text-xs text-ink-soft">{item.hint}</span>}
                        </span>
                        {item.ws && <Status value={statusValue(item.ws)} />}
                        {i === active && <CornerDownLeft className="size-3.5 text-ink-muted" aria-hidden />}
                      </button>
                    </li>
                  );
                })}
              </ul>
            )}
            <div className="flex items-center gap-3 border-t border-line px-4 py-2 text-xs text-ink-soft">
              <span><Kbd>↑</Kbd> <Kbd>↓</Kbd> navigate</span>
              <span><Kbd>Enter</Kbd> open</span>
            </div>
          </div>
        </div>
      )}

      <ConfirmDialog
        open={confirm === "maintenance"}
        title={maintenanceOn ? "Turn maintenance mode off?" : "Turn maintenance mode on?"}
        description={maintenanceOn ? "Merchants and shoppers regain access immediately." : "Every merchant dashboard and storefront shows the maintenance message, except allowlisted IPs."}
        confirmLabel={maintenanceOn ? "Turn off" : "Turn on"}
        destructive={!maintenanceOn}
        onCancel={() => setConfirm(null)}
        onConfirm={async () => {
          const s = await controlApi.setMaintenanceMode(!maintenanceOn);
          setMaintenanceOn(s.platform.maintenanceMode);
          toast.success(s.platform.maintenanceMode ? "Maintenance mode is ON." : "Maintenance mode is OFF.");
          setConfirm(null);
          onClose();
        }}
      />
      <ConfirmDialog
        open={confirm === "reset"}
        title="Reset all demo data?"
        description="Clears every locally stored mock change (plans, notes, settings, audit log…) and reloads."
        confirmLabel="Reset"
        destructive
        onCancel={() => setConfirm(null)}
        onConfirm={() => {
          adminApi.resetAllMockData();
          window.location.reload();
        }}
      />
    </>
  );
}
