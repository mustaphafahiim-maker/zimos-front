import { useEffect, useState } from "react";
import { Button, Card, CardContent } from "@store-builder/ui";
import {
  funnelsList,
  paymentRulesGet,
  paymentRulesSave,
  type PaymentMethodEntry,
  type PaymentRuleAdjustment,
  type PaymentRuleMethod,
} from "@store-builder/api-client";
import { apiClient } from "@/lib/apiClient";
import { useAsync } from "@/lib/useAsync";
import { getErrorMessage, isPermissionError } from "@/lib/errors";
import { basisPointsToPercentInput, majorToMinor, minorToMajorInput, percentToBasisPoints } from "@/lib/format";
import { Select } from "@/components/Select";
import { TextField } from "@/components/Field";
import { useToast } from "@/components/Toast";
import { useCommon, useT, type Messages } from "@/i18n/LocaleContext";

const STRINGS = {
  en: {
    title: "Payment rules",
    description: "Add a fee or give a discount depending on how the customer pays. It appears as its own line in the order.",
    cod: "Cash on delivery",
    card: "Card",
    wallet: "Mobile wallet",
    bank_transfer: "Manual transfer",
    none: "No change",
    fee: "Add a fee",
    discount: "Give a discount",
    fixed: "Fixed amount",
    percent: "Percent",
    kind: "Rule for {method}",
    valueType: "Amount type",
    value: "Value",
    label: "Name on the order",
    labelPlaceholder: "Cash on delivery fee",
    funnelsTitle: "Payment methods per funnel",
    funnelsDesc: "Choose which payment methods each funnel's checkout offers. A funnel with nothing ticked offers all of them.",
    noFunnels: "No funnels yet.",
    save: "Save",
    saved: "Payment rules saved.",
    invalid: "Enter a value greater than zero for every rule.",
  },
  ar: {
    title: "قواعد الدفع",
    description: "أضف رسومًا أو امنح خصمًا حسب طريقة دفع العميل، ويظهر كبند مستقل في الطلب.",
    cod: "الدفع عند الاستلام",
    card: "بطاقة",
    wallet: "محفظة إلكترونية",
    bank_transfer: "تحويل يدوي",
    none: "بدون تغيير",
    fee: "أضف رسومًا",
    discount: "امنح خصمًا",
    fixed: "مبلغ ثابت",
    percent: "نسبة مئوية",
    kind: "قاعدة {method}",
    valueType: "نوع القيمة",
    value: "القيمة",
    label: "الاسم في الطلب",
    labelPlaceholder: "رسوم الدفع عند الاستلام",
    funnelsTitle: "طرق الدفع لكل مسار بيع",
    funnelsDesc: "اختر طرق الدفع التي يعرضها كل مسار بيع عند إتمام الطلب. المسار الذي لم يُحدَّد له شيء يعرض كل الطرق.",
    noFunnels: "لا توجد مسارات بيع بعد.",
    save: "حفظ",
    saved: "تم حفظ قواعد الدفع.",
    invalid: "أدخل قيمة أكبر من صفر لكل قاعدة.",
  },
} satisfies Messages;

interface Draft {
  kind: "none" | "fee" | "discount";
  valueType: "fixed" | "percent";
  value: string;
  label: string;
}
const EMPTY: Draft = { kind: "none", valueType: "fixed", value: "", label: "" };

function toDraft(rule: PaymentRuleAdjustment | undefined): Draft {
  if (!rule || !rule.enabled) return EMPTY;
  return {
    kind: rule.type,
    valueType: rule.valueType,
    value: rule.valueType === "percent" ? basisPointsToPercentInput(rule.value) : minorToMajorInput(rule.value),
    label: rule.label ?? "",
  };
}

