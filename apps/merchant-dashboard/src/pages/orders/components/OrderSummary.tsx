import { Link } from "react-router-dom";
import { Card, CardContent } from "@store-builder/ui";
import type { Order, ShippingRule } from "@store-builder/api-client";
import { formatMoney, formatOptions } from "@/lib/format";
import { providerName } from "@/lib/providers";
import { fmt, useT, type Messages } from "@/i18n/LocaleContext";
import { useOrderLabels } from "../orderLabels";
import { CustomizationList } from "./CustomizationList";
import { OrderLineThumb } from "./OrderLineThumb";
import { OrderAddressTools, OrderContactTools } from "./OrderCustomerTools";
import { OrderBillingAddress, OrderCheckoutPhotos } from "./OrderCheckoutExtras";
import { OrderConsents } from "./OrderConsents";
import { ShippingOptionNote } from "./ShippingOptionNote";
import { PreorderLineNote } from "./PreorderLineNote";
import { GiftLineBadge } from "./GiftLineBadge";
// Handoff 382: a custom line, a line staff priced themselves, and the staff discount as its own row.
import { OrderDiscountRows, OrderLinePriceNote } from "../staffPricing/OrderStaffPricing";
import { DeliveryEstimateNote } from "./DeliveryEstimateNote";
import { OrderBusinessLines } from "@/pages/b2b/OrderBusinessLines";

const STRINGS = {
  en: {
    items: "Items",
    product: "Product",
    qty: "Qty",
    unitPrice: "Unit price",
    lineTotal: "Line total",
    qtyTimesPrice: "{qty} × {price}",
    offer: "From offer",
    sku: "SKU",
    bumpBadge: "Checkout add-on",
    upsellBadge: "Extra offer",
    linkedOrders: "Extra offers placed as separate orders",
    linkedOrdersHint: "The customer took these funnel offers after this order had left its offers window. They ship free of charge.",
    linkedFrom: "A funnel offer taken after order {order}; its shipping is free.",
    subtotal: "Subtotal",
    discount: "Discount",
    shipping: "Shipping",
    tax: "Tax",
    total: "Total",
    paid: "Paid",
    refunded: "Refunded",
    customer: "Customer",
    altPhone: "Alt",
    shippingAddress: "Shipping address",
    noAddress: "No shipping address",
    note: "Note",
    payment: "Payment",
    internalNotes: "Internal notes",
    riskFlags: "Risk flags",
    cancelUnconfirmedHint:
      "A delivery cancelled in the courier's dashboard still shows as moving there. Check the courier's dashboard; details under Shipments.",
    listSep: ", ",
    rule_no_destination: "No address, so no shipping was charged",
    rule_offer_override: "The offer's own shipping price",
    rule_all_items_free: "Every product in the order ships free",
    rule_free_threshold: "Free: the order reached the free-shipping amount",
    rule_governorate_rate: "The governorate's shipping price",
    rule_profile_rate: "The shipping group's price",
    rule_zone_rate: "Shipping zone rate",
    rule_zone_tier_price: "Zone price for the weight tier",
    rule_default_rate: "Default shipping price",
    rule_no_rate: "No shipping price was set",
    // The store's own city/area price (Shipping → Places, handoff 164).
    rule_store_place_rate: "City/area price",
    ruleExtras: "{rule} + {amount} in product extra fees",
  },
  ar: {
    items: "العناصر",
    product: "المنتج",
    qty: "الكمية",
    unitPrice: "سعر الوحدة",
    lineTotal: "الإجمالي",
    qtyTimesPrice: "{qty} × {price}",
    offer: "من عرض",
    sku: "SKU",
    bumpBadge: "إضافة عند الدفع",
    upsellBadge: "عرض إضافي",
    linkedOrders: "عروض إضافية في طلبات منفصلة",
    linkedOrdersHint: "قبِل العميل هذه العروض من مسار البيع بعد انتهاء نافذة العروض لهذا الطلب. تُشحن بدون رسوم شحن.",
    linkedFrom: "عرض إضافي من مسار البيع بعد الطلب {order}، وشحنه مجاني.",
    subtotal: "المجموع الفرعي",
    discount: "الخصم",
    shipping: "الشحن",
    tax: "الضريبة",
    total: "الإجمالي",
    paid: "المدفوع",
    refunded: "المسترد",
    customer: "العميل",
    altPhone: "رقم بديل",
    shippingAddress: "عنوان الشحن",
    noAddress: "مفيش عنوان شحن",
    note: "ملاحظة",
    payment: "الدفع",
    internalNotes: "ملاحظات داخلية",
    riskFlags: "علامات الاشتباه",
    cancelUnconfirmedHint:
      "شحنة أُلغيت من لوحة تحكم شركة الشحن ما زالت تظهر كأنها تتحرك هناك. راجع لوحة تحكم الشركة؛ التفاصيل في قسم الشحنات.",
    listSep: "، ",
    rule_no_destination: "مفيش عنوان، لذلك لم يُحتسب شحن",
    rule_offer_override: "سعر الشحن الخاص بالعرض",
    rule_all_items_free: "كل منتجات الطلب مجانية الشحن",
    rule_free_threshold: "مجاني: بلغ الطلب حد الشحن المجاني",
    rule_governorate_rate: "سعر الشحن الخاص بالمحافظة",
    rule_profile_rate: "سعر مجموعة الشحن",
    rule_zone_rate: "سعر منطقة الشحن",
    rule_zone_tier_price: "سعر المنطقة حسب شريحة الوزن",
    rule_default_rate: "سعر الشحن الافتراضي",
    rule_no_rate: "مكانش فيه سعر شحن متحدد",
    rule_store_place_rate: "سعر المدينة/المنطقة",
    ruleExtras: "{rule} + {amount} رسوم إضافية للمنتجات",
  },
} satisfies Messages;

