import { useEffect, useState, type FormEvent } from "react";
import { Alert, Button, cn } from "@store-builder/ui";
import {
  ApiError,
  developersCreateApiKey,
  developersDeleteWebhook,
  developersListApiKeys,
  developersListWebhookDeliveries,
  developersListWebhooks,
  developersRedeliverWebhook,
  developersRevokeApiKey,
  developersRotateWebhookSecret,
  developersTestWebhook,
  developersUpdateWebhook,
  type ApiKeyDto,
  type ApiKeyScope,
  type WebhookDeliveryDto,
  type WebhookEndpointDto,
  type WebhookEventInfo,
  type WebhookFilter,
  webhooksCreateEndpoint,
} from "@store-builder/api-client";
import { apiClient, apiBaseUrl } from "@/lib/apiClient";
import { useWorkspaceId } from "@/lib/useWorkspaceId";
import { useAsync } from "@/lib/useAsync";
import { useErrorMessage } from "@/lib/errorMessages";
import { useWorkspace } from "@/context/WorkspaceContext";
import { fmt, useT, type Messages } from "@/i18n/LocaleContext";
import { AppOffNotice } from "@/components/AppOffNotice";
import { useToast } from "@/components/Toast";
import { Modal } from "@/components/Modal";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { DataState } from "@/components/DataState";
import { SettingsCard } from "./sections/SettingsCard";
import { WebhookDeliveryLog, WebhookEndpointNotes, WebhookFilterField } from "./WebhookExtras";
import { EditWebhookEndpointModal, WebhookHeadersField, WebhookHeadersNote, WebhookTopicsField, useWebhookHeaders } from "./WebhookEndpointFields";
import { AiAssistantsPanel } from "./AiAssistantsPanel";
import { ApiKeyAccessPicker, EMPTY_ACCESS, countExtraResources, scopesForAccess, type AccessMap } from "./ApiKeyAccessPicker";
import { TextField } from "@/components/Field";
import { StatusBadge } from "@/components/StatusBadge";
import { AutomationBadge } from "./AutomationBadge";
import { WebhookAppBadge, WebhookAppRemovedNote, webhookAppRemoved } from "./WebhookAppBits";

/**
 * Settings → Developers: the API keys and webhook endpoints a merchant hands
 * to whoever connects their store to another system — a fulfilment partner, a
 * warehouse, a call centre. The integration itself is documented for that
 * developer in the backend's docs/public-api.md.
 *
 * Only the Owner and Workspace Manager roles carry api_keys.manage and
 * webhooks.manage (SYSTEM_ROLES in the backend's permissions.js); the
 * dashboard only sees the role key, so everyone else gets a note instead of
 * controls, and a 403 from the server turns the controls off too.
 *
 * The two secrets — a key, a signing secret — are shown exactly once, in a
 * box with a copy button, straight from the answer that created them. Nothing
 * here stores them or can show them again.
 */
const MANAGER_ROLES: ReadonlySet<string> = new Set(["owner", "workspace_manager"]);

/** Whether this role manages the keys, the webhooks and the AI assistants (the same set the section itself checks). */
export function canManageDevelopers(role: string | null | undefined): boolean {
  return MANAGER_ROLES.has(role ?? "");
}

