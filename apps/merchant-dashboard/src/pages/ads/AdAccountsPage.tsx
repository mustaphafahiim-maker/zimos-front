import { useMemo, useState, type FormEvent } from "react";
import { Link } from "react-router-dom";
import { IconPlug, IconRefresh, IconSpinner, IconUnplug } from "@/components/icons";
import { Alert, Button, Card, cn } from "@store-builder/ui";
import {
  adsAdapterFields,
  adsAdaptersList,
  adsConnect,
  adsConnectionsList,
  adsDisconnect,
  adsSelectAccounts,
  adsSyncNow,
  type AdsAdapter,
  type AdsConnection,
} from "@store-builder/api-client";
import { apiClient } from "@/lib/apiClient";
import { useAsync } from "@/lib/useAsync";
import { useWorkspaceId } from "@/lib/useWorkspaceId";
import { useErrorMessage } from "@/lib/errorMessages";
import { formatDateTime } from "@/lib/format";
import { formatRelativeTime } from "@/lib/relativeTime";
import { pluralOf } from "@/lib/plural";
import { adPlatformName } from "@/lib/adPlatforms";
import { fmt, useCommon, useT } from "@/i18n/LocaleContext";
import { PageHeader } from "@/components/PageHeader";
import { AdPlatformLabel } from "@/components/AdPlatformMark";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { DataState } from "@/components/DataState";
import { EmptyState } from "@/components/EmptyState";
import { TextField } from "@/components/Field";
import { Modal } from "@/components/Modal";
import { SaveBar } from "@/components/SaveBar";
import { StatusBadge } from "@/components/StatusBadge";
import { useToast } from "@/components/Toast";
import { useReportDirty } from "@/lib/useUnsavedGuard";
import { BlockTitle } from "@/pages/marketing/kit/Facts";
import { focusFirstInvalid } from "@/pages/marketing/kit/form";
import { MoreMenu } from "@/pages/marketing/kit/MoreMenu";
import { RowAction } from "@/pages/returns/rowkit/RowBits";
import { useIsPhone } from "@/pages/returns/rowkit/useScreen";
import { AD_ACCOUNT_STRINGS, type AdAccountText } from "./adAccountStrings";

/**
 * Money → Ad accounts (handoff 261): connect an ads adapter with its keys,
 * tick the ad accounts to follow (only those are synced and controlled),
 * disconnect, and see the last sync or its error. Reads need
 * financial_reports.view; every change needs profit.manage.
 */
