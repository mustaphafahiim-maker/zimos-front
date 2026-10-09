import { useEffect, useState } from "react";
import { Alert, Button } from "@store-builder/ui";
import {
  ApiError,
  CHECKOUT_HARDENING_LABEL_MAX,
  checkoutHardeningConsentSettingsOf,
  checkoutHardeningSaveConsentSettings,
  type CheckoutHardeningConsentSettings,
} from "@store-builder/api-client";
import { apiClient } from "@/lib/apiClient";
import { useWorkspaceId } from "@/lib/useWorkspaceId";
import { useErrorMessage } from "@/lib/errorMessages";
import { useWorkspace } from "@/context/WorkspaceContext";
import { useT, type Messages } from "@/i18n/LocaleContext";
import { SettingsGroup, SettingsSwitch } from "@/components/settings";
import { useToast } from "@/components/Toast";
import { InputRow } from "./sections/parts";

const STRINGS = {
  en: {
    title: "Consent boxes at checkout",
    marketing: "Marketing consent checkbox",
    marketingHint: "The buyer ticks it themselves; it is never pre-ticked. Buyers who tick it join your marketing list, unless they unsubscribed before",
    terms: "Terms checkbox (required)",
    termsHint: "Orders can't be placed without it. We link the terms and privacy policies you've written in Settings → Policies",
    noTerms: "You haven't written your terms of service yet — add them in Settings → Policies",
    labelAr: "Wording in Arabic",
    labelEn: "Wording in English",
    labelHint: "Leave empty to use the store's built-in wording.",
    marketingBuiltInAr: "ابعتلي العروض والجديد على الإيميل والواتساب",
    marketingBuiltInEn: "Send me news and offers",
    termsBuiltInAr: "أوافق على الشروط والأحكام وسياسة الخصوصية",
    termsBuiltInEn: "I agree to the terms of service and privacy policy",
    saveWording: "Save wording",
    saving: "Saving…",
    saved: "Saved. The checkout shows it right away.",
    readOnly: "Only the store owner, a workspace manager or an editor can change these.",
  },
  ar: {
    title: "خانات الموافقة في صفحة الدفع",
    marketing: "خانة الموافقة على الرسائل التسويقية",
    marketingHint: "العميل يختار بنفسه؛ الخانة مش متعلّمة مسبقًا. اللي يوافق يتضاف لقائمة التسويق إلا لو كان لغى اشتراكه قبل كده",
    terms: "خانة الموافقة على الشروط (إجبارية)",
    termsHint: "الطلب مش هيتم من غير الموافقة. بنربط سياسة الشروط والخصوصية اللي كاتبها في الإعدادات",
    noTerms: "لسه ما كتبتش الشروط والأحكام — اكتبها من الإعدادات ← السياسات",
    labelAr: "النص بالعربي",
    labelEn: "النص بالإنجليزي",
    labelHint: "سيبه فاضي عشان يظهر النص الجاهز بتاع المتجر.",
    marketingBuiltInAr: "ابعتلي العروض والجديد على الإيميل والواتساب",
    marketingBuiltInEn: "Send me news and offers",
    termsBuiltInAr: "أوافق على الشروط والأحكام وسياسة الخصوصية",
    termsBuiltInEn: "I agree to the terms of service and privacy policy",
    saveWording: "احفظ النص",
    saving: "بنحفظ…",
    saved: "اتحفظ. صفحة الدفع بتعرضه على طول.",
    readOnly: "صاحب المتجر أو مدير المتجر أو المحرر بس اللي يقدروا يغيّروا ده.",
  },
} satisfies Messages;

/** The system roles that carry website.edit, as the rest of the checkout form reads them (useSettingsEditor). */
const EDITOR_ROLES: ReadonlySet<string> = new Set(["owner", "workspace_manager", "editor"]);

type LabelKey = "marketing_checkbox_label" | "terms_checkbox_label";

/**
 * Store settings → Checkout form (handoff 374, website.edit): the checkout's
 * two consent boxes — «ابعتلي العروض» and «أوافق على الشروط» — each switched on
 * by the merchant, with its own wording in both languages. A switch saves as
 * it is flipped; the wording has its own button, so this card never competes
 * with the form's save bar above it.
 */
