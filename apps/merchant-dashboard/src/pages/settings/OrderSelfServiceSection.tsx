import { useEffect, useId, useState, type FormEvent } from "react";
import { Alert, Input } from "@store-builder/ui";
import {
  ORDER_SELF_SERVICE_MAX_MINUTES,
  ORDER_SELF_SERVICE_MIN_MINUTES,
  orderSelfServiceSettingsGet,
  orderSelfServiceSettingsSave,
  type OrderSelfServiceRule,
  type OrderSelfServiceSettings,
} from "@store-builder/api-client";
import { apiClient } from "@/lib/apiClient";
import { useWorkspaceId } from "@/lib/useWorkspaceId";
import { useAsync } from "@/lib/useAsync";
import { useErrorMessage } from "@/lib/errorMessages";
import { useT, type Messages } from "@/i18n/LocaleContext";
import { DataState } from "@/components/DataState";
import { Select } from "@/components/Select";
import { SaveBar } from "@/components/SaveBar";
import { SettingsGroup, SettingsSwitch } from "@/components/settings";
import { useToast } from "@/components/Toast";
import { useReportDirty } from "@/lib/useUnsavedGuard";
import { PaneSkeleton } from "./sections/SettingsCard";

const STRINGS = {
  en: {
    title: "What customers can do on their order",
    description:
      "Let customers cancel an order or correct its address themselves, from the tracking page and from their account, instead of calling you.",
    cancel: "Customers can cancel",
    cancelOn: "“Cancel order” shows while the order is not confirmed, not shipped and not paid online. Cancelling releases the stock, like a cancellation from your side.",
    cancelOff: "Off: customers contact you to cancel.",
    cancelAlways: "Until you confirm the order",
    address: "Customers can change the address",
    addressOn: "“Change address” shows until the order ships. The shipping price is not recalculated: settle any difference with the customer.",
    addressOff: "Off: customers contact you to change the address.",
    addressAlways: "Until the order ships",
    window: "For how long",
    limited: "For a set time after ordering",
    amount: "How long",
    unit: "Unit",
    minutes: "minutes",
    hours: "hours",
    days: "days",
    range: "From 5 minutes up to 7 days.",
    rangeError: "Enter a time from 5 minutes to 7 days.",
    notified: "You get a notification for every cancellation and address change.",
    save: "Save",
    saving: "Saving…",
    discard: "Discard changes",
    saved: "Saved. Customers see the change on their order right away.",
  },
  ar: {
    title: "اللي العميل يقدر يعمله في أوردره",
    description: "خلّي العميل يلغي أوردره أو يصلّح عنوانه بنفسه، من صفحة تتبع الأوردر ومن حسابه، بدل ما يكلمك.",
    cancel: "العميل يقدر يلغي الأوردر",
    cancelOn: "زرار «إلغاء الأوردر» بيظهر طول ما الأوردر متأكدش ومتشحنش ومدفوعش أونلاين. الإلغاء بيرجّع المخزون، زي الإلغاء من عندك.",
    cancelOff: "مقفولة: العميل بيكلمك عشان يلغي.",
    cancelAlways: "لحد ما تأكّد الأوردر",
    address: "العميل يقدر يغيّر العنوان",
    addressOn: "زرار «تغيير العنوان» بيظهر لحد ما الأوردر يتشحن. سعر الشحن مش بيتحسب تاني: راجع أي فرق مع العميل.",
    addressOff: "مقفولة: العميل بيكلمك عشان يغيّر العنوان.",
    addressAlways: "لحد ما الأوردر يتشحن",
    window: "لحد إمتى",
    limited: "لمدة محددة بعد الأوردر",
    amount: "المدة",
    unit: "الوحدة",
    minutes: "دقيقة",
    hours: "ساعة",
    days: "يوم",
    range: "من ٥ دقايق لحد ٧ أيام.",
    rangeError: "اكتب مدة من ٥ دقايق لحد ٧ أيام.",
    notified: "هيوصلك إشعار مع كل إلغاء أو تغيير عنوان.",
    save: "حفظ",
    saving: "بنحفظ…",
    discard: "تجاهل",
    saved: "اتحفظ. العملاء هيشوفوا التغيير في أوردراتهم على طول.",
  },
} satisfies Messages;