export function AdAccountsPage() {
  const t = useT(AD_ACCOUNT_STRINGS);
  const toast = useToast();
  const workspaceId = useWorkspaceId();
  const errorMessage = useErrorMessage();
  const phone = useIsPhone();
  const { data, error, loading, refresh, setData } = useAsync(async () => {
    const [adapters, connections] = await Promise.all([adsAdaptersList(apiClient, workspaceId), adsConnectionsList(apiClient, workspaceId)]);
    return { adapters, connections };
  }, [workspaceId]);
  const [connecting, setConnecting] = useState<AdsAdapter | null>(null);
  const [disconnecting, setDisconnecting] = useState<AdsConnection | null>(null);
  const [syncing, setSyncing] = useState(false);

  const nameOf = (code: string) => data?.adapters.find((a) => a.code === code)?.name ?? code;
  const putConnection = (next: AdsConnection) =>
    setData((prev) => {
      const current = prev ?? { adapters: [], connections: [] };
      const exists = current.connections.some((c) => c.adapter === next.adapter);
      return {
        ...current,
        connections: exists ? current.connections.map((c) => (c.adapter === next.adapter ? next : c)) : [...current.connections, next],
      };
    });

  async function sync() {
    setSyncing(true);
    try {
      const result = await adsSyncNow(apiClient, workspaceId);
      if (result.accounts === 0) toast.error(t.syncNoAccounts);
      else if (result.failed > 0) toast.error(t.syncFailed);
      else toast.success(result.written > 0 ? fmt(t.synced, { rows: pluralOf(t, "rows", result.written) }) : t.syncedNone);
      await refresh({ silent: true });
    } catch (err) {
      toast.error(errorMessage(err));
    } finally {
      setSyncing(false);
    }
  }

  const hasConnections = Boolean(data && data.connections.length > 0);

  return (
    <div className="min-w-0 max-w-3xl">
      <PageHeader
        title={t.title}
        // A phone keeps the first screen for the accounts: the sentence is for wider screens.
        description={phone ? undefined : t.description}
        back={{ to: "/ads", label: t.back }}
        actions={
          hasConnections ? (
            <Button variant="outline" className="h-11 gap-2 rounded-full px-4 sm:h-10" disabled={syncing} aria-busy={syncing || undefined} onClick={() => void sync()}>
              {syncing ? (
                <IconSpinner className="size-4 animate-spin motion-reduce:animate-none" weight="bold" aria-hidden />
              ) : (
                <IconRefresh className="size-4" aria-hidden />
              )}
              {syncing ? t.syncing : t.syncNow}
            </Button>
          ) : undefined
        }
      />

      <DataState loading={loading} error={error} onRetry={() => void refresh()}>
        {data &&
          (data.adapters.length === 0 && data.connections.length === 0 ? (
            <EmptyState
              icon={<IconPlug aria-hidden />}
              title={t.emptyTitle}
              description={t.emptyDesc}
              action={
                <Button asChild className="rounded-full px-5">
                  <Link to="/ads">{t.addSpend}</Link>
                </Button>
              }
            />
          ) : (
            <div className="flex flex-col gap-[var(--bento-gap)]">
              {data.connections.map((connection) => (
                <ConnectionCard
                  // A reconnect brings a new account list: the card starts again from it.
                  key={`${connection.adapter}:${connection.accounts.map((a) => a.accountId).join(",")}`}
                  t={t}
                  connection={connection}
                  name={nameOf(connection.adapter)}
                  onSaved={putConnection}
                  onDisconnect={() => setDisconnecting(connection)}
                  onReconnect={() => {
                    const adapter = data.adapters.find((a) => a.code === connection.adapter);
                    if (adapter) setConnecting(adapter);
                  }}
                />
              ))}

              {data.adapters.length > 0 && (
                <section className="min-w-0">
                  <BlockTitle>{t.connectTitle}</BlockTitle>
                  <p className="mt-0.5 px-1 text-[13px] leading-5 text-ink-soft">{t.connectDesc}</p>
                  <Card className="mt-2 gap-0 p-0">
                    <ul className="divide-y divide-line">
                      {data.adapters.map((adapter) => {
                        const connected = data.connections.some((c) => c.adapter === adapter.code);
                        return (
                          <li key={adapter.code} className="flex min-h-16 flex-wrap items-center justify-between gap-3 px-4 py-3">
                            <div className="min-w-0">
                              <p className="text-[15px] leading-6 font-medium text-ink">
                                <bdi>{adapter.name}</bdi>
                              </p>
                              <p className="mt-0.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-ink-soft">
                                <span>{t.reaches}</span>
                                {adapter.platforms.map((platform) => (
                                  <AdPlatformLabel key={platform} platform={platform}>
                                    {adPlatformName(platform)}
                                  </AdPlatformLabel>
                                ))}
                              </p>
                            </div>
                            <RowAction
                              label={connected ? t.reconnect : t.connect}
                              icon={IconPlug}
                              tone={connected ? "quiet" : "primary"}
                              onClick={() => setConnecting(adapter)}
                            />
                          </li>
                        );
                      })}
                    </ul>
                  </Card>
                </section>
              )}
            </div>
          ))}
      </DataState>

      {connecting && (
        <ConnectDialog
          key={connecting.code}
          t={t}
          adapter={connecting}
          onClose={() => setConnecting(null)}
          onConnected={(connection) => {
            setConnecting(null);
            putConnection(connection);
            toast.success(fmt(t.connected, { name: connecting.name }));
          }}
        />
      )}

      <ConfirmDialog
        open={Boolean(disconnecting)}
        title={disconnecting ? fmt(t.disconnectTitle, { name: nameOf(disconnecting.adapter) }) : ""}
        description={t.disconnectBody}
        confirmLabel={t.disconnect}
        busyLabel={t.disconnecting}
        destructive
        onCancel={() => setDisconnecting(null)}
        onConfirm={async () => {
          if (!disconnecting) return;
          await adsDisconnect(apiClient, workspaceId, disconnecting.adapter);
          const name = nameOf(disconnecting.adapter);
          setData((prev) => (prev ? { ...prev, connections: prev.connections.filter((c) => c.adapter !== disconnecting.adapter) } : { adapters: [], connections: [] }));
          setDisconnecting(null);
          toast.success(fmt(t.disconnected, { name }));
        }}
      />
    </div>
  );
}

