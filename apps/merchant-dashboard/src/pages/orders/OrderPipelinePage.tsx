import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { AlertTriangle, Search } from "lucide-react";
import type { Order, PaymentMethod } from "@store-builder/api-client";
import { Badge, Input, cn } from "@store-builder/ui";
import { apiClient } from "@/lib/apiClient";
import { useWorkspaceId } from "@/lib/useWorkspaceId";
import { useAsync } from "@/lib/useAsync";
import { formatMoney, humanize } from "@/lib/format";
import { DEMO_PRODUCTS } from "@/mock/seed";
import { PageHeader } from "@/components/PageHeader";
import { DataState } from "@/components/DataState";
import { StatusBadge } from "@/components/StatusBadge";
import { Select } from "@/components/Select";

type ColumnKey = "new" | "awaiting" | "confirmed" | "shipped" | "cancelled" | "returned";

const COLUMNS: Array<{ key: ColumnKey; label: string; accent: string }> = [
  { key: "new", label: "New", accent: "bg-ink-soft" },
  { key: "awaiting", label: "Awaiting confirmation", accent: "bg-accent" },
  { key: "confirmed", label: "Confirmed", accent: "bg-primary" },
  { key: "shipped", label: "Shipped", accent: "bg-primary-dark" },
  { key: "cancelled", label: "Cancelled / Rejected", accent: "bg-danger" },
  { key: "returned", label: "Returned", accent: "bg-danger" },
];

const PAYMENT_METHODS: PaymentMethod[] = ["cod", "card", "wallet", "bank_transfer"];

function columnOf(o: Order): ColumnKey {
  if (o.cancelledAt || o.confirmationState === "rejected") return "cancelled";
  if (o.fulfillmentState === "returned") return "returned";
  if (o.fulfillmentState === "fulfilled" || o.fulfillmentState === "partially_fulfilled") return "shipped";
  if (o.confirmationState === "confirmed") return "confirmed";
  if (o.confirmationState === "pending" && o.riskFlags.length === 0) return "new";
  return "awaiting";
}

function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1) return "just now";
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  const d = Math.floor(h / 24);
  return `${d}d ago`;
}

// ------------------------------------------------------------ demo data --

const DEMO_NAMES = ["أحمد محمود", "سارة علي", "محمد حسن", "منى إبراهيم", "خالد عبدالله", "نورهان سمير", "يوسف كمال", "هبة فتحي"];

interface DemoShape {
  confirmationState: Order["confirmationState"];
  fulfillmentState: Order["fulfillmentState"];
  cancelled: boolean;
  risk: string[];
}

const DEMO_SHAPES: DemoShape[] = [
  { confirmationState: "pending", fulfillmentState: "unfulfilled", cancelled: false, risk: [] },
  { confirmationState: "pending", fulfillmentState: "unfulfilled", cancelled: false, risk: [] },
  { confirmationState: "pending", fulfillmentState: "unfulfilled", cancelled: false, risk: [] },
  { confirmationState: "pending", fulfillmentState: "unfulfilled", cancelled: false, risk: ["duplicate_order_window"] },
  { confirmationState: "postponed", fulfillmentState: "unfulfilled", cancelled: false, risk: [] },
  { confirmationState: "unreachable", fulfillmentState: "unfulfilled", cancelled: false, risk: [] },
  { confirmationState: "pending", fulfillmentState: "unfulfilled", cancelled: false, risk: ["max_orders_per_phone_per_day"] },
  { confirmationState: "confirmed", fulfillmentState: "unfulfilled", cancelled: false, risk: [] },
  { confirmationState: "confirmed", fulfillmentState: "unfulfilled", cancelled: false, risk: [] },
  { confirmationState: "confirmed", fulfillmentState: "unfulfilled", cancelled: false, risk: [] },
  { confirmationState: "confirmed", fulfillmentState: "fulfilled", cancelled: false, risk: [] },
  { confirmationState: "confirmed", fulfillmentState: "fulfilled", cancelled: false, risk: [] },
  { confirmationState: "confirmed", fulfillmentState: "partially_fulfilled", cancelled: false, risk: [] },
  { confirmationState: "confirmed", fulfillmentState: "fulfilled", cancelled: false, risk: [] },
  { confirmationState: "rejected", fulfillmentState: "unfulfilled", cancelled: false, risk: [] },
  { confirmationState: "confirmed", fulfillmentState: "unfulfilled", cancelled: true, risk: [] },
  { confirmationState: "confirmed", fulfillmentState: "returned", cancelled: false, risk: [] },
  { confirmationState: "confirmed", fulfillmentState: "returned", cancelled: false, risk: [] },
];

