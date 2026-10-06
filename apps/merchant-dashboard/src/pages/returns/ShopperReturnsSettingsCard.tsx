import { useEffect, useId, useState, type FormEvent } from "react";
import { Lock } from "lucide-react";
import { Alert, Button, Card, Input, Spinner } from "@store-builder/ui";
import {
  RETURN_REASON_CODES,
  shopperReturnsSettingsGet,
  shopperReturnsSettingsSave,
  type ReturnReasonCode,
  type ShopperReturnsSettings,
} from "@store-builder/api-client";
import { apiClient } from "@/lib/apiClient";
import { useWorkspaceId } from "@/lib/useWorkspaceId";
import { useAsync } from "@/lib/useAsync";
import { isPermissionError } from "@/lib/errors";
import { useErrorMessage } from "@/lib/errorMessages";
import { fmt, useLocale, useT, type Messages } from "@/i18n/LocaleContext";
import { useToast } from "@/components/Toast";
import { RETURN_REASON_TEXT } from "./ReturnExtras";

const STRINGS = {
  en: {
    title: "Let customers ask for a return",
    hintOff: "Off: customers contact you about a return, and you open it from the order.",
    hintOn: "Customers see “Return items” on their order's tracking page once it's delivered. Their requests land here as “From customer” for you to approve or reject.",
    days: "Days after delivery",
    daysHint: "Returns close this many days after the order is delivered.",
    daysError: "Enter a number of days from 1 to 365.",
    photoTitle: "Photo required when the reason is",
    photoHint: "The customer has to add a photo of the problem for these reasons.",
    save: "Save",
    cancel: "Cancel",
    saving: "Saving…",
    saved: "Saved. Customers see the change on their tracking page right away.",
    loading: "Loading the return setting…",
    loadError: "We couldn't load this setting.",
    retry: "Try again",
    noAccess: "Changing this needs the “manage orders” permission. Ask the store owner.",
    days1: "Open for 1 day after delivery",
    days2: "Open for 2 days after delivery",
    daysFew: "Open for {days} days after delivery",
    daysMany: "Open for {days} days after delivery",
    photoFor: "Photo needed for: {reasons}",
    noPhoto: "No photo needed",
    edit: "Change",
    listSep: ", ",
  },
  ar: {
    title: "خلّي العملاء يطلبوا مرتجع",
    hintOff: "مقفولة: العميل بيكلمك عشان المرتجع، وإنت بتفتحه من صفحة الأوردر.",
    hintOn: "العميل هيلاقي «ارجع منتجات» في صفحة تتبع الأوردر بعد ما يستلم، وطلبه يوصلك هنا «من العميل» تقبله أو ترفضه.",
    days: "عدد الأيام بعد الاستلام",
    daysHint: "المرتجع بيتقفل بعد العدد ده من الأيام من يوم الاستلام.",
    daysError: "اكتب عدد أيام من ١ لـ ٣٦٥.",
    photoTitle: "لازم صورة لو السبب",
    photoHint: "العميل لازم يضيف صورة للمشكلة لو اختار سبب من دول.",
    save: "احفظ",
    cancel: "إلغاء",
    saving: "بيحفظ…",
    saved: "اتحفظ. العملاء هيشوفوا التغيير في صفحة التتبع على طول.",
    loading: "بيحمّل إعداد المرتجع…",
    loadError: "معرفناش نحمّل الإعداد ده.",
    retry: "جرّب تاني",
    noAccess: "تغيير الإعداد ده محتاج صلاحية «إدارة الأوردرات». اطلبها من صاحب المتجر.",
    days1: "مفتوح يوم واحد بعد الاستلام",
    days2: "مفتوح يومين بعد الاستلام",
    daysFew: "مفتوح {days} أيام بعد الاستلام",
    daysMany: "مفتوح {days} يوم بعد الاستلام",
    photoFor: "الصورة لازمة لو: {reasons}",
    noPhoto: "من غير صور",
    edit: "عدّل",
    listSep: "، ",
  },
} satisfies Messages;

type Draft = { enabled: boolean; windowDays: string; photoRequiredFor: ReturnReasonCode[] };

const toDraft = (s: ShopperReturnsSettings): Draft => ({
  enabled: s.enabled,
  windowDays: String(s.windowDays),
  photoRequiredFor: [...s.photoRequiredFor],
});

