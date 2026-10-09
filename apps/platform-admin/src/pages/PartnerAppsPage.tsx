import { useState } from "react";
import { Link } from "react-router-dom";
import { Ban, Check, Plug, RefreshCw, Undo2 } from "lucide-react";
import { Button } from "@store-builder/ui";
import {
  adminPartnerApps,
  adminSetPartnerAppStatus,
  type AdminPartnerApp,
  type PartnerAppStatus,
} from "@store-builder/api-client";
import { PageHeader } from "@/components/PageHeader";
import { DataState, EmptyBlock } from "@/components/DataState";
import { FilterChips } from "@/components/forms";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { StatusBadge, type Tone } from "@/components/StatusBadge";
import { CopyId } from "@/components/CopyId";
import { useToast } from "@/components/Toast";
import { useAuth } from "@/context/AuthContext";
import { apiClient } from "@/lib/apiClient";
import { getErrorMessage } from "@/lib/errors";
import { formatDateTime, formatRelative } from "@/lib/format";
import { P } from "@/lib/permissions";
import { useAsync } from "@/lib/useAsync";

type Filter = "all" | PartnerAppStatus;

const STATUS_LABEL: Record<PartnerAppStatus, string> = {
  development: "In development",
  published: "Published",
  suspended: "Suspended",
};
const STATUS_TONE: Record<PartnerAppStatus, Tone> = {
  development: "info",
  published: "success",
  suspended: "danger",
};
const FILTERS: Filter[] = ["all", "development", "published", "suspended"];

const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;

function hostOf(url: string): string {
  try {
    return new URL(url).host;
  } catch {
    return url;
  }
}

/**
 * Partner apps (handoff 265; providers.view to see, providers.manage to
 * change): the apps developers registered for stores to install through the
 * approval page. A new app is in development — only its developer's own
 * stores can install it. Publishing opens it to every store; suspending
 * closes it and removes it from the stores that have it.
 */
export function PartnerAppsPage() {
  const { can } = useAuth();
  const toast = useToast();
  const canManage = can(P.PROVIDERS_MANAGE);
  const [filter, setFilter] = useState<Filter>("all");
  const { data, loading, error, refresh, setData } = useAsync(() => adminPartnerApps(apiClient, filter === "all" ? undefined : filter), [filter]);
  const [busy, setBusy] = useState<string | null>(null);
  const [suspending, setSuspending] = useState<AdminPartnerApp | null>(null);

  const apps = data ?? [];

  async function setStatus(app: AdminPartnerApp, status: PartnerAppStatus) {
    setBusy(app.id);
    try {
      const saved = await adminSetPartnerAppStatus(apiClient, app.id, status);
      // It keeps its place under "All"; under a status tab it left that status, so it leaves the list.
      setData((prev) =>
        (prev ?? []).flatMap((item) => (item.id !== app.id ? [item] : filter === "all" ? [{ ...item, ...saved }] : []))
      );
      toast.success(
        status === "published"
          ? `“${app.name}” is published: every store can install it.`
          : status === "suspended"
            ? `“${app.name}” is suspended and removed from the stores that had it.`
            : `“${app.name}” is back in development.`
      );
    } finally {
      setBusy(null);
    }
  }

  const act = (app: AdminPartnerApp, status: PartnerAppStatus) => {
    void setStatus(app, status).catch((err) => toast.error(getErrorMessage(err)));
  };

  return (
    <div>
      <PageHeader
        title="Partner apps"
        description="Apps developers registered for stores to install with one approval. Publish one to open it to every store, or suspend it to close it everywhere."
        actions={
          <Button variant="outline" size="sm" onClick={() => void refresh()} disabled={loading}>
            <RefreshCw /> Refresh
          </Button>
        }
      />
      <FilterChips
        options={FILTERS.map((value) => ({
          value,
          label: value === "all" ? "All" : STATUS_LABEL[value],
          count: value === filter && data ? data.length : undefined,
        }))}
        value={filter}
        onChange={setFilter}
        className="mb-4"
      />

      <DataState loading={loading && !data} error={error} onRetry={() => void refresh()}>
        {apps.length === 0 ? (
          <EmptyBlock message={filter === "all" ? "No developer has registered an app yet." : `No apps are ${STATUS_LABEL[filter].toLowerCase()}.`} />
        ) : (
          <ul className="space-y-3">
            {apps.map((app) => (
              <li key={app.id}>
                <AppRow app={app} canManage={canManage} busy={busy === app.id} onStatus={(status) => act(app, status)} onSuspend={() => setSuspending(app)} />
              </li>
            ))}
          </ul>
        )}
        {apps.length >= 200 && <p className="mt-3 text-xs text-ink-soft">Showing the newest 200. Pick a status to narrow the list.</p>}
      </DataState>

      <ConfirmDialog
        open={suspending !== null}
        title={suspending ? `Suspend “${suspending.name}”?` : "Suspend this app?"}
        description="No store can install it any more, and it is uninstalled from every store that has it now: their access tokens stop working at once. The developer keeps the app; if it is restored later, stores must approve it again."
        confirmLabel="Suspend app"
        destructive
        onCancel={() => setSuspending(null)}
        onConfirm={async () => {
          if (!suspending) return;
          await setStatus(suspending, "suspended");
          setSuspending(null);
        }}
      />
    </div>
  );
}

