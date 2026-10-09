import { useEffect, useRef, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { IconClose, IconDelete, IconEdit, IconExternal, IconEye, IconPause, IconPlay, IconPlus, IconRefresh, IconSheet } from "@/components/icons";
import { Alert, Button, Dialog, DialogClose, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@store-builder/ui";
import {
  googleSheetsAuthorizeUrl,
  googleSheetsBackfill,
  googleSheetsConnectAccount,
  googleSheetsDelete,
  googleSheetsDisconnectAccount,
  googleSheetsOverview,
  googleSheetsRows,
  googleSheetsUpdate,
  type SheetConnection,
} from "@store-builder/api-client";
import { apiClient } from "@/lib/apiClient";
import { useWorkspaceId } from "@/lib/useWorkspaceId";
import { useAsync } from "@/lib/useAsync";
import { useErrorMessage } from "@/lib/errorMessages";
import { formatDateTime } from "@/lib/format";
import { fmt, useT, type Messages } from "@/i18n/LocaleContext";
import { useToast } from "@/components/Toast";
import { PageHeader } from "@/components/PageHeader";
import { DataState } from "@/components/DataState";
import { EmptyState } from "@/components/EmptyState";
import { Section } from "@/components/Section";
import { StatusBadge } from "@/components/StatusBadge";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { AppOffNotice } from "@/components/AppOffNotice";
import { GoogleSheetDialog } from "./GoogleSheetDialog";
// A real Google account: refusals on the way back, access taken away, stopped sheets (handoff 393).
import { SHEETS_REAL_STRINGS, SheetPreviewProblem, sheetPreviewProblem, useGoogleReturnError, useSheetErrorOverrides } from "./googleSheetsReal";

const STRINGS = {
  en: {
    title: "Google Sheets",
    description: "Write orders, lost orders and leads into your Google sheets as they happen, for your confirmation and sales teams.",
    back: "Apps",
    unavailable: "Google Sheets isn't available on this server yet. It will appear here once it is set up.",
    accountTitle: "Google account",
    accountHint: "ZIMOS only sees the sheets it creates for you.",
    connectedAs: "Connected as {email}",
    notConnected: "No Google account is connected.",
    connect: "Connect Google account",
    reconnect: "Connect again",
    connecting: "Connecting…",
    disconnect: "Disconnect",
    disconnectTitle: "Disconnect the Google account?",
    disconnectBody: "Every sheet stops being written until an account is connected again. The sheets themselves stay in Google Drive.",
    connectedToast: "The Google account is connected.",
    disconnectedToast: "The Google account was disconnected.",
    test: "Test",
    sandboxHint: "Test mode: there is no real Google here. Sheets are kept on the server, and you can see their rows with Preview.",
    revokedAlert: "Access to Google was removed, so some sheets stopped. Connect the account again to resume them.",
    sheetsTitle: "Sheets",
    sheetsHint: "Each sheet has its own columns and filter. Rows already written keep the layout they were written in.",
    add: "Add a sheet",
    noSheetsTitle: "No sheets yet",
    noSheetsBody: "Add a sheet for orders, lost orders or leads.",
    connectFirst: "Connect a Google account first.",
    orders: "Orders",
    lost: "Lost orders",
    leads: "Leads",
    active: "Active",
    paused: "Paused",
    revoked: "Access removed",
    error: "Sheet missing",
    rows: "Rows written: {count}",
    lastSync: "Last written {when}",
    never: "Nothing written yet",
    revokedLine: "Google access was removed, so nothing is written. Connect the account again above.",
    missingLine: "The sheet was deleted or moved in Google Drive. Delete it here and add a new sheet.",
    retrying: "The last write failed and is tried again on its own ({error}).",
    open: "Open sheet",
    preview: "Preview",
    backfill: "Sync existing",
    backfillHint: "Adds the last {days} days that aren't in the sheet yet.",
    backfillToast: "The last {days} days are being added to {name}.",
    pause: "Pause",
    resume: "Resume",
    edit: "Edit",
    delete: "Delete",
    deleteTitle: "Delete {name}?",
    deleteBody: "ZIMOS stops writing to it. The sheet itself stays in Google Drive.",
    deletedToast: "{name} was deleted.",
    savedToast: "{name} was saved.",
    createdToast: "{name} was created. New rows are written as they happen; use Sync existing to add the last {days} days.",
    pausedToast: "{name} is paused.",
    resumedToast: "{name} is writing again.",
    cancel: "Cancel",
    working: "Working…",
    close: "Close",
    previewTitle: "{name}: the newest rows",
    previewHint: "Rows in the sheet: {total}.",
    previewEmpty: "The sheet has only its titles so far.",
  },
  ar: {
    title: "Google Sheets",
    description: "اكتب الطلبات والطلبات الضايعة والعملاء المحتملين في شيتات Google أول ما تحصل، لفريق التأكيد والمبيعات.",
    back: "التطبيقات",
    unavailable: "Google Sheets لسه مش متاح على السيرفر ده. هيظهر هنا أول ما يتجهّز.",
    accountTitle: "حساب Google",
    accountHint: "ZIMOS بيشوف بس الشيتات اللي بيعملهالك.",
    connectedAs: "مربوط بـ {email}",
    notConnected: "مفيش حساب Google مربوط.",
    connect: "اربط حساب Google",
    reconnect: "اربط تاني",
    connecting: "بنربط…",
    disconnect: "فك الربط",
    disconnectTitle: "فك ربط حساب Google؟",
    disconnectBody: "كل الشيتات هتقف الكتابة فيها لحد ما تربط حساب تاني. الشيتات نفسها هتفضل في Google Drive.",
    connectedToast: "حساب Google اتربط.",
    disconnectedToast: "اتفك ربط حساب Google.",
    test: "تجريبي",
    sandboxHint: "وضع تجريبي: مفيش Google حقيقي هنا. الشيتات محفوظة على السيرفر، وتقدر تشوف صفوفها من «معاينة».",
    revokedAlert: "إذن Google اتشال، فبعض الشيتات وقفت. اربط الحساب تاني علشان ترجع تشتغل.",
    sheetsTitle: "الشيتات",
    sheetsHint: "كل شيت ليه أعمدته وفلتره. الصفوف اللي اتكتبت قبل كده بتفضل بنفس ترتيبها.",
    add: "إضافة شيت",
    noSheetsTitle: "مفيش شيتات لسه",
    noSheetsBody: "ضيف شيت للطلبات أو الطلبات الضايعة أو العملاء المحتملين.",
    connectFirst: "اربط حساب Google الأول.",
    orders: "الطلبات",
    lost: "الطلبات الضايعة",
    leads: "العملاء المحتملين",
    active: "شغّال",
    paused: "متوقف مؤقتًا",
    revoked: "الإذن اتشال",
    error: "الشيت مش موجود",
    rows: "اتكتب {count} صف",
    lastSync: "آخر كتابة {when}",
    never: "لسه متكتبش حاجة",
    revokedLine: "إذن Google اتشال، فمفيش حاجة بتتكتب. اربط الحساب تاني من فوق.",
    missingLine: "الشيت اتمسح أو اتنقل في Google Drive. احذفه هنا وضيف شيت جديد.",
    retrying: "آخر كتابة فشلت وهتتعاد لوحدها ({error}).",
    open: "افتح الشيت",
    preview: "معاينة",
    backfill: "زامن القديم",
    backfillHint: "بيضيف آخر {days} يوم اللي مش موجودين في الشيت.",
    backfillToast: "بنضيف آخر {days} يوم لـ {name}.",
    pause: "إيقاف مؤقت",
    resume: "تشغيل",
    edit: "تعديل",
    delete: "حذف",
    deleteTitle: "حذف {name}؟",
    deleteBody: "ZIMOS هيوقف الكتابة فيه. الشيت نفسه هيفضل في Google Drive.",
    deletedToast: "{name} اتحذف.",
    savedToast: "{name} اتحفظ.",
    createdToast: "{name} اتعمل. الصفوف الجديدة بتتكتب أول ما تحصل، واستخدم «زامن القديم» لإضافة آخر {days} يوم.",
    pausedToast: "{name} اتوقف مؤقتًا.",
    resumedToast: "{name} رجع يكتب.",
    cancel: "إلغاء",
    working: "بننفّذ…",
    close: "إغلاق",
    previewTitle: "{name}: أحدث الصفوف",
    previewHint: "{total} صف في الشيت.",
    previewEmpty: "الشيت فيه العناوين بس لحد دلوقتي.",
  },
} satisfies Messages;

type T = (typeof STRINGS)["en"];

const STATUS_TONE = { active: "success", paused: "neutral", revoked: "danger", error: "danger" } as const;

/**
 * Google Sheets (SPEC §16.4; backend modules/sheets): connect a Google
 * account, then any number of sheets for orders, lost orders or leads, each
 * written as things happen. Google sends the merchant back here with
 * ?code&state, which this page hands to the backend.
 */
export function GoogleSheetsPage() {
  const t = useT(STRINGS);
  const workspaceId = useWorkspaceId();
  const toast = useToast();
  const errorMessage = useErrorMessage();
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const overview = useAsync(() => googleSheetsOverview(apiClient, workspaceId), [workspaceId]);
  const [connecting, setConnecting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [editing, setEditing] = useState<SheetConnection | "new" | null>(null);
  const [removing, setRemoving] = useState<SheetConnection | null>(null);
  const [disconnecting, setDisconnecting] = useState(false);
  const [previewing, setPreviewing] = useState<SheetConnection | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const handled = useRef<string | null>(null);
  const g = useT(SHEETS_REAL_STRINGS);
  const sheetErrors = useSheetErrorOverrides();
  // Back from Google with ?error= (Cancel pressed, or Google refused).
  useGoogleReturnError(params.get("error"), setError);

  // Back from Google: hand the code over once, then drop it from the address.
  const code = params.get("code");
  const state = params.get("state");
  useEffect(() => {
    if (!code || !state || handled.current === code) return;
    handled.current = code;
    setConnecting(true);
    googleSheetsConnectAccount(apiClient, workspaceId, code, state)
      .then(() => {
        toast.success(t.connectedToast);
        return overview.refresh({ silent: true });
      })
      .catch((err) => setError(errorMessage(err, sheetErrors)))
      .finally(() => {
        setConnecting(false);
        navigate("/apps/google-sheets", { replace: true });
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [code, state, workspaceId]);

  async function connect() {
    setConnecting(true);
    setError(null);
    try {
      const url = await googleSheetsAuthorizeUrl(apiClient, workspaceId, `${window.location.origin}/apps/google-sheets`);
      window.location.assign(url);
    } catch (err) {
      setError(errorMessage(err));
      setConnecting(false);
    }
  }

  async function act(connection: SheetConnection, kind: string, work: () => Promise<string>) {
    setBusy(`${connection.id}:${kind}`);
    try {
      toast.success(await work());
      await overview.refresh({ silent: true });
    } catch (err) {
      toast.error(errorMessage(err, sheetErrors));
    } finally {
      setBusy(null);
    }
  }

  const data = overview.data;
  const account = data?.account;
  const connections = data?.connections ?? [];
  const anyRevoked = connections.some((c) => c.status === "revoked");

  return (
    <div>
      <PageHeader title={t.title} description={t.description} back={{ to: "/apps", label: t.back }} />
      <AppOffNotice app="google_sheets" />
      {error && (
        <Alert variant="danger" className="mb-4">
          {error}
        </Alert>
      )}
      <DataState loading={overview.loading} error={overview.error} onRetry={() => void overview.refresh()}>
        {data && !data.adapter.available ? (
          <Alert>{t.unavailable}</Alert>
        ) : (
          data && (
            <div className="space-y-4">
              <Section
                title={t.accountTitle}
                description={t.accountHint}
                actions={data.adapter.sandbox ? <StatusBadge value="test" tone="warning" text={t.test} /> : undefined}
              >
                {data.adapter.sandbox && <p className="mb-3 text-xs text-ink-soft">{t.sandboxHint}</p>}
                {account?.reconnect ? (
                  <Alert variant="danger" className="mb-3" data-slot="sheets-reconnect">
                    <p>{g.reconnectBanner}</p>
                    {account.email && (
                      <p className="mt-1 text-xs">
                        {g.reconnectAccount.split("{email}")[0]}
                        <bdi dir="ltr">{account.email}</bdi>
                        {g.reconnectAccount.split("{email}")[1]}
                      </p>
                    )}
                  </Alert>
                ) : (
                  anyRevoked &&
                  account?.connected && (
                    <Alert variant="danger" className="mb-3">
                      {t.revokedAlert}
                    </Alert>
                  )
                )}
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <p className="text-sm text-ink">{account?.connected ? fmt(t.connectedAs, { email: account.email ?? "" }) : t.notConnected}</p>
                  <div className="flex flex-wrap gap-2">
                    {account?.connected && (
                      <Button variant="ghost" size="sm" className="pointer-coarse:min-h-11" disabled={connecting} onClick={() => setDisconnecting(true)}>
                        {t.disconnect}
                      </Button>
                    )}
                    {(!account?.connected || anyRevoked || account?.reconnect) && (
                      <Button size="sm" className="pointer-coarse:min-h-11" disabled={connecting} onClick={() => void connect()}>
                        {connecting ? t.connecting : account?.connected ? t.reconnect : t.connect}
                      </Button>
                    )}
                  </div>
                </div>
                {/* Said before the redirect to Google: what the permission covers. */}
                {(!account?.connected || anyRevoked || account?.reconnect) && <p className="mt-2 text-xs leading-5 text-ink-soft">{g.scopeNote}</p>}
              </Section>

              <Section
                title={t.sheetsTitle}
                description={t.sheetsHint}
                actions={
                  <Button size="sm" className="pointer-coarse:min-h-11" disabled={!account?.connected} title={account?.connected ? undefined : t.connectFirst} onClick={() => setEditing("new")}>
                    <IconPlus className="size-4" aria-hidden />
                    {t.add}
                  </Button>
                }
              >
                {connections.length === 0 ? (
                  <EmptyState icon={<IconSheet />} title={t.noSheetsTitle} description={account?.connected ? t.noSheetsBody : t.connectFirst} />
                ) : (
                  <ul className="divide-y divide-line">
                    {connections.map((connection) => (
                      <SheetRow
                        key={connection.id}
                        t={t}
                        connection={connection}
                        sandbox={data.adapter.sandbox}
                        backfillDays={data.backfillDays}
                        busy={busy}
                        onEdit={() => setEditing(connection)}
                        onDelete={() => setRemoving(connection)}
                        onPreview={() => setPreviewing(connection)}
                        onBackfill={() =>
                          act(connection, "backfill", async () => {
                            const { days } = await googleSheetsBackfill(apiClient, workspaceId, connection.id);
                            return fmt(t.backfillToast, { days, name: connection.name });
                          })
                        }
                        onToggle={() =>
                          act(connection, "toggle", async () => {
                            const next = connection.status === "active" ? "paused" : "active";
                            await googleSheetsUpdate(apiClient, workspaceId, connection.id, { status: next });
                            return fmt(next === "paused" ? t.pausedToast : t.resumedToast, { name: connection.name });
                          })
                        }
                      />
                    ))}
                  </ul>
                )}
              </Section>
            </div>
          )
        )}
      </DataState>

      {data && (
        <GoogleSheetDialog
          open={editing !== null}
          connection={editing === "new" ? null : editing}
          overview={data}
          onClose={() => setEditing(null)}
          onSaved={(saved, created) => {
            setEditing(null);
            toast.success(created ? fmt(t.createdToast, { name: saved.name, days: data.backfillDays }) : fmt(t.savedToast, { name: saved.name }));
            void overview.refresh({ silent: true });
          }}
        />
      )}

      <SheetPreview t={t} connection={previewing} onClose={() => setPreviewing(null)} />

      <ConfirmDialog
        open={removing !== null}
        title={fmt(t.deleteTitle, { name: removing?.name ?? "" })}
        description={t.deleteBody}
        confirmLabel={t.delete}
        cancelLabel={t.cancel}
        busyLabel={t.working}
        onCancel={() => setRemoving(null)}
        onConfirm={async () => {
          if (!removing) return;
          try {
            await googleSheetsDelete(apiClient, workspaceId, removing.id);
          } catch (err) {
            throw new Error(errorMessage(err));
          }
          toast.success(fmt(t.deletedToast, { name: removing.name }));
          setRemoving(null);
          void overview.refresh({ silent: true });
        }}
      />

      <ConfirmDialog
        open={disconnecting}
        title={t.disconnectTitle}
        description={t.disconnectBody}
        confirmLabel={t.disconnect}
        cancelLabel={t.cancel}
        busyLabel={t.working}
        onCancel={() => setDisconnecting(false)}
        onConfirm={async () => {
          try {
            await googleSheetsDisconnectAccount(apiClient, workspaceId);
          } catch (err) {
            throw new Error(errorMessage(err));
          }
          toast.success(t.disconnectedToast);
          setDisconnecting(false);
          void overview.refresh({ silent: true });
        }}
      />
    </div>
  );
}

function SheetRow({
  t,
  connection,
  sandbox,
  backfillDays,
  busy,
  onEdit,
  onDelete,
  onPreview,
  onBackfill,
  onToggle,
}: {
  t: T;
  connection: SheetConnection;
  sandbox: boolean;
  backfillDays: number;
  busy: string | null;
  onEdit: () => void;
  onDelete: () => void;
  onPreview: () => void;
  onBackfill: () => void;
  onToggle: () => void;
}) {
  const kind = connection.dataType === "orders" ? t.orders : connection.dataType === "lost_orders" ? t.lost : t.leads;
  const working = busy?.startsWith(`${connection.id}:`) ?? false;
  const stopped = connection.status === "revoked" || connection.status === "error";
  const url = connection.spreadsheetUrl && /^https:\/\//.test(connection.spreadsheetUrl) ? connection.spreadsheetUrl : null;
  const g = useT(SHEETS_REAL_STRINGS);
  return (
    <li className="space-y-2 py-3 first:pt-0 last:pb-0">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="flex flex-wrap items-center gap-2 text-sm font-medium text-ink">
            <IconSheet className="size-4 shrink-0 text-ink-soft" aria-hidden />
            <span className="min-w-0 truncate">{connection.name}</span>
            <StatusBadge value={connection.status} tone={STATUS_TONE[connection.status]} text={t[connection.status]} />
          </p>
          <p className="mt-0.5 text-xs text-ink-soft">
            {[
              kind,
              fmt(t.rows, { count: connection.rowsWritten }),
              connection.lastSyncedAt ? fmt(t.lastSync, { when: formatDateTime(connection.lastSyncedAt) }) : t.never,
            ].join(" · ")}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-1">
          {url && (
            <Button size="sm" className="pointer-coarse:min-h-11" variant="ghost" asChild>
              <a href={url} target="_blank" rel="noreferrer">
                <IconExternal className="size-4" aria-hidden />
                {g.openInGoogle}
              </a>
            </Button>
          )}
          {/* The real Google adapter reads rows back too (handoff 393). */}
          {(sandbox || url !== null) && (
            <Button size="sm" className="pointer-coarse:min-h-11" variant="ghost" onClick={onPreview}>
              <IconEye className="size-4" aria-hidden />
              {t.preview}
            </Button>
          )}
          <Button size="sm" className="pointer-coarse:min-h-11" variant="ghost" disabled={working || connection.status !== "active"} title={fmt(t.backfillHint, { days: backfillDays })} onClick={onBackfill}>
            <IconRefresh className="size-4" aria-hidden />
            {t.backfill}
          </Button>
          {!stopped && (
            <Button size="sm" className="pointer-coarse:min-h-11" variant="ghost" disabled={working} onClick={onToggle}>
              {connection.status === "active" ? <IconPause className="size-4" aria-hidden /> : <IconPlay className="size-4" aria-hidden />}
              {connection.status === "active" ? t.pause : t.resume}
            </Button>
          )}
          <Button size="sm" className="pointer-coarse:min-h-11" variant="ghost" disabled={working} onClick={onEdit}>
            <IconEdit className="size-4" aria-hidden />
            {t.edit}
          </Button>
          <Button size="sm" className="pointer-coarse:min-h-11" variant="ghost" disabled={working} aria-label={`${t.delete} — ${connection.name}`} onClick={onDelete}>
            <IconDelete className="size-4 text-danger" aria-hidden />
          </Button>
        </div>
      </div>
      {stopped ? (
        <p className="text-xs text-danger">
          {connection.status === "revoked" ? (
            g.revokedRow
          ) : (
            <>
              {connection.lastError ? <bdi>{connection.lastError}</bdi> : t.missingLine}
              {" — "}
              {g.errorRow}
            </>
          )}
        </p>
      ) : (
        connection.lastError && <p className="text-xs text-ink-soft">{fmt(t.retrying, { error: connection.lastError })}</p>
      )}
    </li>
  );
}

/** The sandbox's sheet, read back: the titles and the newest rows. */
function SheetPreview({ t, connection, onClose }: { t: T; connection: SheetConnection | null; onClose: () => void }) {
  const workspaceId = useWorkspaceId();
  const open = connection !== null;
  const rows = useAsync(
    () => (connection ? googleSheetsRows(apiClient, workspaceId, connection.id) : Promise.resolve(null)),
    [workspaceId, connection?.id]
  );
  const [header, ...body] = rows.data?.rows ?? [];
  return (
    <Dialog open={open} onOpenChange={(next) => !next && onClose()}>
      <DialogContent showCloseButton={false} className="flex max-h-[90vh] flex-col gap-4 sm:max-w-5xl">
        <DialogHeader className="flex-row items-start justify-between gap-2">
          <div className="space-y-1">
            <DialogTitle>{fmt(t.previewTitle, { name: connection?.name ?? "" })}</DialogTitle>
            {rows.data && <DialogDescription>{fmt(t.previewHint, { total: rows.data.total })}</DialogDescription>}
          </div>
          <DialogClose render={<Button type="button" size="icon-sm" className="pointer-coarse:size-11" variant="ghost" aria-label={t.close} title={t.close} />}>
            <IconClose className="size-4" aria-hidden />
          </DialogClose>
        </DialogHeader>
        <div className="-mx-6 min-h-0 overflow-auto px-6">
          <SheetPreviewProblem error={rows.error} />
          <DataState
            loading={rows.loading}
            error={sheetPreviewProblem(rows.error) ? null : rows.error}
            empty={!sheetPreviewProblem(rows.error) && body.length === 0}
            emptyMessage={t.previewEmpty}
            onRetry={() => void rows.refresh()}
          >
            <table className="w-full border-collapse text-xs">
              <thead>
                <tr>
                  {(header ?? []).map((cell, i) => (
                    <th key={i} className="sticky top-0 whitespace-nowrap border border-line bg-paper px-2 py-1.5 text-start font-medium text-ink">
                      {String(cell)}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {[...body].reverse().map((row, r) => (
                  <tr key={r}>
                    {row.map((cell, i) => (
                      <td key={i} dir="auto" className="whitespace-nowrap border border-line px-2 py-1 text-ink">
                        {String(cell)}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </DataState>
        </div>
      </DialogContent>
    </Dialog>
  );
}
