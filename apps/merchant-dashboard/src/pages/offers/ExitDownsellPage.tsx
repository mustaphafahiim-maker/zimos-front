import { useState } from "react";
import { Alert, Button, Card, Label } from "@store-builder/ui";
import { offersGetExitDownsell, offersSaveExitDownsell, type ExitDownsellSettings } from "@store-builder/api-client";
import { apiClient } from "@/lib/apiClient";
import { useWorkspaceId } from "@/lib/useWorkspaceId";
import { useAsync } from "@/lib/useAsync";
import { useErrorMessage } from "@/lib/errorMessages";
import { useT, type Messages } from "@/i18n/LocaleContext";
import { PageHeader } from "@/components/PageHeader";
import { DataState } from "@/components/DataState";
import { Select } from "@/components/Select";
import { TextField } from "@/components/Field";
import { useToast } from "@/components/Toast";
import { OfferNumbers, useOfferStats } from "./OfferNumbers";

/**
 * The exit popup (SPEC §10.4): a message and a real coupon shown once to a
 * visitor who is about to leave, or after a delay. No countdown, no "only
 * today": the coupon is one of the store's own discounts and works as long as
 * that discount does.
 */

const STRINGS = {
  en: {
    back: "Offers",
    title: "Exit popup",
    description: "One last offer to a visitor who is leaving without ordering. Each visitor sees it once.",
    enabled: "Show the exit popup",
    trigger: "When",
    trigger_exit_intent: "The visitor is about to leave",
    trigger_delay: "After a delay",
    triggerHint: "“About to leave”: the mouse leaves the page on a computer, or the back button on a phone.",
    delay: "Delay in seconds",
    pages: "On",
    pages_all: "Every page",
    pages_product: "Product pages",
    pages_cart: "The cart",
    popupTitle: "Title",
    popupTitlePlaceholder: "Before you go…",
    message: "Message",
    messagePlaceholder: "Take 10% off your first order.",
    coupon: "Coupon",
    couponNone: "No coupon — message only",
    couponHint: "One of your discount codes. If it expires or is switched off, the popup stops showing until you choose another.",
    save: "Save",
    saving: "Saving…",
    saved: "Exit popup saved.",
  },
  ar: {
    back: "العروض",
    title: "نافذة الخروج",
    description: "عرض أخير لزائر يغادر بدون أن يطلب. كل زائر يراها مرة واحدة.",
    enabled: "إظهار نافذة الخروج",
    trigger: "متى",
    trigger_exit_intent: "عندما يهمّ الزائر بالمغادرة",
    trigger_delay: "بعد مدة",
    triggerHint: "«يهمّ بالمغادرة»: خروج الماوس من الصفحة على الكمبيوتر، أو زر الرجوع على الموبايل.",
    delay: "المدة بالثواني",
    pages: "في",
    pages_all: "كل الصفحات",
    pages_product: "صفحات المنتجات",
    pages_cart: "السلة",
    popupTitle: "العنوان",
    popupTitlePlaceholder: "قبل ما تمشي…",
    message: "الرسالة",
    messagePlaceholder: "خصم 10% على أول أوردر.",
    coupon: "الكوبون",
    couponNone: "بدون كوبون — رسالة فقط",
    couponHint: "أحد أكواد الخصم عندك. لو انتهى أو توقف، النافذة تتوقف عن الظهور حتى تختار غيره.",
    save: "حفظ",
    saving: "جارٍ الحفظ…",
    saved: "تم حفظ نافذة الخروج.",
  },
} satisfies Messages;

