import { Fragment, useEffect, useState } from "react";
import type { ReportsDelivery } from "@store-builder/api-client";
import { cn } from "@store-builder/ui";
import { IconCaretLeft, IconConfirm, IconCourier, IconDelivered, IconOrders, type IconComponent } from "@/components/icons";
import { fmt } from "@/i18n/LocaleContext";
import { formatCount } from "@/lib/analytics";
import { formatPercentValue } from "@/lib/format";
import { countOf } from "@/lib/plural";
import { useJourneyT } from "./journeyStrings";

/** A piece of a column: the step itself in the brand, or — on the last column — what came back and what is still travelling. */
interface Segment {
  key: string;
  tone: "brand" | "returned" | "onTheWay";
  /** Height as a share of the plot, 0–100. */
  height: number;
  title: string;
}

interface StepView {
  key: string;
  label: string;
  icon: IconComponent;
  count: number;
  weak: boolean;
  segments: Segment[];
  /** Read out with the step: the rate that leads into it, and what the colours of its column say. */
  spoken: string | null;
}

/** A rate the API gives, sitting on the band between two columns. */
interface RateView {
  /** A percentage (12.5 = 12.5%); null when its denominator is zero. */
  rate: number | null;
  word: string;
  hint: string;
  weak: boolean;
}

/** The band from one column to the next: the heights it joins, and the rate on it when the API gives one. */
interface BandView {
  from: number;
  to: number;
  rate: RateView | null;
}

const SEGMENT_TONE: Record<Segment["tone"], string> = {
  brand: "bg-primary forced-colors:bg-[CanvasText]",
  returned: "bg-danger forced-colors:bg-[Mark]",
  onTheWay: "border border-dashed border-line-strong bg-paper-sunken",
};

// Four columns with a band between each two; a band is a little wider than a column, so a rate fits on it.
const COLUMNS =
  "grid-cols-[minmax(0,1fr)_minmax(0,1.25fr)_minmax(0,1fr)_minmax(0,1.25fr)_minmax(0,1fr)_minmax(0,1.25fr)_minmax(0,1fr)]";
/** The plot under a strip of headroom, where the rate over the tallest band sits. */
const PLOT = "absolute inset-x-0 top-7 bottom-0 sm:top-8";
const GROW = "transition-transform duration-(--dur-move) ease-(--ease-out) motion-reduce:transition-none";

/**
 * «رحلة الأوردر» as connected bars: the period's orders through the four steps
 * of cash on delivery — اتطلب ← اتأكد ← اتشحن ← اتسلّم — one column each, a band
 * joining every column to the next, and on a band the rate the API gives for
 * that passage (confirmation, delivery). Between اتأكد and اتشحن there is a band
 * and no number: the API gives no rate there (docs/ux/needs-backend.md H20).
 *
 * The last column is the shipped orders split by what became of them:
 * delivered in the brand, came back or failed in red, still on the way as a
 * dashed ghost — so the red is where delivery loses orders.
 *
 * The look is the home card's (pages/home/today/OrderJourney.tsx): the same
 * chips, line, pills and brand fill, through the same `journey-*` hooks of the
 * glass layer. It runs in the reading direction, like that card: right to left
 * in Arabic. Heights are set once; the columns rise with a transform.
 *
 * Every figure is a cohort — the orders PLACED in the range, at the state they
 * are in now (`GET /analytics/reports/delivery`).
 */
