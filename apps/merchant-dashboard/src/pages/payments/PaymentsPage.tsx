import { useEffect, useState, type FormEvent } from "react";
import { Banknote, Landmark } from "lucide-react";
import { Button, Card, CardContent, CardDescription, CardHeader, CardTitle, Input, Tabs, TabsContent, TabsList, TabsTrigger, cn } from "@store-builder/ui";
import { mockApi } from "@/mock/api";
import type { CheckoutSettings, CurrencySetting, PaymentGateway } from "@/mock/types";
import { useWorkspaceId } from "@/lib/useWorkspaceId";
import { useAsync } from "@/lib/useAsync";
import { formatMoney, majorToMinor, minorToMajorInput } from "@/lib/format";
import { useCommon, useLocale, useT, fmt, type Locale, type Messages } from "@/i18n/LocaleContext";
import { PageHeader } from "@/components/PageHeader";
import { DataState } from "@/components/DataState";
import { StatusBadge } from "@/components/StatusBadge";
import { Modal } from "@/components/Modal";
import { TextField, Field } from "@/components/Field";
import { Select } from "@/components/Select";
import { Toggle } from "@/components/Toggle";
import { useToast } from "@/components/Toast";

const STRINGS = {
  en: {
    title: "Payments",
    description: "Payment gateways, the currencies you sell in, and how COD cash reaches your bank.",
    tabGateways: "Gateways",
    tabCurrencies: "Currencies",
    tabPayouts: "Payouts",
    // Gateways
    enabledToast: "{name} enabled.",
    disabledToast: "{name} disabled.",
    configuredToast: "{name} configured.",
    configured: "Configured",
    notConfigured: "Not configured",
    fee: "Fee",
    perTransaction: "per transaction",
    configureFirst: "Configure first",
    configure: "Configure",
    reconfigure: "Reconfigure",
    configureTitle: "Configure {name}",
    // COD options
    codFeeInvalid: "Enter a valid COD fee.",
    codSaved: "COD options saved.",
    otpOn: "Phone OTP required for COD.",
    otpOff: "Phone OTP no longer required.",
    codFee: "COD fee",
    codFeeHint: "Added to the order total for cash-on-delivery orders. Leave blank for none.",
    otpLabel: "Require phone OTP for COD",
    otpDesc: "Customer confirms an SMS code before a COD order is placed.",
    // Config form
    codNoCredentials: "Cash on delivery needs no credentials. Confirm to mark it configured.",
    apiKey: "API key",
    apiSecret: "API secret",
    merchantId: "Merchant ID",
    optional: "Optional.",
    // Currencies
    currenciesSaved: "Currencies saved.",
    colCurrency: "Currency",
    colEnabled: "Enabled",
    colDefault: "Default",
    colRate: "Rate to default",
    colRounding: "Rounding",
    makeDefault: "Make {code} default",
    remove: "Remove",
    addCurrency: "Add currency",
    selectPlaceholder: "Select…",
    saveCurrencies: "Save currencies",
    // Payouts
    howTitle: "How COD payouts work",
    howDesc:
      "Your carrier collects cash from the customer at the door, deducts its shipping and COD fees, and settles the balance to your bank account every week. Card and wallet payments are paid out by the gateway on its own schedule.",
    step1: "1. Delivered",
    step1Desc: "Courier collects the order total in cash.",
    step2: "2. Reconciled",
    step2Desc: "Carrier matches cash to delivered shipments.",
    step3: "3. Settled weekly",
    step3Desc: "Net amount is transferred to your bank.",
    recentSettlements: "Recent settlements",
    colSettlement: "Settlement",
    colPeriod: "Period",
    colCarrier: "Carrier",
    colOrders: "Orders",
    colNet: "Net amount",
    paid: "Paid",
    pending: "Pending",
  },
  ar: {
    title: "المدفوعات",
    description: "بوابات الدفع، والعملات التي تبيع بها، وكيف تصل نقدية الدفع عند الاستلام إلى حسابك البنكي.",
    tabGateways: "بوابات الدفع",
    tabCurrencies: "العملات",
    tabPayouts: "التحويلات",
    enabledToast: "تم تفعيل {name}.",
    disabledToast: "تم تعطيل {name}.",
    configuredToast: "تم إعداد {name}.",
    configured: "تم الإعداد",
    notConfigured: "غير مُعَد",
    fee: "الرسوم",
    perTransaction: "لكل عملية",
    configureFirst: "قم بالإعداد أولًا",
    configure: "إعداد",
    reconfigure: "إعادة الإعداد",
    configureTitle: "إعداد {name}",
    codFeeInvalid: "أدخل رسوم دفع عند الاستلام صحيحة.",
    codSaved: "تم حفظ خيارات الدفع عند الاستلام.",
    otpOn: "أصبح رمز التحقق OTP مطلوبًا لطلبات الدفع عند الاستلام.",
    otpOff: "لم يعد رمز التحقق OTP مطلوبًا.",
    codFee: "رسوم الدفع عند الاستلام",
    codFeeHint: "تُضاف إلى إجمالي طلبات الدفع عند الاستلام. اتركها فارغة لعدم إضافة رسوم.",
    otpLabel: "طلب رمز تحقق OTP للدفع عند الاستلام",
    otpDesc: "يؤكد العميل رمزًا يصله برسالة SMS قبل إنشاء طلب الدفع عند الاستلام.",
    codNoCredentials: "الدفع عند الاستلام لا يحتاج إلى بيانات اعتماد. أكّد لتحديده كمُعَد.",
    apiKey: "مفتاح API",
    apiSecret: "المفتاح السري لـ API",
    merchantId: "معرّف التاجر",
    optional: "اختياري.",
    currenciesSaved: "تم حفظ العملات.",
    colCurrency: "العملة",
    colEnabled: "مفعّلة",
    colDefault: "الافتراضية",
    colRate: "سعر الصرف مقابل الافتراضية",
    colRounding: "التقريب",
    makeDefault: "اجعل {code} العملة الافتراضية",
    remove: "إزالة",
    addCurrency: "إضافة عملة",
    selectPlaceholder: "اختر…",
    saveCurrencies: "حفظ العملات",
    howTitle: "كيف تعمل تحويلات الدفع عند الاستلام",
    howDesc:
      "تحصّل شركة الشحن النقدية من العميل عند الباب، وتخصم رسوم الشحن والتحصيل، ثم تحوّل الرصيد إلى حسابك البنكي كل أسبوع. أما مدفوعات البطاقات والمحافظ فتحوّلها بوابة الدفع وفق جدولها الخاص.",
    step1: "1. التسليم",
    step1Desc: "المندوب يحصّل إجمالي الطلب نقدًا.",
    step2: "2. المطابقة",
    step2Desc: "شركة الشحن تطابق النقدية مع الشحنات المسلَّمة.",
    step3: "3. التسوية أسبوعيًا",
    step3Desc: "يُحوَّل صافي المبلغ إلى حسابك البنكي.",
    recentSettlements: "أحدث التسويات",
    colSettlement: "التسوية",
    colPeriod: "الفترة",
    colCarrier: "شركة الشحن",
    colOrders: "الطلبات",
    colNet: "صافي المبلغ",
    paid: "مدفوعة",
    pending: "قيد الانتظار",
  },
} satisfies Messages;

