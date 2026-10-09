import { useEffect, useState } from "react";
import { Button, Input } from "@store-builder/ui";
import {
  funnelsList,
  paymentRulesGet,
  paymentRulesSave,
  type PaymentMethodEntry,
  type PaymentRuleAdjustment,
  type PaymentRuleMethod,
  type PaymentRules,
} from "@store-builder/api-client";
import { IconBank, IconCard, IconCash, IconClock, IconFunnels, IconStore, IconWallet, type IconComponent } from "@/components/icons";
import { apiClient } from "@/lib/apiClient";
import { useAsync } from "@/lib/useAsync";
import { getErrorMessage, isPermissionError } from "@/lib/errors";
import { basisPointsToPercentInput, formatMoney, majorToMinor, minorToMajorInput, percentToBasisPoints } from "@/lib/format";
import { pluralOf } from "@/lib/plural";
import { useReportDirty } from "@/lib/useUnsavedGuard";
import { fmt, useT, type Messages } from "@/i18n/LocaleContext";
import { AccordionSection } from "@/components/Accordion";
import { DataState } from "@/components/DataState";
import { Field } from "@/components/Field";
import { SaveBar } from "@/components/SaveBar";
import { Select } from "@/components/Select";
import { useToast } from "@/components/Toast";
import { FIELD, NoAccess, PaneSkeleton } from "./sections/paneParts";

const STRINGS = {
  en: {
    title: "Payment rules",
    description: "Add a fee or give a discount depending on how the customer pays. It appears as its own line in the order.",
    cod: "Cash on delivery",
    card: "Card",
    wallet: "Mobile wallet",
    valu: "valU installments",
    kiosk: "Kiosk (Aman / Masary)",
    paypal: "PayPal",
    bank_transfer: "Manual transfer",
    none: "No change",
    fee: "Add a fee",
    discount: "Give a discount",
    feeOf: "Fee {amount}",
    discountOf: "Discount {amount}",
    percentOf: "{n}%",
    fixed: "Fixed amount",
    percent: "Percent",
    kind: "Rule for {method}",
    kindLabel: "Rule",
    valueType: "Amount type",
    value: "Value",
    label: "Name on the order",
    labelPlaceholder: "Cash on delivery fee",
    funnelsTitle: "Payment methods per funnel",
    funnelsDesc: "Choose which payment methods each funnel's checkout offers. A funnel with nothing ticked offers all of them.",
    funnelsAll: "Every funnel offers all methods",
    funnelsSome_one: "1 funnel has its own methods",
    funnelsSome_two: "2 funnels have their own methods",
    funnelsSome_few: "{n} funnels have their own methods",
    funnelsSome_other: "{n} funnels have their own methods",
    noFunnels: "No funnels yet.",
    save: "Save",
    saved: "Payment rules saved.",
    invalid: "Enter a value greater than zero for every rule.",
    addOther: "+ Amount in another currency",
    otherCurrency: "Currency",
    otherValue: "Amount",
    removeOther: "Remove",
    othersHint:
      "A fixed amount is in the store's currency ({store}); an order in another currency (a funnel selling in it) gets the amount set for that currency, else none.",
    othersHintPercent: "An order in a currency listed here gets that fixed amount instead of the percentage.",
    invalidCurrency: "Use a 3-letter currency code (like USD), once per method — beside a fixed amount, not the store's own.",
  },
  ar: {
    title: "قواعد الدفع",
    description: "ضيف رسوم أو ادّي خصم حسب طريقة دفع العميل، وبيظهر بند لوحده في الأوردر.",
    cod: "الدفع عند الاستلام",
    card: "كارت",
    wallet: "محفظة إلكترونية",
    valu: "تقسيط valU",
    kiosk: "الدفع في الكشك (أمان / مصاري)",
    paypal: "باي بال",
    bank_transfer: "تحويل يدوي",
    none: "من غير تغيير",
    fee: "ضيف رسوم",
    discount: "ادّي خصم",
    feeOf: "رسوم {amount}",
    discountOf: "خصم {amount}",
    percentOf: "{n}%",
    fixed: "مبلغ ثابت",
    percent: "نسبة مئوية",
    kind: "قاعدة {method}",
    kindLabel: "القاعدة",
    valueType: "نوع القيمة",
    value: "القيمة",
    label: "الاسم في الأوردر",
    labelPlaceholder: "رسوم الدفع عند الاستلام",
    funnelsTitle: "طرق الدفع لكل مسار بيع",
    funnelsDesc: "اختار طرق الدفع اللي كل مسار بيع بيعرضها في الفورم. المسار اللي مش متعلّم له حاجة بيعرض كل الطرق.",
    funnelsAll: "كل المسارات بتعرض كل الطرق",
    funnelsSome_one: "مسار واحد له طرقه",
    funnelsSome_two: "مسارين ليهم طرقهم",
    funnelsSome_few: "{n} مسارات ليها طرقها",
    funnelsSome_other: "{n} مسار ليهم طرقهم",
    noFunnels: "مفيش مسارات بيع لسه.",
    save: "حفظ",
    saved: "اتحفظت قواعد الدفع.",
    invalid: "اكتب قيمة أكبر من صفر لكل قاعدة.",
    addOther: "+ مبلغ بعملة تانية",
    otherCurrency: "العملة",
    otherValue: "المبلغ",
    removeOther: "امسح",
    othersHint: "المبلغ الثابت بعملة المتجر ({store})؛ الأوردر بعملة تانية (مسار بيع بيبيع بيها) بياخد المبلغ المحدد للعملة دي، وإلا مفيش.",
    othersHintPercent: "الأوردر بعملة من اللي هنا بياخد المبلغ الثابت ده بدل النسبة.",
    invalidCurrency: "اكتب كود عملة من 3 حروف (زي USD)، مرة واحدة لكل طريقة — وجنب المبلغ الثابت مش عملة المتجر نفسها.",
  },
} satisfies Messages;

