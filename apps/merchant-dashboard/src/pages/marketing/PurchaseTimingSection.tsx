import { useState } from "react";
import { Timer } from "lucide-react";
import { Alert, Card } from "@store-builder/ui";
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
import { DataState } from "@/components/DataState";
import { useToast } from "@/components/Toast";

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
    title: "متى يُسجَّل الشراء",
    description: "اختر اللحظة التي يُحسب فيها الطلب كـ Purchase عند منصات الإعلانات، لتتعلم من الطلبات الحقيقية.",
    on_order: "عند إنشاء الطلب",
    on_order_hint: "الإعداد المعتاد. يُرسل من المتصفح ومن السيرفر في نفس الوقت.",
    on_confirmed: "عند تأكيد الطلب",
    on_confirmed_hint: "الطلبات المرفوضة والوهمية لا تُرسل أبدًا. يُرسل من السيرفر فقط.",
    on_delivered: "عند تسليم الطلب",
    on_delivered_hint: "يُرسل فقط ما تم تحصيله فعلًا. من السيرفر فقط، وبعد النقرة بأيام.",
    serverOnly:
      "بهذا الاختيار يصل الشراء للمنصة فقط عبر بيكسل مفعّل عليه الـ Conversions API. البيكسلات بدونه لن تُظهر أي مشتريات.",
    saved: "تم حفظ توقيت تسجيل الشراء.",
  },
} satisfies Messages;

/** Marketing → Tracking tools: SPEC §13.3, the moment Purchase is sent. */
export function PurchaseTimingSection() {
  const t = useT(STRINGS);
  const toast = useToast();
  const workspaceId = useWorkspaceId();
  const errorMessage = useErrorMessage();
  const [saving, setSaving] = useState(false);
  const { data, error, loading, refresh, setData } = useAsync(() => trackingPixelsGetSettings(apiClient, workspaceId), [workspaceId]);

  async function choose(timing: TrackingPurchaseEventTiming) {
    if (!data || timing === data.purchaseEventTiming) return;
    const previous = data;
    setData({ ...data, purchaseEventTiming: timing });
    setSaving(true);
    try {
      setData(await trackingPixelsUpdateSettings(apiClient, workspaceId, { purchaseEventTiming: timing }));
      toast.success(t.saved);
    } catch (err) {
      setData(previous);
      toast.error(errorMessage(err));
    } finally {
      setSaving(false);
    }
  }

  return (
    <Card className="mb-6 gap-0 p-4">
      <h2 className="flex items-center gap-2 text-sm font-semibold text-ink">
        <Timer className="size-4 text-primary" aria-hidden />
        {t.title}
      </h2>
      <p className="mt-0.5 text-xs text-ink-soft">{t.description}</p>
      <div className="mt-3">
        <DataState loading={loading} error={error} onRetry={() => void refresh()}>
          {data && (
            <div role="radiogroup" aria-label={t.title} className="space-y-2">
              {data.options.map((option) => {
                const checked = data.purchaseEventTiming === option;
                return (
                  <label
                    key={option}
                    className={`flex cursor-pointer items-start gap-3 rounded-[0.5rem] border p-3 ${
                      checked ? "border-primary bg-primary-soft/40" : "border-line hover:border-line-strong"
                    }`}
                  >
                    <input
                      type="radio"
                      name="purchase-event-timing"
                      className="mt-0.5 size-4 cursor-pointer accent-primary"
                      checked={checked}
                      disabled={saving}
                      onChange={() => void choose(option)}
                    />
                    <span>
                      <span className="block text-sm font-medium text-ink">{t[option]}</span>
                      <span className="block text-xs text-ink-soft">{t[`${option}_hint`]}</span>
                    </span>
                  </label>
                );
              })}
              {data.purchaseEventTiming !== "on_order" && <Alert>{t.serverOnly}</Alert>}
            </div>
          )}
        </DataState>
      </div>
    </Card>
  );
}