const STRINGS = {
  en: {
    title: "Developers",
    description:
      "Connect your store to another system — a fulfilment partner, a warehouse, a call centre. It receives your orders as they change and sends their statuses back.",
    readOnly: "Only the store owner or a workspace manager can manage API keys and webhooks.",
    // API keys
    keysTitle: "API keys",
    keysHint: "A key lets another system read your orders and update their status. It acts with the role of the teammate who creates it.",
    newKey: "New API key",
    noKeys: "No API keys yet.",
    keyName: "Name",
    keyNameHint: "Who or what uses it, e.g. “Sharks fulfilment”.",
    access: "Access",
    readOnlyAccess: "Read orders",
    readOnlyAccessHint: "See orders and their shipments. Changes nothing.",
    readWriteAccess: "Read and update orders",
    readWriteAccessHint: "Also confirm, cancel, ship, deliver and mark COD cash collected.",
    create: "Create",
    creating: "Creating…",
    cancel: "Cancel",
    done: "Done",
    keyCreatedTitle: "Copy your API key",
    keyCreatedBody: "This is the only time the key is shown. Store it somewhere safe and give it to the developer — if it's lost, revoke it and create another.",
    copy: "Copy",
    copied: "Copied",
    revoke: "Revoke",
    revoked: "Revoked",
    revokeTitle: "Revoke this key?",
    revokeBody: "“{name}” stops working immediately, and anything using it loses access. This can't be undone.",
    revoking: "Revoking…",
    keyRevoked: "API key revoked.",
    lastUsed: "Last used {when}",
    neverUsed: "Never used",
    createdBy: "Created by {name}",
    scopeRead: "read",
    scopeWrite: "write",
    scopeMore: "+{count} more",
    apiDocs: "API reference",
    // Webhooks
    hooksTitle: "Webhooks",
    hooksHint: "We send a signed request to your URL within seconds of a new order or any status change — confirmation, payment, shipping, delivery.",
    addEndpoint: "Add endpoint",
    noEndpoints: "No webhook endpoints yet.",
    url: "Endpoint URL",
    urlHint: "Must start with https://",
    allEvents: "All events",
    needEvents: "Choose at least one event.",
    endpointCreatedTitle: "Copy your signing secret",
    endpointCreatedBody: "Your server uses it to check each request really came from us. It's shown only now and when you rotate it.",
    active: "Active",
    paused: "Paused",
    pause: "Pause",
    resume: "Resume",
    edit: "Edit",
    sendTest: "Send test",
    testing: "Sending…",
    testDelivered: "Test delivered — your server answered {status}.",
    testFailed: "Test not delivered: {error}",
    deliveries: "Deliveries",
    rotate: "Rotate secret",
    rotateTitle: "Rotate the signing secret?",
    rotateBody: "The current secret stops working immediately. Update your server with the new one right after.",
    rotating: "Rotating…",
    remove: "Delete",
    removeTitle: "Delete this endpoint?",
    removeBody: "We stop sending to {url}, and its delivery history is deleted.",
    removing: "Deleting…",
    endpointRemoved: "Endpoint deleted.",
    // Deliveries
    deliveriesTitle: "Deliveries",
    deliveriesHint: "The latest 50. Failed deliveries are retried for about two days; redeliver sends one again now.",
    noDeliveries: "Nothing sent yet.",
    attempts: "{count} attempts",
    answered: "Answered {status}",
    nextTry: "Next try {when}",
    redeliver: "Redeliver",
    redelivering: "Sending…",
    payload: "Payload",
    close: "Close",
    status_pending: "Pending",
    status_delivered: "Delivered",
    status_failed: "Retrying",
    status_exhausted: "Gave up",
    // The status word a badge shows after its caption.
    badge_revoked: "Revoked",
    badge_active: "Active",
    badge_inactive: "Inactive",
    badge_pending: "Pending",
    badge_delivered: "Delivered",
    badge_failed: "Failed",
    badge_exhausted: "Exhausted",
  },
  ar: {
    title: "المطوّرين",
    description:
      "اربط متجرك بسيستم تاني — شركة فولفيلمنت، مخزن، كول سنتر. بيوصله أوردراتك أول ما تتغير، وبيرجّع حالتها.",
    readOnly: "صاحب المتجر أو مدير المتجر بس هو اللي يقدر يدير مفاتيح الـ API والويب هوكس.",
    keysTitle: "مفاتيح الـ API",
    keysHint: "المفتاح بيخلّي سيستم تاني يقرأ أوردراتك ويحدّث حالتها. وبيشتغل بصلاحيات الشخص اللي عمله.",
    newKey: "مفتاح جديد",
    noKeys: "مفيش مفاتيح لسه.",
    keyName: "الاسم",
    keyNameHint: "مين أو إيه اللي هيستخدمه، مثلاً «شاركس فولفيلمنت».",
    access: "الصلاحية",
    readOnlyAccess: "قراءة الأوردرات",
    readOnlyAccessHint: "يشوف الأوردرات وشحناتها. مابيغيّرش حاجة.",
    readWriteAccess: "قراءة وتحديث الأوردرات",
    readWriteAccessHint: "وكمان يأكد ويلغي ويشحن ويسلّم ويسجل تحصيل الكاش.",
    create: "إنشاء",
    creating: "بيتعمل…",
    cancel: "إلغاء",
    done: "تمام",
    keyCreatedTitle: "انسخ المفتاح",
    keyCreatedBody: "دي المرة الوحيدة اللي المفتاح هيظهر فيها. احفظه في مكان آمن وابعته للمبرمج — لو ضاع، الغيه واعمل واحد جديد.",
    copy: "نسخ",
    copied: "اتنسخ",
    revoke: "إلغاء المفتاح",
    revoked: "ملغي",
    revokeTitle: "تلغي المفتاح ده؟",
    revokeBody: "«{name}» هيبطّل يشتغل فوراً، وأي سيستم بيستخدمه هيتقفل. مينفعش ترجع فيها.",
    revoking: "بيتلغي…",
    keyRevoked: "المفتاح اتلغى.",
    lastUsed: "آخر استخدام {when}",
    neverUsed: "لسه ماتستخدمش",
    createdBy: "عمله {name}",
    scopeRead: "قراءة",
    scopeWrite: "تحديث",
    scopeMore: "+{count} أنواع بيانات",
    apiDocs: "توثيق الـ API",
    hooksTitle: "الويب هوكس",
    hooksHint: "بنبعت طلب موقّع للرابط بتاعك في خلال ثواني من أي أوردر جديد أو أي تغيير في حالته — تأكيد، دفع، شحن، تسليم.",
    addEndpoint: "إضافة رابط",
    noEndpoints: "مفيش روابط ويب هوك لسه.",
    url: "الرابط",
    urlHint: "لازم يبدأ بـ https://",
    allEvents: "كل الأحداث",
    needEvents: "اختار حدث واحد على الأقل.",
    endpointCreatedTitle: "انسخ مفتاح التوقيع",
    endpointCreatedBody: "السيرفر بتاعك بيستخدمه عشان يتأكد إن كل طلب جاي مننا فعلاً. بيظهر دلوقتي بس، ولما تغيّره.",
    active: "شغال",
    paused: "متوقف",
    pause: "إيقاف",
    resume: "تشغيل",
    edit: "تعديل",
    sendTest: "إرسال تجربة",
    testing: "بيتبعت…",
    testDelivered: "التجربة وصلت — السيرفر رد بـ {status}.",
    testFailed: "التجربة موصلتش: {error}",
    deliveries: "سجل الإرسال",
    rotate: "تغيير مفتاح التوقيع",
    rotateTitle: "تغيّر مفتاح التوقيع؟",
    rotateBody: "المفتاح الحالي هيبطّل يشتغل فوراً. حدّث السيرفر بتاعك بالجديد على طول.",
    rotating: "بيتغير…",
    remove: "حذف",
    removeTitle: "تحذف الرابط ده؟",
    removeBody: "هنبطّل نبعت لـ {url}، وسجل الإرسال بتاعه هيتمسح.",
    removing: "بيتحذف…",
    endpointRemoved: "الرابط اتحذف.",
    deliveriesTitle: "سجل الإرسال",
    deliveriesHint: "آخر ٥٠. اللي مابيوصلش بنعيد إرساله لحد يومين تقريباً، و«إعادة الإرسال» بتبعته تاني دلوقتي.",
    noDeliveries: "مفيش حاجة اتبعتت لسه.",
    attempts: "{count} محاولات",
    answered: "رد بـ {status}",
    nextTry: "المحاولة الجاية {when}",
    redeliver: "إعادة الإرسال",
    redelivering: "بيتبعت…",
    payload: "المحتوى",
    close: "إغلاق",
    status_pending: "في الانتظار",
    status_delivered: "وصل",
    status_failed: "بيتعاد",
    status_exhausted: "وقفنا المحاولة",
    badge_revoked: "ملغي",
    badge_active: "شغال",
    badge_inactive: "متوقف",
    badge_pending: "في الانتظار",
    badge_delivered: "وصل",
    badge_failed: "فشل",
    badge_exhausted: "المحاولات خلصت",
  },
} satisfies Messages;

