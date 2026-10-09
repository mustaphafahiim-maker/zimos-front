import { useId } from "react";
import { useT, type Messages } from "@/i18n/LocaleContext";
import { SwitchTrack } from "../variants/SwitchTrack";

const STRINGS = {
  en: {
    label: "Track quantity",
    on: "Stock goes down with every order. When it runs out the product shows as sold out, unless a variant allows overselling.",
    off: "Not tracked: the product never runs out and sends no low-stock alerts.",
    notTracked: "Not tracked",
  },
  ar: {
    label: "تتبّع الكمية",
    on: "المخزون بينقص مع كل أوردر، ولما يخلص المنتج يظهر عليه «نفدت الكمية» إلا لو النوع مسموح يتباع بعد ما يخلص.",
    off: "من غير تتبّع: المنتج مبيخلصش أبدًا ومبيبعتش تنبيهات إن المخزون قرّب يخلص.",
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
 *
 * It is still a checkbox underneath (now with the switch role), laid over the
 * whole 44px row: the name at the start, the switch at the end, and under them
 * what the current choice means.
 */
export function TrackQuantityField({ value, onChange, disabled }: { value: boolean; onChange: (value: boolean) => void; disabled?: boolean }) {
  const t = useT(STRINGS);
  const hintId = useId();
  return (
    <div className="space-y-1">
      <label className="relative flex min-h-11 cursor-pointer items-center justify-between gap-3 text-sm font-medium text-ink has-[:disabled]:cursor-not-allowed has-[:disabled]:opacity-60">
        <span className="min-w-0">{t.label}</span>
        <input
          type="checkbox"
          role="switch"
          className="peer absolute inset-0 m-0 size-full cursor-pointer appearance-none opacity-0 disabled:cursor-not-allowed"
          checked={value}
          disabled={disabled}
          aria-describedby={hintId}
          onChange={(e) => onChange(e.target.checked)}
        />
        <SwitchTrack
          on={value}
          className="peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-primary peer-active:[&>span]:scale-[0.92]"
        />
      </label>
      <p id={hintId} className="text-xs leading-5 text-ink-soft">
        {value ? t.on : t.off}
      </p>
    </div>
  );
}
