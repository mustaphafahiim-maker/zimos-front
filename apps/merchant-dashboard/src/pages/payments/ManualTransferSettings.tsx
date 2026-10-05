import { useEffect, useState } from "react";
import { Plus, Trash2 } from "lucide-react";
import { Button, Card, CardContent } from "@store-builder/ui";
import {
  manualTransferGetSettings,
  manualTransferSaveSettings,
  type ManualTransferDepositRule,
  type ManualTransferMethod,
} from "@store-builder/api-client";
import { apiClient } from "@/lib/apiClient";
import { useAsync } from "@/lib/useAsync";
import { getErrorMessage, isPermissionError } from "@/lib/errors";
import { majorToMinor, minorToMajorInput } from "@/lib/format";
import { Field, TextField } from "@/components/Field";
import { MoneyInput } from "@/components/MoneyInput";
import { Select } from "@/components/Select";
import { Textarea } from "@/components/Textarea";
import { useToast } from "@/components/Toast";
import { useCommon, useT, type Messages } from "@/i18n/LocaleContext";

const STRINGS = {
  en: {
    title: "Manual transfer",
    description: "Let customers pay by InstaPay, Vodafone Cash or bank transfer: they see your instructions at checkout and upload a photo of the receipt. You confirm each transfer from the order.",
    add: "Add a transfer method",
    empty: "No transfer methods yet.",
    name: "Name shown to the customer",
    namePlaceholder: "InstaPay",
    instructions: "Payment instructions",
    instructionsPlaceholder: "Send the amount to the InstaPay address store@instapay, then upload the receipt.",
    requireReceipt: "Receipt photo is required",
    requireSender: "Ask for the sender's number or account",
    enabled: "Show at checkout",
    remove: "Remove",
    depositTitle: "Deposit before cash on delivery",
    depositDesc: "Ask for part of the order by transfer before a cash-on-delivery order is accepted. The rest is collected on delivery.",
    depositEnabled: "Ask for a deposit",
    amountType: "Deposit amount",
    amountShipping: "The shipping fee",
    amountFixed: "A fixed amount",
    fixedAmount: "Amount",
    appliesTo: "Who pays it",
    appliesAll: "Every customer",
    appliesRisky: "Only customers with a poor delivery record",
    score: "Delivery rate below (%)",
    scoreHint: "A customer whose orders across all ZIMOS stores were delivered less than this (or who was reported as spam) pays the deposit. Someone new to the platform is judged by your store's own record; a first-time customer never pays it.",
    save: "Save",
    saved: "Transfer settings saved.",
    invalid: "Fill in the name and instructions of every method.",
    invalidAmount: "Enter a valid deposit amount.",
    needMethod: "Add a transfer method before asking for a deposit.",
  },
  ar: {
    title: "التحويل اليدوي",
    description: "اسمح للعملاء بالدفع عبر إنستاباي أو فودافون كاش أو التحويل البنكي: تظهر لهم تعليماتك عند إتمام الطلب ويرفعون صورة الإيصال، وأنت تؤكد كل تحويل من صفحة الطلب.",
    add: "أضف طريقة تحويل",
    empty: "لا توجد طرق تحويل بعد.",
    name: "الاسم الظاهر للعميل",
    namePlaceholder: "إنستاباي",
    instructions: "تعليمات الدفع",
    instructionsPlaceholder: "حوّل المبلغ إلى عنوان إنستاباي store@instapay ثم ارفع صورة الإيصال.",
    requireReceipt: "صورة الإيصال مطلوبة",
    requireSender: "اطلب رقم أو حساب المحوِّل",
    enabled: "تظهر عند إتمام الطلب",
    remove: "حذف",
    depositTitle: "عربون قبل الدفع عند الاستلام",
    depositDesc: "اطلب جزءًا من قيمة الطلب بالتحويل قبل قبول طلب الدفع عند الاستلام، والباقي يُحصَّل عند التسليم.",
    depositEnabled: "اطلب عربونًا",
    amountType: "قيمة العربون",
    amountShipping: "مصاريف الشحن",
    amountFixed: "مبلغ ثابت",
    fixedAmount: "المبلغ",
    appliesTo: "من يدفعه",
    appliesAll: "كل العملاء",
    appliesRisky: "العملاء ذوو سجل التسليم الضعيف فقط",
    score: "نسبة التسليم أقل من (%)",
    scoreHint: "العميل اللي طلباته في كل متاجر ZIMOS اتسلّمت بنسبة أقل من دي (أو اتبلّغ عنه سبام) بيدفع العربون. العميل الجديد على المنصة بيتحكم عليه بسجله في متجرك، وأول طلب خالص مش بيدفع.",
    save: "حفظ",
    saved: "تم حفظ إعدادات التحويل.",
    invalid: "أكمل اسم وتعليمات كل طريقة.",
    invalidAmount: "أدخل مبلغ عربون صحيحًا.",
    needMethod: "أضف طريقة تحويل قبل طلب العربون.",
  },
} satisfies Messages;

