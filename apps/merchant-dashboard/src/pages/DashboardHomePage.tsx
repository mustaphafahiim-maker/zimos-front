import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { ChevronDown, PackagePlus, Plus, ShoppingCart, Workflow } from "lucide-react";
import { Button, cn } from "@store-builder/ui";
import {
  homeGetOverview,
  profitGetPnl,
  type ConfirmationQueueCounts,
  type HomeOverview,
  type Order,
  type OrderPipeline,
  type ProfitPnl,
} from "@store-builder/api-client";
import { useWorkspace } from "@/context/WorkspaceContext";
import { useAuth } from "@/context/AuthContext";
import { useWorkspaceId } from "@/lib/useWorkspaceId";
import { useAsync } from "@/lib/useAsync";
import { apiClient } from "@/lib/apiClient";
import { isPermissionError } from "@/lib/errors";
import { useErrorMessage } from "@/lib/errorMessages";
import { formatDateTime, formatMoney } from "@/lib/format";
import { rangeWindows } from "@/lib/analytics";
import { canViewAnalytics } from "@/lib/analyticsAccess";
import { useRememberedChoice } from "@/lib/rememberedChoice";
import { StatusBadge } from "@/components/StatusBadge";
import { Select } from "@/components/Select";
import { Bento, BentoSkeleton, BentoTile } from "@/components/Bento";
import { StoreOverview } from "@/pages/home/StoreOverview";
import { SetupGuideCard } from "@/pages/home/SetupGuideCard";
import { SiteAnalytics } from "@/pages/home/SiteAnalytics";
import {
  LostTile,
  NeedsYouTile,
  OrdersTile,
  ProductTile,
  ProfitTile,
  RateTile,
  SalesTile,
  WhereTile,
  type HomeRange,
} from "@/pages/home/HomeAnswers";
import { STAGE_TONE, useOrderLabels } from "@/pages/orders/orderLabels";
import { HelpCards } from "@/components/Education";
import { fmt, useCommon, useT, type Messages } from "@/i18n/LocaleContext";

const STRINGS = {
  en: {
    morning: "Good morning, {name}",
    evening: "Good evening, {name}",
    morningPlain: "Good morning",
    eveningPlain: "Good evening",
    subtitle: "Here is what needs you, and how {store} is doing.",
    period: "Period",
    today: "Today",
    week: "7 days",
    month: "30 days",
    newOrder: "New order",
    newProduct: "Add product",
    loadError: "We couldn't load your numbers.",
    recentTitle: "Latest orders",
    viewAll: "All orders",
    noOrders: "No orders yet. The first one shows up here the moment it arrives.",
    shareStore: "Share your store link",
    channelStore: "Store",
    channelFunnel: "Funnel",
    details: "All the numbers in detail",
    product: "Product",
    store: "Store",
    allProducts: "All products",
    allStores: "All stores",
    clearFilters: "Clear filters",
    filteredNote: "Filtered: profit by product shows on the profit report.",
    detailsHint: "Visits, funnel, offers, sources and every metric of the period.",
  },
  ar: {
    morning: "صباح الخير يا {name}",
    evening: "مساء الخير يا {name}",
    morningPlain: "صباح الخير",
    eveningPlain: "مساء الخير",
    subtitle: "ده اللي مستنيك، وأحوال {store} عاملة إزاي.",
    period: "الفترة",
    today: "النهارده",
    week: "٧ أيام",
    month: "٣٠ يوم",
    newOrder: "أوردر جديد",
    newProduct: "ضيف منتج",
    loadError: "معرفناش نجيب أرقامك دلوقتي.",
    recentTitle: "آخر الأوردرات",
    viewAll: "كل الأوردرات",
    noOrders: "لسه مفيش أوردرات. أول ما ييجي أوردر هيظهر هنا على طول.",
    shareStore: "شارك لينك متجرك",
    channelStore: "المتجر",
    channelFunnel: "مسار بيع",
    details: "كل الأرقام بالتفصيل",
    product: "المنتج",
    store: "المتجر",
    allProducts: "كل المنتجات",
    allStores: "كل المتاجر",
    clearFilters: "امسح الفلاتر",
    filteredNote: "متفلتر: ربح كل منتج تلاقيه في تقرير الأرباح.",
    detailsHint: "الزيارات، مسار الشراء، العروض، المصادر وكل مؤشرات الفترة.",
  },
} satisfies Messages;

