import { useEffect, useRef, type ReactNode } from "react";
import {
  reportsGetDelivery,
  reportsGetSales,
  type ReportsDelivery,
  type ReportsSales,
  type ReportsSalesParams,
  type ReportsSeriesPoint,
} from "@store-builder/api-client";
import { KpiCard } from "@/components/KpiCard";
import { IconConfirm, IconCourier, IconOrders, IconWallet } from "@/components/icons";
import { fmt, useT, type Messages } from "@/i18n/LocaleContext";
import { deltaBasisPoints, formatCount } from "@/lib/analytics";
import { canViewAnalytics } from "@/lib/analyticsAccess";
import { apiClient } from "@/lib/apiClient";
import { isPermissionError } from "@/lib/errors";
import { formatMinorMoney, formatPercentValue } from "@/lib/format";
import { countOf } from "@/lib/plural";
import { invalidateCached, useCachedAsync } from "@/lib/useCachedAsync";
import { HomeSection, HomeSectionError } from "@/pages/home/today/HomeSection";
import { homeWindow, outOfTen, todayHours, type HomeRange, type HomeSectionProps } from "@/pages/home/today/homeTime";

/*
 * Egyptian Arabic, second person, short. Counted words come from lib/plural.ts
 * (`countOf`), so no sentence here carries a digit of its own: {days} is
 * "7 days" / «٧ أيام», {orders} is "46 orders" / «٤٦ أوردر».
 */
const STRINGS = {
  en: {
    today: "Today",
    lastDays: "Last {days}",
    theLastDays: "the last {days}",
    daysBefore: "the {days} before",
    allReports: "All reports",

    orders: "Orders",
    sales: "Sales",
    confirmed: "Confirmed",
    withCourier: "With the courier",

    vsYesterday: "vs yesterday up to the same hour",
    vsPeriod: "vs {period}",
    noYesterday: "No figures from yesterday to compare with",
    ordersNoneYesterday: "No orders by this hour yesterday",
    salesNoneYesterday: "No sales by this hour yesterday",
    ordersNoneToday: "No orders yet today",
    salesNoneToday: "No sales yet today",
    ordersNoneIn: "No orders in {period}",
    salesNoneIn: "No sales in {period}",

    ofToday: "{n} of today's {orders} — {pct}",
    ofPeriod: "{n} of {orders} in {period} — {pct}",
    codOrders: "{orders} on cash on delivery",
    noCodToday: "No cash-on-delivery orders today",
    noCodIn: "No cash-on-delivery orders in {period}",

    notLoaded: "This figure didn't load",
    partFailed: "Some of these figures didn't load.",
    failed: "We couldn't load these figures.",
    retry: "Try again",
  },
  ar: {
    today: "النهارده",
    lastDays: "آخر {days}",
    theLastDays: "آخر {days}",
    daysBefore: "الـ{days} اللي قبلها",
    allReports: "كل التقارير",

    orders: "الأوردرات",
    sales: "المبيعات",
    confirmed: "اتأكد",
    withCourier: "مع المندوب",

    vsYesterday: "عن إمبارح لحد نفس الساعة",
    vsPeriod: "عن {period}",
    noYesterday: "مفيش أرقام من إمبارح نقارن بيها",
    ordersNoneYesterday: "إمبارح لحد نفس الساعة ما كانش فيه أوردرات",
    salesNoneYesterday: "إمبارح لحد نفس الساعة ما كانش فيه مبيعات",
    ordersNoneToday: "لسه مفيش أوردرات النهارده",
    salesNoneToday: "لسه مفيش مبيعات النهارده",
    ordersNoneIn: "مفيش أوردرات في {period}",
    salesNoneIn: "مفيش مبيعات في {period}",

    ofToday: "{n} من {orders} النهارده — {pct}",
    ofPeriod: "{n} من {orders} في {period} — {pct}",
    codOrders: "{orders} دفع عند الاستلام",
    noCodToday: "مفيش أوردرات دفع عند الاستلام النهارده",
    noCodIn: "مفيش أوردرات دفع عند الاستلام في {period}",

    notLoaded: "الرقم ده ما اتحمّلش",
    partFailed: "جزء من الأرقام دي ما اتحمّلش.",
    failed: "معرفناش نجيب الأرقام دي.",
    retry: "جرّب تاني",
  },
} satisfies Messages;

