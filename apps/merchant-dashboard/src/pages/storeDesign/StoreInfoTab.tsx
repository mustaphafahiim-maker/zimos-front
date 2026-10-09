import {
  STORE_INFO_CARD_KEYS,
  resolveStoreInfo,
  storeDesignSaveStoreInfo,
  type StoreInfoCard,
  type StoreInfoCardKey,
  type StoreInfoSettings,
} from "@store-builder/api-client";
import { apiClient } from "@/lib/apiClient";
import { useWorkspaceId } from "@/lib/useWorkspaceId";
import { fmt, useT, type Messages } from "@/i18n/LocaleContext";
import { IconCash, IconCourier, IconReturns, type IconComponent } from "@/components/icons";
import { AccordionSection } from "@/components/Accordion";
import { DataState } from "@/components/DataState";
import { Field, TextField } from "@/components/Field";
import { SettingsGroup, SettingsSwitch } from "@/components/settings";
import { Textarea } from "@/components/Textarea";
import { ReadOnlyNotice, SettingsFormFooter, ToggleRow } from "./SettingsFormFooter";
import { useSettingsEditor } from "./useSettingsEditor";
import { InputRow, STACK, SettingsSkeleton, TOUCH_FIELDS } from "./sections/parts";

const CARD_ICON: Record<StoreInfoCardKey, IconComponent> = {
  shipping_policy: IconCourier,
  return_policy: IconReturns,
  cod_policy: IconCash,
};

const STRINGS = {
  en: {
    title: "Contact details on the store",
    description: "Contact details shoppers and ad platforms can see, and short policies shown as trust cards under the buy button.",
    enabled: "Show these details in the store",
    enabledHint: "When off, product pages show the generic trust badges instead.",
    email: "Store email",
    phone: "Store phone",
    address: "Company address",
    shipping_policy: "Shipping policy",
    return_policy: "Return policy",
    cod_policy: "Cash-on-delivery policy",
    cardShown: "Show this card",
    cardTitle: "Title",
    cardPoints: "Points (one per line)",
    cardPointsHint: "Up to eight short lines, for example: Delivery within 2-5 business days.",
    cardsTitle: "Trust cards under the buy button",
    cardOff: "Not shown",
    cardOn: "Shown · {n} points",
    cardOnEmpty: "Shown · no points yet",
    saved: "Contact details saved.",
  },
  ar: {
    title: "بيانات التواصل في المتجر",
    description: "بيانات التواصل اللي العميل ومنصات الإعلانات بيشوفوها، وسياسات قصيرة بتظهر ككروت ثقة تحت زرار الشراء.",
    enabled: "اعرض البيانات دي في المتجر",
    enabledHint: "لو قفلتها، صفحات المنتجات هتعرض علامات الثقة العامة بدالها.",
    email: "إيميل المتجر",
    phone: "تليفون المتجر",
    address: "عنوان الشركة",
    shipping_policy: "سياسة الشحن",
    return_policy: "سياسة الاسترجاع",
    cod_policy: "سياسة الدفع عند الاستلام",
    cardShown: "اعرض الكارت ده",
    cardTitle: "العنوان",
    cardPoints: "النقط (نقطة في كل سطر)",
    cardPointsHint: "لحد ٨ سطور قصيرة، مثلًا: التوصيل خلال ٢-٥ أيام شغل.",
    cardsTitle: "كروت الثقة تحت زرار الشراء",
    cardOff: "مش ظاهر",
    cardOn: "ظاهر · {n} نقط",
    cardOnEmpty: "ظاهر · لسه مفيش نقط",
    saved: "اتحفظت بيانات التواصل.",
  },
} satisfies Messages;

export function StoreInfoTab() {
  const t = useT(STRINGS);
  const workspaceId = useWorkspaceId();
  const editor = useSettingsEditor<StoreInfoSettings>(
    (settings) => resolveStoreInfo(settings.store_info),
    (draft) => storeDesignSaveStoreInfo(apiClient, workspaceId, draft),
    t.saved
  );
  const { draft, setDraft, editable, saving } = editor;
  const locked = !editable || saving;
  const patchCard = (key: StoreInfoCardKey, patch: Partial<StoreInfoCard>) =>
    setDraft((prev) => ({ ...prev, [key]: { ...prev[key], ...patch } }));

  return (
    <DataState loading={!editor.ready} error={null} skeleton={<SettingsSkeleton />}>
      <div className={STACK}>
        <ReadOnlyNotice editable={editable} />

        <SettingsGroup title={t.title} description={t.description}>
          <SettingsSwitch
            label={t.enabled}
            hint={t.enabledHint}
            checked={draft.enabled}
            disabled={locked}
            onChange={(enabled) => setDraft((prev) => ({ ...prev, enabled }))}
          />
          <InputRow
            label={t.phone}
            type="tel"
            inputMode="tel"
            dir="ltr"
            maxLength={32}
            value={draft.phone}
            disabled={locked}
            onChange={(e) => setDraft((prev) => ({ ...prev, phone: e.target.value }))}
          />
          <InputRow
            label={t.email}
            type="email"
            inputMode="email"
            dir="ltr"
            maxLength={200}
            value={draft.email}
            disabled={locked}
            onChange={(e) => setDraft((prev) => ({ ...prev, email: e.target.value }))}
          />
          <InputRow
            label={t.address}
            stacked
            maxLength={300}
            value={draft.address}
            disabled={locked}
            onChange={(e) => setDraft((prev) => ({ ...prev, address: e.target.value }))}
          />
        </SettingsGroup>

        {/* The three promises: each folds to one row saying whether it shows and how much it says. */}
        <div className={STACK}>
          <h3 className="px-4 pt-2 text-[13px] leading-5 font-semibold text-ink-soft">{t.cardsTitle}</h3>
          {STORE_INFO_CARD_KEYS.map((key) => {
            const card = draft[key];
            const points = card.points.filter((line) => line.trim() !== "").length;
            return (
              <AccordionSection
                key={key}
                title={t[key]}
                icon={CARD_ICON[key]}
                summary={!card.enabled ? t.cardOff : points === 0 ? t.cardOnEmpty : fmt(t.cardOn, { n: points })}
                persistKey={`store-settings:store-info:${key}`}
                keepMounted
              >
                <div className={`space-y-4 ${TOUCH_FIELDS}`}>
                  <ToggleRow
                    label={t.cardShown}
                    checked={card.enabled}
                    disabled={locked}
                    onChange={(enabled) => patchCard(key, { enabled })}
                  />
                  <TextField
                    label={t.cardTitle}
                    maxLength={120}
                    value={card.title}
                    disabled={locked || !card.enabled}
                    onChange={(e) => patchCard(key, { title: e.target.value })}
                  />
                  <Field label={t.cardPoints} hint={t.cardPointsHint}>
                    {({ id }) => (
                      <Textarea
                        id={id}
                        rows={4}
                        disabled={locked || !card.enabled}
                        value={card.points.join("\n")}
                        onChange={(e) => patchCard(key, { points: e.target.value.split("\n").slice(0, 8) })}
                      />
                    )}
                  </Field>
                </div>
              </AccordionSection>
            );
          })}
        </div>

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