type T = (typeof STRINGS)["en"];

const when = (iso: string) => new Date(iso).toLocaleString();

const DELIVERY_TONE = { pending: "warning", delivered: "success", failed: "warning", exhausted: "danger" } as const;

/**
 * `part`: "all" is the whole block as it always was (keys, AI assistants,
 * webhooks); "api" is the keys and the webhooks; "ai" is the AI assistants
 * alone. The role gate is the same for every part.
 */
export function DevelopersSection({ part = "all" }: { part?: "all" | "api" | "ai" }) {
  const t = useT(STRINGS);
  const { currentWorkspace } = useWorkspace();
  const [forbidden, setForbidden] = useState(false);
  // Bumped when the AI assistants panel creates a key, so the keys list shows it.
  const [keysReload, setKeysReload] = useState(0);
  const canManage = MANAGER_ROLES.has(currentWorkspace?.role ?? "") && !forbidden;

  return (
    <>
      {part !== "ai" && (
        <div className="empty:hidden">
          <AppOffNotice app="public_api" />
          <AppOffNotice app="webhooks" />
        </div>
      )}
      {canManage ? (
        <>
          {part !== "ai" && (
            <SettingsCard>
              <ApiKeysPanel t={t} reload={keysReload} onForbidden={() => setForbidden(true)} />
            </SettingsCard>
          )}
          {part !== "api" && (
            <SettingsCard>
              <AiAssistantsPanel onKeyCreated={() => setKeysReload((n) => n + 1)} />
            </SettingsCard>
          )}
          {part !== "ai" && (
            <SettingsCard>
              <WebhooksPanel t={t} onForbidden={() => setForbidden(true)} />
            </SettingsCard>
          )}
        </>
      ) : (
        <Alert>{t.readOnly}</Alert>
      )}
    </>
  );
}