const GATEWAY_LOGO: Record<PaymentGateway["key"], string> = {
  cod: "COD",
  paymob: "PM",
  fawry: "F",
  stripe: "S",
  paypal: "PP",
  instapay: "IP",
};

const CURRENCY_OPTIONS = ["EGP", "SAR", "AED", "KWD", "USD", "EUR"] as const;
const ROUNDING_KEYS: CurrencySetting["rounding"][] = ["none", "0.99", "whole"];
const ROUNDING_LABEL: Record<Locale, Record<CurrencySetting["rounding"], string>> = {
  en: { none: "No rounding", "0.99": "End in .99", whole: "Whole number" },
  ar: { none: "بدون تقريب", "0.99": "ينتهي بـ .99", whole: "رقم صحيح" },
};

export function PaymentsPage() {
  const t = useT(STRINGS);
  return (
    <div className="min-w-0 max-w-5xl">
      <PageHeader title={t.title} description={t.description} />
      <Tabs defaultValue="gateways">
        <TabsList>
          <TabsTrigger value="gateways">{t.tabGateways}</TabsTrigger>
          <TabsTrigger value="currencies">{t.tabCurrencies}</TabsTrigger>
          <TabsTrigger value="payouts">{t.tabPayouts}</TabsTrigger>
        </TabsList>
        <TabsContent value="gateways" className="pt-4">
          <GatewaysTab />
        </TabsContent>
        <TabsContent value="currencies" className="pt-4">
          <CurrenciesTab />
        </TabsContent>
        <TabsContent value="payouts" className="pt-4">
          <PayoutsTab />
        </TabsContent>
      </Tabs>
    </div>
  );
}

