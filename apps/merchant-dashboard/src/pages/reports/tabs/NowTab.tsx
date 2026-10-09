import { Suspense, lazy, useEffect, useMemo, useRef, useState } from "react";
import { useLocation, useSearchParams } from "react-router-dom";
import type { LiveBlock, LiveSnapshot } from "@store-builder/api-client";
import { Button, cn } from "@store-builder/ui";
import { AccordionSection } from "@/components/Accordion";
import { SkeletonBar } from "@/components/DataState";
import { KpiCard } from "@/components/KpiCard";
import {
  IconActivity,
  IconCart,
  IconCollapse,
  IconConfirm,
  IconExpand,
  IconGlobe,
  IconLostOrders,
  IconMap,
  IconOffline,
  IconOrders,
  IconPage,
  IconPeople,
  IconWallet,
  IconWebAnalytics,
} from "@/components/icons";
import {
  ReportChartCard,
  ReportKpiStrip,
  ReportLinks,
  ReportMore,
  ReportTab,
  ReportTabState,
  ReportTable,
  ReportTakeaway,
  type ReportColumn,
  type ReportTabProps,
  type ReportTakeawayAction,
  type ReportTone,
} from "@/components/report";
import { fmt, useLocale, useT, type Messages } from "@/i18n/LocaleContext";
import { formatCount } from "@/lib/analytics";
import { isPermissionError } from "@/lib/errors";
import { formatMoney, placeName } from "@/lib/format";
import { countOf, pluralOf } from "@/lib/plural";
import { LiveFunnelSelect } from "@/pages/analytics/LiveView";
import { REPORT_TAB_PATHS, REPORT_TAB_QUESTIONS } from "../reportTabs";
import { MinuteChart, type MinutePoint } from "./now/MinuteChart";
import { NowActivityLog, NowPages, NowSources, REALTIME_WINDOW_MINUTES, readablePath } from "./now/NowDetails";
import { useAgo, useTick } from "./now/ago";
import { FALLBACK_POLL_MS, useLiveSnapshot } from "./now/useLiveSnapshot";

// The map brings the world's geometry with it: fetched only when its section is opened.
const NowMap = lazy(() => import("./now/NowMap"));

