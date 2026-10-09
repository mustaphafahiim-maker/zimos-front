import { useEffect, useId, useMemo, useState, type FormEvent } from "react";
import { Alert, Input } from "@store-builder/ui";
import { accountSettingsGet, accountSettingsSave, type AccountSettings } from "@store-builder/api-client";
import { apiClient } from "@/lib/apiClient";
import { useWorkspaceId } from "@/lib/useWorkspaceId";
import { useAsync } from "@/lib/useAsync";
import { useErrorMessage } from "@/lib/errorMessages";
import { useLocale, useT, type Messages } from "@/i18n/LocaleContext";
import { DataState } from "@/components/DataState";
import { Select } from "@/components/Select";
import { SaveBar } from "@/components/SaveBar";
import { SettingsGroup, SettingsRow } from "@/components/settings";
import { useToast } from "@/components/Toast";
import { useReportDirty } from "@/lib/useUnsavedGuard";
import { PaneSkeleton } from "./sections/SettingsCard";

const STRINGS = {
  en: {
    title: "Account settings",
    description: "The store's clock, where contact-form messages go, and the business printed on invoices.",
    timezone: "Time zone",
    timezoneHint: "Reports, exports and daily numbers count days on this clock.",
    contactEmail: "Email for contact-form messages",
    contactEmailHint: "Each message sent through a contact form on your store is emailed here. Leave empty to only see them in Form submissions.",
    legalTitle: "Business details on invoices",
    legalHint: "Printed under the store name on every invoice.",
    legalName: "Name",
    company: "Company",
    phone: "Phone",
    address: "Address",
    country: "Country",
    noCountry: "—",
    save: "Save",
    saving: "Saving…",
    saved: "Account settings saved.",
  },
  ar: {
    title: "إعدادات الحساب",
    description: "توقيت المتجر، والإيميل اللي بتوصله رسايل فورم التواصل، وبيانات نشاطك على الفواتير.",
    timezone: "توقيت المتجر",
    timezoneHint: "التقارير والتصدير وأرقام اليوم بتتحسب على التوقيت ده.",
    contactEmail: "إيميل رسايل «تواصل معانا»",
    contactEmailHint: "كل رسالة من فورم التواصل في متجرك بتتبعت هنا. سيبه فاضي وهتلاقيها في «رسائل النماذج» بس.",
    legalTitle: "بيانات النشاط على الفواتير",
    legalHint: "بتتطبع تحت اسم المتجر في كل فاتورة.",
    legalName: "الاسم",
    company: "الشركة",
    phone: "التليفون",
    address: "العنوان",
    country: "البلد",
    noCountry: "—",
    save: "حفظ",
    saving: "بنحفظ…",
    saved: "الإعدادات اتحفظت.",
  },
} satisfies Messages;

const COUNTRIES = ["EG", "SA", "AE", "KW", "QA", "BH", "OM", "JO", "LB", "IQ", "MA", "DZ", "TN", "LY", "SD", "TR", "GB", "US"];
const FALLBACK_ZONES = ["Africa/Cairo", "Asia/Riyadh", "Asia/Dubai", "Asia/Kuwait", "Asia/Qatar", "Asia/Bahrain", "Asia/Muscat", "Asia/Amman", "Asia/Beirut", "Asia/Baghdad", "Africa/Casablanca", "Africa/Algiers", "Africa/Tunis", "Africa/Tripoli", "Europe/Istanbul", "Europe/London", "UTC"];

function timeZones(current: string): string[] {
  const all = (Intl as unknown as { supportedValuesOf?: (key: string) => string[] }).supportedValuesOf?.("timeZone") ?? FALLBACK_ZONES;
  return all.includes(current) ? all : [current, ...all];
}

/** What the form would save, as one string: the save bar shows while it differs from what is saved. */
function snapshot(settings: AccountSettings): string {
  const { legal } = settings;
  return JSON.stringify([
    settings.timezone,
    settings.contactFormEmail?.trim() || null,
    legal.name ?? "",
    legal.company ?? "",
    legal.phone ?? "",
    legal.address ?? "",
    legal.country ?? "",
  ]);
}

