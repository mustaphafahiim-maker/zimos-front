import { useEffect, useState } from "react";
import { useReportDirty } from "@/lib/useUnsavedGuard";
import { storeAppGet, storeAppSave, type StoreAppSettings } from "@store-builder/api-client";
import { apiClient } from "@/lib/apiClient";
import { useWorkspaceId } from "@/lib/useWorkspaceId";
import { useAsync } from "@/lib/useAsync";
import { useErrorMessage } from "@/lib/errorMessages";
import { useT, type Messages } from "@/i18n/LocaleContext";
import { ColorField } from "@/components/ColorField";
import { SaveBar } from "@/components/SaveBar";
import { SettingsGroup, SettingsSwitch } from "@/components/settings";
import { useToast } from "@/components/Toast";
import { GroupBlock, GroupState, InputRow, STACK } from "./sections/parts";

const STRINGS = {
  en: {
    title: "Store app",
    description:
      "Let shoppers add your store to their phone's home screen and open it like an app. Your store shows an “Install the app” button where the phone allows it.",
    enabled: "Offer the store as an app",
    name: "App name",
    namePlaceholder: "Your store's name",
    shortName: "Name under the icon",
    shortNameHint: "At most 12 characters.",
    icon: "Icon (image link)",
    iconHint: "A square image, 512×512 or larger. Empty: your logo.",
    color: "Bar colour",
    colorHint: "Empty: your store's main colour.",
    enabledHint: "Shoppers see “Install the app” where their phone allows it.",
    save: "Save store app",
    saving: "Saving…",
    saved: "Store app settings saved.",
  },
  ar: {
    title: "تطبيق المتجر",
    description: "خلّي عملاءك يضيفوا متجرك للشاشة الرئيسية في موبايلهم ويفتحوه زي التطبيق. متجرك يعرض زر «ثبّت التطبيق» لما الموبايل يسمح.",
    enabled: "اعرض المتجر كتطبيق",
    name: "اسم التطبيق",
    namePlaceholder: "اسم متجرك",
    shortName: "الاسم تحت الأيقونة",
    shortNameHint: "12 حرفًا بحد أقصى.",
    icon: "الأيقونة (رابط صورة)",
    iconHint: "صورة مربعة 512×512 أو أكبر. فارغ: شعارك.",
    color: "لون الشريط",
    colorHint: "فارغ: اللون الأساسي لمتجرك.",
    enabledHint: "العميل هيشوف «ثبّت التطبيق» لما موبايله يسمح.",
    save: "احفظ تطبيق المتجر",
    saving: "بنحفظ…",
    saved: "تم حفظ إعدادات تطبيق المتجر.",
  },
} satisfies Messages;

const EMPTY: StoreAppSettings = { enabled: false, name: null, shortName: null, iconUrl: null, themeColor: null };

/** What a draft saves as: a text field left blank goes up as null. */
function cleaned(draft: StoreAppSettings): StoreAppSettings {
  return {
    ...draft,
    name: draft.name?.trim() || null,
    shortName: draft.shortName?.trim() || null,
    iconUrl: draft.iconUrl?.trim() || null,
    themeColor: draft.themeColor?.trim() || null,
  };
}

/** Store settings → General: the store as an app for shoppers (SPEC §20.2). Its own data, its own save. */
export function StoreAppSection() {
  const t = useT(STRINGS);
  const workspaceId = useWorkspaceId();
  const toast = useToast();
  const errorMessage = useErrorMessage();
  // A 403 (no website.publish) is the no-permission state GroupState draws, under this part's name.
  const loaded = useAsync(() => storeAppGet(apiClient, workspaceId), [workspaceId]);
  const [draft, setDraft] = useState<StoreAppSettings>(EMPTY);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (loaded.data) setDraft(loaded.data);
  }, [loaded.data]);

  const set = (patch: Partial<StoreAppSettings>) => setDraft((prev) => ({ ...prev, ...patch }));
  // This part saves by itself, apart from the section's own save: its bar shows only for its own changes.
  const dirty = JSON.stringify(cleaned(draft)) !== JSON.stringify(cleaned(loaded.data ?? EMPTY));
  useReportDirty(dirty);

  async function save() {
    setBusy(true);
    setError(null);
    try {
      const saved = await storeAppSave(apiClient, workspaceId, cleaned(draft));
      loaded.setData(saved);
      toast.success(t.saved);
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <GroupState title={t.title} loading={loaded.loading && !loaded.data} error={loaded.error} onRetry={() => void loaded.refresh()}>
      <div className={STACK}>
        <SettingsGroup title={t.title} description={t.description}>
          <SettingsSwitch label={t.enabled} hint={t.enabledHint} checked={draft.enabled} disabled={busy} onChange={(enabled) => set({ enabled })} />
          {draft.enabled && (
            <>
              <InputRow label={t.name} placeholder={t.namePlaceholder} maxLength={60} value={draft.name ?? ""} disabled={busy} onChange={(e) => set({ name: e.target.value })} />
              <InputRow label={t.shortName} hint={t.shortNameHint} maxLength={12} value={draft.shortName ?? ""} disabled={busy} onChange={(e) => set({ shortName: e.target.value })} />
              <InputRow label={t.icon} hint={t.iconHint} dir="ltr" type="url" inputMode="url" value={draft.iconUrl ?? ""} disabled={busy} onChange={(e) => set({ iconUrl: e.target.value })} />
              <GroupBlock>
                <ColorField label={t.color} hint={t.colorHint} value={draft.themeColor ?? ""} onChange={(hex) => set({ themeColor: hex })} />
              </GroupBlock>
            </>
          )}
        </SettingsGroup>
        <SaveBar
          dirty={dirty}
          saving={busy}
          onSave={() => void save()}
          onDiscard={() => {
            setDraft(loaded.data ?? EMPTY);
            setError(null);
          }}
          saveLabel={t.save}
          savingLabel={t.saving}
          message={
            error ? (
              <span role="alert" className="text-danger">
                {error}
              </span>
            ) : undefined
          }
        />
      </div>
    </GroupState>
  );
}