type Strings = (typeof STRINGS)["en"];

/** Two to a row on a phone, the four in one row from lg up. */
const GRID = "grid grid-cols-2 gap-[var(--bento-gap)] lg:grid-cols-4";
/**
 * The height of a card with its trend line (label, figure, change, 44px of
 * chart). Every card holds it, so the row is the same height while it loads,
 * at 00:20 when there is no line to draw yet, and for the two cards that have
 * no line at all — their sentence uses that room instead.
 */
const CARD = "min-h-44";

/**
 * The share behind «اتأكد» and «مع المندوب», for the thin meter along the bottom
 * of those two cards — where the other two have their line (the API has no
 * series to draw for them, needs-backend H1). A class per tenth, spelled out
 * because Tailwind only writes the classes it finds in the source; tenths are
 * the home's own "N of every 10". The exact percent is in the card's sentence.
 * The meter itself is material (glass/home-cards.css, `.zimos-stat-share`):
 * the classes here only hand it the number and keep room for it.
 */
const SHARE = [
  "[--stat-share:0]",
  "[--stat-share:0.1]",
  "[--stat-share:0.2]",
  "[--stat-share:0.3]",
  "[--stat-share:0.4]",
  "[--stat-share:0.5]",
  "[--stat-share:0.6]",
  "[--stat-share:0.7]",
  "[--stat-share:0.8]",
  "[--stat-share:0.9]",
  "[--stat-share:1]",
] as const;
const shareMeter = (ratio: number) => `zimos-stat-share relative pb-9 ${SHARE[outOfTen(ratio * 100)]}`;

/**
 * "So far today, against yesterday up to the same hour" is only true for a
 * while: the figures are asked again this often while the page is open and
 * visible, and on coming back to it after longer than that.
 */
const REFRESH_MS = 5 * 60_000;

/** Tiles round to the whole pound, as the home always has; exact amounts live on the reports. */
const money = (amount: number, currency: string) => formatMinorMoney(Math.round(amount / 100) * 100, currency);

/** One call's answer: there, refused for this role (403), or failed for another reason. */
type Part<T> = { state: "ok"; value: T } | { state: "denied" } | { state: "failed" };

function settle<T>(result: PromiseSettledResult<T>): Part<T> {
  if (result.status === "fulfilled") return { state: "ok", value: result.value };
  return { state: isPermissionError(result.reason) ? "denied" : "failed" };
}

interface StatsData {
  /** The range these numbers answer; the section draws itself from this, never from a newer prop. */
  range: HomeRange;
  /** Today only: how many of the day's hourly buckets had happened when the request left. */
  hoursSoFar: number | null;
  sales: Part<ReportsSales>;
  delivery: Part<ReportsDelivery>;
}

/**
 * Two requests (home-data-map.md §B).
 *
 * Sales — today: the whole day by the hour with `compare: "previous"`, so
 * `series` is today's 24 hours and `previousSeries` yesterday's 24, and
 * "yesterday up to the same hour" is summed here (the API's own "previous" for
 * a window that ends now is yesterday afternoon and evening — needs-backend
 * H2). 7 / 30 days: by the day, where the API's "previous" is the period
 * before, as it should be.
 *
 * Delivery — of the orders placed in the range, how many are confirmed and how
 * many left with a courier, as they stand now (a cohort, not events of the
 * range — needs-backend H1).
 */
async function loadStats(workspaceId: string, range: HomeRange): Promise<StatsData> {
  const now = Date.now();
  let hoursSoFar: number | null = null;
  let salesParams: ReportsSalesParams;
  if (range === "today") {
    const day = todayHours(now);
    hoursSoFar = day.hoursSoFar;
    salesParams = { from: day.from, to: day.to, unit: "hour", compare: "previous" };
  } else {
    salesParams = { ...homeWindow(range, now), unit: "day", compare: "previous" };
  }
  const [sales, delivery] = await Promise.allSettled([
    reportsGetSales(apiClient, workspaceId, salesParams),
    reportsGetDelivery(apiClient, workspaceId, homeWindow(range, now)),
  ]);
  if (sales.status === "rejected" && delivery.status === "rejected") {
    // Both refused: this role does not see the section. Anything else is a real failure, with a retry.
    const bothRefused = isPermissionError(sales.reason) && isPermissionError(delivery.reason);
    throw bothRefused || !isPermissionError(sales.reason) ? sales.reason : delivery.reason;
  }
  return { range, hoursSoFar, sales: settle(sales), delivery: settle(delivery) };
}

