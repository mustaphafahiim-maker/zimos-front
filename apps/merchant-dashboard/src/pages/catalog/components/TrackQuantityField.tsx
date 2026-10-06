import { useId } from "react";
import { useT, type Messages } from "@/i18n/LocaleContext";

const STRINGS = {
  en: {
    label: "Track quantity",
    on: "Stock goes down with every order. When it runs out the product shows as sold out, unless a variant allows overselling.",
    off: "Not tracked: the product never runs out and sends no low-stock alerts.",
    notTracked: "Not tracked",
  },
  ar: {
    label: "تتبّع الكمية",
    on: "ينقص المخزون مع كل طلب، ولما يخلص يظهر المنتج «نفد» إلا لو النوع مسموح ببيعه بعد نفاد المخزون.",
    off: "غير متتبّع: المنتج مبينفدش أبدًا ومبيبعتش تنبيهات انخفاض المخزون.",
    notTracked: "غير متتبع",
  },
} satisfies Messages;

/** "Not tracked", for the stock column of an untracked product. */
export function useNotTrackedLabel(): string {
  return useT(STRINGS).notTracked;
}

/**
 * The physical product's "Track quantity" switch (SPEC §7.1; backend
 * catalog/stockTracking.js). Off, its variants sell past their stock and no
 * stock is asked for.
 */
export function TrackQuantityField({ value, onChange, disabled }: { value: boolean; onChange: (value: boolean) => void; disabled?: boolean }) {
  const t = useT(STRINGS);
  const hintId = useId();
  return (
    <div className="space-y-1">
      <label className="flex min-h-11 cursor-pointer items-center gap-2 text-sm font-medium text-ink">
        <input
          type="checkbox"
          className="size-4 accent-primary"
          checked={value}
          disabled={disabled}
          aria-describedby={hintId}
          onChange={(e) => onChange(e.target.checked)}
        />
        {t.label}
      </label>
      <p id={hintId} className="text-xs text-ink-soft">
        {value ? t.on : t.off}
      </p>
    </div>
  );
}
