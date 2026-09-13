import { useState, type FormEvent, type ReactNode } from "react";
import { Link } from "react-router-dom";
import { Banknote, MapPin, PackageCheck, Plug, Truck } from "lucide-react";
import { Button, Card, CardContent, CardDescription, CardHeader, CardTitle, cn } from "@store-builder/ui";
import { mockApi } from "@/mock/api";
import type { Carrier, CarrierAccount, CarrierKey } from "@/mock/types";
import { useWorkspaceId } from "@/lib/useWorkspaceId";
import { useAsync } from "@/lib/useAsync";
import { fmt, useCommon, useLocale, useT, type Locale, type Messages } from "@/i18n/LocaleContext";
import { DataState } from "@/components/DataState";
import { StatusBadge } from "@/components/StatusBadge";
import { Modal } from "@/components/Modal";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { TextField, Field } from "@/components/Field";
import { Select } from "@/components/Select";
import { Toggle } from "@/components/Toggle";
import { EmptyState } from "@/components/EmptyState";
import { useToast } from "@/components/Toast";

const STRINGS = {
  en: {
    connectedTitle: "Connected carriers",
    connectedDesc: "Shipments are created with these accounts. COD collection is settled by the carrier.",
    connectCarrier: "Connect carrier",
    emptyTitle: "No carriers connected",
    emptyDesc: "Connect Bosta, Aramex, J&T or another carrier to create shipments straight from your orders.",
    shipmentsThisMonth: "{n} shipments this month",
    autoCreate: "Auto-create shipment",
    codCollection: "COD collection",
    codUnsupported: "This carrier does not support cash on delivery.",
    codSupported: "Carrier collects cash from the customer and settles it to you.",
    setDefault: "Set as default",
    testConnection: "Test connection",
    disconnect: "Disconnect",
    toastSaved: "Saved.",
    toastConnectionOk: "{label}: connection OK.",
    toastDisconnected: "{label} disconnected.",
    toastNowDefault: "{label} is now the default carrier.",
    toastConnected: "{name} connected.",
    bulkTitle: "Bulk create shipments",
    bulkDescBefore: "Select confirmed orders in Orders, then choose",
    bulkDescAction: "Create shipments",
    bulkDescAfter:
      ". Each one is booked with your default carrier, and tracking numbers are written back to the order and sent to the customer.",
    goToOrders: "Go to orders",
    confirmTitle: "Disconnect \"{label}\"?",
    confirmDesc: "New shipments can no longer be created with this account. Existing shipments keep their tracking.",
    capCod: "COD",
    capTracking: "Tracking",
    capPickup: "Pickup",
    credentials: "{name} credentials",
    labelField: "Label",
    manualNote: "Manual carriers have no API — you will enter tracking numbers yourself.",
    apiKey: "API key",
    apiSecret: "API secret",
    apiSecretHint: "Optional — only some carriers issue a secret.",
    connecting: "Connecting…",
    connect: "Connect",
  },
  ar: {
    connectedTitle: "شركات الشحن المرتبطة",
    connectedDesc: "تُنشأ الشحنات بهذه الحسابات. شركة الشحن تحصّل مبالغ الدفع عند الاستلام وتسوّيها معك.",
    connectCarrier: "ربط شركة شحن",
    emptyTitle: "لا توجد شركات شحن مرتبطة",
    emptyDesc: "اربط Bosta أو Aramex أو J&T أو أي شركة شحن أخرى لإنشاء الشحنات مباشرةً من طلباتك.",
    shipmentsThisMonth: "{n} شحنة هذا الشهر",
    autoCreate: "إنشاء الشحنة تلقائيًا",
    codCollection: "تحصيل الدفع عند الاستلام",
    codUnsupported: "شركة الشحن هذه لا تدعم الدفع عند الاستلام.",
    codSupported: "تحصّل شركة الشحن المبلغ نقدًا من العميل وتحوّله إليك.",
    setDefault: "تعيين كافتراضية",
    testConnection: "اختبار الاتصال",
    disconnect: "فصل الربط",
    toastSaved: "تم الحفظ.",
    toastConnectionOk: "{label}: الاتصال يعمل بنجاح.",
    toastDisconnected: "تم فصل {label}.",
    toastNowDefault: "أصبحت {label} شركة الشحن الافتراضية.",
    toastConnected: "تم ربط {name}.",
    bulkTitle: "إنشاء شحنات بالجملة",
    bulkDescBefore: "حدّد الطلبات المؤكدة من صفحة الطلبات، ثم اختر",
    bulkDescAction: "إنشاء شحنات",
    bulkDescAfter:
      ". تُحجز كل شحنة مع شركة الشحن الافتراضية، وتُضاف أرقام التتبع إلى الطلب وتُرسل إلى العميل.",
    goToOrders: "الذهاب إلى الطلبات",
    confirmTitle: "فصل ربط «{label}»؟",
    confirmDesc: "لن يمكن إنشاء شحنات جديدة بهذا الحساب. الشحنات الحالية تحتفظ ببيانات التتبع.",
    capCod: "دفع عند الاستلام",
    capTracking: "تتبع",
    capPickup: "استلام من المتجر",
    credentials: "بيانات الربط مع {name}",
    labelField: "الاسم المعروض",
    manualNote: "شركات الشحن اليدوية ليس لها API — ستُدخل أرقام التتبع بنفسك.",
    apiKey: "مفتاح API",
    apiSecret: "الرمز السري لـ API",
    apiSecretHint: "اختياري — بعض شركات الشحن فقط تصدر رمزًا سريًا.",
    connecting: "جارٍ الربط…",
    connect: "ربط",
  },
} satisfies Messages;

