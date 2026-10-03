"use client";

import type { ProductOptionDisplay } from "@store-builder/api-client";
import { useStore } from "@/lib/StoreContext";
import type { ProductOptionGroup } from "@/lib/product";
import { input } from "../ui";
import { productPageText } from "./productPageText";

/**
 * One option of the product ("Size", "اللون"), drawn the way the merchant
 * chose: buttons (the default), a dropdown, colour swatches or pictures. A
 * value with no stock left stays visible, struck through, and cannot be
 * picked.
 */
export function OptionPicker({
  group,
  display,
  selected,
  isAvailable,
  onSelect,
}: {
  group: ProductOptionGroup;
  display: ProductOptionDisplay | undefined;
  selected: string | undefined;
  isAvailable: (value: string) => boolean;
  onSelect: (value: string) => void;
}) {
  const { locale } = useStore();
  const text = productPageText(locale);
  const type = display?.displayType ?? "buttons";

  const legend = (
    <legend className="mb-2 text-sm font-semibold text-ink">
      {group.name}
      {selected && <span className="ms-2 font-normal text-ink-soft">{selected}</span>}
    </legend>
  );

  if (type === "dropdown") {
    return (
      <fieldset>
        {legend}
        <select
          aria-label={text.choose(group.name)}
          value={selected ?? ""}
          onChange={(e) => onSelect(e.target.value)}
          className={`${input} min-h-11 cursor-pointer`}
        >
          {!selected && <option value="">{text.choose(group.name)}</option>}
          {group.values.map((value) => {
            const ok = isAvailable(value);
            return (
              <option key={value} value={value} disabled={!ok}>
                {ok ? value : `${value} — ${text.soldOut}`}
              </option>
            );
          })}
        </select>
      </fieldset>
    );
  }

  return (
    <fieldset>
      {legend}
      <div className="flex flex-wrap gap-2">
        {group.values.map((value) => {
          const isSelected = selected === value;
          const ok = isAvailable(value);
          const common = {
            type: "button" as const,
            "aria-pressed": isSelected,
            "aria-label": ok ? value : `${value} — ${text.soldOut}`,
            title: value,
            disabled: !ok,
            onClick: () => onSelect(value),
          };
          const ring = isSelected ? "border-primary ring-2 ring-primary/30" : "border-line hover:border-primary";
          const off = ok ? "cursor-pointer" : "cursor-not-allowed opacity-50";

          const color = type === "color" ? display?.swatches?.[value] : undefined;
          if (color) {
            return (
              <button
                key={value}
                {...common}
                className={`relative h-11 w-11 rounded-full border-2 p-0.5 transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary ${ring} ${off}`}
              >
                <span className="block h-full w-full rounded-full border border-black/10" style={{ backgroundColor: color }} />
                {!ok && <span aria-hidden className="absolute inset-x-1 top-1/2 h-0.5 -rotate-45 bg-ink-soft" />}
              </button>
            );
          }

          const image = type === "image" ? display?.images?.[value] : undefined;
          if (image) {
            return (
              <button
                key={value}
                {...common}
                className={`relative w-20 overflow-hidden rounded-xl border-2 bg-paper-raised text-xs font-medium text-ink transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary ${ring} ${off}`}
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={image} alt="" loading="lazy" className="aspect-square w-full object-cover" />
                <span className={`block truncate px-1 py-1 ${ok ? "" : "line-through"}`}>{value}</span>
              </button>
            );
          }

          return (
            <button
              key={value}
              {...common}
              className={`min-h-11 min-w-11 rounded-xl border-2 px-4 text-sm font-medium transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary ${
                isSelected
                  ? "border-primary bg-primary-soft text-primary"
                  : "border-line bg-paper-raised text-ink hover:border-primary"
              } ${ok ? "cursor-pointer" : "cursor-not-allowed text-ink-soft line-through decoration-1 opacity-60"}`}
            >
              {value}
            </button>
          );
        })}
      </div>
    </fieldset>
  );
}