/** What one card shows, ready for `KpiCard`. */
interface Stat {
  key: string;
  label: string;
  icon: ReactNode;
  to: string;
  value: ReactNode;
  delta?: number | null;
  deltaLabel?: string;
  hint?: string;
  trend?: number[];
  previousTrend?: number[];
  /** Classes for the share meter (`shareMeter`), on the two cards that have a share and no line. */
  meter?: string;
}

type Metric = "orders" | "sales";

const total = (points: ReportsSeriesPoint[], metric: Metric) => points.reduce((sum, point) => sum + point[metric], 0);

/** The range in words: the section title, and the two periods a sentence may name. */
function periodWords(t: Strings, range: HomeRange) {
  const days = countOf("day", range === "30d" ? 30 : 7);
  return {
    title: range === "today" ? t.today : fmt(t.lastDays, { days }),
    current: fmt(t.theLastDays, { days }),
    before: fmt(t.daysBefore, { days }),
  };
}

/**
 * Orders or sales of the range: the figure, its line, and the change — or, when
 * there is no fair comparison, the sentence that says why. A change from zero
 * is never a percentage (`deltaBasisPoints` answers null for it).
 */
function trendOf(t: Strings, report: ReportsSales, metric: Metric, range: HomeRange, hoursSoFar: number | null) {
  const kpi = metric === "orders" ? report.kpis.orders : report.kpis.totalSales;
  const points = (series: ReportsSeriesPoint[]) => series.map((point) => point[metric]);

  if (range === "today") {
    const hours = Math.min(hoursSoFar ?? report.series.length, report.series.length);
    const soFar = report.series.slice(0, hours);
    const current = kpi.value ?? total(soFar, metric);
    const yesterday = report.previousSeries;
    // Yesterday's buckets for the same hours. Missing or too short (no comparison asked for, a
    // day the clocks changed): there is nothing fair to compare with, and the card says so.
    const sameHours = yesterday !== null && hours > 0 && yesterday.length >= hours ? yesterday.slice(0, hours) : null;
    const before = sameHours ? total(sameHours, metric) : null;
    const delta = deltaBasisPoints(current, before);
    let hint: string | undefined;
    if (delta === null) {
      if (before === null) hint = t.noYesterday;
      else if (current > 0) hint = metric === "orders" ? t.ordersNoneYesterday : t.salesNoneYesterday;
      else hint = metric === "orders" ? t.ordersNoneToday : t.salesNoneToday;
    }
    return {
      current,
      delta,
      deltaLabel: t.vsYesterday,
      hint,
      trend: points(soFar),
      // The same hours of yesterday, dashed behind today's line. The sparkline stretches each
      // series over its whole width on its own, so yesterday's full 24 hours behind today's
      // hours so far would put last night under this afternoon; hour for hour, the picture is
      // the comparison the chip makes.
      previousTrend: sameHours ? points(sameHours) : undefined,
    };
  }

  const words = periodWords(t, range);
  const current = kpi.value ?? 0;
  const delta = deltaBasisPoints(kpi.value, kpi.previous);
  const noneIn = metric === "orders" ? t.ordersNoneIn : t.salesNoneIn;
  // A period before with nothing in it is said in words; with no period before at all, the card's own line says so.
  const hint = delta === null && kpi.previous === 0 ? fmt(noneIn, { period: current > 0 ? words.before : words.current }) : undefined;
  return {
    current,
    delta,
    deltaLabel: fmt(t.vsPeriod, { period: words.before }),
    hint,
    trend: points(report.series),
    previousTrend: report.previousSeries ? points(report.previousSeries) : undefined,
  };
}

