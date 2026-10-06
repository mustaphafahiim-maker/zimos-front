import { useEffect, useState, type FormEvent } from "react";
import { Alert, Button } from "@store-builder/ui";
import {
  shippingOptionsGet,
  shippingOptionsSave,
  type ShippingOptionExtra,
  type ShippingOptionsSettings,
} from "@store-builder/api-client";
import { apiClient } from "@/lib/apiClient";
import { useWorkspaceId } from "@/lib/useWorkspaceId";
import { useAsync } from "@/lib/useAsync";
import { useErrorMessage } from "@/lib/errorMessages";
import { majorToMinor, minorToMajorInput } from "@/lib/format";
import { useT, type Messages } from "@/i18n/LocaleContext";
import { DataState } from "@/components/DataState";
import { Field, TextField } from "@/components/Field";
import { MoneyInput } from "@/components/MoneyInput";
import { Select } from "@/components/Select";
import { useToast } from "@/components/Toast";

const STRINGS = {
  en: {
    title: "Shipping options",
    description:
      "Let customers choose how their order arrives — standard, express, branch pickup. Standard always costs your normal shipping price; with no other option the checkout shows no choice.",
    standard: "Standard delivery",
    nameAr: "Name (Arabic)",
    nameEn: "Name (English)",
    daysMin: "From (days)",
    daysMax: "To (days)",
    extra: "Option {n}",
    key: "Code",
    keyHint: "Letters, numbers and dashes, e.g. express. Sent with the order.",
    mode: "Price",
    mode_add: "Standard price plus",
    mode_fixed: "Exactly",
    amount: "Amount",
    active: "Offered at checkout",
    add: "Add an option",
    remove: "Remove",
    save: "Save options",
    saving: "Saving…",
    saved: "Shipping options saved.",
  },
  ar: {
    title: "خيارات الشحن",
    description:
      "خلّي العميل يختار طريقة وصول طلبه — عادي، سريع، استلام من الفرع. الشحن العادي دايمًا بسعر الشحن المعتاد؛ ومن غير خيارات تانية صفحة الطلب مش هتعرض اختيار.",
    standard: "التوصيل العادي",
    nameAr: "الاسم (عربي)",
    nameEn: "الاسم (إنجليزي)",
    daysMin: "من (أيام)",
    daysMax: "إلى (أيام)",
    extra: "الخيار {n}",
    key: "الكود",
    keyHint: "حروف إنجليزية وأرقام وشرطات، مثل express. يُرسل مع الطلب.",
    mode: "السعر",
    mode_add: "سعر العادي زائد",
    mode_fixed: "بالضبط",
    amount: "المبلغ",
    active: "متاح في صفحة الطلب",
    add: "إضافة خيار",
    remove: "حذف",
    save: "حفظ الخيارات",
    saving: "بنحفظ…",
    saved: "تم حفظ خيارات الشحن.",
  },
} satisfies Messages;

type Draft = Omit<ShippingOptionExtra, "amount"> & { amount: string };
const toNumber = (v: string) => (v.trim() === "" ? null : Math.max(0, Math.min(90, Math.round(Number(v)) || 0)));