function buildDemoOrders(workspaceId: string): Order[] {
  const now = Date.now();
  return DEMO_SHAPES.map((s, i) => {
    const product = DEMO_PRODUCTS[i % DEMO_PRODUCTS.length];
    const qty = 1 + (i % 2);
    const subtotal = product.price * qty;
    const shipping = 5000;
    const total = subtotal + shipping;
    const createdAt = new Date(now - (i * 3 + 1) * 3600 * 1000).toISOString();
    const id = `demo-${i + 1}`;
    return {
      id,
      workspaceId,
      websiteId: null,
      funnelId: i % 3 === 0 ? "fn-1" : null,
      customerId: `demo-c-${i}`,
      orderNumber: `#10${500 + i}`,
      confirmationState: s.confirmationState,
      financialState: s.fulfillmentState === "fulfilled" ? "paid" : "pending",
      fulfillmentState: s.fulfillmentState,
      paymentMethod: i % 5 === 0 ? "card" : "cod",
      currency: "EGP",
      subtotalAmount: String(subtotal),
      discountAmount: "0",
      shippingAmount: String(shipping),
      taxAmount: "0",
      totalAmount: String(total),
      amountPaid: s.fulfillmentState === "fulfilled" ? String(total) : "0",
      amountRefunded: "0",
      contactSnapshot: { fullName: DEMO_NAMES[i % DEMO_NAMES.length], phone: `010${String(12345678 + i * 97).slice(0, 8)}` },
      shippingAddressSnapshot: { country: "EG", city: "القاهرة" },
      discountsSnapshot: [],
      notes: null,
      riskFlags: s.risk,
      cancelledAt: s.cancelled ? createdAt : null,
      cancellationReason: s.cancelled ? "Customer changed mind" : null,
      linkedFromOrderId: null,
      createdAt,
      updatedAt: createdAt,
      items: [
        {
          id: `${id}-item`,
          orderId: id,
          productId: product.id,
          variantId: null,
          offerId: null,
          productNameSnapshot: product.name,
          variantOptionsSnapshot: null,
          skuSnapshot: null,
          offerNameSnapshot: null,
          quantity: qty,
          unitPriceAmount: String(product.price),
          unitCostAmount: null,
          lineDiscountAmount: "0",
          lineTotalAmount: String(subtotal),
          isOrderBump: false,
          isUpsell: false,
          createdAt,
          updatedAt: createdAt,
        },
      ],
    };
  });
}

// ------------------------------------------------------------------ page --

