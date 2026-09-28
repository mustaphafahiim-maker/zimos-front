import type { ReactNode } from "react";
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
import { Button, Card, CardHeader, CardTitle, CardDescription, Spinner, cn } from "@store-builder/ui";
import type { Order } from "@store-builder/api-client";
import { useWorkspace } from "@/context/WorkspaceContext";
import { useWorkspaceId } from "@/lib/useWorkspaceId";
import { useAsync } from "@/lib/useAsync";
import { apiClient } from "@/lib/apiClient";
import { fetchOrderStats } from "@/lib/orderStats";
import { isPermissionError } from "@/lib/errors";
import { formatDateTime, formatMoney, formatPercentValue } from "@/lib/format";
import { deltaBasisPoints, formatCount, percentToRatio, rangeWindows, type AnalyticsPair } from "@/lib/analytics";
import { fetchAnalyticsPair, takePrefetchedAnalyticsSummary } from "@/lib/analyticsPrefetch";
import { canViewAnalytics } from "@/lib/analyticsAccess";
import { StatusBadge } from "@/components/StatusBadge";
import { fmt, useCommon, useT, type Messages } from "@/i18n/LocaleContext";

const STRINGS = {
  en: {
    welcome: "Welcome back",
    welcomeNamed: "Welcome back, {name}",
    subtitle: "The last 30 days, compared to the 30 before.",
    loadError: "Couldn't load your store stats right now.",
    empty: "No orders yet — once your first order comes in, your stats will show up here.",
    totalOrders: "Total orders",
    totalRevenue: "Total revenue",
    awaitingConfirmation: "Awaiting confirmation",
    awaitingHint: "Call them from the queue",
    unfulfilled: "Unfulfilled",
    basedOnRecent: "Based on the most recent {count} orders",
    grossSales: "Gross sales",
    orders: "Orders",
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
    channelFunnel: "Funnel",
    ordersTitle: "Orders",
    ordersDesc: "Track and fulfill customer orders.",
    catalogTitle: "Catalog",
    catalogDesc: "Manage products, variants, and offers.",
    customersTitle: "Customers",
    customersDesc: "See who's buying and manage their details.",
  },
  ar: {
    welcome: "مرحبًا بعودتك",
    welcomeNamed: "مرحبًا بعودتك، {name}",
    subtitle: "آخر 30 يومًا، مقارنةً بالثلاثين يومًا التي قبلها.",
    loadError: "تعذّر تحميل إحصائيات متجرك الآن.",
    empty: "لا توجد طلبات بعد — ستظهر إحصائياتك هنا بمجرد وصول أول طلب.",
    totalOrders: "إجمالي الطلبات",
    totalRevenue: "إجمالي الإيرادات",
    awaitingConfirmation: "بانتظار التأكيد",
    awaitingHint: "اتصل بهم من قائمة التأكيد",
    unfulfilled: "غير مُنفّذة",
    basedOnRecent: "بناءً على أحدث {count} طلب",
    grossSales: "إجمالي المبيعات",
    orders: "الطلبات",
    collected: "المبالغ المحصَّلة",
    vsPrevious: "مقارنةً بالثلاثين يومًا السابقة",
    recentTitle: "أحدث الطلبات",
    viewAll: "عرض الكل",
    noOrders: "لا توجد طلبات بعد — سيظهر أول طلب هنا لحظة وصوله.",
    quickTitle: "أرقام سريعة",
    confirmationRate: "نسبة التأكيد",
    deliveryRate: "نسبة التسليم",
    conversionRate: "معدل تحويل المتجر",
    noSessions: "يبدأ مع أول زيارة للمتجر",
    topProducts: "المنتجات الأكثر مبيعًا",
    noProducts: "لم يُبَع شيء خلال آخر 30 يومًا.",
    units: "بيع منه {n}",
    funnelsTitle: "مسارات البيع",
    noFunnels: "لا توجد جلسات في مسارات البيع خلال آخر 30 يومًا.",
    funnelSessions: "{n} جلسة",
    channelStore: "المتجر",
    channelFunnel: "مسار بيع",
    ordersTitle: "الطلبات",
    ordersDesc: "تابع طلبات العملاء ونفّذها.",
    catalogTitle: "الكتالوج",
    catalogDesc: "أدِر المنتجات والأنواع والعروض.",
    customersTitle: "العملاء",
    customersDesc: "اعرف من يشتري وأدِر بياناته.",
  },
} satisfies Messages;