export function JourneyChart({
  report,
  height,
  weakStep,
}: {
  report: ReportsDelivery;
  /** The height to fill, in px (ReportChartCard hands it over: 220 on a phone). */
  height: number;
  weakStep: "confirmation" | "delivery" | null;
}) {
  const t = useJourneyT();
  const { totals } = report;

  // The columns rise once, a beat apart, after the first paint.
  const [risen, setRisen] = useState(false);
  useEffect(() => {
    const frame = window.requestAnimationFrame(() => setRisen(true));
    return () => window.cancelAnimationFrame(frame);
  }, []);

  const stageOrders = (stage: string) => report.stages.find((row) => row.stage === stage)?.orders ?? 0;
  // Shipped and neither delivered nor back: the two "on the road" stages of the same report.
  const onTheWay = stageOrders("shipped") + stageOrders("out_for_delivery");

  const tallest = Math.max(1, totals.orders, totals.confirmed, totals.shipped, totals.delivered + totals.returned + onTheWay);
  /** A count as a share of the tallest column; a count above zero always shows a sliver. */
  const share = (count: number) => (count > 0 ? Math.min(100, Math.max(2, (count / tallest) * 100)) : 0);
  const title = (label: string, count: number) => fmt(t.barTitle, { label, orders: countOf("order", count) });
  const percent = (rate: number | null) => (rate === null ? "—" : formatPercentValue(rate / 100, 0));

  // The last column: three pieces that add up to «اتشحن». Kept inside the plot if the slivers push it over.
  const outcome = [
    { key: "delivered", tone: "brand" as const, count: totals.delivered, label: t.delivered },
    { key: "returned", tone: "returned" as const, count: totals.returned, label: t.legendReturned },
    { key: "onTheWay", tone: "onTheWay" as const, count: onTheWay, label: t.legendOnTheWay },
  ].filter((piece) => piece.count > 0);
  const outcomeSum = outcome.reduce((sum, piece) => sum + share(piece.count), 0);
  const squeeze = outcomeSum > 100 ? 100 / outcomeSum : 1;
  const outcomeSegments: Segment[] = outcome.map((piece) => ({
    key: piece.key,
    tone: piece.tone,
    height: share(piece.count) * squeeze,
    title: title(piece.label, piece.count),
  }));
  const outcomeHeight = Math.min(100, outcomeSum);

  const single = (key: string, label: string, count: number): Segment[] =>
    count > 0 ? [{ key, tone: "brand", height: share(count), title: title(label, count) }] : [];

  const steps: StepView[] = [
    { key: "ordered", label: t.ordered, icon: IconOrders, count: totals.orders, weak: false, segments: single("ordered", t.ordered, totals.orders), spoken: null },
    {
      key: "confirmed",
      label: t.confirmed,
      icon: IconConfirm,
      count: totals.confirmed,
      weak: weakStep === "confirmation",
      segments: single("confirmed", t.confirmed, totals.confirmed),
      spoken: `${t.rateConfirmedHint}: ${percent(totals.confirmationRate)}`,
    },
    { key: "shipped", label: t.shipped, icon: IconCourier, count: totals.shipped, weak: false, segments: single("shipped", t.shipped, totals.shipped), spoken: null },
    {
      key: "delivered",
      label: t.delivered,
      icon: IconDelivered,
      count: totals.delivered,
      weak: weakStep === "delivery",
      segments: outcomeSegments,
      spoken: [
        `${t.rateDeliveredHint}: ${percent(totals.deliveryRate)}`,
        ...outcome.filter((piece) => piece.key !== "delivered").map((piece) => title(piece.label, piece.count)),
      ].join(". "),
    },
  ];

  const bands: BandView[] = [
    {
      from: share(totals.orders),
      to: share(totals.confirmed),
      rate: { rate: totals.confirmationRate, word: t.rateConfirmed, hint: t.rateConfirmedHint, weak: weakStep === "confirmation" },
    },
    { from: share(totals.confirmed), to: share(totals.shipped), rate: null },
    {
      from: share(totals.shipped),
      to: outcomeHeight,
      rate: { rate: totals.deliveryRate, word: t.rateDelivered, hint: t.rateDeliveredHint, weak: weakStep === "delivery" },
    },
  ];

  return (
    <ol
      aria-label={t.stepsLabel}
      style={{ height }}
      // A little room at both ends: a label or a count wider than its column spills over evenly, and must not be cut.
      className={cn("mx-auto grid w-full max-w-[46rem] grid-rows-[minmax(0,1fr)] px-2", COLUMNS)}
    >
      {steps.map((step, index) => {
        const StepIcon = step.icon;
        const band = bands[index];
        // Each piece stands on the ones before it.
        const bases = step.segments.map((_, at) => step.segments.slice(0, at).reduce((sum, piece) => sum + piece.height, 0));
        return (
          <Fragment key={step.key}>
            <li className="flex min-w-0 flex-col items-center">
              <div className="relative min-h-0 w-full flex-1 border-b border-line-strong/60">
                <div
                  className={cn(PLOT, "origin-bottom", GROW)}
                  style={{ transform: risen ? undefined : "scaleY(0)", transitionDelay: `${index * 70}ms` }}
                >
                  {step.segments.map((piece, at) => (
                    <span
                      key={piece.key}
                      title={piece.title}
                      data-slot={piece.tone === "brand" ? "journey-bar-fill" : undefined}
                      style={{ bottom: `${bases[at]}%`, height: `${piece.height}%` }}
                      className={cn(
                        "absolute inset-x-0 block",
                        SEGMENT_TONE[piece.tone],
                        // Only the outer corners of the whole shape are rounded: where a band meets a column the edge stays square.
                        at === step.segments.length - 1 && index === 0 && "rounded-ss-lg",
                        at === step.segments.length - 1 && index === steps.length - 1 && "rounded-se-lg"
                      )}
                    />
                  ))}
                </div>
              </div>
              <span
                data-slot="journey-chip"
                data-tone={step.weak ? "weak" : undefined}
                className={cn(
                  "mt-1.5 flex size-7 shrink-0 items-center justify-center rounded-full sm:mt-2 sm:size-9",
                  step.weak ? "bg-accent-soft text-accent-dark" : "bg-primary-soft text-primary"
                )}
              >
                <StepIcon weight="fill" aria-hidden className="size-4 sm:size-[1.125rem]" />
              </span>
              {/* Read as the label, then the count — and drawn the other way up. */}
              <p className="mt-1 flex flex-col-reverse items-center">
                <span className="text-xs leading-4 whitespace-nowrap text-ink-soft sm:text-[13px] sm:leading-5">{step.label}</span>
                <span className="text-lg leading-6 font-semibold tracking-tight text-ink tabular-nums sm:text-xl sm:leading-7">
                  <bdi>{formatCount(step.count)}</bdi>
                </span>
              </p>
              {step.spoken && <span className="sr-only">{step.spoken}</span>}
            </li>

            {band && (
              // Above its neighbours, so a rate wider than the band is never cut by the next column.
              <li aria-hidden="true" className="relative z-[1] flex min-w-0 flex-col">
                <div className="relative min-h-0 w-full flex-1 border-b border-line-strong/60">
                  <div className={PLOT}>
                    <span
                      // Drawn for left-to-right and mirrored in Arabic, where the step before is on the right.
                      style={{
                        clipPath: `polygon(0 ${100 - band.from}%, 100% ${100 - band.to}%, 100% 100%, 0 100%)`,
                        opacity: risen ? 1 : 0,
                        transitionDelay: `${index * 70 + 140}ms`,
                      }}
                      className="absolute inset-0 block bg-primary/15 transition-opacity duration-(--dur-move) ease-(--ease-out) motion-reduce:transition-none rtl:-scale-x-100 forced-colors:bg-[GrayText]"
                    />
                    {band.rate && (
                      // On the middle of the band's top edge. A flex row centres it even when it is the wider of the two.
                      <div
                        style={{ bottom: `calc(${(band.from + band.to) / 2}% + 0.25rem)` }}
                        className="absolute inset-x-0 flex justify-center"
                      >
                        <RatePill rate={band.rate} />
                      </div>
                    )}
                  </div>
                </div>
                {/* The line from one chip to the next, with its arrowhead. */}
                <div className="mt-1.5 flex h-7 items-center sm:mt-2 sm:h-9">
                  <span
                    data-slot="journey-line"
                    className="block h-0.5 min-w-0 flex-1 rounded-full bg-line-strong/40 forced-colors:bg-[CanvasText]"
                  />
                  <IconCaretLeft
                    data-slot="journey-arrow"
                    weight="bold"
                    className="-ms-1 size-3.5 shrink-0 text-line-strong ltr:rotate-180"
                  />
                </div>
                {/* The room the count and the label take under a chip. */}
                <div className="h-11 sm:h-13" />
              </li>
            )}
          </Fragment>
        );
      })}
    </ol>
  );
}

/**
 * A rate as a small pill on its band: «٪٧٦ اتأكدوا». Amber when it is the rate
 * into the weakest step. On a phone the band is too narrow for the word, so the
 * pill is the figure alone; the hint says the rest.
 */
function RatePill({ rate }: { rate: RateView }) {
  const t = useJourneyT();
  return (
    <span
      data-slot="journey-pill"
      data-tone={rate.weak ? "weak" : undefined}
      title={rate.rate === null ? t.rateNone : rate.hint}
      className={cn(
        "inline-flex h-6 shrink-0 items-center gap-1 rounded-full px-2 text-xs whitespace-nowrap shadow-xs ring-1 sm:h-7 sm:px-2.5",
        rate.weak ? "bg-accent-soft text-accent-dark ring-accent/40" : "bg-paper-raised text-ink-soft ring-line"
      )}
    >
      {rate.rate === null ? (
        <span>—</span>
      ) : (
        <bdi dir="ltr" className={cn("font-semibold tabular-nums", !rate.weak && "text-ink")}>
          {formatPercentValue(rate.rate / 100, 0)}
        </bdi>
      )}
      <span className="max-sm:hidden">{rate.word}</span>
    </span>
  );
}
