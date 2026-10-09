import type { ReportsDelivery } from "@store-builder/api-client";

/*
 * The ONE sentence of «رحلة الأوردر»: where the period's orders are lost.
 *
 * It is worked out from the tab's own request (GET /analytics/reports/delivery
 * — the same numbers the cards, the chart and the table show), never from a
 * second source. The rule, first match wins:
 *
 *  0. No order at all → "nothing in this period".
 *     Fewer than MIN_ORDERS (10) orders → "too early to judge".
 *  1. LOW CONFIRMATION — at least MIN_COD_ORDERS (10) cash-on-delivery orders
 *     and a confirmation rate under LOW_CONFIRMATION (60%): more than 4 in 10
 *     are lost before anything ships, which outweighs any one place or
 *     courier. (The server's own `low_confirmation` insight uses the same
 *     two numbers.)
 *  2. THE WEAKEST GOVERNORATE — the store has shipped at least
 *     MIN_STORE_SHIPPED (10); at least two governorates have MIN_SHIPPED (5)
 *     shipped orders each (one place holding every order is not "the
 *     weakest"); the one with the lowest delivery rate is at least GAP_POINTS
 *     (10 points) under the store's own rate, and its result is in (see
 *     `settled`).
 *  3. THE COURIER GAP — at least two couriers with MIN_SHIPPED (5) shipped
 *     orders each; the worst (result in) is at least GAP_POINTS (10 points)
 *     under the best.
 *  4. A WEAK STEP with no one place or courier to name — the lower of the
 *     confirmation rate and the delivery rate, when it is under HEALTHY_RATE
 *     (80%). Delivery is judged only with MIN_STORE_SHIPPED shipped and its
 *     result in.
 *  5. Otherwise the journey runs well — or, when neither rate can be judged
 *     yet, the sentence says that it is too early.
 *
 * "Its result is in" (`settled`): the delivery rate is delivered ÷ shipped,
 * and "shipped" holds the orders still on the road. While those outnumber the
 * ones that came back, a low rate is time, not a weakness — so a place, a
 * courier or the store is not called weak yet (the rule the home card uses).
 */

/** Fewer orders than this in the range: nothing is judged. */
export const MIN_ORDERS = 10;
/** A governorate or a courier is named only with at least this many shipped orders. */
export const MIN_SHIPPED = 5;
/** Cash-on-delivery orders needed before the confirmation rate is judged. */
const MIN_COD_ORDERS = 10;
/** Shipped orders needed before the store's own delivery rate is judged. */
const MIN_STORE_SHIPPED = 10;
/** Under this, confirmation is the answer whatever else is weak. */
const LOW_CONFIRMATION = 60;
/** How far under (in points of a percentage) a place or a courier must be to be named. */
const GAP_POINTS = 10;
/** From here up a rate is healthy. */
const HEALTHY_RATE = 80;

/** In the table: from where a rate is drawn as weak (the old delivery screen's own limits). */
export const WEAK_CONFIRMATION = 55;
export const WEAK_DELIVERY = 50;
export const HIGH_RETURN = 30;

interface Shipped {
  shipped: number;
  delivered: number;
  returned: number;
}

/** Shipped orders that have neither arrived nor come back. */
export function stillOnTheWay(row: Shipped): number {
  return Math.max(0, row.shipped - row.delivered - row.returned);
}

/** Whether a delivery rate can be read as a result: what came back is no less than what is still travelling. */
function settled(row: Shipped): boolean {
  return row.returned >= stillOnTheWay(row);
}

/** Why delivery is not judged yet. */
export type DeliveryWait = "notShipped" | "onTheWay";

export type JourneyVerdict =
  | { kind: "empty" }
  | { kind: "tooFew"; orders: number }
  | { kind: "confirmation"; severity: "low" | "mild"; rate: number; codOrders: number }
  | { kind: "place"; name: string; rate: number; average: number; shipped: number }
  | { kind: "courier"; worst: string; worstRate: number; best: string; bestRate: number }
  | { kind: "delivery"; rate: number }
  | { kind: "good"; confirmation: number | null; delivery: number | null; wait: DeliveryWait | null }
  | { kind: "early"; wait: DeliveryWait | null };

