import { useId, useState, type FormEvent } from "react";
import { Alert, Button, Input, Label, cn } from "@store-builder/ui";
import {
  ApiError,
  isSwitchSetting,
  type PaymentGatewayInfo,
  type PaymentGatewayList,
} from "@store-builder/api-client";
import { IconCard, IconCaretRight, IconExternal } from "@/components/icons";
import { apiClient } from "@/lib/apiClient";
import { useWorkspaceId } from "@/lib/useWorkspaceId";
import { useErrorMessage } from "@/lib/errorMessages";
import { useReportDirty } from "@/lib/useUnsavedGuard";
// Paymob's saved-cards (MOTO) ID has no method; PayPal's vault switch is off by default (handoff 380).
import { gatewaySwitchOn, methodFieldsFirst, turnsMethodOn } from "./gatewaySettingRules";
import { formatDateTime } from "@/lib/format";
import { pluralOf } from "@/lib/plural";
import { STOREFRONT_URL } from "@/lib/storefrontUrl";
import { fmt, useCommon, useLocale, useT, type Messages } from "@/i18n/LocaleContext";
import { AccordionSection } from "@/components/Accordion";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { CopyButton } from "@/components/CopyButton";
import { EmptyState } from "@/components/EmptyState";
import { ProviderLogo } from "@/components/ProviderLogo";
import { Sheet } from "@/components/Sheet";
import { StatusBadge } from "@/components/StatusBadge";
import { SettingsGroup } from "@/components/settings";
import { useToast } from "@/components/Toast";
import {
  GatewayCurrencyNote,
  SettingSwitch,
  isOptionalCredential,
  useGatewayKeyProblem,
  useGatewayWebhookNotes,
  useMethodNames,
} from "../ExpressPayments";
import { FIELD, GROUP_ROW, GROUP_ROW_PRESS } from "./paneParts";
// Handoff 377: the webhook events to tick, and what an empty Stripe signing secret costs.
import { SigningSecretNote, WebhookEvents } from "./WebhookEvents";

