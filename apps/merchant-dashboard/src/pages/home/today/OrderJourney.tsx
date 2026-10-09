import { useEffect, type CSSProperties, type ReactNode } from "react";
import { Card, cn } from "@store-builder/ui";
import { reportsGetDelivery, type AnalyticsOrderCounts, type ReportsDelivery } from "@store-builder/api-client";
import { ViewLink } from "@/components/ViewLink";
import {
  IconCaretDown,
  IconCaretLeft,
  IconCash,
  IconConfirm,
  IconCourier,
  IconDelivered,
  IconHourglass,
  IconOrders,
  IconReturns,
  IconSuccess,
  IconWarning,
  type IconComponent,
} from "@/components/icons";
import { apiClient } from "@/lib/apiClient";
import { formatCount } from "@/lib/analytics";
import { canViewAnalytics } from "@/lib/analyticsAccess";
import { isPermissionError } from "@/lib/errors";
import { formatPercentValue, placeName } from "@/lib/format";
import { countOf, pluralOf } from "@/lib/plural";
import { useCachedAsync } from "@/lib/useCachedAsync";
import { fmt, useT, type Messages } from "@/i18n/LocaleContext";
import { HomeSection, HomeSectionError, HomeSkeleton } from "@/pages/home/today/HomeSection";
import { homeWindow, outOfTen, type HomeSectionProps } from "@/pages/home/today/homeTime";

/*
 * Egyptian Arabic, second person, short. Plural forms follow lib/plural.ts
 * (`<key>_one/_two/_other`; English never picks _two — it is there so both
 * languages hold the same keys). `{ten}` is the number 10, written through
 * `fmt` so it takes the language's digits.
 */
