import { Link } from "react-router-dom";
import {
  AlertTriangle,
  BadgeCheck,
  ChevronLeft,
  ClipboardCheck,
  MapPin,
  PackageX,
  PiggyBank,
  ShoppingBag,
  ShoppingCart,
  Sparkles,
  Truck,
  TrendingDown,
  TrendingUp,
  Wallet,
  type LucideIcon,
} from "lucide-react";
import { cn } from "@store-builder/ui";
import type { ConfirmationQueueCounts, InsightsOverview, OrderPipeline, ProfitPnl } from "@store-builder/api-client";
import { BentoAnswer, BentoFigure, BentoTile } from "@/components/Bento";
import { Sparkline } from "@/components/charts";
import { formatMinorMoney, formatPercentValue } from "@/lib/format";
import { formatCount } from "@/lib/analytics";
import { pluralOf } from "@/lib/plural";
import { fmt, useT, type Messages } from "@/i18n/LocaleContext";

export type HomeRange = "today" | "7d" | "30d";

/*
 * Egyptian Arabic, second person, short. Plural forms follow lib/plural.ts:
 * `<key>_one/_two/_few/_other` (English only needs _one/_other).
 */
const STRINGS = {
  en: {
    when_today: "today",
    when_7d: "in the last 7 days",
    when_30d: "in the last 30 days",

    needsEyebrow: "Needs you now",
    needsAllClear: "Nothing is waiting for you right now",
    needsAllClearBody: "Every order is confirmed and on its way. Share your store link to bring in the next ones.",
    needsAllClearAction: "See all orders",
    confirm_one: "1 order is waiting for a confirmation call",
    confirm_other: "{n} orders are waiting for a confirmation call",
    confirmCta: "Start calling",
    ship_one: "1 confirmed order is ready to ship",
    ship_other: "{n} confirmed orders are ready to ship",
    shipCta: "Book the courier",
    failed_one: "1 delivery failed — call the customer",
    failed_other: "{n} deliveries failed — call the customers",
    failedCta: "Follow up",
    follow_one: "1 order needs a follow-up",
    follow_other: "{n} orders need a follow-up",
    followCta: "Open",

    profitEyebrow: "Net profit",
    profitNone: "No orders {when} to work out your profit from yet.",
    profitUp: "You made about {amount} {when}, after product cost, shipping, fees and ads.",
    profitDown: "You lost about {amount} {when}: shipping, returns and ads cost more than you earned.",
    profitOpen: "Includes orders still on the road, at your usual delivery rate.",
    profitCoverage: "Only {pct} of the items sold have a cost, so the real profit may be lower.",
    profitAddCosts: "Add product costs",
    profitNoCosts: "Add what each product costs you, and we will tell you what you really earned.",
    profitBeforeCost: "Before product cost, {amount} came in {when} after shipping and fees.",
    profitOpenReport: "Open the profit report",

    productEyebrowLoss: "A product is losing you money",
    productEyebrowWin: "Your best earner",
    productLoss: "“{name}” lost you {amount} {when}.",
    productLossWhy: "{returned} of its {finished} finished orders came back.",
    productWin: "“{name}” earned you the most {when}: {amount}.",
    productTop: "Your best seller {when} is “{name}” ({units} sold).",
    productNoName: "A deleted product",
    productAction: "See why",

    salesEyebrow: "Sales",
    ordersEyebrow: "Orders",
    deltaUp: "{pct} more than the period before",
    deltaDown: "{pct} less than the period before",
    deltaSame: "Same as the period before",
    deltaNone: "Nothing to compare with yet",

    confirmRateEyebrow: "Confirmation",
    confirmRateAnswer: "You confirm {n} of every 10 cash-on-delivery orders.",
    deliveryRateEyebrow: "Delivery",
    deliveryRateAnswer: "{n} of every 10 parcels handed to the courier reach the customer.",
    rateNone: "Shows up after your first orders.",
    pointsUp: "{n} points better than the period before",
    pointsDown: "{n} points worse than the period before",

    lostEyebrow: "Lost orders",
    lost_one: "1 customer started an order {when} and didn't finish it.",
    lost_other: "{n} customers started an order {when} and didn't finish it.",
    lostAction: "Bring them back",

    whereEyebrow: "Where orders come from",
    whereGov: "Most of your orders {when} come from {name} ({n}).",
    whereSource: "Your top traffic source is {name}.",
    direct: "direct visits",
    whereAction: "See sales sources",
    storeWide: "visits are for the whole store",
  },
  ar: {
    when_today: "النهارده",
    when_7d: "في آخر ٧ أيام",
    when_30d: "في آخر ٣٠ يوم",

    needsEyebrow: "مستنياك دلوقتي",
    needsAllClear: "مفيش حاجة مستنياك دلوقتي",
    needsAllClearBody: "كل الأوردرات اتأكدت وفي طريقها. شارك لينك متجرك عشان تجيب الأوردرات الجاية.",
    needsAllClearAction: "شوف كل الأوردرات",
    confirm_one: "أوردر واحد مستني مكالمة تأكيد",
    confirm_two: "أوردرين مستنيين مكالمة تأكيد",
    confirm_few: "{n} أوردرات مستنية مكالمة تأكيد",
    confirm_other: "{n} أوردر مستني مكالمة تأكيد",
    confirmCta: "ابدأ الاتصال",
    ship_one: "أوردر واحد متأكد وجاهز للشحن",
    ship_two: "أوردرين متأكدين وجاهزين للشحن",
    ship_few: "{n} أوردرات متأكدة وجاهزة للشحن",
    ship_other: "{n} أوردر متأكد وجاهز للشحن",
    shipCta: "احجز المندوب",
    failed_one: "أوردر واحد التوصيل فشل فيه — كلّم العميل",
    failed_two: "أوردرين التوصيل فشل فيهم — كلّم العملاء",
    failed_few: "{n} أوردرات التوصيل فشل فيها — كلّم العملاء",
    failed_other: "{n} أوردر التوصيل فشل فيه — كلّم العملاء",
    failedCta: "تابع",
    follow_one: "أوردر واحد محتاج متابعة",
    follow_two: "أوردرين محتاجين متابعة",
    follow_few: "{n} أوردرات محتاجة متابعة",
    follow_other: "{n} أوردر محتاج متابعة",
    followCta: "افتح",

    profitEyebrow: "صافي الربح",
    profitNone: "لسه مفيش أوردرات {when} نحسب منها ربحك.",
    profitUp: "كسبت تقريبًا {amount} {when}، بعد تكلفة المنتج والشحن والرسوم والإعلانات.",
    profitDown: "خسرت تقريبًا {amount} {when}: الشحن والمرتجعات والإعلانات أكتر من اللي كسبته.",
    profitOpen: "محسوب معاه الأوردرات اللي لسه في الطريق، بنسبة التسليم بتاعتك.",
    profitCoverage: "{pct} بس من القطع اللي اتباعت ليها تكلفة، فالربح الحقيقي ممكن يكون أقل.",
    profitAddCosts: "ضيف تكلفة المنتجات",
    profitNoCosts: "ضيف تكلفة كل منتج، وإحنا نقولك كسبت كام بجد.",
    profitBeforeCost: "قبل تكلفة المنتج، دخلك {amount} {when} بعد الشحن والرسوم.",
    profitOpenReport: "افتح تقرير الربح",

    productEyebrowLoss: "منتج بيخسّرك",
    productEyebrowWin: "أكتر منتج بيكسّبك",
    productLoss: "«{name}» خسّرك {amount} {when}.",
    productLossWhy: "{returned} من {finished} أوردر خلصوا رجعوا مرتجع.",
    productWin: "«{name}» أكتر منتج كسّبك {when}: {amount}.",
    productTop: "أكتر منتج اتباع {when} هو «{name}» ({units} قطعة).",
    productNoName: "منتج اتمسح",
    productAction: "اعرف السبب",

    salesEyebrow: "المبيعات",
    ordersEyebrow: "الأوردرات",
    deltaUp: "أكتر من الفترة اللي قبلها بـ {pct}",
    deltaDown: "أقل من الفترة اللي قبلها بـ {pct}",
    deltaSame: "زي الفترة اللي قبلها",
    deltaNone: "لسه مفيش حاجة نقارن بيها",

    confirmRateEyebrow: "التأكيد",
    confirmRateAnswer: "بتأكد {n} من كل ١٠ أوردرات دفع عند الاستلام.",
    deliveryRateEyebrow: "التسليم",
    deliveryRateAnswer: "{n} من كل ١٠ شحنات بتخرج مع المندوب بتوصل للعميل.",
    rateNone: "هتظهر بعد أول أوردرات.",
    pointsUp: "أحسن من الفترة اللي قبلها بـ {n} نقطة",
    pointsDown: "أقل من الفترة اللي قبلها بـ {n} نقطة",

    lostEyebrow: "الأوردرات المفقودة",
    lost_one: "عميل واحد بدأ يطلب {when} ومكمّلش.",
    lost_two: "عميلين بدأوا يطلبوا {when} ومكمّلوش.",
    lost_few: "{n} عملاء بدأوا يطلبوا {when} ومكمّلوش.",
    lost_other: "{n} عميل بدأوا يطلبوا {when} ومكمّلوش.",
    lostAction: "رجّعهم",

    whereEyebrow: "الأوردرات جاية منين",
    whereGov: "أغلب أوردراتك {when} من {name} ({n}).",
    whereSource: "وأكتر مصدر بيجيب زيارات: {name}.",
    direct: "الزيارات المباشرة",
    whereAction: "شوف مصادر المبيعات",
    storeWide: "الزيارات للمتجر كله",
  },
} satisfies Messages;

