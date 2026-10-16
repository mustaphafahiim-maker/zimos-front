import { useEffect, useState } from "react";
import { Alert, Button } from "@store-builder/ui";
import { storeAppGet, storeAppSave, type StoreAppSettings } from "@store-builder/api-client";
import { apiClient } from "@/lib/apiClient";
import { useWorkspaceId } from "@/lib/useWorkspaceId";
import { useAsync } from "@/lib/useAsync";
import { useErrorMessage } from "@/lib/errorMessages";
import { useT, type Messages } from "@/i18n/LocaleContext";
import { ColorField } from "@/components/ColorField";
import { DataState } from "@/components/DataState";
import { TextField } from "@/components/Field";
import { Section } from "@/components/Section";
import { useToast } from "@/components/Toast";

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
    save: "Save",
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
    save: "حفظ",
    saving: "جارٍ الحفظ…",
    saved: "تم حفظ إعدادات تطبيق المتجر.",
  },
} satisfies Messages;

const EMPTY: StoreAppSettings = { enabled: false, name: null, shortName: null, iconUrl: null, themeColor: null };

/** Settings → Store design → General: the store as an app for shoppers (SPEC §20.2). */
export function StoreAppSection() {
  const t = useT(STRINGS);
  const workspaceId = useWorkspaceId();
  const toast = useToast();
  const errorMessage = useErrorMessage();
  // A 403 (no website.publish) is the no-permission state DataState draws.
  const loaded = useAsync(() => storeAppGet(apiClient, workspaceId), [workspaceId]);
  const [draft, setDraft] = useState<StoreAppSettings>(EMPTY);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (loaded.data) setDraft(loaded.data);
  }, [loaded.data]);

  const set = (patch: Partial<StoreAppSettings>) => setDraft((prev) => ({ ...prev, ...patch }));

  async function save() {
    setBusy(true);
    setError(null);
    try {
      const saved = await storeAppSave(apiClient, workspaceId, {
        ...draft,
        name: draft.name?.trim() || null,
        shortName: draft.shortName?.trim() || null,
        iconUrl: draft.iconUrl?.trim() || null,
        themeColor: draft.themeColor?.trim() || null,
      });
      loaded.setData(saved);
      toast.success(t.saved);
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <Section title={t.title} description={t.description}>
      <DataState loading={loaded.loading && !loaded.data} error={loaded.error} onRetry={() => void loaded.refresh()}>
        <div className="space-y-4">
          <label className="flex min-h-11 items-center gap-2 text-sm font-medium text-ink">
            <input type="checkbox" checked={draft.enabled} onChange={(e) => set({ enabled: e.target.checked })} />
            {t.enabled}
          </label>
          {draft.enabled && (
            <div className="grid gap-4 sm:grid-cols-2">
              <TextField label={t.name} placeholder={t.namePlaceholder} maxLength={60} value={draft.name ?? ""} onChange={(e) => set({ name: e.target.value })} />
              <TextField label={t.shortName} hint={t.shortNameHint} maxLength={12} value={draft.shortName ?? ""} onChange={(e) => set({ shortName: e.target.value })} />
              <TextField label={t.icon} hint={t.iconHint} dir="ltr" type="url" value={draft.iconUrl ?? ""} onChange={(e) => set({ iconUrl: e.target.value })} />
              <ColorField label={t.color} hint={t.colorHint} value={draft.themeColor ?? ""} onChange={(hex) => set({ themeColor: hex })} />
            </div>
          )}
          {error && <Alert variant="danger">{error}</Alert>}
          <div className="text-end">
            <Button type="button" className="min-h-11" disabled={busy} onClick={() => void save()}>
              {busy ? t.saving : t.save}
            </Button>
          </div>
        </div>
      </DataState>
    </Section>
  );
}
