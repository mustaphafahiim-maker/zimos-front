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
import { DataState, SkeletonBar } from "@/components/DataState";
import { Segmented } from "@/components/Segmented";
import { useToast } from "@/components/Toast";

const STRINGS = {
  en: {
    tracking: "Report orders as",
    label: "Report this funnel's orders to the ad platforms as",
    storeDefault: "Like the store",
    purchase: "Purchase",
    lead: "Lead",
    short_purchase: "Purchase",
    short_lead: "Lead",
    storeIs: "The store reports them as: {value}.",
    hint: "Lead suits cash-on-delivery stores that optimise ads on orders placed.",
    savesNow: "Saved as soon as you pick.",
    saved: "Saved. This funnel's orders follow it from now on.",
  },
  ar: {
    tracking: "سجّل الأوردرات كـ",
    label: "أوردرات الفانل ده توصل لمنصات الإعلانات كـ",
    storeDefault: "زي المتجر",
    purchase: "Purchase",
    lead: "Lead",
    short_purchase: "شراء (Purchase)",
    short_lead: "عميل محتمل (Lead)",
    storeIs: "المتجر بيسجّلها: {value}.",
    hint: "الـ Lead مناسب لمتاجر الدفع عند الاستلام اللي بتظبط إعلاناتها على الأوردرات.",
    savesNow: "بيتحفظ أول ما تختار.",
    saved: "اتحفظ. أوردرات الفانل ده هتمشي عليه من دلوقتي.",
  },
} satisfies Messages;

type Choice = "" | TrackingConversionEvent;

/**
 * Funnel settings → Tracking: whether this funnel's orders reach the ad
 * platforms as a Purchase or a Lead, or as the store says (Marketing →
 * Tracking tools). Saved as soon as it is picked (handoff 167) — three
 * choices, so a segmented control instead of a menu.
 */
export function FunnelConversionEventSetting({ funnelId }: { funnelId: string }) {
  const t = useT(STRINGS);
  const workspaceId = useWorkspaceId();
  const toast = useToast();
  const errorMessage = useErrorMessage();
  const loaded = useAsync(() => funnelConversionSettingsGet(apiClient, workspaceId, funnelId), [workspaceId, funnelId]);
  // The store's own choice needs workspace.manage; without it the hint just leaves it out.
  const store = useAsync(() => trackingPixelsGetConversionSettings(apiClient, workspaceId).catch(() => null), [workspaceId]);
  const [busy, setBusy] = useState(false);

  const current = conversionEventOf(loaded.data?.conversionEvent);
  const storeValue = conversionEventOf(store.data?.conversionEvent);

  async function choose(raw: string) {
    if (busy) return;
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

  const value: Choice = current ?? "";

  return (
    <section aria-labelledby="fs-tracking-title" className="space-y-2">
      <h3 id="fs-tracking-title" className="text-sm font-medium text-ink">
        {t.tracking}
      </h3>
      <DataState
        loading={loaded.loading}
        error={loaded.error}
        onRetry={() => void loaded.refresh()}
        skeleton={<SkeletonBar className="h-11 w-full" />}
      >
        <Segmented<Choice>
          label={t.label}
          value={value}
          onChange={(next) => void choose(next)}
          className={busy ? "w-full opacity-70" : "w-full"}
          options={[
            { value: "", label: t.storeDefault },
            { value: "purchase", label: t.purchase },
            { value: "lead", label: t.lead },
          ]}
        />
        <p className="text-xs leading-5 text-ink-soft">
          {storeValue ? `${fmt(t.storeIs, { value: t[`short_${storeValue}`] })} ` : ""}
          {t.hint} {t.savesNow}
        </p>
      </DataState>
    </section>
  );
}
