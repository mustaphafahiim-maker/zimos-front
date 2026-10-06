import { useState } from "react";
import {
  conversionEventOf,
  funnelConversionEventSave,
  funnelConversionSettingsGet,
  trackingPixelsGetConversionSettings,
  type TrackingConversionEvent,
} from "@store-builder/api-client";
import { apiClient } from "@/lib/apiClient";
import { useWorkspaceId } from "@/lib/useWorkspaceId";
import { useAsync } from "@/lib/useAsync";
import { useErrorMessage } from "@/lib/errorMessages";
import { fmt, useT, type Messages } from "@/i18n/LocaleContext";
import { DataState } from "@/components/DataState";
import { Field } from "@/components/Field";
import { Select } from "@/components/Select";
import { useToast } from "@/components/Toast";

const STRINGS = {
  en: {
    tracking: "Tracking",
    label: "Report orders as",
    storeDefault: "Store default ({value})",
    storeDefaultPlain: "Store default",
    purchase: "Purchase",
    lead: "Lead",
    short_purchase: "Purchase",
    short_lead: "Lead",
    hint: "Lead suits cash-on-delivery stores that optimise ads on orders placed.",
    saved: "Saved. This funnel's orders follow it from now on.",
  },
  ar: {
    tracking: "التتبع",
    label: "سجّل الطلبات كـ",
    storeDefault: "زي المتجر ({value})",
    storeDefaultPlain: "زي المتجر",
    purchase: "شراء (Purchase)",
    lead: "عميل محتمل (Lead)",
    short_purchase: "شراء",
    short_lead: "عميل محتمل",
    hint: "الـ Lead مناسب لمتاجر الدفع عند الاستلام اللي بتحسّن الإعلانات على الطلبات.",
    saved: "اتحفظ. أوردرات الفانل ده هتمشي عليه من دلوقتي.",
  },
} satisfies Messages;

/**
 * Funnel settings → Tracking: whether this funnel's orders reach the ad
 * platforms as a Purchase or a Lead, or as the store says (Marketing →
 * Tracking tools). Saved as soon as it is picked (handoff 167).
 */
export function FunnelConversionEventSetting({ funnelId }: { funnelId: string }) {
  const t = useT(STRINGS);
  const workspaceId = useWorkspaceId();
  const toast = useToast();
  const errorMessage = useErrorMessage();
  const loaded = useAsync(() => funnelConversionSettingsGet(apiClient, workspaceId, funnelId), [workspaceId, funnelId]);
  // The store's own choice needs workspace.manage; without it the option just says "Store default".
  const store = useAsync(() => trackingPixelsGetConversionSettings(apiClient, workspaceId).catch(() => null), [workspaceId]);
  const [busy, setBusy] = useState(false);

  const current = conversionEventOf(loaded.data?.conversionEvent);
  const storeValue = conversionEventOf(store.data?.conversionEvent);

  async function choose(raw: string) {
    const next: TrackingConversionEvent | null = conversionEventOf(raw);
    if (next === current) return;
    setBusy(true);
    try {
      loaded.setData(await funnelConversionEventSave(apiClient, workspaceId, funnelId, next));
      toast.success(t.saved);
    } catch (err) {
      toast.error(errorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <section aria-labelledby="fs-tracking-title" className="space-y-2">
      <h3 id="fs-tracking-title" className="text-sm font-semibold text-ink">
        {t.tracking}
      </h3>
      <DataState loading={loaded.loading} error={loaded.error} onRetry={() => void loaded.refresh()}>
        <Field label={t.label} hint={t.hint}>
          {({ id }) => (
            <Select id={id} value={current ?? ""} disabled={busy} onChange={(e) => void choose(e.target.value)}>
              <option value="">{storeValue ? fmt(t.storeDefault, { value: t[`short_${storeValue}`] }) : t.storeDefaultPlain}</option>
              <option value="purchase">{t.purchase}</option>
              <option value="lead">{t.lead}</option>
            </Select>
          )}
        </Field>
      </DataState>
    </section>
  );
}