// Icon chips, from the dashboard's own tokens.
const TONES = {
  primary: "bg-primary-soft text-primary-dark dark:text-primary",
  success: "bg-success-soft text-success",
  accent: "bg-accent-soft text-accent-dark dark:text-accent",
  neutral: "bg-paper text-ink",
} as const;

/**
 * The store at a glance. With analytics.view it shows the last 30 days against
 * the 30 before (from /analytics/summary), recent orders, quick rates, top
 * products and funnels. Without it — a role that can't read analytics, or a
 * custom role the server refuses — it falls back to the order roll-up this
 * page always showed. The confirmation queue count comes from the queue itself
 * in both cases.
 */
export function DashboardHomePage() {
  const { currentWorkspace } = useWorkspace();
  const workspaceId = useWorkspaceId();
  const t = useT(STRINGS);
  const common = useCommon();
  const analyticsAllowed = canViewAnalytics(currentWorkspace?.role);

  // Null: analytics are not available to this role, so the fallback shows.
  const summary = useAsync<AnalyticsPair | null>(
    () =>
      analyticsAllowed
        ? (takePrefetchedAnalyticsSummary(workspaceId, "30d") ?? fetchAnalyticsPair(workspaceId, "30d")).catch((err) => {
            if (isPermissionError(err)) return null;
            throw err;
          })
        : Promise.resolve(null),
    [workspaceId, analyticsAllowed]
  );
  const analytics = summary.data;
  const withAnalytics = Boolean(analytics);

  // Awaiting = not finished yet: waiting for a call, or someone on it.
  const queue = useAsync(
    () =>
      apiClient
        .getConfirmationQueueCounts(workspaceId)
        .then((counts) => counts.pending + counts.inProgress)
        .catch(() => null),
    [workspaceId]
  );

  // Only once analytics are known to be unavailable: this walks the order list.
  const legacy = useAsync(
    () => (summary.loading || withAnalytics ? Promise.resolve(null) : fetchOrderStats(workspaceId)),
    [workspaceId, summary.loading, withAnalytics]
  );

  const extra = useAsync(
    () =>
      withAnalytics
        ? Promise.all([
            apiClient.listOrders(workspaceId, { limit: 6 }).then((page) => page.orders as Order[]).catch(() => null),
            apiClient.getFunnelAnalytics(workspaceId, rangeWindows("30d").current).catch(() => null),
          ]).then(([recent, funnels]) => ({ recent, funnels }))
        : Promise.resolve(null),
    [workspaceId, withAnalytics]
  );

  const loading = summary.loading || (!withAnalytics && legacy.loading);
  const error = summary.error ?? (!withAnalytics ? legacy.error : null);

  return (
    <div className="min-w-0 max-w-6xl">
      <h1 className="font-display text-2xl font-medium text-ink">
        {currentWorkspace ? fmt(t.welcomeNamed, { name: currentWorkspace.name }) : t.welcome}
      </h1>
      {withAnalytics && <p className="mt-1 text-sm text-ink-soft">{t.subtitle}</p>}

      <div className="mt-8">
        {loading ? (
          <div className="flex min-h-[7rem] items-center justify-center text-ink-soft">
            <Spinner className="size-6" />
          </div>
        ) : error ? (
          <div className="flex flex-wrap items-center gap-3">
            <p className="text-sm text-ink-soft">{t.loadError}</p>
            <Button
              size="sm"
              variant="outline"
              onClick={() => {
                void summary.refresh();
                void queue.refresh();
                if (!withAnalytics) void legacy.refresh();
              }}
            >
              {common.retry}
            </Button>
          </div>
        ) : analytics ? (
          <AnalyticsOverview
            pair={analytics}
            awaiting={queue.data ?? null}
            recent={extra.data?.recent ?? null}
            funnels={extra.data?.funnels ?? null}
            extraLoading={extra.loading}
          />
        ) : legacy.data && legacy.data.totalOrders === 0 ? (
          <div className="rounded-[var(--radius-card)] border border-dashed border-line px-6 py-10 text-center text-sm text-ink-soft">
            {t.empty}
          </div>
        ) : legacy.data ? (
          <>
            <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
              <LegacyStatCard label={t.totalOrders} value={legacy.data.totalOrders} />
              <LegacyStatCard label={t.totalRevenue} value={formatMoney(legacy.data.totalRevenue, legacy.data.currency)} />
              <LegacyStatCard label={t.awaitingConfirmation} value={queue.data ?? "—"} to="/confirmation-queue" />
              <LegacyStatCard label={t.unfulfilled} value={legacy.data.unfulfilledCount} to="/orders" />
            </div>
            {legacy.data.reachedCap && (
              <p className="mt-2 text-xs text-ink-soft">{fmt(t.basedOnRecent, { count: legacy.data.cap })}</p>
            )}
          </>
        ) : null}
      </div>

      <div className="mt-8 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {[
          { title: t.ordersTitle, desc: t.ordersDesc, to: "/orders" },
          { title: t.catalogTitle, desc: t.catalogDesc, to: "/catalog" },
          { title: t.customersTitle, desc: t.customersDesc, to: "/customers" },
        ].map((item) => (
          <Link key={item.to} to={item.to} className="block">
            <Card className="h-full transition-colors hover:border-primary/40">
              <CardHeader>
                <CardTitle>{item.title}</CardTitle>
                <CardDescription>{item.desc}</CardDescription>
              </CardHeader>
            </Card>
          </Link>
        ))}
      </div>
    </div>
  );
}

