import { type ReactNode } from "react";
import { Link } from "react-router-dom";
import {
  ArrowDownRight,
  ArrowUpRight,
  ClipboardCheck,
  DollarSign,
  Package,
  ShoppingCart,
  Users,
  Wallet,
  Workflow,
} from "lucide-react";
import { Card, cn } from "@store-builder/ui";
import type { Order } from "@store-builder/api-client";
import { useWorkspace } from "@/context/WorkspaceContext";
import { useWorkspaceId } from "@/lib/useWorkspaceId";
import { useAsync } from "@/lib/useAsync";
import { apiClient } from "@/lib/apiClient";
import { formatDateTime, formatMoney, formatPercentValue } from "@/lib/format";
import { deltaBasisPoints, formatCount, percentToRatio, rangeWindows, useAnalyticsSummary } from "@/lib/analytics";
import { StatusBadge } from "@/components/StatusBadge";
import { DataState } from "@/components/DataState";
import { fmt, useT, type Messages } from "@/i18n/LocaleContext";

const STRINGS = {
  en: {
    welcome: "Welcome back{name}",
    subtitle: "The last 30 days, compared to the 30 before.",
    grossSales: "Gross sales",
    orders: "Orders",
    awaiting: "Awaiting confirmation",
    awaitingHint: "Call them from the queue",
    collected: "Cash collected",
    vsPrevious: "vs previous 30 days",
    recentTitle: "Recent orders",
    viewAll: "View all",
    noOrders: "No orders yet — the first one shows up here the moment it comes in.",
    quickTitle: "Quick stats",
    confirmationRate: "Confirmation rate",
    deliveryRate: "Delivery rate",
    conversionRate: "Store conversion rate",
    noSessions: "Turns on with the first store visit",
    topProducts: "Top products",
    noProducts: "Nothing sold in the last 30 days.",
    units: "{n} sold",
    funnelsTitle: "Funnels",
    noFunnels: "No funnel sessions in the last 30 days.",
    funnelSessions: "{n} sessions",
    channelStore: "Store",
  },
  ar: {
    welcome: "أهلاً بيك تاني{name}",
    subtitle: "آخر 30 يوم، مقارنة بالـ 30 اللي قبلهم.",
    grossSales: "إجمالي المبيعات",
    orders: "الطلبات",
    awaiting: "مستنية التأكيد",
    awaitingHint: "اتصل بيهم من القائمة",
    collected: "الكاش المحصّل",
    vsPrevious: "مقارنة بالـ 30 يوم اللي قبلهم",
    recentTitle: "آخر الطلبات",
    viewAll: "عرض الكل",
    noOrders: "مفيش طلبات لسه — أول طلب هيظهر هنا أول ما يوصل.",
    quickTitle: "أرقام سريعة",
    confirmationRate: "نسبة التأكيد",
    deliveryRate: "نسبة التوصيل",
    conversionRate: "نسبة تحويل المتجر",
    noSessions: "بتشتغل مع أول زيارة للمتجر",
    topProducts: "أكتر المنتجات مبيعاً",
    noProducts: "مفيش حاجة اتباعت في آخر 30 يوم.",
    units: "اتباع {n}",
    funnelsTitle: "مسارات البيع",
    noFunnels: "مفيش جلسات فانل في آخر 30 يوم.",
    funnelSessions: "{n} جلسة",
    channelStore: "المتجر",
  },
} satisfies Messages;

const TONES = {
  blue: "bg-primary-soft text-primary-dark dark:text-primary",
  green: "bg-success-soft text-success",
  orange: "bg-accent-soft text-accent-dark dark:text-accent",
  violet: "bg-violet-50 text-violet-600 dark:bg-violet-900/20 dark:text-violet-400",
} as const;

function StatCard({
  icon,
  tone,
  label,
  value,
  delta,
  vsLabel,
  hint,
  to,
}: {
  icon: ReactNode;
  tone: keyof typeof TONES;
  label: string;
  value: ReactNode;
  delta?: number | null;
  vsLabel?: string;
  hint?: string;
  to?: string;
}) {
  const up = delta !== null && delta !== undefined && delta > 0;
  const down = delta !== null && delta !== undefined && delta < 0;
  const body = (
    <Card className={cn("h-full gap-0 p-6 transition-shadow", to && "hover:shadow-md")}>
      <div className="mb-4 flex items-center justify-between">
        <div className={cn("rounded-lg p-2 [&>svg]:size-5", TONES[tone])}>{icon}</div>
        {up && <ArrowUpRight className="size-4 text-success" aria-hidden />}
        {down && <ArrowDownRight className="size-4 text-danger" aria-hidden />}
      </div>
      <h3 className="mb-1 text-sm font-medium text-ink-soft">{label}</h3>
      <p className="tabular-nums text-2xl font-bold text-ink">{value}</p>
      {delta !== undefined && delta !== null ? (
        <p className={cn("mt-1 text-sm", up ? "text-success" : down ? "text-danger" : "text-ink-soft")}>
          <bdi dir="ltr">{(up ? "+" : down ? "−" : "") + formatPercentValue(Math.abs(delta) / 10000)}</bdi> {vsLabel}
        </p>
      ) : hint ? (
        <p className="mt-1 text-sm text-ink-soft">{hint}</p>
      ) : null}
    </Card>
  );
  return to ? (
    <Link to={to} className="block rounded-xl">
      {body}
    </Link>
  ) : (
    body
  );
}