type RuleKey = "cancel" | "address";
type Unit = "minutes" | "hours" | "days";
const UNIT_MINUTES: Record<Unit, number> = { minutes: 1, hours: 60, days: 1440 };
const UNITS: readonly Unit[] = ["minutes", "hours", "days"];

/** One rule as the form holds it: the window is "no limit", or a number with its unit. */
interface RuleDraft {
  enabled: boolean;
  limited: boolean;
  amount: string;
  unit: Unit;
}

/** 90 → 90 minutes, 120 → 2 hours, 2880 → 2 days: the largest unit that keeps it whole. */
function toDraft(rule: OrderSelfServiceRule): RuleDraft {
  const minutes = rule.minutes;
  if (minutes === null) return { enabled: rule.enabled, limited: false, amount: "30", unit: "minutes" };
  const unit: Unit = minutes % 1440 === 0 ? "days" : minutes % 60 === 0 ? "hours" : "minutes";
  return { enabled: rule.enabled, limited: true, amount: String(minutes / UNIT_MINUTES[unit]), unit };
}

/** The minutes a draft means: null for "no limit", NaN when the number is not one the API takes. */
function minutesOf(draft: RuleDraft): number | null {
  if (!draft.limited) return null;
  const ascii = draft.amount.trim().replace(/[٠-٩]/g, (d) => String("٠١٢٣٤٥٦٧٨٩".indexOf(d)));
  if (!/^\d{1,5}$/.test(ascii)) return Number.NaN;
  const minutes = Number(ascii) * UNIT_MINUTES[draft.unit];
  return minutes >= ORDER_SELF_SERVICE_MIN_MINUTES && minutes <= ORDER_SELF_SERVICE_MAX_MINUTES ? minutes : Number.NaN;
}

/**
 * Settings → Orders (handoff 220, orders.manage): whether shoppers may cancel
 * an order and change its address themselves, and for how long after placing
 * it. One Save for both. The buttons show on the storefront's tracking page
 * and in the shopper's account.
 */
export function OrderSelfServiceSection() {
  const workspaceId = useWorkspaceId();
  const t = useT(STRINGS);
  const toast = useToast();
  const errorMessage = useErrorMessage();

  const settings = useAsync(() => orderSelfServiceSettingsGet(apiClient, workspaceId), [workspaceId]);
  const [draft, setDraft] = useState<Record<RuleKey, RuleDraft> | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [invalid, setInvalid] = useState<RuleKey | null>(null);

  useEffect(() => {
    if (settings.data) setDraft({ cancel: toDraft(settings.data.cancel), address: toDraft(settings.data.address) });
  }, [settings.data]);

  const saved = settings.data;
  // A switched-off rule keeps the window it had: only what the shopper would see counts as a change.
  const payloadOf = (key: RuleKey): OrderSelfServiceRule | null => {
    if (!draft || !saved) return null;
    const rule = draft[key];
    if (!rule.enabled) return { enabled: false, minutes: saved[key].minutes };
    const minutes = minutesOf(rule);
    return Number.isNaN(minutes) ? null : { enabled: true, minutes };
  };
  const same = (a: OrderSelfServiceRule | null, b: OrderSelfServiceRule) => a !== null && a.enabled === b.enabled && a.minutes === b.minutes;
  const dirty = Boolean(draft && saved && !(same(payloadOf("cancel"), saved.cancel) && same(payloadOf("address"), saved.address)));
  useReportDirty(dirty);

  function patch(key: RuleKey, change: Partial<RuleDraft>) {
    setDraft((current) => (current ? { ...current, [key]: { ...current[key], ...change } } : current));
    setError(null);
    setInvalid((current) => (current === key ? null : current));
  }

  function discard() {
    if (saved) setDraft({ cancel: toDraft(saved.cancel), address: toDraft(saved.address) });
    setError(null);
    setInvalid(null);
  }

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (saving || !draft) return;
    const cancel = payloadOf("cancel");
    const address = payloadOf("address");
    if (!cancel || !address) {
      setInvalid(!cancel ? "cancel" : "address");
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const next: OrderSelfServiceSettings = await orderSelfServiceSettingsSave(apiClient, workspaceId, { cancel, address });
      settings.setData(next);
      toast.success(t.saved);
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setSaving(false);
    }
  }

  return (
    <DataState loading={settings.loading} error={settings.error} onRetry={() => void settings.refresh()} skeleton={<PaneSkeleton rows={2} />}>
      {draft && (
          <form onSubmit={submit} noValidate className="flex min-w-0 flex-col gap-[var(--bento-gap)]">
            <RuleFields
              rule={draft.cancel}
              disabled={saving}
              invalid={invalid === "cancel"}
              onChange={(change) => patch("cancel", change)}
              text={{ label: t.cancel, on: t.cancelOn, off: t.cancelOff, always: t.cancelAlways }}
            />
            <RuleFields
              rule={draft.address}
              disabled={saving}
              invalid={invalid === "address"}
              onChange={(change) => patch("address", change)}
              text={{ label: t.address, on: t.addressOn, off: t.addressOff, always: t.addressAlways }}
            />

            <p className="px-4 text-[13px] leading-5 text-ink-soft">{t.notified}</p>

            {error && <Alert variant="danger">{error}</Alert>}

            <SaveBar dirty={dirty} saving={saving} saveLabel={t.save} savingLabel={t.saving} discardLabel={t.discard} onDiscard={discard} />
          </form>
      )}
    </DataState>
  );
}