export function CheckoutConsentCard() {
  const t = useT(STRINGS);
  const workspaceId = useWorkspaceId();
  const { currentWorkspace, refresh } = useWorkspace();
  const toast = useToast();
  const errorMessage = useErrorMessage();
  const settingsBlob = (currentWorkspace?.settings ?? {}) as { checkout_settings?: unknown; legal?: Record<string, unknown> };

  const [saved, setSaved] = useState<CheckoutHardeningConsentSettings>(() => checkoutHardeningConsentSettingsOf(settingsBlob.checkout_settings));
  const [draft, setDraft] = useState(saved);
  const [saving, setSaving] = useState(false);
  const [forbidden, setForbidden] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Another store picked in the switcher: its own boxes.
  useEffect(() => {
    const next = checkoutHardeningConsentSettingsOf(((currentWorkspace?.settings ?? {}) as { checkout_settings?: unknown }).checkout_settings);
    setSaved(next);
    setDraft(next);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [workspaceId]);

  const editable = EDITOR_ROLES.has(currentWorkspace?.role ?? "") && !forbidden;
  const locked = !editable || saving;
  const wordingDirty = JSON.stringify([draft.marketing_checkbox_label, draft.terms_checkbox_label]) !== JSON.stringify([saved.marketing_checkbox_label, saved.terms_checkbox_label]);
  const termsWritten = typeof settingsBlob.legal?.terms_of_service === "string" && settingsBlob.legal.terms_of_service.trim() !== "";

  async function save(next: CheckoutHardeningConsentSettings) {
    if (saving) return;
    setSaving(true);
    setError(null);
    setDraft(next);
    try {
      const stored = await checkoutHardeningSaveConsentSettings(apiClient, workspaceId, next);
      setSaved(stored);
      setDraft(stored);
      toast.success(t.saved);
      void refresh({ silent: true });
    } catch (err) {
      setDraft(saved);
      if (err instanceof ApiError && err.status === 403) setForbidden(true);
      else setError(errorMessage(err));
    } finally {
      setSaving(false);
    }
  }

  const setLabel = (key: LabelKey, language: "ar" | "en", value: string) =>
    setDraft((prev) => ({ ...prev, [key]: { ...prev[key], [language]: value } }));

  const wording = (key: LabelKey, builtInAr: string, builtInEn: string) => (
    <>
      <InputRow
        label={t.labelAr}
        hint={t.labelHint}
        stacked
        dir="rtl"
        lang="ar"
        maxLength={CHECKOUT_HARDENING_LABEL_MAX}
        placeholder={builtInAr}
        disabled={locked}
        value={draft[key].ar}
        onChange={(e) => setLabel(key, "ar", e.target.value)}
      />
      <InputRow
        label={t.labelEn}
        stacked
        dir="ltr"
        lang="en"
        maxLength={CHECKOUT_HARDENING_LABEL_MAX}
        placeholder={builtInEn}
        disabled={locked}
        value={draft[key].en}
        onChange={(e) => setLabel(key, "en", e.target.value)}
      />
    </>
  );

  return (
    <div className="flex min-w-0 flex-col gap-3" data-checkout-consent-settings="">
      <SettingsGroup title={t.title} footer={editable ? undefined : t.readOnly}>
        <SettingsSwitch
          label={t.marketing}
          hint={t.marketingHint}
          checked={draft.marketing_checkbox === "on"}
          disabled={locked}
          onChange={(on) => void save({ ...draft, marketing_checkbox: on ? "on" : "off" })}
        />
        {draft.marketing_checkbox === "on" && wording("marketing_checkbox_label", t.marketingBuiltInAr, t.marketingBuiltInEn)}
        <SettingsSwitch
          label={t.terms}
          hint={t.termsHint}
          checked={draft.terms_checkbox === "required"}
          disabled={locked}
          onChange={(on) => void save({ ...draft, terms_checkbox: on ? "required" : "off" })}
        />
        {draft.terms_checkbox === "required" && wording("terms_checkbox_label", t.termsBuiltInAr, t.termsBuiltInEn)}
      </SettingsGroup>

      {draft.terms_checkbox === "required" && !termsWritten && <Alert variant="info">{t.noTerms}</Alert>}
      {error && <Alert variant="danger">{error}</Alert>}

      {editable && wordingDirty && (
        <div>
          <Button className="min-h-11 rounded-full px-5 sm:min-h-9" disabled={saving} onClick={() => void save(draft)}>
            {saving ? t.saving : t.saveWording}
          </Button>
        </div>
      )}
    </div>
  );
}