const STRINGS = {
  en: {
    title: "Order journey",
    noteToday: "Today's orders",
    noteDays: "Orders of the last {days}",
    whenToday: "today",
    whenDays: "in the last {days}",
    stepsLabel: "An order's four steps, from placed to delivered",
    ordered: "Ordered",
    confirmed: "Confirmed",
    shipped: "Shipped",
    delivered: "Delivered",
    rateConfirmed: "confirmed",
    rateDelivered: "delivered",
    rateConfirmedHint: "Confirmation rate: confirmed, out of the cash-on-delivery orders",
    rateDeliveredHint: "Delivery rate: delivered, out of the shipped orders",
    rateNone: "No rate yet: there is nothing to work it out from",
    codNote: "{orders} are cash on delivery",
    codNone: "None is cash on delivery",
    returnNote: "{pct} of the shipped came back",
    returnNone: "Nothing came back so far",
    ofTen_one: "1 in {ten}",
    ofTen_two: "2 in {ten}",
    ofTen_other: "{n} in {ten}",
    weakConfirmLead: "Weakest step: confirmation",
    weakConfirmBody: "— {share} were not confirmed.",
    weakConfirmNone: "— almost no order was confirmed.",
    weakDeliveryLead: "Weakest step: delivery",
    weakDeliveryBody: "— {share} did not receive their order.",
    weakDeliveryNone: "— almost no shipped order was received.",
    mostUnreachable: "Most of them didn't answer.",
    mostRejected: "Most of them said no.",
    mostPostponed: "Most of them asked for a later call.",
    mostPending: "Most of them haven't been called yet.",
    topUnreachable: "The most common reason: no answer.",
    topRejected: "The most common reason: they said no.",
    topPostponed: "The most common reason: they asked for a later call.",
    topPending: "The largest group hasn't been called yet.",
    weakPlace: "Weakest governorate: {name} ({share}).",
    placeShare_one: "only 1 in {ten} received",
    placeShare_two: "only 2 in {ten} received",
    placeShare_other: "only {n} in {ten} received",
    placeNone: "none received",
    goodBoth: "The journey is running well: {confirmed} get confirmed and {delivered} get delivered.",
    goodConfirm: "Confirmation is running well: {confirmed} get confirmed.",
    goodDelivery: "Delivery is running well: {delivered} get delivered.",
    tailNothingShipped: "Nothing has shipped yet to judge delivery by.",
    tailOnTheWay: "Too early to judge delivery: most of what shipped is still on the way.",
    noRates: "There are no rates to judge by in this period yet.",
    tooFew: "Only {orders} {when} — too early to judge. From {min} up, the weakest step will be named here.",
    empty: "No orders {when} yet. When one comes in, you will see here whether it was confirmed and how far it got.",
    openReport: "Open the report",
    error: "We couldn't load the order journey.",
    retry: "Try again",
  },
  ar: {
    title: "رحلة الأوردر",
    noteToday: "أوردرات النهارده",
    noteDays: "أوردرات آخر {days}",
    whenToday: "النهارده",
    whenDays: "في آخر {days}",
    stepsLabel: "خطوات الأوردر الأربعة، من أول ما اتطلب لحد ما اتسلّم",
    ordered: "اتطلب",
    confirmed: "اتأكد",
    shipped: "اتشحن",
    delivered: "اتسلّم",
    rateConfirmed: "اتأكدوا",
    rateDelivered: "استلموا",
    rateConfirmedHint: "نسبة التأكيد: اللي اتأكد من أوردرات الدفع عند الاستلام",
    rateDeliveredHint: "نسبة التسليم: اللي اتسلّم من اللي اتشحن",
    rateNone: "لسه مفيش نسبة: مفيش أوردرات تتحسب منها",
    codNote: "{orders} منهم دفع عند الاستلام",
    codNone: "ولا واحد منهم دفع عند الاستلام",
    returnNote: "رجع {pct} من اللي اتشحن",
    returnNone: "مفيش حاجة رجعت لحد دلوقتي",
    ofTen_one: "واحد من كل {ten}",
    ofTen_two: "اتنين من كل {ten}",
    ofTen_other: "{n} من كل {ten}",
    weakConfirmLead: "أضعف حتة: التأكيد",
    weakConfirmBody: "— {share} ما اتأكدوش.",
    weakConfirmNone: "— تقريبًا ولا أوردر اتأكد.",
    weakDeliveryLead: "أضعف حتة: التوصيل",
    weakDeliveryBody: "— {share} ما استلموش.",
    weakDeliveryNone: "— تقريبًا ولا أوردر اتسلّم.",
    mostUnreachable: "أغلبهم ما ردّوش.",
    mostRejected: "أغلبهم رفضوا.",
    mostPostponed: "أغلبهم أجّلوا.",
    mostPending: "أغلبهم لسه ما اتكلموش.",
    topUnreachable: "أكتر سبب: ما ردّوش.",
    topRejected: "أكتر سبب: رفضوا.",
    topPostponed: "أكتر سبب: أجّلوا.",
    topPending: "أكتر سبب: لسه ما اتكلموش.",
    weakPlace: "أضعف محافظة: {name} ({share}).",
    placeShare_one: "واحد بس من كل {ten} استلم",
    placeShare_two: "اتنين بس من كل {ten} استلموا",
    placeShare_other: "{n} بس من كل {ten} استلموا",
    placeNone: "ولا واحد استلم",
    goodBoth: "رحلتك ماشية كويس: {confirmed} بيتأكدوا و{delivered} بيستلموا.",
    goodConfirm: "التأكيد ماشي كويس: {confirmed} بيتأكدوا.",
    goodDelivery: "التوصيل ماشي كويس: {delivered} بيستلموا.",
    tailNothingShipped: "لسه مفيش حاجة اتشحنت نحكم بيها على التوصيل.",
    tailOnTheWay: "التوصيل لسه بدري عليه: أغلب اللي اتشحن لسه في الطريق.",
    noRates: "لسه مفيش نسب نحكم بيها في الفترة دي.",
    tooFew: "{orders} بس {when} — لسه بدري نحكم. من {min} وطالع هنقولك هنا أضعف حتة في الرحلة.",
    empty: "مفيش أوردرات {when} لسه. أول ما ييجي أوردر هتشوف هنا اتأكد ولا لأ ووصل لحد فين.",
    openReport: "افتح التقرير",
    error: "معرفناش نحمّل رحلة الأوردر.",
    retry: "جرّب تاني",
  },
} satisfies Messages;

/** Fewer orders than this in the range: too few to name a weakest step. */
const MIN_ORDERS = 10;
/** From here up a rate is healthy. */
const HEALTHY_RATE = 80;
/** A governorate is named only with at least this many shipped orders. */
const MIN_PLACE_SHIPPED = 5;

/** What became of the orders that are not confirmed, as /analytics/summary splits them. */
type Reason = "unreachable" | "rejected" | "postponed" | "pending";
const REASONS: readonly Reason[] = ["unreachable", "rejected", "postponed", "pending"];

interface JourneyData {
  /** What the answer belongs to: a cached answer for another range is never drawn under this one's label. */
  key: string;
  delivery: ReportsDelivery;
  /** Null when /analytics/summary did not answer: the sentence then carries no reason. */
  split: AnalyticsOrderCounts | null;
}

