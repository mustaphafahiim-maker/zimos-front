import { Card, CardContent, cn } from "@store-builder/ui";
import type { Order } from "@store-builder/api-client";
import { formatAddress, formatMoney, formatOptions } from "@/lib/format";
import { useT, type Messages } from "@/i18n/LocaleContext";
import { useEnumLabel } from "../orderLabels";

const STRINGS = {
  en: {
    items: "Items",
    product: "Product",
    qty: "Qty",
    unitPrice: "Unit price",
    lineTotal: "Line total",
    offer: "Offer:",
    sku: "SKU:",
    subtotal: "Subtotal",
    discount: "Discount",
    shipping: "Shipping",
    tax: "Tax",
    total: "Total",
    paid: "Paid",
    refunded: "Refunded",
    customer: "Customer",
    alt: "Alt:",
    shippingAddress: "Shipping address",
    note: "Note:",
    payment: "Payment",
    internalNotes: "Internal notes",
    riskFlags: "Risk flags",
  },
  ar: {
    items: "المنتجات",
    product: "المنتج",
    qty: "الكمية",
    unitPrice: "سعر الوحدة",
    lineTotal: "الإجمالي",
    offer: "العرض:",
    sku: "SKU:",
    subtotal: "المجموع الفرعي",
    discount: "الخصم",
    shipping: "الشحن",
    tax: "الضريبة",
    total: "الإجمالي",
    paid: "المدفوع",
    refunded: "المُسترد",
    customer: "العميل",
    alt: "رقم بديل:",
    shippingAddress: "عنوان الشحن",
    note: "ملاحظة:",
    payment: "الدفع",
    internalNotes: "ملاحظات داخلية",
    riskFlags: "تنبيهات المخاطر",
  },
} satisfies Messages;

function AmountRow({ label, value, strong }: { label: string; value: string; strong?: boolean }) {
  return (
    <div className={cn("flex justify-between gap-3", strong ? "font-medium text-ink" : "text-ink-soft")}>
      <span>{label}</span>
      <bdi className="tabular-nums">{value}</bdi>
    </div>
  );
}

export function OrderSummary({ order }: { order: Order }) {
  const t = useT(STRINGS);
  const label = useEnumLabel();
  const c = order.currency;

  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_320px]">
      {/* Items — every field is the snapshot taken at purchase, not live catalog data. */}
      <Card className="min-w-0 rounded-2xl">
        <CardContent className="pt-6">
          <h2 className="mb-3 font-display text-lg font-semibold text-ink">{t.items}</h2>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[480px] text-sm">
              <thead>
                <tr className="border-b border-line text-xs uppercase tracking-wide text-ink-soft">
                  <th className="py-2 pe-3 text-start font-medium">{t.product}</th>
                  <th className="py-2 pe-3 text-end font-medium">{t.qty}</th>
                  <th className="py-2 pe-3 text-end font-medium">{t.unitPrice}</th>
                  <th className="py-2 text-end font-medium">{t.lineTotal}</th>
                </tr>
              </thead>
              <tbody>
                {order.items.map((item) => (
                  <tr key={item.id} className="border-b border-line align-top last:border-0">
                    <td className="py-2 pe-3 text-start">
                      <div className="font-medium text-ink">{item.productNameSnapshot}</div>
                      {formatOptions(item.variantOptionsSnapshot) && (
                        <div className="text-xs text-ink-soft">
                          {formatOptions(item.variantOptionsSnapshot)}
                        </div>
                      )}
                      {item.offerNameSnapshot && (
                        <div className="text-xs text-ink-soft">
                          {t.offer} {item.offerNameSnapshot}
                        </div>
                      )}
                      {item.skuSnapshot && (
                        <div className="text-xs text-ink-soft">
                          {t.sku} <span dir="ltr">{item.skuSnapshot}</span>
                        </div>
                      )}
                    </td>
                    <td className="py-2 pe-3 text-end tabular-nums text-ink-soft">{item.quantity}</td>
                    <td className="py-2 pe-3 text-end tabular-nums text-ink-soft">
                      <bdi>{formatMoney(item.unitPriceAmount, c)}</bdi>
                    </td>
                    <td className="py-2 text-end tabular-nums text-ink-soft">
                      <bdi>{formatMoney(item.lineTotalAmount, c)}</bdi>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="mt-4 space-y-1 border-t border-line pt-3 text-sm">
            <AmountRow label={t.subtotal} value={formatMoney(order.subtotalAmount, c)} />
            {Number(order.discountAmount) > 0 && (
              <AmountRow label={t.discount} value={`− ${formatMoney(order.discountAmount, c)}`} />
            )}
            <AmountRow label={t.shipping} value={formatMoney(order.shippingAmount, c)} />
            <AmountRow label={t.tax} value={formatMoney(order.taxAmount, c)} />
            <AmountRow label={t.total} value={formatMoney(order.totalAmount, c)} strong />
            {Number(order.amountPaid) > 0 && (
              <AmountRow label={t.paid} value={formatMoney(order.amountPaid, c)} />
            )}
            {Number(order.amountRefunded) > 0 && (
              <AmountRow label={t.refunded} value={formatMoney(order.amountRefunded, c)} />
            )}
          </div>
        </CardContent>
      </Card>

      <Card className="min-w-0 rounded-2xl">
        <CardContent className="space-y-4 pt-6 text-sm">
          <div>
            <h3 className="mb-1 font-medium text-ink">{t.customer}</h3>
            <p className="text-ink-soft">{order.contactSnapshot?.fullName || "—"}</p>
            <p className="text-ink-soft">
              {order.contactSnapshot?.phone ? <span dir="ltr">{order.contactSnapshot.phone}</span> : "—"}
            </p>
            {order.contactSnapshot?.alternatePhone && (
              <p className="text-ink-soft">
                {t.alt} <span dir="ltr">{order.contactSnapshot.alternatePhone}</span>
              </p>
            )}
            {order.contactSnapshot?.email && (
              <p className="break-all text-ink-soft">
                <span dir="ltr">{order.contactSnapshot.email}</span>
              </p>
            )}
          </div>
          <div>
            <h3 className="mb-1 font-medium text-ink">{t.shippingAddress}</h3>
            <p className="text-ink-soft">{formatAddress(order.shippingAddressSnapshot)}</p>
            {order.shippingAddressSnapshot?.notes && (
              <p className="text-ink-soft">
                {t.note} {order.shippingAddressSnapshot.notes}
              </p>
            )}
          </div>
          <div>
            <h3 className="mb-1 font-medium text-ink">{t.payment}</h3>
            <p className="text-ink-soft">{label(order.paymentMethod)}</p>
          </div>
          {order.notes && (
            <div>
              <h3 className="mb-1 font-medium text-ink">{t.internalNotes}</h3>
              <p className="whitespace-pre-wrap text-ink-soft">{order.notes}</p>
            </div>
          )}
          {order.riskFlags.length > 0 && (
            <div>
              <h3 className="mb-1 font-medium text-danger">{t.riskFlags}</h3>
              <p className="text-ink-soft">{order.riskFlags.map(label).join("، ")}</p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