type Strings = (typeof STRINGS)["en"];

function useStrings() {
  return useT(STRINGS);
}

function whenOf(t: Strings, range: HomeRange) {
  return range === "today" ? t.when_today : range === "7d" ? t.when_7d : t.when_30d;
}

/** Tiles round to the whole pound: "٤٬٤١٧ ج.م.", not "٤٬٤١٦٫٦٧ ج.م.". Exact amounts live on the reports. */
/** A name inside a sentence of the other script keeps its own direction (Unicode FSI…PDI). */
const isolate = (text: string) => `⁨${text}⁩`;

const money = (amount: number, currency: string) => formatMinorMoney(Math.round(amount / 100) * 100, currency);

/** Below this share of sold items with a known cost, a profit figure would mislead. */
const MIN_COST_COVERAGE = 80;

/* ------------------------------------------------------------------ */

interface NeedsYouProps {
  queue: ConfirmationQueueCounts | null;
  pipeline: OrderPipeline | null;
}

/**
 * The hero tile: what is waiting for the merchant, as a short to-do list,
 * each line one tap from the screen that clears it.
 */
export function NeedsYouTile({ queue, pipeline }: NeedsYouProps) {
  const t = useStrings();
  const rows: { key: string; icon: LucideIcon; text: string; cta: string; to: string }[] = [];
  const pending = queue?.pending ?? 0;
  if (pending > 0)
    rows.push({ key: "confirm", icon: ClipboardCheck, text: pluralOf(t, "confirm", pending), cta: t.confirmCta, to: "/confirmation-queue" });
  const stages = pipeline?.stages;
  if (stages?.ready_to_ship)
    rows.push({ key: "ship", icon: Truck, text: pluralOf(t, "ship", stages.ready_to_ship), cta: t.shipCta, to: "/orders?stage=ready_to_ship" });
  if (stages?.delivery_failed)
    rows.push({ key: "failed", icon: PackageX, text: pluralOf(t, "failed", stages.delivery_failed), cta: t.failedCta, to: "/orders?stage=delivery_failed" });
  if (stages?.needs_follow_up)
    rows.push({ key: "follow", icon: AlertTriangle, text: pluralOf(t, "follow", stages.needs_follow_up), cta: t.followCta, to: "/orders?stage=needs_follow_up" });

  if (rows.length === 0) {
    return (
      <BentoTile span={2} tone="brand" icon={BadgeCheck} eyebrow={t.needsEyebrow} action={{ to: "/orders", label: t.needsAllClearAction }}>
        <p className="text-xl leading-8 font-semibold">{t.needsAllClear}</p>
        <p className="mt-1 text-sm leading-6 text-primary-foreground/85">{t.needsAllClearBody}</p>
      </BentoTile>
    );
  }

  return (
    <BentoTile span={2} tone="brand" icon={Sparkles} eyebrow={t.needsEyebrow}>
      <ul className="-mx-1 space-y-1.5">
        {rows.map((row) => (
          <li key={row.key}>
            <Link
              to={row.to}
              className="flex min-h-12 items-center gap-3 rounded-xl bg-primary-foreground/10 px-3 py-2 transition-colors hover:bg-primary-foreground/20"
            >
              <row.icon className="size-5 shrink-0" strokeWidth={1.75} aria-hidden />
              <span className="min-w-0 flex-1 text-[15px] leading-6 font-medium">{row.text}</span>
              <span className="hidden shrink-0 items-center gap-0.5 text-sm font-semibold sm:inline-flex">
                {row.cta}
                <ChevronLeft className="size-4 ltr:rotate-180" aria-hidden />
              </span>
              <ChevronLeft className="size-5 shrink-0 sm:hidden ltr:rotate-180" aria-hidden />
            </Link>
          </li>
        ))}
      </ul>
    </BentoTile>
  );
}

