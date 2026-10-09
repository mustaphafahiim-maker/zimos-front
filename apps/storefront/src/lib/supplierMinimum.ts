import { belowSupplierMinimum } from "@store-builder/api-client";
import { parseLocale, pickText, type Locale } from "./i18n";

/*
 * A dropshipping supplier's minimum order in the shopper's words (handoff
 * 263). The cart and the checkout say how much is missing
 * (components/checkout/SupplierMinimum.tsx); every other order form — a
 * product page's own form, a funnel — gets the plain sentence for a refused
 * order (422 BELOW_SUPPLIER_MINIMUM), whose English message would otherwise
 * be replaced by "something went wrong" on an Arabic page.
 */

export const SUPPLIER_MINIMUM_TEXT = {
  en: {
    below: (missing: string) => `The order is below the supplier's minimum — add ${missing} more`,
    belowPlain: "The order is below the supplier's minimum. Add more of its products to order.",
  },
  ar: {
    below: (missing: string) => `الطلب أقل من الحد الأدنى للمورّد — ضيف بـ ${missing} كمان`,
    belowPlain: "الطلب أقل من الحد الأدنى للمورّد. ضيف منتجات كمان عشان تطلب.",
  },
  fr: {
    below: (missing: string) => `La commande est inférieure au minimum du fournisseur — ajoutez encore ${missing}`,
    belowPlain: "La commande est inférieure au minimum du fournisseur. Ajoutez d'autres produits pour commander.",
  },
};

/** The banner for an order refused below a supplier's minimum; null for any other failure. */
export function supplierMinimumRefusal(err: unknown, locale?: Locale): string | null {
  if (!belowSupplierMinimum(err)) return null;
  const language = locale ?? (typeof document !== "undefined" ? parseLocale(document.documentElement.lang) : null) ?? "ar";
  return pickText(SUPPLIER_MINIMUM_TEXT, language).belowPlain;
}