const RANGES: HomeRange[] = ["today", "7d", "30d"];

/**
 * The home answers first (docs/ux/05-proposal.md §3): what is waiting for the
 * merchant, then what the period earned and why, in sentences, with every
 * tile one tap from the screen that acts on it. The full metric wall of the
 * period stays one tap away under "All the numbers in detail".
 *
 * Roles without analytics.view see the to-do tile and the latest orders.
 */
export function DashboardHomePage() {
  const { currentWorkspace } = useWorkspace();
  const { user } = useAuth();
  const workspaceId = useWorkspaceId();
  const t = useT(STRINGS);
  const common = useCommon();
  const errorMessage = useErrorMessage();
  const analyticsAllowed = canViewAnalytics(currentWorkspace?.role);
  const [range, setRange] = useRememberedChoice<HomeRange>("home.answers.range", "7d", RANGES);
  // Item 172: narrow the numbers to one product or one store (website), remembered like the period.
  const [productId, setProductId] = useRememberedChoice<string>("home.answers.product", "");
  const [websiteId, setWebsiteId] = useRememberedChoice<string>("home.answers.website", "");
  const filtered = Boolean(productId || websiteId);
  const productChoices = useAsync(
    () =>
      analyticsAllowed
        ? apiClient
            .listProducts(workspaceId, { limit: 100 })
            .then((r) => r.products.map((p) => ({ id: p.id, name: p.name })).sort((a, b) => a.name.localeCompare(b.name)))
            .catch(() => [])
        : Promise.resolve([]),
    [workspaceId, analyticsAllowed]
  );
  const websiteChoices = useAsync(
    () =>
      analyticsAllowed
        ? apiClient
            .listWebsites(workspaceId)
            .then((list) => list.map((w) => ({ id: w.id, name: w.name })))
            .catch(() => [])
        : Promise.resolve([]),
    [workspaceId, analyticsAllowed]
  );

  // A remembered product or store that no longer exists falls back to all (the API would refuse it).
  useEffect(() => {
    if (productId && productChoices.data && productChoices.data.length > 0 && !productChoices.data.some((p) => p.id === productId)) setProductId("");
  }, [productId, productChoices.data, setProductId]);
  useEffect(() => {
    if (websiteId && websiteChoices.data && !websiteChoices.data.some((w) => w.id === websiteId)) setWebsiteId("");
  }, [websiteId, websiteChoices.data, setWebsiteId]);

  const queue = useAsync<ConfirmationQueueCounts | null>(
    () => apiClient.getConfirmationQueueCounts(workspaceId).catch(() => null),
    [workspaceId]
  );
  const pipeline = useAsync<OrderPipeline | null>(
    () => apiClient.getOrderPipeline(workspaceId).catch(() => null),
    [workspaceId]
  );
  const overview = useAsync<HomeOverview | null>(
    () =>
      analyticsAllowed
        ? homeGetOverview(apiClient, workspaceId, {
            ...rangeWindows(range).current,
            compare: "previous",
            productId: productId || undefined,
            websiteId: websiteId || undefined,
          }).catch((err) => {
            if (isPermissionError(err)) return null;
            throw err;
          })
        : Promise.resolve(null),
    [workspaceId, range, analyticsAllowed, productId, websiteId]
  );
  // Profit needs financial_reports.view; a role without it simply gets no profit tiles.
  const pnl = useAsync<ProfitPnl | null>(
    () =>
      analyticsAllowed && !filtered
        ? profitGetPnl(apiClient, workspaceId, { ...rangeWindows(range).current, groupBy: "product" }).catch(() => null)
        : Promise.resolve(null),
    [workspaceId, range, analyticsAllowed, filtered]
  );
  const recent = useAsync<Order[] | null>(
    () =>
      apiClient
        .listOrders(workspaceId, { limit: 5 })
        .then((page) => page.orders as Order[])
        .catch(() => null),
    [workspaceId]
  );

  const firstName = (user?.fullName ?? "").trim().split(/\s+/)[0] ?? "";
  const morning = new Date().getHours() < 12;
  const greeting = firstName
    ? fmt(morning ? t.morning : t.evening, { name: firstName })
    : morning
      ? t.morningPlain
      : t.eveningPlain;
  const rangeLabel: Record<HomeRange, string> = { today: t.today, "7d": t.week, "30d": t.month };

  const todoLoading = queue.loading || pipeline.loading;
  const numbersLoading = overview.loading || pnl.loading;
  const ov = overview.data;
  // Work waiting beats the setup checklist: with orders to handle, the to-do tile comes first.
  const stages = pipeline.data?.stages;
  const hasTodo = Boolean(
    (queue.data?.pending ?? 0) > 0 || stages?.ready_to_ship || stages?.delivery_failed || stages?.needs_follow_up
  );

  return (
    <div className="mx-auto min-w-0 max-w-6xl">
      <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
        <div className="min-w-0">
          <h1 className="text-2xl font-semibold text-ink">{greeting}</h1>
          {currentWorkspace && (
            <p className="mt-1 text-sm text-ink-soft">{fmt(t.subtitle, { store: currentWorkspace.name })}</p>
          )}
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {analyticsAllowed && (
            <div role="group" aria-label={t.period} className="flex rounded-full bg-paper-sunken p-1">
              {RANGES.map((value) => (
                <button
                  key={value}
                  type="button"
                  aria-pressed={range === value}
                  onClick={() => setRange(value)}
                  className={cn(
                    "min-h-9 cursor-pointer rounded-full px-3.5 text-sm font-medium text-ink-soft transition-colors hover:text-ink",
                    range === value && "bg-paper-raised text-ink shadow-[var(--shadow-card)]"
                  )}
                >
                  {rangeLabel[value]}
                </button>
              ))}
            </div>
          )}
          <Button variant="outline" asChild className="hidden h-10 sm:inline-flex">
            <Link to="/catalog/new">
              <PackagePlus aria-hidden />
              {t.newProduct}
            </Link>
          </Button>
          <Button asChild className="h-10">
            <Link to="/orders/new">
              <Plus aria-hidden />
              {t.newOrder}
            </Link>
          </Button>
        </div>
      </div>

      {analyticsAllowed && ((productChoices.data?.length ?? 0) > 0 || (websiteChoices.data?.length ?? 0) > 1) && (
        <div className="mb-[var(--bento-gap)] flex flex-wrap items-center gap-2">
          {(productChoices.data?.length ?? 0) > 0 && (
            <Select
              aria-label={t.product}
              value={productId}
              onChange={(e) => setProductId(e.target.value)}
              className={cn("h-10 w-auto max-w-[14rem]", productId && "border-primary text-primary-dark")}
            >
              <option value="">{t.allProducts}</option>
              {productChoices.data?.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </Select>
          )}
          {/* One website means one store: no point in choosing. */}
          {(websiteChoices.data?.length ?? 0) > 1 && (
            <Select
              aria-label={t.store}
              value={websiteId}
              onChange={(e) => setWebsiteId(e.target.value)}
              className={cn("h-10 w-auto max-w-[14rem]", websiteId && "border-primary text-primary-dark")}
            >
              <option value="">{t.allStores}</option>
              {websiteChoices.data?.map((w) => (
                <option key={w.id} value={w.id}>
                  {w.name}
                </option>
              ))}
            </Select>
          )}
          {filtered && (
            <>
              <Button
                variant="ghost"
                className="min-h-10"
                onClick={() => {
                  setProductId("");
                  setWebsiteId("");
                }}
              >
                {t.clearFilters}
              </Button>
              <span className="text-xs text-ink-soft">{t.filteredNote}</span>
            </>
          )}
        </div>
      )}

      {!todoLoading && !hasTodo && <SetupGuideCard />}

      <Bento>
        {todoLoading ? <BentoSkeleton span={2} /> : <NeedsYouTile queue={queue.data} pipeline={pipeline.data} />}
        {!todoLoading && hasTodo && (
          <div className="order-last col-span-2 lg:col-span-4">
            <SetupGuideCard className="" />
          </div>
        )}

        {analyticsAllowed &&
          (numbersLoading && !ov ? (
            <>
              <BentoSkeleton span={2} />
              <BentoSkeleton />
              <BentoSkeleton />
              <BentoSkeleton />
              <BentoSkeleton />
            </>
          ) : overview.error ? (
            <BentoTile span={2}>
              <p className="text-sm text-ink">{t.loadError}</p>
              <p className="mt-1 text-xs text-ink-soft">{errorMessage(overview.error)}</p>
              <Button
                variant="outline"
                size="sm"
                className="mt-3 min-h-11 self-start"
                onClick={() => {
                  void overview.refresh();
                  void pnl.refresh();
                }}
              >
                {common.retry}
              </Button>
            </BentoTile>
          ) : (
            <>
              {pnl.data && <ProfitTile pnl={pnl.data} range={range} />}
              {ov && (
                <>
                  <SalesTile overview={ov} />
                  <OrdersTile overview={ov} />
                  <RateTile overview={ov} kind="confirmation" />
                  <RateTile overview={ov} kind="delivery" />
                </>
              )}
              <ProductTile pnl={pnl.data} overview={ov} range={range} />
              {ov && <LostTile overview={ov} range={range} />}
              {ov && <WhereTile overview={ov} range={range} storeWideVisits={ov.eventScope === "store"} />}
            </>
          ))}

        <RecentOrdersTile orders={recent.data} loading={recent.loading} />
      </Bento>

      {analyticsAllowed && <Details />}

      {/* Help center, Telegram and support chat, when ZIMOS has set them (components/Education.tsx). */}
      <HelpCards />
    </div>
  );
}

function RecentOrdersTile({ orders, loading }: { orders: Order[] | null; loading: boolean }) {
  const t = useT(STRINGS);
  const labels = useOrderLabels();
  if (loading) return <BentoSkeleton span={4} />;
  return (
    <BentoTile span={4} eyebrow={t.recentTitle} icon={ShoppingCart} action={orders?.length ? { to: "/orders", label: t.viewAll } : undefined}>
      {!orders || orders.length === 0 ? (
        <div className="flex flex-wrap items-center justify-between gap-3">
          <p className="text-sm text-ink-soft">{t.noOrders}</p>
          <Button variant="outline" asChild className="min-h-11">
            <Link to="/store-settings">{t.shareStore}</Link>
          </Button>
        </div>
      ) : (
        <ul className="-mx-2 divide-y divide-line">
          {orders.map((order) => (
            <li key={order.id}>
              <Link
                to={`/orders/${order.id}`}
                className="flex min-h-14 items-center gap-3 rounded-xl px-2 py-2.5 transition-colors hover:bg-paper-sunken"
              >
                <span
                  className={cn(
                    "flex size-9 shrink-0 items-center justify-center rounded-xl [&>svg]:size-4",
                    order.funnelId ? "bg-accent-soft text-accent-dark" : "bg-primary-soft text-primary-dark"
                  )}
                >
                  {order.funnelId ? <Workflow aria-hidden /> : <ShoppingCart aria-hidden />}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-medium text-ink">
                    <bdi>{order.contactSnapshot?.fullName || "—"}</bdi>
                  </span>
                  <span className="block truncate text-xs text-ink-soft">
                    <bdi dir="ltr">{order.orderNumber}</bdi> · {order.funnelId ? t.channelFunnel : t.channelStore} ·{" "}
                    {formatDateTime(order.createdAt)}
                  </span>
                </span>
                <span className="flex shrink-0 flex-col items-end gap-1">
                  <span className="text-sm font-semibold text-ink tabular-nums">
                    <bdi dir="ltr">{formatMoney(order.totalAmount, order.currency ?? "EGP")}</bdi>
                  </span>
                  {order.stage && (
                    <StatusBadge value={order.stage} tone={STAGE_TONE[order.stage]} text={labels.stage(order.stage)} />
                  )}
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </BentoTile>
  );
}

/** The full metric wall of the period, folded away until asked for. */
function Details() {
  const t = useT(STRINGS);
  const [open, setOpen] = useState(false);
  return (
    <details
      className="group mt-[var(--bento-gap)] rounded-[var(--radius-card)] bg-paper-raised shadow-[var(--shadow-card)] ring-1 ring-line"
      onToggle={(e) => setOpen((e.currentTarget as HTMLDetailsElement).open)}
    >
      <summary className="flex min-h-14 cursor-pointer list-none items-center gap-3 px-4 py-3 sm:px-5 [&::-webkit-details-marker]:hidden">
        <span className="min-w-0 flex-1">
          <span className="block text-[15px] font-medium text-ink">{t.details}</span>
          <span className="block text-xs text-ink-soft">{t.detailsHint}</span>
        </span>
        <ChevronDown className="size-5 shrink-0 text-ink-soft transition-transform group-open:rotate-180" aria-hidden />
      </summary>
      {open && (
        <div className="space-y-8 border-t border-line px-4 py-5 sm:px-5">
          <StoreOverview />
          <SiteAnalytics />
        </div>
      )}
    </details>
  );
}
