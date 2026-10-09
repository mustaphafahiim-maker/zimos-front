import { useState } from "react";
import {
  TRACKING_CONVERSION_EVENTS,
  trackingConversionEventOf,
  trackingPixelsUpdateConversionEvent,
  type TrackingConversionEvent,
  type TrackingSettings,
} from "@store-builder/api-client";
import { apiClient } from "@/lib/apiClient";
import { useWorkspaceId } from "@/lib/useWorkspaceId";
import { useErrorMessage } from "@/lib/errorMessages";
import { fmt, useT, type Messages } from "@/i18n/LocaleContext";
import { Segmented } from "@/components/Segmented";
import { useToast } from "@/components/Toast";

const STRINGS = {
  en: {
    title: "Report orders as",
    purchase: "Purchase",
    lead: "Lead",
    hint: "Lead suits cash-on-delivery stores that optimise ads on orders placed.",
    saved: "Orders will be reported as {value}.",
  },
  ar: {
    title: "سجّل الأوردرات كـ",
    purchase: "شرا (Purchase)",
    lead: "عميل محتمل (Lead)",
    hint: "الـ Lead مناسب لمتاجر الدفع عند الاستلام اللي بتحسّن الإعلانات على الأوردرات.",
    saved: "الأوردرات هتتسجّل كـ {value}.",
  },
} satisfies Messages;

/**
 * Marketing → Tracking tools, under "When to report a purchase": whether an
 * order reaches the ad platforms as a Purchase or as a Lead (handoff 167).
 * Same moment, value and event id either way; a funnel can override it
 * (funnel settings).
 */
export function ConversionEventChoice({
  settings,
  disabled,
  onSaved,
}: {
  settings: TrackingSettings;
  disabled?: boolean;
  onSaved: (next: TrackingSettings) => void;
}) {
  const t = useT(STRINGS);
  const toast = useToast();
  const workspaceId = useWorkspaceId();
  const errorMessage = useErrorMessage();
  const current = trackingConversionEventOf(settings);
  const [pending, setPending] = useState<TrackingConversionEvent | null>(null);
  const shown = pending ?? current;

  async function choose(next: TrackingConversionEvent) {
    if (next === current || pending) return;
    setPending(next);
    try {
      const saved = await trackingPixelsUpdateConversionEvent(apiClient, workspaceId, next);
      onSaved(saved);
      toast.success(fmt(t.saved, { value: t[next] }));
    } catch (err) {
      toast.error(errorMessage(err));
    } finally {
      setPending(null);
    }
  }

  return (
    <div className="mt-4 border-t border-line pt-4">
      <h3 className="text-sm font-semibold text-ink">{t.title}</h3>
      {/* Two choices: the segmented control. A press saves at once; the thumb waits where it was pressed. */}
      <div className={disabled || pending !== null ? "pointer-events-none mt-2 opacity-60" : "mt-2"} aria-busy={pending !== null || undefined}>
        <Segmented
          label={t.title}
          value={shown}
          onChange={(next) => void choose(next)}
          options={TRACKING_CONVERSION_EVENTS.map((option) => ({ value: option, label: t[option] }))}
        />
      </div>
      <p className="mt-2 text-[13px] leading-5 text-ink-soft">{t.hint}</p>
    </div>
  );
}
