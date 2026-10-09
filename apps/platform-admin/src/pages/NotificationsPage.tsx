import { useEffect, useRef, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { CheckCheck } from "lucide-react";
import { Alert, Button } from "@store-builder/ui";
import {
  adminListNotifications,
  adminMarkNotificationsRead,
  adminNotificationPrefs,
  adminSaveNotificationPrefs,
  type AdminNotification,
  type AdminNotificationPref,
  type AdminNotificationPrefs,
} from "@store-builder/api-client";
import { PageHeader } from "@/components/PageHeader";
import { DataState, EmptyBlock } from "@/components/DataState";
import { FilterChips, NativeSelect } from "@/components/forms";
import { NotificationRow } from "@/components/NotificationsBell";
import { Panel } from "@/components/Panel";
import { Toggle } from "@/components/Toggle";
import { useToast } from "@/components/Toast";
import { apiClient } from "@/lib/apiClient";
import { useAsync } from "@/lib/useAsync";
import { announceUnread, notificationError, notificationLabel, notificationRoute, onUnreadAnnounced } from "@/lib/notifications";

type Tab = "all" | "unread" | "settings";

const PAGE = 20;

/** A load error in the console's own two lines (403, or try again). */
function asPageError(err: unknown): Error | null {
  return err ? new Error(notificationError(err)) : null;
}

/**
 * Console notifications (handoff 338): everything the bell holds, with the
 * unread filter, a type filter, and this admin's own settings per type.
 */
export function NotificationsPage() {
  const [params, setParams] = useSearchParams();
  const raw = params.get("tab");
  const tab: Tab = raw === "unread" || raw === "settings" ? raw : "all";
  const type = params.get("type") ?? "";
  const prefs = useAsync(() => adminNotificationPrefs(apiClient), []);

  function go(next: { tab?: Tab; type?: string }) {
    const p = new URLSearchParams();
    const t = next.tab ?? tab;
    const ty = next.type ?? type;
    if (t !== "all") p.set("tab", t);
    if (ty && t !== "settings") p.set("type", ty);
    setParams(p, { replace: true });
  }

  return (
    <div>
      <PageHeader title="Notifications" description="What happened on the platform. Read state and settings are your own." />
      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <FilterChips<Tab>
          value={tab}
          onChange={(t) => go({ tab: t })}
          options={[
            { value: "all", label: "All" },
            { value: "unread", label: "Unread" },
            { value: "settings", label: "Settings" },
          ]}
        />
        {tab !== "settings" && (
          <NativeSelect aria-label="Type" value={type} onChange={(e) => go({ type: e.target.value })} className="sm:w-64">
            <option value="">All types</option>
            {(prefs.data?.prefs ?? [])
              .filter((p) => p.enabled || p.type === type)
              .map((p) => (
                <option key={p.type} value={p.type}>
                  {notificationLabel(p.type)}
                </option>
              ))}
          </NativeSelect>
        )}
      </div>
      {tab === "settings" ? (
        <DataState loading={prefs.loading} error={asPageError(prefs.error)} onRetry={() => void prefs.refresh()}>
          {prefs.data && <NotificationSettings saved={prefs.data} onSaved={prefs.setData} />}
        </DataState>
      ) : (
        <NotificationList key={`${tab}:${type}`} unreadOnly={tab === "unread"} type={type} />
      )}
    </div>
  );
}

function NotificationList({ unreadOnly, type }: { unreadOnly: boolean; type: string }) {
  const navigate = useNavigate();
  const toast = useToast();
  const [rows, setRows] = useState<AdminNotification[]>([]);
  const [cursor, setCursor] = useState<string | null>(null);
  const [unread, setUnread] = useState(0);
  const [loading, setLoading] = useState(true);
  const [more, setMore] = useState(false);
  const [error, setError] = useState<unknown>(null);
  const [marking, setMarking] = useState(false);
  const alive = useRef(true);

  async function load(after: string | null) {
    if (after) setMore(true);
    else setLoading(true);
    setError(null);
    try {
      const page = await adminListNotifications(apiClient, {
        type: type || undefined,
        unread: unreadOnly ? true : undefined,
        cursor: after,
        limit: PAGE,
      });
      if (!alive.current) return;
      setRows((prev) => (after ? [...prev, ...page.notifications] : page.notifications));
      setCursor(page.nextCursor);
      setUnread(page.unread);
      announceUnread(page.unread);
    } catch (err) {
      if (!alive.current) return;
      if (after) toast.error(notificationError(err));
      else setError(err);
    } finally {
      if (alive.current) {
        setLoading(false);
        setMore(false);
      }
    }
  }

  useEffect(() => {
    alive.current = true;
    void load(null);
    // The bell marking something read changes the count shown here too.
    const stop = onUnreadAnnounced(setUnread);
    return () => {
      alive.current = false;
      stop();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function open(n: AdminNotification) {
    if (!n.readAt) {
      const now = new Date().toISOString();
      setRows((prev) => prev.map((r) => (r.id === n.id ? { ...r, readAt: now } : r)));
      adminMarkNotificationsRead(apiClient, { ids: [n.id] }).then(
        (count) => announceUnread(count),
        () => undefined
      );
    }
    const to = notificationRoute(n);
    if (to) navigate(to);
  }

  async function markAll() {
    setMarking(true);
    try {
      const count = await adminMarkNotificationsRead(apiClient, { all: true });
      announceUnread(count);
      setUnread(count);
      if (unreadOnly) {
        setRows([]);
        setCursor(null);
      } else {
        const now = new Date().toISOString();
        setRows((prev) => prev.map((r) => (r.readAt ? r : { ...r, readAt: now })));
      }
    } catch (err) {
      toast.error(notificationError(err));
    } finally {
      setMarking(false);
    }
  }

  return (
    <DataState loading={loading} error={asPageError(error)} onRetry={() => void load(null)}>
      {rows.length === 0 ? (
        <EmptyBlock message={unreadOnly ? "No unread notifications" : "No notifications"} />
      ) : (
        <>
          <Panel
            flush
            title={unread > 0 ? `${unread} unread` : "All read"}
            actions={
              <Button size="sm" variant="outline" disabled={unread === 0 || marking} onClick={() => void markAll()}>
                <CheckCheck /> Mark all as read
              </Button>
            }
          >
            <ul className="divide-y divide-line">
              {rows.map((n) => (
                <li key={n.id}>
                  <NotificationRow notification={n} onOpen={open} />
                </li>
              ))}
            </ul>
          </Panel>
          {cursor && (
            <div className="mt-4 flex justify-center">
              <Button variant="outline" disabled={more} onClick={() => void load(cursor)}>
                {more ? "Loading…" : "Load more"}
              </Button>
            </div>
          )}
        </>
      )}
    </DataState>
  );
}

/** One row per type this admin can see: in the console, and by email (stored for when email is sent). */
function NotificationSettings({ saved, onSaved }: { saved: AdminNotificationPrefs; onSaved: (next: AdminNotificationPrefs) => void }) {
  const toast = useToast();
  const [draft, setDraft] = useState<AdminNotificationPref[]>(saved.prefs);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => setDraft(saved.prefs), [saved]);

  const changed = draft.filter((d) => {
    const before = saved.prefs.find((p) => p.type === d.type);
    return !before || before.enabled !== d.enabled || before.email !== d.email;
  });

  function set(type: string, patch: Partial<AdminNotificationPref>) {
    setDraft((prev) => prev.map((p) => (p.type === type ? { ...p, ...patch } : p)));
  }

  async function save() {
    setSaving(true);
    setError(null);
    try {
      onSaved(await adminSaveNotificationPrefs(apiClient, changed));
      toast.success("Settings saved");
      // A type turned off or on changes this admin's count.
      adminListNotifications(apiClient, { limit: 1 }).then(
        (page) => announceUnread(page.unread),
        () => undefined
      );
    } catch (err) {
      setError(notificationError(err));
    } finally {
      setSaving(false);
    }
  }

  if (draft.length === 0) return <EmptyBlock message="Your console role opens no notification type." />;

  return (
    <Panel
      flush
      title="Notification settings"
      description="Yours only — other admins keep their own. A type turned off leaves your list and count; turning it back on shows its rows again."
    >
      {error && (
        <div className="px-5 pt-4">
          <Alert variant="danger">{error}</Alert>
        </div>
      )}
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="text-xs text-ink-soft uppercase">
            <tr className="border-b border-line">
              <th className="px-5 py-2.5 text-start align-top font-medium">Type</th>
              <th className="px-3 py-2.5 text-center align-top font-medium">In the console</th>
              <th className="px-3 py-2.5 text-center align-top font-medium">
                By email
                {!saved.emailDelivery && (
                  <span className="mx-auto mt-1 block max-w-44 text-[11px] font-normal text-ink-soft normal-case">
                    Email isn&rsquo;t sent yet — your choice is kept
                  </span>
                )}
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-line">
            {draft.map((p) => (
              <tr key={p.type}>
                <td className="px-5 py-3 text-ink">{notificationLabel(p.type)}</td>
                <td className="px-3 py-3 text-center">
                  <Toggle
                    checked={p.enabled}
                    onChange={(v) => set(p.type, { enabled: v })}
                    label={`${notificationLabel(p.type)} — in the console`}
                    hideLabel
                  />
                </td>
                <td className="px-3 py-3 text-center">
                  <Toggle
                    checked={p.email}
                    onChange={(v) => set(p.type, { email: v })}
                    label={`${notificationLabel(p.type)} — by email`}
                    hideLabel
                  />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="flex justify-end border-t border-line px-5 py-4">
        <Button disabled={changed.length === 0 || saving} onClick={() => void save()}>
          {saving ? "Saving…" : "Save"}
        </Button>
      </div>
    </Panel>
  );
}