// ------------------------------------------------------------ Gateways --

function GatewaysTab() {
  const t = useT(STRINGS);
  const c = useCommon();
  const workspaceId = useWorkspaceId();
  const toast = useToast();
  const gateways = useAsync(() => mockApi.listGateways(workspaceId), [workspaceId]);
  const checkout = useAsync(() => mockApi.getCheckoutSettings(workspaceId), [workspaceId]);
  const [configuring, setConfiguring] = useState<PaymentGateway | null>(null);
  const list = gateways.data ?? [];

  async function save(next: PaymentGateway[], message: string) {
    await mockApi.saveGateways(workspaceId, next);
    gateways.setData(next);
    toast.success(message);
  }

  function toggle(g: PaymentGateway, enabled: boolean) {
    void save(
      list.map((x) => (x.key === g.key ? { ...x, enabled } : x)),
      enabled ? fmt(t.enabledToast, { name: g.name }) : fmt(t.disabledToast, { name: g.name })
    );
  }

  return (
    <DataState loading={gateways.loading} error={gateways.error} onRetry={() => gateways.refresh()}>
      <div className="grid gap-4 md:grid-cols-2">
        {list.map((g) => (
          <Card key={g.key} className={cn("min-w-0 rounded-2xl p-5", !g.configured && "opacity-90")}>
            <div className="flex items-start gap-3">
              <span className="flex size-11 shrink-0 items-center justify-center rounded-[0.6rem] bg-accent-soft font-display text-xs font-semibold text-accent-dark" dir="ltr">
                {GATEWAY_LOGO[g.key]}
              </span>
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <p className="font-medium text-ink">{g.name}</p>
                  <StatusBadge
                    value={g.configured ? "configured" : "not_configured"}
                    tone={g.configured ? "success" : "warning"}
                    label={g.configured ? t.configured : t.notConfigured}
                  />
                </div>
                <p className="text-xs text-ink-soft">
                  {t.fee} <span dir="ltr">{g.feePercent}%</span> {t.perTransaction}
                </p>
                <div className="mt-2 flex flex-wrap gap-1">
                  {g.currencies.map((cur) => (
                    <span key={cur} className="rounded-full border border-line bg-paper px-2 py-0.5 text-[11px] font-medium text-ink-soft">
                      {cur}
                    </span>
                  ))}
                </div>
              </div>
              <span title={g.configured ? (g.enabled ? c.enabled : c.disabled) : t.configureFirst}>
                <Toggle checked={g.enabled} disabled={!g.configured} onChange={(v) => toggle(g, v)} />
              </span>
            </div>

            {g.key === "cod" && checkout.data && (
              <CodOptions
                settings={checkout.data}
                onSaved={(s) => {
                  checkout.setData(s);
                }}
              />
            )}

            <div className="mt-4 border-t border-line pt-3">
              <Button size="sm" variant="outline" onClick={() => setConfiguring(g)}>
                {g.configured ? t.reconfigure : t.configure}
              </Button>
            </div>
          </Card>
        ))}
      </div>

      <Modal open={configuring !== null} onClose={() => setConfiguring(null)} title={fmt(t.configureTitle, { name: configuring?.name ?? "" })}>
        {configuring && (
          <GatewayConfigForm
            key={configuring.key}
            gateway={configuring}
            onCancel={() => setConfiguring(null)}
            onDone={async () => {
              const g = configuring;
              await save(
                list.map((x) => (x.key === g.key ? { ...x, configured: true } : x)),
                fmt(t.configuredToast, { name: g.name })
              );
              setConfiguring(null);
            }}
          />
        )}
      </Modal>
    </DataState>
  );
}