/* ------------------------------------------------------------------ */

export function ProfitTile({ pnl, range }: { pnl: ProfitPnl; range: HomeRange }) {
  const t = useStrings();
  const when = whenOf(t, range);
  const totals = pnl.totals;
  const count = totals.orders.delivered + totals.orders.returned + totals.orders.open;
  const net = totals.projected.netProfit;
  const coverage = pnl.costCoverage;

  if (count === 0) {
    return (
      <BentoTile span={2} icon={PiggyBank} eyebrow={t.profitEyebrow} action={{ to: "/profit", label: t.profitOpenReport }}>
        <BentoAnswer className="text-ink-soft">{fmt(t.profitNone, { when })}</BentoAnswer>
      </BentoTile>
    );
  }

  // Without product costs the "profit" is only sales minus shipping and fees: say so, don't claim it.
  if (coverage === 0) {
    const beforeCost = totals.projected.netProfit;
    return (
      <BentoTile span={2} tone="attention" icon={PiggyBank} eyebrow={t.profitEyebrow} action={{ to: "/profit/costs", label: t.profitAddCosts }}>
        <BentoAnswer className="text-ink">{t.profitNoCosts}</BentoAnswer>
        <p className="mt-2 text-sm text-ink-soft">
          {fmt(t.profitBeforeCost, { amount: money(beforeCost, pnl.currency), when })}
        </p>
      </BentoTile>
    );
  }

  const loss = net < 0;
  const amount = money(Math.abs(net), pnl.currency);
  const lowCoverage = coverage !== null && coverage < 100;
  return (
    <BentoTile
      span={2}
      tone={loss ? "danger" : "default"}
      icon={loss ? TrendingDown : PiggyBank}
      eyebrow={t.profitEyebrow}
      action={lowCoverage ? { to: "/profit/costs", label: t.profitAddCosts } : { to: "/profit", label: t.profitOpenReport }}
    >
      <BentoFigure className={loss ? "text-danger" : "text-ink"}>
        <bdi dir="ltr">{loss ? "−" : ""}{amount}</bdi>
      </BentoFigure>
      <BentoAnswer className="mt-2 text-ink">
        {fmt(loss ? t.profitDown : t.profitUp, { amount, when })}
      </BentoAnswer>
      <p className="mt-1 text-xs leading-5 text-ink-soft">
        {totals.orders.open > 0 && t.profitOpen}
        {lowCoverage && ` ${fmt(t.profitCoverage, { pct: formatPercentValue(coverage / 100, 0) })}`}
      </p>
    </BentoTile>
  );
}