const STRINGS = {
  en: {
    statusLive: "The stream is on — a new visitor or order shows up the moment it happens.",
    statusConnecting: "Connecting the live stream…",
    statusPolling: "The stream is down right now — the numbers refresh every {every} until it is back.",
    fullscreen: "Full screen",
    exitFullscreen: "Exit full screen",
    scopeNote:
      "With a funnel chosen, the people checking out, the orders, the sales and the map are that funnel's only. “Visitors now”, the chart, the pages and the sources stay the whole store's.",
    refreshFailed: "We couldn't refresh. These are the last numbers we got.",
    retry: "Try again",

    kpiVisitors: "Visitors now",
    kpiVisitorsHint: "In the last {window} · {today} today",
    kpiVisitorsHintFunnel: "Whole store, last {window} · {today} in this funnel today",
    kpiCheckout: "Checking out now",
    kpiCheckoutHint: "Filling in checkout in the last {window}",
    kpiCheckoutCappedHint: "At least {n} — only the latest {n} are listed",
    capped: "{n}+",
    kpiOrders: "Orders today",
    kpiSales: "Sales today",
    kpiTodayHint: "Since midnight, store time",
    visitorsCount_one: "1 visitor",
    visitorsCount_other: "{n} visitors",
    viewsCount_one: "1 page view",
    viewsCount_other: "{n} page views",

    chartTitle: "Visitors, minute by minute",
    chartNote: "The last {window}. Press a bar to read that minute's page views.",
    chartEmpty: "Nobody opened the store in the last {window}.",
    chartSummary: "Visitors per minute over the last {window}. This minute: {now}.",
    minuteLine: "{time}: {visitors} · {views}",
    now: "Now",

    feedTitle: "Checkouts and latest orders",
    feedNote: "People filling in checkout during the last {checkoutWindow}, and the newest orders of the last {orderWindow}.",
    feedEmpty: "Nobody is checking out right now, and there are no orders in the last {orderWindow}.",
    colWhat: "What",
    colWhen: "When",
    colValue: "Value",
    colPlace: "Place",
    colItems: "Items",
    colSource: "Through",
    order: "Order",
    checkout: "Checking out",
    sourceStore: "Store",
    sourceFunnel: "Funnel",

    joined: "{a} — {b}.",
    checkingOut_one: "1 person is checking out right now",
    checkingOut_other: "{n} people are checking out right now",
    checkingOutCapped: "More than {n} people are checking out right now",
    visitorsNow_one: "1 visitor is on the store right now",
    visitorsNow_other: "{n} visitors are on the store right now",
    visitorsNoCheckout: "{visitors}, and nobody is checking out yet — {last}.",
    visitorsWarn: "{visitors} and nobody has reached checkout — make sure your checkout page is working.",
    warnAction: "See where they leave",
    quiet: "The store is quiet right now — {last}.",
    quietToday: "The store is quiet right now: {visitors} today, and no orders in the last {orderWindow}.",
    thin: "Not enough activity to say anything yet: no visitors today and no orders in the last {orderWindow}. Share your store link, or check that your ads are running.",
    funnelQuiet: "Nobody is checking out in this funnel right now — {last}.",
    lastOrder: "the last order was {ago}",
    noOrders: "no orders in the last {orderWindow}",

    mapTitle: "Live map",
    mapSummary: "Where the visitors, the checkouts and the orders are, on a map",
    mapLoading: "Loading the map…",
    pagesTitle: "Top pages right now",
    pagesSummary: "Most opened: {page}",
    pagesSummaryEmpty: "No page opened in the last {window}",
    sourcesTitle: "Where they come from right now",
    sourcesSummary: "Top: {source}",
    sourcesSummaryEmpty: "Sites and countries of the last {window}",
    logTitle: "Activity log",
    logSummary: "{views} · {visitors} in the last {window}",

    linkStore: "Store visits in detail",
    linkStoreNote: "Who visits, where from, and the step where they leave",
    linkOrders: "Orders",
    linkOrdersNote: "Every new order and the ones on their way",
    linkConfirm: "Waiting for confirmation",
    linkConfirmNote: "Call the new orders and confirm them",
    linkLost: "Lost orders",
    linkLostNote: "Started an order and didn't finish — call them while it's fresh",
  },
  ar: {
    statusLive: "البث شغّال — أي زائر أو أوردر جديد بيظهر في لحظتها.",
    statusConnecting: "بنوصّل البث المباشر…",
    statusPolling: "البث واقف دلوقتي — الأرقام بتتحدّث كل {every} لحد ما يرجع.",
    fullscreen: "ملء الشاشة",
    exitFullscreen: "اخرج من ملء الشاشة",
    scopeNote:
      "مع اختيار مسار بيع: اللي بيكمّلوا الأوردر، والأوردرات والمبيعات والخريطة للمسار ده بس. «زوار دلوقتي» والرسم والصفحات والمصادر للمتجر كله.",
    refreshFailed: "معرفناش نحدّث الأرقام. دي آخر أرقام وصلتنا.",
    retry: "جرّب تاني",

    kpiVisitors: "زوار دلوقتي",
    kpiVisitorsHint: "في آخر {window} · {today} النهارده",
    kpiVisitorsHintFunnel: "المتجر كله، آخر {window} · {today} في المسار ده النهارده",
    kpiCheckout: "بيكمّلوا الأوردر دلوقتي",
    kpiCheckoutHint: "في صفحة إتمام الأوردر في آخر {window}",
    kpiCheckoutCappedHint: "{n} على الأقل — بنعرض آخر {n} بس",
    capped: "{n}+",
    kpiOrders: "أوردرات النهارده",
    kpiSales: "مبيعات النهارده",
    kpiTodayHint: "من أول اليوم بتوقيت المتجر",
    visitorsCount_zero: "مفيش زوار",
    visitorsCount_one: "زائر واحد",
    visitorsCount_two: "زائرين",
    visitorsCount_few: "{n} زوار",
    visitorsCount_other: "{n} زائر",
    viewsCount_zero: "مفيش مشاهدات",
    viewsCount_one: "مشاهدة واحدة",
    viewsCount_two: "مشاهدتين",
    viewsCount_few: "{n} مشاهدات",
    viewsCount_other: "{n} مشاهدة",

    chartTitle: "الزوار دقيقة بدقيقة",
    chartNote: "آخر {window}. دوس على أي عمود تقرا مشاهدات الدقيقة دي.",
    chartEmpty: "مفيش حد فتح المتجر في آخر {window}.",
    chartSummary: "الزوار في كل دقيقة في آخر {window}. الدقيقة دي: {now}.",
    minuteLine: "{time}: {visitors} · {views}",
    now: "دلوقتي",

    feedTitle: "اللي بيكمّلوا وآخر الأوردرات",
    feedNote: "اللي بيكمّلوا الأوردر في آخر {checkoutWindow}، وأحدث الأوردرات في آخر {orderWindow}.",
    feedEmpty: "مفيش حد بيكمّل أوردر دلوقتي، ومفيش أوردرات في آخر {orderWindow}.",
    colWhat: "إيه اللي حصل",
    colWhen: "من إمتى",
    colValue: "القيمة",
    colPlace: "المكان",
    colItems: "المنتجات",
    colSource: "جاي من",
    order: "أوردر",
    checkout: "بيكمّل الأوردر",
    sourceStore: "المتجر",
    sourceFunnel: "مسار بيع",

    joined: "{a} — {b}.",
    checkingOut_one: "واحد بيكمّل الأوردر دلوقتي",
    checkingOut_two: "اتنين بيكمّلوا الأوردر دلوقتي",
    checkingOut_few: "{n} بيكمّلوا الأوردر دلوقتي",
    checkingOut_other: "{n} بيكمّلوا الأوردر دلوقتي",
    checkingOutCapped: "أكتر من {n} بيكمّلوا الأوردر دلوقتي",
    visitorsNow_one: "زائر واحد في المتجر دلوقتي",
    visitorsNow_two: "زائرين في المتجر دلوقتي",
    visitorsNow_few: "{n} زوار في المتجر دلوقتي",
    visitorsNow_other: "{n} زائر في المتجر دلوقتي",
    visitorsNoCheckout: "{visitors}، ولسه محدّش بيكمّل أوردر — {last}.",
    visitorsWarn: "{visitors} ومفيش حد وصل لإتمام الأوردر — اتأكد إن صفحة إتمام الأوردر شغّالة.",
    warnAction: "شوف بيمشوا منين",
    quiet: "المتجر هادي دلوقتي — {last}.",
    quietToday: "المتجر هادي دلوقتي: {visitors} النهارده، ومفيش أوردرات في آخر {orderWindow}.",
    thin: "لسه مفيش حركة نقول منها حاجة: لا زوار النهارده ولا أوردرات في آخر {orderWindow}. شارك لينك المتجر، أو اتأكد إن إعلاناتك شغّالة.",
    funnelQuiet: "محدّش بيكمّل أوردر في مسار البيع ده دلوقتي — {last}.",
    lastOrder: "آخر أوردر {ago}",
    noOrders: "مفيش أوردرات في آخر {orderWindow}",

    mapTitle: "الخريطة المباشرة",
    mapSummary: "الزوار واللي بيكمّلوا والأوردرات فين، على الخريطة",
    mapLoading: "بنحمّل الخريطة…",
    pagesTitle: "أكتر الصفحات دلوقتي",
    pagesSummary: "الأكتر: {page}",
    pagesSummaryEmpty: "مفيش صفحة اتفتحت في آخر {window}",
    sourcesTitle: "الزوار جايين منين دلوقتي",
    sourcesSummary: "الأكتر: {source}",
    sourcesSummaryEmpty: "المواقع والدول في آخر {window}",
    logTitle: "سجل النشاط",
    logSummary: "{views} · {visitors} في آخر {window}",

    linkStore: "زيارات المتجر بالتفصيل",
    linkStoreNote: "مين بيزور، جاي منين، وبيمشي عند أنهي خطوة",
    linkOrders: "الأوردرات",
    linkOrdersNote: "كل الأوردرات الجديدة واللي في الطريق",
    linkConfirm: "مستني تأكيد",
    linkConfirmNote: "كلّم أصحاب الأوردرات الجديدة وأكّدها",
    linkLost: "الأوردرات المفقودة",
    linkLostNote: "بدأوا أوردر ومكمّلوش — كلّمهم وهمّ لسه فاكرين",
  },
} satisfies Messages;