type Draft = Omit<ManualTransferMethod, "id"> & { id?: string; key: string };
let nextKey = 1;

/** Manual transfer methods and the deposit rule (SPEC §11.3), on the Payments page. */
export function ManualTransferSettings({
  workspaceId,
  currency,
  canManage,
}: {
  workspaceId: string;
  currency: string;
  canManage: boolean;
}) {
  const t = useT(STRINGS);
  const common = useCommon();
  const toast = useToast();
  const settings = useAsync(
    () => manualTransferGetSettings(apiClient, workspaceId).catch((err) => (isPermissionError(err) ? null : Promise.reject(err))),
    [workspaceId]
  );
  const [methods, setMethods] = useState<Draft[]>([]);
  const [rule, setRule] = useState<ManualTransferDepositRule | null>(null);
  const [fixed, setFixed] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!settings.data) return;
    setMethods(settings.data.methods.map((m) => ({ ...m, key: m.id })));
    setRule(settings.data.depositRule);
    setFixed(minorToMajorInput(settings.data.depositRule.fixedAmount));
  }, [settings.data]);

  if (!settings.data || !rule) return null;
  const max = settings.data.limits.maxMethods;
  const patch = (key: string, change: Partial<Draft>) => setMethods((list) => list.map((m) => (m.key === key ? { ...m, ...change } : m)));

  async function save() {
    if (!rule) return;
    if (methods.some((m) => !m.name.trim() || !m.instructions.trim())) return toast.error(t.invalid);
    const fixedAmount = rule.amountType === "fixed" ? majorToMinor(fixed) : rule.fixedAmount;
    if (rule.enabled && rule.amountType === "fixed" && (!Number.isFinite(fixedAmount) || fixedAmount <= 0)) return toast.error(t.invalidAmount);
    if (rule.enabled && !methods.some((m) => m.enabled)) return toast.error(t.needMethod);
    setSaving(true);
    try {
      const next = await manualTransferSaveSettings(apiClient, workspaceId, {
        methods: methods.map(({ key: _key, ...m }) => m),
        depositRule: { ...rule, fixedAmount: Number.isFinite(fixedAmount) ? fixedAmount : 0 },
      });
      settings.setData(next);
      toast.success(t.saved);
    } catch (err) {
      toast.error(getErrorMessage(err));
    } finally {
      setSaving(false);
    }
  }

  const check = (label: string, checked: boolean, onChange: (v: boolean) => void) => (
    <label className="flex min-h-9 items-center gap-2 text-sm text-ink">
      <input
        type="checkbox"
        className="size-4 accent-[var(--color-primary)]"
        checked={checked}
        disabled={!canManage}
        onChange={(e) => onChange(e.target.checked)}
      />
      {label}
    </label>
  );

  return (
    <section className="space-y-4">
      <div>
        <h2 className="font-display text-lg font-medium text-ink">{t.title}</h2>
        <p className="mt-1 text-sm text-ink-soft">{t.description}</p>
      </div>

      {methods.length === 0 && <p className="text-sm text-ink-soft">{t.empty}</p>}
      {methods.map((m) => (
        <Card key={m.key}>
          <CardContent className="space-y-4 p-5">
            <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
              <TextField
                label={t.name}
                placeholder={t.namePlaceholder}
                value={m.name}
                maxLength={100}
                disabled={!canManage}
                onChange={(e) => patch(m.key, { name: e.target.value })}
              />
              <Field label={t.instructions} className="md:col-span-2">
                {({ id }) => (
                  <Textarea
                    id={id}
                    rows={2}
                    dir="auto"
                    placeholder={t.instructionsPlaceholder}
                    value={m.instructions}
                    maxLength={1000}
                    disabled={!canManage}
                    onChange={(e) => patch(m.key, { instructions: e.target.value })}
                  />
                )}
              </Field>
            </div>
            <div className="flex flex-wrap items-center gap-x-6 gap-y-1">
              {check(t.enabled, m.enabled, (v) => patch(m.key, { enabled: v }))}
              {check(t.requireReceipt, m.requireReceipt, (v) => patch(m.key, { requireReceipt: v }))}
              {check(t.requireSender, m.requireSender, (v) => patch(m.key, { requireSender: v }))}
              {canManage && (
                <Button
                  variant="ghost"
                  size="sm"
                  className="ms-auto text-danger"
                  onClick={() => setMethods((list) => list.filter((x) => x.key !== m.key))}
                >
                  <Trash2 className="size-4" aria-hidden />
                  {t.remove}
                </Button>
              )}
            </div>
          </CardContent>
        </Card>
      ))}

      {canManage && methods.length < max && (
        <Button
          variant="outline"
          onClick={() =>
            setMethods((list) => [
              ...list,
              { key: `new-${nextKey++}`, name: "", instructions: "", requireReceipt: true, requireSender: true, enabled: true },
            ])
          }
        >
          <Plus className="size-4" aria-hidden />
          {t.add}
        </Button>
      )}

      <Card>
        <CardContent className="space-y-4 p-5">
          <div>
            <h3 className="text-base font-semibold text-ink">{t.depositTitle}</h3>
            <p className="mt-1 text-sm text-ink-soft">{t.depositDesc}</p>
          </div>
          {check(t.depositEnabled, rule.enabled, (v) => setRule({ ...rule, enabled: v }))}
          {rule.enabled && (
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <Field label={t.amountType}>
                {({ id }) => (
                  <Select
                    id={id}
                    value={rule.amountType}
                    disabled={!canManage}
                    onChange={(e) => setRule({ ...rule, amountType: e.target.value as ManualTransferDepositRule["amountType"] })}
                  >
                    <option value="shipping">{t.amountShipping}</option>
                    <option value="fixed">{t.amountFixed}</option>
                  </Select>
                )}
              </Field>
              {rule.amountType === "fixed" && (
                <MoneyInput label={t.fixedAmount} value={fixed} onChange={setFixed} currency={currency} disabled={!canManage} />
              )}
              <Field label={t.appliesTo}>
                {({ id }) => (
                  <Select
                    id={id}
                    value={rule.appliesTo}
                    disabled={!canManage}
                    onChange={(e) => setRule({ ...rule, appliesTo: e.target.value as ManualTransferDepositRule["appliesTo"] })}
                  >
                    <option value="all">{t.appliesAll}</option>
                    <option value="risky">{t.appliesRisky}</option>
                  </Select>
                )}
              </Field>
              {rule.appliesTo === "risky" && (
                <TextField
                  label={t.score}
                  hint={t.scoreHint}
                  type="number"
                  min={1}
                  max={100}
                  dir="ltr"
                  value={String(rule.maxReliabilityScore)}
                  disabled={!canManage}
                  onChange={(e) => setRule({ ...rule, maxReliabilityScore: Math.min(100, Math.max(1, Number(e.target.value) || 1)) })}
                />
              )}
            </div>
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