/* ------------------------------------------------------------------ */

/**
 * One product, named: the one that lost the most money, or — when none lost
 * any — the one that earned the most. Falls back to the best seller by units
 * when profit can't be read.
 */
export function ProductTile({ pnl, overview, range }: { pnl: ProfitPnl | null; overview: InsightsOverview | null; range: HomeRange }) {
  const t = useStrings();
  const when = whenOf(t, range);
  const rows = pnl?.rows ?? [];

  if (rows.length > 0 && pnl && (pnl.costCoverage ?? 0) >= MIN_COST_COVERAGE) {
    const worst = rows.reduce((a, b) => (b.projected.netProfit < a.projected.netProfit ? b : a));
    if (worst.projected.netProfit < 0) {
      const finished = Math.round(worst.orders.delivered + worst.orders.returned);
      const returned = Math.round(worst.orders.returned);
      return (
        <BentoTile span={2} tone="danger" icon={TrendingDown} eyebrow={t.productEyebrowLoss} action={{ to: "/profit", label: t.productAction }}>
          <BentoAnswer className="text-ink">
            {fmt(t.productLoss, {
              name: isolate(worst.label ?? t.productNoName),
              amount: money(Math.abs(worst.projected.netProfit), pnl.currency),
              when,
            })}
          </BentoAnswer>
          {returned > 0 && (
            <p className="mt-1 text-sm text-ink-soft">
              {fmt(t.productLossWhy, { returned: formatCount(returned), finished: formatCount(finished) })}
            </p>
          )}
        </BentoTile>
      );
    }
    const best = rows.reduce((a, b) => (b.projected.netProfit > a.projected.netProfit ? b : a));
    if (best.projected.netProfit > 0) {
      return (
        <BentoTile span={2} tone="success" icon={TrendingUp} eyebrow={t.productEyebrowWin} action={{ to: "/profit", label: t.profitOpenReport }}>
          <BentoAnswer className="text-ink">
            {fmt(t.productWin, {
              name: isolate(best.label ?? t.productNoName),
              amount: money(best.projected.netProfit, pnl.currency),
              when,
            })}
          </BentoAnswer>
        </BentoTile>
      );
    }
  }

  const top = overview?.topProducts.find((p) => p.quantity > 0);
  if (!top) return null;
  return (
    <BentoTile span={2} icon={TrendingUp} eyebrow={t.productEyebrowWin} action={{ to: "/catalog", label: t.productAction }}>
      <BentoAnswer>
        {fmt(t.productTop, { name: isolate(top.name ?? t.productNoName), units: formatCount(top.quantity), when })}
      </BentoAnswer>
    </BentoTile>
  );
}