function RuleFields({
  rule,
  disabled,
  invalid,
  onChange,
  text,
}: {
  rule: RuleDraft;
  disabled: boolean;
  invalid: boolean;
  onChange: (change: Partial<RuleDraft>) => void;
  text: { label: string; on: string; off: string; always: string };
}) {
  const t = useT(STRINGS);
  const group = useId();
  const amountId = useId();
  const unitId = useId();
  const rangeId = useId();

  return (
    <SettingsGroup>
      <SettingsSwitch
        label={text.label}
        hint={rule.enabled ? text.on : text.off}
        checked={rule.enabled}
        disabled={disabled}
        onChange={(enabled) => onChange({ enabled })}
      />

      {rule.enabled && (
        <fieldset disabled={disabled} className="min-w-0 space-y-1 border-t border-line px-4 pt-3 pb-4">
          <legend className="text-sm font-medium text-ink">{t.window}</legend>
          <label className="flex min-h-11 cursor-pointer items-center gap-3 text-sm text-ink">
            <input
              type="radio"
              name={group}
              className="size-5 shrink-0 cursor-pointer accent-primary"
              checked={!rule.limited}
              onChange={() => onChange({ limited: false })}
            />
            {text.always}
          </label>
          <label className="flex min-h-11 cursor-pointer items-center gap-3 text-sm text-ink">
            <input
              type="radio"
              name={group}
              className="size-5 shrink-0 cursor-pointer accent-primary"
              checked={rule.limited}
              onChange={() => onChange({ limited: true })}
            />
            {t.limited}
          </label>
          {rule.limited && (
            <div className="ms-8 space-y-1.5 pb-1">
              <div className="flex flex-wrap items-center gap-2">
                <label htmlFor={amountId} className="sr-only">
                  {t.amount}
                </label>
                <Input
                  id={amountId}
                  type="text"
                  inputMode="numeric"
                  dir="ltr"
                  autoComplete="off"
                  maxLength={5}
                  value={rule.amount}
                  aria-invalid={invalid ? true : undefined}
                  aria-describedby={rangeId}
                  onChange={(e) => onChange({ amount: e.target.value })}
                  className="h-11 w-24 text-center text-base tabular-nums sm:text-sm"
                />
                <label htmlFor={unitId} className="sr-only">
                  {t.unit}
                </label>
                <Select id={unitId} value={rule.unit} onChange={(e) => onChange({ unit: e.target.value as Unit })} className="h-11 w-auto">
                  {UNITS.map((unit) => (
                    <option key={unit} value={unit}>
                      {t[unit]}
                    </option>
                  ))}
                </Select>
              </div>
              <p id={rangeId} role={invalid ? "alert" : undefined} className={invalid ? "text-xs font-medium text-danger" : "text-xs text-ink-soft"}>
                {invalid ? t.rangeError : t.range}
              </p>
            </div>
          )}
        </fieldset>
      )}
    </SettingsGroup>
  );
}