const STATUS_TONE: Record<string, "success" | "danger" | "neutral"> = { connected: "success", error: "danger", disconnected: "neutral" };

/** One connection: its state, the last sync or its error, and the accounts to follow. */
function ConnectionCard({
  t,
  connection,
  name,
  onSaved,
  onDisconnect,
  onReconnect,
}: {
  t: AdAccountText;
  connection: AdsConnection;
  name: string;
  onSaved: (connection: AdsConnection) => void;
  onDisconnect: () => void;
  onReconnect: () => void;
}) {
  const toast = useToast();
  const workspaceId = useWorkspaceId();
  const errorMessage = useErrorMessage();
  const saved = useMemo(() => connection.accounts.filter((a) => a.selected).map((a) => a.accountId), [connection.accounts]);
  const [picked, setPicked] = useState<string[]>(saved);
  const [saving, setSaving] = useState(false);
  const dirty = picked.length !== saved.length || picked.some((id) => !saved.includes(id));
  const statusKey = `status_${connection.status}` as keyof AdAccountText;
  // Leaving the page with a pick that is not saved asks first.
  useReportDirty(dirty);

  async function save() {
    setSaving(true);
    try {
      const next = await adsSelectAccounts(apiClient, workspaceId, connection.adapter, picked);
      onSaved(next);
      setPicked(next.accounts.filter((a) => a.selected).map((a) => a.accountId));
      toast.success(t.pickSaved);
    } catch (err) {
      toast.error(errorMessage(err));
    } finally {
      setSaving(false);
    }
  }

  return (
    <Card className="min-w-0 gap-0 p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <h2 className="flex flex-wrap items-center gap-2 text-[15px] leading-6 font-semibold text-ink">
            <bdi>{name}</bdi>
            <StatusBadge value={connection.status} tone={STATUS_TONE[connection.status] ?? "neutral"} text={t[statusKey] ?? connection.status} />
          </h2>
          {connection.lastVerifiedAt && (
            <p className="mt-1 text-xs text-ink-soft" title={formatDateTime(connection.lastVerifiedAt)}>
              {fmt(t.lastSync, { when: formatRelativeTime(connection.lastVerifiedAt) })}
            </p>
          )}
        </div>
        <MoreMenu
          label={name}
          className="-me-2 -mt-2"
          items={[
            { id: "reconnect", label: t.reconnect, icon: IconPlug, onSelect: onReconnect },
            { id: "disconnect", label: t.disconnect, icon: IconUnplug, destructive: true, separatorBefore: true, onSelect: onDisconnect },
          ]}
        />
      </div>

      {connection.lastError && (
        <Alert variant="danger" className="mt-3">
          {t.lastError}{" "}
          <bdi dir="ltr" className="break-words">
            {connection.lastError}
          </bdi>
        </Alert>
      )}

      <fieldset className="mt-4 min-w-0" disabled={saving}>
        <legend className="text-sm font-medium text-ink">{t.pickTitle}</legend>
        <p className="mt-0.5 text-xs text-ink-soft">{t.pickHint}</p>
        {connection.accounts.length === 0 ? (
          <p className="mt-3 text-sm text-ink-soft">{t.noAccounts}</p>
        ) : (
          <ul className="mt-2 space-y-1">
            {connection.accounts.map((account) => (
              <li key={account.accountId}>
                <label className={cn("-mx-2 flex min-h-12 cursor-pointer items-center gap-3 rounded-[0.875rem] px-2 py-1.5 transition-[background-color] duration-[var(--dur-fade)] ease-[var(--ease-out)] hover:bg-paper-sunken motion-reduce:transition-none", picked.includes(account.accountId) && "bg-primary-soft/50")}>
                  <input
                    type="checkbox"
                    className="size-[18px] shrink-0 cursor-pointer accent-primary"
                    checked={picked.includes(account.accountId)}
                    onChange={(e) =>
                      setPicked((prev) => (e.target.checked ? [...prev, account.accountId] : prev.filter((id) => id !== account.accountId)))
                    }
                  />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-medium text-ink">
                      <bdi>{account.name}</bdi>
                    </span>
                    <span className="mt-0.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-ink-soft">
                      <AdPlatformLabel platform={account.platform}>{adPlatformName(account.platform)}</AdPlatformLabel>
                      <bdi dir="ltr" className="font-mono">
                        {account.accountId}
                      </bdi>
                      {account.currency && <bdi dir="ltr">{account.currency}</bdi>}
                    </span>
                  </span>
                </label>
              </li>
            ))}
          </ul>
        )}
      </fieldset>

      {/* The pick is saved from the bar that rises while it differs from what is saved. */}
      <SaveBar
        dirty={dirty}
        saving={saving}
        onSave={() => void save()}
        onDiscard={() => setPicked(saved)}
        saveLabel={t.savePick}
        savingLabel={t.working}
        className="mt-3"
      />
    </Card>
  );
}