export function ExitDownsellPage() {
  // Each offer's views, acceptances and added revenue (SPEC §10.11).
  const stats = useOfferStats();
  const t = useT(STRINGS);
  const workspaceId = useWorkspaceId();
  const toast = useToast();
  const errorMessage = useErrorMessage();
  const [draft, setDraft] = useState<ExitDownsellSettings | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const data = useAsync(async () => {
    const [settings, discounts] = await Promise.all([offersGetExitDownsell(apiClient, workspaceId), apiClient.listDiscounts(workspaceId)]);
    setDraft(settings);
    return discounts.filter((d) => d.code);
  }, [workspaceId]);

  const set = <K extends keyof ExitDownsellSettings>(key: K, value: ExitDownsellSettings[K]) =>
    setDraft((current) => (current ? { ...current, [key]: value } : current));

  async function save() {
    if (!draft) return;
    setBusy(true);
    setError(null);
    try {
      setDraft(await offersSaveExitDownsell(apiClient, workspaceId, draft));
      toast.success(t.saved);
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="max-w-2xl">
      <PageHeader title={t.title} description={t.description} back={{ to: "/offers", label: t.back }} />
      <div className="mb-3">
        <OfferNumbers stat={stats?.exitDownsell} />
      </div>
      <DataState loading={data.loading} error={data.error} onRetry={() => data.refresh()}>
        {draft && (
          <Card className="space-y-4 p-5">
            <label className="flex min-h-11 cursor-pointer items-center gap-3 text-sm font-medium text-ink">
              <input
                type="checkbox"
                className="size-4 accent-primary"
                checked={draft.enabled}
                disabled={busy}
                onChange={(e) => set("enabled", e.target.checked)}
              />
              {t.enabled}
            </label>

            <fieldset disabled={busy || !draft.enabled} className="space-y-4 disabled:opacity-60">
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <Label htmlFor="exit-trigger">{t.trigger}</Label>
                  <Select id="exit-trigger" value={draft.trigger} onChange={(e) => set("trigger", e.target.value as ExitDownsellSettings["trigger"])}>
                    <option value="exit_intent">{t.trigger_exit_intent}</option>
                    <option value="delay">{t.trigger_delay}</option>
                  </Select>
                  <p className="text-xs text-ink-soft">{t.triggerHint}</p>
                </div>
                {draft.trigger === "delay" ? (
                  <TextField
                    label={t.delay}
                    type="number"
                    inputMode="numeric"
                    min={3}
                    max={600}
                    value={String(draft.delaySeconds)}
                    onChange={(e) => set("delaySeconds", Math.min(600, Math.max(3, Number.parseInt(e.target.value, 10) || 3)))}
                  />
                ) : (
                  <div className="space-y-1.5">
                    <Label htmlFor="exit-pages">{t.pages}</Label>
                    <Select id="exit-pages" value={draft.pages} onChange={(e) => set("pages", e.target.value as ExitDownsellSettings["pages"])}>
                      <option value="all">{t.pages_all}</option>
                      <option value="product">{t.pages_product}</option>
                      <option value="cart">{t.pages_cart}</option>
                    </Select>
                  </div>
                )}
              </div>
              {draft.trigger === "delay" && (
                <div className="space-y-1.5 sm:max-w-[calc(50%-0.5rem)]">
                  <Label htmlFor="exit-pages-2">{t.pages}</Label>
                  <Select id="exit-pages-2" value={draft.pages} onChange={(e) => set("pages", e.target.value as ExitDownsellSettings["pages"])}>
                    <option value="all">{t.pages_all}</option>
                    <option value="product">{t.pages_product}</option>
                    <option value="cart">{t.pages_cart}</option>
                  </Select>
                </div>
              )}
              <TextField
                label={t.popupTitle}
                maxLength={120}
                placeholder={t.popupTitlePlaceholder}
                value={draft.title ?? ""}
                onChange={(e) => set("title", e.target.value)}
              />
              <TextField
                label={t.message}
                maxLength={300}
                placeholder={t.messagePlaceholder}
                value={draft.message ?? ""}
                onChange={(e) => set("message", e.target.value)}
              />
              <div className="space-y-1.5">
                <Label htmlFor="exit-coupon">{t.coupon}</Label>
                <Select id="exit-coupon" value={draft.discountId ?? ""} onChange={(e) => set("discountId", e.target.value || null)}>
                  <option value="">{t.couponNone}</option>
                  {(data.data ?? []).map((d) => (
                    <option key={d.id} value={d.id}>
                      {d.code}
                    </option>
                  ))}
                </Select>
                <p className="text-xs text-ink-soft">{t.couponHint}</p>
              </div>
            </fieldset>

            {error && <Alert variant="danger">{error}</Alert>}
            <div className="flex justify-end">
              <Button type="button" disabled={busy} onClick={() => void save()}>
                {busy ? t.saving : t.save}
              </Button>
            </div>
          </Card>
        )}
      </DataState>
    </div>
  );
}