/** The snapshot lists at most this many checkouts in progress: at the cap the real count is not known («٢٠+»). */
const CHECKOUT_CAP = 20;
/** A checkout is "in progress" while it was touched in the last ten minutes. */
const CHECKOUT_WINDOW_MINUTES = 10;
/** The latest orders are those of the last 24 hours. */
const ORDERS_WINDOW_HOURS = 24;
/** "Visitors now" are the sessions seen in the last five minutes. */
const ACTIVE_WINDOW_MINUTES = 5;
/** From this many visitors on the store, an empty checkout is worth a look (rule C of the sentence). */
const BUSY_VISITORS = 50;
/** The stream takes a moment to open: it is only called "down" once it has stayed closed this long. */
const CONNECT_GRACE_MS = 4000;
/** The id of the map's section: `?view=map` opens it and brings it into view. */
const MAP_SECTION_ID = "live-map";

/** One line of the live feed: a checkout being filled in, or an order just placed. */
interface FeedRow {
  key: string;
  kind: "checkout" | "order";
  /** When it last moved (a checkout) or was placed (an order), ISO. */
  at: string;
  atMs: number;
  amount: number;
  currency: string;
  /** The governorate as the API sends it, or null. */
  place: string | null;
  funnel: boolean;
  /** Lines in the cart; the snapshot gives it for checkouts only. */
  items: number | null;
  orderId: string | null;
  orderNumber: string | null;
}

