import { useId, useState } from "react";
import { Alert } from "@store-builder/ui";
import {
  ApiError,
  apiFieldProblems,
  trackingProviderGet,
  trackingProviderSave,
  type TrackingProviderOption,
  type TrackingProviderSettings,
} from "@store-builder/api-client";
import { apiClient } from "@/lib/apiClient";
import { useWorkspaceId } from "@/lib/useWorkspaceId";
import { useAsync } from "@/lib/useAsync";
import { useErrorMessage } from "@/lib/errorMessages";
import { fmt, useT, type Messages } from "@/i18n/LocaleContext";
import { Select } from "@/components/Select";
import { SettingsGroup, SettingsRow, SettingsSwitch } from "@/components/settings";
import { useToast } from "@/components/Toast";
import { forgetTrackingProvider } from "@/pages/orders/components/ManualShipmentTracking";

const STRINGS = {
  en: {
    title: "Tracking for manual shipments",
    toggle: "Update manual shipments automatically",
    provider: "Tracking provider",
    choose: "Choose a provider",
    notAvailable: "Not available on this server",
    test: "Test",
    help: "We read each waybill from the provider every {intervalMinutes} minutes until it is delivered or returned, for up to {maxAgeDays} days. Shipments booked with a connected courier update on their own",
    saved: "Saved",
    needProvider: "Choose a tracking provider first.",
    viewOnly: "Your role can't change shipment tracking.",
  },
  ar: {
    title: "تتبع الشحنات اليدوية",
    toggle: "تحديث حالة الشحنات اليدوية تلقائيًا",
    provider: "مزوّد التتبع",
    choose: "اختر مزوّدًا",
    notAvailable: "غير متاح على هذا الخادم",
    test: "تجريبي",
    help: "نقرأ رقم البوليصة من المزوّد كل {intervalMinutes} دقيقة حتى تُسلَّم الشحنة أو تُرجَع، ولمدة {maxAgeDays} يومًا بحد أقصى. شحنات شركات الشحن المربوطة تتحدّث تلقائيًا",
    saved: "تم الحفظ",
    needProvider: "اختر مزوّد التتبع أولًا.",
    viewOnly: "دورك لا يسمح بتغيير تتبع الشحنات.",
  },
} satisfies Messages;

/**
 * Settings → Shipping, under the default courier: switch on a
 * tracking provider and the shipments made by hand (or by the tracking sheet
 * import) move by themselves — in transit, out for delivery, delivered,
 * returned. Each change saves at once; the card is not part of the form
 * around it.
 */
export function ManualTrackingCard() {
  const t = useT(STRINGS);
  const workspaceId = useWorkspaceId();
  const toast = useToast();
  const errorMessage = useErrorMessage();
  const selectId = useId();
  const loaded = useAsync<TrackingProviderSettings>(() => trackingProviderGet(apiClient, workspaceId), [workspaceId]);
  const [saving, setSaving] = useState(false);
  const [providerError, setProviderError] = useState<string | null>(null);
  // Chosen before the switch is on: sent with the switch.
  const [picked, setPicked] = useState<string | null>(null);

  // A role without shipping.manage (or an older server) has no card at all.
  if (loaded.error instanceof ApiError && [403, 404].includes(loaded.error.status)) return null;
  if (loaded.error) return <Alert variant="danger">{errorMessage(loaded.error)}</Alert>;
  const data = loaded.data;
  if (!data) return null;

  const enabled = data.trackingProvider.enabled;
  const provider = picked ?? data.trackingProvider.provider ?? "";

  const optionLabel = (option: TrackingProviderOption) => {
    const name = option.sandbox ? `${option.name.replace(/\s*\(test\)\s*$/i, "")} (${t.test})` : option.name;
    return option.available ? name : `${name} — ${t.notAvailable}`;
  };

  async function save(next: { enabled: boolean; provider?: string }) {
    setSaving(true);
    setProviderError(null);
    try {
      const answer = await trackingProviderSave(apiClient, workspaceId, next);
      loaded.setData(answer);
      setPicked(null);
      forgetTrackingProvider(workspaceId);
      toast.success(t.saved);
    } catch (err) {
      const problem = apiFieldProblems(err).find((p) => p.field === "provider");
      if (problem) setProviderError(provider ? problem.message : t.needProvider);
      else toast.error(errorMessage(err));
    } finally {
      setSaving(false);
    }
  }

  function toggle(next: boolean) {
    if (next && !provider) {
      setProviderError(t.needProvider);
      return;
    }
    void save({ enabled: next, ...(provider ? { provider } : {}) });
  }

  function choose(code: string) {
    setProviderError(null);
    setPicked(code);
    // While tracking is on, the provider is a live setting: save it. Off, it waits for the switch.
    if (enabled && code) void save({ enabled: true, provider: code });
  }

  return (
    <SettingsGroup title={t.title} footer={fmt(t.help, { intervalMinutes: data.polling.intervalMinutes, maxAgeDays: data.polling.maxAgeDays })}>
      <SettingsSwitch checked={enabled} onChange={toggle} label={t.toggle} busy={saving} />
      <SettingsRow
        label={t.provider}
        htmlFor={selectId}
        error={providerError ?? undefined}
        control={
          <Select id={selectId} value={provider} disabled={saving} onChange={(e) => choose(e.target.value)} className="h-11 w-auto max-w-full">
            <option value="" disabled>
              {t.choose}
            </option>
            {data.providers.map((option) => (
              <option key={option.code} value={option.code} disabled={!option.available}>
                {optionLabel(option)}
              </option>
            ))}
          </Select>
        }
      />
    </SettingsGroup>
  );
}
