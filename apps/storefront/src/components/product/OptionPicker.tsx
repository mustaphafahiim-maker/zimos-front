"use client";

import type { ReactNode } from "react";
import type { ProductOptionDisplay, ProductOptionLabel } from "@store-builder/api-client";
import { useStore } from "@/lib/StoreContext";
import type { ProductOptionGroup } from "@/lib/product";
import { CheckIcon } from "../Icons";
import { focusRing, input } from "../ui";
import { productPageText } from "./productPageText";

/**
 * A value as a chip a thumb can't miss: 48px tall, 16px text, on the theme's
 * chip hook (`zt-pill`: the corners follow the store's theme). Chosen reads by
 * border, tint and text together; one with no stock left is dashed and struck
 * through — and still pressable, as it always was.
 */
const chip = (selected: boolean, available: boolean) =>
  `zt-pill inline-flex min-h-12 min-w-12 cursor-pointer items-center justify-center rounded-xl border-2 px-4 text-base font-medium transition-colors ${focusRing} ${
    selected
      ? "border-primary bg-primary-soft text-primary"
      : available
        ? "border-line bg-paper-raised text-ink hover:border-primary"
        : "border-line-strong bg-paper text-ink-soft hover:border-primary"
  }${available ? "" : " border-dashed line-through decoration-1"}`;

/** The tick on a chosen swatch or picture: the choice does not hang on a colour alone. */
function ChosenMark() {
  return (
    <span
      aria-hidden
      className="absolute -end-1 -top-1 z-[1] flex h-4 w-4 items-center justify-center rounded-full bg-primary text-on-primary shadow-sm"
    >
      <CheckIcon size={10} />
    </span>
  );
}

/**
 * One option of the product ("Size", "اللون"), drawn the way the merchant
 * chose: buttons (the default), a dropdown, colour swatches or pictures. A
 * value with no stock left stays visible, struck through, and can still be
 * picked. In a language the merchant translated the option into, its name
 * and values are shown from `labels` (backend translations/moreTexts.js);
 * the values themselves stay what the variants and swatches are keyed by.
 *
 * `aside` sits at the end of the option's own title row (the size guide's
 * link): it is laid over that row, so when it turns up late nothing under it
 * moves.
 */
export function OptionPicker({
  group,
  display,
  selected,
  isAvailable,
  onSelect,
  labels,
  aside,
}: {
  group: ProductOptionGroup;
  labels?: ProductOptionLabel;
  display: ProductOptionDisplay | undefined;
  selected: string | undefined;
  isAvailable: (value: string) => boolean;
  onSelect: (value: string) => void;
  aside?: ReactNode;
}) {
  const { locale } = useStore();
  const text = productPageText(locale);
  const type = display?.displayType ?? "buttons";
  const name = labels?.name || group.name;
  const show = (value: string) => labels?.values?.[value] || value;

  const legend = (
    // Room is kept at the row's end for `aside`, so a long name never runs under it.
    <legend className={`mb-2 text-sm font-semibold text-ink${aside ? " pe-36" : ""}`}>
      {name}
      {selected && <span className="ms-2 font-normal text-ink-soft">{show(selected)}</span>}
    </legend>
  );
  // 44px to press, drawn on the title's own line. It is placed against a
  // plain box around the fieldset, not against the fieldset itself (browsers
  // do not agree on where a fieldset's inside starts under its legend).
  const corner = aside ? <div className="absolute -top-[22px] end-0 z-[1]">{aside}</div> : null;

  if (type === "dropdown") {
    return (
      <div className="relative min-w-0">
        {corner}
      <fieldset className="min-w-0">
        {legend}
        <select
          aria-label={text.choose(name)}
          value={selected ?? ""}
          onChange={(e) => onSelect(e.target.value)}
          className={`${input} min-h-11 cursor-pointer`}
        >
          {!selected && <option value="">{text.choose(name)}</option>}
          {group.values.map((value) => {
            const ok = isAvailable(value);
            return (
              <option key={value} value={value}>
                {ok ? show(value) : `${show(value)} — ${text.soldOut}`}
              </option>
            );
          })}
        </select>
      </fieldset>
      </div>
    );
  }

  return (
    <div className="relative min-w-0">
      {corner}
    <fieldset className="min-w-0">
      {legend}
      <div className={`flex flex-wrap ${type === "color" ? "gap-3" : "gap-2"}`}>
        {group.values.map((value) => {
          const isSelected = selected === value;
          const ok = isAvailable(value);
          const common = {
            type: "button" as const,
            "aria-pressed": isSelected,
            "aria-label": ok ? show(value) : `${show(value)} — ${text.soldOut}`,
            title: show(value),
            onClick: () => onSelect(value),
          };

          const color = type === "color" ? display?.swatches?.[value] : undefined;
          if (color) {
            return (
              <button
                key={value}
                {...common}
                className={`relative h-11 w-11 cursor-pointer rounded-full border-2 p-0.5 transition-colors ${focusRing} ${
                  isSelected
                    ? "border-primary ring-2 ring-primary ring-offset-2 ring-offset-paper"
                    : "border-line hover:border-primary"
                }`}
              >
                <span
                  className={`block h-full w-full rounded-full border border-black/10${ok ? "" : " opacity-50"}`}
                  style={{ backgroundColor: color }}
                />
                {!ok && <span aria-hidden className="absolute inset-x-1 top-1/2 h-0.5 -rotate-45 bg-ink-soft" />}
                {isSelected && <ChosenMark />}
              </button>
            );
          }

          const image = type === "image" ? display?.images?.[value] : undefined;
          if (image) {
            return (
              <button
                key={value}
                {...common}
                className={`relative w-20 rounded-xl border-2 bg-paper-raised text-sm font-medium text-ink transition-colors ${focusRing} ${
                  isSelected ? "border-primary ring-2 ring-primary/30" : "border-line hover:border-primary"
                }`}
              >
                <span className={`block overflow-hidden rounded-[0.625rem]${ok ? "" : " opacity-50"}`}>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={image} alt="" width={80} height={80} loading="lazy" decoding="async" className="aspect-square w-full object-cover" />
                  <span className={`block truncate px-1 py-1.5 ${ok ? "" : "line-through"}`}>{show(value)}</span>
                </span>
                {isSelected && <ChosenMark />}
              </button>
            );
          }

          return (
            <button key={value} {...common} className={chip(isSelected, ok)}>
              {show(value)}
            </button>
          );
        })}
      </div>
    </fieldset>
    </div>
  );
}
