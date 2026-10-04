"use client";

import { useEffect, useState } from "react";
import type { StorefrontVariant } from "@store-builder/api-client";
import { useStore } from "@/lib/StoreContext";
import { findVariant, optionGroups } from "@/lib/product";
import { readPick, writePick } from "@/lib/pagePicks";
import { focusRing } from "../ui";

/** A big picture and its thumbnails; a thumbnail shows its picture. */
export function GalleryWithThumbs({ images, alt, side }: { images: string[]; alt: string; side: boolean }) {
  const [index, setIndex] = useState(0);
  const current = images[Math.min(index, images.length - 1)];
  return (
    <div className={side ? "flex gap-3" : "space-y-3"}>
      <div className={side ? "order-2 min-w-0 flex-1" : undefined}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={current} alt={alt} className="aspect-square w-full rounded-2xl border border-line object-cover" />
      </div>
      {images.length > 1 && (
        <ul className={side ? "order-1 flex w-20 shrink-0 flex-col gap-2" : "flex gap-2 overflow-x-auto"}>
          {images.map((src, i) => (
            <li key={src + i} className="shrink-0">
              <button
                type="button"
                aria-label={`${alt} ${i + 1}`}
                aria-current={i === index ? "true" : undefined}
                onClick={() => setIndex(i)}
                className={`block size-16 overflow-hidden rounded-xl border-2 ${i === index ? "border-primary" : "border-line"} ${focusRing}`}
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={src} alt="" className="size-full object-cover" />
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

/**
 * The product's options as chips. The pick is remembered for the visit and
 * announced (lib/pagePicks), so the order form on this page and the funnel's
 * checkout start from it.
 */
export function VariantChips({ productId, variants, showPrice }: { productId: string; variants: StorefrontVariant[]; showPrice: boolean }) {
  const { t, money } = useStore();
  const groups = optionGroups(variants);
  const [selection, setSelection] = useState<Record<string, string>>(() => ({ ...((variants.find((v) => v.inStock) ?? variants[0])?.optionValues ?? {}) }));
  // An earlier pick this visit, read after hydration.
  useEffect(() => {
    const picked = variants.find((v) => v.id === readPick("variant", productId));
    if (picked) setSelection({ ...(picked.optionValues ?? {}) });
  }, [productId, variants]);
  const variant = findVariant(variants, selection);

  function choose(name: string, value: string) {
    const next = { ...selection, [name]: value };
    setSelection(next);
    const match = findVariant(variants, next);
    if (match) writePick("variant", productId, match.id);
  }

  if (groups.length === 0) return null;
  return (
    <div className="space-y-3">
      {groups.map((group) => (
        <fieldset key={group.name}>
          <legend className="mb-2 text-sm font-semibold text-ink">{group.name}</legend>
          <div className="flex flex-wrap gap-2">
            {group.values.map((value) => {
              const active = selection[group.name] === value;
              const available = variants.some((v) => v.inStock && v.optionValues?.[group.name] === value);
              return (
                <button
                  key={value}
                  type="button"
                  aria-pressed={active}
                  onClick={() => choose(group.name, value)}
                  className={`min-h-11 rounded-xl border px-4 text-sm font-medium ${focusRing} ${
                    active ? "border-primary bg-primary text-on-primary" : "border-line bg-paper-raised text-ink hover:border-primary"
                  } ${available ? "" : "line-through opacity-60"}`}
                >
                  {value}
                </button>
              );
            })}
          </div>
        </fieldset>
      ))}
      {showPrice && variant && (
        <p className="text-sm text-ink-soft">
          <span className="text-base font-bold text-ink">{money(variant.priceAmount, variant.currency)}</span>
          {" · "}
          {variant.inStock ? t.common.inStock : t.common.outOfStock}
        </p>
      )}
    </div>
  );
}

/** The product's quantity offers to pick from; the pick is what the order form starts from. */
export function BundleChoice({
  productId,
  tiers,
}: {
  productId: string;
  tiers: Array<{ offerId: string; label: string; quantity: number; totalAmount: number; discountPct: number; badge: string | null }>;
}) {
  const { money } = useStore();
  const [picked, setPicked] = useState<string>(tiers[0]?.offerId ?? "");
  useEffect(() => {
    const earlier = readPick("offer", productId);
    if (earlier && tiers.some((t) => t.offerId === earlier)) setPicked(earlier);
  }, [productId, tiers]);
  return (
    <div role="radiogroup" className="grid gap-2">
      {tiers.map((tier) => {
        const active = tier.offerId === picked;
        return (
          <button
            key={tier.offerId}
            type="button"
            role="radio"
            aria-checked={active}
            onClick={() => {
              setPicked(tier.offerId);
              writePick("offer", productId, tier.offerId);
            }}
            className={`flex min-h-11 items-center justify-between gap-3 rounded-xl border px-4 py-3 text-start ${focusRing} ${
              active ? "border-primary bg-primary-soft" : "border-line bg-paper-raised hover:border-primary"
            }`}
          >
            <span className="text-sm font-semibold text-ink" dir="auto">
              {tier.label}
              {tier.badge && <span className="ms-2 rounded-full bg-primary px-2 py-0.5 text-[11px] text-on-primary">{tier.badge}</span>}
            </span>
            <span className="text-end text-sm">
              <span className="block font-bold text-ink">{money(tier.totalAmount)}</span>
              {tier.discountPct > 0 && <span className="text-xs text-success">−{tier.discountPct}%</span>}
            </span>
          </button>
        );
      })}
    </div>
  );
}