type Verdict =
  | { kind: "tooFew" }
  | { kind: "weak"; step: "confirmation"; rate: number; reason: { key: Reason; most: boolean } | null }
  | { kind: "weak"; step: "delivery"; rate: number; place: { name: string; rate: number } | null }
  | { kind: "good"; confirmation: number | null; delivery: number | null; tail: "nothingShipped" | "onTheWay" }
  | { kind: "open"; tail: "nothingShipped" | "onTheWay" };

/** Shipped orders that have neither arrived nor come back. */
function stillOnTheWay(row: { shipped: number; delivered: number; returned: number }): number {
  return Math.max(0, row.shipped - row.delivered - row.returned);
}

/**
 * The largest group among the orders that are not confirmed, and whether it
 * is more than half of them («أغلبهم») or only the biggest one («أكتر سبب»).
 * The summary counts every order of the range, test orders included, so it is
 * only ever worded as a share (docs/ux/needs-backend.md H11).
 */
function topReason(split: AnalyticsOrderCounts | null): { key: Reason; most: boolean } | null {
  if (!split) return null;
  let top: Reason | null = null;
  let best = 0;
  let total = 0;
  for (const key of REASONS) {
    const count = Number(split[key]) || 0;
    total += count;
    if (count > best) {
      best = count;
      top = key;
    }
  }
  return top === null ? null : { key: top, most: best * 2 > total };
}

/**
 * The governorate that delivers worst: at least five shipped, its result in
 * (what came back is no less than what is still travelling), and really below
 * the store's own rate — one place holding every order is not "the weakest".
 */
function weakestPlace(report: ReportsDelivery, overall: number): { name: string; rate: number } | null {
  let worst: { name: string; rate: number } | null = null;
  for (const place of report.governorates) {
    if (place.shipped < MIN_PLACE_SHIPPED || place.deliveryRate === null) continue;
    if (place.returned < stillOnTheWay(place)) continue;
    if (place.deliveryRate >= overall || (worst !== null && place.deliveryRate >= worst.rate)) continue;
    const name = placeName(place.name).trim();
    if (name) worst = { name, rate: place.deliveryRate };
  }
  return worst;
}

/**
 * Which step loses the most orders. The lower of the confirmation rate and
 * the delivery rate, when it is under 80 — with one guard the numbers ask
 * for: the delivery rate is delivered ÷ shipped, and "shipped" holds the
 * orders still on the road. While those outnumber the ones that came back, a
 * low rate is time, not a weakness, so delivery is not judged yet.
 */
function judge(report: ReportsDelivery, split: AnalyticsOrderCounts | null): Verdict {
  const { totals } = report;
  if (totals.orders < MIN_ORDERS) return { kind: "tooFew" };

  const confirmation = totals.confirmationRate;
  const delivery = totals.deliveryRate;
  const settled = totals.returned >= stillOnTheWay(totals);

  const weakConfirmation = confirmation !== null && confirmation < HEALTHY_RATE ? confirmation : null;
  const weakDelivery = delivery !== null && delivery < HEALTHY_RATE && settled ? delivery : null;
  if (weakConfirmation !== null && (weakDelivery === null || weakConfirmation <= weakDelivery)) {
    return { kind: "weak", step: "confirmation", rate: weakConfirmation, reason: topReason(split) };
  }
  if (weakDelivery !== null) {
    return { kind: "weak", step: "delivery", rate: weakDelivery, place: weakestPlace(report, weakDelivery) };
  }

  // Nothing is weak: what is left of each rate is healthy, or cannot be judged yet.
  const goodDelivery = delivery !== null && delivery >= HEALTHY_RATE ? delivery : null;
  const tail = delivery === null ? "nothingShipped" : "onTheWay";
  if (confirmation === null && goodDelivery === null) return { kind: "open", tail };
  return { kind: "good", confirmation, delivery: goodDelivery, tail };
}

/** A number or a percentage keeps its own order inside an Arabic sentence. */
const ltr = (value: string) => `⁦${value}⁩`;
/** A name takes the direction of its own first letter. */
const isolate = (value: string) => `⁨${value}⁩`;

/** What the section looked like last time in this browser, so the skeleton holds the right room. */
function recall(key: string): string | null {
  try {
    return window.localStorage.getItem(key);
  } catch {
    return null;
  }
}
function remember(key: string, value: string): void {
  try {
    window.localStorage.setItem(key, value);
  } catch {
    // Storage blocked: the skeleton keeps its default height.
  }
}