/** Checkouts in progress and the latest orders as ONE list, newest first. */
function feedRows(live: LiveBlock): FeedRow[] {
  const ms = (iso: string) => {
    const value = new Date(iso).getTime();
    return Number.isFinite(value) ? value : 0;
  };
  const checkouts = live.checkingOut.map(
    (checkout): FeedRow => ({
      key: `checkout:${checkout.id}`,
      kind: "checkout",
      at: checkout.lastActivityAt,
      atMs: ms(checkout.lastActivityAt),
      amount: checkout.subtotalAmount,
      currency: checkout.currency,
      place: checkout.governorate,
      funnel: checkout.source === "funnel",
      items: checkout.items,
      orderId: null,
      orderNumber: null,
    })
  );
  const orders = live.purchases.map(
    (purchase): FeedRow => ({
      key: `order:${purchase.orderId}`,
      kind: "order",
      at: purchase.createdAt,
      atMs: ms(purchase.createdAt),
      amount: purchase.totalAmount,
      currency: purchase.currency,
      place: purchase.governorate,
      funnel: purchase.inFunnel,
      items: null,
      orderId: purchase.orderId,
      orderNumber: purchase.orderNumber,
    })
  );
  return [...checkouts, ...orders].sort((a, b) => b.atMs - a.atMs);
}

/** The outline of the map while its code is on the way. */
function MapLoading({ label }: { label: string }) {
  return (
    <div role="status" aria-live="polite" aria-busy="true" className="min-w-0">
      <span className="sr-only">{label}</span>
      <SkeletonBar className="h-48 w-full rounded-2xl sm:h-72" />
    </div>
  );
}

interface NowBodyProps {
  workspaceId: string;
  snapshot: LiveSnapshot;
  /** The funnel the live block is narrowed to; "" for the whole store. */
  funnelId: string;
  refreshFailed: boolean;
  onRetry: () => void;
  mapOpen: boolean;
  onMapOpenChange: (open: boolean) => void;
  /** The store tab, with the hub's range kept. */
  storeTo: string;
}

