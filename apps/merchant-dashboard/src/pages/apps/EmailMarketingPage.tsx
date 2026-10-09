import { useEffect, useId, useRef, useState, type FormEvent, type KeyboardEvent } from "react";
import { Link } from "react-router-dom";
import { IconClose, IconEmail, IconRefresh, IconShield } from "@/components/icons";
import { Button, Card, Input, Spinner, cn } from "@store-builder/ui";
import {
  apiErrorCode,
  appsInstall,
  appsList,
  emailMarketingConnect,
  emailMarketingDisconnect,
  emailMarketingLists,
  emailMarketingProviders,
  emailMarketingSaveSettings,
  emailMarketingSync,
  EMAIL_MARKETING_MAX_TAGS,
  EMAIL_MARKETING_TAG_MAX_LENGTH,
  ApiError,
  type AppDto,
  type EmailMarketingProvider,
  type EmailMarketingSource,
} from "@store-builder/api-client";
import { apiClient } from "@/lib/apiClient";
import { useWorkspaceId } from "@/lib/useWorkspaceId";
import { useAsync } from "@/lib/useAsync";
import { useErrorMessage } from "@/lib/errorMessages";
import { formatDateTime } from "@/lib/format";
import { formatCount } from "@/lib/analytics";
import { fmt, useLocale, useT, type Messages } from "@/i18n/LocaleContext";
import { useToast } from "@/components/Toast";
import { PageHeader } from "@/components/PageHeader";
import { DataState } from "@/components/DataState";
import { EmptyState } from "@/components/EmptyState";
import { StatusBadge } from "@/components/StatusBadge";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { SaveBar } from "@/components/SaveBar";
import { UnsavedGuardProvider, useReportDirty } from "@/lib/useUnsavedGuard";
import { ProviderLogo } from "@/components/ProviderLogo";
import { TextField } from "@/components/Field";
import { Select } from "@/components/Select";

/*
 * Apps → Email marketing (frontend-handoff 182): contacts who agreed to
 * marketing go to a Mailchimp audience or a Klaviyo list. One card per
 * service: connect with its API key, pick a list, tags and which contacts,
 * then "Sync now" sends everyone already in the store; new or changed
 * contacts go by themselves. Mailchimp and Klaviyo are app-store apps and
 * must be installed first; the test service needs no install.
 */

