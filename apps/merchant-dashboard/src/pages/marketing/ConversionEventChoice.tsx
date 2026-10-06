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
    title: "سجّل الطلبات كـ",
    purchase: "شراء (Purchase)",
    lead: "عميل محتمل (Lead)",
    hint: "الـ Lead مناسب لمتاجر الدفع عند الاستلام اللي بتحسّن الإعلانات على الطلبات.",
    saved: "الطلبات هتتسجّل كـ {value}.",
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
      <h3 id="conversion-event-title" className="text-sm font-semibold text-ink">
        {t.title}
      </h3>
      <div role="radiogroup" aria-labelledby="conversion-event-title" className="mt-2 flex flex-wrap gap-2">
        {TRACKING_CONVERSION_EVENTS.map((option) => {
          const checked = shown === option;
          return (
            <label
              key={option}
              className={`flex min-h-11 cursor-pointer items-center gap-2 rounded-[0.5rem] border px-3 ${
                checked ? "border-primary bg-primary-soft/40" : "border-line hover:border-line-strong"
              }`}
            >
              <input
                type="radio"
                name="conversion-event"
                className="size-4 cursor-pointer accent-primary"
                checked={checked}
                disabled={disabled || pending !== null}
                onChange={() => void choose(option)}
              />
              <span className="text-sm font-medium text-ink">{t[option]}</span>
            </label>
          );
        })}
      </div>
      <p className="mt-2 text-xs text-ink-soft">{t.hint}</p>
    </div>
  );
}
