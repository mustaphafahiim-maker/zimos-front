"use client";

import type { OrderBumpOffer } from "@/lib/offers";
import { useStore } from "@/lib/StoreContext";
import { GiftIcon } from "../Icons";

/** "Add to your order" checkbox card, shown right above the submit button. */
export function OrderBumpCard({
  bump,
  checked,
  onChange,
  idPrefix,
}: {
  bump: OrderBumpOffer;
  checked: boolean;
  onChange: (checked: boolean) => void;
  idPrefix: string;
}) {
  const { t, money } = useStore();
  const id = `${idPrefix}-bump`;

  return (
    <label
      htmlFor={id}
      className={`flex cursor-pointer gap-3 rounded-2xl border-2 border-dashed p-4 transition-colors ${
        checked ? "border-primary bg-primary-soft" : "border-line-strong bg-paper-raised hover:border-primary"
      }`}
    >
      <input
        id={id}
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        className="mt-1 h-5 w-5 shrink-0 cursor-pointer accent-primary"
      />
      {bump.imageUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={bump.imageUrl}
          alt=""
          width={64}
          height={64}
          loading="lazy"
          className="h-16 w-16 shrink-0 rounded-xl border border-line object-cover"
        />
      ) : (
        <span className="flex h-16 w-16 shrink-0 items-center justify-center rounded-xl bg-primary-soft text-primary">
          <GiftIcon size={28} />
        </span>
      )}
      <span className="min-w-0 flex-1">
        <span className="block text-xs font-semibold uppercase tracking-wide text-primary">{t.bump.title}</span>
        <span className="mt-0.5 block text-sm font-semibold text-ink">{bump.name}</span>
        {bump.description && (
          <span className="mt-0.5 line-clamp-2 block text-xs text-ink-soft">{bump.description}</span>
        )}
        <span className="mt-1.5 flex flex-wrap items-baseline gap-x-2">
          <span className="text-sm font-bold text-ink">{t.bump.only(money(bump.priceAmount))}</span>
        </span>
      </span>
    </label>
  );
}