/** SPEC §17.3 account settings that live with the store: time zone, contact-form email, legal details. */
export function AccountSettingsSection() {
  const t = useT(STRINGS);
  const { locale } = useLocale();
  const workspaceId = useWorkspaceId();
  const toast = useToast();
  const errorMessage = useErrorMessage();
  const ids = useId();
  const loaded = useAsync(() => accountSettingsGet(apiClient, workspaceId), [workspaceId]);
  const [form, setForm] = useState<AccountSettings | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (loaded.data) setForm(loaded.data);
  }, [loaded.data]);

  const zones = useMemo(() => timeZones(form?.timezone ?? "Africa/Cairo"), [form?.timezone]);
  const countryName = (code: string) => {
    try {
      return new Intl.DisplayNames([locale], { type: "region" }).of(code) ?? code;
    } catch {
      return code;
    }
  };

  const setLegal = (key: keyof AccountSettings["legal"], value: string) =>
    setForm((f) => (f ? { ...f, legal: { ...f.legal, [key]: value } } : f));

  async function save(e: FormEvent) {
    e.preventDefault();
    if (!form) return;
    setBusy(true);
    setError(null);
    try {
      const saved = await accountSettingsSave(apiClient, workspaceId, {
        timezone: form.timezone,
        contactFormEmail: form.contactFormEmail?.trim() || null,
        legal: form.legal,
      });
      loaded.setData(saved);
      toast.success(t.saved);
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  const dirty = Boolean(form && loaded.data && snapshot(form) !== snapshot(loaded.data));
  useReportDirty(dirty);

  const legalField = (key: "name" | "company" | "phone" | "address", label: string, extra?: { type?: string; dir?: "ltr" }) => (
    <SettingsRow
      label={label}
      htmlFor={`${ids}-${key}`}
      control={
        <Input
          id={`${ids}-${key}`}
          type={extra?.type}
          dir={extra?.dir}
          value={form?.legal[key] ?? ""}
          onChange={(e) => setLegal(key, e.target.value)}
          className="h-11 w-full text-base sm:text-sm"
        />
      }
    />
  );

  return (
    <DataState loading={loaded.loading && !form} error={loaded.error} onRetry={() => void loaded.refresh()} skeleton={<PaneSkeleton rows={5} />}>
      {form && (
        <form onSubmit={save} noValidate className="flex min-w-0 flex-col gap-[var(--bento-gap)]">
          <SettingsGroup>
            <SettingsRow
              label={t.timezone}
              hint={t.timezoneHint}
              htmlFor={`${ids}-zone`}
              control={
                <Select
                  id={`${ids}-zone`}
                  dir="ltr"
                  className="h-11 text-base sm:text-sm"
                  value={form.timezone}
                  onChange={(e) => setForm({ ...form, timezone: e.target.value })}
                >
                  {zones.map((zone) => (
                    <option key={zone} value={zone}>
                      {zone}
                    </option>
                  ))}
                </Select>
              }
            />
            <SettingsRow
              label={t.contactEmail}
              hint={t.contactEmailHint}
              htmlFor={`${ids}-email`}
              control={
                <Input
                  id={`${ids}-email`}
                  type="email"
                  dir="ltr"
                  value={form.contactFormEmail ?? ""}
                  onChange={(e) => setForm({ ...form, contactFormEmail: e.target.value })}
                  className="h-11 w-full text-base sm:text-sm"
                />
              }
            />
          </SettingsGroup>

          <SettingsGroup title={t.legalTitle} description={t.legalHint}>
            {legalField("name", t.legalName)}
            {legalField("company", t.company)}
            {legalField("phone", t.phone, { type: "tel", dir: "ltr" })}
            <SettingsRow
              label={t.country}
              htmlFor={`${ids}-country`}
              control={
                <Select
                  id={`${ids}-country`}
                  className="h-11 text-base sm:text-sm"
                  value={form.legal.country ?? ""}
                  onChange={(e) => setLegal("country", e.target.value)}
                >
                  <option value="">{t.noCountry}</option>
                  {[...new Set([...(form.legal.country ? [form.legal.country] : []), ...COUNTRIES])].map((code) => (
                    <option key={code} value={code}>
                      {countryName(code)}
                    </option>
                  ))}
                </Select>
              }
            />
            {legalField("address", t.address)}
          </SettingsGroup>

          {error && <Alert variant="danger">{error}</Alert>}

          <SaveBar
            dirty={dirty}
            saving={busy}
            saveLabel={t.save}
            savingLabel={t.saving}
            onDiscard={() => {
              if (loaded.data) setForm(loaded.data);
              setError(null);
            }}
          />
        </form>
      )}
    </DataState>
  );
}