const STRINGS = {
  en: {
    notAvailableTitle: "Card and wallet payments aren't on yet",
    notAvailable:
      "ZIMOS hasn't switched online payments on yet, so no gateway can be connected for now. Cash on delivery keeps working, and you can still set up InstaPay or wallet transfers.",
    listFooter: "Your own gateway account: the money goes straight to it. ZIMOS never holds it.",
    noGateways: "No gateways are offered yet.",
    notConnected: "Not connected",
    connected: "Connected",
    invalid: "Keys rejected",
    invalidNote: "{name} rejected the saved keys. Enter them again to keep taking online payments.",
    modeTest: "Test mode",
    modeLive: "Live",
    tapToConnect: "Tap to connect your account",
    testNote:
      "Test keys: card and wallet only show in your store preview, never to real shoppers, and orders paid in test mode can't be shipped.",
    previewButton: "Test checkout in store preview",
    previewOpening: "Opening preview…",
    connectedSince: "Connected {date}",
    lastWebhook: "Last payment update received {date}",
    noWebhookYet: "No payment update received yet. Check that the webhook URL below is pasted into each integration.",
    noWebhookYetAutomatic:
      "No payment update received yet. {name} is sent the webhook URL with every payment, so the first one arrives with the first payment.",
    webhookTitle: "Webhook URL",
    webhookHint: "Paste this into \"{field}\" of each {name} integration you entered below.",
    webhookHintAutomatic:
      "Nothing to paste for payments: {name} is given this URL with every payment. To also see refunds you make in {name}'s own dashboard, add it there under \"{field}\" (events: refund, partial_refund, void).",
    copyWebhook: "Copy webhook URL",
    setupTitle: "How to connect {name}",
    helpLinks: "Help",
    steps_one: "1 step",
    steps_two: "2 steps",
    steps_few: "{n} steps",
    steps_other: "{n} steps",
    connect: "Connect {name}",
    credentialsTitle: "Keys",
    credentialsHint: "Stored encrypted and never shown again.",
    methodsTitle: "Payment methods",
    methodsHint: "Enter the integration ID for each method you want to offer.",
    submitConnect: "Check keys and connect",
    checking: "Checking with {name}…",
    replaceKeys: "Replace keys",
    editIds: "Edit integration IDs",
    accountMethods: "Methods on your {name} account",
    recheck: "Check the account again",
    rechecking: "Checking…",
    recheckedToast: "{name} account checked.",
    saveIds: "Save",
    disconnect: "Disconnect",
    disconnectTitle: "Disconnect {name}?",
    disconnectDescription: "Shoppers will no longer be able to pay with {name}. Past payments and refunds stay on their orders.",
    connectedToast: "{name} is connected.",
    savedToast: "{name} settings saved.",
    disconnectedToast: "{name} disconnected.",
    discardTitle: "Discard what you typed?",
    discardBody: "The keys and numbers you entered aren't saved yet.",
    discardLeave: "Discard",
    discardStay: "Keep editing",
  },
  ar: {
    notAvailableTitle: "الدفع بالكارت والمحفظة لسه مش متفعّل",
    notAvailable:
      "زيموس لسه ما فعّلتش الدفع الأونلاين، فمفيش بوابة ينفع تتربط دلوقتي. الدفع عند الاستلام شغّال زي ما هو، وتقدر تظبط تحويلات إنستاباي أو المحافظ.",
    listFooter: "حساب البوابة بتاعك إنت: الفلوس بتروحله على طول، وزيموس مش بتمسكها.",
    noGateways: "مفيش بوابات متاحة لسه.",
    notConnected: "مش مربوطة",
    connected: "مربوطة",
    invalid: "المفاتيح مرفوضة",
    invalidNote: "{name} رفضت المفاتيح المحفوظة. اكتبها تاني علشان الدفع الأونلاين يفضل شغّال.",
    modeTest: "وضع التجربة",
    modeLive: "تشغيل فعلي",
    tapToConnect: "اضغط علشان تربط حسابك",
    testNote:
      "مفاتيح تجربة: الكارت والمحفظة بيظهروا في معاينة متجرك بس مش للعملاء الحقيقيين، والأوردرات المدفوعة في وضع التجربة مش بتتشحن.",
    previewButton: "جرّب الدفع في معاينة المتجر",
    previewOpening: "بنفتح المعاينة…",
    connectedSince: "مربوطة من {date}",
    lastWebhook: "آخر تحديث دفع وصل {date}",
    noWebhookYet: "لسه ما وصلش أي تحديث دفع. اتأكد إن رابط الـ webhook اللي تحت ملصوق في كل تكامل.",
    noWebhookYetAutomatic:
      "لسه ما وصلش أي تحديث دفع. {name} بياخد رابط الـ webhook مع كل عملية دفع، فأول تحديث هيوصل مع أول عملية.",
    webhookTitle: "رابط الـ Webhook",
    webhookHint: "الصق الرابط ده في خانة \"{field}\" لكل تكامل من تكاملات {name} اللي كتبتها تحت.",
    webhookHintAutomatic:
      "مش محتاج تلصق حاجة للمدفوعات: {name} بياخد الرابط ده مع كل عملية دفع. لو عايز الاستردادات اللي بتعملها من لوحة {name} نفسها تظهر هنا، ضيفه هناك في \"{field}\" (الأحداث: refund و partial_refund و void).",
    copyWebhook: "انسخ رابط الـ webhook",
    setupTitle: "طريقة ربط {name}",
    helpLinks: "مساعدة",
    steps_one: "خطوة واحدة",
    steps_two: "خطوتين",
    steps_few: "{n} خطوات",
    steps_other: "{n} خطوة",
    connect: "اربط {name}",
    credentialsTitle: "المفاتيح",
    credentialsHint: "بتتحفظ مشفّرة ومش بتظهر تاني.",
    methodsTitle: "طرق الدفع",
    methodsHint: "اكتب رقم التكامل لكل طريقة عايز تقدّمها.",
    submitConnect: "اتأكد من المفاتيح واربط",
    checking: "بنتأكد مع {name}…",
    replaceKeys: "غيّر المفاتيح",
    editIds: "عدّل أرقام التكامل",
    accountMethods: "الطرق المتاحة في حساب {name}",
    recheck: "افحص الحساب تاني",
    rechecking: "بنفحص…",
    recheckedToast: "اتفحص حساب {name}.",
    saveIds: "حفظ",
    disconnect: "افصل الربط",
    disconnectTitle: "تفصل ربط {name}؟",
    disconnectDescription: "العملاء مش هيقدروا يدفعوا بـ {name}. المدفوعات والاستردادات اللي فاتت هتفضل على أوردراتها.",
    connectedToast: "اتربط {name}.",
    savedToast: "اتحفظت إعدادات {name}.",
    disconnectedToast: "اتفصل {name}.",
    discardTitle: "تسيب اللي كتبته؟",
    discardBody: "المفاتيح والأرقام اللي كتبتها لسه ما اتحفظتش.",
    discardLeave: "سيبه",
    discardStay: "كمّل تعديل",
  },
} satisfies Messages;