const STATUS_TONE: Record<CarrierAccount["status"], "success" | "danger" | "neutral"> = {
  connected: "success",
  error: "danger",
  disconnected: "neutral",
};

type AutoCreate = CarrierAccount["autoCreateShipmentOn"];

const AUTO_CREATE_LABEL: Record<Locale, Record<AutoCreate, string>> = {
  en: {
    never: "Never (manual)",
    confirmed: "When order is confirmed",
    paid: "When order is paid",
  },
  ar: {
    never: "أبدًا (يدويًا)",
    confirmed: "عند تأكيد الطلب",
    paid: "عند دفع الطلب",
  },
};

function LogoChip({ text, className }: { text: string; className?: string }) {
  return (
    <span
      dir="ltr"
      className={cn(
        "flex size-11 shrink-0 items-center justify-center rounded-xl bg-primary-soft font-display text-sm font-semibold text-primary-dark",
        className
      )}
    >
      {text}
    </span>
  );
}

export function CarriersSection() {
  const t = useT(STRINGS);
  const { locale, intlLocale } = useLocale();
  const autoCreateLabel = AUTO_CREATE_LABEL[locale];
  const workspaceId = useWorkspaceId();
  const toast = useToast();
  const data = useAsync(
    () =>
      Promise.all([mockApi.listCarriers(), mockApi.listCarrierAccounts(workspaceId)]).then(([carriers, accounts]) => ({
        carriers,
        accounts,
      })),
    [workspaceId]
  );
  const [connecting, setConnecting] = useState(false);
  const [disconnecting, setDisconnecting] = useState<CarrierAccount | null>(null);

  const carriers = data.data?.carriers ?? [];
  const accounts = data.data?.accounts ?? [];
  const carrierByKey = new Map(carriers.map((c) => [c.key, c]));
  const reload = () => data.refresh({ silent: true });

  async function patch(acc: CarrierAccount, changes: Partial<CarrierAccount>, message?: string) {
    await mockApi.saveCarrierAccount(workspaceId, { ...acc, ...changes });
    if (message) toast.success(message);
    reload();
  }

  async function testConnection(acc: CarrierAccount) {
    await mockApi.saveCarrierAccount(workspaceId, { ...acc, status: "connected" });
    toast.success(fmt(t.toastConnectionOk, { label: acc.label }));
    reload();
  }

  async function confirmDisconnect() {
    if (!disconnecting) return;
    await mockApi.deleteCarrierAccount(workspaceId, disconnecting.id);
    toast.success(fmt(t.toastDisconnected, { label: disconnecting.label }));
    setDisconnecting(null);
    reload();
  }

  return (
    <div className="space-y-8">
      <section>
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <div className="min-w-0">
            <h2 className="font-display text-lg font-semibold text-ink">{t.connectedTitle}</h2>
            <p className="mt-1 text-sm text-ink-soft">{t.connectedDesc}</p>
          </div>
          <Button onClick={() => setConnecting(true)}>
            <Plug /> {t.connectCarrier}
          </Button>
        </div>

        <DataState loading={data.loading} error={data.error} onRetry={() => data.refresh()}>
          {accounts.length === 0 ? (
            <EmptyState
              icon={<Truck />}
              title={t.emptyTitle}
              description={t.emptyDesc}
              action={<Button onClick={() => setConnecting(true)}>{t.connectCarrier}</Button>}
            />
          ) : (
            <div className="grid gap-4 lg:grid-cols-2">
              {accounts.map((acc) => {
                const carrier = carrierByKey.get(acc.carrierKey);
                return (
                  <Card key={acc.id} className={cn("rounded-2xl p-5", acc.status === "error" && "ring-danger/30")}>
                    <div className="flex items-start gap-3">
                      <LogoChip text={carrier?.logoText ?? "?"} />
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <p className="truncate font-semibold text-ink">{acc.label}</p>
                          <StatusBadge value={acc.status} tone={STATUS_TONE[acc.status]} />
                          {acc.isDefault && <StatusBadge value="default" tone="info" />}
                        </div>
                        <p className="text-xs text-ink-soft">
                          <bdi>{carrier?.name ?? acc.carrierKey}</bdi> ·{" "}
                          {fmt(t.shipmentsThisMonth, { n: acc.shipmentsThisMonth.toLocaleString(intlLocale) })}
                        </p>
                      </div>
                    </div>

                    <div className="mt-4 space-y-3">
                      <Field label={t.autoCreate}>
                        {({ id }) => (
                          <Select
                            id={id}
                            value={acc.autoCreateShipmentOn}
                            onChange={(e) =>
                              patch(acc, { autoCreateShipmentOn: e.target.value as AutoCreate }, t.toastSaved)
                            }
                          >
                            {(Object.keys(autoCreateLabel) as AutoCreate[]).map((k) => (
                              <option key={k} value={k}>
                                {autoCreateLabel[k]}
                              </option>
                            ))}
                          </Select>
                        )}
                      </Field>
                      <Toggle
                        label={t.codCollection}
                        description={carrier && !carrier.supportsCod ? t.codUnsupported : t.codSupported}
                        checked={acc.codCollection}
                        disabled={carrier ? !carrier.supportsCod : false}
                        onChange={(v) => patch(acc, { codCollection: v })}
                      />
                    </div>

                    <div className="mt-4 flex flex-wrap items-center gap-1 border-t border-line pt-3">
                      {!acc.isDefault && (
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => patch(acc, { isDefault: true }, fmt(t.toastNowDefault, { label: acc.label }))}
                        >
                          {t.setDefault}
                        </Button>
                      )}
                      <Button size="sm" variant="ghost" onClick={() => testConnection(acc)}>
                        {t.testConnection}
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        className="ms-auto text-danger hover:bg-danger-soft"
                        onClick={() => setDisconnecting(acc)}
                      >
                        {t.disconnect}
                      </Button>
                    </div>
                  </Card>
                );
              })}
            </div>
          )}
        </DataState>
      </section>

      <Card className="rounded-2xl p-5">
        <CardHeader className="px-0">
          <CardTitle className="flex items-center gap-2 font-semibold text-ink">
            <PackageCheck className="size-4 text-primary" /> {t.bulkTitle}
          </CardTitle>
          <CardDescription className="text-ink-soft">
            {t.bulkDescBefore} <span className="font-medium text-ink">{t.bulkDescAction}</span>
            {t.bulkDescAfter}
          </CardDescription>
        </CardHeader>
        <CardContent className="px-0">
          <div>
            <Button variant="outline" asChild>
              <Link to="/orders">{t.goToOrders}</Link>
            </Button>
          </div>
        </CardContent>
      </Card>

      <Modal open={connecting} onClose={() => setConnecting(false)} title={t.connectCarrier} className="max-w-2xl">
        {connecting && (
          <ConnectCarrierForm
            carriers={carriers}
            hasDefault={accounts.some((a) => a.isDefault)}
            onCancel={() => setConnecting(false)}
            onDone={() => {
              setConnecting(false);
              reload();
            }}
          />
        )}
      </Modal>

      <ConfirmDialog
        open={disconnecting !== null}
        title={fmt(t.confirmTitle, { label: disconnecting?.label ?? "" })}
        description={t.confirmDesc}
        confirmLabel={t.disconnect}
        destructive
        onCancel={() => setDisconnecting(null)}
        onConfirm={confirmDisconnect}
      />
    </div>
  );
}

