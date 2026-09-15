import { useEffect, useMemo, useState } from "react";
import { Button, Toggle, cn } from "@store-builder/ui";
import type { CheckoutFieldVisibility, CheckoutSettings } from "@store-builder/api-client";
import { apiClient } from "@/lib/apiClient";
import { useWorkspaceId } from "@/lib/useWorkspaceId";
import { useWorkspace } from "@/context/WorkspaceContext";
import { getErrorMessage } from "@/lib/errors";
import { Field } from "@/components/Field";
import { Select } from "@/components/Select";
import { Textarea } from "@/components/Textarea";
import { useToast } from "@/components/Toast";
import { fmt, useCommon, useT, type Messages } from "@/i18n/LocaleContext";

type FieldKey = "email" | "alternate_phone" | "notes";

const FIELD_KEYS: FieldKey[] = ["email", "alternate_phone", "notes"];
const VISIBILITY: CheckoutFieldVisibility[] = ["hidden", "optional", "required"];
const MAX_THANK_YOU = 300;

const STRINGS = {
  en: {
    saved: "Checkout settings saved.",
    fields: "Form fields",
    fieldsHint: "Name, phone, governorate, city and address are always required.",
    email: "Email",
    alternate_phone: "Alternate phone",
    notes: "Order notes",
    hidden: "Hidden",
    optional: "Optional",
    required: "Required",
    discounts: "Allow discount codes",
    discountsHint: "Show the discount code box at checkout.",
    thankYou: "Thank-you message",
    thankYouHint: "Shown on the order confirmation page. Leave empty for none.",
    counter: "{n}/{max}",
    saveCheckout: "Save checkout settings",
    unsaved: "You have unsaved changes.",
    previewTitle: "Checkout preview",
    fullName: "Full name",
    phone: "Phone",
    governorate: "Governorate",
    address: "Address",
    discountCode: "Discount code",
    apply: "Apply",
    placeOrder: "Place order",
  },
  ar: {
    saved: "اتحفظت إعدادات صفحة الدفع.",
    fields: "حقول الفورم",
    fieldsHint: "الاسم والموبايل والمحافظة والمدينة والعنوان مطلوبين دايمًا.",
    email: "البريد الإلكتروني",
    alternate_phone: "رقم موبايل تاني",
    notes: "ملاحظات الطلب",
    hidden: "مخفي",
    optional: "اختياري",
    required: "إجباري",
    discounts: "اسمح بأكواد الخصم",
    discountsHint: "اعرض خانة كود الخصم في صفحة الدفع.",
    thankYou: "رسالة الشكر",
    thankYouHint: "بتظهر في صفحة تأكيد الطلب. سيبها فاضية لو مش عايز رسالة.",
    counter: "{n}/{max}",
    saveCheckout: "احفظ إعدادات الدفع",
    unsaved: "عندك تغييرات مش محفوظة.",
    previewTitle: "معاينة صفحة الدفع",
    fullName: "الاسم بالكامل",
    phone: "الموبايل",
    governorate: "المحافظة",
    address: "العنوان",
    discountCode: "كود الخصم",
    apply: "تطبيق",
    placeOrder: "أكّد الطلب",
  },
} satisfies Messages;

const SECTION_CARD = "space-y-3 rounded-2xl border border-line bg-paper-raised p-5 shadow-card";

function vis(v: unknown): CheckoutFieldVisibility {
  return v === "hidden" || v === "required" ? v : "optional";
}

function readSettings(raw: unknown): CheckoutSettings {
  const r = (raw && typeof raw === "object" ? raw : {}) as Partial<CheckoutSettings>;
  return {
    email: vis(r.email),
    alternate_phone: vis(r.alternate_phone),
    notes: vis(r.notes),
    allow_discount_codes: r.allow_discount_codes !== false,
    thank_you_message: typeof r.thank_you_message === "string" && r.thank_you_message ? r.thank_you_message : null,
  };
}