function Panel({ title, action, children }: { title: string; action?: ReactNode; children: ReactNode }) {
  return (
    <Card className="gap-0 p-6">
      <div className="mb-5 flex items-center justify-between">
        <h3 className="text-lg font-semibold text-ink">{title}</h3>
        {action}
      </div>
      {children}
    </Card>
  );
}

function Meter({ label, value, tone }: { label: string; value: number | null; tone: "bg-primary" | "bg-success" | "bg-accent" }) {
  return (
    <div>
      <div className="flex items-center justify-between">
        <span className="text-sm text-ink-soft">{label}</span>
        <span className="tabular-nums text-sm font-medium text-ink">
          <bdi dir="ltr">{formatPercentValue(percentToRatio(value))}</bdi>
        </span>
      </div>
      <div className="mt-1.5 h-2 w-full rounded-full bg-paper">
        <div className={cn("h-2 rounded-full", tone)} style={{ width: `${Math.min(100, Math.max(0, value ?? 0))}%` }} />
      </div>
    </div>
  );
}

export function DashboardHomePage() {
  const t = useT(STRINGS);
  const { currentWorkspace } = useWorkspace();
  const workspaceId = useWorkspaceId();

  const summary = useAnalyticsSummary(workspaceId, "30d");
  const extra = useAsync(
    () =>
      Promise.all([
        apiClient.getOrderCounts(workspaceId, { cancelled: false }),
        apiClient.listOrders(workspaceId, { sort: "newest", limit: 6, cancelled: false }),
        apiClient.getFunnelAnalytics(workspaceId, rangeWindows("30d").current).catch(() => null),
      ]).then(([counts, recent, funnels]) => ({ counts, recent: recent.orders as Order[], funnels })),
    [workspaceId]
  );

  const current = summary.data?.current ?? null;
  const previous = summary.data?.previous ?? null;
  const currency = current?.currency ?? "EGP";
  const money = (v: number | string) => <bdi dir="ltr">{formatMoney(v, currency)}</bdi>;

  return (
    <div className="min-w-0">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-ink">{fmt(t.welcome, { name: currentWorkspace ? `, ${currentWorkspace.name}` : "" })}</h1>
        <p className="mt-1 text-ink-soft">{t.subtitle}</p>
      </div>

      <DataState loading={(summary.loading && !current) || (extra.loading && !extra.data)} error={summary.error ?? extra.error} onRetry={() => { void summary.refresh(); void extra.refresh(); }}>
        {current && extra.data && (
          <>
            <div className="mb-8 grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-4">
              <StatCard icon={<DollarSign />} tone="blue" label={t.grossSales} value={money(current.revenue.gross)} delta={deltaBasisPoints(current.revenue.gross, previous?.revenue.gross)} vsLabel={t.vsPrevious} to="/analytics" />
              <StatCard icon={<ShoppingCart />} tone="violet" label={t.orders} value={<bdi dir="ltr">{formatCount(current.orders.placed)}</bdi>} delta={deltaBasisPoints(current.orders.placed, previous?.orders.placed)} vsLabel={t.vsPrevious} to="/orders" />
              <StatCard icon={<ClipboardCheck />} tone="orange" label={t.awaiting} value={<bdi dir="ltr">{formatCount(extra.data.counts.pending)}</bdi>} hint={t.awaitingHint} to="/confirmation-queue" />
              <StatCard icon={<Wallet />} tone="green" label={t.collected} value={money(current.revenue.collected)} delta={deltaBasisPoints(current.revenue.collected, previous?.revenue.collected)} vsLabel={t.vsPrevious} to="/settlements" />
            </div>

            <div className="grid grid-cols-1 gap-8 lg:grid-cols-3">
              <div className="lg:col-span-2">
                <Panel
                  title={t.recentTitle}
                  action={
                    <Link to="/orders" className="text-sm font-medium text-primary hover:underline">
                      {t.viewAll}
                    </Link>
                  }
                >
                  {extra.data.recent.length === 0 ? (
                    <p className="text-sm text-ink-soft">{t.noOrders}</p>
                  ) : (
                    <div className="space-y-1">
                      {extra.data.recent.map((order) => (
                        <Link key={order.id} to={`/orders/${order.id}`} className="flex items-center gap-4 rounded-lg p-3 transition-colors hover:bg-paper">
                          <div className={cn("rounded-lg p-2 [&>svg]:size-4", order.funnelId ? TONES.violet : TONES.blue)}>
                            {order.funnelId ? <Workflow /> : <ShoppingCart />}
                          </div>
                          <div className="min-w-0 flex-1">
                            <p className="truncate text-sm font-medium text-ink">
                              <bdi dir="ltr">{order.orderNumber}</bdi>
                              <span className="ms-2 font-normal text-ink-soft" dir="auto">
                                {order.contactSnapshot?.fullName || "—"}
                              </span>
                            </p>
                            <p className="truncate text-xs text-ink-soft">
                              {order.funnel?.name ?? (order.funnelId ? "" : t.channelStore)} · {formatDateTime(order.createdAt)}
                            </p>
                          </div>
                          <StatusBadge value={order.confirmationState} />
                          <span className="tabular-nums text-sm font-medium text-ink">{money(order.totalAmount)}</span>
                        </Link>
                      ))}
                    </div>
                  )}
                </Panel>
              </div>

              <div className="space-y-6">
                <Panel title={t.quickTitle}>
                  <div className="space-y-4">
                    <Meter label={t.confirmationRate} value={current.rates.confirmation} tone="bg-primary" />
                    <Meter label={t.deliveryRate} value={current.rates.delivery} tone="bg-success" />
                    {current.traffic && current.traffic.sessions > 0 ? (
                      <Meter label={t.conversionRate} value={current.traffic.conversionRate} tone="bg-accent" />
                    ) : (
                      <div className="flex items-center justify-between">
                        <span className="text-sm text-ink-soft">{t.conversionRate}</span>
                        <span className="text-xs text-ink-soft">{t.noSessions}</span>
                      </div>
                    )}
                  </div>
                </Panel>

                <Panel title={t.topProducts}>
                  {current.topProducts.length === 0 ? (
                    <p className="text-sm text-ink-soft">{t.noProducts}</p>
                  ) : (
                    <div className="space-y-3">
                      {current.topProducts.map((p, i) => (
                        <div key={p.productId ?? `${p.name}-${i}`} className="flex items-center justify-between gap-3 py-1">
                          <span className="flex min-w-0 items-center gap-2 text-sm text-ink-soft">
                            <Package className="size-4 shrink-0" aria-hidden />
                            <span className="truncate" dir="auto">{p.name ?? "—"}</span>
                          </span>
                          <span className="shrink-0 text-end">
                            <span className="block tabular-nums text-sm font-medium text-ink">{money(p.revenue)}</span>
                            <span className="block text-xs text-ink-soft">{fmt(t.units, { n: formatCount(p.quantity) })}</span>
                          </span>
                        </div>
                      ))}
                    </div>
                  )}
                </Panel>

                {extra.data.funnels && (
                  <Panel
                    title={t.funnelsTitle}
                    action={
                      <Link to="/funnels" className="text-sm font-medium text-primary hover:underline">
                        {t.viewAll}
                      </Link>
                    }
                  >
                    {extra.data.funnels.totals.sessions === 0 ? (
                      <p className="text-sm text-ink-soft">{t.noFunnels}</p>
                    ) : (
                      <div className="space-y-3">
                        {extra.data.funnels.funnels.filter((f) => f.sessions > 0).slice(0, 4).map((f) => (
                          <Link key={f.id} to={`/analytics/funnels/${f.id}`} className="flex items-center justify-between gap-3 py-1 hover:text-primary">
                            <span className="flex min-w-0 items-center gap-2 text-sm text-ink-soft">
                              <Users className="size-4 shrink-0" aria-hidden />
                              <span className="truncate" dir="auto">{f.name}</span>
                            </span>
                            <span className="shrink-0 text-end">
                              <span className="block tabular-nums text-sm font-medium text-ink">{money(f.revenue)}</span>
                              <span className="block text-xs text-ink-soft">
                                {fmt(t.funnelSessions, { n: formatCount(f.sessions) })} · <bdi dir="ltr">{formatPercentValue(percentToRatio(f.conversionRate))}</bdi>
                              </span>
                            </span>
                          </Link>
                        ))}
                      </div>
                    )}
                  </Panel>
                )}
              </div>
            </div>
          </>
        )}
      </DataState>
    </div>
  );
}
