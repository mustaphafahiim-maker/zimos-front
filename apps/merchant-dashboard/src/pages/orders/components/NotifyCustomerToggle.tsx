import { useId } from "react";
import { useT, type Messages } from "@/i18n/LocaleContext";

const STRINGS = {
  en: {
    label: "Notify the customer",
    hint: "Emails them when they left an email address, and runs your automations for this. Untick to change the order quietly.",
  },
  ar: {
    label: "إبلاغ العميل",
    hint: "يُرسل له بريدًا إذا ترك بريده، ويشغّل الأتمتة الخاصة بذلك. ألغِ التحديد لتغيير الطلب بهدوء.",
  },
} satisfies Messages;

/** "Notify the customer" on a cancellation or refund (SPEC §4.4). */
export function NotifyCustomerToggle({ checked, onChange }: { checked: boolean; onChange: (checked: boolean) => void }) {
  const t = useT(STRINGS);
  const hintId = useId();
  return (
    <div className="mt-3">
      <label className="flex min-h-11 cursor-pointer items-center gap-2 text-sm text-ink">
        <input
          type="checkbox"
          className="size-4 accent-primary"
          checked={checked}
          aria-describedby={hintId}
          onChange={(e) => onChange(e.target.checked)}
        />
        {t.label}
      </label>
      <p id={hintId} className="text-xs text-ink-soft">
        {t.hint}
      </p>
    </div>
  );
}