/** A secret shown once, with a copy button. */
function SecretBox({ t, value }: { t: T; value: string }) {
  const [copied, setCopied] = useState(false);
  async function copy() {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
    } catch {
      // No clipboard permission: the text is selectable, so it can still be copied by hand.
    }
  }
  return (
    <div className="flex items-center gap-2 rounded-md border border-line bg-paper p-2">
      <code dir="ltr" className="min-w-0 flex-1 select-all break-all font-mono text-xs text-ink" data-testid="secret-value">
        {value}
      </code>
      <Button size="sm" variant="outline" className="min-h-11 sm:min-h-8" onClick={copy}>
        {copied ? t.copied : t.copy}
      </Button>
    </div>
  );
}

// ---------------------------------------------------------------------
// API keys
// ---------------------------------------------------------------------

function ApiKeysPanel({ t, reload, onForbidden }: { t: T; reload: number; onForbidden: () => void }) {
  const workspaceId = useWorkspaceId();
  const toast = useToast();
  const errorMessage = useErrorMessage();
  const keys = useAsync(async () => {
    try {
      return (await developersListApiKeys(apiClient, workspaceId)).apiKeys;
    } catch (err) {
      if (err instanceof ApiError && err.status === 403) onForbidden();
      throw err;
    }
  }, [workspaceId]);
  const [creating, setCreating] = useState(false);
  const [revoking, setRevoking] = useState<ApiKeyDto | null>(null);
  useEffect(() => {
    if (reload > 0) void keys.refresh({ silent: true });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [reload]);

  return (
    <div>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <h3 className="font-medium text-ink">{t.keysTitle}</h3>
          <p className="text-sm text-ink-soft">
            {t.keysHint}{" "}
            <a
              href={`${apiBaseUrl.replace(/\/api\/v\d+\/?$/, "")}/public-docs`}
              target="_blank"
              rel="noreferrer"
              className="font-medium text-primary hover:underline"
            >
              {t.apiDocs}
            </a>
          </p>
        </div>
        <Button className="min-h-11 sm:min-h-9" onClick={() => setCreating(true)}>{t.newKey}</Button>
      </div>

      <div className="mt-3">
        <DataState
          loading={keys.loading}
          error={keys.error}
          empty={(keys.data ?? []).length === 0}
          emptyMessage={t.noKeys}
          onRetry={() => void keys.refresh()}
        >
          <ul className="divide-y divide-line rounded-md border border-line">
            {(keys.data ?? []).map((key) => (
              <li key={key.id} className={cn("flex flex-wrap items-center gap-3 p-3", key.revokedAt && "opacity-60")}>
                <div className="min-w-0 flex-1">
                  <p className="font-medium text-ink">{key.name}</p>
                  <p className="text-xs text-ink-soft">
                    <code dir="ltr" className="font-mono">
                      {key.keyPrefix}…
                    </code>
                    {" · "}
                    {key.scopes.some((s) => s.startsWith("orders:") && s !== "orders:read") ? `${t.scopeRead} + ${t.scopeWrite}` : t.scopeRead}
                    {countExtraResources(key.scopes) > 0 && (
                      <span title={key.scopes.join(", ")}> {fmt(t.scopeMore, { count: countExtraResources(key.scopes) })}</span>
                    )}
                    {" · "}
                    {key.lastUsedAt ? fmt(t.lastUsed, { when: when(key.lastUsedAt) }) : t.neverUsed}
                    {key.createdBy.fullName ? ` · ${fmt(t.createdBy, { name: key.createdBy.fullName })}` : ""}
                  </p>
                </div>
                {key.revokedAt ? (
                  <StatusBadge value="revoked" tone="neutral" label={t.revoked} text={t.badge_revoked} />
                ) : (
                  <Button size="sm" variant="outline" className="min-h-11 sm:min-h-8" onClick={() => setRevoking(key)}>
                    {t.revoke}
                  </Button>
                )}
              </li>
            ))}
          </ul>
        </DataState>
      </div>

      <NewKeyModal
        t={t}
        open={creating}
        onClose={() => setCreating(false)}
        onCreated={() => void keys.refresh({ silent: true })}
      />

      <ConfirmDialog
        open={revoking !== null}
        title={t.revokeTitle}
        description={revoking ? fmt(t.revokeBody, { name: revoking.name }) : undefined}
        confirmLabel={t.revoke}
        cancelLabel={t.cancel}
        busyLabel={t.revoking}
        destructive
        onCancel={() => setRevoking(null)}
        onConfirm={async () => {
          if (!revoking) return;
          try {
            await developersRevokeApiKey(apiClient, workspaceId, revoking.id);
          } catch (err) {
            throw new Error(errorMessage(err));
          }
          setRevoking(null);
          toast.success(t.keyRevoked);
          void keys.refresh({ silent: true });
        }}
      />
    </div>
  );
}

function NewKeyModal({ t, open, onClose, onCreated }: { t: T; open: boolean; onClose: () => void; onCreated: () => void }) {
  const workspaceId = useWorkspaceId();
  const errorMessage = useErrorMessage();
  const [name, setName] = useState("");
  const [write, setWrite] = useState(true);
  const [access, setAccess] = useState<AccessMap>(EMPTY_ACCESS);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [secret, setSecret] = useState<string | null>(null);

  function close() {
    setName("");
    setWrite(true);
    setAccess(EMPTY_ACCESS);
    setError(null);
    setSecret(null);
    onClose();
  }

  async function submit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const scopes: ApiKeyScope[] = [...(write ? (["orders:read", "orders:write"] as ApiKeyScope[]) : (["orders:read"] as ApiKeyScope[])), ...scopesForAccess(access)];
      const created = await developersCreateApiKey(apiClient, workspaceId, { name: name.trim(), scopes });
      setSecret(created.secret);
      onCreated();
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  if (secret) {
    return (
      <Modal open={open} onClose={close} title={t.keyCreatedTitle} footer={<Button onClick={close}>{t.done}</Button>}>
        <p className="mb-3 text-sm text-ink-soft">{t.keyCreatedBody}</p>
        <SecretBox t={t} value={secret} />
      </Modal>
    );
  }

  return (
    <Modal open={open} onClose={close} title={t.newKey}>
      <form onSubmit={submit} className="space-y-4">
        <TextField
          label={t.keyName}
          hint={t.keyNameHint}
          value={name}
          maxLength={150}
          required
          onChange={(e) => setName(e.target.value)}
        />
        <fieldset className="space-y-2">
          <legend className="mb-1 text-sm font-medium text-ink">{t.access}</legend>
          {[
            { value: false, label: t.readOnlyAccess, hint: t.readOnlyAccessHint },
            { value: true, label: t.readWriteAccess, hint: t.readWriteAccessHint },
          ].map((option) => (
            <label key={String(option.value)} className="flex cursor-pointer items-start gap-2 rounded-md border border-line p-3">
              <input
                type="radio"
                name="api-key-access"
                className="mt-1"
                checked={write === option.value}
                onChange={() => setWrite(option.value)}
              />
              <span>
                <span className="block text-sm font-medium text-ink">{option.label}</span>
                <span className="block text-xs text-ink-soft">{option.hint}</span>
              </span>
            </label>
          ))}
        </fieldset>
        <ApiKeyAccessPicker value={access} onChange={setAccess} />
        {error && <Alert variant="danger">{error}</Alert>}
        <div className="flex justify-end gap-2">
          <Button type="button" variant="outline" onClick={close} disabled={busy}>
            {t.cancel}
          </Button>
          <Button type="submit" disabled={busy || name.trim() === ""}>
            {busy ? t.creating : t.create}
          </Button>
        </div>
      </form>
    </Modal>
  );
}

// ---------------------------------------------------------------------
// Webhooks
// ---------------------------------------------------------------------

function WebhooksPanel({ t, onForbidden }: { t: T; onForbidden: () => void }) {
  const workspaceId = useWorkspaceId();
  const toast = useToast();
  const errorMessage = useErrorMessage();
  const hooks = useAsync(async () => {
    try {
      return await developersListWebhooks(apiClient, workspaceId);
    } catch (err) {
      if (err instanceof ApiError && err.status === 403) onForbidden();
      throw err;
    }
  }, [workspaceId]);
  const [adding, setAdding] = useState(false);
  const [testing, setTesting] = useState<string | null>(null);
  const [rotating, setRotating] = useState<WebhookEndpointDto | null>(null);
  const [rotatedSecret, setRotatedSecret] = useState<string | null>(null);
  const [removing, setRemoving] = useState<WebhookEndpointDto | null>(null);
  const [history, setHistory] = useState<WebhookEndpointDto | null>(null);
  const [editing, setEditing] = useState<WebhookEndpointDto | null>(null);

  const endpoints = hooks.data?.endpoints ?? [];
  const eventLabel = (events: string[]) => (events.includes("*") ? t.allEvents : events.join(", "));

  async function sendTest(endpoint: WebhookEndpointDto) {
    setTesting(endpoint.id);
    try {
      const delivery = await developersTestWebhook(apiClient, workspaceId, endpoint.id);
      if (delivery.status === "delivered") {
        toast.success(fmt(t.testDelivered, { status: String(delivery.lastResponseStatus) }));
      } else {
        toast.error(fmt(t.testFailed, { error: delivery.lastError ?? String(delivery.lastResponseStatus) }));
      }
    } catch (err) {
      toast.error(errorMessage(err));
    } finally {
      setTesting(null);
    }
  }

  async function setActive(endpoint: WebhookEndpointDto, isActive: boolean) {
    try {
      await developersUpdateWebhook(apiClient, workspaceId, endpoint.id, { isActive });
      void hooks.refresh({ silent: true });
    } catch (err) {
      toast.error(errorMessage(err));
    }
  }

  return (
    <div>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <h3 className="font-medium text-ink">{t.hooksTitle}</h3>
          <p className="text-sm text-ink-soft">{t.hooksHint}</p>
        </div>
        <Button className="min-h-11 sm:min-h-9" onClick={() => setAdding(true)}>{t.addEndpoint}</Button>
      </div>

      <div className="mt-3">
        <DataState
          loading={hooks.loading}
          error={hooks.error}
          empty={endpoints.length === 0}
          emptyMessage={t.noEndpoints}
          onRetry={() => void hooks.refresh()}
        >
          <ul className="divide-y divide-line rounded-md border border-line">
            {endpoints.map((endpoint) => (
              <li key={endpoint.id} className="space-y-2 p-3">
                <div className="flex flex-wrap items-center gap-2">
                  <code dir="ltr" className="min-w-0 flex-1 break-all font-mono text-sm text-ink">
                    {endpoint.url}
                  </code>
                  <AutomationBadge url={endpoint.url} />
                  <WebhookAppBadge endpoint={endpoint} />
                  <StatusBadge
                    value={endpoint.isActive ? "active" : "inactive"}
                    label={endpoint.isActive ? t.active : t.paused}
                    text={endpoint.isActive ? t.badge_active : t.badge_inactive}
                  />
                </div>
                <p className="text-xs text-ink-soft">
                  {eventLabel(endpoint.events)} ·{" "}
                  <code dir="ltr" className="font-mono">
                    {endpoint.secretHint}
                  </code>
                </p>
                <WebhookHeadersNote endpoint={endpoint} />
                <WebhookEndpointNotes endpoint={endpoint} />
                <WebhookAppRemovedNote endpoint={endpoint} />
                <div className="flex flex-wrap gap-2">
                  <Button size="sm" variant="outline" className="min-h-11 sm:min-h-8" onClick={() => setEditing(endpoint)}>
                    {t.edit}
                  </Button>
                  <Button size="sm" variant="outline" className="min-h-11 sm:min-h-8" disabled={testing === endpoint.id} onClick={() => sendTest(endpoint)}>
                    {testing === endpoint.id ? t.testing : t.sendTest}
                  </Button>
                  <Button size="sm" variant="outline" className="min-h-11 sm:min-h-8" onClick={() => setHistory(endpoint)}>
                    {t.deliveries}
                  </Button>
                  {/* An endpoint whose app was removed can't be switched back on (handoff 266). */}
                  {!webhookAppRemoved(endpoint) && (
                    <Button size="sm" variant="outline" className="min-h-11 sm:min-h-8" onClick={() => setActive(endpoint, !endpoint.isActive)}>
                      {endpoint.isActive ? t.pause : t.resume}
                    </Button>
                  )}
                  <Button size="sm" variant="ghost" className="min-h-11 sm:min-h-8" onClick={() => setRotating(endpoint)}>
                    {t.rotate}
                  </Button>
                  <Button size="sm" variant="ghost" className="min-h-11 sm:min-h-8" onClick={() => setRemoving(endpoint)}>
                    {t.remove}
                  </Button>
                </div>
              </li>
            ))}
          </ul>
        </DataState>
      </div>

      {endpoints.length > 0 && <WebhookDeliveryLog />}

      <NewEndpointModal
        t={t}
        open={adding}
        events={hooks.data?.events ?? []}
        onClose={() => setAdding(false)}
        onCreated={() => void hooks.refresh({ silent: true })}
      />

      <ConfirmDialog
        open={rotating !== null}
        title={t.rotateTitle}
        description={t.rotateBody}
        confirmLabel={t.rotate}
        cancelLabel={t.cancel}
        busyLabel={t.rotating}
        onCancel={() => setRotating(null)}
        onConfirm={async () => {
          if (!rotating) return;
          try {
            const { signingSecret } = await developersRotateWebhookSecret(apiClient, workspaceId, rotating.id);
            setRotatedSecret(signingSecret);
          } catch (err) {
            throw new Error(errorMessage(err));
          }
          setRotating(null);
          void hooks.refresh({ silent: true });
        }}
      />

      <Modal
        open={rotatedSecret !== null}
        onClose={() => setRotatedSecret(null)}
        title={t.endpointCreatedTitle}
        footer={<Button onClick={() => setRotatedSecret(null)}>{t.done}</Button>}
      >
        <p className="mb-3 text-sm text-ink-soft">{t.endpointCreatedBody}</p>
        {rotatedSecret && <SecretBox t={t} value={rotatedSecret} />}
      </Modal>

      <ConfirmDialog
        open={removing !== null}
        title={t.removeTitle}
        description={removing ? fmt(t.removeBody, { url: removing.url }) : undefined}
        confirmLabel={t.remove}
        cancelLabel={t.cancel}
        busyLabel={t.removing}
        destructive
        onCancel={() => setRemoving(null)}
        onConfirm={async () => {
          if (!removing) return;
          try {
            await developersDeleteWebhook(apiClient, workspaceId, removing.id);
          } catch (err) {
            throw new Error(errorMessage(err));
          }
          setRemoving(null);
          toast.success(t.endpointRemoved);
          void hooks.refresh({ silent: true });
        }}
      />

      {history && <DeliveriesModal t={t} endpoint={history} onClose={() => setHistory(null)} />}

      {editing && (
        <EditWebhookEndpointModal
          endpoint={editing}
          events={hooks.data?.events ?? []}
          onClose={() => setEditing(null)}
          onSaved={() => {
            setEditing(null);
            void hooks.refresh({ silent: true });
          }}
        />
      )}
    </div>
  );
}

function NewEndpointModal({
  t,
  open,
  events,
  onClose,
  onCreated,
}: {
  t: T;
  open: boolean;
  events: WebhookEventInfo[];
  onClose: () => void;
  onCreated: () => void;
}) {
  const workspaceId = useWorkspaceId();
  const errorMessage = useErrorMessage();
  const [url, setUrl] = useState("");
  const [all, setAll] = useState(true);
  const [picked, setPicked] = useState<string[]>([]);
  const [filter, setFilter] = useState<WebhookFilter | null>(null);
  const headers = useWebhookHeaders();
  const [eventsError, setEventsError] = useState<string | undefined>();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [secret, setSecret] = useState<string | null>(null);

  function close() {
    setUrl("");
    setAll(true);
    setPicked([]);
    setFilter(null);
    headers.reset();
    setEventsError(undefined);
    setError(null);
    setSecret(null);
    onClose();
  }

  async function submit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    const noEvents = !all && picked.length === 0;
    setEventsError(noEvents ? t.needEvents : undefined);
    const customHeaders = headers.build();
    if (noEvents || !customHeaders) return;
    setBusy(true);
    try {
      const created = await webhooksCreateEndpoint(apiClient, workspaceId, {
        url: url.trim(),
        events: all ? ["*"] : picked,
        ...(filter ? { filter } : {}),
        ...(customHeaders.length > 0 ? { customHeaders } : {}),
      });
      setSecret(created.signingSecret);
      onCreated();
    } catch (err) {
      headers.fromServer(err);
      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  if (secret) {
    return (
      <Modal open={open} onClose={close} title={t.endpointCreatedTitle} footer={<Button onClick={close}>{t.done}</Button>}>
        <p className="mb-3 text-sm text-ink-soft">{t.endpointCreatedBody}</p>
        <SecretBox t={t} value={secret} />
      </Modal>
    );
  }

  return (
    <Modal open={open} onClose={close} title={t.addEndpoint} className="max-w-2xl">
      <form onSubmit={submit} className="space-y-5">
        <TextField
          label={t.url}
          hint={t.urlHint}
          type="url"
          dir="ltr"
          placeholder="https://"
          value={url}
          required
          onChange={(e) => setUrl(e.target.value)}
        />
        <WebhookTopicsField
          events={events}
          all={all}
          picked={picked}
          onAllChange={setAll}
          onPickedChange={(next) => {
            setPicked(next);
            if (next.length > 0) setEventsError(undefined);
          }}
          error={eventsError}
        />
        <WebhookFilterField value={filter} onChange={setFilter} />
        <WebhookHeadersField rows={headers.rows} errors={headers.errors} onChange={headers.setRows} onErrorsChange={headers.setErrors} />
        {error && <Alert variant="danger">{error}</Alert>}
        <div className="flex justify-end gap-2">
          <Button type="button" variant="outline" onClick={close} disabled={busy}>
            {t.cancel}
          </Button>
          <Button type="submit" disabled={busy || url.trim() === ""}>
            {busy ? t.creating : t.create}
          </Button>
        </div>
      </form>
    </Modal>
  );
}

function DeliveriesModal({ t, endpoint, onClose }: { t: T; endpoint: WebhookEndpointDto; onClose: () => void }) {
  const workspaceId = useWorkspaceId();
  const toast = useToast();
  const errorMessage = useErrorMessage();
  const deliveries = useAsync(
    () => developersListWebhookDeliveries(apiClient, workspaceId, endpoint.id, { limit: 50 }),
    [workspaceId, endpoint.id]
  );
  const [sending, setSending] = useState<string | null>(null);

  async function redeliver(delivery: WebhookDeliveryDto) {
    setSending(delivery.id);
    try {
      const result = await developersRedeliverWebhook(apiClient, workspaceId, endpoint.id, delivery.id);
      deliveries.setData((prev) => (prev ?? []).map((d) => (d.id === result.id ? result : d)));
    } catch (err) {
      toast.error(errorMessage(err));
    } finally {
      setSending(null);
    }
  }

  return (
    <Modal
      open
      onClose={onClose}
      title={t.deliveriesTitle}
      description={t.deliveriesHint}
      className="max-w-2xl"
      footer={
        <Button variant="outline" onClick={onClose}>
          {t.close}
        </Button>
      }
    >
      <DataState
        loading={deliveries.loading}
        error={deliveries.error}
        empty={(deliveries.data ?? []).length === 0}
        emptyMessage={t.noDeliveries}
        onRetry={() => void deliveries.refresh()}
      >
        <ul className="divide-y divide-line">
          {(deliveries.data ?? []).map((delivery) => (
            <li key={delivery.id} className="space-y-1 py-3">
              <div className="flex flex-wrap items-center gap-2">
                <code dir="ltr" className="font-mono text-sm text-ink">
                  {delivery.eventType}
                </code>
                <StatusBadge
                  value={delivery.status}
                  tone={DELIVERY_TONE[delivery.status]}
                  label={t[`status_${delivery.status}`]}
                  text={t[`badge_${delivery.status}`]}
                />
                <span className="ms-auto text-xs text-ink-soft">{when(delivery.createdAt)}</span>
              </div>
              <p className="text-xs text-ink-soft">
                {fmt(t.attempts, { count: delivery.attemptCount })}
                {delivery.lastResponseStatus !== null && ` · ${fmt(t.answered, { status: delivery.lastResponseStatus })}`}
                {delivery.lastError && ` · ${delivery.lastError}`}
                {delivery.nextAttemptAt && delivery.status === "failed" && ` · ${fmt(t.nextTry, { when: when(delivery.nextAttemptAt) })}`}
              </p>
              <div className="flex flex-wrap items-center gap-2">
                <details className="min-w-0 flex-1 text-xs">
                  <summary className="cursor-pointer text-ink-soft">{t.payload}</summary>
                  <pre dir="ltr" className="mt-1 max-h-60 overflow-auto rounded bg-paper p-2 font-mono text-[11px] text-ink">
                    {JSON.stringify(delivery.payload, null, 2)}
                  </pre>
                </details>
                {delivery.status !== "delivered" && (
                  <Button size="sm" variant="outline" className="min-h-11 sm:min-h-8" disabled={sending === delivery.id} onClick={() => redeliver(delivery)}>
                    {sending === delivery.id ? t.redelivering : t.redeliver}
                  </Button>
                )}
              </div>
            </li>
          ))}
        </ul>
      </DataState>
    </Modal>
  );
}
