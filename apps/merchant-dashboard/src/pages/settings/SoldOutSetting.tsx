import { useId } from "react";
import { SOLD_OUT_MODES, type SoldOutMode } from "@store-builder/api-client";
import { Select } from "@/components/Select";
import { SettingsRow } from "@/components/settings";
import { useT, type Messages } from "@/i18n/LocaleContext";

const STRINGS = {
  en: {
    label: "Sold-out products",
    show: "Show them as usual",
    last: "Show them at the end",
    hide: "Hide them",
    help: "A product counts as available if any of its variants can be ordered: it has stock, selling past stock is allowed, or it takes pre-orders",
  },
  ar: {
    label: "المنتجات اللي خلصت",
    show: "اعرضها عادي",
    last: "اعرضها في الآخر",
    hide: "اخفيها",
    help: "المنتج يعتبر متاح لو أي مقاس أو لون منه ينفع يتطلب: فيه مخزون، أو البيع بعد نفاد المخزون مسموح، أو بيتطلب طلب مسبق",
  },
} satisfies Messages;

/**
 * «المنتجات اللي خلصت» in the store's product-listing settings (handoff 390,
 * settings.storefront_catalog.sold_out): what the shop, collection and search
 * lists do with products nobody can buy right now — show them as usual, put
 * them at the end, or hide them. Saved with the rest of the listing card.
 */
export function SoldOutSetting({ value, onChange, disabled }: { value: SoldOutMode; onChange: (next: SoldOutMode) => void; disabled?: boolean }) {
  const t = useT(STRINGS);
  const id = useId();
  return (
    <SettingsRow
      label={t.label}
      hint={t.help}
      htmlFor={id}
      control={
        <Select id={id} value={value} disabled={disabled} onChange={(e) => onChange(e.target.value as SoldOutMode)} className="h-11 text-base sm:text-sm">
          {SOLD_OUT_MODES.map((mode) => (
            <option key={mode} value={mode}>
              {t[mode]}
            </option>
          ))}
        </Select>
      }
    />
  );
}