/** Step 2 of the rule. `average` is the store's own delivery rate. */
function weakestPlace(report: ReportsDelivery, average: number): { name: string; rate: number; shipped: number } | null {
  const known = report.governorates.filter((place) => place.shipped >= MIN_SHIPPED && place.deliveryRate !== null);
  if (known.length < 2) return null;
  let worst: { name: string; rate: number; shipped: number } | null = null;
  for (const place of known) {
    const rate = place.deliveryRate;
    if (rate === null || !settled(place) || !place.name.trim()) continue;
    // The lowest rate; between two equal ones, the place with more shipped orders.
    if (worst === null || rate < worst.rate || (rate === worst.rate && place.shipped > worst.shipped)) {
      worst = { name: place.name, rate, shipped: place.shipped };
    }
  }
  return worst !== null && average - worst.rate >= GAP_POINTS ? worst : null;
}

/** Step 3 of the rule. */
function courierGap(report: ReportsDelivery): { worst: string; worstRate: number; best: string; bestRate: number } | null {
  const known = report.carriers.filter((courier) => courier.shipped >= MIN_SHIPPED && courier.deliveryRate !== null);
  if (known.length < 2) return null;
  let best: { name: string; rate: number } | null = null;
  let worst: { name: string; rate: number } | null = null;
  for (const courier of known) {
    const rate = courier.deliveryRate;
    if (rate === null) continue;
    if (best === null || rate > best.rate) best = { name: courier.name, rate };
    if (settled(courier) && (worst === null || rate < worst.rate)) worst = { name: courier.name, rate };
  }
  if (best === null || worst === null || best.name === worst.name) return null;
  return best.rate - worst.rate >= GAP_POINTS ? { worst: worst.name, worstRate: worst.rate, best: best.name, bestRate: best.rate } : null;
}

/** The rule above, over one delivery report. Names come back as the API wrote them. */
export function judgeJourney(report: ReportsDelivery): JourneyVerdict {
  const { totals } = report;
  if (totals.orders <= 0) return { kind: "empty" };
  if (totals.orders < MIN_ORDERS) return { kind: "tooFew", orders: totals.orders };

  const confirmation = totals.codOrders >= MIN_COD_ORDERS ? totals.confirmationRate : null;
  if (confirmation !== null && confirmation < LOW_CONFIRMATION) {
    return { kind: "confirmation", severity: "low", rate: confirmation, codOrders: totals.codOrders };
  }

  const delivery = totals.shipped >= MIN_STORE_SHIPPED ? totals.deliveryRate : null;
  if (delivery !== null) {
    const place = weakestPlace(report, delivery);
    if (place) return { kind: "place", name: place.name, rate: place.rate, average: delivery, shipped: place.shipped };
  }

  const gap = courierGap(report);
  if (gap) return { kind: "courier", ...gap };

  const inResult = settled(totals);
  const weakConfirmation = confirmation !== null && confirmation < HEALTHY_RATE ? confirmation : null;
  const weakDelivery = delivery !== null && delivery < HEALTHY_RATE && inResult ? delivery : null;
  if (weakConfirmation !== null && (weakDelivery === null || weakConfirmation <= weakDelivery)) {
    return { kind: "confirmation", severity: "mild", rate: weakConfirmation, codOrders: totals.codOrders };
  }
  if (weakDelivery !== null) return { kind: "delivery", rate: weakDelivery };

  // Nothing is weak: what is left of each rate is healthy, or cannot be judged yet.
  const goodDelivery = delivery !== null && delivery >= HEALTHY_RATE ? delivery : null;
  const wait: DeliveryWait | null = goodDelivery !== null ? null : delivery === null ? "notShipped" : "onTheWay";
  if (confirmation === null && goodDelivery === null) return { kind: "early", wait };
  return { kind: "good", confirmation, delivery: goodDelivery, wait };
}

/** The step the verdict points at, for the chart to mark in amber. */
export function weakStepOf(verdict: JourneyVerdict): "confirmation" | "delivery" | null {
  if (verdict.kind === "confirmation") return "confirmation";
  if (verdict.kind === "place" || verdict.kind === "courier" || verdict.kind === "delivery") return "delivery";
  return null;
}