function CodOptions({ settings, onSaved }: { settings: CheckoutSettings; onSaved: (s: CheckoutSettings) => void }) {
  const t = useT(STRINGS);
  const c = useCommon();
  const workspaceId = useWorkspaceId();
  const toast = useToast();
  const [fee, setFee] = useState(minorToMajorInput(settings.codFeeAmount ?? null));
  const [otp, setOtp] = useState(settings.phoneOtpVerification);
  const [saving, setSaving] = useState(false);

  async function saveFee() {
    const minor = fee.trim() === "" ? null : majorToMinor(fee);
    if (minor !== null && (!Number.isFinite(minor) || minor < 0)) {
      toast.error(t.codFeeInvalid);
      return;
    }
    setSaving(true);
    try {
      const next = { ...settings, codFeeAmount: minor === null ? null : String(minor), phoneOtpVerification: otp };
      await mockApi.saveCheckoutSettings(workspaceId, next);
      onSaved(next);
      toast.success(t.codSaved);
    } finally {
      setSaving(false);
    }
  }

  async function toggleOtp(v: boolean) {
    setOtp(v);
    const next = { ...settings, phoneOtpVerification: v };
    await mockApi.saveCheckoutSettings(workspaceId, next);
    onSaved(next);
    toast.success(v ? t.otpOn : t.otpOff);
  }

  return (
    <div className="mt-4 space-y-3 rounded-xl border border-line bg-paper p-3">
      <Field label={t.codFee} hint={t.codFeeHint}>
        {({ id }) => (
          <div className="flex gap-2">
            <Input id={id} type="number" min={0} step="0.01" dir="ltr" value={fee} onChange={(e) => setFee(e.target.value)} placeholder="0.00" className="min-w-0" />
            <Button type="button" size="sm" variant="outline" className="h-10" onClick={saveFee} disabled={saving}>
              {saving ? c.saving : c.save}
            </Button>
          </div>
        )}
      </Field>
      <Toggle label={t.otpLabel} description={t.otpDesc} checked={otp} onChange={toggleOtp} />
    </div>
  );
}

function GatewayConfigForm({ gateway, onCancel, onDone }: { gateway: PaymentGateway; onCancel: () => void; onDone: () => Promise<void> }) {
  const t = useT(STRINGS);
  const c = useCommon();
  const [apiKey, setApiKey] = useState("");
  const [secret, setSecret] = useState("");
  const [merchantId, setMerchantId] = useState("");
  const [saving, setSaving] = useState(false);
  const isCod = gateway.key === "cod";

  async function submit(e: FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      await onDone();
    } finally {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={submit} className="space-y-4">
      {isCod ? (
        <p className="text-sm text-ink-soft">{t.codNoCredentials}</p>
      ) : (
        <>
          <TextField label={t.apiKey} required type="password" autoComplete="off" dir="ltr" value={apiKey} onChange={(e) => setApiKey(e.target.value)} />
          <TextField label={t.apiSecret} required type="password" autoComplete="off" dir="ltr" value={secret} onChange={(e) => setSecret(e.target.value)} />
          <TextField label={t.merchantId} type="password" autoComplete="off" dir="ltr" value={merchantId} onChange={(e) => setMerchantId(e.target.value)} hint={t.optional} />
        </>
      )}
      <div className="flex flex-wrap justify-end gap-3">
        <Button type="button" variant="outline" onClick={onCancel} disabled={saving}>
          {c.cancel}
        </Button>
        <Button type="submit" disabled={saving || (!isCod && (apiKey.trim() === "" || secret.trim() === ""))}>
          {saving ? c.saving : c.save}
        </Button>
      </div>
    </form>
  );
}

// ---------------------------------------------------------- Currencies --

