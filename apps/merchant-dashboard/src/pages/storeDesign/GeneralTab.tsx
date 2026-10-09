import {
  SOCIAL_LINK_KEYS,
  resolveGeneralStoreSettings,
  storeDesignSaveGeneral,
  type GeneralStoreSettings,
  type SocialLinkKey,
} from "@store-builder/api-client";
import { apiClient } from "@/lib/apiClient";
import { useWorkspaceId } from "@/lib/useWorkspaceId";
import { fmt, useT, type Messages } from "@/i18n/LocaleContext";
import { IconShare } from "@/components/icons";
import { AccordionSection } from "@/components/Accordion";
import { DataState } from "@/components/DataState";
import { TextField } from "@/components/Field";
import { SettingsGroup, SettingsSwitch } from "@/components/settings";
import { StoreAppSection } from "./StoreAppSection";
import { ReadOnlyNotice, SettingsFormFooter } from "./SettingsFormFooter";
import { useSettingsEditor } from "./useSettingsEditor";
import { InputRow, STACK, SelectRow, SettingsSkeleton, TOUCH_FIELDS, TextareaRow } from "./sections/parts";

const COUNTRIES = ["EG", "SA", "AE", "KW", "QA", "BH", "OM", "JO", "IQ", "LY", "MA", "DZ", "TN"] as const;

const STRINGS = {
  en: {
    identity: "Store identity",
    identityDescription: "The small icon browsers show on the tab, and the country your store sells in.",
    favicon: "Icon link (favicon)",
    faviconHint: "A square PNG or ICO, at least 32×32. Paste a link from your media library.",
    country: "Country",
    countryNone: "Not set",
    EG: "Egypt",
    SA: "Saudi Arabia",
    AE: "United Arab Emirates",
    KW: "Kuwait",
    QA: "Qatar",
    BH: "Bahrain",
    OM: "Oman",
    JO: "Jordan",
    IQ: "Iraq",
    LY: "Libya",
    MA: "Morocco",
    DZ: "Algeria",
    TN: "Tunisia",
    social: "Social links",
    socialDescription: "Shown in the store footer. Leave a field empty to hide that link.",
    facebook: "Facebook",
    instagram: "Instagram",
    tiktok: "TikTok",
    whatsapp: "WhatsApp",
    youtube: "YouTube",
    snapchat: "Snapchat",
    x: "X",
    linkHint: "A full link starting with https://",
    whatsappButton: "Floating WhatsApp button",
    whatsappDescription: "A chat button pinned to the corner of every store page.",
    whatsappEnabled: "Show the button",
    whatsappPhone: "WhatsApp number",
    whatsappPhoneHint: "With the country code, digits only — for example 201001234567.",
    whatsappMessage: "Opening message",
    whatsappMessageHint: "What the shopper's chat starts with. Optional.",
    faviconPreview: "The icon as it will show",
    socialNone: "No links yet — add the ones you use",
    socialCount: "{n} of {max} filled in",
    saved: "General settings saved.",
  },
  ar: {
    identity: "هوية المتجر",
    identityDescription: "الأيقونة الصغيرة التي تظهر في تبويب المتصفح، والدولة التي يبيع فيها متجرك.",
    favicon: "رابط الأيقونة (favicon)",
    faviconHint: "صورة مربعة PNG أو ICO بحجم 32×32 على الأقل. الصق رابطًا من مكتبة الصور.",
    country: "الدولة",
    countryNone: "غير محددة",
    EG: "مصر",
    SA: "السعودية",
    AE: "الإمارات",
    KW: "الكويت",
    QA: "قطر",
    BH: "البحرين",
    OM: "عُمان",
    JO: "الأردن",
    IQ: "العراق",
    LY: "ليبيا",
    MA: "المغرب",
    DZ: "الجزائر",
    TN: "تونس",
    social: "روابط التواصل",
    socialDescription: "تظهر في فوتر المتجر. اترك الحقل فارغًا لإخفاء الرابط.",
    facebook: "فيسبوك",
    instagram: "إنستجرام",
    tiktok: "تيك توك",
    whatsapp: "واتساب",
    youtube: "يوتيوب",
    snapchat: "سناب شات",
    x: "إكس",
    linkHint: "رابط كامل يبدأ بـ https://",
    whatsappButton: "زر واتساب العائم",
    whatsappDescription: "زر محادثة ثابت في ركن كل صفحات المتجر.",
    whatsappEnabled: "إظهار الزر",
    whatsappPhone: "رقم واتساب",
    whatsappPhoneHint: "بكود الدولة وأرقام فقط — مثال 201001234567.",
    whatsappMessage: "رسالة البداية",
    whatsappMessageHint: "ما تبدأ به محادثة المشتري. اختياري.",
    faviconPreview: "شكل الأيقونة",
    socialNone: "لسه مفيش روابط — ضيف اللي بتستخدمه",
    socialCount: "{n} من {max} مكتوبين",
    saved: "اتحفظت الإعدادات العامة.",
  },
} satisfies Messages;