function AnalyticsOverview({
  pair,
  awaiting,
  recent,
  funnels,
  extraLoading,
}: {
  pair: AnalyticsPair;
  awaiting: number | null;
  recent: Order[] | null;
  funnels: Awaited<ReturnType<typeof apiClient.getFunnelAnalytics>> | null;
  extraLoading: boolean;
}) {
  const t = useT(STRINGS);
  const { current, previous } = pair;
  const currency = current.currency ?? "EGP";
  const money = (v: number | string) => <bdi dir="ltr">{formatMoney(v, currency)}</bdi>;

  return (
    <>
      <div className="mb-8 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          icon={<DollarSign />}
          tone="primary"
          label={t.grossSales}
          value={money(current.revenue.gross)}
          delta={deltaBasisPoints(current.revenue.gross, previous?.revenue.gross)}
          vsLabel={t.vsPrevious}
          to="/analytics"
        />
        <StatCard
          icon={<ShoppingCart />}
          tone="neutral"
          label={t.orders}
          value={<bdi dir="ltr">{formatCount(current.orders.placed)}</bdi>}
          delta={deltaBasisPoints(current.orders.placed, previous?.orders.placed)}
          vsLabel={t.vsPrevious}
          to="/orders"
        />
        <StatCard
          icon={<ClipboardCheck />}
          tone="accent"
          label={t.awaitingConfirmation}
          value={<bdi dir="ltr">{awaiting === null ? "—" : formatCount(awaiting)}</bdi>}
          hint={t.awaitingHint}
          to="/confirmation-queue"
        />
        <StatCard
          icon={<Wallet />}
          tone="success"
          label={t.collected}
          value={money(current.revenue.collected)}
          delta={deltaBasisPoints(current.revenue.collected, previous?.revenue.collected)}
          vsLabel={t.vsPrevious}
        />
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <Panel
            title={t.recentTitle}
            action={
              <Link to="/orders" className="text-sm font-medium text-primary hover:underline">
                {t.viewAll}
              </Link>
            }
          >
            {recent === null ? (
              extraLoading ? (
                <div className="flex h-24 items-center justify-center text-ink-soft">
                  <Spinner className="size-5" />
                </div>
              ) : (
                <p className="text-sm text-ink-soft">—</p>
              )
            ) : recent.length === 0 ? (
              <p className="text-sm text-ink-soft">{t.noOrders}</p>
            ) : (
              <div className="space-y-1">
                {recent.map((order) => (
                  <Link
                    key={order.id}
                    to={`/orders/${order.id}`}
                    className="flex items-center gap-3 rounded-lg p-3 transition-colors hover:bg-paper"
                  >
                    <div className={cn("rounded-lg p-2 [&>svg]:size-4", order.funnelId ? TONES.accent : TONES.primary)}>
                      {order.funnelId ? <Workflow aria-hidden /> : <ShoppingCart aria-hidden />}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium text-ink">
                        <bdi dir="ltr">{order.orderNumber}</bdi>
                        <span className="ms-2 font-normal text-ink-soft" dir="auto">
                          {order.contactSnapshot?.fullName || "—"}
                        </span>
                      </p>
                      <p className="truncate text-xs text-ink-soft">
                        {order.funnelId ? t.channelFunnel : t.channelStore} · {formatDateTime(order.createdAt)}
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
                <div className="flex items-center justify-between gap-3">
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
                      <span className="truncate" dir="auto">
                        {p.name ?? "—"}
                      </span>
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

          {funnels && (
            <Panel
              title={t.funnelsTitle}
              action={
                <Link to="/funnels" className="text-sm font-medium text-primary hover:underline">
                  {t.viewAll}
                </Link>
              }
            >
              {funnels.totals.sessions === 0 ? (
                <p className="text-sm text-ink-soft">{t.noFunnels}</p>
              ) : (
                <div className="space-y-3">
                  {funnels.funnels
                    .filter((f) => f.sessions > 0)
                    .slice(0, 4)
                    .map((f) => (
                      <Link
                        key={f.id}
                        to={`/analytics/funnels/${f.id}`}
                        className="flex items-center justify-between gap-3 py-1 hover:text-primary"
                      >
                        <span className="flex min-w-0 items-center gap-2 text-sm text-ink-soft">
                          <Users className="size-4 shrink-0" aria-hidden />
                          <span className="truncate" dir="auto">
                            {f.name}
                          </span>
                        </span>
                        <span className="shrink-0 text-end">
                          <span className="block tabular-nums text-sm font-medium text-ink">{money(f.revenue)}</span>
                          <span className="block text-xs text-ink-soft">
                            {fmt(t.funnelSessions, { n: formatCount(f.sessions) })} ·{" "}
                            <bdi dir="ltr">{formatPercentValue(percentToRatio(f.conversionRate))}</bdi>
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
  );
}

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
    <Card className={cn("h-full gap-0 p-5", to && "transition-colors hover:border-primary/40")}>
      <div className="mb-3 flex items-center justify-between">
        <div className={cn("rounded-lg p-2 [&>svg]:size-5", TONES[tone])} aria-hidden>
          {icon}
        </div>
        {up && <ArrowUpRight className="size-4 text-success" aria-hidden />}
        {down && <ArrowDownRight className="size-4 text-danger" aria-hidden />}
      </div>
      <p className="mb-1 text-xs font-medium tracking-wide text-ink-soft uppercase rtl:tracking-normal">{label}</p>
      <p className="tabular-nums font-display text-2xl font-medium text-ink">{value}</p>
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
    <Link to={to} className="block">
      {body}
    </Link>
  ) : (
    body
  );
}

function Panel({ title, action, children }: { title: string; action?: ReactNode; children: ReactNode }) {
  return (
    <Card className="gap-0 p-5">
      <div className="mb-4 flex items-center justify-between gap-3">
        <h2 className="text-base font-semibold text-ink">{title}</h2>
        {action}
      </div>
      {children}
    </Card>
  );
}

function Meter({ label, value, tone }: { label: string; value: number | null; tone: "bg-primary" | "bg-success" | "bg-accent" }) {
  return (
    <div>
      <div className="flex items-center justify-between gap-3">
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

function LegacyStatCard({ label, value, to }: { label: string; value: ReactNode; to?: string }) {
  const card = (
    <Card className={to ? "h-full p-4 transition-colors hover:border-primary/40" : "h-full p-4"}>
      <p className="text-xs font-medium uppercase tracking-wide text-ink-soft">{label}</p>
      <p className="mt-1 font-display text-2xl font-medium text-ink">{value}</p>
    </Card>
  );
  return to ? (
    <Link to={to} className="block">
      {card}
    </Link>
  ) : (
    card
  );
}
