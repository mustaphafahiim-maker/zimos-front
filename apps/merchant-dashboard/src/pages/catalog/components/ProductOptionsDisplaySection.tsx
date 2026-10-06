import { useMemo, useState } from "react";
import { Alert, Button, Card, CardContent, Label } from "@store-builder/ui";
import {
  PRODUCT_OPTION_DISPLAY_TYPES,
  catalogUpdateProduct,
  type CatalogProduct,
  type ProductOptionDisplay,
  type ProductOptionDisplayType,
  type Variant,
} from "@store-builder/api-client";
import { apiClient } from "@/lib/apiClient";
import { useWorkspaceId } from "@/lib/useWorkspaceId";
import { useErrorMessage } from "@/lib/errorMessages";
import { fmt, useT, type Messages } from "@/i18n/LocaleContext";
import { useToast } from "@/components/Toast";
import { Select } from "@/components/Select";
import { ImageUrlInput } from "./ImageUrlInput";

/**
 * How each option of the product is drawn in the store (SPEC §7.2): buttons,
 * a dropdown, colour swatches or pictures. The option names and values come
 * from the active variants; what is chosen here is saved in the product's
 * `options`.
 */

const STRINGS = {
  en: {
    title: "Option display",
    description: "Choose how shoppers pick each option in the store.",
    type_buttons: "Buttons",
    type_dropdown: "Dropdown",
    type_color: "Colour swatches",
    type_image: "Images",
    displayAs: "Show “{name}” as",
    colorOf: "Colour for {value}",
    imageOf: "Image for {value}",
    save: "Save option display",
    saving: "Saving…",
    saved: "Option display saved.",
    discard: "Discard changes",
  },
  ar: {
    title: "شكل الخيارات",
    description: "اختار كيف يختار العميل كل خيار في المتجر.",
    type_buttons: "أزرار",
    type_dropdown: "قائمة منسدلة",
    type_color: "ألوان",
    type_image: "صور",
    displayAs: "عرض «{name}» كـ",
    colorOf: "لون {value}",
    imageOf: "صورة {value}",
    save: "حفظ شكل الخيارات",
    saving: "بنحفظ…",
    saved: "تم حفظ شكل الخيارات.",
    discard: "تجاهل التغييرات",
  },
} satisfies Messages;

/** Option names and their values as the active variants use them, first seen first. */
function optionsFromVariants(variants: Variant[]): { name: string; values: string[] }[] {
  const groups = new Map<string, string[]>();
  for (const variant of variants) {
    if (variant.status !== "active") continue;
    for (const [name, value] of Object.entries(variant.optionValues ?? {})) {
      if (!value) continue;
      const values = groups.get(name) ?? [];
      if (!values.includes(String(value))) values.push(String(value));
      groups.set(name, values);
    }
  }
  return [...groups.entries()].map(([name, values]) => ({ name, values }));
}

function build(product: CatalogProduct, variants: Variant[]): ProductOptionDisplay[] {
  const stored = new Map((product.options ?? []).map((o) => [o.name, o]));
  return optionsFromVariants(variants).map(({ name, values }) => {
    const prev = stored.get(name);
    return {
      name,
      values,
      displayType: prev?.displayType ?? "buttons",
      swatches: prev?.swatches ?? {},
      images: prev?.images ?? {},
    };
  });
}

/** Only what the chosen display type uses, and only for values that still exist. */
function clean(option: ProductOptionDisplay): ProductOptionDisplay {
  const out: ProductOptionDisplay = { name: option.name, values: option.values, displayType: option.displayType };
  const keep = (map: Record<string, string> | undefined) =>
    Object.fromEntries(Object.entries(map ?? {}).filter(([value, v]) => v && (option.values ?? []).includes(value)));
  if (option.displayType === "color") out.swatches = keep(option.swatches);
  if (option.displayType === "image") out.images = keep(option.images);
  return out;
}