function CurrenciesTab() {
  const t = useT(STRINGS);
  const c = useCommon();
  const { locale } = useLocale();
  const workspaceId = useWorkspaceId();
  const toast = useToast();
  const currencies = useAsync(() => mockApi.listCurrencies(workspaceId), [workspaceId]);
  const [draft, setDraft] = useState<CurrencySetting[]>([]);
  const [adding, setAdding] = useState<string>("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (currencies.data) setDraft(currencies.data);
  }, [currencies.data]);

  const available = CURRENCY_OPTIONS.filter((code) => !draft.some((d) => d.code === code));

  function update(code: string, patch: Partial<CurrencySetting>) {
    setDraft((prev) => prev.map((x) => (x.code === code ? { ...x, ...patch } : x)));
  }

  function setDefault(code: string) {
    setDraft((prev) => prev.map((x) => ({ ...x, isDefault: x.code === code, enabled: x.code === code ? true : x.enabled })));
  }

  function add() {
    if (!adding) return;
    setDraft((prev) => [...prev, { code: adding, enabled: true, isDefault: false, rateToDefault: 1, rounding: "none" }]);
    setAdding("");
  }

  async function save() {
    setSaving(true);
    try {
      await mockApi.saveCurrencies(workspaceId, draft);
      currencies.setData(draft);
      toast.success(t.currenciesSaved);
    } finally {
      setSaving(false);
    }
  }

  return (
    <DataState loading={currencies.loading} error={currencies.error} onRetry={() => currencies.refresh()}>
      <div className="space-y-4">
        <div className="overflow-x-auto rounded-2xl border border-line bg-paper-raised">
          <table className="w-full min-w-[640px] text-sm">
            <thead>
              <tr className="border-b border-line bg-paper-raised text-xs uppercase tracking-wide text-ink-soft">
                <th className="px-4 py-3 text-start font-medium">{t.colCurrency}</th>
                <th className="px-4 py-3 text-start font-medium">{t.colEnabled}</th>
                <th className="px-4 py-3 text-start font-medium">{t.colDefault}</th>
                <th className="px-4 py-3 text-start font-medium">{t.colRate}</th>
                <th className="px-4 py-3 text-start font-medium">{t.colRounding}</th>
                <th className="px-4 py-3 font-medium">
                  <span className="sr-only">{c.actions}</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {draft.map((cur) => (
                <tr key={cur.code} className="border-b border-line bg-paper last:border-0">
                  <td className="px-4 py-3 text-start font-medium text-ink">{cur.code}</td>
                  <td className="px-4 py-3 text-start">
                    <Toggle checked={cur.enabled} disabled={cur.isDefault} onChange={(v) => update(cur.code, { enabled: v })} />
                  </td>
                  <td className="px-4 py-3 text-start">
                    <input type="radio" name="default-currency" checked={cur.isDefault} onChange={() => setDefault(cur.code)} aria-label={fmt(t.makeDefault, { code: cur.code })} />
                  </td>
                  <td className="px-4 py-3 text-start">
                    <Input
                      type="number"
                      step="0.0001"
                      min={0}
                      dir="ltr"
                      value={cur.rateToDefault}
                      disabled={cur.isDefault}
                      onChange={(e) => update(cur.code, { rateToDefault: Number(e.target.value) })}
                      className="h-9 max-w-[140px] tabular-nums"
                      aria-label={`${t.colRate} (${cur.code})`}
                    />
                  </td>
                  <td className="px-4 py-3 text-start">
                    <Select
                      value={cur.rounding}
                      onChange={(e) => update(cur.code, { rounding: e.target.value as CurrencySetting["rounding"] })}
                      className="h-9 max-w-[160px]"
                      aria-label={`${t.colRounding} (${cur.code})`}
                    >
                      {ROUNDING_KEYS.map((r) => (
                        <option key={r} value={r}>
                          {ROUNDING_LABEL[locale][r]}
                        </option>
                      ))}
                    </Select>
                  </td>
                  <td className="px-4 py-3 text-end">
                    {!cur.isDefault && (
                      <Button size="sm" variant="ghost" className="text-danger hover:bg-danger-soft" onClick={() => setDraft((p) => p.filter((x) => x.code !== cur.code))}>
                        {t.remove}
                      </Button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="flex flex-wrap items-end justify-between gap-3">
          <div className="flex flex-wrap items-end gap-2">
            <Field label={t.addCurrency}>
              {({ id }) => (
                <Select id={id} value={adding} onChange={(e) => setAdding(e.target.value)} className="w-40" disabled={available.length === 0}>
                  <option value="">{t.selectPlaceholder}</option>
                  {available.map((code) => (
                    <option key={code} value={code}>
                      {code}
                    </option>
                  ))}
                </Select>
              )}
            </Field>
            <Button variant="outline" className="h-10" onClick={add} disabled={!adding}>
              {c.add}
            </Button>
          </div>
          <Button onClick={save} disabled={saving}>
            {saving ? c.saving : t.saveCurrencies}
          </Button>
        </div>
      </div>
    </DataState>
  );
}

// ------------------------------------------------------------- Payouts --

const SETTLEMENTS = [
  { id: "st-1041", period: "Sep 1 – Sep 7", carrier: "Bosta", orders: 212, amount: 18734000, status: "paid" },
  { id: "st-1040", period: "Aug 25 – Aug 31", carrier: "Bosta", orders: 198, amount: 17210000, status: "paid" },
  { id: "st-1039", period: "Aug 25 – Aug 31", carrier: "J&T Express", orders: 41, amount: 3928000, status: "paid" },
  { id: "st-1042", period: "Sep 8 – Sep 14", carrier: "Bosta", orders: 96, amount: 8412000, status: "pending" },
];

function PayoutsTab() {
  const t = useT(STRINGS);
  const c = useCommon();
  const payoutStatusLabel = (s: string): string | undefined => (s === "paid" ? t.paid : s === "pending" ? t.pending : undefined);
  const steps: Array<[string, string]> = [
    [t.step1, t.step1Desc],
    [t.step2, t.step2Desc],
    [t.step3, t.step3Desc],
  ];

  return (
    <div className="space-y-6">
      <Card className="rounded-2xl p-5">
        <CardHeader className="px-0">
          <CardTitle className="flex items-center gap-2 text-ink">
            <Landmark className="size-4 text-primary" /> {t.howTitle}
          </CardTitle>
          <CardDescription className="text-ink-soft">{t.howDesc}</CardDescription>
        </CardHeader>
        <CardContent className="px-0">
          <ol className="grid gap-3 text-sm sm:grid-cols-3">
            {steps.map(([title, desc]) => (
              <li key={title} className="rounded-2xl border border-line bg-paper p-3">
                <p className="font-medium text-ink">{title}</p>
                <p className="mt-0.5 text-xs text-ink-soft">{desc}</p>
              </li>
            ))}
          </ol>
        </CardContent>
      </Card>

      <section>
        <h2 className="mb-3 flex items-center gap-2 font-display text-lg font-semibold text-ink">
          <Banknote className="size-4 text-ink-soft" /> {t.recentSettlements}
        </h2>
        <div className="overflow-x-auto rounded-2xl border border-line bg-paper-raised">
          <table className="w-full min-w-[640px] text-sm">
            <thead>
              <tr className="border-b border-line bg-paper-raised text-xs uppercase tracking-wide text-ink-soft">
                <th className="px-4 py-3 text-start font-medium">{t.colSettlement}</th>
                <th className="px-4 py-3 text-start font-medium">{t.colPeriod}</th>
                <th className="px-4 py-3 text-start font-medium">{t.colCarrier}</th>
                <th className="px-4 py-3 text-end font-medium">{t.colOrders}</th>
                <th className="px-4 py-3 text-end font-medium">{t.colNet}</th>
                <th className="px-4 py-3 text-start font-medium">{c.status}</th>
              </tr>
            </thead>
            <tbody>
              {SETTLEMENTS.map((s) => (
                <tr key={s.id} className="border-b border-line bg-paper last:border-0">
                  <td className="px-4 py-3 text-start font-medium text-ink">
                    <span dir="ltr">{s.id}</span>
                  </td>
                  <td className="px-4 py-3 text-start text-ink-soft">
                    <bdi>{s.period}</bdi>
                  </td>
                  <td className="px-4 py-3 text-start text-ink-soft">{s.carrier}</td>
                  <td className="px-4 py-3 text-end tabular-nums text-ink-soft">{s.orders}</td>
                  <td className="px-4 py-3 text-end tabular-nums text-ink">
                    <bdi>{formatMoney(s.amount, "EGP")}</bdi>
                  </td>
                  <td className="px-4 py-3 text-start">
                    <StatusBadge value={s.status} label={payoutStatusLabel(s.status)} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