/**
 * «رحلة الأوردر»: the range's orders through the four steps of cash on
 * delivery — اتطلب ← اتأكد ← اتشحن ← اتسلّم — as one connected object, and under
 * it the one step that loses the most, in a sentence.
 *
 * Every figure is a cohort: the orders PLACED in the range, at the state
 * they are in now (`GET /analytics/reports/delivery`). Only the three rates
 * the API gives are printed; between اتأكد and اتشحن there is an arrow and no
 * number (docs/ux/needs-backend.md H20).
 */
export function OrderJourney({ workspaceId, range, role }: HomeSectionProps) {
  const t = useT(STRINGS);
  const allowed = canViewAnalytics(role);
  const key = `home:journey:${workspaceId}:${range}`;

  const { data, error, refresh } = useCachedAsync<JourneyData | null>(
    allowed ? key : null,
    async () => {
      if (!allowed) return null;
      const span = homeWindow(range);
      const [delivery, summary] = await Promise.allSettled([
        reportsGetDelivery(apiClient, workspaceId, span),
        apiClient.getAnalyticsSummary(workspaceId, span),
      ]);
      // The journey itself is the section; the split only adds a reason to one sentence.
      if (delivery.status === "rejected") throw delivery.reason;
      return {
        key,
        delivery: delivery.value,
        split: summary.status === "fulfilled" ? (summary.value.orders ?? null) : null,
      };
    },
    [workspaceId, range, allowed]
  );

  const fresh = data && data.key === key ? data : null;
  const hasOrders = fresh ? fresh.delivery.totals.orders > 0 : null;
  const shapeKey = `zimos.home.journey.${workspaceId}.${range}`;
  useEffect(() => {
    if (hasOrders !== null) remember(shapeKey, hasOrders ? "steps" : "row");
  }, [shapeKey, hasOrders]);

  // Not for this role: a known role without analytics, or a 403 from the server.
  if (!allowed || isPermissionError(error)) return null;

  const days = range === "today" ? null : countOf("day", range === "7d" ? 7 : 30);
  const note = days ? fmt(t.noteDays, { days }) : t.noteToday;
  const when = days ? fmt(t.whenDays, { days }) : t.whenToday;

  return (
    <HomeSection title={t.title} note={note}>
      {fresh ? (
        hasOrders ? (
          <JourneyCard report={fresh.delivery} split={fresh.split} when={when} />
        ) : (
          <JourneyEmpty when={when} />
        )
      ) : error ? (
        <HomeSectionError message={t.error} retryLabel={t.retry} onRetry={() => void refresh()} />
      ) : (
        // The height of what is coming: the compact row on a phone, the timeline in a narrow pane from md, the row of four from 48rem.
        <div className="@container/journey">
          <HomeSkeleton
            className={
              recall(shapeKey) === "row"
                ? "h-[8.5rem] @3xl/journey:h-[4.75rem]"
                : "h-[31rem] max-md:h-[21rem] @3xl/journey:h-[15.75rem]"
            }
          />
        </div>
      )}
    </HomeSection>
  );
}

// ------------------------------------------------------------------ parts --

interface RateLink {
  /** A percentage (12.5 = 12.5%); null when its denominator is zero. */
  rate: number | null;
  word: string;
  hint: string;
  weak: boolean;
}

interface Step {
  key: string;
  label: string;
  icon: IconComponent;
  count: number;
  weak: boolean;
  note: ReactNode;
  /** What joins this step to the next: a rate the API gives, a plain arrow, or nothing after the last. */
  next: RateLink | "arrow" | null;
}

