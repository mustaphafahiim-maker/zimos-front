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
import { IconSuccess } from "@/components/icons";
import { DataState } from "@/components/DataState";
import { SettingsGroup, SettingsSwitch } from "@/components/settings";
import { ReadOnlyNotice, SettingsFormFooter } from "./SettingsFormFooter";
import { useSettingsEditor } from "./useSettingsEditor";
import { GroupBlock, STACK, SelectRow, SettingsSkeleton, TextareaRow } from "./sections/parts";

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
    previewHint: "A sample order, so you can see the message filled in.",
    previewBackHome: "Back to the store",
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
    previewHint: "أوردر تجريبي، عشان تشوف الرسالة وهي متملية.",
    previewBackHome: "ارجع للمتجر",
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
    <DataState loading={!editor.ready} error={null} skeleton={<SettingsSkeleton />}>
      <div className={STACK}>
        <ReadOnlyNotice editable={editable} />

        <SettingsGroup>
          <SettingsSwitch
            label={t.enabled}
            hint={t.enabledHint}
            checked={draft.enabled}
            disabled={locked}
            onChange={(enabled) => setDraft((prev) => ({ ...prev, enabled }))}
          />
          <TextareaRow
            label={t.content}
            hint={t.contentHint}
            rows={6}
            dir="auto"
            maxLength={5000}
            disabled={locked || !draft.enabled}
            value={draft.content}
            onChange={(e) => setDraft((prev) => ({ ...prev, content: e.target.value }))}
          />
          <SettingsSwitch
            label={t.backHome}
            hint={t.backHomeHint}
            checked={draft.show_back_home_button}
            disabled={locked || !draft.enabled}
            onChange={(v) => setDraft((prev) => ({ ...prev, show_back_home_button: v }))}
          />
          <SelectRow
            label={t.collection}
            hint={t.collectionHint}
            disabled={locked || !draft.enabled || collections.loading}
            value={draft.show_products_from_collection_id ?? ""}
            onChange={(e) => setDraft((prev) => ({ ...prev, show_products_from_collection_id: e.target.value || null }))}
          >
            <option value="">{t.none}</option>
            {(collections.data ?? []).map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </SelectRow>
        </SettingsGroup>

        {draft.enabled && (
          <SettingsGroup title={t.preview} description={t.previewHint}>
            <GroupBlock className="py-5">
              {preview.length === 0 ? (
                <p className="text-sm text-ink-soft">{t.previewEmpty}</p>
              ) : (
                <div className="mx-auto flex max-w-sm flex-col items-center gap-3 text-center">
                  <IconSuccess className="size-10 text-success" weight="duotone" aria-hidden />
                  <div className="space-y-2 text-sm leading-relaxed text-ink" dir="auto">
                    {preview.map((line, i) => (
                      <p key={i}>{line}</p>
                    ))}
                  </div>
                  {draft.show_back_home_button && (
                    <span aria-hidden className="inline-flex min-h-10 items-center rounded-full bg-primary px-5 text-sm font-semibold text-primary-foreground">
                      {t.previewBackHome}
                    </span>
                  )}
                </div>
              )}
            </GroupBlock>
          </SettingsGroup>
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