/* ------------------------------------------------------------------ */

function DeltaLine({ current, previous, inverse }: { current: number | null; previous: number | null; inverse?: boolean }) {
  const t = useStrings();
  if (current === null || previous === null || previous === 0) {
    return <p className="mt-2 text-xs text-ink-soft">{t.deltaNone}</p>;
  }
  const change = (current - previous) / previous;
  const pct = formatPercentValue(Math.abs(change), 0);
  if (Math.abs(change) < 0.005) return <p className="mt-2 text-xs text-ink-soft">{t.deltaSame}</p>;
  const good = inverse ? change < 0 : change > 0;
  const Icon = change > 0 ? TrendingUp : TrendingDown;
  return (
    <p className={cn("mt-2 flex items-center gap-1 text-xs font-medium", good ? "text-success" : "text-danger")}>
      <Icon className="size-3.5 shrink-0" aria-hidden />
      {fmt(change > 0 ? t.deltaUp : t.deltaDown, { pct })}
    </p>
  );
}

export function SalesTile({ overview }: { overview: InsightsOverview }) {
  const t = useStrings();
  const m = overview.metrics.sales;
  return (
    <BentoTile icon={Wallet} eyebrow={t.salesEyebrow} to="/analytics">
      <BentoFigure>
        <bdi dir="ltr">{money(m.value ?? 0, overview.currency)}</bdi>
      </BentoFigure>
      <DeltaLine current={m.value} previous={m.previous} />
      <Sparkline current={overview.series.map((d) => d.sales)} className="mt-3 text-primary" />
    </BentoTile>
  );
}

