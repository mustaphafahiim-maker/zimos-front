import { useEffect, useState, type ReactNode } from "react";
import { IconIntegration, IconPlus } from "@/components/icons";
import { Alert, Button, Card, cn } from "@store-builder/ui";
import {
  partnerAppsDelete,
  partnerAppsInstalls,
  partnerAppsList,
  partnerAppsRotateSecret,
  type PartnerApp,
  type PartnerAppStatus,
  type PartnerAppWithSecret,
} from "@store-builder/api-client";
import { apiBaseUrl, apiClient } from "@/lib/apiClient";
import { useAsync } from "@/lib/useAsync";
import { useErrorMessage } from "@/lib/errorMessages";
import { formatDate } from "@/lib/format";
import { fmt, useT } from "@/i18n/LocaleContext";
import { useToast } from "@/components/Toast";
import { PageHeader } from "@/components/PageHeader";
import { Section } from "@/components/Section";
import { DataState } from "@/components/DataState";
import { EmptyState } from "@/components/EmptyState";
import { StatusBadge } from "@/components/StatusBadge";
import { CopyButton } from "@/components/CopyButton";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { Modal } from "@/components/Modal";
import { PartnerAppFormDialog, PartnerAppSecretDialog } from "./PartnerAppFormDialog";
import { PartnerAppIcon } from "./PartnerAppIcon";
import { GUIDE_ANCHOR, PARTNER_APP_LIMIT, PARTNER_APP_STRINGS, type PartnerAppText } from "./partnerAppStrings";

const STATUS_TONE: Record<PartnerAppStatus, "info" | "success" | "danger"> = {
  development: "info",
  published: "success",
  suspended: "danger",
};

/**
 * Account → Developers (frontend-handoff 265, 267): the signed-in person's
 * own apps — the ones stores install through the approval page. Create and
 * edit them, copy the Client ID, make a new Client Secret (shown once), see
 * which stores installed each, delete one. Below, the developer's guide (the
 * backend's partnerApps/README.md) step by step.
 *
 * The apps belong to the account, not to the open store: nothing here needs a
 * store permission.
 */
export function PartnerAppsPage() {
  const t = useT(PARTNER_APP_STRINGS);
  const toast = useToast();
  const errorMessage = useErrorMessage();
  const list = useAsync(() => partnerAppsList(apiClient), []);
  const apps = list.data?.apps ?? [];
  const full = apps.length >= PARTNER_APP_LIMIT;

  const [editing, setEditing] = useState<PartnerApp | "new" | null>(null);
  const [secret, setSecret] = useState<{ app: PartnerAppWithSecret; rotated: boolean } | null>(null);
  const [rotating, setRotating] = useState<PartnerApp | null>(null);
  const [removing, setRemoving] = useState<PartnerApp | null>(null);
  const [installsOf, setInstallsOf] = useState<PartnerApp | null>(null);

  const reload = () => void list.refresh({ silent: true });

  // A link to the guide (the form's «إزاي الإشعار بيتوقّع») lands on it once the page is drawn.
  const loaded = !list.loading;
  useEffect(() => {
    if (!loaded || window.location.hash !== `#${GUIDE_ANCHOR}`) return;
    document.getElementById(GUIDE_ANCHOR)?.scrollIntoView({ block: "start" });
  }, [loaded]);

  const newButton = (
    <Button type="button" className="min-h-11" disabled={full || list.loading || Boolean(list.error)} onClick={() => setEditing("new")}>
      <IconPlus className="size-4" aria-hidden />
      {t.newApp}
    </Button>
  );

  return (
    <div className="max-w-4xl">
      <PageHeader title={t.title} description={t.description} back={{ to: "/settings?tab=account", label: t.back }} primaryAction={newButton} />

      <DataState loading={list.loading} error={list.error} onRetry={() => void list.refresh()}>
        {apps.length === 0 ? (
          <EmptyState icon={<IconIntegration />} title={t.emptyTitle} description={t.emptyBody} action={<span className="hidden md:inline">{newButton}</span>} />
        ) : (
          <div className="space-y-3">
            <h2 className="text-sm font-semibold text-ink">{t.listTitle}</h2>
            {full && <Alert>{fmt(t.limitNote, { max: PARTNER_APP_LIMIT })}</Alert>}
            <ul className="space-y-3">
              {apps.map((app) => (
                <li key={app.id}>
                  <AppCard
                    t={t}
                    app={app}
                    onEdit={() => setEditing(app)}
                    onInstalls={() => setInstallsOf(app)}
                    onRotate={() => setRotating(app)}
                    onRemove={() => setRemoving(app)}
                  />
                </li>
              ))}
            </ul>
          </div>
        )}
      </DataState>

      <DeveloperGuide t={t} />

      {editing && (
        <PartnerAppFormDialog
          app={editing === "new" ? null : editing}
          scopes={list.data?.scopes ?? []}
          onClose={() => setEditing(null)}
          onCreated={(created) => {
            setEditing(null);
            setSecret({ app: created, rotated: false });
            reload();
          }}
          onSaved={(saved) => {
            setEditing(null);
            toast.success(fmt(t.saved, { name: saved.name }));
            reload();
          }}
        />
      )}

      {secret && <PartnerAppSecretDialog app={secret.app} rotated={secret.rotated} onClose={() => setSecret(null)} />}

      <ConfirmDialog
        open={rotating !== null}
        title={fmt(t.rotateTitle, { name: rotating?.name ?? "" })}
        description={t.rotateBody}
        confirmLabel={t.rotateConfirm}
        cancelLabel={t.cancel}
        busyLabel={t.working}
        onCancel={() => setRotating(null)}
        onConfirm={async () => {
          if (!rotating) return;
          try {
            const rotated = await partnerAppsRotateSecret(apiClient, rotating.id);
            setSecret({ app: rotated, rotated: true });
          } catch (err) {
            throw new Error(errorMessage(err));
          }
          setRotating(null);
        }}
      />

      <ConfirmDialog
        open={removing !== null}
        title={fmt(t.deleteTitle, { name: removing?.name ?? "" })}
        description={t.deleteBody}
        confirmLabel={t.deleteConfirm}
        cancelLabel={t.cancel}
        busyLabel={t.working}
        destructive
        onCancel={() => setRemoving(null)}
        onConfirm={async () => {
          if (!removing) return;
          try {
            await partnerAppsDelete(apiClient, removing.id);
          } catch (err) {
            throw new Error(errorMessage(err));
          }
          toast.success(fmt(t.deleted, { name: removing.name }));
          setRemoving(null);
          reload();
        }}
      />

      {installsOf && <InstallsDialog t={t} app={installsOf} onClose={() => setInstallsOf(null)} />}
    </div>
  );
}