/** Connect (or reconnect) one adapter: its key fields, sealed on the server and never read back. */
function ConnectDialog({
  t,
  adapter,
  onClose,
  onConnected,
}: {
  t: AdAccountText;
  adapter: AdsAdapter;
  onClose: () => void;
  onConnected: (connection: AdsConnection) => void;
}) {
  const common = useCommon();
  const workspaceId = useWorkspaceId();
  const errorMessage = useErrorMessage();
  const fields = adsAdapterFields(adapter.code);
  const [values, setValues] = useState<Record<string, string>>({});
  const [tried, setTried] = useState(false);
  const [busy, setBusy] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const missing = fields.filter((f) => !(values[f.key] ?? "").trim());

  async function submit(e: FormEvent) {
    e.preventDefault();
    setTried(true);
    if (missing.length > 0) {
      focusFirstInvalid(e.currentTarget as HTMLElement);
      return;
    }
    setBusy(true);
    setFormError(null);
    try {
      const credentials = Object.fromEntries(fields.map((f) => [f.key, (values[f.key] ?? "").trim()]));
      onConnected(await adsConnect(apiClient, workspaceId, { adapter: adapter.code, credentials }));
    } catch (err) {
      setFormError(errorMessage(err, { ADS_CREDENTIALS_REJECTED: t.credentialsRejected }));
      setBusy(false);
    }
  }

  return (
    <Modal
      open
      onClose={onClose}
      title={fmt(t.connectDialogTitle, { name: adapter.name })}
      footer={
        <>
          <Button type="button" variant="outline" className="rounded-full px-5" onClick={onClose} disabled={busy}>
            {common.cancel}
          </Button>
          <Button type="submit" form="ad-account-connect" className="rounded-full px-5" disabled={busy}>
            {busy ? t.connecting : t.connect}
          </Button>
        </>
      }
    >
      <form id="ad-account-connect" onSubmit={submit} noValidate className="space-y-4">
        {formError && <Alert variant="danger">{formError}</Alert>}
        <p className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-ink-soft">
          <span>{t.reaches}</span>
          {adapter.platforms.map((platform) => (
            <AdPlatformLabel key={platform} platform={platform}>
              {adPlatformName(platform)}
            </AdPlatformLabel>
          ))}
        </p>
        {fields.length === 0 ? (
          <p className="text-sm text-ink">{t.noKeys}</p>
        ) : (
          fields.map((field) => (
            <TextField
              key={field.key}
              label={(t as Record<string, string>)[`field_${field.key}`] ?? field.key}
              dir="ltr"
              type={field.secret ? "password" : "text"}
              autoComplete="off"
              spellCheck={false}
              required
              value={values[field.key] ?? ""}
              onChange={(e) => setValues((prev) => ({ ...prev, [field.key]: e.target.value }))}
              error={tried && !(values[field.key] ?? "").trim() ? t.fieldRequired : undefined}
            />
          ))
        )}
      </form>
    </Modal>
  );
}