export function OrderPipelinePage() {
  const workspaceId = useWorkspaceId();
  const [search, setSearch] = useState("");
  const [payment, setPayment] = useState<PaymentMethod | "">("");

  const orders = useAsync<{ list: Order[]; demo: boolean }>(
    async () => {
      try {
        const r = await apiClient.listOrders(workspaceId, { limit: 100 });
        if (r.orders.length > 0) return { list: r.orders, demo: false };
      } catch {
        /* fall through to demo */
      }
      return { list: buildDemoOrders(workspaceId), demo: true };
    },
    [workspaceId]
  );

  const filtered = useMemo(() => {
    const list = orders.data?.list ?? [];
    const q = search.trim().toLowerCase();
    return list.filter((o) => {
      if (payment && o.paymentMethod !== payment) return false;
      if (!q) return true;
      const name = (o.contactSnapshot.fullName ?? "").toLowerCase();
      const phone = o.contactSnapshot.phone ?? "";
      return o.orderNumber.toLowerCase().includes(q) || name.includes(q) || phone.includes(q);
    });
  }, [orders.data, search, payment]);

  const grouped = useMemo(() => {
    const map: Record<ColumnKey, Order[]> = { new: [], awaiting: [], confirmed: [], shipped: [], cancelled: [], returned: [] };
    for (const o of filtered) map[columnOf(o)].push(o);
    return map;
  }, [filtered]);

  const currency = orders.data?.list[0]?.currency ?? "EGP";

  return (
    <div>
      <PageHeader
        title="Order pipeline"
        titleBadge={orders.data?.demo ? <Badge variant="outline">Demo data</Badge> : undefined}
        description="Every open order by stage — from new to delivered, cancelled or returned."
        actions={
          <Link to="/orders" className="text-sm text-primary hover:underline">
            List view
          </Link>
        }
      />

      <div className="mb-4 grid gap-3 sm:grid-cols-[1fr_220px]">
        <div className="relative">
          <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-ink-soft" />
          <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search order number, customer or phone" className="pl-9" />
        </div>
        <Select value={payment} onChange={(e) => setPayment(e.target.value as PaymentMethod | "")}>
          <option value="">Any payment method</option>
          {PAYMENT_METHODS.map((m) => (
            <option key={m} value={m}>
              {humanize(m)}
            </option>
          ))}
        </Select>
      </div>

      <DataState loading={orders.loading} error={orders.error} onRetry={() => orders.refresh()}>
        <div className="overflow-x-auto pb-4">
          <div className="flex min-w-max gap-4">
            {COLUMNS.map((col) => {
              const items = grouped[col.key];
              const sum = items.reduce((acc, o) => acc + Number(o.totalAmount), 0);
              return (
                <section key={col.key} className="flex w-72 shrink-0 flex-col rounded-[var(--radius-card)] border border-line bg-paper">
                  <header className="border-b border-line px-3 py-2.5">
                    <div className="flex items-center gap-2">
                      <span className={cn("size-2 rounded-full", col.accent)} />
                      <h2 className="text-sm font-medium text-ink">{col.label}</h2>
                      <span className="ml-auto rounded-full bg-paper-raised px-2 py-0.5 text-xs tabular-nums text-ink-soft">{items.length}</span>
                    </div>
                    <p className="mt-1 text-xs tabular-nums text-ink-soft">{formatMoney(sum, currency)}</p>
                  </header>
                  <div className="flex flex-col gap-2 p-2">
                    {items.length === 0 ? (
                      <p className="rounded-[0.5rem] border border-dashed border-line px-3 py-6 text-center text-xs text-ink-soft">No orders</p>
                    ) : (
                      items.map((o) => (
                        <article key={o.id} className="rounded-[0.5rem] border border-line bg-paper-raised p-3 transition-colors hover:border-primary/40">
                          <div className="flex items-start justify-between gap-2">
                            <Link to={`/orders/${o.id}`} className="text-sm font-medium text-ink hover:text-primary">
                              {o.orderNumber}
                            </Link>
                            <span className="shrink-0 text-xs text-ink-soft">{timeAgo(o.createdAt)}</span>
                          </div>
                          <p className="mt-0.5 truncate text-sm text-ink-soft">{o.contactSnapshot.fullName || "—"}</p>
                          <p className="mt-1 text-sm font-medium tabular-nums text-ink">{formatMoney(o.totalAmount, o.currency)}</p>
                          <div className="mt-2 flex flex-wrap gap-1">
                            <StatusBadge value={o.paymentMethod} tone="neutral" />
                            {col.key !== "awaiting" && col.key !== "new" && <StatusBadge value={o.confirmationState} />}
                            {(col.key === "shipped" || col.key === "returned") && <StatusBadge value={o.fulfillmentState} />}
                            {o.riskFlags.length > 0 && (
                              <span className="inline-flex items-center gap-1 rounded-full border border-danger/30 bg-danger-soft px-2 py-0.5 text-xs font-medium text-danger">
                                <AlertTriangle className="size-3" /> {o.riskFlags.length} flag{o.riskFlags.length > 1 ? "s" : ""}
                              </span>
                            )}
                          </div>
                        </article>
                      ))
                    )}
                  </div>
                </section>
              );
            })}
          </div>
        </div>
      </DataState>
    </div>
  );
}
