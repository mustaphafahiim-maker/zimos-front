import { useState } from "react";
import { IconTimer } from "@/components/icons";
import { Alert, cn } from "@store-builder/ui";
import {
  trackingPixelsGetSettings,
  trackingPixelsUpdateSettings,
  type TrackingPurchaseEventTiming,
} from "@store-builder/api-client";
import { apiClient } from "@/lib/apiClient";
import { useWorkspaceId } from "@/lib/useWorkspaceId";
import { useAsync } from "@/lib/useAsync";
import { useErrorMessage } from "@/lib/errorMessages";
import { useT, type Messages } from "@/i18n/LocaleContext";
import { AccordionSection } from "@/components/Accordion";
import { DataState } from "@/components/DataState";
import { useToast } from "@/components/Toast";
import { ConversionEventChoice } from "./ConversionEventChoice";

const STRINGS = {
  en: {
    title: "When to report a purchase",
    description: "Choose the moment an order counts as a Purchase for your ad platforms, so they learn from real orders.",
    on_order: "When the order is placed",
    on_order_hint: "The usual setting. Sent from the browser and the server at the same time.",
    on_confirmed: "When the order is confirmed",
    on_confirmed_hint: "Rejected and fake orders are never reported. Sent from the server only.",
    on_delivered: "When the order is delivered",
    on_delivered_hint: "Only money that actually arrived is reported. Sent from the server only, days after the click.",
    serverOnly:
      "With this choice the purchase reaches a platform only through a pixel that has the Conversions API turned on. Pixels without it will show no purchases.",
    saved: "Purchase timing saved.",
  },
  ar: {
    title: "إمتى الشرا يتسجّل",
    description: "اختار اللحظة اللي الأوردر يتحسب فيها Purchase عند منصات الإعلانات، عشان تتعلم من الأوردرات الحقيقية.",
    on_order: "أول ما الأوردر يتعمل",
    on_order_hint: "الإعداد المعتاد. بيتبعت من المتصفح ومن السيرفر في نفس الوقت.",
    on_confirmed: "لما الأوردر يتأكد",
    on_confirmed_hint: "الأوردرات المرفوضة والوهمية مش بتتبعت خالص. من السيرفر بس.",
    on_delivered: "لما الأوردر يتسلّم",
    on_delivered_hint: "بيتبعت بس اللي اتحصّل فعلاً. من السيرفر بس، وبعد الضغطة بأيام.",
    serverOnly:
      "بالاختيار ده الشرا بيوصل للمنصة بس عن طريق بيكسل مشغّل عليه الـ Conversions API. البيكسلات اللي من غيره مش هتظهر فيها مشتريات.",
    saved: "توقيت تسجيل الشرا اتحفظ.",
  },
} satisfies Messages;

/**
 * Marketing → Tracking tools: SPEC §13.3, the moment Purchase is sent. A
 * folded section whose closed row says the current choice; a choice saves at
 * once and the toast can take it back.
 */
export function PurchaseTimingSection() {
  const t = useT(STRINGS);
  const toast = useToast();
  const workspaceId = useWorkspaceId();
  const errorMessage = useErrorMessage();
  const [saving, setSaving] = useState(false);
  const { data, error, loading, refresh, setData } = useAsync(() => trackingPixelsGetSettings(apiClient, workspaceId), [workspaceId]);

  async function choose(timing: TrackingPurchaseEventTiming, undoable = true): Promise<void> {
    if (!data || timing === data.purchaseEventTiming) return;
    const previous = data;
    setData({ ...data, purchaseEventTiming: timing });
    setSaving(true);
    try {
      const saved = await trackingPixelsUpdateSettings(apiClient, workspaceId, { purchaseEventTiming: timing });
      setData(saved);
      if (undoable) toast.undo(t.saved, () => restore(previous.purchaseEventTiming));
      else toast.success(t.saved);
    } catch (err) {
      setData(previous);
      toast.error(errorMessage(err));
    } finally {
      setSaving(false);
    }
  }

  /** Undo: the same request with the choice it had before. */
  async function restore(timing: TrackingPurchaseEventTiming): Promise<void> {
    try {
      setData(await trackingPixelsUpdateSettings(apiClient, workspaceId, { purchaseEventTiming: timing }));
    } catch (err) {
      toast.error(errorMessage(err));
    }
  }

  return (
    <AccordionSection
      title={t.title}
      summary={data ? t[data.purchaseEventTiming] : t.description}
      icon={IconTimer}
      persistKey="marketing:timing"
    >
      <p className="text-[13px] leading-5 text-ink-soft">{t.description}</p>
      <div className="mt-3">
        <DataState loading={loading} error={error} onRetry={() => void refresh()}>
          {data && (
            <div role="radiogroup" aria-label={t.title} className="space-y-2">
              {data.options.map((option) => {
                const checked = data.purchaseEventTiming === option;
                return (
                  <label
                    key={option}
                    className={cn(
                      "zimos-pick-tile flex min-h-14 cursor-pointer items-start gap-3 rounded-[0.875rem] px-3.5 py-3 transition-[background-color,box-shadow] duration-[var(--dur-fade)] ease-[var(--ease-out)] has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-primary motion-reduce:transition-none",
                      checked ? "bg-primary-soft ring-2 ring-primary" : "bg-paper-raised ring-1 ring-line hover:bg-paper-sunken"
                    )}
                  >
                    <input
                      type="radio"
                      name="purchase-event-timing"
                      className="mt-0.5 size-[18px] shrink-0 cursor-pointer accent-primary"
                      checked={checked}
                      disabled={saving}
                      onChange={() => void choose(option)}
                    />
                    <span className="min-w-0">
                      <span className="block text-sm leading-5 font-medium text-ink">{t[option]}</span>
                      <span className="mt-0.5 block text-[13px] leading-5 text-ink-soft">{t[`${option}_hint`]}</span>
                    </span>
                  </label>
                );
              })}
              {data.purchaseEventTiming !== "on_order" && <Alert>{t.serverOnly}</Alert>}
            </div>
          )}
        </DataState>
        {data && <ConversionEventChoice settings={data} disabled={saving} onSaved={setData} />}
      </div>
    </AccordionSection>
  );
}