function AppIcon({ url }: { url: string | null }) {
  const [broken, setBroken] = useState(false);
  return url && !broken ? (
    <img src={url} alt="" onError={() => setBroken(true)} className="size-12 shrink-0 rounded-[10px] border border-line object-cover" />
  ) : (
    <div aria-hidden className="flex size-12 shrink-0 items-center justify-center rounded-[10px] bg-primary-soft text-primary">
      <Plug className="size-5" />
    </div>
  );
}

function AppRow({
  app,
  canManage,
  busy,
  onStatus,
  onSuspend,
}: {
  app: AdminPartnerApp;
  canManage: boolean;
  busy: boolean;
  onStatus: (status: PartnerAppStatus) => void;
  onSuspend: () => void;
}) {
  const { can } = useAuth();
  const hosts = [...new Set(app.redirectUris.map(hostOf))];
  return (
    <article className="flex flex-col gap-3 rounded-[var(--radius-card)] border border-line bg-paper-raised p-4 lg:flex-row lg:items-start">
      <AppIcon url={app.iconUrl} />
      <div className="min-w-0 flex-1 space-y-1.5">
        <div className="flex flex-wrap items-center gap-2">
          <h2 className="min-w-0 break-words font-semibold text-ink" dir="auto">
            {app.name}
          </h2>
          <StatusBadge tone={STATUS_TONE[app.status] ?? "neutral"} dot>
            {STATUS_LABEL[app.status] ?? app.status}
          </StatusBadge>
        </div>
        {app.description && (
          <p className="text-sm text-ink" dir="auto">
            {app.description}
          </p>
        )}
        <p className="flex flex-wrap items-center gap-x-2 gap-y-1 text-sm text-ink-soft">
          <span>Developer</span>
          {can(P.WORKSPACES_VIEW) ? (
            <Link to={`/users/${app.ownerUserId}`} className="font-medium text-primary hover:underline">
              Open account
            </Link>
          ) : null}
          <CopyId value={app.ownerUserId} />
          <span aria-hidden>·</span>
          <span>Client ID</span>
          <CopyId value={app.clientId} full />
        </p>
        <p className="text-sm text-ink-soft">
          {plural(app.scopes.length, "permission", "permissions")}:{" "}
          <span dir="ltr" className="font-mono text-xs">
            {app.scopes.join(", ")}
          </span>
        </p>
        <p className="text-sm text-ink-soft">
          Returns to{" "}
          <span dir="ltr" className="font-mono text-xs">
            {hosts.join(", ") || "—"}
          </span>
          {app.appUrl && (
            <>
              {" "}
              · page on{" "}
              <span dir="ltr" className="font-mono text-xs">
                {hostOf(app.appUrl)}
              </span>
            </>
          )}
          {app.uninstallUrl && (
            <>
              {" "}
              · uninstall notice to{" "}
              <span dir="ltr" className="font-mono text-xs">
                {hostOf(app.uninstallUrl)}
              </span>
            </>
          )}
        </p>
        <p className="text-xs text-ink-soft">
          Registered {formatDateTime(app.createdAt)} · updated <span title={formatDateTime(app.updatedAt)}>{formatRelative(app.updatedAt)}</span>
        </p>
      </div>
      {canManage ? (
        <div className="flex shrink-0 flex-wrap gap-2 lg:flex-col lg:items-stretch">
          {app.status !== "published" && (
            <Button disabled={busy} onClick={() => onStatus("published")}>
              <Check /> Publish
            </Button>
          )}
          {app.status !== "development" && (
            <Button variant="outline" disabled={busy} onClick={() => onStatus("development")}>
              <Undo2 /> {app.status === "suspended" ? "Restore as in development" : "Back to development"}
            </Button>
          )}
          {app.status !== "suspended" && (
            <Button variant="outline" disabled={busy} onClick={onSuspend}>
              <Ban /> Suspend…
            </Button>
          )}
        </div>
      ) : (
        <p className="shrink-0 text-sm text-ink-soft lg:max-w-48">Your role can see partner apps but not publish or suspend them.</p>
      )}
    </article>
  );
}
