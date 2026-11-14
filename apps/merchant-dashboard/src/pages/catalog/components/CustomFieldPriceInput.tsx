import { useId, useState } from "react";
import { Input, Label } from "@store-builder/ui";
import { customFieldPrice, type CustomField } from "@store-builder/api-client";
import { useT, type Messages } from "@/i18n/LocaleContext";

const STRINGS = {
  en: {
    price: "Extra price",
    hint: "Added to the product's price when the customer fills this in (e.g. 20 to print a name). Empty = free.",
  },
  ar: {
    price: "سعر إضافي",
    hint: "بيتضاف لسعر المنتج لما العميل يملا الخانة دي (مثلًا 20 لطباعة اسم). فاضي = ببلاش.",
  },
} satisfies Messages;

/**
 * A custom field's `priceDeltaAmount` (catalog/customFieldPricing.js), typed
 * in the store's currency and kept in minor units.
 */
export function CustomFieldPriceInput({ field, onChange }: { field: CustomField; onChange: (patch: Partial<CustomField>) => void }) {
  const t = useT(STRINGS);
  const id = useId();
  const stored = customFieldPrice(field);
  const [text, setText] = useState(stored ? String(stored / 100) : "");

  return (
    <div className="space-y-1.5">
      <Label htmlFor={id}>{t.price}</Label>
      <Input
        id={id}
        type="number"
        inputMode="decimal"
        min={0}
        step="0.01"
        dir="ltr"
        placeholder="0"
        value={text}
        aria-describedby={`${id}-hint`}
        onChange={(e) => {
          setText(e.target.value);
          const value = Number(e.target.value);
          const minor = Number.isFinite(value) && value > 0 ? Math.min(Math.round(value * 100), 100000000) : 0;
          onChange({ priceDeltaAmount: minor || undefined } as Partial<CustomField>);
        }}
      />
      <p id={`${id}-hint`} className="text-xs text-ink-soft">
        {t.hint}
      </p>
    </div>
  );
}
