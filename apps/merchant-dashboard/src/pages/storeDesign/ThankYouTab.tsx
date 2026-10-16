import {
  fillThankYouContent,
  resolveThankYouPage,
  storeDesignSaveThankYouPage,
  type ThankYouPageSettings,
} from "@store-builder/api-client";
import { apiClient } from "@/lib/apiClient";
import { useWorkspaceId } from "@/lib/useWorkspaceId";
import { useAsync } from "@/lib/useAsync";
import { useT, type Messages } from "@/i18n/LocaleContext";
import { DataState } from "@/components/DataState";
import { Section } from "@/components/Section";
import { Field } from "@/components/Field";
import { Select } from "@/components/Select";
import { Textarea } from "@/components/Textarea";
import { ReadOnlyNotice, SettingsFormFooter, ToggleRow } from "./SettingsFormFooter";
import { useSettingsEditor } from "./useSettingsEditor";

const STRINGS = {
  en: {
    title: "Thank-you page",
    description: "What the shopper sees right after placing an order.",
    enabled: "Use my own thank-you content",
    enabledHint: "When off, the store shows its built-in thank-you page.",
    content: "Message",
    contentHint: "Plain text, one paragraph per line. {{order_number}} and {{customer_name}} are filled in for each order.",
    backHome: "Back-to-store button",
    backHomeHint: "Let the shopper return to the store from the thank-you page.",
    collection: "Show products from a collection",
    collectionHint: "Up to four products shown under the order summary.",
    none: "Don't show products",
    preview: "Preview",
    previewEmpty: "Write a message to see it here.",
    sampleName: "Ahmed",
    saved: "Thank-you page saved.",
  },
  ar: {
    title: "صفحة الشكر",
    description: "ما يراه المشتري بعد تسجيل الطلب مباشرة.",
    enabled: "استخدام محتوى شكر خاص بي",
    enabledHint: "عند الإيقاف يعرض المتجر صفحة الشكر الافتراضية.",
    content: "الرسالة",
    contentHint: "نص عادي، فقرة في كل سطر. يتم استبدال {{order_number}} و {{customer_name}} لكل طلب.",
    backHome: "زر العودة للمتجر",
    backHomeHint: "يسمح للمشتري بالعودة للمتجر من صفحة الشكر.",
    collection: "عرض منتجات من تصنيف",
    collectionHint: "حتى أربعة منتجات تظهر تحت ملخص الطلب.",
    none: "بدون منتجات",
    preview: "معاينة",
    previewEmpty: "اكتب رسالة لتظهر هنا.",
    sampleName: "أحمد",
    saved: "تم حفظ صفحة الشكر.",
  },
} satisfies Messages;

export function ThankYouTab() {
  const t = useT(STRINGS);
  const workspaceId = useWorkspaceId();
  const editor = useSettingsEditor<ThankYouPageSettings>(
    (settings) => resolveThankYouPage(settings.thank_you_page),
    (draft) => storeDesignSaveThankYouPage(apiClient, workspaceId, draft),
    t.saved
  );
  const { draft, setDraft, editable, saving } = editor;
  const locked = !editable || saving;
  const collections = useAsync(() => apiClient.listCollections(workspaceId), [workspaceId]);
  const preview = fillThankYouContent(draft.content, { orderNumber: "1042", customerName: t.sampleName })
    .split(/\n+/)
    .map((line) => line.trim())
    .filter(Boolean);

  return (
    <DataState loading={!editor.ready} error={null}>
      <div className="space-y-5">
        <ReadOnlyNotice editable={editable} />

        <Section title={t.title} description={t.description}>
          <div className="space-y-4">
            <ToggleRow
              label={t.enabled}
              hint={t.enabledHint}
              checked={draft.enabled}
              disabled={locked}
              onChange={(enabled) => setDraft((prev) => ({ ...prev, enabled }))}
            />

            <Field label={t.content} hint={t.contentHint}>
              {({ id }) => (
                <Textarea
                  id={id}
                  rows={6}
                  maxLength={5000}
                  disabled={locked || !draft.enabled}
                  value={draft.content}
                  onChange={(e) => setDraft((prev) => ({ ...prev, content: e.target.value }))}
                />
              )}
            </Field>

            <ToggleRow
              label={t.backHome}
              hint={t.backHomeHint}
              checked={draft.show_back_home_button}
              disabled={locked || !draft.enabled}
              onChange={(v) => setDraft((prev) => ({ ...prev, show_back_home_button: v }))}
            />

            <Field label={t.collection} hint={t.collectionHint}>
              {({ id }) => (
                <Select
                  id={id}
                  disabled={locked || !draft.enabled || collections.loading}
                  value={draft.show_products_from_collection_id ?? ""}
                  onChange={(e) =>
                    setDraft((prev) => ({ ...prev, show_products_from_collection_id: e.target.value || null }))
                  }
                >
                  <option value="">{t.none}</option>
                  {(collections.data ?? []).map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </Select>
              )}
            </Field>
          </div>
        </Section>

        {draft.enabled && (
          <Section title={t.preview}>
            {preview.length === 0 ? (
              <p className="text-sm text-ink-soft">{t.previewEmpty}</p>
            ) : (
              <div className="space-y-2 rounded-[0.5rem] bg-paper p-4 text-sm leading-relaxed text-ink">
                {preview.map((line, i) => (
                  <p key={i}>{line}</p>
                ))}
              </div>
            )}
          </Section>
        )}

        <SettingsFormFooter
          editable={editable}
          dirty={editor.dirty}
          saving={saving}
          error={editor.error}
          onSave={() => void editor.save()}
          onReset={editor.reset}
        />
      </div>
    </DataState>
  );
}