const STRINGS = {
  en: {
    title: "Email marketing",
    description: "Send contacts who agreed to marketing to your list",
    back: "Apps",
    test: "Test",
    notConnected: "Not connected",
    connectedAs: "Connected as {name}",
    about_mailchimp: "An audience in your Mailchimp account, with tags.",
    about_klaviyo: "A list in your Klaviyo account.",
    about_sandbox: "A pretend list to try the flow without a real account.",
    help_mailchimp: "Where to find it: in Mailchimp open {path}, and copy the whole key — it ends in your data centre, like {dc}.",
    help_klaviyo: "Where to find it: in Klaviyo open {path}, with full access to {scopes}.",
    help_sandbox: "Any key works here except “invalid”, which shows what a refused key looks like.",
    connect: "Connect",
    connecting: "Connecting…",
    connectedToast: "{name} is connected.",
    installTitle: "Install {name} first",
    installBody: "{name} is an app in the app store. Install it, then come back here to connect your account.",
    installFree: "It's free.",
    install: "Install {name}",
    installing: "Installing…",
    installedToast: "{name} is installed. Connect your account below.",
    appStore: "Open the app store",
    appOff: "{name} is uninstalled, so nothing is sent to it until you install it again. Your list and tags are kept.",
    appNotInstalled: "{name} isn't installed. Install it first, then connect.",
    mailchimpKey: "A Mailchimp API key ends in its data centre (like us21). Copy the whole key, to the end.",
    list: "List",
    pickList: "Pick a list",
    loadingLists: "Loading your lists…",
    listsFailed: "We couldn't load your lists.",
    retry: "Try again",
    noLists: "Your account has no list yet. Create one in {name}, then try again.",
    members: "{name} ({n})",
    tags: "Tags added to each contact",
    tagPlaceholder: "Type a tag",
    addTag: "Add",
    removeTag: "Remove tag {tag}",
    tagsHint: "Enter or a comma adds it. Up to {n} tags.",
    tagsHint_mailchimp: "Mailchimp also gets each contact's own tags.",
    tagsHint_klaviyo: "Klaviyo gets them in the profile property zimos_tags.",
    who: "Which contacts",
    leads: "Leads (no order yet)",
    buyers: "Buyers",
    pickOne: "Pick at least one.",
    save: "Save",
    saving: "Saving…",
    savedToast: "Saved.",
    syncNow: "Sync now",
    syncStarting: "Starting…",
    syncingNow: "Sending your contacts now…",
    lastSync: "Last synced {time} — {n} contacts",
    neverSynced: "Not synced yet. New contacts go by themselves; Sync now also sends the ones you already have.",
    pickListFirst: "Pick a list first",
    saveListFirst: "Save the list first",
    syncStartedToast: "Sync started. It runs in the background.",
    syncDoneToast: "Sync finished: {n} contacts sent.",
    lastErrorTitle: "The last send to {name} was refused",
    lastError_key: "The service refused the API key — it may have been revoked. Connect again with a new key.",
    lastError_list: "The list you picked isn't in your account anymore. Pick another one.",
    lastError_reach: "We couldn't reach the service last time. New contacts are tried again by themselves.",
    serviceReply: "Its reply: {message}",
    changeKey: "Change key",
    cancelChange: "Keep the current key",
    disconnect: "Disconnect",
    disconnectTitle: "Disconnect {name}?",
    disconnectBody: "Contacts stop going to your list, and the list and tags you picked here are cleared. Contacts already sent stay in your {name} account.",
    disconnecting: "Disconnecting…",
    cancel: "Cancel",
    disconnectedToast: "{name} was disconnected.",
    consent: "Only contacts who agreed to marketing are sent.",
    emptyTitle: "No email service is available yet",
    emptyBody: "Mailchimp and Klaviyo appear here once they're available for your store.",
  },
  ar: {
    title: "التسويق بالإيميل",
    description: "ابعت العملاء اللي وافقوا على التسويق لقائمتك",
    back: "التطبيقات",
    test: "تجربة",
    notConnected: "مش متوصل",
    connectedAs: "متوصل باسم {name}",
    about_mailchimp: "قائمة (Audience) في حسابك على ميل شيمب، بالتاجات.",
    about_klaviyo: "قائمة في حسابك على كلافيو.",
    about_sandbox: "قائمة وهمية عشان تجرّب الخطوات من غير حساب حقيقي.",
    help_mailchimp: "تجيبه منين: من ميل شيمب افتح {path}، وانسخ المفتاح كله — آخره اسم السيرفر بتاعك، زي {dc}.",
    help_klaviyo: "تجيبه منين: من كلافيو افتح {path}، وإديله صلاحية كاملة على {scopes}.",
    help_sandbox: "أي مفتاح ينفع هنا ما عدا كلمة invalid، ودي بتوريك شكل المفتاح المرفوض.",
    connect: "اربط",
    connecting: "بيربط…",
    connectedToast: "{name} اتربط.",
    installTitle: "ثبّت {name} الأول",
    installBody: "{name} تطبيق في متجر التطبيقات. ثبّته وارجع هنا اربط حسابك.",
    installFree: "ببلاش.",
    install: "ثبّت {name}",
    installing: "بيتثبّت…",
    installedToast: "{name} اتثبّت. اربط حسابك تحت.",
    appStore: "افتح متجر التطبيقات",
    appOff: "{name} مش متثبّت، فمفيش حاجة بتتبعتله لحد ما تثبّته تاني. القائمة والتاجات محفوظين.",
    appNotInstalled: "{name} مش متثبّت. ثبّته الأول وبعدين اربط.",
    mailchimpKey: "آخر مفتاح ميل شيمب فيه اسم السيرفر بتاعه (زي us21). انسخ المفتاح كله لآخره.",
    list: "القائمة",
    pickList: "اختار قائمة",
    loadingLists: "بنجيب القوايم بتاعتك…",
    listsFailed: "معرفناش نجيب القوايم بتاعتك.",
    retry: "جرّب تاني",
    noLists: "حسابك مفيهوش قوايم لسه. اعمل قائمة في {name} وجرّب تاني.",
    members: "{name} ({n})",
    tags: "تاجات تتحط على كل عميل",
    tagPlaceholder: "اكتب تاج",
    addTag: "ضيف",
    removeTag: "شيل التاج {tag}",
    tagsHint: "دوس إنتر أو حط فاصلة عشان يتضاف. لحد {n} تاجات.",
    tagsHint_mailchimp: "ميل شيمب بياخد كمان التاجات اللي على العميل نفسه.",
    tagsHint_klaviyo: "كلافيو بياخدهم في خاصية zimos_tags على العميل.",
    who: "مين يتبعت",
    leads: "عملاء محتملين (لسه ماطلبوش)",
    buyers: "اللي اشتروا",
    pickOne: "اختار واحد على الأقل.",
    save: "حفظ",
    saving: "بيحفظ…",
    savedToast: "اتحفظ.",
    syncNow: "زامن دلوقتي",
    syncStarting: "بيبدأ…",
    syncingNow: "بنبعت عملاءك دلوقتي…",
    lastSync: "آخر مزامنة {time} — {n} عميل",
    neverSynced: "لسه ما زامنتش. العملاء الجداد بيتبعتوا لوحدهم، و«زامن دلوقتي» بيبعت كمان اللي عندك من قبل كده.",
    pickListFirst: "اختار قائمة الأول",
    saveListFirst: "احفظ القائمة الأول",
    syncStartedToast: "المزامنة بدأت، وبتشتغل في الخلفية.",
    syncDoneToast: "المزامنة خلصت: اتبعت {n} عميل.",
    lastErrorTitle: "آخر إرسال لـ {name} اترفض",
    lastError_key: "الخدمة رفضت مفتاح الـ API — ممكن يكون اتلغى. اربط تاني بمفتاح جديد.",
    lastError_list: "القائمة اللي اخترتها مبقتش موجودة في حسابك. اختار قائمة تانية.",
    lastError_reach: "معرفناش نوصل للخدمة آخر مرة. العملاء الجداد بنحاول نبعتهم تاني لوحدنا.",
    serviceReply: "ردّهم: {message}",
    changeKey: "غيّر المفتاح",
    cancelChange: "خلّي المفتاح الحالي",
    disconnect: "افصل",
    disconnectTitle: "تفصل {name}؟",
    disconnectBody: "العملاء هيبطلوا يتبعتوا لقائمتك، والقائمة والتاجات اللي اخترتها هنا هيتمسحوا. العملاء اللي اتبعتوا قبل كده هيفضلوا في حسابك على {name}.",
    disconnecting: "بيفصل…",
    cancel: "إلغاء",
    disconnectedToast: "{name} اتفصل.",
    consent: "بنبعت بس العملاء اللي وافقوا على التسويق.",
    emptyTitle: "مفيش خدمة إيميل متاحة لسه",
    emptyBody: "ميل شيمب وكلافيو هيظهروا هنا أول ما يبقوا متاحين لمتجرك.",
  },
} satisfies Messages;

