import { productPreorderOf, productPreorderedUnits } from "@store-builder/api-client";
import { fmt, useT, type Messages } from "@/i18n/LocaleContext";
import { StatusBadge } from "@/components/StatusBadge";

const STRINGS = {
  en: { on: "Pre-orders on", owed: "Pre-ordered: {n}" },
  ar: { on: "طلب مسبق", owed: "اتطلب مسبقًا: {n}" },
} satisfies Messages;

/**
 * Products list: a product taking pre-orders (handoff 195), read from the
 * list's own product (its saved `preorder` and the variants' stock), and
 * the units sold beyond stock while some are still owed.
 */
export function PreorderBadge({ product }: { product: unknown }) {
  const t = useT(STRINGS);
  if (!productPreorderOf(product)) return null;
  const owed = productPreorderedUnits(product);
  return <StatusBadge value="preorder" tone={owed > 0 ? "warning" : "info"} text={owed > 0 ? fmt(t.owed, { n: owed }) : t.on} className="ms-1.5" />;
}
