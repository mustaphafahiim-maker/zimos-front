import { useCallback, useEffect, useRef, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Bell } from "lucide-react";
import { cn } from "@store-builder/ui";
import { fmt, useT } from "@/i18n/LocaleContext";
import * as notificationsApi from "@/lib/notificationsApi";
import type { ConsoleNotification } from "@/lib/notificationsApi";
import { NOTIFICATION_STRINGS, typeLabel } from "@/lib/notificationStrings";
import { formatRelative } from "@/lib/format";

const POLL_MS = 60_000;

/** Top-bar bell: the unread count (polled every 60 s) and the latest 8 in a dropdown. */
export function NotificationBell() {
  const t = useT(NOTIFICATION_STRINGS);
  const navigate = useNavigate();
  const [unread, setUnread] = useState(0);
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState<ConsoleNotification[] | null>(null);
  const ref = useRef<HTMLDivElement>(null);

  const refreshCount = useCallback(() => {
    notificationsApi
      .unreadCount()
      .then(setUnread)
      .catch(() => undefined);
  }, []);

  useEffect(() => {
    refreshCount();
    const timer = window.setInterval(refreshCount, POLL_MS);
    return () => window.clearInterval(timer);
  }, [refreshCount]);

  useEffect(() => {
    if (!open) return;
    notificationsApi
      .listNotifications({ limit: 8 })
      .then((page) => {
        setItems(page.notifications);
        setUnread(page.unread);
      })
      .catch(() => setItems([]));
    const close = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, [open]);

  async function openItem(n: ConsoleNotification) {
    setOpen(false);
    if (!n.readAt) {
      const res = await notificationsApi.markRead({ ids: [n.id] }).catch(() => null);
      if (res) setUnread(res.unread);
    }
    if (n.link) navigate(n.link);
  }

  async function markAll() {
    const res = await notificationsApi.markRead({ all: true }).catch(() => null);
    if (res) {
      setUnread(res.unread);
      setItems((list) => list?.map((n) => ({ ...n, readAt: n.readAt ?? new Date().toISOString() })) ?? null);
    }
  }

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-label={unread ? `${t.bell}: ${fmt(t.unreadCount, { count: unread })}` : t.bell}
        aria-expanded={open}
        className="relative cursor-pointer rounded-md p-2 text-ink-soft hover:bg-primary-soft hover:text-ink"
      >
        <Bell className="size-5" aria-hidden />
        {unread > 0 && (
          <span className="absolute -end-0.5 -top-0.5 min-w-5 rounded-full bg-danger px-1 text-center text-[11px] font-semibold leading-5 text-white tabular">
            {unread > 99 ? "99+" : unread}
          </span>
        )}
      </button>
      {open && (
        <div className="absolute end-0 top-full z-40 mt-2 w-80 max-w-[calc(100vw-2rem)] overflow-hidden rounded-lg border border-line bg-paper-raised shadow-lg">
          <div className="flex items-center justify-between border-b border-line px-3 py-2">
            <span className="text-sm font-semibold text-ink">{t.title}</span>
            {unread > 0 && (
              <button type="button" onClick={() => void markAll()} className="cursor-pointer text-xs font-medium text-primary hover:underline">
                {t.markAllRead}
              </button>
            )}
          </div>
          <ul className="max-h-96 overflow-y-auto">
            {items === null ? (
              <li className="px-3 py-4 text-sm text-ink-soft">…</li>
            ) : items.length === 0 ? (
              <li className="px-3 py-4 text-sm text-ink-soft">{t.empty}</li>
            ) : (
              items.map((n) => (
                <li key={n.id}>
                  <button
                    type="button"
                    onClick={() => void openItem(n)}
                    className={cn("flex w-full cursor-pointer gap-2 px-3 py-2 text-start hover:bg-primary-soft", !n.readAt && "bg-primary-soft/40")}
                  >
                    <span className={cn("mt-1.5 size-2 shrink-0 rounded-full", n.readAt ? "bg-transparent" : "bg-primary")} aria-hidden />
                    <span className="min-w-0">
                      <span className="block truncate text-sm font-medium text-ink">{typeLabel(t, n.type)}</span>
                      {(typeof n.data.name === "string" || n.body) && (
                        <span className="block truncate text-xs text-ink-soft">{typeof n.data.name === "string" ? n.data.name : n.body}</span>
                      )}
                      <span className="block text-xs text-ink-soft">{formatRelative(n.createdAt)}</span>
                    </span>
                  </button>
                </li>
              ))
            )}
          </ul>
          <Link to="/notifications" onClick={() => setOpen(false)} className="block border-t border-line px-3 py-2 text-center text-sm font-medium text-primary hover:bg-primary-soft">
            {t.viewAll}
          </Link>
        </div>
      )}
    </div>
  );
}