type T = Record<keyof (typeof STRINGS)["en"], string>;

/** The services' own menu names, kept as they appear there (shown left to right). */
const HELP_VALUES: Record<string, Record<string, string>> = {
  mailchimp: { path: "Profile → Extras → API keys → Create A Key", dc: "-us21" },
  klaviyo: { path: "Settings → API keys → Create Private API Key", scopes: "Lists, Profiles, Subscriptions" },
};

const SANDBOX_NAME = { en: "Test email list", ar: "قائمة إيميلات تجريبية" } as const;
const POLL_MS = 2500;

/** A sentence with its {placeholders} filled by left-to-right runs, so Latin menu names keep their order inside Arabic. */
function withLtrValues(template: string, values: Record<string, string>) {
  return template.split(/\{(\w+)\}/).map((part, i) =>
    i % 2 === 1 ? (
      <bdi key={i} dir="ltr" className="font-medium text-ink">
        {values[part] ?? part}
      </bdi>
    ) : (
      part
    )
  );
}

export function EmailMarketingPage() {
  const t = useT(STRINGS);
  const workspaceId = useWorkspaceId();
  const list = useAsync(() => emailMarketingProviders(apiClient, workspaceId), [workspaceId]);
  // Install state of the Mailchimp / Klaviyo apps; unknown (null) when the app store can't be read.
  const apps = useAsync(() => appsList(apiClient, workspaceId).catch(() => null), [workspaceId]);
  const providers = list.data?.providers ?? [];
  const syncing = providers.some((p) => p.syncing);

  // While a sync runs, ask again every few seconds until it is done.
  useEffect(() => {
    if (!syncing) return;
    const id = window.setInterval(() => void list.refresh({ silent: true }), POLL_MS);
    return () => window.clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [syncing]);

  const replace = (next: EmailMarketingProvider) =>
    list.setData((prev) => ({ providers: (prev?.providers ?? []).map((p) => (p.code === next.code ? next : p)) }));

  return (
    <UnsavedGuardProvider>
      <div>
      <PageHeader title={t.title} description={t.description} back={{ to: "/apps", label: t.back }} />
      <DataState loading={list.loading} error={list.error} onRetry={() => void list.refresh()}>
        {providers.length === 0 ? (
          <EmptyState
            icon={<IconEmail />}
            title={t.emptyTitle}
            description={t.emptyBody}
            action={
              <Button asChild className="min-h-11">
                <Link to="/apps">{t.appStore}</Link>
              </Button>
            }
          />
        ) : (
          <div className="max-w-3xl space-y-4">
            {providers.map((provider) => (
              <ProviderCard
                key={provider.code}
                t={t}
                provider={provider}
                appsLoading={apps.loading}
                app={apps.data?.apps.find((a) => a.key === provider.code)}
                onChange={replace}
                onRefresh={() => void list.refresh({ silent: true })}
                onAppsChanged={() => void apps.refresh({ silent: true })}
              />
            ))}
          </div>
        )}
      </DataState>
      </div>
    </UnsavedGuardProvider>
  );
}

interface CardProps {
  t: T;
  provider: EmailMarketingProvider;
  /** True while the app store's install states are being read. */
  appsLoading: boolean;
  /** The app-store entry; undefined for a service the store does not list (the test one) or when the store can't be read. */
  app: AppDto | undefined;
  onChange: (next: EmailMarketingProvider) => void;
  onRefresh: () => void;
  onAppsChanged: () => void;
}

/** The sentence for a failed call (pure: safe while rendering). */
type MessageOf = (err: unknown) => string;

function ProviderCard({ t, provider, appsLoading, app, onChange, onRefresh, onAppsChanged }: CardProps) {
  const { locale } = useLocale();
  const workspaceId = useWorkspaceId();
  const toast = useToast();
  const errorMessage = useErrorMessage();
  const [error, setError] = useState<string | null>(null);
  // The server said the app is not installed (when the app store itself couldn't be read).
  const [installNeeded, setInstallNeeded] = useState(false);
  const [installing, setInstalling] = useState(false);
  const [changingKey, setChangingKey] = useState(false);
  const [disconnecting, setDisconnecting] = useState(false);

  const name = provider.code === "sandbox" ? SANDBOX_NAME[locale] : (app?.name[locale] ?? provider.name);
  const appOff = Boolean(app && !app.installed) || installNeeded;
  const about = (t as Record<string, string>)[`about_${provider.code}`];

  const messageOf: MessageOf = (err) => {
    const raw = err instanceof ApiError ? err.message : "";
    return errorMessage(err, {
      APP_NOT_INSTALLED: fmt(t.appNotInstalled, { name }),
      ...(/data centre/i.test(raw) ? { EMAIL_MARKETING_INVALID_CREDENTIALS: t.mailchimpKey } : {}),
    });
  };
  /** For event handlers: also brings up the install panel when the server says the app is off. */
  const describe: MessageOf = (err) => {
    if (apiErrorCode(err) === "APP_NOT_INSTALLED") setInstallNeeded(true);
    return messageOf(err);
  };

  async function install() {
    setInstalling(true);
    setError(null);
    try {
      await appsInstall(apiClient, workspaceId, provider.code);
      setInstallNeeded(false);
      toast.success(fmt(t.installedToast, { name }));
      onAppsChanged();
    } catch (err) {
      setError(describe(err));
    } finally {
      setInstalling(false);
    }
  }

  return (
    <div>
      <Card className="gap-0 p-4 sm:p-5">
        <div className="flex flex-wrap items-start gap-3">
          <ProviderLogo code={provider.code} name={provider.name} />
          <div className="min-w-[10rem] flex-1">
            <h2 className="flex flex-wrap items-center gap-2 text-[15px] font-semibold text-ink">
              {name}
              {provider.isTest && <StatusBadge value="test" tone="warning" text={t.test} />}
            </h2>
            {about && <p className="mt-0.5 text-xs text-ink-soft">{about}</p>}
          </div>
          <StatusBadge
            value={provider.connected ? "connected" : "disconnected"}
            tone={provider.connected ? "success" : "neutral"}
            text={provider.connected ? fmt(t.connectedAs, { name: provider.accountName ?? name }) : t.notConnected}
            className="whitespace-normal"
          />
        </div>

        <div className="mt-4 space-y-4">
          {error && (
            <p role="alert" className="rounded-[var(--radius)] bg-danger-soft px-3 py-2.5 text-sm text-danger">
              {error}
            </p>
          )}

          {appOff && (
            <InstallPanel
              t={t}
              name={name}
              free={!app?.price}
              connected={provider.connected}
              installing={installing}
              onInstall={() => void install()}
            />
          )}

          {!provider.connected && !appOff && appsLoading && (
            <div className="flex min-h-11 items-center text-ink-soft">
              <Spinner className="size-5" aria-hidden />
            </div>
          )}

          {!provider.connected && !appOff && !appsLoading && (
            <ConnectForm
              t={t}
              provider={provider}
              describe={describe}
              onConnected={(next) => {
                onChange(next);
                toast.success(fmt(t.connectedToast, { name }));
              }}
            />
          )}

          {provider.connected && (
            <>
              {provider.lastError && <LastError t={t} name={name} message={provider.lastError} />}
              {changingKey ? (
                <div className="space-y-2 rounded-[var(--radius)] bg-paper-sunken/60 p-3">
                  <ConnectForm
                    t={t}
                    provider={provider}
                    describe={describe}
                    onConnected={(next) => {
                      onChange(next);
                      setChangingKey(false);
                      toast.success(fmt(t.connectedToast, { name }));
                    }}
                  />
                  <Button type="button" variant="ghost" size="sm" className="min-h-11" onClick={() => setChangingKey(false)}>
                    {t.cancelChange}
                  </Button>
                </div>
              ) : null}
              <SettingsForm
                t={t}
                provider={provider}
                name={name}
                describe={describe}
                messageOf={messageOf}
                onSaved={onChange}
                onRefresh={onRefresh}
              />
              <div className="flex flex-wrap items-center gap-2 border-t border-line pt-3">
                {!changingKey && (
                  <Button type="button" variant="ghost" size="sm" className="min-h-11" onClick={() => setChangingKey(true)}>
                    {t.changeKey}
                  </Button>
                )}
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="min-h-11 text-danger hover:text-danger"
                  onClick={() => setDisconnecting(true)}
                >
                  {t.disconnect}
                </Button>
              </div>
            </>
          )}
        </div>
      </Card>
      <p className="mt-2 flex items-center gap-1.5 px-1 text-xs text-ink-soft">
        <IconShield className="size-3.5 shrink-0 text-success" aria-hidden />
        {t.consent}
      </p>

      <ConfirmDialog
        open={disconnecting}
        title={fmt(t.disconnectTitle, { name })}
        description={fmt(t.disconnectBody, { name })}
        confirmLabel={t.disconnect}
        cancelLabel={t.cancel}
        busyLabel={t.disconnecting}
        destructive
        onCancel={() => setDisconnecting(false)}
        onConfirm={async () => {
          try {
            await emailMarketingDisconnect(apiClient, workspaceId, provider.code);
          } catch (err) {
            throw new Error(describe(err));
          }
          setDisconnecting(false);
          setChangingKey(false);
          toast.success(fmt(t.disconnectedToast, { name }));
          onRefresh();
        }}
      />
    </div>
  );
}

function InstallPanel({
  t,
  name,
  free,
  connected,
  installing,
  onInstall,
}: {
  t: T;
  name: string;
  free: boolean;
  connected: boolean;
  installing: boolean;
  onInstall: () => void;
}) {
  return (
    <div className="rounded-[var(--radius)] bg-accent-soft p-3 text-sm text-accent-dark">
      {connected ? (
        <p>{fmt(t.appOff, { name })}</p>
      ) : (
        <>
          <p className="font-medium">{fmt(t.installTitle, { name })}</p>
          <p className="mt-0.5">
            {fmt(t.installBody, { name })} {free ? t.installFree : ""}
          </p>
        </>
      )}
      <div className="mt-3 flex flex-wrap items-center gap-2">
        <Button type="button" className="min-h-11" disabled={installing} onClick={onInstall}>
          {installing ? t.installing : fmt(t.install, { name })}
        </Button>
        <Button asChild variant="outline" className="min-h-11 bg-paper-raised">
          <Link to="/apps">{t.appStore}</Link>
        </Button>
      </div>
    </div>
  );
}

function ConnectForm({
  t,
  provider,
  describe,
  onConnected,
}: {
  t: T;
  provider: EmailMarketingProvider;
  describe: MessageOf;
  onConnected: (next: EmailMarketingProvider) => void;
}) {
  const { locale } = useLocale();
  const workspaceId = useWorkspaceId();
  const [credentials, setCredentials] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const help = (t as Record<string, string>)[`help_${provider.code}`];

  async function submit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const next = await emailMarketingConnect(apiClient, workspaceId, provider.code, credentials);
      setCredentials({});
      onConnected(next);
    } catch (err) {
      setError(describe(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={submit} className="max-w-md space-y-3">
      {provider.credentialFields.map((field) => (
        <TextField
          key={field.key}
          label={field.label[locale]}
          type={field.secret ? "password" : "text"}
          autoComplete="off"
          spellCheck={false}
          dir="ltr"
          required={field.required}
          aria-invalid={error ? true : undefined}
          value={credentials[field.key] ?? ""}
          onChange={(e) => setCredentials((prev) => ({ ...prev, [field.key]: e.target.value }))}
        />
      ))}
      {error && (
        <p role="alert" className="rounded-[var(--radius)] bg-danger-soft px-3 py-2.5 text-sm text-danger">
          {error}
        </p>
      )}
      {help && <p className="text-xs leading-relaxed text-ink-soft">{withLtrValues(help, HELP_VALUES[provider.code] ?? {})}</p>}
      <Button type="submit" className="min-h-11" disabled={busy}>
        {busy ? t.connecting : t.connect}
      </Button>
    </form>
  );
}

function LastError({ t, name, message }: { t: T; name: string; message: string }) {
  const known = /refused the API key/i.test(message)
    ? t.lastError_key
    : /data centre/i.test(message)
      ? t.mailchimpKey
      : /list was not found/i.test(message)
        ? t.lastError_list
        : /could not be reached|answered \d+/i.test(message)
          ? t.lastError_reach
          : null;
  const [before, after] = t.serviceReply.split("{message}");
  return (
    <div role="alert" className="rounded-[var(--radius)] bg-danger-soft px-3 py-2.5 text-sm text-danger">
      <p className="font-medium">{fmt(t.lastErrorTitle, { name })}</p>
      {known ? (
        <p className="mt-0.5">{known}</p>
      ) : (
        <p className="mt-0.5">
          {before}
          <bdi dir="auto">{message}</bdi>
          {after}
        </p>
      )}
    </div>
  );
}

function sameTags(a: string[], b: string[]) {
  return a.length === b.length && a.every((tag, i) => tag === b[i]);
}

/** List, tags and which contacts, then "Sync now" (which waits for a saved list). */
function SettingsForm({
  t,
  provider,
  name,
  describe,
  messageOf,
  onSaved,
  onRefresh,
}: {
  t: T;
  provider: EmailMarketingProvider;
  name: string;
  describe: MessageOf;
  messageOf: MessageOf;
  onSaved: (next: EmailMarketingProvider) => void;
  onRefresh: () => void;
}) {
  const workspaceId = useWorkspaceId();
  const toast = useToast();
  const listId = useId();
  const [chosenList, setChosenList] = useState(provider.listId ?? "");
  const [tags, setTags] = useState<string[]>(provider.tags);
  const [sources, setSources] = useState<EmailMarketingSource[]>(provider.sources);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const lists = useAsync(() => emailMarketingLists(apiClient, workspaceId, provider.code), [workspaceId, provider.code]);

  // A finished sync changes the lists' member counts: read them again.
  const wasSyncing = useRef(provider.syncing);
  useEffect(() => {
    if (wasSyncing.current && !provider.syncing) void lists.refresh({ silent: true });
    wasSyncing.current = provider.syncing;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [provider.syncing]);

  const listChanged = chosenList !== "" && chosenList !== (provider.listId ?? "");
  const tagsChanged = !sameTags(tags, provider.tags);
  const sourcesChanged = [...sources].sort().join() !== [...provider.sources].sort().join();
  const dirty = listChanged || tagsChanged || sourcesChanged;
  const noSource = sources.length === 0;
  // Told to the page's guard: closing or reloading the tab with an unsaved list or tag asks first.
  useReportDirty(dirty);

  function discard() {
    setChosenList(provider.listId ?? "");
    setTags(provider.tags);
    setSources(provider.sources);
    setError(null);
  }

  async function save(e: FormEvent) {
    e.preventDefault();
    if (!dirty || noSource) return;
    setBusy(true);
    setError(null);
    try {
      const next = await emailMarketingSaveSettings(apiClient, workspaceId, provider.code, {
        ...(listChanged ? { listId: chosenList } : {}),
        ...(tagsChanged ? { tags } : {}),
        ...(sourcesChanged ? { sources } : {}),
      });
      onSaved(next);
      setTags(next.tags);
      setSources(next.sources);
      setChosenList(next.listId ?? "");
      toast.success(t.savedToast);
    } catch (err) {
      setError(describe(err));
    } finally {
      setBusy(false);
    }
  }

  const toggle = (source: EmailMarketingSource, on: boolean) =>
    setSources((prev) => (on ? [...new Set([...prev, source])] : prev.filter((s) => s !== source)));
  const tagsHint = (t as Record<string, string>)[`tagsHint_${provider.code}`];

  return (
    <>
      <form onSubmit={save} className="space-y-4">
        <div className="space-y-1.5">
          <label htmlFor={listId} className="text-sm font-medium text-ink">
            {t.list}
          </label>
          {lists.error ? (
            <div className="flex flex-wrap items-center gap-2 text-sm text-danger" role="alert">
              <span>
                {t.listsFailed} {messageOf(lists.error)}
              </span>
              <Button type="button" variant="outline" size="sm" className="min-h-11" onClick={() => void lists.refresh()}>
                <IconRefresh className="size-4" aria-hidden />
                {t.retry}
              </Button>
            </div>
          ) : lists.data && lists.data.length === 0 ? (
            <div className="flex flex-wrap items-center gap-2 text-sm text-ink-soft">
              <span>{fmt(t.noLists, { name })}</span>
              <Button type="button" variant="outline" size="sm" className="min-h-11" onClick={() => void lists.refresh()}>
                <IconRefresh className="size-4" aria-hidden />
                {t.retry}
              </Button>
            </div>
          ) : (
            <Select
              id={listId}
              className="h-11 max-w-md"
              disabled={lists.loading || busy}
              value={chosenList}
              onChange={(e) => setChosenList(e.target.value)}
            >
              {lists.loading ? (
                <option value={chosenList}>{t.loadingLists}</option>
              ) : (
                <>
                  {chosenList === "" && (
                    <option value="" disabled>
                      {t.pickList}
                    </option>
                  )}
                  {/* The saved list, even when the service no longer returns it. */}
                  {provider.listId && !(lists.data ?? []).some((l) => l.id === provider.listId) && (
                    <option value={provider.listId}>{provider.listName ?? provider.listId}</option>
                  )}
                  {(lists.data ?? []).map((l) => (
                    <option key={l.id} value={l.id}>
                      {l.memberCount === null ? l.name : fmt(t.members, { name: l.name, n: formatCount(l.memberCount) })}
                    </option>
                  ))}
                </>
              )}
            </Select>
          )}
        </div>

        <TagsField t={t} tags={tags} onChange={setTags} disabled={busy} extraHint={tagsHint} />

        <fieldset className="space-y-2" disabled={busy}>
          <legend className="mb-1.5 text-sm font-medium text-ink">{t.who}</legend>
          <div className="flex flex-wrap gap-2">
            {(["leads", "buyers"] as const).map((source) => (
              <label
                key={source}
                className={cn(
                  "flex min-h-11 cursor-pointer items-center gap-2.5 rounded-[var(--radius)] border px-3 text-sm transition-colors",
                  sources.includes(source) ? "border-primary bg-primary-soft/60 text-primary-dark" : "border-line text-ink hover:border-line-strong"
                )}
              >
                <input
                  type="checkbox"
                  className="size-4 shrink-0 cursor-pointer accent-primary"
                  checked={sources.includes(source)}
                  onChange={(e) => toggle(source, e.target.checked)}
                />
                {t[source]}
              </label>
            ))}
          </div>
          {noSource && <p className="text-xs font-medium text-danger">{t.pickOne}</p>}
        </fieldset>

        {error && (
          <p role="alert" className="text-sm font-medium text-danger">
            {error}
          </p>
        )}
        {/* Shows only while something is unsaved, and stays in reach above the dock. */}
        <SaveBar dirty={dirty} saving={busy} disabled={noSource} onDiscard={discard} saveLabel={t.save} savingLabel={t.saving} />
      </form>
      <SyncRow t={t} provider={provider} unsavedList={listChanged} describe={describe} onStarted={onSaved} onRefresh={onRefresh} />
    </>
  );
}

function TagsField({
  t,
  tags,
  onChange,
  disabled,
  extraHint,
}: {
  t: T;
  tags: string[];
  onChange: (next: string[]) => void;
  disabled?: boolean;
  extraHint?: string;
}) {
  const inputId = useId();
  const hintId = useId();
  const [draft, setDraft] = useState("");
  const full = tags.length >= EMAIL_MARKETING_MAX_TAGS;

  function add(raw: string) {
    // A pasted "summer, vip" adds both.
    const next = [...tags];
    const seen = new Set(tags.map((tag) => tag.toLowerCase()));
    for (const part of raw.split(/[,،]/)) {
      const tag = part.trim().slice(0, EMAIL_MARKETING_TAG_MAX_LENGTH);
      if (!tag || seen.has(tag.toLowerCase()) || next.length >= EMAIL_MARKETING_MAX_TAGS) continue;
      seen.add(tag.toLowerCase());
      next.push(tag);
    }
    setDraft("");
    if (next.length !== tags.length) onChange(next);
  }

  function onKeyDown(e: KeyboardEvent<HTMLInputElement>) {
    // Enter adds the tag instead of saving the form; a comma does the same.
    if (e.key === "Enter" || e.key === "," || e.key === "،") {
      e.preventDefault();
      add(draft);
    } else if (e.key === "Backspace" && !draft && tags.length > 0) {
      onChange(tags.slice(0, -1));
    }
  }

  return (
    <div className="space-y-1.5">
      <label htmlFor={inputId} className="text-sm font-medium text-ink">
        {t.tags}
      </label>
      {tags.length > 0 && (
        <ul className="flex flex-wrap gap-1.5">
          {tags.map((tag) => (
            <li
              key={tag}
              className="inline-flex items-center gap-1 rounded-full border border-primary/30 bg-primary-soft py-0.5 ps-2.5 pe-1 text-sm text-primary-dark dark:text-primary"
            >
              <bdi>{tag}</bdi>
              <button
                type="button"
                disabled={disabled}
                onClick={() => onChange(tags.filter((x) => x !== tag))}
                aria-label={fmt(t.removeTag, { tag })}
                className="inline-flex size-7 cursor-pointer items-center justify-center rounded-full hover:bg-paper-raised focus-visible:outline-2 focus-visible:outline-primary"
              >
                <IconClose className="size-3.5" aria-hidden />
              </button>
            </li>
          ))}
        </ul>
      )}
      <div className="flex max-w-md gap-2">
        <Input
          id={inputId}
          value={draft}
          maxLength={EMAIL_MARKETING_TAG_MAX_LENGTH}
          placeholder={t.tagPlaceholder}
          disabled={disabled || full}
          aria-describedby={hintId}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={onKeyDown}
          onBlur={() => draft.trim() && add(draft)}
          className="h-11"
        />
        <Button type="button" variant="outline" className="min-h-11" disabled={disabled || full || !draft.trim()} onClick={() => add(draft)}>
          {t.addTag}
        </Button>
      </div>
      <p id={hintId} className="text-xs text-ink-soft">
        {fmt(t.tagsHint, { n: formatCount(EMAIL_MARKETING_MAX_TAGS) })}
        {extraHint ? ` ${extraHint}` : ""}
      </p>
    </div>
  );
}

function SyncRow({
  t,
  provider,
  unsavedList,
  describe,
  onStarted,
  onRefresh,
}: {
  t: T;
  provider: EmailMarketingProvider;
  /** A list is picked in the form but not saved yet. */
  unsavedList: boolean;
  describe: MessageOf;
  onStarted: (next: EmailMarketingProvider) => void;
  onRefresh: () => void;
}) {
  const workspaceId = useWorkspaceId();
  const toast = useToast();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Say when a sync this screen saw running has finished.
  const wasSyncing = useRef(provider.syncing);
  useEffect(() => {
    if (wasSyncing.current && !provider.syncing && provider.lastSyncAt) {
      toast.success(fmt(t.syncDoneToast, { n: formatCount(provider.syncedCount) }));
    }
    wasSyncing.current = provider.syncing;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [provider.syncing]);

  async function sync() {
    setBusy(true);
    setError(null);
    try {
      await emailMarketingSync(apiClient, workspaceId, provider.code);
      onStarted({ ...provider, syncing: true });
      toast.success(t.syncStartedToast);
    } catch (err) {
      setError(describe(err));
      onRefresh();
    } finally {
      setBusy(false);
    }
  }

  const noList = !provider.listId;
  return (
    <div className="space-y-2 rounded-[var(--radius)] bg-paper-sunken/60 p-3">
      <div className="flex flex-wrap items-center gap-3">
        <Button type="button" variant="outline" className="min-h-11 bg-paper-raised" disabled={busy || provider.syncing || noList} onClick={() => void sync()}>
          <IconRefresh className={cn("size-4", provider.syncing && "animate-spin motion-reduce:animate-none")} aria-hidden />
          {busy ? t.syncStarting : t.syncNow}
        </Button>
        <p className="min-w-[13rem] flex-1 text-sm text-ink-soft" aria-live="polite">
          {provider.syncing ? (
            <span className="inline-flex items-center gap-2 text-ink">
              <Spinner className="size-4" aria-hidden />
              {t.syncingNow}
            </span>
          ) : noList ? (
            unsavedList ? t.saveListFirst : t.pickListFirst
          ) : provider.lastSyncAt ? (
            fmt(t.lastSync, { time: formatDateTime(provider.lastSyncAt), n: formatCount(provider.syncedCount) })
          ) : (
            t.neverSynced
          )}
        </p>
      </div>
      {error && (
        <p role="alert" className="text-sm font-medium text-danger">
          {error}
        </p>
      )}
    </div>
  );
}
