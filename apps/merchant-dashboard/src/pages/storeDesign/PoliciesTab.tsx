import { useState } from "react";
import { Alert, Button } from "@store-builder/ui";
import {
  LEGAL_POLICY_KEYS,
  listManualPaymentMethods,
  resolveLegal,
  resolveStoreInfo,
  storeDesignSaveLegal,
  type LegalPolicyKey,
  type LegalSettings,
} from "@store-builder/api-client";
import { apiClient } from "@/lib/apiClient";
import { useAsync } from "@/lib/useAsync";
import { useWorkspaceId } from "@/lib/useWorkspaceId";
import { useWorkspace } from "@/context/WorkspaceContext";
import { useT, type Messages } from "@/i18n/LocaleContext";
import { DataState } from "@/components/DataState";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { Section } from "@/components/Section";
import { Field } from "@/components/Field";
import { Textarea } from "@/components/Textarea";
import { ReadOnlyNotice, SettingsFormFooter } from "./SettingsFormFooter";
import { buildPolicyTemplate, findPlaceholders, paymentsFrom, type PolicyLang } from "./policyTemplates";
import { useSettingsEditor } from "./useSettingsEditor";

const STRINGS = {
  en: {
    intro:
      "Written once, linked from the store footer, every funnel and the checkout. Shipping, returns and privacy policies are required for TikTok ads.",
    variables: "You can use {{store.name}}, {{store.address}}, {{store.email}} and {{store.phone}} — they are filled in from Store information.",
    disclaimer: "Templates are general, not legal advice; review them before publishing.",
    basedOn: "Templates follow your payment options:",
    cod: "cash on delivery",
    online: "online payment",
    manual: "InstaPay / wallet",
    listSep: ", ",
    paymentsUnknown:
      "Your payment settings could not be read, so templates only cover cash on delivery. Check them if you take online or InstaPay / wallet payments.",
    refund_policy: "Refund policy",
    privacy_policy: "Privacy policy",
    terms_of_service: "Terms of service",
    termsNote: "Includes the shipping and delivery section.",
    body: "Policy text",
    bodyHint: "Plain text, one paragraph per line. Leave empty to keep this policy out of the store.",
    templateAr: "Use a template (Arabic)",
    templateEn: "Use a template (English)",
    toFill: "Still to fill in:",
    replaceTitle: "Replace the current text?",
    replaceBody: "The template will replace what is written in this policy. Nothing is saved until you press Save.",
    current: "Current text:",
    replace: "Replace",
    cancel: "Cancel",
    unfilledTitle: "Save with empty placeholders?",
    unfilledBody: "These [placeholders] are still in your policies and will show in the store as they are:",
    saveAnyway: "Save anyway",
    keepEditing: "Keep editing",
    saved: "Policies saved.",
  },
  ar: {
    intro:
      "تُكتب مرة واحدة وتظهر في فوتر المتجر وكل مسارات البيع وصفحة إتمام الطلب. سياسات الشحن والاسترجاع والخصوصية مطلوبة لإعلانات تيك توك.",
    variables: "يمكنك استخدام {{store.name}} و {{store.address}} و {{store.email}} و {{store.phone}} — تُملأ من بيانات المتجر.",
    disclaimer: "القوالب عامة وليست استشارة قانونية؛ راجعها قبل النشر.",
    basedOn: "تتبع القوالب طرق الدفع في متجرك:",
    cod: "الدفع عند الاستلام",
    online: "الدفع الإلكتروني",
    manual: "إنستاباي / المحفظة",
    listSep: "، ",
    paymentsUnknown:
      "تعذّر قراءة إعدادات الدفع، لذا تغطي القوالب الدفع عند الاستلام فقط. راجعها إذا كنت تقبل الدفع الإلكتروني أو إنستاباي / المحفظة.",
    refund_policy: "سياسة الاسترجاع",
    privacy_policy: "سياسة الخصوصية",
    terms_of_service: "شروط الخدمة",
    termsNote: "تتضمن قسم الشحن والتوصيل.",
    body: "نص السياسة",
    bodyHint: "نص عادي، فقرة في كل سطر. اتركه فارغًا لعدم إظهار هذه السياسة في المتجر.",
    templateAr: "استخدام قالب (عربي)",
    templateEn: "استخدام قالب (إنجليزي)",
    toFill: "متبقٍ للتعبئة:",
    replaceTitle: "استبدال النص الحالي؟",
    replaceBody: "سيستبدل القالب ما هو مكتوب في هذه السياسة. لا يُحفظ شيء حتى تضغط حفظ.",
    current: "النص الحالي:",
    replace: "استبدال",
    cancel: "إلغاء",
    unfilledTitle: "الحفظ مع خانات غير معبأة؟",
    unfilledBody: "ما زالت هذه [الخانات] في سياساتك وستظهر في المتجر كما هي:",
    saveAnyway: "الحفظ على أي حال",
    keepEditing: "متابعة التعديل",
    saved: "تم حفظ السياسات.",
  },
} satisfies Messages;

