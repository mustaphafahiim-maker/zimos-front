import { IconWarning } from "@/components/icons";
import { cn } from "@store-builder/ui";
import { useT, type Messages } from "@/i18n/LocaleContext";

const STRINGS = {
  en: { warning: "Don't change these SKUs: they link the product to your store" },
  ar: { warning: "متغيرش الـ SKU دي: هي اللي بتربط المنتج بمتجرك" },
} satisfies Messages;

/** The sentence alone, for a field's hint (frontend-handoff 181). */
export function useStoreSkuWarningText(): string {
  return useT(STRINGS).warning;
}

/**
 * A product imported from the merchant's Shopify or WooCommerce store carries
 * that store's variant ids as its SKUs: they are what ties each order line
 * back to the store, so editing one breaks the link. Shown after an import
 * and wherever such a product's variant SKUs can be edited.
 */
export function StoreSkuWarning({ className }: { className?: string }) {
  const text = useStoreSkuWarningText();
  return (
    <p
      role="note"
      className={cn(
        "flex items-start gap-2 rounded-[var(--radius)] bg-accent-soft px-3 py-2.5 text-sm font-medium text-accent-dark",
        className
      )}
    >
      <IconWarning className="mt-0.5 size-4 shrink-0" aria-hidden />
      <span>{text}</span>
    </p>
  );
}