export function CheckoutSettingsTab() {
  const workspaceId = useWorkspaceId();
  const toast = useToast();
  const t = useT(STRINGS);
  const c = useCommon();
  const { currentWorkspace, refresh } = useWorkspace();
  const stored = useMemo(
    () => readSettings(currentWorkspace?.settings?.checkout_settings),
    [currentWorkspace?.settings?.checkout_settings]
  );
  const [draft, setDraft] = useState<CheckoutSettings>(stored);
  const [saving, setSaving] = useState(false);

  useEffect(() => setDraft(stored), [stored]);

  function patch(p: Partial<CheckoutSettings>) {
    setDraft((d) => ({ ...d, ...p }));
  }

  const normalized: CheckoutSettings = {
    ...draft,
    thank_you_message: draft.thank_you_message?.trim() ? draft.thank_you_message.trim() : null,
  };
  const dirty = JSON.stringify(normalized) !== JSON.stringify(stored);

  async function save() {
    setSaving(true);
    try {
      await apiClient.updateWorkspace(workspaceId, { settings: { checkout_settings: normalized } });
      await refresh();
      toast.success(t.saved);
    } catch (err) {
      toast.error(getErrorMessage(err));
    } finally {
      setSaving(false);
    }
  }

  const message = draft.thank_you_message ?? "";

  return (
    <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_320px]">
      <div className="min-w-0 max-w-3xl space-y-6">
        <section className={SECTION_CARD}>
          <h3 className="text-sm font-semibold text-ink">{t.fields}</h3>
          <p className="text-xs text-ink-soft">{t.fieldsHint}</p>
          <div className="grid gap-4 sm:grid-cols-3">
            {FIELD_KEYS.map((k) => (
              <Field key={k} label={t[k]}>
                {({ id }) => (
                  <Select id={id} value={draft[k]} onChange={(e) => patch({ [k]: e.target.value as CheckoutFieldVisibility })}>
                    {VISIBILITY.map((v) => (
                      <option key={v} value={v}>
                        {t[v]}
                      </option>
                    ))}
                  </Select>
                )}
              </Field>
            ))}
          </div>
        </section>

        <section className={cn(SECTION_CARD, "space-y-4")}>
          <Toggle
            label={t.discounts}
            description={t.discountsHint}
            checked={draft.allow_discount_codes}
            onChange={(v) => patch({ allow_discount_codes: v })}
          />
          <Field label={t.thankYou} hint={t.thankYouHint}>
            {({ id }) => (
              <div>
                <Textarea
                  id={id}
                  value={message}
                  maxLength={MAX_THANK_YOU}
                  onChange={(e) => patch({ thank_you_message: e.target.value.slice(0, MAX_THANK_YOU) })}
                  dir="auto"
                />
                <p className="mt-1 text-end text-xs tabular-nums text-ink-soft">
                  <bdi dir="ltr">{fmt(t.counter, { n: message.length, max: MAX_THANK_YOU })}</bdi>
                </p>
              </div>
            )}
          </Field>
        </section>

        <div className="sticky bottom-0 z-10 -mx-1 flex flex-wrap items-center justify-end gap-3 rounded-2xl border border-line bg-paper-raised/95 px-4 py-3 shadow-card backdrop-blur">
          {dirty && <p className="me-auto text-xs text-ink-soft">{t.unsaved}</p>}
          <Button onClick={save} disabled={saving || !dirty}>
            {saving ? c.saving : t.saveCheckout}
          </Button>
        </div>
      </div>

      <CheckoutPreview s={draft} />
    </div>
  );
}

function PreviewInput({ label, visibility = "required" }: { label: string; visibility?: CheckoutFieldVisibility }) {
  if (visibility === "hidden") return null;
  return (
    <div className="space-y-0.5">
      <p className="text-[10px] text-ink-soft">
        {label}
        {visibility === "required" && <span className="text-danger"> *</span>}
      </p>
      <div className="h-6 rounded border border-line bg-paper-raised" />
    </div>
  );
}

function CheckoutPreview({ s }: { s: CheckoutSettings }) {
  const t = useT(STRINGS);
  return (
    <aside className="lg:sticky lg:top-6 lg:self-start">
      <p className="mb-2 text-xs font-medium uppercase tracking-wide text-ink-soft">{t.previewTitle}</p>
      <div className="mx-auto w-full max-w-[300px] rounded-[2rem] border-[6px] border-zimos-navy/85 bg-paper-raised p-3 shadow-pop">
        <div className="mx-auto mb-2 h-1 w-16 rounded-full bg-ink/30" />
        <div className="space-y-2 rounded-[1.2rem] bg-paper p-3 text-xs">
          <PreviewInput label={t.fullName} />
          <PreviewInput label={t.phone} />
          <PreviewInput label={t.alternate_phone} visibility={s.alternate_phone} />
          <PreviewInput label={t.email} visibility={s.email} />
          <PreviewInput label={t.governorate} />
          <PreviewInput label={t.address} />
          <PreviewInput label={t.notes} visibility={s.notes} />
          {s.allow_discount_codes && (
            <div className="flex gap-1 pt-1">
              <div className="h-6 flex-1 rounded border border-dashed border-line" aria-label={t.discountCode} />
              <div className="rounded bg-paper-raised px-2 py-1 text-[10px] text-ink-soft">{t.apply}</div>
            </div>
          )}
          <div className="rounded bg-primary py-2 text-center text-[11px] font-medium text-white">{t.placeOrder}</div>
        </div>
      </div>
    </aside>
  );
}