const METHOD_ICON: Record<PaymentRuleMethod, IconComponent> = {
  cod: IconCash,
  card: IconCard,
  wallet: IconWallet,
  valu: IconClock,
  kiosk: IconStore,
  bank_transfer: IconBank,
};

interface Draft {
  kind: "none" | "fee" | "discount";
  valueType: "fixed" | "percent";
  value: string;
  label: string;
  /** Fixed amounts in other currencies than the store's (SPEC §11.5), same kind and name. */
  others: Array<{ currency: string; value: string }>;
}
const EMPTY: Draft = { kind: "none", valueType: "fixed", value: "", label: "", others: [] };

/** A method's rules as one row: its percentage or store-currency amount, plus amounts in other currencies. */
function toDraft(rules: PaymentRuleAdjustment[], store: string): Draft {
  const live = rules.filter((r) => r.enabled);
  const main =
    live.find((r) => r.valueType === "percent") ?? live.find((r) => (r.currency ?? store) === store) ?? live[0];
  if (!main) return EMPTY;
  return {
    kind: main.type,
    valueType: main.valueType,
    value: main.valueType === "percent" ? basisPointsToPercentInput(main.value) : minorToMajorInput(main.value),
    label: main.label ?? "",
    others: live
      .filter((r) => r !== main && r.valueType === "fixed")
      .map((r) => ({ currency: r.currency ?? store, value: minorToMajorInput(r.value) })),
  };
}

function draftsOf(data: PaymentRules): Record<string, Draft> {
  const store = data.storeCurrency ?? "EGP";
  return Object.fromEntries(data.methods.map((m) => [m, toDraft(data.adjustments.filter((a) => a.method === m), store)]));
}

/** One text for "is anything changed": the per-funnel map is compared whatever order its keys and ids are in. */
function snapshot(methods: readonly string[], drafts: Record<string, Draft>, byFunnel: Record<string, string[]>): string {
  return JSON.stringify([
    methods.map((m) => drafts[m] ?? EMPTY),
    Object.keys(byFunnel)
      .sort()
      .map((id) => [id, [...(byFunnel[id] ?? [])].sort()]),
  ]);
}

/**
 * Payments → Payment rules (SPEC §11.4): a fee or a discount per payment
 * method — each method folds to one row that says its rule — and the methods
 * each funnel offers. One save for both, from the save bar.
 */
