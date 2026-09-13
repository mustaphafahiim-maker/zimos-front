import { useEffect, useState } from "react";
import { Banknote, CreditCard, Lock, ShieldCheck, Timer, Truck } from "lucide-react";
import { Button, Input, cn } from "@store-builder/ui";
import { mockApi } from "@/mock/api";
import type { CheckoutSettings } from "@/mock/types";
import { useWorkspaceId } from "@/lib/useWorkspaceId";
import { useAsync } from "@/lib/useAsync";
import { DataState } from "@/components/DataState";
import { Field } from "@/components/Field";
import { Select } from "@/components/Select";
import { Textarea } from "@/components/Textarea";
import { Toggle } from "@/components/Toggle";
import { useToast } from "@/components/Toast";
import { fmt, useCommon, useLocale, useT, type Locale, type Messages } from "@/i18n/LocaleContext";

type Visibility = CheckoutSettings["fields"]["email"];
type FieldKey = keyof CheckoutSettings["fields"];

const FIELD_KEYS: FieldKey[] = ["email", "alternatePhone", "address2", "notes"];

const FIELD_LABEL: Record<Locale, Record<FieldKey, string>> = {
  en: {
    email: "Email",
    alternatePhone: "Alternate phone",
    address2: "Address line 2",
    notes: "Order notes",
  },
  ar: {
    email: "البريد الإلكتروني",
    alternatePhone: "رقم هاتف بديل",
    address2: "العنوان (سطر 2)",
    notes: "ملاحظات الطلب",
  },
};

const VISIBILITY: Visibility[] = ["hidden", "optional", "required"];

const VISIBILITY_LABEL: Record<Locale, Record<Visibility, string>> = {
  en: { hidden: "Hidden", optional: "Optional", required: "Required" },
  ar: { hidden: "مخفي", optional: "اختياري", required: "إلزامي" },
};

const STRINGS = {
  en: {
    saved: "Checkout settings saved.",
    layout: "Layout",
    onePage: "One page",
    onePageHint: "Contact, address and payment on a single screen. Best for COD.",
    twoStep: "Two step",
    twoStepHint: "Contact first, then address and payment. Captures leads for recovery.",
    fields: "Fields",
    fieldsHint: "Name, phone, governorate and address line 1 are always required.",
    extras: "Checkout extras",
    otp: "Phone OTP verification",
    otpHint: "Customer confirms an SMS code before the order is placed. Cuts fake COD orders.",
    trust: "Trust badges",
    trustHint: "Secure checkout, cash on delivery and free returns icons under the button.",
    countdown: "Countdown timer",
    countdownHint: "Reservation timer at the top of the checkout.",
    countdownMinutes: "Countdown minutes",
    discounts: "Allow discount codes",
    discountsHint: "Show the coupon field at checkout.",
    payment: "Payment",
    defaultPayment: "Default payment method",
    cod: "Cash on delivery",
    card: "Card / wallet",
    thankYou: "Thank-you message",
    thankYouHint: "Shown on the confirmation page and in the confirmation message.",
    saveCheckout: "Save checkout settings",
    unsaved: "You have unsaved changes.",

    previewTitle: "Checkout preview",
    reserved: "Order reserved for",
    step: "Step {n}",
    contact: "Contact",
    fullName: "Full name",
    phone: "Phone",
    otpSent: "SMS code sent to verify phone",
    shipping: "Shipping",
    governorate: "Governorate",
    address: "Address",
    notes: "Notes",
    apply: "Apply",
    continue: "Continue",
    placeOrder: "Place order",
    secure: "Secure",
    codShort: "COD",
    freeReturns: "Free returns",
  },
  ar: {
    saved: "تم حفظ إعدادات صفحة الدفع.",
    layout: "التخطيط",
    onePage: "صفحة واحدة",
    onePageHint: "بيانات التواصل والعنوان والدفع في شاشة واحدة. الأنسب للدفع عند الاستلام.",
    twoStep: "خطوتان",
    twoStepHint: "بيانات التواصل أولًا، ثم العنوان والدفع. يحفظ بيانات العميل لاسترجاع الطلبات المتروكة.",
    fields: "الحقول",
    fieldsHint: "الاسم ورقم الهاتف والمحافظة والعنوان (سطر 1) مطلوبة دائمًا.",
    extras: "خيارات إضافية",
    otp: "التحقق من الهاتف برمز OTP",
    otpHint: "يؤكد العميل رمزًا يصله برسالة SMS قبل تسجيل الطلب. يقلل طلبات الدفع عند الاستلام الوهمية.",
    trust: "شارات الثقة",
    trustHint: "أيقونات الدفع الآمن والدفع عند الاستلام والإرجاع المجاني أسفل الزر.",
    countdown: "عدّاد تنازلي",
    countdownHint: "مؤقت حجز الطلب أعلى صفحة الدفع.",
    countdownMinutes: "مدة العدّاد بالدقائق",
    discounts: "السماح بأكواد الخصم",
    discountsHint: "إظهار حقل الكوبون في صفحة الدفع.",
    payment: "الدفع",
    defaultPayment: "طريقة الدفع الافتراضية",
    cod: "الدفع عند الاستلام",
    card: "بطاقة / محفظة",
    thankYou: "رسالة الشكر",
    thankYouHint: "تظهر في صفحة تأكيد الطلب وفي رسالة التأكيد.",
    saveCheckout: "حفظ إعدادات صفحة الدفع",
    unsaved: "لديك تغييرات غير محفوظة.",

    previewTitle: "معاينة صفحة الدفع",
    reserved: "طلبك محجوز لمدة",
    step: "الخطوة {n}",
    contact: "بيانات التواصل",
    fullName: "الاسم بالكامل",
    phone: "رقم الهاتف",
    otpSent: "تم إرسال رمز SMS للتحقق من الهاتف",
    shipping: "الشحن",
    governorate: "المحافظة",
    address: "العنوان",
    notes: "ملاحظات",
    apply: "تطبيق",
    continue: "متابعة",
    placeOrder: "تأكيد الطلب",
    secure: "دفع آمن",
    codShort: "الدفع عند الاستلام",
    freeReturns: "إرجاع مجاني",
  },
} satisfies Messages;