function JourneyCard({ report, split, when }: { report: ReportsDelivery; split: AnalyticsOrderCounts | null; when: string }) {
  const t = useT(STRINGS);
  const { totals } = report;
  const verdict = judge(report, split);
  const weakStep = verdict.kind === "weak" ? verdict.step : null;

  /** "3 in 10" for a percentage, in the language's own words for one and two. */
  const tenth = (percent: number) => fmt(pluralOf(t, "ofTen", outOfTen(percent)), { ten: 10 });
  /** A step's count as a share of «اتطلب», for the bar; a count above zero always shows a sliver. */
  const share = (count: number) => (totals.orders > 0 && count > 0 ? Math.min(1, Math.max(0.03, count / totals.orders)) : 0);

  // «اتأكد» counts cash-on-delivery orders only: when some orders are prepaid, say how many are not.
  const codNote =
    totals.codOrders < totals.orders ? (
      <>
        <IconCash aria-hidden className="size-3.5 shrink-0" />
        <span>{totals.codOrders > 0 ? fmt(t.codNote, { orders: countOf("order", totals.codOrders) }) : t.codNone}</span>
      </>
    ) : null;
  const returnNote =
    totals.returnRate === null ? null : (
      <>
        <IconReturns aria-hidden className="size-3.5 shrink-0" />
        <span>
          {totals.returned > 0 ? fmt(t.returnNote, { pct: ltr(formatPercentValue(totals.returnRate / 100, 0)) }) : t.returnNone}
        </span>
      </>
    );

  const steps: Step[] = [
    {
      key: "ordered",
      label: t.ordered,
      icon: IconOrders,
      count: totals.orders,
      weak: false,
      note: codNote,
      next: { rate: totals.confirmationRate, word: t.rateConfirmed, hint: t.rateConfirmedHint, weak: weakStep === "confirmation" },
    },
    {
      key: "confirmed",
      label: t.confirmed,
      icon: IconConfirm,
      count: totals.confirmed,
      weak: weakStep === "confirmation",
      note: null,
      next: "arrow",
    },
    {
      key: "shipped",
      label: t.shipped,
      icon: IconCourier,
      count: totals.shipped,
      weak: false,
      note: null,
      next: { rate: totals.deliveryRate, word: t.rateDelivered, hint: t.rateDeliveredHint, weak: weakStep === "delivery" },
    },
    {
      key: "delivered",
      label: t.delivered,
      icon: IconDelivered,
      count: totals.delivered,
      weak: weakStep === "delivery",
      note: returnNote,
      next: null,
    },
  ];

  return (
    <Card data-slot="journey-card" className="gap-0 p-4">
      <div className="@container/journey">
        {/* On a phone (below md) the steps are one compact row of four, drawn by JourneyCompact; this
            list is not drawn there. From md up it is one object in two shapes: a timeline down the start
            edge while the pane is narrow, a row of four from 48rem. Each step is its own small grid — the
            chip, its figures, and what joins it to the next step — and only the places of the last two swap. */}
        <JourneyCompact steps={steps} />
        <ol aria-label={t.stepsLabel} className="flex flex-col max-md:hidden @3xl/journey:grid @3xl/journey:grid-cols-4">
          {steps.map((step, index) => {
            const StepIcon = step.icon;
            return (
              <li key={step.key} className="grid min-w-0 grid-cols-[2.75rem_minmax(0,1fr)] gap-x-3 @3xl/journey:gap-x-0">
                <div className="col-start-1 row-start-1 flex flex-col items-center">
                  <span
                    data-slot="journey-chip"
                    data-tone={step.weak ? "weak" : undefined}
                    className={cn(
                      "flex size-11 shrink-0 items-center justify-center rounded-full",
                      step.weak ? "bg-accent-soft text-accent-dark" : "bg-primary-soft text-primary"
                    )}
                  >
                    <StepIcon weight="fill" aria-hidden className="size-5" />
                  </span>
                  {/* On a phone the line carries on under the chip when the figures beside it are the taller. */}
                  {step.next && <Line className="w-0.5 flex-1 @3xl/journey:hidden" />}
                </div>

                <div className="col-start-2 row-start-1 min-w-0 @3xl/journey:col-span-2 @3xl/journey:col-start-1 @3xl/journey:row-start-2 @3xl/journey:mt-3 @3xl/journey:pe-6">
                  <p className="flex items-baseline justify-between gap-3 @3xl/journey:flex-col-reverse @3xl/journey:items-start @3xl/journey:gap-0">
                    <span className="min-w-0 truncate text-[15px] leading-8 font-medium text-ink @3xl/journey:text-[13px] @3xl/journey:leading-5 @3xl/journey:text-ink-soft">
                      {step.label}
                    </span>
                    <span className="shrink-0 text-2xl leading-8 font-semibold tracking-tight text-ink tabular-nums">
                      <bdi>{formatCount(step.count)}</bdi>
                    </span>
                  </p>
                  <span
                    data-slot="journey-bar"
                    aria-hidden
                    className="mt-1.5 block h-1.5 overflow-hidden rounded-full bg-paper-sunken @3xl/journey:mt-2"
                  >
                    <span
                      data-slot="journey-bar-fill"
                      style={{ "--share": share(step.count), "--i": index } as CSSProperties}
                      // Drawn with a transform, never a width. It grows once from the start edge, each step a beat
                      // after the one before (the delay is inside the shorthand, so nothing can reset it).
                      className="block h-full rounded-full bg-primary [transform:scaleX(var(--share))] transition-transform duration-(--dur-move) ease-(--ease-out) motion-safe:animate-[home-journey-grow_var(--dur-move)_var(--ease-out)_calc(var(--i)*70ms)_backwards] motion-reduce:transition-none ltr:origin-left rtl:origin-right forced-colors:bg-[CanvasText]"
                    />
                  </span>
                  {step.note && <p className="mt-1.5 flex items-center gap-1 text-xs leading-4 text-ink-soft">{step.note}</p>}
                </div>

                {step.next && <Connector link={step.next} />}
              </li>
            );
          })}
        </ol>

        <WeakestStep verdict={verdict} orders={totals.orders} when={when} tenth={tenth} />
      </div>
    </Card>
  );
}

