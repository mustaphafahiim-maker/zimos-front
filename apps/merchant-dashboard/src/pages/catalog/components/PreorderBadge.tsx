import { productPreorderOf, productPreorderedUnits } from "@store-builder/api-client";
import { fmt, useT, type Messages } from "@/i18n/LocaleContext";
import { ProductFlag } from "../list/ProductFlag";

const STRINGS = {
  en: { on: "Pre-orders on", owed: "Pre-ordered: {n}" },
  ar: { on: "طلب مسبق", owed: "طُلب مسبقًا: {n}" },
} satisfies Messages;

/**
 * Products list: a product taking pre-orders (handoff 195), read from the
 * list's own product (its saved `preorder` and the variants' stock), and
 * the units sold beyond stock while some are still owed. One of the small
 * chips beside a product (list/ProductFlag.tsx): amber while units are owed.
 */
export function PreorderBadge({ product, className }: { product: unknown; className?: string }) {
  const t = useT(STRINGS);
  if (!productPreorderOf(product)) return null;
  const owed = productPreorderedUnits(product);
  return (
    <ProductFlag tone={owed > 0 ? "attention" : "info"} className={className}>
      {owed > 0 ? fmt(t.owed, { n: owed }) : t.on}
    </ProductFlag>
  );
}
