import { Card } from "@store-builder/ui";
import type { Order, OrderItem } from "@store-builder/api-client";
import { DataTable } from "@/components/DataTable";
import { Section } from "@/components/Section";
import { formatAddress, formatMoney, formatOptions, humanize } from "@/lib/format";

function AmountRow({ label, value, strong }: { label: string; value: string; strong?: boolean }) {
  return (
    <div className={"flex justify-between " + (strong ? "text-ink font-medium" : "text-ink-soft")}>
      <span>{label}</span>
      <span className="tabular-nums">{value}</span>
    </div>
  );
}

function Detail({ title, children, danger }: { title: string; children: React.ReactNode; danger?: boolean }) {
  return (
    <div>
      <h3 className={"mb-1 font-medium " + (danger ? "text-danger" : "text-ink")}>{title}</h3>
      {children}
    </div>
  );
}

export function OrderSummary({ order }: { order: Order }) {
  const c = order.currency;

  return (
    <div className="grid gap-4 lg:grid-cols-[1fr_320px]">
      {/* Items — every field is the snapshot taken at purchase, not live catalog data. */}
      <Section title="Items" flush>
        <DataTable<OrderItem>
          minWidth="30rem"
          rows={order.items}
          rowKey={(item) => item.id}
          columns={[
            {
              key: "product",
              header: "Product",
              cell: (item) => (
                <>
                  <div className="font-medium text-ink">{item.productNameSnapshot}</div>
                  {formatOptions(item.variantOptionsSnapshot) && (
                    <div className="text-xs text-ink-soft">{formatOptions(item.variantOptionsSnapshot)}</div>
                  )}
                  {item.offerNameSnapshot && <div className="text-xs text-ink-soft">Offer: {item.offerNameSnapshot}</div>}
                  {item.skuSnapshot && <div className="text-xs text-ink-soft">SKU: {item.skuSnapshot}</div>}
                </>
              ),
            },
            { key: "qty", header: "Qty", cell: (item) => <span className="tabular-nums text-ink-soft">{item.quantity}</span> },
            {
              key: "unit",
              header: "Unit price",
              cell: (item) => <span className="tabular-nums text-ink-soft">{formatMoney(item.unitPriceAmount, c)}</span>,
            },
            {
              key: "line",
              header: "Line total",
              align: "end",
              cell: (item) => <span className="tabular-nums text-ink-soft">{formatMoney(item.lineTotalAmount, c)}</span>,
            },
          ]}
        />

        <div className="space-y-1 border-t border-line px-4 py-3 text-sm">
          <AmountRow label="Subtotal" value={formatMoney(order.subtotalAmount, c)} />
          {Number(order.discountAmount) > 0 && (
            <AmountRow label="Discount" value={`− ${formatMoney(order.discountAmount, c)}`} />
          )}
          <AmountRow label="Shipping" value={formatMoney(order.shippingAmount, c)} />
          <AmountRow label="Tax" value={formatMoney(order.taxAmount, c)} />
          <AmountRow label="Total" value={formatMoney(order.totalAmount, c)} strong />
          {Number(order.amountPaid) > 0 && <AmountRow label="Paid" value={formatMoney(order.amountPaid, c)} />}
          {Number(order.amountRefunded) > 0 && (
            <AmountRow label="Refunded" value={formatMoney(order.amountRefunded, c)} />
          )}
        </div>
      </Section>

      <Card className="gap-0 space-y-4 p-4 text-sm">
        <Detail title="Customer">
          <p className="text-ink-soft">{order.contactSnapshot?.fullName || "—"}</p>
          <p className="text-ink-soft" dir="ltr">
            {order.contactSnapshot?.phone || "—"}
          </p>
          {order.contactSnapshot?.alternatePhone && (
            <p className="text-ink-soft" dir="ltr">
              Alt: {order.contactSnapshot.alternatePhone}
            </p>
          )}
          {order.contactSnapshot?.email && <p className="text-ink-soft">{order.contactSnapshot.email}</p>}
        </Detail>
        <Detail title="Shipping address">
          <p className="text-ink-soft">{formatAddress(order.shippingAddressSnapshot)}</p>
          {order.shippingAddressSnapshot?.notes && (
            <p className="text-ink-soft">Note: {order.shippingAddressSnapshot.notes}</p>
          )}
        </Detail>
        <Detail title="Payment">
          <p className="text-ink-soft">{humanize(order.paymentMethod)}</p>
        </Detail>
        {order.notes && (
          <Detail title="Internal notes">
            <p className="whitespace-pre-wrap text-ink-soft">{order.notes}</p>
          </Detail>
        )}
        {order.riskFlags.length > 0 && (
          <Detail title="Risk flags" danger>
            <p className="text-ink-soft">{order.riskFlags.map(humanize).join(", ")}</p>
          </Detail>
        )}
      </Card>
    </div>
  );
}
