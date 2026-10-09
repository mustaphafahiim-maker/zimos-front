import { resolveStoreSeo, storeDesignSaveSeo, type StoreSeoSettings } from "@store-builder/api-client";
import { apiClient } from "@/lib/apiClient";
import { useWorkspaceId } from "@/lib/useWorkspaceId";
import { useWorkspace } from "@/context/WorkspaceContext";
import { useT, type Messages } from "@/i18n/LocaleContext";
import { DataState } from "@/components/DataState";
import { SettingsGroup } from "@/components/settings";
import { ReadOnlyNotice, SettingsFormFooter } from "./SettingsFormFooter";
import { useSettingsEditor } from "./useSettingsEditor";
import { GroupBlock, InputRow, STACK, SettingsSkeleton, TextareaRow } from "./sections/parts";

const STRINGS = {
  en: {
    title: "Search engines",
    description: "How your store appears in Google and when a link to it is shared.",
    titleTemplate: "Page title template",
    titleTemplateHint: "%s is replaced by each page's own title, for example: %s | My store. Leave empty for the default.",
    titleTemplateError: "The template must contain %s.",
    metaDescription: "Store description",
    metaDescriptionHint: "One or two sentences, up to 320 characters.",
    ogImage: "Share image link",
    ogImageHint: "Shown when a store link is shared on WhatsApp or Facebook. 1200×630 works best.",
    verification: "Google Search Console verification",
    verificationHint: "Only the code inside content=\"…\" of the meta tag Google gives you.",
    preview: "Search result preview",
    samplePage: "Product name",
    auto: "sitemap.xml and robots.txt are generated for your store automatically, and each product page carries Product data for Google.",
    saved: "SEO settings saved.",
  },
  ar: {
    title: "محركات البحث",
    description: "كيف يظهر متجرك في جوجل وعند مشاركة رابط له.",
    titleTemplate: "قالب عنوان الصفحة",
    titleTemplateHint: "يُستبدل %s بعنوان كل صفحة، مثال: %s | متجري. اتركه فارغًا للقالب الافتراضي.",
    titleTemplateError: "يجب أن يحتوي القالب على %s.",
    metaDescription: "وصف المتجر",
    metaDescriptionHint: "جملة أو جملتان، حتى 320 حرفًا.",
    ogImage: "رابط صورة المشاركة",
    ogImageHint: "تظهر عند مشاركة رابط المتجر على واتساب أو فيسبوك. المقاس الأفضل 1200×630.",
    verification: "توثيق Google Search Console",
    verificationHint: "الكود الموجود داخل content=\"…\" فقط من وسم meta الذي يعطيه جوجل.",
    preview: "معاينة نتيجة البحث",
    samplePage: "اسم المنتج",
    auto: "ملفا sitemap.xml و robots.txt يُنشآن لمتجرك تلقائيًا، وكل صفحة منتج تحمل بيانات Product لجوجل.",
    saved: "تم حفظ إعدادات SEO.",
  },
} satisfies Messages;

export function SeoTab() {
  const t = useT(STRINGS);
  const workspaceId = useWorkspaceId();
  const { currentWorkspace } = useWorkspace();
  const editor = useSettingsEditor<StoreSeoSettings>(
    (settings) => resolveStoreSeo(settings.store_seo),
    (draft) => storeDesignSaveSeo(apiClient, workspaceId, draft),
    t.saved
  );
  const { draft, setDraft, editable, saving } = editor;
  const locked = !editable || saving;
  const storeName = currentWorkspace?.name ?? "";
  const template = draft.title_template.trim();
  const templateInvalid = template !== "" && !template.includes("%s");
  const previewTitle = (template && !templateInvalid ? template : `%s — ${storeName}`).replace("%s", t.samplePage);

  return (
    <DataState loading={!editor.ready} error={null} skeleton={<SettingsSkeleton />}>
      <div className={STACK}>
        <ReadOnlyNotice editable={editable} />

        {/* The result first: what the fields below change. */}
        <SettingsGroup title={t.preview}>
          <GroupBlock>
            <p className="truncate text-base font-medium text-primary" dir="auto">
              {previewTitle}
            </p>
            <p className="mt-1 line-clamp-2 text-sm text-ink-soft" dir="auto">
              {draft.description || storeName}
            </p>
          </GroupBlock>
        </SettingsGroup>

        <SettingsGroup title={t.title} description={t.description} footer={t.auto}>
          <InputRow
            label={t.titleTemplate}
            hint={t.titleTemplateHint}
            error={templateInvalid ? t.titleTemplateError : undefined}
            stacked
            dir="auto"
            maxLength={120}
            value={draft.title_template}
            disabled={locked}
            onChange={(e) => setDraft((prev) => ({ ...prev, title_template: e.target.value }))}
          />
          <TextareaRow
            label={t.metaDescription}
            hint={t.metaDescriptionHint}
            rows={3}
            dir="auto"
            maxLength={320}
            disabled={locked}
            value={draft.description}
            onChange={(e) => setDraft((prev) => ({ ...prev, description: e.target.value }))}
          />
          <InputRow
            label={t.ogImage}
            hint={t.ogImageHint}
            stacked
            type="url"
            inputMode="url"
            dir="ltr"
            maxLength={1000}
            placeholder="https://"
            value={draft.og_image_url}
            disabled={locked}
            onChange={(e) => setDraft((prev) => ({ ...prev, og_image_url: e.target.value }))}
          />
          <InputRow
            label={t.verification}
            hint={t.verificationHint}
            stacked
            dir="ltr"
            maxLength={120}
            value={draft.google_site_verification}
            disabled={locked}
            onChange={(e) => setDraft((prev) => ({ ...prev, google_site_verification: e.target.value }))}
          />
        </SettingsGroup>

        <SettingsFormFooter
          editable={editable}
          dirty={editor.dirty}
          saving={saving}
          error={editor.error}
          blocked={templateInvalid ? t.titleTemplateError : null}
          onSave={() => void editor.save()}
          onReset={editor.reset}
        />
      </div>
    </DataState>
  );
}