export function GeneralTab() {
  const t = useT(STRINGS);
  const workspaceId = useWorkspaceId();
  const editor = useSettingsEditor<GeneralStoreSettings>(
    (settings) => resolveGeneralStoreSettings(settings),
    (draft) => storeDesignSaveGeneral(apiClient, workspaceId, draft),
    t.saved
  );
  const { draft, setDraft, editable, saving } = editor;
  const locked = !editable || saving;
  const setLink = (key: SocialLinkKey, value: string) =>
    setDraft((prev) => ({ ...prev, social_links: { ...prev.social_links, [key]: value } }));
  const setWhatsapp = (patch: Partial<GeneralStoreSettings["floating_whatsapp"]>) =>
    setDraft((prev) => ({ ...prev, floating_whatsapp: { ...prev.floating_whatsapp, ...patch } }));
  const filledLinks = SOCIAL_LINK_KEYS.filter((key) => draft.social_links[key].trim() !== "").length;
  const faviconShown = /^https?:\/\//i.test(draft.favicon_url);

  return (
    <DataState loading={!editor.ready} error={null} skeleton={<SettingsSkeleton />}>
      {/* Two forms, two saves: each in its own column, so each save bar stays with its own form. */}
      <div className={STACK}>
        <ReadOnlyNotice editable={editable} />

        <SettingsGroup title={t.whatsappButton} description={t.whatsappDescription}>
          <SettingsSwitch
            label={t.whatsappEnabled}
            checked={draft.floating_whatsapp.enabled}
            disabled={locked}
            onChange={(enabled) => setWhatsapp({ enabled })}
          />
          <InputRow
            label={t.whatsappPhone}
            hint={t.whatsappPhoneHint}
            type="tel"
            inputMode="tel"
            dir="ltr"
            maxLength={20}
            value={draft.floating_whatsapp.phone}
            disabled={locked || !draft.floating_whatsapp.enabled}
            onChange={(e) => setWhatsapp({ phone: e.target.value })}
          />
          <TextareaRow
            label={t.whatsappMessage}
            hint={t.whatsappMessageHint}
            rows={2}
            maxLength={300}
            disabled={locked || !draft.floating_whatsapp.enabled}
            value={draft.floating_whatsapp.message}
            onChange={(e) => setWhatsapp({ message: e.target.value })}
          />
        </SettingsGroup>

        <SettingsGroup title={t.identity} description={t.identityDescription}>
          <InputRow
            label={t.favicon}
            hint={t.faviconHint}
            type="url"
            inputMode="url"
            dir="ltr"
            maxLength={1000}
            placeholder="https://"
            value={draft.favicon_url}
            disabled={locked}
            onChange={(e) => setDraft((prev) => ({ ...prev, favicon_url: e.target.value }))}
            after={
              faviconShown ? (
                <img
                  src={draft.favicon_url}
                  alt={t.faviconPreview}
                  className="size-11 shrink-0 rounded-[0.625rem] bg-paper-sunken object-contain p-1.5 ring-1 ring-line"
                />
              ) : undefined
            }
          />
          <SelectRow
            label={t.country}
            value={draft.country}
            disabled={locked}
            onChange={(e) => setDraft((prev) => ({ ...prev, country: e.target.value }))}
          >
            <option value="">{t.countryNone}</option>
            {COUNTRIES.map((code) => (
              <option key={code} value={code}>
                {t[code]}
              </option>
            ))}
          </SelectRow>
        </SettingsGroup>

        {/* Seven links filled in once: folded, with how many are in. Kept mounted, so a fold never drops what was typed. */}
        <AccordionSection
          title={t.social}
          icon={IconShare}
          summary={filledLinks === 0 ? t.socialNone : fmt(t.socialCount, { n: filledLinks, max: SOCIAL_LINK_KEYS.length })}
          persistKey="store-settings:general:social"
          keepMounted
        >
          <p className="mb-3 text-[13px] leading-5 text-ink-soft">{t.socialDescription}</p>
          <div className={`grid gap-4 sm:grid-cols-2 ${TOUCH_FIELDS}`}>
            {SOCIAL_LINK_KEYS.map((key) => (
              <TextField
                key={key}
                label={t[key]}
                type="url"
                inputMode="url"
                dir="ltr"
                maxLength={500}
                placeholder="https://"
                value={draft.social_links[key]}
                disabled={locked}
                onChange={(e) => setLink(key, e.target.value)}
              />
            ))}
          </div>
          <p className="mt-3 text-xs text-ink-soft">{t.linkHint}</p>
        </AccordionSection>

        <SettingsFormFooter
          editable={editable}
          dirty={editor.dirty}
          saving={saving}
          error={editor.error}
          onSave={() => void editor.save()}
          onReset={editor.reset}
        />
      </div>

      <StoreAppSection />
    </DataState>
  );
}
