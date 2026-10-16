import type { CatalogCollectionFlags } from "@store-builder/api-client";
import { useT, type Messages } from "@/i18n/LocaleContext";

/**
 * Where a collection shows up in the store (SPEC §7.6): in the header menu,
 * or nowhere at all except through its own link.
 */

const STRINGS = {
  en: {
    showInHeader: "Show in the store header",
    showInHeaderHint: "Adds this collection to the menu at the top of your store.",
    hidden: "Hidden",
    hiddenHint: "Left out of the store's menus and collection lists. Its own link still opens.",
  },
  ar: {
    showInHeader: "إظهار في هيدر المتجر",
    showInHeaderHint: "يضيف هذه المجموعة إلى القائمة أعلى متجرك.",
    hidden: "مخفية",
    hiddenHint: "لا تظهر في قوائم المتجر أو قوائم المجموعات. رابطها يفتح كالمعتاد.",
  },
} satisfies Messages;

export function CollectionVisibilityFields({
  value,
  onChange,
  disabled,
}: {
  value: CatalogCollectionFlags;
  onChange: (next: CatalogCollectionFlags) => void;
  disabled?: boolean;
}) {
  const t = useT(STRINGS);
  const row = (key: keyof CatalogCollectionFlags, label: string, hint: string, off: boolean) => (
    <label className="flex min-h-11 cursor-pointer items-start gap-3 rounded-[0.5rem] px-2 py-2 hover:bg-paper">
      <input
        type="checkbox"
        className="mt-0.5 size-4 shrink-0 accent-primary"
        checked={value[key]}
        disabled={disabled || off}
        onChange={(e) => onChange({ ...value, [key]: e.target.checked })}
      />
      <span className="min-w-0">
        <span className="block text-sm font-medium text-ink">{label}</span>
        <span className="block text-xs text-ink-soft">{hint}</span>
      </span>
    </label>
  );
  return (
    <fieldset>
      {/* A hidden collection is in no menu, so the header option is off with it. */}
      {row("showInHeader", t.showInHeader, t.showInHeaderHint, value.hidden)}
      {row("hidden", t.hidden, t.hiddenHint, false)}
    </fieldset>
  );
}
