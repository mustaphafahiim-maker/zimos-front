import { useState } from "react";
import { Alert, Button } from "@store-builder/ui";
import {
  LEGAL_POLICY_KEYS,
  resolveLegal,
  storeDesignSaveLegal,
  type LegalPolicyKey,
  type LegalSettings,
} from "@store-builder/api-client";
import { apiClient } from "@/lib/apiClient";
import { useWorkspaceId } from "@/lib/useWorkspaceId";
import { fmt, useT, type Messages } from "@/i18n/LocaleContext";
import { IconCourier, IconDocument, IconReturns, IconShield, type IconComponent } from "@/components/icons";
import { AccordionSection } from "@/components/Accordion";
import { DataState } from "@/components/DataState";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { Field } from "@/components/Field";
import { Textarea } from "@/components/Textarea";
import { ReadOnlyNotice, SettingsFormFooter } from "./SettingsFormFooter";
import { POLICY_TEMPLATES } from "./policyTemplates";
import { useSettingsEditor } from "./useSettingsEditor";
import { STACK, SettingsSkeleton } from "./sections/parts";

const POLICY_ICON: Record<LegalPolicyKey, IconComponent> = {
  shipping_policy: IconCourier,
  refund_policy: IconReturns,
  privacy_policy: IconShield,
  terms_of_service: IconDocument,
};

const STRINGS = {
  en: {
    intro:
      "Written once, linked from the store footer, every funnel and the checkout. Shipping, returns and privacy policies are required for TikTok ads.",
    variables: "You can use {{store.name}}, {{store.address}}, {{store.email}} and {{store.phone}} — they are filled in from Store information.",
    shipping_policy: "Shipping policy",
    refund_policy: "Refund policy",
    privacy_policy: "Privacy policy",
    terms_of_service: "Terms of service",
    body: "Policy text",
    bodyHint: "Plain text, one paragraph per line. Leave empty to keep this policy out of the store.",
    templateAr: "Create from template (Arabic)",
    templateEn: "Create from template (English)",
    replaceTitle: "Replace the current text?",
    replaceBody: "The template will replace what is written in this policy. Nothing is saved until you press Save.",
    replace: "Replace",
    cancel: "Cancel",
    empty: "Not written yet — it won't show in the store",
    written: "Written · {n} lines",
    startFrom: "Start from a ready text:",
    saved: "Policies saved.",
  },
  ar: {
    intro:
      "تُكتب مرة واحدة وتظهر في فوتر المتجر وكل مسارات البيع وصفحة إتمام الطلب. سياسات الشحن والاسترجاع والخصوصية مطلوبة لإعلانات تيك توك.",
    variables: "يمكنك استخدام {{store.name}} و {{store.address}} و {{store.email}} و {{store.phone}} — تُملأ من بيانات المتجر.",
    shipping_policy: "سياسة الشحن",
    refund_policy: "سياسة الاسترجاع",
    privacy_policy: "سياسة الخصوصية",
    terms_of_service: "شروط الخدمة",
    body: "نص السياسة",
    bodyHint: "نص عادي، فقرة في كل سطر. اتركه فارغًا لعدم إظهار هذه السياسة في المتجر.",
    templateAr: "إنشاء من قالب (عربي)",
    templateEn: "إنشاء من قالب (إنجليزي)",
    replaceTitle: "استبدال النص الحالي؟",
    replaceBody: "سيستبدل القالب ما هو مكتوب في هذه السياسة. لا يُحفظ شيء حتى تضغط حفظ.",
    replace: "استبدال",
    cancel: "إلغاء",
    empty: "لسه ما اتكتبتش — مش هتظهر في المتجر",
    written: "مكتوبة · {n} سطر",
    startFrom: "ابدأ من نص جاهز:",
    saved: "اتحفظت السياسات.",
  },
} satisfies Messages;

export function PoliciesTab() {
  const t = useT(STRINGS);
  const workspaceId = useWorkspaceId();
  const editor = useSettingsEditor<LegalSettings>(
    (settings) => resolveLegal(settings.legal),
    (draft) => storeDesignSaveLegal(apiClient, workspaceId, draft),
    t.saved
  );
  const { draft, setDraft, editable, saving } = editor;
  const locked = !editable || saving;
  const [pending, setPending] = useState<{ key: LegalPolicyKey; lang: "ar" | "en" } | null>(null);

  const apply = (key: LegalPolicyKey, lang: "ar" | "en") =>
    setDraft((prev) => ({ ...prev, [key]: POLICY_TEMPLATES[lang][key] }));
  // An empty policy takes the template at once; a written one asks first.
  const fromTemplate = (key: LegalPolicyKey, lang: "ar" | "en") =>
    draft[key].trim() ? setPending({ key, lang }) : apply(key, lang);

  return (
    <DataState loading={!editor.ready} error={null} skeleton={<SettingsSkeleton groups={1} rows={4} />}>
      <div className={STACK}>
        <ReadOnlyNotice editable={editable} />
        <Alert>
          <p>{t.intro}</p>
          <p className="mt-1" dir="auto">
            {t.variables}
          </p>
        </Alert>

        {/* Four long texts: each folds to one row saying whether it is written. Kept mounted, so a fold never drops an edit. */}
        {LEGAL_POLICY_KEYS.map((key, index) => {
          const lines = draft[key].split(/\n+/).filter((line) => line.trim() !== "").length;
          return (
            <AccordionSection
              key={key}
              title={t[key]}
              icon={POLICY_ICON[key]}
              summary={lines === 0 ? t.empty : fmt(t.written, { n: lines })}
              defaultOpen={index === 0}
              persistKey={`store-settings:policies:${key}`}
              keepMounted
            >
              {editable && (
                <div className="mb-3 flex flex-wrap items-center gap-2">
                  <span className="text-[13px] text-ink-soft">{t.startFrom}</span>
                  <Button variant="outline" className="min-h-11 rounded-full px-4 sm:min-h-9" disabled={saving} onClick={() => fromTemplate(key, "ar")}>
                    {t.templateAr}
                  </Button>
                  <Button variant="outline" className="min-h-11 rounded-full px-4 sm:min-h-9" disabled={saving} onClick={() => fromTemplate(key, "en")}>
                    {t.templateEn}
                  </Button>
                </div>
              )}
              <Field label={t.body} hint={t.bodyHint} labelHidden>
                {({ id }) => (
                  <Textarea
                    id={id}
                    rows={10}
                    dir="auto"
                    maxLength={30000}
                    disabled={locked}
                    value={draft[key]}
                    onChange={(e) => setDraft((prev) => ({ ...prev, [key]: e.target.value }))}
                    className="text-base sm:text-sm"
                  />
                )}
              </Field>
            </AccordionSection>
          );
        })}

        <SettingsFormFooter
          editable={editable}
          dirty={editor.dirty}
          saving={saving}
          error={editor.error}
          onSave={() => void editor.save()}
          onReset={editor.reset}
        />

        <ConfirmDialog
          open={pending !== null}
          title={t.replaceTitle}
          description={t.replaceBody}
          confirmLabel={t.replace}
          cancelLabel={t.cancel}
          onConfirm={() => {
            if (pending) apply(pending.key, pending.lang);
            setPending(null);
          }}
          onCancel={() => setPending(null)}
        />
      </div>
    </DataState>
  );
}