/** Which gateway's sheet is up. `turn` makes every opening a fresh sheet (its form starts from the saved values). */
interface OpenSheet {
  code: string;
  turn: number;
  shown: boolean;
}

/**
 * Payments → Gateways: the gateways as a list (logo, name, state), each row
 * opening the gateway's own sheet — what is connected, its webhook, its
 * switches, and the connect / keys / integration-ID form.
 */
export function GatewaysSection({
  list,
  canManage,
  onForbidden,
  onChanged,
}: {
  list: PaymentGatewayList;
  canManage: boolean;
  onForbidden: () => void;
  onChanged: () => void;
}) {
  const t = useT(STRINGS);
  const [sheet, setSheet] = useState<OpenSheet | null>(null);

  // The environment has no gateway key store: nothing can be connected, and the pane says why.
  if (!list.configured) {
    return <EmptyState icon={<IconCard />} tone="attention" title={t.notAvailableTitle} description={t.notAvailable} />;
  }
  if (list.gateways.length === 0) {
    return <EmptyState icon={<IconCard />} title={t.noGateways} />;
  }

  const active = sheet ? list.gateways.find((g) => g.code === sheet.code) : undefined;

  return (
    <>
      <SettingsGroup footer={t.listFooter}>
        {list.gateways.map((gateway) => (
          <GatewayRow
            key={gateway.code}
            gateway={gateway}
            canManage={canManage}
            onOpen={() => setSheet((prev) => ({ code: gateway.code, turn: (prev?.turn ?? 0) + 1, shown: true }))}
          />
        ))}
      </SettingsGroup>
      {sheet && active && (
        <GatewaySheet
          key={`${sheet.code}:${sheet.turn}`}
          gateway={active}
          open={sheet.shown}
          onClose={() => setSheet((prev) => (prev ? { ...prev, shown: false } : prev))}
          canManage={canManage}
          onForbidden={onForbidden}
          onChanged={onChanged}
        />
      )}
    </>
  );
}

/** The state chips of a gateway: not connected / connected / keys rejected, and test or live once connected. */
function GatewayChips({ gateway }: { gateway: PaymentGatewayInfo }) {
  const t = useT(STRINGS);
  const connection = gateway.connection;
  return (
    <span className="flex flex-wrap items-center gap-1.5">
      {!connection ? (
        <StatusBadge value="not_connected" tone="neutral" text={t.notConnected} />
      ) : connection.status === "invalid" ? (
        <StatusBadge value="invalid" tone="danger" text={t.invalid} />
      ) : (
        <StatusBadge value="connected" tone="success" text={t.connected} />
      )}
      {connection && (
        <StatusBadge
          value={connection.mode}
          tone={connection.mode === "live" ? "info" : "warning"}
          text={connection.mode === "live" ? t.modeLive : t.modeTest}
        />
      )}
    </span>
  );
}