export function OrdersTile({ overview }: { overview: InsightsOverview }) {
  const t = useStrings();
  const m = overview.metrics.orders;
  return (
    <BentoTile icon={ShoppingBag} eyebrow={t.ordersEyebrow} to="/orders">
      <BentoFigure>{formatCount(m.value ?? 0)}</BentoFigure>
      <DeltaLine current={m.value} previous={m.previous} />
      <Sparkline current={overview.series.map((d) => d.orders)} className="mt-3 text-primary" />
    </BentoTile>
  );
}

/** A rate as "N of every 10", with the change in points. Rates arrive as percentages. */
export function RateTile({ overview, kind }: { overview: InsightsOverview; kind: "confirmation" | "delivery" }) {
  const t = useStrings();
  const m = kind === "confirmation" ? overview.metrics.confirmationRate : overview.metrics.deliveryRate;
  const eyebrow = kind === "confirmation" ? t.confirmRateEyebrow : t.deliveryRateEyebrow;
  const icon = kind === "confirmation" ? ClipboardCheck : Truck;
  const to = kind === "confirmation" ? "/confirmation-queue" : "/orders?stage=shipped";
  if (m.value === null) {
    return (
      <BentoTile icon={icon} eyebrow={eyebrow}>
        <BentoAnswer className="text-ink-soft">{t.rateNone}</BentoAnswer>
      </BentoTile>
    );
  }
  const ofTen = formatCount(Math.round(m.value / 10));
  const points = m.previous === null ? null : Math.round(m.value - m.previous);
  return (
    <BentoTile icon={icon} eyebrow={eyebrow} to={to}>
      <BentoFigure>
        {formatPercentValue(m.value / 100, 0)}
      </BentoFigure>
      <p className="mt-1 text-sm leading-6 text-ink">
        {fmt(kind === "confirmation" ? t.confirmRateAnswer : t.deliveryRateAnswer, { n: ofTen })}
      </p>
      {points !== null && points !== 0 && (
        <p className={cn("mt-2 flex items-center gap-1 text-xs font-medium", points > 0 ? "text-success" : "text-danger")}>
          {points > 0 ? <TrendingUp className="size-3.5" aria-hidden /> : <TrendingDown className="size-3.5" aria-hidden />}
          {fmt(points > 0 ? t.pointsUp : t.pointsDown, { n: formatCount(Math.abs(points)) })}
        </p>
      )}
    </BentoTile>
  );
}

export function LostTile({ overview, range }: { overview: InsightsOverview; range: HomeRange }) {
  const t = useStrings();
  const lost = overview.metrics.lostOrders.value ?? 0;
  if (lost <= 0) return null;
  return (
    <BentoTile span={2} tone="attention" icon={ShoppingCart} eyebrow={t.lostEyebrow} action={{ to: "/abandoned-carts", label: t.lostAction }}>
      <BentoAnswer className="text-ink">{fmt(pluralOf(t, "lost", lost), { when: whenOf(t, range) })}</BentoAnswer>
    </BentoTile>
  );
}

export function WhereTile({
  overview,
  range,
  storeWideVisits,
}: {
  overview: InsightsOverview;
  range: HomeRange;
  /** Filtered by product: visits can't be split by product, so the source line is the whole store's. */
  storeWideVisits?: boolean;
}) {
  const t = useStrings();
  const gov = overview.topGovernorates.find((g) => g.orders > 0);
  const source = overview.topSources.find((s) => s.visits > 0);
  if (!gov && !source) return null;
  return (
    <BentoTile span={2} icon={MapPin} eyebrow={t.whereEyebrow} action={{ to: "/analytics/attribution", label: t.whereAction }}>
      {gov && (
        <BentoAnswer>{fmt(t.whereGov, { name: isolate(gov.name), n: formatCount(gov.orders), when: whenOf(t, range) })}</BentoAnswer>
      )}
      {source && (
        <p className="mt-1 text-sm text-ink-soft">
          {fmt(t.whereSource, { name: isolate(source.source || t.direct) })}
          {storeWideVisits && <span className="ms-1 text-xs">({t.storeWide})</span>}
        </p>
      )}
    </BentoTile>
  );
}
