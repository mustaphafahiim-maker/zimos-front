import { useCallback, useEffect, useRef, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { Bell, Settings } from "lucide-react";
import { Spinner, cn } from "@store-builder/ui";
import {
  adminListNotifications,
  adminMarkNotificationsRead,
  adminUnreadNotificationCount,
  type AdminNotification,
} from "@store-builder/api-client";
import { useToast } from "@/components/Toast";
import { apiClient } from "@/lib/apiClient";
import { formatDateTime, formatRelative } from "@/lib/format";
import {
  announceUnread,
  notificationError,
  notificationIcon,
  notificationLine,
  notificationNote,
  notificationRoute,
  notificationSubject,
  onUnreadAnnounced,
} from "@/lib/notifications";

/** How often the badge asks for the unread count while the tab is visible. */
const POLL_MS = 60_000;

/** One notification: its icon, line, who it is about and when; bold while unread. */
export function NotificationRow({
  notification: n,
  onOpen,
  compact = false,
}: {
  notification: AdminNotification;
  onOpen: (n: AdminNotification) => void;
  compact?: boolean;
}) {
  const Icon = notificationIcon(n.type);
  const unread = !n.readAt;
  const subject = notificationSubject(n);
  const note = notificationNote(n);
  return (
    <button
      type="button"
      onClick={() => onOpen(n)}
      className={cn(
        "flex w-full cursor-pointer items-start gap-3 text-start transition-colors hover:bg-primary-soft",
        compact ? "px-4 py-2.5" : "px-5 py-3.5"
      )}
    >
      <span
        className={cn(
          "mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-full",
          unread ? "bg-primary-soft text-primary" : "bg-paper text-ink-soft"
        )}
      >
        <Icon className="size-4" />
      </span>
      <span className="min-w-0 flex-1">
        <span className={cn("block break-words text-sm", unread ? "font-semibold text-ink" : "text-ink-soft")}>
          <bdi>{notificationLine(n)}</bdi>
        </span>
        {note && <span className="mt-0.5 block break-words text-xs text-ink-soft">{note}</span>}
        <span className="mt-0.5 block truncate text-xs text-ink-soft">
          {subject && (
            <>
              <bdi>{subject}</bdi> ·{" "}
            </>
          )}
          <span title={formatDateTime(n.createdAt)}>{formatRelative(n.createdAt)}</span>
        </span>
      </span>
      {unread && <span className="mt-2 size-2 shrink-0 rounded-full bg-primary" aria-label="Unread" />}
    </button>
  );
}

/**
 * The top bar's bell (handoff 338): the unread count, and the latest ten on
 * opening it. Read state is this admin's own.
 */
export function NotificationsBell() {
  const navigate = useNavigate();
  const location = useLocation();
  const toast = useToast();
  const ref = useRef<HTMLDivElement>(null);
  const [unread, setUnread] = useState(0);
  const [open, setOpen] = useState(false);
  const [rows, setRows] = useState<AdminNotification[] | null>(null);
  const [failed, setFailed] = useState<string | null>(null);

  const refreshCount = useCallback(() => {
    if (document.visibilityState !== "visible") return;
    // The badge is a convenience: a failed poll leaves the last count showing.
    adminUnreadNotificationCount(apiClient).then(setUnread, () => undefined);
  }, []);

  useEffect(() => {
    refreshCount();
    const timer = window.setInterval(refreshCount, POLL_MS);
    document.addEventListener("visibilitychange", refreshCount);
    const stop = onUnreadAnnounced(setUnread);
    return () => {
      window.clearInterval(timer);
      document.removeEventListener("visibilitychange", refreshCount);
      stop();
    };
  }, [refreshCount]);

  // Moving to another page closes the panel.
  useEffect(() => setOpen(false), [location.pathname, location.search]);

  useEffect(() => {
    if (!open) return;
    setRows(null);
    setFailed(null);
    let cancelled = false;
    adminListNotifications(apiClient, { limit: 10 }).then(
      (page) => {
        if (cancelled) return;
        setRows(page.notifications);
        setUnread(page.unread);
      },
      (err) => {
        if (!cancelled) setFailed(notificationError(err));
      }
    );
    const onDown = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", onDown);
    window.addEventListener("keydown", onKey);
    return () => {
      cancelled = true;
      document.removeEventListener("mousedown", onDown);
      window.removeEventListener("keydown", onKey);
    };
  }, [open]);

  function openRow(n: AdminNotification) {
    if (!n.readAt) {
      adminMarkNotificationsRead(apiClient, { ids: [n.id] }).then(
        (count) => {
          setUnread(count);
          announceUnread(count);
        },
        () => undefined
      );
    }
    setOpen(false);
    const to = notificationRoute(n);
    if (to) navigate(to);
  }

  async function markAll() {
    try {
      const count = await adminMarkNotificationsRead(apiClient, { all: true });
      setUnread(count);
      announceUnread(count);
      const now = new Date().toISOString();
      setRows((prev) => prev?.map((r) => (r.readAt ? r : { ...r, readAt: now })) ?? prev);
    } catch (err) {
      toast.error(notificationError(err));
    }
  }

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-label={unread > 0 ? `Notifications, ${unread} unread` : "Notifications"}
        className="relative flex size-9 cursor-pointer items-center justify-center rounded-full border border-line bg-paper-raised text-ink-soft transition-colors hover:border-ink-soft hover:text-ink"
      >
        <Bell className="size-4" aria-hidden />
        {unread > 0 && (
          <span className="tabular absolute -end-1.5 -top-1.5 flex h-[18px] min-w-[18px] items-center justify-center rounded-full bg-danger px-1 text-[10px] leading-none font-semibold text-white">
            {unread > 99 ? "99+" : unread}
          </span>
        )}
      </button>
      {open && (
        <div
          role="dialog"
          aria-label="Notifications"
          className="animate-slide-up fixed inset-x-3 top-[4.25rem] z-40 overflow-hidden rounded-[12px] border border-line bg-paper-raised shadow-lg sm:absolute sm:inset-x-auto sm:end-0 sm:top-11 sm:w-96"
        >
          <div className="flex items-center justify-between gap-3 border-b border-line px-4 py-3">
            <p className="text-sm font-semibold text-ink">Notifications</p>
            <Link
              to="/notifications?tab=settings"
              aria-label="Notification settings"
              title="Notification settings"
              className="rounded-md p-1 text-ink-soft hover:bg-primary-soft hover:text-ink"
            >
              <Settings className="size-4" aria-hidden />
            </Link>
          </div>
          {failed ? (
            <p className="px-4 py-6 text-center text-sm text-danger">{failed}</p>
          ) : rows === null ? (
            <div className="flex items-center justify-center py-8 text-ink-soft">
              <Spinner />
            </div>
          ) : rows.length === 0 ? (
            <p className="px-4 py-8 text-center text-sm text-ink-soft">No notifications</p>
          ) : (
            <ul className="scroll-thin max-h-[26rem] divide-y divide-line overflow-y-auto">
              {rows.map((n) => (
                <li key={n.id}>
                  <NotificationRow notification={n} onOpen={openRow} compact />
                </li>
              ))}
            </ul>
          )}
          <div className="flex items-center justify-between gap-3 border-t border-line px-4 py-2.5 text-sm">
            <button
              type="button"
              onClick={() => void markAll()}
              disabled={unread === 0}
              className="cursor-pointer font-medium text-primary hover:underline disabled:cursor-default disabled:text-ink-soft disabled:no-underline"
            >
              Mark all as read
            </button>
            <Link to="/notifications" className="font-medium text-primary hover:underline">
              See all
            </Link>
          </div>
        </div>
      )}
    </div>
  );
}