/** A stretch of the line between two steps: a real element, so it mirrors with the page. */
function Line({ className }: { className?: string }) {
  return (
    <span
      data-slot="journey-line"
      aria-hidden
      className={cn("block shrink-0 rounded-full bg-line-strong/40 forced-colors:bg-[CanvasText]", className)}
    />
  );
}

/** A stretch that stands in the timeline (under the chips' centre) and lies down in the row. */
const SEGMENT = "ms-[1.3125rem] w-0.5 @3xl/journey:ms-0 @3xl/journey:h-0.5 @3xl/journey:w-auto @3xl/journey:flex-1";

/**
 * A rate the API gives, as a small pill: «٪١٩ اتأكدوا». Amber when it is the
 * rate into the weakest step. On the line between two steps a missing rate is
 * only a dash; standing on its own under the phone's row (`worded`) the dash
 * keeps its word, so it still says which rate is missing.
 */
function RatePill({ rate, worded = false, className }: { rate: RateLink; worded?: boolean; className?: string }) {
  const t = useT(STRINGS);
  return (
    <span
      data-slot="journey-pill"
      data-tone={rate.weak ? "weak" : undefined}
      title={rate.rate === null ? t.rateNone : rate.hint}
      className={cn(
        "inline-flex h-7 shrink-0 items-center gap-1 rounded-full px-2.5 text-xs whitespace-nowrap shadow-xs ring-1",
        rate.weak ? "bg-accent-soft text-accent-dark ring-accent/40" : "bg-paper-raised text-ink-soft ring-line",
        className
      )}
    >
      {rate.rate === null ? (
        <>
          <span aria-hidden>—</span>
          {worded && <span>{rate.word}</span>}
          <span className="sr-only">{t.rateNone}</span>
        </>
      ) : (
        <>
          <bdi dir="ltr" className={cn("font-semibold tabular-nums", !rate.weak && "text-ink")}>
            {formatPercentValue(rate.rate / 100, 0)}
          </bdi>
          <span>{rate.word}</span>
        </>
      )}
    </span>
  );
}

/**
 * The journey on a phone (below md): the four steps as ONE row of equal
 * columns — the chip, the count, the label — with a thin line from each chip
 * to the next. A line that short cannot carry a rate, so the two rates the API
 * gives stand right under the row, each under the line it describes, and under
 * them the quiet notes (how many are cash on delivery, what came back). The
 * share bars are not drawn here: four counts side by side already show the
 * drop. A screen reader is told what the timeline tells it: the same list
 * name, each step as its label then its count, both rates, both notes.
 */
function JourneyCompact({ steps }: { steps: Step[] }) {
  const t = useT(STRINGS);
  const rates = steps.flatMap((step) => (step.next !== null && step.next !== "arrow" ? [{ key: step.key, rate: step.next }] : []));
  const notes = steps.filter((step) => step.note !== null);
  return (
    <div data-slot="journey-compact" className="md:hidden">
      <ol aria-label={t.stepsLabel} className="grid grid-cols-4">
        {steps.map((step) => {
          const StepIcon = step.icon;
          return (
            <li key={step.key} className="relative flex min-w-0 flex-col items-center text-center">
              {/* From this chip's edge to the next one's, leaving room for the amber halo of a weak step. */}
              {step.next && <Line className="absolute start-[calc(50%+1.5rem)] top-[1.0625rem] h-0.5 w-[calc(100%-3rem)]" />}
              <span
                data-slot="journey-chip"
                data-tone={step.weak ? "weak" : undefined}
                className={cn(
                  "flex size-9 shrink-0 items-center justify-center rounded-full",
                  step.weak ? "bg-accent-soft text-accent-dark" : "bg-primary-soft text-primary"
                )}
              >
                <StepIcon weight="fill" aria-hidden className="size-[1.125rem]" />
              </span>
              {/* Read as the timeline reads it — the label, then the count — and drawn the other way up. */}
              <p className="mt-1.5 flex max-w-full min-w-0 flex-col-reverse items-center">
                <span className="max-w-full truncate text-xs leading-4 text-ink-soft">{step.label}</span>
                <span className="text-xl leading-6 font-semibold tracking-tight text-ink tabular-nums">
                  <bdi>{formatCount(step.count)}</bdi>
                </span>
              </p>
            </li>
          );
        })}
      </ol>
      {/* Each rate under its own line: the first half of the row is اتطلب ← اتأكد, the second اتشحن ← اتسلّم. */}
      <div className="mt-2.5 grid grid-cols-2 justify-items-center gap-x-2">
        {rates.map(({ key, rate }) => (
          <RatePill key={key} rate={rate} worded />
        ))}
      </div>
      {notes.length > 0 && (
        <div className="mt-2 flex flex-wrap items-center justify-center gap-x-3 gap-y-1">
          {notes.map((step) => (
            <p key={step.key} className="flex min-w-0 items-center gap-1 text-xs leading-4 text-ink-soft">
              {step.note}
            </p>
          ))}
        </div>
      )}
    </div>
  );
}

