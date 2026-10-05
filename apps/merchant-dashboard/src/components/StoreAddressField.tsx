import { Check, CircleAlert, Loader2 } from "lucide-react";
import { Input, Label, cn } from "@store-builder/ui";
import { ROOT_DOMAIN } from "@/lib/storeAddress";
import type { SlugCheckState } from "@/lib/useSlugCheck";
import { fmt, useT, type Messages } from "@/i18n/LocaleContext";

const STRINGS = {
  en: {
    label: "Store address",
    checking: "Checking availability…",
    available: "{address} is available",
    empty: "This is the web address your customers will visit.",
    checkFailed: "Couldn't check that address right now.",
    reason_taken: "That address is already taken. Try another.",
    reason_reserved: "That address is reserved and can't be used.",
    reason_too_short: "Addresses need at least 3 characters.",
    reason_too_long: "Addresses can be at most 63 characters.",
    reason_invalid_format: "Use lowercase letters, numbers and hyphens only — and don't start or end with a hyphen.",
    reason_other: "That address can't be used.",
  },
  ar: {
    label: "عنوان المتجر",
    checking: "جارٍ التحقق من التوفر…",
    available: "{address} متاح",
    empty: "ده العنوان اللي عملاءك هيفتحوه.",
    checkFailed: "مقدرناش نتحقق من العنوان ده دلوقتي.",
    reason_taken: "العنوان ده محجوز لمتجر تاني. جرّب غيره.",
    reason_reserved: "العنوان ده محجوز للمنصة ومينفعش يتستخدم.",
    reason_too_short: "العنوان لازم يكون ٣ حروف على الأقل.",
    reason_too_long: "العنوان أقصاه ٦٣ حرف.",
    reason_invalid_format: "استخدم حروف إنجليزي صغيرة وأرقام وشَرطات بس — ومن غير شَرطة في الأول أو الآخر.",
    reason_other: "العنوان ده مينفعش يتستخدم.",
  },
} satisfies Messages;

/**
 * The store address input, with the live verdict underneath it.
 *
 * The domain is drawn as part of the control rather than left to a hint, so
 * what the merchant is choosing reads as the address it will become — they are
 * naming a link, not filling in a field called "slug".
 *
 * Typing is normalised on the way in (lowercased, spaces to hyphens). The
 * backend would do the same before storing, so letting a merchant type
 * "My Store" and then quietly checking something else would make the verdict
 * look like it belonged to different text.
 */
export function StoreAddressField({
  id,
  value,
  onChange,
  state,
  disabled,
}: {
  id: string;
  value: string;
  onChange: (slug: string) => void;
  state: SlugCheckState;
  disabled?: boolean;
}) {
  const t = useT(STRINGS);
  const invalid = state.status === "unavailable";
  const reasonText = (reason: string | undefined) => (t as Record<string, string>)[`reason_${reason}`] ?? t.reason_other;

  return (
    <div className="space-y-1.5">
      <Label htmlFor={id}>{t.label}</Label>
      <div
        dir="ltr"
        className={cn(
          "flex items-center rounded-[0.5rem] border border-line-strong bg-paper-raised pe-3 transition-colors focus-within:ring-2 focus-within:ring-primary/30",
          invalid && "border-danger focus-within:ring-danger/30",
          state.status === "available" && "border-success",
          disabled && "opacity-50"
        )}
      >
        <Input
          id={id}
          value={value}
          disabled={disabled}
          autoComplete="off"
          autoCapitalize="none"
          spellCheck={false}
          aria-invalid={invalid || undefined}
          aria-describedby={`${id}-status`}
          onChange={(e) =>
            onChange(e.target.value.toLowerCase().replace(/[^a-z0-9-]+/g, "-"))
          }
          placeholder="my-store"
          // The border and ring live on the wrapper so the suffix sits inside
          // them. Input styles its own focus and aria-invalid states, which
          // would draw a second box within this one — hence neutralising those
          // variants too, not just the resting border.
          className="h-9 border-0 bg-transparent shadow-none focus-visible:border-0 focus-visible:ring-0 aria-invalid:border-0 aria-invalid:ring-0 dark:bg-transparent"
        />
        <span className="shrink-0 select-none text-sm text-ink-soft">.{ROOT_DOMAIN}</span>
      </div>

      <p
        id={`${id}-status`}
        aria-live="polite"
        className={cn(
          "flex items-center gap-1.5 text-xs",
          state.status === "available" && "font-medium text-success",
          state.status === "unavailable" && "font-medium text-danger",
          (state.status === "checking" || state.status === "empty") && "text-ink-soft",
          state.status === "error" && "text-ink-soft"
        )}
      >
        {state.status === "checking" && (
          <>
            <Loader2 className="size-3.5 animate-spin" aria-hidden />
            {t.checking}
          </>
        )}
        {state.status === "available" && (
          <>
            <Check className="size-3.5" aria-hidden />
            {fmt(t.available, { address: `${value}.${ROOT_DOMAIN}` })}
          </>
        )}
        {state.status === "unavailable" && (
          <>
            <CircleAlert className="size-3.5" aria-hidden />
            {reasonText(state.result.reason)}
          </>
        )}
        {state.status === "error" && t.checkFailed}
        {state.status === "empty" && t.empty}
      </p>
    </div>
  );
}