function AppCard({
  t,
  app,
  onEdit,
  onInstalls,
  onRotate,
  onRemove,
}: {
  t: PartnerAppText;
  app: PartnerApp;
  onEdit: () => void;
  onInstalls: () => void;
  onRotate: () => void;
  onRemove: () => void;
}) {
  const facts = [
    fmt(t.permissionsCount, { count: app.scopes.length }),
    fmt(t.callbacksCount, { count: app.redirectUris.length }),
    app.appUrl ? t.hasPage : null,
  ].filter(Boolean);
  return (
    <Card className="gap-3 p-4">
      <div className="flex items-start gap-3">
        <PartnerAppIcon url={app.iconUrl} className="size-11" />
        <div className="min-w-0 flex-1">
          <h3 className="flex flex-wrap items-center gap-2 text-sm font-semibold text-ink">
            <bdi className="min-w-0 break-words">{app.name}</bdi>
            <StatusBadge value={app.status} tone={STATUS_TONE[app.status] ?? "neutral"} text={t[`status_${app.status}`] ?? app.status} />
          </h3>
          {app.description && (
            <p className="mt-0.5 text-sm text-ink-soft" dir="auto">
              {app.description}
            </p>
          )}
          <p className="mt-1 text-xs text-ink-soft">{facts.join(" · ")}</p>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-x-2 gap-y-1 rounded-md bg-paper-sunken px-3 py-1.5">
        <span className="text-xs font-medium text-ink-soft">{t.clientId}</span>
        <code dir="ltr" className="min-w-0 flex-1 select-all break-all font-mono text-xs text-ink">
          {app.clientId}
        </code>
        <CopyButton value={app.clientId} label={t.copyClientId} labelClassName="sr-only sm:not-sr-only" className="min-h-11 shrink-0 sm:min-h-9" />
      </div>

      {app.status === "development" && <p className="text-xs text-ink-soft">{t.developmentNote}</p>}
      {app.status === "suspended" && <p className="text-xs font-medium text-danger">{t.suspendedNote}</p>}

      <div className="flex flex-wrap gap-2">
        <Button size="sm" variant="outline" className="min-h-11 sm:min-h-8" onClick={onEdit}>
          {t.edit}
        </Button>
        <Button size="sm" variant="outline" className="min-h-11 sm:min-h-8" onClick={onInstalls}>
          {t.installs}
        </Button>
        <Button size="sm" variant="ghost" className="min-h-11 sm:min-h-8" onClick={onRotate}>
          {t.rotate}
        </Button>
        <Button size="sm" variant="ghost" className="min-h-11 text-danger sm:min-h-8" onClick={onRemove}>
          {t.remove}
        </Button>
      </div>
    </Card>
  );
}