/**
 * What joins a step to the next: the line, the rate as a pill sitting on it
 * when the API gives one, and an arrowhead. Down the timeline while the pane
 * is narrow; along the row from 48rem, where it runs right to left in Arabic
 * and left to right in English.
 */
function Connector({ link }: { link: RateLink | "arrow" }) {
  const rate = link === "arrow" ? null : link;
  return (
    <div className="col-span-2 row-start-2 flex min-w-0 flex-col items-start @3xl/journey:col-span-1 @3xl/journey:col-start-2 @3xl/journey:row-start-1 @3xl/journey:flex-row @3xl/journey:items-center @3xl/journey:px-2">
      <Line className={cn(SEGMENT, rate ? "h-2" : "h-4")} />
      {rate && (
        <>
          <RatePill rate={rate} className="ms-2 @3xl/journey:mx-1.5" />
          <Line className={cn(SEGMENT, "h-2")} />
        </>
      )}
      <IconCaretDown
        data-slot="journey-arrow"
        weight="bold"
        aria-hidden
        className="ms-[0.9375rem] -mt-1 size-3.5 shrink-0 text-line-strong @3xl/journey:hidden"
      />
      <IconCaretLeft
        data-slot="journey-arrow"
        weight="bold"
        aria-hidden
        className="-ms-1 hidden size-3.5 shrink-0 text-line-strong ltr:rotate-180 @3xl/journey:block"
      />
    </div>
  );
}

const STRIP = {
  weak: { box: "bg-accent-soft text-accent-dark ring-1 ring-accent/30", icon: IconWarning },
  good: { box: "bg-success-soft text-success ring-1 ring-success/25", icon: IconSuccess },
  quiet: { box: "bg-paper-sunken text-ink-soft", icon: IconHourglass },
} as const;

/** The band under the steps: one sentence, and the one place it leads to. */
function Strip({ tone, lead, children }: { tone: keyof typeof STRIP; lead?: string; children: ReactNode }) {
  const t = useT(STRINGS);
  const ToneIcon = STRIP[tone].icon;
  return (
    <div
      data-slot="journey-strip"
      data-tone={tone}
      className={cn(
        "mt-4 flex flex-col gap-1.5 rounded-2xl px-3.5 py-3 @3xl/journey:flex-row @3xl/journey:items-center @3xl/journey:gap-3 @3xl/journey:py-2.5",
        STRIP[tone].box
      )}
    >
      <div className="flex min-w-0 flex-1 items-start gap-2.5">
        <ToneIcon weight="fill" aria-hidden className="mt-0.5 size-5 shrink-0" />
        <p className={cn("min-w-0 text-sm leading-6 text-pretty", tone !== "quiet" && "text-ink")}>
          {lead && <strong className="font-semibold text-accent-dark">{lead} </strong>}
          {children}
        </p>
      </div>
      <ReportLink className="ms-[1.875rem] self-start @3xl/journey:ms-0 @3xl/journey:self-center">{t.openReport}</ReportLink>
    </div>
  );
}