function GatewayRow({
  gateway,
  canManage,
  onOpen,
}: {
  gateway: PaymentGatewayInfo;
  canManage: boolean;
  onOpen: () => void;
}) {
  const t = useT(STRINGS);
  const connection = gateway.connection;
  const line = connection
    ? fmt(t.connectedSince, { date: formatDateTime(connection.connectedAt) })
    : canManage
      ? t.tapToConnect
      : null;
  return (
    <button type="button" onClick={onOpen} className={cn(GROUP_ROW, GROUP_ROW_PRESS, "min-h-18")}>
      <ProviderLogo code={gateway.code} name={gateway.name} />
      <span className="flex min-w-0 flex-1 flex-col gap-1">
        <span className="truncate text-[15px] leading-5 font-medium text-ink">{gateway.name}</span>
        <GatewayChips gateway={gateway} />
        {line && <span className="truncate text-[13px] leading-5 text-ink-soft">{line}</span>}
      </span>
      <IconCaretRight className="size-4 shrink-0 text-ink-soft rtl:-scale-x-100" weight="bold" aria-hidden />
    </button>
  );
}

type SheetMode = "view" | "connect" | "ids";

function GatewaySheet({
  gateway,
  open,
  onClose,
  canManage,
  onForbidden,
  onChanged,
}: {
  gateway: PaymentGatewayInfo;
  open: boolean;
  onClose: () => void;
  canManage: boolean;
  onForbidden: () => void;
  onChanged: () => void;
}) {
  const t = useT(STRINGS);
  const common = useCommon();
  const { locale } = useLocale();
  const workspaceId = useWorkspaceId();
  const toast = useToast();
  const errorMessage = useErrorMessage();
  const formId = useId();
  const name = gateway.name;
  const connection = gateway.connection;
  // Kashier: the methods come from the account itself; only keys are typed in.
  const fromAccount = gateway.methodsFromAccount;
  // Integration IDs are typed in (Paymob); on/off settings are switches (Stripe's express wallets, handoff 183).
  const idFields = methodFieldsFirst(gateway.settingFields.filter((f) => !isSwitchSetting(f)));
  const switchFields = gateway.settingFields.filter(isSwitchSetting);
  const typesIds = idFields.length > 0;
  const methodNames = useMethodNames();
  const webhookNotes = useGatewayWebhookNotes(gateway);
  const keyProblem = useGatewayKeyProblem();

  // The integration IDs as saved, to start the form from each time it opens.
  function savedIds(): Record<string, string> {
    const settings = connection?.settings ?? {};
    return Object.fromEntries(idFields.map((f) => [f.key, settings[f.key] != null ? String(settings[f.key]) : ""]));
  }

  // A switch is on unless saved off (the server's default is on).
  const switchOn = (key: string) => gatewaySwitchOn(connection?.settings, key);
  const savedSwitches = (): Record<string, boolean> => Object.fromEntries(switchFields.map((f) => [f.key, switchOn(f.key)]));

  // A gateway that is not connected opens straight on its connect form.
  const [mode, setMode] = useState<SheetMode>(() => (canManage && !connection ? "connect" : "view"));
  const [credentials, setCredentials] = useState<Record<string, string>>({});
  const [ids, setIds] = useState<Record<string, string>>(savedIds);
  const [switches, setSwitches] = useState<Record<string, boolean>>(savedSwitches);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [disconnecting, setDisconnecting] = useState(false);
  const [openingPreview, setOpeningPreview] = useState(false);
  // The question before typed keys are dropped: on closing the sheet, or on going back to the summary.
  const [asking, setAsking] = useState<"close" | "back" | null>(null);

  const formDirty =
    mode !== "view" &&
    (Object.values(credentials).some((v) => v.trim().length > 0) ||
      idFields.some((f) => (ids[f.key] ?? "").trim() !== (savedIds()[f.key] ?? "")) ||
      switchFields.some((f) => (switches[f.key] ?? switchOn(f.key)) !== switchOn(f.key)));
  useReportDirty(open && formDirty);

  function openForm(next: SheetMode) {
    setError(null);
    setIds(savedIds());
    setSwitches(savedSwitches());
    setMode(next);
  }

  function dropForm() {
    setCredentials({});
    setIds(savedIds());
    setSwitches(savedSwitches());
    setError(null);
  }

  function requestClose() {
    if (busy) return;
    if (formDirty) setAsking("close");
    else onClose();
  }

  /** Cancel in the form: back to the summary of a connected gateway, out of the sheet for one that is not. */
  function cancelForm() {
    if (!connection) {
      requestClose();
      return;
    }
    if (formDirty) {
      setAsking("back");
      return;
    }
    dropForm();
    setMode("view");
  }

  function fail(err: unknown) {
    if (err instanceof ApiError && err.status === 403) {
      toast.error(errorMessage(err));
      onForbidden();
      setMode("view");
      return;
    }
    setError(keyProblem(gateway.code, err) ?? errorMessage(err));
  }

  function settingsPayload() {
    return {
      ...Object.fromEntries(idFields.map((f) => [f.key, ids[f.key]?.trim() ? Number(ids[f.key].trim()) : null])),
      ...switches,
    };
  }

  // An optional key left empty (Stripe's webhook signing secret) is not sent.
  const typedCredentials = () => Object.fromEntries(Object.entries(credentials).filter(([, v]) => v.trim().length > 0));

  async function submit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const wasConnected = Boolean(connection);
    try {
      await apiClient.connectPaymentGateway(workspaceId, gateway.code, {
        ...(mode === "connect" ? { credentials: typedCredentials() } : {}),
        ...(fromAccount ? {} : { settings: settingsPayload() }),
      });
      setCredentials({});
      setMode("view");
      toast.success(fmt(mode === "connect" && !wasConnected ? t.connectedToast : t.savedToast, { name }));
      onChanged();
    } catch (err) {
      fail(err);
    } finally {
      setBusy(false);
    }
  }

  /** Re-verifies the stored keys and re-reads the account's methods. */
  async function recheck() {
    setBusy(true);
    setError(null);
    try {
      await apiClient.connectPaymentGateway(workspaceId, gateway.code, {});
      toast.success(fmt(t.recheckedToast, { name }));
      onChanged();
    } catch (err) {
      fail(err);
      onChanged();
    } finally {
      setBusy(false);
    }
  }

  /** A switch on a connected gateway saves at once (the stored keys are checked again with it). */
  async function saveSwitch(key: string, on: boolean) {
    setBusy(true);
    setError(null);
    try {
      await apiClient.connectPaymentGateway(workspaceId, gateway.code, {
        settings: { ...(connection?.settings ?? {}), [key]: on },
      });
      toast.success(fmt(t.savedToast, { name }));
      onChanged();
    } catch (err) {
      fail(err);
    } finally {
      setBusy(false);
    }
  }

  async function confirmDisconnect() {
    try {
      await apiClient.disconnectPaymentGateway(workspaceId, gateway.code);
    } catch (err) {
      if (err instanceof ApiError && err.status === 403) {
        setDisconnecting(false);
        fail(err);
        return;
      }
      throw new Error(errorMessage(err));
    }
    setDisconnecting(false);
    toast.success(fmt(t.disconnectedToast, { name }));
    onChanged();
    onClose();
  }

  async function openPreview() {
    setOpeningPreview(true);
    // Opened before the await so the browser treats it as a user action.
    const win = window.open("", "_blank");
    try {
      const { token } = await apiClient.createPaymentPreviewToken(workspaceId);
      const url = `${STOREFRONT_URL}/store/${workspaceId}?paymentsPreview=${encodeURIComponent(token)}`;
      if (win) win.location.href = url;
      else window.open(url, "_blank", "noopener");
    } catch (err) {
      win?.close();
      fail(err);
    } finally {
      setOpeningPreview(false);
    }
  }

  const credentialsComplete = gateway.credentialFields.every(
    (f) => isOptionalCredential(gateway.code, f) || (credentials[f.key] ?? "").trim().length > 0
  );
  const anyId = idFields.some((f) => turnsMethodOn(f) && /^\d+$/.test((ids[f.key] ?? "").trim()));
  const idsValid = idFields.every((f) => !(ids[f.key] ?? "").trim() || /^\d+$/.test(ids[f.key].trim()));
  const inForm = canManage && (mode === "connect" || mode === "ids");

  const footer = inForm ? (
    <>
      <Button type="button" variant="outline" className="min-h-11 rounded-full px-5" disabled={busy} onClick={cancelForm}>
        {common.cancel}
      </Button>
      <Button
        type="submit"
        form={formId}
        className="min-h-11 rounded-full px-5"
        disabled={busy || (typesIds && (!anyId || !idsValid)) || (mode === "connect" && !credentialsComplete)}
      >
        {busy ? fmt(t.checking, { name }) : mode === "connect" ? t.submitConnect : t.saveIds}
      </Button>
    </>
  ) : canManage && !connection ? (
    <Button className="min-h-11 rounded-full px-5" onClick={() => openForm("connect")}>
      {fmt(t.connect, { name })}
    </Button>
  ) : undefined;

  return (
    <Sheet
      open={open}
      onOpenChange={(next) => {
        if (!next) requestClose();
      }}
      title={name}
      size="md"
      footer={footer}
    >
      <div className="flex flex-col gap-4">
        <div className="flex flex-wrap items-center gap-3">
          <ProviderLogo code={gateway.code} name={name} />
          <div className="flex min-w-0 flex-1 flex-col gap-1">
            <GatewayChips gateway={gateway} />
            {connection && (
              <p className="text-[13px] leading-5 text-ink-soft">
                {fmt(t.connectedSince, { date: formatDateTime(connection.connectedAt) })}
              </p>
            )}
          </div>
        </div>

        <GatewayCurrencyNote gateway={gateway} />

        {connection?.status === "invalid" && mode === "view" && <Alert variant="danger">{fmt(t.invalidNote, { name })}</Alert>}

        {connection && mode === "view" && (
          <>
            {connection.mode === "test" && (
              <div className="rounded-[0.875rem] border border-accent/40 bg-accent-soft px-4 py-3 text-sm text-accent-dark">
                <p>{t.testNote}</p>
                <Button variant="outline" className="mt-2 min-h-11 rounded-full px-4" disabled={openingPreview} onClick={openPreview}>
                  <IconExternal className="size-4" aria-hidden />
                  {openingPreview ? t.previewOpening : t.previewButton}
                </Button>
              </div>
            )}
            {webhookNotes.pending && !connection.lastWebhookAt ? (
              <p className="text-sm text-ink-soft">{webhookNotes.pending}</p>
            ) : (
              <p className={cn("text-sm", connection.lastWebhookAt ? "text-ink-soft" : "text-accent-dark")}>
                {connection.lastWebhookAt
                  ? fmt(t.lastWebhook, { date: formatDateTime(connection.lastWebhookAt) })
                  : gateway.webhookSetup.automatic
                    ? fmt(t.noWebhookYetAutomatic, { name })
                    : t.noWebhookYet}
              </p>
            )}
            <WebhookUrl gateway={gateway} url={connection.webhookUrl} />
            <p className="text-sm text-ink-soft">
              {!typesIds
                ? `${fmt(t.accountMethods, { name })}: ${methodNames(connection.methods)}`
                : idFields
                    .filter((f) => connection.settings[f.key])
                    .map((f) => `${f.label[locale]}: ${String(connection.settings[f.key])}`)
                    .join(" · ")}
            </p>
            {switchFields.length > 0 && (
              <SettingsGroup>
                {switchFields.map((f) => (
                  <SettingSwitch
                    key={f.key}
                    field={f}
                    checked={switchOn(f.key)}
                    disabled={!canManage}
                    busy={busy}
                    onChange={(on) => void saveSwitch(f.key, on)}
                  />
                ))}
              </SettingsGroup>
            )}
          </>
        )}

        {error && <Alert variant="danger">{error}</Alert>}

        {canManage && connection && mode === "view" && (
          <div className="flex flex-wrap gap-2">
            {!typesIds ? (
              <Button variant="outline" className="min-h-11 rounded-full px-4" disabled={busy} onClick={recheck}>
                {busy ? t.rechecking : t.recheck}
              </Button>
            ) : (
              <Button variant="outline" className="min-h-11 rounded-full px-4" onClick={() => openForm("ids")}>
                {t.editIds}
              </Button>
            )}
            <Button
              variant={connection.status === "invalid" ? "primary" : "outline"}
              className="min-h-11 rounded-full px-4"
              onClick={() => openForm("connect")}
            >
              {t.replaceKeys}
            </Button>
            <Button
              variant="ghost"
              className="min-h-11 rounded-full px-4 text-danger hover:bg-danger-soft"
              onClick={() => setDisconnecting(true)}
            >
              {t.disconnect}
            </Button>
          </div>
        )}

        {(!connection || mode === "connect") && <SetupGuide gateway={gateway} webhookUrl={connection?.webhookUrl ?? null} />}

        {inForm && (
          <form id={formId} onSubmit={submit} className="flex flex-col gap-5">
            {mode === "connect" && (
              <fieldset className="flex flex-col gap-3">
                <legend className="text-sm font-semibold text-ink">{t.credentialsTitle}</legend>
                <p className="text-[13px] leading-5 text-ink-soft">{t.credentialsHint}</p>
                {gateway.credentialFields.map((field) => (
                  <TextInput
                    key={field.key}
                    label={field.label[locale]}
                    type={field.secret ? "password" : "text"}
                    placeholder={field.placeholder}
                    value={credentials[field.key] ?? ""}
                    onChange={(v) => setCredentials((c) => ({ ...c, [field.key]: v }))}
                    disabled={busy}
                  />
                ))}
                <SigningSecretNote gateway={gateway} typed={credentials} />
              </fieldset>
            )}
            {switchFields.length > 0 && (
              <SettingsGroup>
                {switchFields.map((field) => (
                  <SettingSwitch
                    key={field.key}
                    field={field}
                    checked={switches[field.key] ?? switchOn(field.key)}
                    disabled={busy}
                    onChange={(on) => setSwitches((s) => ({ ...s, [field.key]: on }))}
                  />
                ))}
              </SettingsGroup>
            )}
            {typesIds && (
              <fieldset className="flex flex-col gap-3">
                <legend className="text-sm font-semibold text-ink">{t.methodsTitle}</legend>
                <p className="text-[13px] leading-5 text-ink-soft">{t.methodsHint}</p>
                <div className="grid gap-3 sm:grid-cols-2">
                  {idFields.map((field) => (
                    <TextInput
                      key={field.key}
                      label={field.label[locale]}
                      inputMode="numeric"
                      value={ids[field.key] ?? ""}
                      onChange={(v) => setIds((c) => ({ ...c, [field.key]: v }))}
                      disabled={busy}
                    />
                  ))}
                </div>
              </fieldset>
            )}
          </form>
        )}
      </div>

      <ConfirmDialog
        open={disconnecting}
        title={fmt(t.disconnectTitle, { name })}
        description={fmt(t.disconnectDescription, { name })}
        confirmLabel={t.disconnect}
        cancelLabel={common.cancel}
        busyLabel={common.loading}
        destructive
        onCancel={() => setDisconnecting(false)}
        onConfirm={confirmDisconnect}
      />
      <ConfirmDialog
        open={asking !== null}
        title={t.discardTitle}
        description={t.discardBody}
        confirmLabel={t.discardLeave}
        cancelLabel={t.discardStay}
        destructive
        onCancel={() => setAsking(null)}
        onConfirm={() => {
          const then = asking;
          setAsking(null);
          dropForm();
          if (then === "back") setMode("view");
          else onClose();
        }}
      />
    </Sheet>
  );
}