function Capability({ on, icon, label }: { on: boolean; icon: ReactNode; label: string }) {
  return (
    <span
      className={cn("inline-flex items-center gap-1 text-[11px]", on ? "text-success" : "text-ink-soft/50 line-through")}
      title={label}
    >
      <span className="[&>svg]:size-3">{icon}</span>
      {label}
    </span>
  );
}

function ConnectCarrierForm({
  carriers,
  hasDefault,
  onCancel,
  onDone,
}: {
  carriers: Carrier[];
  hasDefault: boolean;
  onCancel: () => void;
  onDone: () => void;
}) {
  const t = useT(STRINGS);
  const c = useCommon();
  const workspaceId = useWorkspaceId();
  const toast = useToast();
  const [selected, setSelected] = useState<CarrierKey | null>(null);
  const [label, setLabel] = useState("");
  const [apiKey, setApiKey] = useState("");
  const [apiSecret, setApiSecret] = useState("");
  const [saving, setSaving] = useState(false);
  const carrier = carriers.find((item) => item.key === selected) ?? null;

  function pick(item: Carrier) {
    setSelected(item.key);
    setLabel((prev) => (prev.trim() === "" ? item.name : prev));
  }

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (!carrier) return;
    setSaving(true);
    try {
      await mockApi.saveCarrierAccount(workspaceId, {
        id: `ca-${Date.now().toString(36)}`,
        workspaceId,
        carrierKey: carrier.key,
        label: label.trim() || carrier.name,
        status: "connected",
        isDefault: !hasDefault,
        credentialsSet: true,
        autoCreateShipmentOn: "never",
        codCollection: carrier.supportsCod,
        shipmentsThisMonth: 0,
        connectedAt: new Date().toISOString(),
      });
      toast.success(fmt(t.toastConnected, { name: carrier.name }));
      onDone();
    } finally {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={submit} className="space-y-5">
      <div className="grid gap-3 sm:grid-cols-3">
        {carriers.map((item) => (
          <button
            key={item.key}
            type="button"
            onClick={() => pick(item)}
            aria-pressed={selected === item.key}
            className={cn(
              "flex flex-col items-start gap-2 rounded-xl border p-3 text-start transition-colors",
              selected === item.key ? "border-primary bg-primary-soft" : "border-line hover:bg-paper-raised"
            )}
          >
            <div className="flex items-center gap-2">
              <LogoChip text={item.logoText} className="size-8 text-xs" />
              <span className="text-sm font-medium text-ink">
                <bdi>{item.name}</bdi>
              </span>
            </div>
            <div className="flex flex-wrap gap-2">
              <Capability on={item.supportsCod} icon={<Banknote />} label={t.capCod} />
              <Capability on={item.supportsTracking} icon={<MapPin />} label={t.capTracking} />
              <Capability on={item.supportsPickup} icon={<Truck />} label={t.capPickup} />
            </div>
          </button>
        ))}
      </div>

      {carrier && (
        <div className="space-y-4 rounded-xl border border-line bg-paper p-4">
          <p className="text-sm font-semibold text-ink">{fmt(t.credentials, { name: carrier.name })}</p>
          <TextField
            label={t.labelField}
            required
            value={label}
            onChange={(e) => setLabel(e.target.value)}
            placeholder={carrier.name}
          />
          {carrier.key === "custom" ? (
            <p className="text-xs text-ink-soft">{t.manualNote}</p>
          ) : (
            <>
              <TextField
                label={t.apiKey}
                required
                type="password"
                autoComplete="off"
                dir="ltr"
                value={apiKey}
                onChange={(e) => setApiKey(e.target.value)}
              />
              <TextField
                label={t.apiSecret}
                type="password"
                autoComplete="off"
                dir="ltr"
                value={apiSecret}
                onChange={(e) => setApiSecret(e.target.value)}
                hint={t.apiSecretHint}
              />
            </>
          )}
        </div>
      )}

      <div className="flex justify-end gap-3">
        <Button type="button" variant="outline" onClick={onCancel} disabled={saving}>
          {c.cancel}
        </Button>
        <Button type="submit" disabled={saving || !carrier || (carrier.key !== "custom" && apiKey.trim() === "")}>
          {saving ? t.connecting : t.connect}
        </Button>
      </div>
    </form>
  );
}
