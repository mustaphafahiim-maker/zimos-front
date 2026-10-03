import { useEffect, useSyncExternalStore } from "react";
import { NavLink, useLocation } from "react-router-dom";
import { Pin, PinOff } from "lucide-react";
import { cn } from "@store-builder/ui";
import { dashboardGetShortcuts, dashboardSetShortcuts } from "@store-builder/api-client";
import { apiClient } from "@/lib/apiClient";
import { useWorkspace } from "@/context/WorkspaceContext";
import { NAV_ITEMS, NAV_LABELS, findNavItem, isNavItemVisible } from "@/lib/navigation";
import { useT, type Messages } from "@/i18n/LocaleContext";

const STRINGS = {
  en: { heading: "Shortcuts", pin: "Pin this page", unpin: "Unpin this page", full: "You can pin up to 8 pages." },
  ar: { heading: "الاختصارات", pin: "تثبيت هذه الصفحة", unpin: "إلغاء تثبيت هذه الصفحة", full: "يمكنك تثبيت 8 صفحات كحد أقصى." },
} satisfies Messages;

const MAX = 8;

/*
 * One list per store, shared by the desktop rail and the mobile drawer (both
 * render the sidebar), so a pin made in one shows in the other at once.
 */
let state: { workspaceId: string | null; shortcuts: string[] } = { workspaceId: null, shortcuts: [] };
const listeners = new Set<() => void>();
const subscribe = (listener: () => void) => {
  listeners.add(listener);
  return () => listeners.delete(listener);
};
const snapshot = () => state;
function setState(next: typeof state) {
  state = next;
  listeners.forEach((listener) => listener());
}

function load(workspaceId: string) {
  if (state.workspaceId === workspaceId) return;
  setState({ workspaceId, shortcuts: [] });
  dashboardGetShortcuts(apiClient, workspaceId)
    .then((shortcuts) => {
      if (state.workspaceId === workspaceId) setState({ workspaceId, shortcuts });
    })
    .catch(() => undefined);
}

function save(workspaceId: string, shortcuts: string[]) {
  const previous = state.shortcuts;
  setState({ workspaceId, shortcuts });
  dashboardSetShortcuts(apiClient, workspaceId, shortcuts).catch(() => {
    if (state.workspaceId === workspaceId) setState({ workspaceId, shortcuts: previous });
  });
}

/**
 * Sidebar shortcuts (SPEC §18.6): the pages this member pinned, above the
 * navigation, and the pin/unpin control for the page they are on.
 */
export function SidebarShortcuts({ onNavigate }: { onNavigate?: () => void }) {
  const t = useT(STRINGS);
  const navLabels = useT(NAV_LABELS);
  const location = useLocation();
  const { currentWorkspace } = useWorkspace();
  const workspaceId = currentWorkspace?.id;
  const role = currentWorkspace?.role;
  const { shortcuts } = useSyncExternalStore(subscribe, snapshot);

  useEffect(() => {
    if (workspaceId) load(workspaceId);
  }, [workspaceId]);

  if (!workspaceId) return null;

  const current = findNavItem(location.pathname);
  const pinned = shortcuts
    .map((to) => NAV_ITEMS.find((item) => item.to === to))
    .filter((item): item is (typeof NAV_ITEMS)[number] => Boolean(item && isNavItemVisible(item, role)));
  const isPinned = Boolean(current && shortcuts.includes(current.to));
  const canPin = Boolean(current && current.to !== "/" && (isPinned || shortcuts.length < MAX));

  function toggle() {
    if (!current || !workspaceId) return;
    save(workspaceId, isPinned ? shortcuts.filter((to) => to !== current.to) : [...shortcuts, current.to]);
  }

  // Nothing pinned and nothing to pin (the home page): take no space at all.
  if (pinned.length === 0 && !canPin) return null;

  return (
    <div className="mb-4">
      <div className="mb-1 flex items-center gap-1.5 px-3 py-1">
        <span className="flex-1 text-[11px] font-semibold tracking-wider text-ink-soft uppercase rtl:tracking-normal">{t.heading}</span>
        {current && current.to !== "/" && (
          <button
            type="button"
            onClick={toggle}
            disabled={!canPin}
            title={!canPin ? t.full : isPinned ? t.unpin : t.pin}
            aria-label={isPinned ? t.unpin : t.pin}
            aria-pressed={isPinned}
            className="cursor-pointer rounded-md p-1 text-ink-soft hover:bg-primary-soft hover:text-primary disabled:cursor-not-allowed disabled:opacity-50"
          >
            {isPinned ? <PinOff className="size-3.5" aria-hidden /> : <Pin className="size-3.5" aria-hidden />}
          </button>
        )}
      </div>
      <div className="space-y-0.5">
        {pinned.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            onClick={onNavigate}
            className={cn(
              "flex items-center gap-2.5 rounded-[0.5rem] px-3 py-1.5 text-sm font-medium text-ink-soft transition-colors hover:bg-primary-soft hover:text-primary-dark dark:hover:text-primary"
            )}
          >
            <item.icon className="size-4 shrink-0" aria-hidden />
            <span className="min-w-0 truncate">{navLabels[item.key]}</span>
          </NavLink>
        ))}
      </div>
    </div>
  );
}