function AmountRow({ label, value, strong }: { label: string; value: string; strong?: boolean }) {
  return (
    <div className={"flex justify-between gap-4 " + (strong ? "text-ink font-medium" : "text-ink-soft")}>
      <span>{label}</span>
      <span>{value}</span>
    </div>
  );
}

export function OrderSummary({
  order,
  onChanged,
  only,
  hideHeroFacts,
}: {
  order: Order;
  onChanged?: () => void;
  /**
   * One part alone and bare — no card, no title — for a caller that frames it
   * itself (the order page): the items, the totals, or the customer block.
   */
  only?: "items" | "totals" | "customer";
  /** With `only="customer"`: leaves out what the page's hero already says (name, phone, address, payment method). */
  hideHeroFacts?: boolean;
}) {
  const t = useT(STRINGS);
  const labels = useOrderLabels();
  const c = order.currency;
  const address = order.shippingAddressSnapshot;
  const addressText = address
    ? [address.addressLine, address.city, address.province, address.postalCode, address.country]
        .filter(Boolean)
        .join(t.listSep)
    : t.noAddress;

  // On a phone quantity and unit price sit under the product name, so the line total stays on screen.
  const itemsTable = (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-line text-start text-xs uppercase tracking-wide text-ink-soft">
            <th scope="col" className="py-2 pe-3 text-start font-medium">
              {t.product}
            </th>
            <th scope="col" className="hidden py-2 pe-3 text-start font-medium sm:table-cell">
              {t.qty}
            </th>
            <th scope="col" className="hidden py-2 pe-3 text-start font-medium sm:table-cell">
              {t.unitPrice}
            </th>
            <th scope="col" className="py-2 font-medium text-end">
              {t.lineTotal}
            </th>
          </tr>
        </thead>
        <tbody>
          {order.items.map((item) => (
            <tr key={item.id} className="border-b border-line last:border-0 align-top">
              <td className="py-2 pe-3">
                <div className="flex items-start gap-3">
                  <OrderLineThumb item={item} className="size-12" />
                  <div className="min-w-0">
                    <div className="font-medium text-ink">{item.productNameSnapshot}</div>
                    {(item.isOrderBump || item.isUpsell) && (
                      <span className="mt-1 inline-flex rounded-full bg-primary-soft px-2 py-0.5 text-xs font-medium text-primary-dark dark:text-primary">
                        {item.isUpsell ? t.upsellBadge : t.bumpBadge}
                      </span>
                    )}
                    {formatOptions(item.variantOptionsSnapshot) && (
                      <div className="text-xs text-ink-soft">
                        {formatOptions(item.variantOptionsSnapshot)}
                      </div>
                    )}
                    {item.offerNameSnapshot && (
                      <div className="text-xs text-ink-soft">
                        {t.offer}: {item.offerNameSnapshot}
                      </div>
                    )}
                    {item.skuSnapshot && (
                      <div className="text-xs text-ink-soft">
                        {t.sku}: <bdi dir="ltr">{item.skuSnapshot}</bdi>
                      </div>
                    )}
                    <div className="text-xs text-ink-soft sm:hidden">
                      {fmt(t.qtyTimesPrice, { qty: item.quantity, price: formatMoney(item.unitPriceAmount, c) })}
                    </div>
                    <CustomizationList customizations={item.customizations} className="mt-2" currency={c} />
                    <PreorderLineNote item={item} />
                    <GiftLineBadge item={item} />
                    <OrderLinePriceNote item={item} currency={c} />
                  </div>
                </div>
              </td>
              <td className="hidden py-2 pe-3 text-ink-soft sm:table-cell">{item.quantity}</td>
              <td className="hidden py-2 pe-3 text-ink-soft sm:table-cell">{formatMoney(item.unitPriceAmount, c)}</td>
              <td className="py-2 text-end whitespace-nowrap text-ink-soft">{formatMoney(item.lineTotalAmount, c)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );

  // On its own the block needs no rule above it: there is no table over it.
  const totals = (
    <div className={only === "totals" ? "space-y-1 text-sm" : "mt-4 space-y-1 border-t border-line pt-3 text-sm"}>
      <AmountRow label={t.subtotal} value={formatMoney(order.subtotalAmount, c)} />
      {/* One row, or the code's discount and the staff's (with its reason) as two (handoff 382). */}
      <OrderDiscountRows order={order} currency={c} label={t.discount} />
      <AmountRow label={t.shipping} value={formatMoney(order.shippingAmount, c)} />
      {order.shippingSnapshot && (
        <p className="text-end text-xs text-ink-soft">
          {order.shippingSnapshot.extraFeesAmount > 0
            ? fmt(t.ruleExtras, {
                rule: t[`rule_${order.shippingSnapshot.rule as ShippingRule}`],
                amount: formatMoney(order.shippingSnapshot.extraFeesAmount, c),
              })
            : t[`rule_${order.shippingSnapshot.rule as ShippingRule}`]}
        </p>
      )}
      <ShippingOptionNote order={order} />
      <DeliveryEstimateNote order={order} />
      <AmountRow label={t.tax} value={formatMoney(order.taxAmount, c)} />
      <AmountRow label={t.total} value={formatMoney(order.totalAmount, c)} strong />
      {Number(order.amountPaid) > 0 && <AmountRow label={t.paid} value={formatMoney(order.amountPaid, c)} />}
      {Number(order.amountRefunded) > 0 && (
        <AmountRow label={t.refunded} value={formatMoney(order.amountRefunded, c)} />
      )}
    </div>
  );

  const linked = (
    <>
      {order.linkedFromOrder && (
        <p className="mt-4 rounded-[0.5rem] bg-paper px-3 py-2 text-sm text-ink-soft">
          {t.linkedFrom.split("{order}")[0]}
          <Link to={`/orders/${order.linkedFromOrder.id}`} className="font-medium text-primary hover:underline">
            <bdi dir="ltr">{order.linkedFromOrder.orderNumber}</bdi>
          </Link>
          {t.linkedFrom.split("{order}")[1]}
        </p>
      )}

      {order.linkedOrders && order.linkedOrders.length > 0 && (
        <section className="mt-4 space-y-2 border-t border-line pt-3" aria-labelledby={`linked-${order.id}`}>
          <h3 id={`linked-${order.id}`} className="text-sm font-medium text-ink">
            {t.linkedOrders}
          </h3>
          <p className="text-xs text-ink-soft">{t.linkedOrdersHint}</p>
          <ul className="space-y-1">
            {order.linkedOrders.map((linkedOrder) => (
              <li key={linkedOrder.id} className="flex items-center justify-between gap-3 text-sm">
                <Link to={`/orders/${linkedOrder.id}`} className="inline-flex min-h-11 items-center font-medium text-primary hover:underline">
                  <bdi dir="ltr">{linkedOrder.orderNumber}</bdi>
                </Link>
                <span className="text-ink-soft">{formatMoney(linkedOrder.totalAmount, linkedOrder.currency)}</span>
              </li>
            ))}
          </ul>
        </section>
      )}
    </>
  );

  const customer = (
    <>
      <div>
        <h3 className="mb-1 font-medium text-ink">{t.customer}</h3>
        {!hideHeroFacts && (
          <>
            <p className="text-ink-soft">{order.contactSnapshot?.fullName || "—"}</p>
            <p className="text-ink-soft">
              {order.contactSnapshot?.phone ? (
                <a href={`tel:${order.contactSnapshot.phone.replace(/[^\d+]/g, "")}`} className="hover:text-primary">
                  <bdi dir="ltr">{order.contactSnapshot.phone}</bdi>
                </a>
              ) : (
                "—"
              )}
            </p>
          </>
        )}
        {order.contactSnapshot?.alternatePhone && (
          <p className="text-ink-soft">
            {t.altPhone}: <bdi dir="ltr">{order.contactSnapshot.alternatePhone}</bdi>
          </p>
        )}
        {order.contactSnapshot?.email && (
          <p className="break-all text-ink-soft">
            <bdi dir="ltr">{order.contactSnapshot.email}</bdi>
          </p>
        )}
        <OrderBusinessLines order={order} />
        <OrderContactTools order={order} onChanged={onChanged} />
        {/* What the buyer agreed to at checkout: marketing, the terms (handoff 374). */}
        <OrderConsents order={order} />
      </div>
      {/* With the address said in the hero, what is left here is its tools and the delivery note. */}
      {(!hideHeroFacts || address) && (
        <div>
          <h3 className="mb-1 font-medium text-ink">{t.shippingAddress}</h3>
          {!hideHeroFacts && <p className="text-ink-soft">{addressText}</p>}
          <OrderAddressTools order={order} />
          {address?.notes && (
            <p className="text-ink-soft">
              {t.note}: {address.notes}
            </p>
          )}
        </div>
      )}
      <OrderBillingAddress order={order} />
      <OrderCheckoutPhotos order={order} />
      {!hideHeroFacts && (
        <div>
          <h3 className="mb-1 font-medium text-ink">{t.payment}</h3>
          <p className="text-ink-soft">
            {labels.paymentMethod(order.paymentMethod)}
            {order.paymentProvider && ` · ${providerName(order.paymentProvider)}`}
          </p>
        </div>
      )}
      {order.notes && (
        <div>
          <h3 className="mb-1 font-medium text-ink">{t.internalNotes}</h3>
          <p className="whitespace-pre-wrap text-ink-soft">{order.notes}</p>
        </div>
      )}
      {order.riskFlags.length > 0 && (
        <div>
          <h3 className="mb-1 font-medium text-danger">{t.riskFlags}</h3>
          <ul className="list-inside list-disc text-ink-soft">
            {order.riskFlags.map((flag) => (
              <li key={flag}>
                {labels.riskFlag(flag)}
                {flag === "carrier_cancel_unconfirmed" && (
                  <span className="block ps-5 text-xs">{t.cancelUnconfirmedHint}</span>
                )}
              </li>
            ))}
          </ul>
        </div>
      )}
    </>
  );

  if (only === "items") {
    return (
      <>
        {itemsTable}
        {linked}
      </>
    );
  }
  if (only === "totals") return totals;
  // One column: on the order page this part sits in a folding section, in the narrow side column from lg up.
  if (only === "customer") return <div className="grid gap-5 text-sm">{customer}</div>;

  return (
    <div className="grid gap-[var(--bento-gap)]">
      {/* Items — every field is the snapshot taken at purchase, not live catalog data. */}
      <Card>
        <CardContent className="pt-6">
          <h2 className="mb-3 font-display text-lg font-medium text-ink">{t.items}</h2>
          {itemsTable}
          {totals}
          {linked}
        </CardContent>
      </Card>

      <Card>
        <CardContent className="grid gap-7 pt-6 text-sm sm:grid-cols-2">{customer}</CardContent>
      </Card>
    </div>
  );
}