/** «٣٢ من ٤٦ أوردر النهارده — ٧٠٪»: the count, what it is a share of, and the share. */
function shareSentence(t: Strings, range: HomeRange, part: number, ordersText: string, ratio: number) {
  const pct = formatPercentValue(ratio, 0);
  if (range === "today") return fmt(t.ofToday, { n: part, orders: ordersText, pct });
  return fmt(t.ofPeriod, { n: part, orders: ordersText, period: periodWords(t, range).current, pct });
}

function buildStats(t: Strings, data: StatsData): Stat[] {
  const { range } = data;
  const words = periodWords(t, range);
  const stats: Stat[] = [];
  const failed = { value: "—", hint: t.notLoaded };

  // 1 and 2 — orders and sales, with their line and the change.
  if (data.sales.state !== "denied") {
    const report = data.sales.state === "ok" ? data.sales.value : null;
    const orders = report ? trendOf(t, report, "orders", range, data.hoursSoFar) : null;
    const sales = report ? trendOf(t, report, "sales", range, data.hoursSoFar) : null;
    stats.push({
      key: "orders",
      label: t.orders,
      icon: <IconOrders />,
      to: "/orders",
      ...(orders
        ? { value: formatCount(orders.current), delta: orders.delta, deltaLabel: orders.deltaLabel, hint: orders.hint, trend: orders.trend, previousTrend: orders.previousTrend }
        : failed),
    });
    stats.push({
      key: "sales",
      label: t.sales,
      icon: <IconWallet />,
      to: "/analytics",
      ...(sales && report
        ? { value: money(sales.current, report.currency), delta: sales.delta, deltaLabel: sales.deltaLabel, hint: sales.hint, trend: sales.trend, previousTrend: sales.previousTrend }
        : failed),
    });
  }

  // 3 and 4 — of the range's orders, how many are confirmed and how many left with a courier.
  // No line and no change for the counts (needs-backend H1): the card says the share in words.
  if (data.delivery.state !== "denied") {
    const totals = data.delivery.state === "ok" ? data.delivery.value.totals : null;
    const noOrders = range === "today" ? t.ordersNoneToday : fmt(t.ordersNoneIn, { period: words.current });

    const confirmed: Stat = { key: "confirmed", label: t.confirmed, icon: <IconConfirm />, to: "/confirmation-queue", ...failed };
    if (totals) {
      confirmed.value = formatCount(totals.confirmed);
      if (totals.orders === 0) {
        confirmed.hint = noOrders;
      } else if (totals.codOrders === 0) {
        // Only cash on delivery has a confirmation call.
        confirmed.hint = range === "today" ? t.noCodToday : fmt(t.noCodIn, { period: words.current });
      } else {
        const counted = countOf("order", totals.codOrders);
        // Said only when the store also takes paid orders: then the base is not every order of the range.
        const ordersText = totals.codOrders === totals.orders ? counted : fmt(t.codOrders, { orders: counted });
        const ratio = (totals.confirmationRate ?? (totals.confirmed / totals.codOrders) * 100) / 100;
        confirmed.hint = shareSentence(t, range, totals.confirmed, ordersText, ratio);
        confirmed.meter = shareMeter(ratio);
        // No change chip, on purpose. The sales report does carry the confirmation rate of the
        // period before (`kpis.confirmationRate.previous`), but both rates are cohorts at their
        // state NOW: last week's orders have had a week longer to be called, this week's newest
        // are still waiting. Side by side they would show a drop on almost every day — a red
        // chip the merchant can do nothing about. A fair comparison needs counts by the time of
        // the event (needs-backend H1, H25).
      }
    }
    stats.push(confirmed);

    const courier: Stat = { key: "courier", label: t.withCourier, icon: <IconCourier />, to: "/orders?stage=shipped", ...failed };
    if (totals) {
      courier.value = formatCount(totals.shipped);
      if (totals.orders === 0) {
        courier.hint = noOrders;
      } else {
        const ratio = totals.shipped / totals.orders;
        courier.hint = shareSentence(t, range, totals.shipped, countOf("order", totals.orders), ratio);
        courier.meter = shareMeter(ratio);
      }
    }
    stats.push(courier);
  }

  return stats;
}