/** The parts of the tab, once there is a snapshot: KPI strip, chart, feed, sentence, «تفاصيل أكتر», links. */
function NowBody({ workspaceId, snapshot, funnelId, refreshFailed, onRetry, mapOpen, onMapOpenChange, storeTo }: NowBodyProps) {
  const t = useT(STRINGS);
  const { intlLocale } = useLocale();
  const { ago } = useAgo();
  // «من ١٢ ثانية» keeps counting between two snapshots.
  useTick(5000);

  const { realtime, live } = snapshot;
  const scoped = funnelId !== "";

  const rows = useMemo(() => feedRows(live), [live]);
  const points = useMemo<MinutePoint[]>(() => {
    const clock = new Intl.DateTimeFormat(intlLocale, { hour: "numeric", minute: "2-digit" });
    return realtime.series.map((point) => {
      const minute = new Date(point.t);
      return {
        key: point.t,
        label: Number.isNaN(minute.getTime()) ? point.t : clock.format(minute),
        visitors: point.visitors,
        views: point.pageviews,
      };
    });
  }, [realtime.series, intlLocale]);

  const visitorsNow = realtime.activeVisitors;
  const checkoutCount = live.checkingOut.length;
  const capped = checkoutCount >= CHECKOUT_CAP;
  const activeWindow = countOf("minute", ACTIVE_WINDOW_MINUTES);
  const checkoutWindow = countOf("minute", CHECKOUT_WINDOW_MINUTES);
  const orderWindow = countOf("hour", ORDERS_WINDOW_HOURS);
  const realtimeWindow = countOf("minute", REALTIME_WINDOW_MINUTES);
  const todayVisitors = pluralOf(t, "visitorsCount", live.today.visitors);

  // ---------------------------------------------------------------- chart --
  const chartWindow = countOf("minute", Math.max(1, points.length));
  const chartEmpty = points.length === 0 || points.every((point) => point.visitors === 0 && point.views === 0);
  const describeMinute = (point: MinutePoint) =>
    fmt(t.minuteLine, {
      time: point.label,
      visitors: pluralOf(t, "visitorsCount", point.visitors),
      views: pluralOf(t, "viewsCount", point.views),
    });
  const runningMinute = points.length > 0 ? points[points.length - 1].visitors : 0;

  // ----------------------------------------------------------------- feed --
  const columns: ReportColumn<FeedRow>[] = [
    {
      key: "what",
      header: t.colWhat,
      cell: (row) => (
        <span className="inline-flex max-w-full min-w-0 items-center gap-2 align-middle">
          <span
            aria-hidden
            className={cn(
              "flex size-7 shrink-0 items-center justify-center rounded-lg",
              row.kind === "order" ? "bg-success-soft text-success" : "bg-accent-soft text-accent-dark"
            )}
          >
            {row.kind === "order" ? <IconOrders className="size-4" /> : <IconCart className="size-4" />}
          </span>
          <span className="min-w-0 truncate">
            {row.kind === "order" ? (
              <>
                {t.order} <bdi dir="ltr">{row.orderNumber}</bdi>
              </>
            ) : (
              t.checkout
            )}
          </span>
        </span>
      ),
      sortValue: (row) => (row.kind === "order" ? `${t.order} ${row.orderNumber ?? ""}` : t.checkout),
      csv: (row) => (row.kind === "order" ? `${t.order} ${row.orderNumber ?? ""}` : t.checkout),
    },
    {
      key: "when",
      header: t.colWhen,
      cell: (row) => ago(row.at),
      sortValue: (row) => row.atMs,
      csv: (row) => row.at,
    },
    {
      key: "value",
      header: t.colValue,
      align: "end",
      cell: (row) => formatMoney(row.amount, row.currency),
      sortValue: (row) => row.amount,
      // Whole units of the row's currency, as a plain number a spreadsheet can add up.
      csv: (row) => row.amount / 100,
    },
    {
      key: "place",
      header: t.colPlace,
      cell: (row) => placeName(row.place) || "—",
      sortValue: (row) => placeName(row.place) || null,
      csv: (row) => placeName(row.place),
    },
    {
      key: "items",
      header: t.colItems,
      align: "end",
      cell: (row) => (row.items === null ? "—" : formatCount(row.items)),
      sortValue: (row) => row.items,
      csv: (row) => row.items,
    },
    {
      key: "source",
      header: t.colSource,
      cell: (row) => (row.funnel ? t.sourceFunnel : t.sourceStore),
      sortValue: (row) => (row.funnel ? t.sourceFunnel : t.sourceStore),
      csv: (row) => (row.funnel ? t.sourceFunnel : t.sourceStore),
    },
  ];

  // ------------------------------------------------------------- sentence --
  /*
   * The ONE sentence: what is happening this minute. First match wins.
   *
   *  A. Somebody is at checkout — at least one checkout touched in the last 10
   *     minutes → good: «٣ بيكمّلوا الأوردر دلوقتي — آخر أوردر من ٤ دقايق».
   *     At the snapshot's cap of 20 rows it says «أكتر من ٢٠»: the real count
   *     is not known.
   *  B. A funnel is chosen and nobody is at its checkout → info, with the last
   *     order. Visitors are not used here: "visitors now" is the whole store's
   *     while the checkouts are the funnel's, and comparing the two would
   *     compare nothing.
   *  C. Nobody at checkout and BUSY_VISITORS (50) or more on the store in the
   *     last 5 minutes → warn, with a link to the store tab. Fifty is where an
   *     empty checkout stops being normal: of fifty visitors one or two would
   *     usually have reached it. Below that it is only a quiet minute.
   *  D. Nobody at checkout and 1–49 visitors → info: who is here, and the last
   *     order.
   *  E. Nobody on the store at all → info: «المتجر هادي دلوقتي» with the last
   *     order of the last 24 hours; without one, with today's visitors; and
   *     with neither there is too little to say anything — it says exactly
   *     that, and what to try (share the link, check the ads).
   *
   * The newest order is taken from the feed (the latest orders of the last 24
   * hours); every "… ago" is measured now, so the sentence stays true between
   * two snapshots.
   */
  const lastOrder = rows.find((row) => row.kind === "order") ?? null;
  const lastText = lastOrder ? fmt(t.lastOrder, { ago: ago(lastOrder.at) }) : fmt(t.noOrders, { orderWindow });
  let tone: ReportTone = "info";
  let sentence: string;
  let action: ReportTakeawayAction | undefined;
  if (checkoutCount > 0) {
    tone = "good";
    const who = capped ? fmt(t.checkingOutCapped, { n: CHECKOUT_CAP }) : pluralOf(t, "checkingOut", checkoutCount);
    sentence = fmt(t.joined, { a: who, b: lastText });
  } else if (scoped) {
    sentence = fmt(t.funnelQuiet, { last: lastText });
  } else if (visitorsNow >= BUSY_VISITORS) {
    tone = "warn";
    sentence = fmt(t.visitorsWarn, { visitors: pluralOf(t, "visitorsNow", visitorsNow) });
    action = { label: t.warnAction, to: storeTo };
  } else if (visitorsNow > 0) {
    sentence = fmt(t.visitorsNoCheckout, { visitors: pluralOf(t, "visitorsNow", visitorsNow), last: lastText });
  } else if (lastOrder) {
    sentence = fmt(t.quiet, { last: lastText });
  } else if (live.today.visitors > 0) {
    sentence = fmt(t.quietToday, { visitors: todayVisitors, orderWindow });
  } else {
    sentence = fmt(t.thin, { orderWindow });
  }

  // ----------------------------------------------------------------- more --
  const topPage = realtime.urls.length > 0 ? readablePath(realtime.urls[0].x) || "/" : null;
  const topSource = realtime.referrers.length > 0 ? realtime.referrers[0].x : null;

  return (
    <>
      {scoped && <p className="text-[13px] leading-5 text-pretty text-ink-soft">{t.scopeNote}</p>}

      {refreshFailed && (
        <p role="status" className="flex min-w-0 flex-wrap items-center gap-2 rounded-2xl bg-paper-raised px-4 py-2.5 text-sm leading-6 text-ink-soft ring-1 ring-line">
          <IconOffline className="size-4 shrink-0 text-danger" aria-hidden />
          <span className="min-w-0 flex-1">{t.refreshFailed}</span>
          <Button variant="outline" size="sm" className="h-11 rounded-full px-4" onClick={onRetry}>
            {t.retry}
          </Button>
        </p>
      )}

      {/* No comparison exists for a live figure: no chip, and each card says in words what it is measured over. */}
      <ReportKpiStrip count={4} sparkline={false}>
        <KpiCard
          label={t.kpiVisitors}
          value={formatCount(visitorsNow)}
          hint={fmt(scoped ? t.kpiVisitorsHintFunnel : t.kpiVisitorsHint, { window: activeWindow, today: todayVisitors })}
          icon={<IconPeople />}
        />
        <KpiCard
          label={t.kpiCheckout}
          value={capped ? fmt(t.capped, { n: CHECKOUT_CAP }) : formatCount(checkoutCount)}
          hint={capped ? fmt(t.kpiCheckoutCappedHint, { n: CHECKOUT_CAP }) : fmt(t.kpiCheckoutHint, { window: checkoutWindow })}
          icon={<IconCart />}
        />
        <KpiCard label={t.kpiOrders} value={formatCount(live.today.orders)} hint={t.kpiTodayHint} icon={<IconOrders />} to="/orders" />
        <KpiCard label={t.kpiSales} value={formatMoney(live.today.sales, live.currency)} hint={t.kpiTodayHint} icon={<IconWallet />} />
      </ReportKpiStrip>

      <ReportChartCard
        title={t.chartTitle}
        note={fmt(t.chartNote, { window: chartWindow })}
        height={240}
        empty={chartEmpty ? fmt(t.chartEmpty, { window: chartWindow }) : null}
      >
        {(height) => (
          <MinuteChart
            points={points}
            height={height}
            summary={fmt(t.chartSummary, { window: chartWindow, now: pluralOf(t, "visitorsCount", runningMinute) })}
            format={formatCount}
            describe={describeMinute}
            nowLabel={t.now}
          />
        )}
      </ReportChartCard>

      <ReportTable<FeedRow>
        columns={columns}
        rows={rows}
        rowKey={(row) => row.key}
        defaultSort={{ key: "when", dir: "desc" }}
        exportName="zimos-live-feed"
        caption={t.feedTitle}
        note={fmt(t.feedNote, { checkoutWindow, orderWindow })}
        empty={fmt(t.feedEmpty, { orderWindow })}
        rowTo={(row) => (row.orderId ? `/orders/${row.orderId}` : null)}
      />

      <ReportTakeaway tone={tone} action={action}>
        {sentence}
      </ReportTakeaway>

      <ReportMore>
        <AccordionSection
          id={MAP_SECTION_ID}
          title={t.mapTitle}
          summary={t.mapSummary}
          icon={IconMap}
          open={mapOpen}
          onOpenChange={onMapOpenChange}
        >
          <Suspense fallback={<MapLoading label={t.mapLoading} />}>
            <NowMap workspaceId={workspaceId} funnelId={funnelId} />
          </Suspense>
        </AccordionSection>

        <AccordionSection
          title={t.pagesTitle}
          summary={topPage ? fmt(t.pagesSummary, { page: topPage }) : fmt(t.pagesSummaryEmpty, { window: realtimeWindow })}
          icon={IconPage}
          persistKey="reports:now:pages"
        >
          <NowPages rows={realtime.urls} />
        </AccordionSection>

        <AccordionSection
          title={t.sourcesTitle}
          summary={topSource ? fmt(t.sourcesSummary, { source: topSource }) : fmt(t.sourcesSummaryEmpty, { window: realtimeWindow })}
          icon={IconGlobe}
          persistKey="reports:now:sources"
        >
          <NowSources referrers={realtime.referrers} countries={realtime.countries} />
        </AccordionSection>

        <AccordionSection
          title={t.logTitle}
          summary={fmt(t.logSummary, {
            views: pluralOf(t, "viewsCount", realtime.totals.views),
            visitors: pluralOf(t, "visitorsCount", realtime.totals.visitors),
            window: realtimeWindow,
          })}
          icon={IconActivity}
          persistKey="reports:now:log"
        >
          <NowActivityLog realtime={realtime} />
        </AccordionSection>
      </ReportMore>

      <ReportLinks
        items={[
          { to: storeTo, title: t.linkStore, description: t.linkStoreNote, icon: IconWebAnalytics },
          { to: "/orders", title: t.linkOrders, description: t.linkOrdersNote, icon: IconOrders },
          { to: "/confirmation-queue", title: t.linkConfirm, description: t.linkConfirmNote, icon: IconConfirm },
          { to: "/abandoned-carts", title: t.linkLost, description: t.linkLostNote, icon: IconLostOrders },
        ]}
      />
    </>
  );
}

