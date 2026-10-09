import { orderBusinessOf, type Order } from "@store-builder/api-client";
import { useT } from "@/i18n/LocaleContext";
import { StatusBadge } from "@/components/StatusBadge";
import { B2B_STRINGS } from "./b2bStrings";

/**
 * Under the customer on the order page (handoff 228): the company and tax ID
 * the order was placed with, and «معفى من الضريبة» when no tax was added —
 * read from the order's own contact snapshot, so a later change to the
 * customer does not rewrite an old order. Nothing for an order without them.
 */
export function OrderBusinessLines({ order }: { order: Order }) {
  const t = useT(B2B_STRINGS);
  const business = orderBusinessOf(order);
  if (!business) return null;
  return (
    <>
      {business.company && (
        <p className="text-ink-soft">
          {t.orderCompany}: <bdi className="text-ink">{business.company}</bdi>
        </p>
      )}
      {business.taxId && (
        <p className="text-ink-soft">
          {t.orderTaxId}:{" "}
          <bdi dir="ltr" className="text-ink">
            {business.taxId}
          </bdi>
        </p>
      )}
      {business.taxExempt && (
        <p className="mt-1">
          <StatusBadge value="tax_exempt" tone="info" text={t.orderTaxExempt} />
        </p>
      )}
    </>
  );
}
