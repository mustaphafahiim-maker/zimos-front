"use client";

import { productBoxOf, type StorefrontProduct } from "@store-builder/api-client";
import { useStore } from "@/lib/StoreContext";
import { StoreLink } from "@/components/StoreRoute";
import { ArrowIcon, BoxIcon } from "../Icons";
import { focusRing } from "../ui";

/**
 * On a product that belongs to a mix-and-match box (handoff 215): the way to
 * the box page, where the shopper mixes it with the box's other products.
 */
export function BoxBuilderEntry({ product }: { product: StorefrontProduct }) {
  const { t } = useStore();
  const box = productBoxOf(product);
  if (!box) return null;
  return (
    <StoreLink
      href={`/box/${box.id}`}
      className={`flex min-h-14 items-center gap-3 rounded-2xl border-2 border-dashed border-primary bg-primary-soft p-3.5 text-primary transition-colors hover:bg-primary/10 ${focusRing}`}
    >
      <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-paper-raised">
        <BoxIcon size={22} />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block text-sm font-semibold">{t.giftBox.entryTitle}</span>
        {box.name && <span className="block text-xs text-ink-soft">{t.giftBox.entryHint(box.name)}</span>}
      </span>
      <ArrowIcon size={18} className="shrink-0 rtl:rotate-180" />
    </StoreLink>
  );
}