/**
 * «دلوقتي» — what is happening this minute. The seventh tab of the reports hub,
 * built from the old realtime screen (pages/analytics/RealtimePage.tsx,
 * LiveView.tsx, liveMap/): it ignores the hub's range and keeps itself current
 * — the server's stream, a ten-second request while the stream is down, nothing
 * asked while the browser tab is hidden (now/useLiveSnapshot.ts).
 *
 * The anatomy every tab shares:
 * - KPI strip: visitors now · checking out now («٢٠+» at the snapshot's cap) ·
 *   orders today · sales today — no change chip (nothing to compare a live
 *   figure with), each card saying what it is measured over;
 * - the ONE chart: visitors minute by minute, the last minutes of the
 *   realtime series, each minute's page views one tap away;
 * - the ONE table: the live feed — checkouts in progress and the latest
 *   orders as one list (an order row opens the order), sortable, and
 *   exportable as the snapshot on screen;
 * - the ONE sentence (the rule is written above it, in NowBody);
 * - «تفاصيل أكتر»: the live map (its code and its request only when opened;
 *   `?view=map` opens it), top pages, sources, and the activity log with the
 *   totals of the last 30 minutes;
 * - links to the store tab, the orders, the confirmation queue and the lost
 *   orders.
 *
 * Permissions: a 403 on the snapshot is the kit's no-permission state (and the
 * stream is not asked for again); a 403 on the map leaves a quiet line in its
 * section; any other failure is the part's own line with «جرّب تاني».
 */