function WebhookUrl({ gateway, url }: { gateway: PaymentGatewayInfo; url: string }) {
  const t = useT(STRINGS);
  const notes = useGatewayWebhookNotes(gateway);
  if (notes.hideUrl) return null;
  return (
    <div className="flex flex-col gap-1.5">
      <p className="text-sm font-semibold text-ink">{t.webhookTitle}</p>
      <div className="flex min-h-11 items-center gap-2 rounded-[0.875rem] border border-line bg-paper px-3 py-1.5">
        <code dir="ltr" className="min-w-0 flex-1 truncate text-xs text-ink">
          {url}
        </code>
        <CopyButton value={url} label={t.copyWebhook} />
      </div>
      <p className="text-[13px] leading-5 text-ink-soft">
        {notes.hint ??
          fmt(gateway.webhookSetup.automatic ? t.webhookHintAutomatic : t.webhookHint, {
            field: gateway.webhookSetup.field,
            name: gateway.name,
          })}
      </p>
      <WebhookEvents gateway={gateway} />
    </div>
  );
}

/** The server's numbered steps, folded to one row so the keys stay on the first screen. */
function SetupGuide({ gateway, webhookUrl }: { gateway: PaymentGatewayInfo; webhookUrl: string | null }) {
  const t = useT(STRINGS);
  const { locale } = useLocale();
  const steps = gateway.setupSteps[locale];
  return (
    <AccordionSection
      title={fmt(t.setupTitle, { name: gateway.name })}
      summary={pluralOf(t, "steps", steps.length)}
      persistKey={`payments:guide:${gateway.code}`}
    >
      <div className="flex flex-col gap-3">
        <ol className="list-decimal space-y-1.5 ps-5 text-sm leading-6 text-ink-soft">
          {steps.map((step) => (
            <li key={step}>{step}</li>
          ))}
        </ol>
        {webhookUrl && <WebhookUrl gateway={gateway} url={webhookUrl} />}
        {gateway.helpLinks.length > 0 && (
          <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm">
            <span className="text-ink-soft">{t.helpLinks}:</span>
            {gateway.helpLinks.map((link) => (
              <a
                key={link.url}
                href={link.url}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex min-h-11 items-center gap-1 text-primary hover:underline"
              >
                {link.label[locale]}
                <IconExternal className="size-3.5" aria-hidden />
              </a>
            ))}
          </div>
        )}
      </div>
    </AccordionSection>
  );
}

function TextInput({
  label,
  value,
  onChange,
  disabled,
  type = "text",
  placeholder,
  inputMode,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  disabled: boolean;
  type?: "text" | "password";
  placeholder?: string;
  inputMode?: "numeric";
}) {
  const id = useId();
  return (
    <div className="flex flex-col gap-1.5">
      <Label htmlFor={id}>{label}</Label>
      <Input
        id={id}
        type={type}
        dir="ltr"
        autoComplete="off"
        spellCheck={false}
        inputMode={inputMode}
        placeholder={placeholder}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        disabled={disabled}
        className={FIELD}
      />
    </div>
  );
}