/**
 * «النهارده» — the four figures of the range: orders and sales with their line
 * and the change against the same hours of yesterday (or the period before),
 * then how many of those orders are confirmed and how many are with a courier.
 * Roles without analytics do not see it.
 */
export function TodayStats({ workspaceId, range, role }: HomeSectionProps) {
  const t = useT(STRINGS);
  const allowed = canViewAnalytics(role);
  const cacheKey = `home:stats:${workspaceId}:${range}`;
  const { data, error, loading, refresh } = useCachedAsync<StatsData | null>(
    allowed ? cacheKey : null,
    () => (allowed ? loadStats(workspaceId, range) : Promise.resolve(null)),
    [workspaceId, range, allowed]
  );

  // Whether the cards on screen are this range's own numbers: only then may a refresh run behind
  // them. After a failure, or with another range's numbers still held, it shows as loading.
  const showing = useRef(false);
  showing.current = !loading && !error && data != null && data.range === range;
  // Behind what is on screen: the cards keep their numbers until the new ones land, nothing flashes.
  useEffect(() => {
    if (!allowed) return;
    let last = Date.now();
    const ask = () => {
      if (document.visibilityState !== "visible" || Date.now() - last < REFRESH_MS) return;
      last = Date.now();
      void refresh({ silent: showing.current });
    };
    const timer = window.setInterval(ask, 60_000);
    document.addEventListener("visibilitychange", ask);
    return () => {
      window.clearInterval(timer);
      document.removeEventListener("visibilitychange", ask);
    };
  }, [allowed, refresh]);

  if (!allowed) return null;

  const retry = () => {
    // Forget the half answer first, so the cards show as loading while the new one is on its way.
    invalidateCached(cacheKey);
    void refresh();
  };
  // While the numbers of a newly chosen range are on their way the title already follows the
  // choice; once they are here, title and numbers always describe the same range.
  const shownRange = loading || !data ? range : data.range;
  const frame = { id: "home-stats", title: periodWords(t, shownRange).title, link: { to: "/analytics", label: t.allReports } };

  if (loading) {
    return (
      <HomeSection {...frame}>
        <div className={GRID}>
          <KpiCard loading label={t.orders} value="" icon={<IconOrders />} trend={[]} className={CARD} />
          <KpiCard loading label={t.sales} value="" icon={<IconWallet />} trend={[]} className={CARD} />
          <KpiCard loading label={t.confirmed} value="" icon={<IconConfirm />} hint={t.confirmed} className={CARD} />
          <KpiCard loading label={t.withCourier} value="" icon={<IconCourier />} hint={t.withCourier} className={CARD} />
        </div>
      </HomeSection>
    );
  }

  // A refresh that failed behind this range's own numbers leaves them on screen; the next one tries again.
  const failed = Boolean(error) && !(data != null && data.range === range);
  if (failed || !data) {
    if (!failed || isPermissionError(error)) return null;
    return (
      <HomeSection {...frame}>
        <HomeSectionError message={t.failed} retryLabel={t.retry} onRetry={retry} />
      </HomeSection>
    );
  }

  const stats = buildStats(t, data);
  if (stats.length === 0) return null;
  const partFailed = data.sales.state === "failed" || data.delivery.state === "failed";

  return (
    <HomeSection {...frame}>
      <div className={GRID}>
        {stats.map((stat) => (
          <KpiCard
            key={stat.key}
            label={stat.label}
            icon={stat.icon}
            to={stat.to}
            value={stat.value}
            deltaBasisPoints={stat.delta}
            deltaLabel={stat.deltaLabel}
            hint={stat.hint}
            trend={stat.trend}
            previousTrend={stat.previousTrend}
            className={stat.meter ? `${CARD} ${stat.meter}` : CARD}
          />
        ))}
      </div>
      {partFailed && (
        <div className="mt-[var(--bento-gap)]">
          <HomeSectionError message={t.partFailed} retryLabel={t.retry} onRetry={retry} />
        </div>
      )}
    </HomeSection>
  );
}