export default function NowTab({ workspaceId }: ReportTabProps) {
  const t = useT(STRINGS);
  const questions = useT(REPORT_TAB_QUESTIONS);
  const location = useLocation();
  const [params, setParams] = useSearchParams();
  const { seconds } = useAgo();
  // The store, or one funnel: shared by the tab and its map (component state, as on the old screen).
  const [funnelId, setFunnelId] = useState("");
  const live = useLiveSnapshot(workspaceId, funnelId);
  const denied = isPermissionError(live.error);

  // Opening the stream (on arrival, after a drop, after choosing a funnel) takes a moment: say "connecting"
  // first, and "down" only when it has stayed closed for a few seconds.
  const [connecting, setConnecting] = useState(true);
  useEffect(() => {
    setConnecting(true);
    if (live.connected) return;
    const id = window.setTimeout(() => setConnecting(false), CONNECT_GRACE_MS);
    return () => window.clearTimeout(id);
  }, [live.connected, funnelId, workspaceId]);
  const statusText = live.connected
    ? t.statusLive
    : connecting
      ? t.statusConnecting
      : fmt(t.statusPolling, { every: seconds(FALLBACK_POLL_MS / 1000) });

  // ---------------------------------------------------------- full screen --
  const frame = useRef<HTMLDivElement>(null);
  const [fullscreen, setFullscreen] = useState(false);
  useEffect(() => {
    const onChange = () => setFullscreen(document.fullscreenElement !== null && document.fullscreenElement === frame.current);
    document.addEventListener("fullscreenchange", onChange);
    return () => document.removeEventListener("fullscreenchange", onChange);
  }, []);
  // Offered only where the browser can do it (an iPhone cannot).
  const canFullscreen = typeof document !== "undefined" && document.fullscreenEnabled === true;
  function toggleFullscreen() {
    const element = frame.current;
    if (!element) return;
    if (document.fullscreenElement) void document.exitFullscreen().catch(() => undefined);
    else void element.requestFullscreen?.().catch(() => undefined);
  }

  // -------------------------------------------------------------- the map --
  // `?view=map` (the old screen's "Live view" tab, and its links) opens the map's section; opening
  // and closing the section keeps the address in step, so the view can be shared.
  const mapOpen = params.get("view") === "map";
  function setMapOpen(open: boolean) {
    setParams(
      (previous) => {
        const next = new URLSearchParams(previous);
        if (open) next.set("view", "map");
        else next.delete("view");
        return next;
      },
      { replace: true }
    );
  }
  // Arriving on `?view=map`, the section is brought into view once the tab has drawn it.
  const arrivedOnMap = useRef(mapOpen);
  const ready = live.snapshot !== null;
  useEffect(() => {
    if (!ready || !arrivedOnMap.current) return;
    arrivedOnMap.current = false;
    document.getElementById(MAP_SECTION_ID)?.scrollIntoView({ block: "start" });
  }, [ready]);

  // The store tab keeps the hub's range; this tab's own `view` does not go along.
  const storeTo = useMemo(() => {
    const search = new URLSearchParams(location.search);
    search.delete("view");
    const query = search.toString();
    return query ? `${REPORT_TAB_PATHS.store}?${query}` : REPORT_TAB_PATHS.store;
  }, [location.search]);

  return (
    <div
      ref={frame}
      className="min-w-0 [&:fullscreen]:overflow-y-auto [&:fullscreen]:bg-paper [&:fullscreen]:p-4 sm:[&:fullscreen]:p-6"
    >
      <ReportTab question={questions.now}>
        {!denied && (
          <div className="flex min-w-0 flex-wrap items-center gap-x-3 gap-y-2">
            <p role="status" className="flex min-w-0 flex-[1_1_14rem] items-start gap-2 text-sm leading-6 text-pretty text-ink-soft">
              <span
                aria-hidden
                className={cn(
                  "mt-2 size-2 shrink-0 rounded-full",
                  live.connected ? "bg-success motion-safe:animate-pulse" : "bg-line-strong"
                )}
              />
              <span className="min-w-0">
                {statusText}
              </span>
            </p>
            {/* Nothing when the store has no funnels — and then the box is hidden. */}
            <div className="order-last w-full min-w-0 empty:hidden sm:order-none sm:w-auto">
              <LiveFunnelSelect
                workspaceId={workspaceId}
                value={funnelId}
                onChange={setFunnelId}
                className="h-11 w-full max-w-none sm:w-auto sm:max-w-[16rem]"
              />
            </div>
            {canFullscreen && (
              <Button
                variant="outline"
                onClick={toggleFullscreen}
                aria-label={fullscreen ? t.exitFullscreen : t.fullscreen}
                aria-pressed={fullscreen}
                className="h-11 w-11 shrink-0 rounded-full p-0 sm:w-auto sm:px-4"
              >
                {fullscreen ? <IconCollapse className="size-4" aria-hidden /> : <IconExpand className="size-4" aria-hidden />}
                <span className="hidden sm:inline">{fullscreen ? t.exitFullscreen : t.fullscreen}</span>
              </Button>
            )}
          </div>
        )}

        <ReportTabState loading={live.loading} error={live.error} onRetry={live.retry}>
          {live.snapshot && (
            <NowBody
              workspaceId={workspaceId}
              snapshot={live.snapshot}
              funnelId={funnelId}
              refreshFailed={live.refreshFailed}
              onRetry={live.retry}
              mapOpen={mapOpen}
              onMapOpenChange={setMapOpen}
              storeTo={storeTo}
            />
          )}
        </ReportTabState>
      </ReportTab>
    </div>
  );
}