/** Fee/discount per payment method and the methods each funnel offers (SPEC §11.4). */
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
  const common = useCommon();
  const toast = useToast();
  const rules = useAsync(
    () => paymentRulesGet(apiClient, workspaceId).catch((err) => (isPermissionError(err) ? null : Promise.reject(err))),
    [workspaceId]
  );
  const funnels = useAsync(() => funnelsList(apiClient, workspaceId).catch(() => []), [workspaceId]);
  const [drafts, setDrafts] = useState<Record<string, Draft>>({});
  const [byFunnel, setByFunnel] = useState<Record<string, string[]>>({});
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!rules.data) return;
    setDrafts(Object.fromEntries(rules.data.methods.map((m) => [m, toDraft(rules.data!.adjustments.find((a) => a.method === m))])));
    setByFunnel(rules.data.methodsByFunnel);
  }, [rules.data]);

  if (!rules.data) return null;
  const patch = (method: string, change: Partial<Draft>) =>
    setDrafts((d) => ({ ...d, [method]: { ...(d[method] ?? EMPTY), ...change } }));

  async function save() {
    const adjustments: PaymentRuleAdjustment[] = [];
    for (const method of rules.data!.methods) {
      const d = drafts[method] ?? EMPTY;
      if (d.kind === "none") continue;
      const value = d.valueType === "percent" ? percentToBasisPoints(d.value) : majorToMinor(d.value);
      if (!Number.isFinite(value) || value <= 0 || (d.valueType === "percent" && value > 10000)) return toast.error(t.invalid);
      adjustments.push({ method, type: d.kind, valueType: d.valueType, value, label: d.label.trim() || null, enabled: true });
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

  const offered = methods.filter((m) => m.available);
  const methodLabel = (m: PaymentMethodEntry) => (m.provider ? `${m.provider} · ${t[m.method]}` : t[m.method]);

  return (
    <section className="space-y-4">
      <div>
        <h2 className="font-display text-lg font-medium text-ink">{t.title}</h2>
        <p className="mt-1 text-sm text-ink-soft">{t.description}</p>
      </div>

      <Card>
        <CardContent className="divide-y divide-line p-0">
          {rules.data.methods.map((method: PaymentRuleMethod) => {
            const d = drafts[method] ?? EMPTY;
            return (
              <div key={method} className="grid grid-cols-1 items-end gap-3 p-4 sm:grid-cols-2 lg:grid-cols-5">
                <div>
                  <p className="mb-1.5 text-sm font-medium text-ink">{t[method]}</p>
                  <Select
                    aria-label={t.kind.replace("{method}", t[method])}
                    value={d.kind}
                    disabled={!canManage}
                    onChange={(e) => patch(method, { kind: e.target.value as Draft["kind"] })}
                  >
                    <option value="none">{t.none}</option>
                    <option value="fee">{t.fee}</option>
                    <option value="discount">{t.discount}</option>
                  </Select>
                </div>
                {d.kind !== "none" && (
                  <>
                    <div>
                      <p className="mb-1.5 text-sm font-medium text-ink">{t.valueType}</p>
                      <Select
                        aria-label={t.valueType}
                        value={d.valueType}
                        disabled={!canManage}
                        onChange={(e) => patch(method, { valueType: e.target.value as Draft["valueType"], value: "" })}
                      >
                        <option value="fixed">{t.fixed}</option>
                        <option value="percent">{t.percent}</option>
                      </Select>
                    </div>
                    <TextField
                      label={d.valueType === "percent" ? `${t.value} %` : t.value}
                      inputMode="decimal"
                      dir="ltr"
                      value={d.value}
                      disabled={!canManage}
                      onChange={(e) => patch(method, { value: e.target.value })}
                    />
                    <TextField
                      label={t.label}
                      placeholder={t.labelPlaceholder}
                      value={d.label}
                      maxLength={100}
                      disabled={!canManage}
                      className="lg:col-span-2"
                      onChange={(e) => patch(method, { label: e.target.value })}
                    />
                  </>
                )}
              </div>
            );
          })}
        </CardContent>
      </Card>

      <Card>
        <CardContent className="space-y-3 p-5">
          <div>
            <h3 className="text-base font-semibold text-ink">{t.funnelsTitle}</h3>
            <p className="mt-1 text-sm text-ink-soft">{t.funnelsDesc}</p>
          </div>
          {(funnels.data ?? []).length === 0 ? (
            <p className="text-sm text-ink-soft">{t.noFunnels}</p>
          ) : (
            <ul className="divide-y divide-line">
              {(funnels.data ?? []).map((funnel) => {
                const chosen = byFunnel[funnel.id] ?? [];
                return (
                  <li key={funnel.id} className="flex flex-wrap items-center gap-x-6 gap-y-1 py-2.5">
                    <span className="min-w-40 text-sm font-medium text-ink" dir="auto">
                      {funnel.name}
                    </span>
                    {offered.map((m) => (
                      <label key={m.id} className="flex min-h-9 items-center gap-2 text-sm text-ink">
                        <input
                          type="checkbox"
                          className="size-4 accent-[var(--color-primary)]"
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
                  </li>
                );
              })}
            </ul>
          )}
        </CardContent>
      </Card>

      {canManage && (
        <div className="flex justify-end">
          <Button onClick={() => void save()} disabled={saving}>
            {saving ? common.saving : t.save}
          </Button>
        </div>
      )}
    </section>
  );
}