const SECTION_CARD = "space-y-3 rounded-2xl border border-line bg-paper-raised p-5 shadow-card";

export function CheckoutSettingsTab() {
  const workspaceId = useWorkspaceId();
  const toast = useToast();
  const t = useT(STRINGS);
  const c = useCommon();
  const { locale } = useLocale();
  const settings = useAsync(() => mockApi.getCheckoutSettings(workspaceId), [workspaceId]);
  const [draft, setDraft] = useState<CheckoutSettings | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (settings.data) setDraft(settings.data);
  }, [settings.data]);

  function patch(p: Partial<CheckoutSettings>) {
    setDraft((d) => (d ? { ...d, ...p } : d));
  }
  function setField(k: FieldKey, v: Visibility) {
    setDraft((d) => (d ? { ...d, fields: { ...d.fields, [k]: v } } : d));
  }

  async function save() {
    if (!draft) return;
    setSaving(true);
    try {
      await mockApi.saveCheckoutSettings(workspaceId, draft);
      settings.setData(draft);
      toast.success(t.saved);
    } finally {
      setSaving(false);
    }
  }

  const dirty = Boolean(draft && settings.data && JSON.stringify(draft) !== JSON.stringify(settings.data));
  const layouts = [
    ["one_page", t.onePage, t.onePageHint],
    ["two_step", t.twoStep, t.twoStepHint],
  ] as const;

  return (
    <DataState loading={settings.loading || !draft} error={settings.error} onRetry={() => settings.refresh()}>
      {draft && (
        <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_320px]">
          <div className="min-w-0 max-w-3xl space-y-6">
            <section className={SECTION_CARD}>
              <h3 className="text-sm font-semibold text-ink">{t.layout}</h3>
              <div className="grid gap-3 sm:grid-cols-2">
                {layouts.map(([v, title, hint]) => (
                  <label
                    key={v}
                    className={cn(
                      "flex cursor-pointer gap-3 rounded-xl border p-3 transition-colors",
                      draft.layout === v ? "border-primary bg-primary-soft" : "border-line hover:bg-paper"
                    )}
                  >
                    <input
                      type="radio"
                      name="layout"
                      className="mt-1 accent-primary"
                      checked={draft.layout === v}
                      onChange={() => patch({ layout: v })}
                    />
                    <span>
                      <span className="block text-sm font-medium text-ink">{title}</span>
                      <span className="block text-xs text-ink-soft">{hint}</span>
                    </span>
                  </label>
                ))}
              </div>
            </section>

            <section className={SECTION_CARD}>
              <h3 className="text-sm font-semibold text-ink">{t.fields}</h3>
              <p className="text-xs text-ink-soft">{t.fieldsHint}</p>
              <div className="grid gap-4 sm:grid-cols-2">
                {FIELD_KEYS.map((k) => (
                  <Field key={k} label={FIELD_LABEL[locale][k]}>
                    {({ id }) => (
                      <Select id={id} value={draft.fields[k]} onChange={(e) => setField(k, e.target.value as Visibility)}>
                        {VISIBILITY.map((v) => (
                          <option key={v} value={v}>
                            {VISIBILITY_LABEL[locale][v]}
                          </option>
                        ))}
                      </Select>
                    )}
                  </Field>
                ))}
              </div>
            </section>

            <section className={cn(SECTION_CARD, "space-y-4")}>
              <h3 className="text-sm font-semibold text-ink">{t.extras}</h3>
              <Toggle label={t.otp} description={t.otpHint} checked={draft.phoneOtpVerification} onChange={(v) => patch({ phoneOtpVerification: v })} />
              <Toggle label={t.trust} description={t.trustHint} checked={draft.showTrustBadges} onChange={(v) => patch({ showTrustBadges: v })} />
              <Toggle label={t.countdown} description={t.countdownHint} checked={draft.showCountdown} onChange={(v) => patch({ showCountdown: v })} />
              {draft.showCountdown && (
                <Field label={t.countdownMinutes} className="max-w-[160px]">
                  {({ id }) => (
                    <Input
                      id={id}
                      type="number"
                      dir="ltr"
                      min={1}
                      max={120}
                      value={draft.countdownMinutes}
                      onChange={(e) => patch({ countdownMinutes: Math.max(1, Number(e.target.value) || 1) })}
                    />
                  )}
                </Field>
              )}
              <Toggle label={t.discounts} description={t.discountsHint} checked={draft.allowDiscountCodes} onChange={(v) => patch({ allowDiscountCodes: v })} />
            </section>

            <section className={cn(SECTION_CARD, "space-y-4")}>
              <h3 className="text-sm font-semibold text-ink">{t.payment}</h3>
              <Field label={t.defaultPayment}>
                {({ id }) => (
                  <Select
                    id={id}
                    value={draft.defaultPaymentMethod}
                    onChange={(e) => patch({ defaultPaymentMethod: e.target.value as CheckoutSettings["defaultPaymentMethod"] })}
                    className="max-w-xs"
                  >
                    <option value="cod">{t.cod}</option>
                    <option value="card">{t.card}</option>
                  </Select>
                )}
              </Field>

              <Field label={t.thankYou} hint={t.thankYouHint}>
                {({ id }) => <Textarea id={id} value={draft.thankYouMessage} onChange={(e) => patch({ thankYouMessage: e.target.value })} dir="auto" />}
              </Field>
            </section>

            <div className="sticky bottom-0 z-10 -mx-1 flex flex-wrap items-center justify-end gap-3 rounded-2xl border border-line bg-paper-raised/95 px-4 py-3 shadow-card backdrop-blur">
              {dirty && <p className="me-auto text-xs text-ink-soft">{t.unsaved}</p>}
              <Button onClick={save} disabled={saving}>
                {saving ? c.saving : t.saveCheckout}
              </Button>
            </div>
          </div>

          <CheckoutPreview s={draft} />
        </div>
      )}
    </DataState>
  );
}