function sameDraft(a: Draft, b: Draft): boolean {
  return (
    a.enabled === b.enabled &&
    a.windowDays.trim() === b.windowDays.trim() &&
    a.photoRequiredFor.length === b.photoRequiredFor.length &&
    a.photoRequiredFor.every((r) => b.photoRequiredFor.includes(r))
  );
}

/** A whole number of days the API takes (1–365), or null. */
function parseDays(raw: string): number | null {
  const ascii = raw.trim().replace(/[٠-٩]/g, (d) => String("٠١٢٣٤٥٦٧٨٩".indexOf(d)));
  if (!/^\d{1,3}$/.test(ascii)) return null;
  const n = Number(ascii);
  return n >= 1 && n <= 365 ? n : null;
}

/**
 * Returns → the store's shopper-returns setting (handoff 186, orders.manage):
 * whether customers may ask for a return from the tracking page, for how many
 * days after delivery, and which reasons need a photo of the problem. One
 * Save for the three; the page's queue below is where the requests land.
 */
export function ShopperReturnsSettingsCard() {
  const workspaceId = useWorkspaceId();
  const t = useT(STRINGS);
  const { locale, intlLocale } = useLocale();
  const reasonText = RETURN_REASON_TEXT[locale];
  const toast = useToast();
  const errorMessage = useErrorMessage();
  const switchHint = useId();
  const daysId = useId();
  const daysHint = useId();

  const settings = useAsync(() => shopperReturnsSettingsGet(apiClient, workspaceId), [workspaceId]);
  const [draft, setDraft] = useState<Draft | null>(null);
  const [saving, setSaving] = useState(false);
  const [daysError, setDaysError] = useState<string | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);
  // A saved, switched-on setting folds into one summary line so the queue below stays in reach.
  const [expanded, setExpanded] = useState(false);

  useEffect(() => {
    if (settings.data) setDraft(toDraft(settings.data));
  }, [settings.data]);

  if (settings.loading || (!draft && !settings.error)) {
    return (
      <Card className="mb-4 p-4">
        <div role="status" className="flex min-h-11 items-center gap-2 text-sm text-ink-soft">
          <Spinner className="size-5" role="presentation" aria-hidden="true" aria-label={undefined} />
          {t.loading}
        </div>
      </Card>
    );
  }

  if (settings.error || !draft || !settings.data) {
    const denied = isPermissionError(settings.error);
    return (
      <Card className="mb-4 p-4">
        <h2 className="text-sm font-semibold text-ink">{t.title}</h2>
        {denied ? (
          <p className="mt-1 flex items-center gap-2 text-sm text-ink-soft">
            <Lock className="size-4 shrink-0" aria-hidden />
            {t.noAccess}
          </p>
        ) : (
          <div role="alert" className="mt-2 flex flex-wrap items-center gap-3">
            <p className="text-sm text-danger">{settings.error ? errorMessage(settings.error) : t.loadError}</p>
            <Button variant="outline" size="sm" className="min-h-11" onClick={() => void settings.refresh()}>
              {t.retry}
            </Button>
          </div>
        )}
      </Card>
    );
  }

  const saved = toDraft(settings.data);
  const dirty = !sameDraft(draft, saved);
  const showFields = draft.enabled && (expanded || dirty || !saved.enabled);
  const savedDays = settings.data.windowDays;
  const daysLine = fmt(
    savedDays === 1 ? t.days1 : savedDays === 2 ? t.days2 : savedDays <= 10 ? t.daysFew : t.daysMany,
    { days: new Intl.NumberFormat(intlLocale).format(savedDays) }
  );
  const photoLine = settings.data.photoRequiredFor.length
    ? fmt(t.photoFor, { reasons: settings.data.photoRequiredFor.map((code) => reasonText[code]).join(t.listSep) })
    : t.noPhoto;

  function togglePhoto(code: ReturnReasonCode, on: boolean) {
    setDraft((d) =>
      d
        ? {
            ...d,
            photoRequiredFor: on
              ? RETURN_REASON_CODES.filter((r) => r === code || d.photoRequiredFor.includes(r))
              : d.photoRequiredFor.filter((r) => r !== code),
          }
        : d
    );
  }

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (!draft || saving) return;
    setSaveError(null);
    // Days are checked only while the switch is on; off keeps the last good number.
    const days = parseDays(draft.windowDays);
    if (draft.enabled && days === null) {
      setDaysError(t.daysError);
      document.getElementById(daysId)?.focus();
      return;
    }
    setDaysError(null);
    setSaving(true);
    try {
      const next = await shopperReturnsSettingsSave(apiClient, workspaceId, {
        enabled: draft.enabled,
        windowDays: days ?? settings.data!.windowDays,
        photoRequiredFor: draft.photoRequiredFor,
      });
      settings.setData(next);
      setExpanded(false);
      toast.success(t.saved);
    } catch (err) {
      setSaveError(errorMessage(err));
    } finally {
      setSaving(false);
    }
  }

  return (
    <Card className="mb-4 p-4">
      <form onSubmit={submit} noValidate className="space-y-4">
        <div>
          <label className="flex min-h-11 cursor-pointer items-center gap-3 text-sm font-semibold text-ink">
            <input
              type="checkbox"
              role="switch"
              className="size-5 shrink-0 cursor-pointer accent-primary"
              checked={draft.enabled}
              aria-describedby={switchHint}
              onChange={(e) => setDraft((d) => (d ? { ...d, enabled: e.target.checked } : d))}
            />
            {t.title}
          </label>
          <p id={switchHint} className="text-xs text-ink-soft">
            {draft.enabled ? t.hintOn : t.hintOff}
          </p>
        </div>

        {draft.enabled && !showFields && (
          <div className="flex items-center justify-between gap-3 rounded-[var(--radius)] bg-paper-sunken px-3 py-2">
            <div className="min-w-0">
              <p className="text-sm text-ink">{daysLine}</p>
              <p className="text-xs text-ink-soft">{photoLine}</p>
            </div>
            <Button type="button" variant="ghost" size="sm" className="min-h-11" onClick={() => setExpanded(true)}>
              {t.edit}
            </Button>
          </div>
        )}

        {showFields && (
          <>
            <div className="space-y-1.5">
              <label htmlFor={daysId} className="block text-sm font-medium text-ink">
                {t.days}
              </label>
              <Input
                id={daysId}
                type="text"
                inputMode="numeric"
                dir="ltr"
                autoComplete="off"
                maxLength={3}
                value={draft.windowDays}
                aria-invalid={daysError ? true : undefined}
                aria-describedby={daysHint}
                onChange={(e) => {
                  setDaysError(null);
                  setDraft((d) => (d ? { ...d, windowDays: e.target.value } : d));
                }}
                className="h-11 w-28 text-center tabular-nums"
              />
              <p id={daysHint} className={daysError ? "text-xs font-medium text-danger" : "text-xs text-ink-soft"}>
                {daysError ?? t.daysHint}
              </p>
            </div>

            <fieldset>
              <legend className="text-sm font-medium text-ink">{t.photoTitle}</legend>
              <p className="mt-0.5 text-xs text-ink-soft">{t.photoHint}</p>
              <div className="mt-2 grid grid-cols-2 gap-x-3 sm:grid-cols-3">
                {RETURN_REASON_CODES.map((code) => (
                  <label key={code} className="flex min-h-11 cursor-pointer items-center gap-2 text-sm text-ink">
                    <input
                      type="checkbox"
                      className="size-5 shrink-0 cursor-pointer accent-primary"
                      checked={draft.photoRequiredFor.includes(code)}
                      onChange={(e) => togglePhoto(code, e.target.checked)}
                    />
                    {reasonText[code]}
                  </label>
                ))}
              </div>
            </fieldset>
          </>
        )}

        {saveError && <Alert variant="danger">{saveError}</Alert>}

        {(dirty || saving || (expanded && draft.enabled)) && (
          <div className="flex flex-wrap items-center justify-end gap-2">
            <Button
              type="button"
              variant="outline"
              className="min-h-11"
              disabled={saving}
              onClick={() => {
                setDraft(saved);
                setExpanded(false);
                setDaysError(null);
                setSaveError(null);
              }}
            >
              {t.cancel}
            </Button>
            <Button type="submit" className="min-h-11" disabled={saving || !dirty}>
              {saving ? t.saving : t.save}
            </Button>
          </div>
        )}
      </form>
    </Card>
  );
}