/** The list of [placeholders] still in a text, highlighted so the merchant fills them. */
function Placeholders({ items, label }: { items: string[]; label?: string }) {
  if (items.length === 0) return null;
  return (
    <div className="mt-2 text-xs text-ink-soft">
      {label && <span>{label}</span>}
      <ul className="mt-1 flex flex-wrap gap-1.5">
        {items.map((item) => (
          <li key={item} dir="auto">
            <mark className="rounded border border-warning bg-transparent px-1.5 py-0.5 text-warning">{item}</mark>
          </li>
        ))}
      </ul>
    </div>
  );
}

export function PoliciesTab() {
  const t = useT(STRINGS);
  const workspaceId = useWorkspaceId();
  const { currentWorkspace } = useWorkspace();
  const editor = useSettingsEditor<LegalSettings>(
    (settings) => resolveLegal(settings.legal),
    (draft) => storeDesignSaveLegal(apiClient, workspaceId, draft),
    t.saved
  );
  const { draft, setDraft, editable, saving } = editor;
  const locked = !editable || saving;
  const [pending, setPending] = useState<{ key: LegalPolicyKey; lang: PolicyLang } | null>(null);
  const [confirmSave, setConfirmSave] = useState(false);

  // Which payment blocks go into a template. Either list may be closed to this
  // role (GET /payments/methods wants the owner or a manager): it then counts as off.
  const payments = useAsync(async () => {
    const [methods, manual] = await Promise.all([
      apiClient.listPaymentMethods(workspaceId).catch(() => null),
      listManualPaymentMethods(apiClient, workspaceId).catch(() => null),
    ]);
    return paymentsFrom(methods, manual);
  }, [workspaceId]);
  const info = resolveStoreInfo((currentWorkspace?.settings as Record<string, unknown> | undefined)?.store_info);

  const apply = (key: LegalPolicyKey, lang: PolicyLang) =>
    setDraft((prev) => ({
      ...prev,
      [key]: buildPolicyTemplate(key, lang, {
        payments: payments.data ?? { online: false, manual: false },
        hasPhone: info.phone !== "",
        hasEmail: info.email !== "",
      }),
    }));
  // An empty policy takes the template at once; a written one asks first.
  const fromTemplate = (key: LegalPolicyKey, lang: PolicyLang) =>
    draft[key].trim() ? setPending({ key, lang }) : apply(key, lang);

  const unfilled = [...new Set(LEGAL_POLICY_KEYS.flatMap((key) => findPlaceholders(draft[key])))];
  const save = () => (unfilled.length > 0 ? setConfirmSave(true) : void editor.save());

  const options = payments.data
    ? [t.cod, payments.data.online && t.online, payments.data.manual && t.manual].filter(Boolean).join(t.listSep)
    : null;

  return (
    <DataState loading={!editor.ready} error={null}>
      <div className="space-y-5">
        <ReadOnlyNotice editable={editable} />
        <Alert>
          <p>{t.intro}</p>
          <p className="mt-1" dir="auto">
            {t.variables}
          </p>
          <p className="mt-1">{t.disclaimer}</p>
          {editable && payments.data && (
            <p className="mt-1">
              {payments.data.known ? `${t.basedOn} ${options}.` : t.paymentsUnknown}
            </p>
          )}
        </Alert>

        {LEGAL_POLICY_KEYS.map((key) => (
          <Section
            key={key}
            title={t[key]}
            description={key === "terms_of_service" ? t.termsNote : undefined}
            actions={
              editable ? (
                <>
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={saving || payments.loading}
                    onClick={() => fromTemplate(key, "ar")}
                  >
                    {t.templateAr}
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={saving || payments.loading}
                    onClick={() => fromTemplate(key, "en")}
                  >
                    {t.templateEn}
                  </Button>
                </>
              ) : undefined
            }
          >
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
                />
              )}
            </Field>
            <Placeholders items={findPlaceholders(draft[key])} label={t.toFill} />
          </Section>
        ))}

        <SettingsFormFooter
          editable={editable}
          dirty={editor.dirty}
          saving={saving}
          error={editor.error}
          onSave={save}
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
        >
          {pending && (
            <div className="text-xs text-ink-soft">
              <p>{t.current}</p>
              <p className="mt-1 line-clamp-4 whitespace-pre-line rounded-md border p-2 text-ink" dir="auto">
                {draft[pending.key]}
              </p>
            </div>
          )}
        </ConfirmDialog>

        <ConfirmDialog
          open={confirmSave}
          title={t.unfilledTitle}
          description={t.unfilledBody}
          confirmLabel={t.saveAnyway}
          cancelLabel={t.keepEditing}
          onConfirm={() => {
            setConfirmSave(false);
            void editor.save();
          }}
          onCancel={() => setConfirmSave(false)}
        >
          <Placeholders items={unfilled} />
        </ConfirmDialog>
      </div>
    </DataState>
  );
}