function InstallsDialog({ t, app, onClose }: { t: PartnerAppText; app: PartnerApp; onClose: () => void }) {
  const installs = useAsync(() => partnerAppsInstalls(apiClient, app.id), [app.id]);
  const rows = installs.data ?? [];
  return (
    <Modal
      open
      onClose={onClose}
      title={fmt(t.installsTitle, { name: app.name })}
      footer={
        <Button variant="outline" className="min-h-11" onClick={onClose}>
          {t.close}
        </Button>
      }
    >
      <DataState loading={installs.loading} error={installs.error} empty={rows.length === 0} emptyMessage={t.installsEmpty} onRetry={() => void installs.refresh()}>
        <ul className="divide-y divide-line rounded-md border border-line">
          {rows.map((install) => (
            <li key={install.storeId} className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1 p-3">
              <div className="min-w-0">
                <p className="text-sm font-medium text-ink">
                  <bdi>{install.storeName ?? t.unnamedStore}</bdi>
                </p>
                <p className="text-xs text-ink-soft">{fmt(t.installedOn, { date: formatDate(install.installedAt) })}</p>
              </div>
              <span className="text-xs text-ink-soft">{fmt(t.permissionsCount, { count: install.scopes.length })}</span>
            </li>
          ))}
        </ul>
      </DataState>
    </Modal>
  );
}

/** The guide's technical words, kept as they are written in code whatever the page's language. */
const GUIDE_TERMS: Record<string, string> = {
  clientId: "Client ID",
  clientSecret: "Client Secret",
  code: "code",
  denied: "error=access_denied",
  state: "state",
  token: "access token",
  hmac: "hmac",
  algo: "HMAC-SHA256 (hex)",
  pairs: "key=value&key=value",
  timestamp: "timestamp",
  header: "X-Zimos-Hmac-Sha256",
  ok: "2xx",
  reason: "reason",
  reasons: "uninstalled_by_store, suspended_by_platform, app_deleted, revoked_by_app",
};

/** A step's sentence with its {terms} as left-to-right runs, so they keep their order inside Arabic. */
function withTerms(text: string): ReactNode[] {
  return text.split(/\{(\w+)\}/).map((part, index) => {
    if (index % 2 === 0) return part;
    const term = GUIDE_TERMS[part] ?? part;
    return (
      // A short term stays on one line; the list of reasons is long enough to need to wrap.
      <bdi key={index} dir="ltr" className={cn("font-mono text-[0.8125rem]", term.length <= 24 && "whitespace-nowrap")}>
        {term}
      </bdi>
    );
  });
}

/** A request or an answer of the guide, left to right whatever the page's language. */
function Code({ children }: { children: string }) {
  return (
    <pre dir="ltr" className="mt-2 overflow-x-auto rounded-md bg-paper-sunken p-3 text-start font-mono text-xs leading-relaxed text-ink">
      {children}
    </pre>
  );
}

function DeveloperGuide({ t }: { t: PartnerAppText }) {
  // The real addresses of this dashboard and its API, so a step can be copied as it stands.
  const dashboard = window.location.origin;
  const api = new URL(apiBaseUrl, window.location.origin).toString().replace(/\/$/, "");
  const docs = `${api.replace(/\/api\/v\d+$/, "")}/public-docs`;
  const steps: Array<{ text: string; code?: string }> = [
    { text: t.guide1 },
    { text: t.guide2, code: `${dashboard}/oauth/authorize?client_id=…&redirect_uri=…&scope=orders:read,orders:write&state=…` },
    { text: t.guide3, code: "redirect_uri?code=…&state=…&store_id=…\nredirect_uri?error=access_denied&state=…" },
    {
      text: t.guide4,
      code: `POST ${api}/oauth/token\n{ "grant_type": "authorization_code", "code": "…", "client_id": "…", "client_secret": "…", "redirect_uri": "…" }\n\n→ { "access_token": "…", "token_type": "Bearer", "scope": "…", "store_id": "…", "store_name": "…", "install_id": "…" }`,
    },
    { text: t.guide5, code: "appUrl?store_id=…&timestamp=…&user_id=…&hmac=…" },
    { text: t.guide6, code: `POST ${api}/oauth/revoke\n{ "client_id": "…", "client_secret": "…", "store_id": "…" }` },
    {
      text: t.guide7,
      code: `POST uninstallUrl\nX-Zimos-Hmac-Sha256: …\n{ "event": "app.uninstalled", "store_id": "…", "install_id": "…", "reason": "uninstalled_by_store", "uninstalled_at": "…" }`,
    },
  ];
  return (
    <div id={GUIDE_ANCHOR} className="mt-6 scroll-mt-24">
      <Section
        title={t.guideTitle}
        description={t.guideIntro}
        actions={
          <a href={docs} target="_blank" rel="noreferrer" className="inline-flex min-h-11 items-center text-sm font-medium text-primary hover:underline">
            {t.apiReference}
          </a>
        }
      >
        <ol className="space-y-4">
          {steps.map((step, index) => (
            <li key={index} className="flex gap-3">
              <span aria-hidden className="flex size-7 shrink-0 items-center justify-center rounded-full bg-primary-soft text-sm font-semibold text-primary-dark">
                {fmt("{n}", { n: index + 1 })}
              </span>
              <div className="min-w-0 flex-1 pt-0.5">
                <p className="text-sm text-ink">{withTerms(step.text)}</p>
                {step.code && <Code>{step.code}</Code>}
              </div>
            </li>
          ))}
        </ol>
      </Section>
    </div>
  );
}