/** «افتح التقرير»: a small pill, 44px under a thumb. */
function ReportLink({ className, children }: { className?: string; children: ReactNode }) {
  return (
    <ViewLink
      to="/analytics"
      data-slot="journey-link"
      className={cn(
        "inline-flex min-h-9 shrink-0 items-center gap-1 rounded-full bg-paper-raised px-3.5 text-[13px] font-semibold text-ink shadow-xs ring-1 ring-line transition-[scale,background-color] duration-(--dur-fade) ease-(--ease-out) hover:bg-paper-sunken focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary active:scale-[0.97] motion-reduce:transition-none motion-reduce:active:scale-100 pointer-coarse:min-h-11",
        className
      )}
    >
      {children}
      <IconCaretLeft weight="bold" aria-hidden className="size-3.5 ltr:rotate-180" />
    </ViewLink>
  );
}

/** The weakest step in one sentence — or that all is well, or that it is too early to say. */
function WeakestStep({
  verdict,
  orders,
  when,
  tenth,
}: {
  verdict: Verdict;
  orders: number;
  when: string;
  tenth: (percent: number) => string;
}) {
  const t = useT(STRINGS);

  if (verdict.kind === "tooFew") {
    return (
      <Strip tone="quiet">{fmt(t.tooFew, { orders: countOf("order", orders), when, min: countOf("order", MIN_ORDERS) })}</Strip>
    );
  }

  if (verdict.kind === "open") {
    return <Strip tone="quiet">{verdict.tail === "onTheWay" ? t.tailOnTheWay : t.noRates}</Strip>;
  }

  if (verdict.kind === "good") {
    const tail = verdict.tail === "onTheWay" ? t.tailOnTheWay : t.tailNothingShipped;
    const text =
      verdict.confirmation !== null && verdict.delivery !== null
        ? fmt(t.goodBoth, { confirmed: tenth(verdict.confirmation), delivered: tenth(verdict.delivery) })
        : verdict.confirmation !== null
          ? `${fmt(t.goodConfirm, { confirmed: tenth(verdict.confirmation) })} ${tail}`
          : fmt(t.goodDelivery, { delivered: tenth(verdict.delivery ?? 0) });
    return <Strip tone="good">{text}</Strip>;
  }

  // Not confirmed / not delivered, out of ten. At ten of ten the sentence says so in words.
  const missing = 100 - verdict.rate;
  const none = outOfTen(missing) >= 10;

  if (verdict.step === "confirmation") {
    const reasons: Record<Reason, [most: string, top: string]> = {
      unreachable: [t.mostUnreachable, t.topUnreachable],
      rejected: [t.mostRejected, t.topRejected],
      postponed: [t.mostPostponed, t.topPostponed],
      pending: [t.mostPending, t.topPending],
    };
    const reason = verdict.reason ? reasons[verdict.reason.key][verdict.reason.most ? 0 : 1] : null;
    const body = none ? t.weakConfirmNone : fmt(t.weakConfirmBody, { share: tenth(missing) });
    return (
      <Strip tone="weak" lead={t.weakConfirmLead}>
        {reason ? `${body} ${reason}` : body}
      </Strip>
    );
  }

  const place = verdict.place;
  const placeShare = place ? outOfTen(place.rate) : 0;
  const placeText = place
    ? fmt(t.weakPlace, {
        name: isolate(place.name),
        share: placeShare > 0 ? fmt(pluralOf(t, "placeShare", placeShare), { ten: 10 }) : t.placeNone,
      })
    : null;
  const body = none ? t.weakDeliveryNone : fmt(t.weakDeliveryBody, { share: tenth(missing) });
  return (
    <Strip tone="weak" lead={t.weakDeliveryLead}>
      {placeText ? `${body} ${placeText}` : body}
    </Strip>
  );
}

/** The range has no orders: one calm line instead of four zeros. */
function JourneyEmpty({ when }: { when: string }) {
  const t = useT(STRINGS);
  return (
    <Card data-slot="journey-card" className="gap-0 p-4">
      <div className="@container/journey">
        <div className="flex flex-col gap-2 @3xl/journey:flex-row @3xl/journey:items-center @3xl/journey:gap-3">
          <div className="flex min-w-0 flex-1 items-center gap-3">
            <span
              data-slot="journey-chip"
              className="flex size-11 shrink-0 items-center justify-center rounded-full bg-primary-soft text-primary"
            >
              <IconOrders weight="duotone" aria-hidden className="size-5" />
            </span>
            <p className="min-w-0 text-sm leading-6 text-pretty text-ink-soft">{fmt(t.empty, { when })}</p>
          </div>
          <ReportLink className="ms-14 self-start @3xl/journey:ms-0 @3xl/journey:self-center">{t.openReport}</ReportLink>
        </div>
      </div>
    </Card>
  );
}