export function ProductOptionsDisplaySection({
  product,
  variants,
  onChanged,
}: {
  product: CatalogProduct;
  variants: Variant[];
  onChanged: () => void;
}) {
  const t = useT(STRINGS);
  const workspaceId = useWorkspaceId();
  const toast = useToast();
  const errorMessage = useErrorMessage();
  const initial = useMemo(() => build(product, variants), [product, variants]);
  const [options, setOptions] = useState(initial);
  const [baseline, setBaseline] = useState(initial);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Variants changed elsewhere on the page: start again from what is saved.
  if (JSON.stringify(initial) !== JSON.stringify(baseline)) {
    setBaseline(initial);
    setOptions(initial);
  }

  if (options.length === 0) return null;

  const dirty = JSON.stringify(options.map(clean)) !== JSON.stringify(baseline.map(clean));
  const patch = (index: number, change: Partial<ProductOptionDisplay>) =>
    setOptions((current) => current.map((o, i) => (i === index ? { ...o, ...change } : o)));

  async function save() {
    setBusy(true);
    setError(null);
    try {
      await catalogUpdateProduct(apiClient, workspaceId, product.id, { options: options.map(clean) });
      toast.success(t.saved);
      onChanged();
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <Card>
      <CardContent className="space-y-4 py-5">
        <div>
          <h2 className="font-display text-lg font-medium text-ink">{t.title}</h2>
          <p className="mt-1 text-sm text-ink-soft">{t.description}</p>
        </div>

        {options.map((option, index) => (
          <div key={option.name} className="space-y-3 rounded-[0.5rem] border border-line p-4">
            <div className="grid items-end gap-3 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor={`opt-display-${index}`}>{fmt(t.displayAs, { name: option.name })}</Label>
                <Select
                  id={`opt-display-${index}`}
                  value={option.displayType ?? "buttons"}
                  disabled={busy}
                  onChange={(e) => patch(index, { displayType: e.target.value as ProductOptionDisplayType })}
                >
                  {PRODUCT_OPTION_DISPLAY_TYPES.map((type) => (
                    <option key={type} value={type}>
                      {t[`type_${type}`]}
                    </option>
                  ))}
                </Select>
              </div>
              <p className="text-sm text-ink-soft">{(option.values ?? []).join(" · ")}</p>
            </div>

            {option.displayType === "color" && (
              <div className="flex flex-wrap gap-3">
                {(option.values ?? []).map((value) => (
                  <label key={value} className="flex items-center gap-2 text-sm text-ink">
                    <input
                      type="color"
                      aria-label={fmt(t.colorOf, { value })}
                      className="size-10 cursor-pointer rounded-[0.5rem] border border-line bg-transparent p-0.5"
                      value={option.swatches?.[value] ?? "#000000"}
                      disabled={busy}
                      onChange={(e) => patch(index, { swatches: { ...option.swatches, [value]: e.target.value } })}
                    />
                    {value}
                  </label>
                ))}
              </div>
            )}

            {option.displayType === "image" && (
              <div className="space-y-2">
                {(option.values ?? []).map((value) => (
                  <div key={value} className="grid items-center gap-2 sm:grid-cols-[8rem_1fr]">
                    <Label htmlFor={`opt-img-${index}-${value}`}>{value}</Label>
                    <ImageUrlInput
                      id={`opt-img-${index}-${value}`}
                      value={option.images?.[value] ?? ""}
                      disabled={busy}
                      onChange={(url) => patch(index, { images: { ...option.images, [value]: url } })}
                    />
                  </div>
                ))}
              </div>
            )}
          </div>
        ))}

        {error && <Alert variant="danger">{error}</Alert>}

        {dirty && (
          <div className="flex flex-wrap justify-end gap-2">
            <Button type="button" variant="outline" className="min-h-11" disabled={busy} onClick={() => setOptions(baseline)}>
              {t.discard}
            </Button>
            <Button type="button" className="min-h-11" disabled={busy} onClick={() => void save()}>
              {busy ? t.saving : t.save}
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