function PreviewInput({ label, required, hidden }: { label: string; required?: boolean; hidden?: boolean }) {
  if (hidden) return null;
  return (
    <div className="space-y-0.5">
      <p className="text-[10px] text-ink-soft">
        {label}
        {required && <span className="text-danger"> *</span>}
      </p>
      <div className="h-6 rounded border border-line bg-paper-raised" />
    </div>
  );
}

function CheckoutPreview({ s }: { s: CheckoutSettings }) {
  const t = useT(STRINGS);
  const { locale } = useLocale();
  const labels = FIELD_LABEL[locale];
  const [step, setStep] = useState<1 | 2>(1);
  const showContact = s.layout === "one_page" || step === 1;
  const showRest = s.layout === "one_page" || step === 2;
  const payments = [
    ["cod", t.cod, <Banknote key="c" className="size-3" />],
    ["card", t.card, <CreditCard key="k" className="size-3" />],
  ] as const;
  return (
    <aside className="lg:sticky lg:top-6 lg:self-start">
      <p className="mb-2 text-xs font-medium uppercase tracking-wide text-ink-soft">{t.previewTitle}</p>
      <div className="mx-auto w-full max-w-[300px] rounded-[2rem] border-[6px] border-zimos-navy/85 bg-paper-raised p-3 shadow-pop">
        <div className="mx-auto mb-2 h-1 w-16 rounded-full bg-ink/30" />
        <div className="space-y-3 rounded-[1.2rem] bg-paper p-3 text-xs">
          {s.showCountdown && (
            <div className="flex items-center justify-center gap-1 rounded bg-accent-soft py-1 text-[10px] font-medium text-accent-dark">
              <Timer className="size-3" /> {t.reserved}
              <bdi dir="ltr" className="tabular-nums">
                {s.countdownMinutes}:00
              </bdi>
            </div>
          )}
          {s.layout === "two_step" && (
            <div className="flex gap-1">
              {[1, 2].map((n) => (
                <button
                  key={n}
                  type="button"
                  onClick={() => setStep(n as 1 | 2)}
                  className={cn("h-1 flex-1 rounded-full", step === n ? "bg-primary" : "bg-line")}
                  aria-label={fmt(t.step, { n })}
                />
              ))}
            </div>
          )}

          {showContact && (
            <div className="space-y-2">
              <p className="font-medium text-ink">{t.contact}</p>
              <PreviewInput label={t.fullName} required />
              <PreviewInput label={t.phone} required />
              <PreviewInput label={labels.email} required={s.fields.email === "required"} hidden={s.fields.email === "hidden"} />
              <PreviewInput label={labels.alternatePhone} required={s.fields.alternatePhone === "required"} hidden={s.fields.alternatePhone === "hidden"} />
              {s.phoneOtpVerification && (
                <p className="flex items-center gap-1 text-[10px] text-primary">
                  <Lock className="size-3" /> {t.otpSent}
                </p>
              )}
            </div>
          )}

          {showRest && (
            <>
              <div className="space-y-2">
                <p className="font-medium text-ink">{t.shipping}</p>
                <PreviewInput label={t.governorate} required />
                <PreviewInput label={t.address} required />
                <PreviewInput label={labels.address2} required={s.fields.address2 === "required"} hidden={s.fields.address2 === "hidden"} />
                <PreviewInput label={t.notes} required={s.fields.notes === "required"} hidden={s.fields.notes === "hidden"} />
              </div>
              <div className="space-y-1">
                <p className="font-medium text-ink">{t.payment}</p>
                {payments.map(([v, l, icon]) => (
                  <div
                    key={v}
                    className={cn(
                      "flex items-center gap-2 rounded border px-2 py-1",
                      s.defaultPaymentMethod === v ? "border-primary bg-primary-soft text-primary" : "border-line text-ink-soft"
                    )}
                  >
                    <span className={cn("size-2.5 rounded-full border", s.defaultPaymentMethod === v ? "border-primary bg-primary" : "border-line")} />
                    {icon} {l}
                  </div>
                ))}
              </div>
              {s.allowDiscountCodes && (
                <div className="flex gap-1">
                  <div className="h-6 flex-1 rounded border border-dashed border-line" />
                  <div className="rounded bg-paper-raised px-2 py-1 text-[10px] text-ink-soft">{t.apply}</div>
                </div>
              )}
            </>
          )}

          <div className="rounded bg-primary py-2 text-center text-[11px] font-medium text-white">
            {s.layout === "two_step" && step === 1 ? t.continue : t.placeOrder}
          </div>
          {s.showTrustBadges && (
            <div className="flex flex-wrap justify-around gap-1 text-[9px] text-ink-soft">
              <span className="flex items-center gap-0.5"><ShieldCheck className="size-3" /> {t.secure}</span>
              <span className="flex items-center gap-0.5"><Banknote className="size-3" /> {t.codShort}</span>
              <span className="flex items-center gap-0.5"><Truck className="size-3" /> {t.freeReturns}</span>
            </div>
          )}
        </div>
      </div>
    </aside>
  );
}