export function PaymentRulesSettings({
  workspaceId,
  methods,
  canManage,
}: {
  workspaceId: string;
  /** The store's payment methods as the Payments page lists them, for the per-funnel choice. */
  methods: PaymentMethodEntry[];
  canManage: boolean;
}) {
  const t = useT(STRINGS);
  const toast = useToast();
  // Null = this role may not read the rules.
  const rules = useAsync(
    () => paymentRulesGet(apiClient, workspaceId).catch((err) => (isPermissionError(err) ? null : Promise.reject(err))),
    [workspaceId]
  );
  const funnels = useAsync(() => funnelsList(apiClient, workspaceId).catch(() => []), [workspaceId]);
  const [drafts, setDrafts] = useState<Record<string, Draft>>({});
  const [byFunnel, setByFunnel] = useState<Record<string, string[]>>({});
  const [saving, setSaving] = useState(false);

  const data = rules.data;
  useEffect(() => {
    if (!data) return;
    setDrafts(draftsOf(data));
    setByFunnel(data.methodsByFunnel);
  }, [data]);

  const dirty =
    data !== null &&
    Object.keys(drafts).length > 0 &&
    snapshot(data.methods, drafts, byFunnel) !== snapshot(data.methods, draftsOf(data), data.methodsByFunnel);
  useReportDirty(dirty);

  const patch = (method: string, change: Partial<Draft>) =>
    setDrafts((d) => ({ ...d, [method]: { ...(d[method] ?? EMPTY), ...change } }));

  const store = data?.storeCurrency ?? "EGP";

  async function save() {
    if (!data) return;
    const adjustments: PaymentRuleAdjustment[] = [];
    for (const method of data.methods) {
      const d = drafts[method] ?? EMPTY;
      if (d.kind === "none") continue;
      const value = d.valueType === "percent" ? percentToBasisPoints(d.value) : majorToMinor(d.value);
      if (!Number.isFinite(value) || value <= 0 || (d.valueType === "percent" && value > 10000)) return toast.error(t.invalid);
      const label = d.label.trim() || null;
      adjustments.push({ method, type: d.kind, valueType: d.valueType, value, label, enabled: true, currency: d.valueType === "percent" ? null : store });
      const seen = new Set<string>();
      for (const other of d.others) {
        const currency = other.currency.trim().toUpperCase();
        // Beside a fixed amount (in the store's currency) the others are other currencies; beside a percentage any currency.
        if (!/^[A-Z]{3}$/.test(currency) || (d.valueType === "fixed" && currency === store) || seen.has(currency)) return toast.error(t.invalidCurrency);
        seen.add(currency);
        const amount = majorToMinor(other.value);
        if (!Number.isFinite(amount) || amount <= 0) return toast.error(t.invalid);
        adjustments.push({ method, type: d.kind, valueType: "fixed", value: amount, label, enabled: true, currency });
      }
    }
    setSaving(true);
    try {
      rules.setData(await paymentRulesSave(apiClient, workspaceId, { adjustments, methodsByFunnel: byFunnel }));
      toast.success(t.saved);
    } catch (err) {
      toast.error(getErrorMessage(err));
    } finally {
      setSaving(false);
    }
  }

  function discard() {
    if (!data) return;
    setDrafts(draftsOf(data));
    setByFunnel(data.methodsByFunnel);
  }

  /** The closed row of a method: what its rule is, in words. */
  function summaryOf(d: Draft): string {
    if (d.kind === "none") return t.none;
    const typed = Number(d.value.trim());
    if (d.value.trim() === "" || !Number.isFinite(typed)) return d.kind === "fee" ? t.fee : t.discount;
    const amount = d.valueType === "percent" ? fmt(t.percentOf, { n: typed }) : formatMoney(majorToMinor(d.value), store);
    return fmt(d.kind === "fee" ? t.feeOf : t.discountOf, { amount });
  }

  const offered = methods.filter((m) => m.available);
  const methodLabel = (m: PaymentMethodEntry) => (m.provider ? `${m.provider} · ${t[m.method]}` : t[m.method]);
  const funnelRows = funnels.data ?? [];
  const customised = Object.keys(byFunnel).length;

  return (
    <DataState loading={rules.loading} error={rules.error} onRetry={() => void rules.refresh()} skeleton={<PaneSkeleton rows={6} />}>
      {!data ? (
        <NoAccess />
      ) : (
        <>
          <div className="flex flex-col gap-2">
            {data.methods.map((method: PaymentRuleMethod) => {
              const d = drafts[method] ?? EMPTY;
              return (
                <AccordionSection
                  key={method}
                  title={t[method]}
                  summary={summaryOf(d)}
                  icon={METHOD_ICON[method]}
                  keepMounted
                  defaultOpen={method === "cod"}
                  persistKey={`payments:rules:${method}`}
                >
                  <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                    <Field label={t.kindLabel}>
                      {({ id }) => (
                        <Select
                          id={id}
                          className={FIELD}
                          aria-label={t.kind.replace("{method}", t[method])}
                          value={d.kind}
                          disabled={!canManage}
                          onChange={(e) => patch(method, { kind: e.target.value as Draft["kind"] })}
                        >
                          <option value="none">{t.none}</option>
                          <option value="fee">{t.fee}</option>
                          <option value="discount">{t.discount}</option>
                        </Select>
                      )}
                    </Field>
                    {d.kind !== "none" && (
                      <>
                        <Field label={t.valueType}>
                          {({ id }) => (
                            <Select
                              id={id}
                              className={FIELD}
                              value={d.valueType}
                              disabled={!canManage}
                              onChange={(e) => patch(method, { valueType: e.target.value as Draft["valueType"], value: "" })}
                            >
                              <option value="fixed">{t.fixed}</option>
                              <option value="percent">{t.percent}</option>
                            </Select>
                          )}
                        </Field>
                        <Field label={d.valueType === "percent" ? `${t.value} %` : t.value}>
                          {({ id }) => (
                            <Input
                              id={id}
                              className={FIELD}
                              inputMode="decimal"
                              dir="ltr"
                              value={d.value}
                              disabled={!canManage}
                              onChange={(e) => patch(method, { value: e.target.value })}
                            />
                          )}
                        </Field>
                        <Field label={t.label}>
                          {({ id }) => (
                            <Input
                              id={id}
                              className={FIELD}
                              dir="auto"
                              placeholder={t.labelPlaceholder}
                              value={d.label}
                              maxLength={100}
                              disabled={!canManage}
                              onChange={(e) => patch(method, { label: e.target.value })}
                            />
                          )}
                        </Field>
                        <div className="flex flex-col gap-2 sm:col-span-2">
                          {d.others.map((other, i) => (
                            <div key={i} className="flex flex-wrap items-end gap-3">
                              <Field label={t.otherCurrency} className="w-24">
                                {({ id }) => (
                                  <Input
                                    id={id}
                                    className={FIELD}
                                    dir="ltr"
                                    maxLength={3}
                                    value={other.currency}
                                    disabled={!canManage}
                                    onChange={(e) =>
                                      patch(method, { others: d.others.map((o, j) => (j === i ? { ...o, currency: e.target.value.toUpperCase() } : o)) })
                                    }
                                  />
                                )}
                              </Field>
                              <Field label={t.otherValue} className="min-w-0 flex-1 sm:max-w-40">
                                {({ id }) => (
                                  <Input
                                    id={id}
                                    className={FIELD}
                                    inputMode="decimal"
                                    dir="ltr"
                                    value={other.value}
                                    disabled={!canManage}
                                    onChange={(e) => patch(method, { others: d.others.map((o, j) => (j === i ? { ...o, value: e.target.value } : o)) })}
                                  />
                                )}
                              </Field>
                              {canManage && (
                                <Button
                                  type="button"
                                  variant="ghost"
                                  className="min-h-11 rounded-full px-3 text-danger"
                                  onClick={() => patch(method, { others: d.others.filter((_, j) => j !== i) })}
                                >
                                  {t.removeOther}
                                </Button>
                              )}
                            </div>
                          ))}
                          {canManage && (
                            <Button
                              type="button"
                              variant="outline"
                              className="min-h-11 self-start rounded-full px-4"
                              onClick={() => patch(method, { others: [...d.others, { currency: "", value: "" }] })}
                            >
                              {t.addOther}
                            </Button>
                          )}
                          <p className="text-[13px] leading-5 text-ink-soft">
                            {d.valueType === "percent" ? t.othersHintPercent : fmt(t.othersHint, { store })}
                          </p>
                        </div>
                      </>
                    )}
                  </div>
                </AccordionSection>
              );
            })}
          </div>

          <AccordionSection
            title={t.funnelsTitle}
            summary={
              funnelRows.length === 0
                ? t.noFunnels
                : customised === 0
                  ? t.funnelsAll
                  : pluralOf(t, "funnelsSome", customised)
            }
            icon={IconFunnels}
            keepMounted
            persistKey="payments:rules:funnels"
          >
            <p className="text-[13px] leading-5 text-ink-soft">{t.funnelsDesc}</p>
            {funnelRows.length === 0 ? (
              <p className="mt-3 text-sm text-ink-soft">{t.noFunnels}</p>
            ) : (
              <ul className="mt-2 divide-y divide-line">
                {funnelRows.map((funnel) => {
                  const chosen = byFunnel[funnel.id] ?? [];
                  return (
                    <li key={funnel.id} className="flex flex-col gap-1 py-3">
                      <span className="text-sm font-medium text-ink" dir="auto">
                        {funnel.name}
                      </span>
                      <div className="flex flex-wrap gap-x-5">
                        {offered.map((m) => (
                          <label key={m.id} className="flex min-h-11 cursor-pointer items-center gap-2 text-sm text-ink">
                            <input
                              type="checkbox"
                              className="size-5 accent-[var(--color-primary)]"
                              checked={chosen.includes(m.id)}
                              disabled={!canManage}
                              onChange={(e) =>
                                setByFunnel((map) => {
                                  const next = e.target.checked ? [...chosen, m.id] : chosen.filter((id) => id !== m.id);
                                  const copy = { ...map };
                                  if (next.length) copy[funnel.id] = next;
                                  else delete copy[funnel.id];
                                  return copy;
                                })
                              }
                            />
                            {methodLabel(m)}
                          </label>
                        ))}
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}
          </AccordionSection>

          {canManage && <SaveBar dirty={dirty} saving={saving} onSave={() => void save()} onDiscard={discard} saveLabel={t.save} />}
        </>
      )}
    </DataState>
  );
}