/** SPEC §12.1 shipping options: standard plus up to five more the shopper can pick. */
export function ShippingOptionsSection({ currency = "EGP" }: { currency?: string }) {
  const t = useT(STRINGS);
  const workspaceId = useWorkspaceId();
  const toast = useToast();
  const errorMessage = useErrorMessage();
  const loaded = useAsync(() => shippingOptionsGet(apiClient, workspaceId), [workspaceId]);
  const [standard, setStandard] = useState<ShippingOptionsSettings["standard"] | null>(null);
  const [extra, setExtra] = useState<Draft[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!loaded.data) return;
    setStandard(loaded.data.standard);
    setExtra(loaded.data.extra.map((o) => ({ ...o, amount: minorToMajorInput(o.amount) })));
  }, [loaded.data]);

  const patch = (i: number, change: Partial<Draft>) => setExtra((list) => list.map((o, j) => (j === i ? { ...o, ...change } : o)));

  async function save(e: FormEvent) {
    e.preventDefault();
    if (!standard) return;
    setBusy(true);
    setError(null);
    try {
      const saved = await shippingOptionsSave(apiClient, workspaceId, {
        standard,
        extra: extra.map((o) => ({ ...o, key: o.key.trim().toLowerCase(), amount: majorToMinor(o.amount || "0") })),
      });
      loaded.setData(saved);
      toast.success(t.saved);
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  const days = (value: { daysMin: number | null; daysMax: number | null }, onChange: (v: { daysMin: number | null; daysMax: number | null }) => void) => (
    <>
      <TextField label={t.daysMin} type="number" min={0} max={90} inputMode="numeric" value={value.daysMin ?? ""} onChange={(e) => onChange({ ...value, daysMin: toNumber(e.target.value) })} />
      <TextField label={t.daysMax} type="number" min={0} max={90} inputMode="numeric" value={value.daysMax ?? ""} onChange={(e) => onChange({ ...value, daysMax: toNumber(e.target.value) })} />
    </>
  );

  return (
    <section>
      <div className="max-w-2xl">
        <h2 className="font-display text-lg font-medium text-ink">{t.title}</h2>
        <p className="mt-1 text-sm text-ink-soft">{t.description}</p>
      </div>
      <div className="mt-4">
        <DataState loading={loaded.loading && !standard} error={loaded.error} onRetry={() => void loaded.refresh()}>
          {standard && (
            <form onSubmit={save} className="space-y-4">
              <fieldset className="rounded-[var(--radius-card)] border border-line p-4">
                <legend className="px-1 text-sm font-medium text-ink">{t.standard}</legend>
                <div className="grid gap-3 sm:grid-cols-4">
                  <TextField label={t.nameAr} value={standard.nameAr ?? ""} onChange={(e) => setStandard({ ...standard, nameAr: e.target.value })} />
                  <TextField label={t.nameEn} dir="ltr" value={standard.nameEn ?? ""} onChange={(e) => setStandard({ ...standard, nameEn: e.target.value })} />
                  {days(standard, (v) => setStandard({ ...standard, ...v }))}
                </div>
              </fieldset>
              {extra.map((o, i) => (
                <fieldset key={i} className="rounded-[var(--radius-card)] border border-line p-4">
                  <legend className="px-1 text-sm font-medium text-ink">{t.extra.replace("{n}", String(i + 1))}</legend>
                  <div className="grid gap-3 sm:grid-cols-4">
                    <TextField label={t.key} hint={t.keyHint} dir="ltr" required maxLength={40} value={o.key} onChange={(e) => patch(i, { key: e.target.value })} />
                    <TextField label={t.nameAr} value={o.nameAr ?? ""} onChange={(e) => patch(i, { nameAr: e.target.value })} />
                    <TextField label={t.nameEn} dir="ltr" value={o.nameEn ?? ""} onChange={(e) => patch(i, { nameEn: e.target.value })} />
                    <Field label={t.mode}>
                      {(props) => (
                        <Select {...props} value={o.mode} onChange={(e) => patch(i, { mode: e.target.value === "fixed" ? "fixed" : "add" })}>
                          <option value="add">{t.mode_add}</option>
                          <option value="fixed">{t.mode_fixed}</option>
                        </Select>
                      )}
                    </Field>
                    <MoneyInput label={t.amount} currency={currency} value={o.amount} onChange={(value) => patch(i, { amount: value })} />
                    {days(o, (v) => patch(i, v))}
                    <label className="flex min-h-11 items-center gap-2 self-end text-sm text-ink">
                      <input type="checkbox" checked={o.active} onChange={(e) => patch(i, { active: e.target.checked })} />
                      {t.active}
                    </label>
                  </div>
                  <div className="mt-2 text-end">
                    <Button type="button" size="sm" variant="ghost" className="min-h-11 text-danger" onClick={() => setExtra((list) => list.filter((_, j) => j !== i))}>
                      {t.remove}
                    </Button>
                  </div>
                </fieldset>
              ))}
              {error && <Alert variant="danger">{error}</Alert>}
              <div className="flex flex-wrap justify-between gap-2">
                <Button
                  type="button"
                  variant="outline"
                  className="min-h-11"
                  disabled={extra.length >= 5}
                  onClick={() => setExtra((list) => [...list, { key: "", nameAr: "", nameEn: "", mode: "add", amount: "", daysMin: null, daysMax: null, active: true }])}
                >
                  {t.add}
                </Button>
                <Button type="submit" className="min-h-11" disabled={busy}>
                  {busy ? t.saving : t.save}
                </Button>
              </div>
            </form>
          )}
        </DataState>
      </div>
    </section>
  );
}
