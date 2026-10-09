import { ReportTakeaway, type ReportTakeawayAction, type ReportTone } from "@/components/report";
import { fmt } from "@/i18n/LocaleContext";
import { placeName } from "@/lib/format";
import { countOf } from "@/lib/plural";
import { courierLabel, isolate, outOfTen, tenth } from "./journeyFormat";
import { MIN_ORDERS, type JourneyVerdict } from "./journeyRule";
import { useJourneyT, type JourneyT } from "./journeyStrings";

interface Said {
  tone: ReportTone;
  text: string;
  action?: ReportTakeawayAction;
}

/**
 * The verdict of journeyRule.ts in words. Rates are said as «٥ من كل ١٠»; at
 * none of ten (or all ten lost) the sentence says so in words instead of a
 * zero. Each weakness leads to the page where something can be done about it.
 */
function say(t: JourneyT, verdict: JourneyVerdict): Said {
  switch (verdict.kind) {
    case "empty":
      return { tone: "info", text: t.sayEmpty };

    case "tooFew":
      return {
        tone: "info",
        text: fmt(t.sayTooFew, { orders: countOf("order", verdict.orders), min: countOf("order", MIN_ORDERS) }),
      };

    case "confirmation": {
      const lost = 100 - verdict.rate;
      const orders = countOf("order", verdict.codOrders);
      const action = { label: t.actConfirm, to: "/confirmation-queue" };
      if (outOfTen(lost) >= 10) return { tone: "bad", text: fmt(t.sayConfirmNone, { orders }), action };
      return verdict.severity === "low"
        ? { tone: "bad", text: fmt(t.sayConfirmLow, { lost: tenth(t, lost), orders }), action }
        : { tone: "warn", text: fmt(t.sayConfirmMild, { lost: tenth(t, lost) }), action };
    }

    case "place": {
      const values = {
        name: isolate(placeName(verdict.name).trim()),
        shipped: countOf("order", verdict.shipped),
        average: tenth(t, verdict.average),
      };
      const action = { label: t.actShipping, to: "/shipping" };
      return outOfTen(verdict.rate) <= 0
        ? { tone: "bad", text: fmt(t.sayPlaceNone, values), action }
        : { tone: "bad", text: fmt(t.sayPlace, { ...values, share: tenth(t, verdict.rate) }), action };
    }

    case "courier": {
      const values = {
        worst: isolate(courierLabel(verdict.worst, t.manualCourier)),
        best: isolate(courierLabel(verdict.best, t.manualCourier)),
        bestShare: tenth(t, verdict.bestRate),
      };
      const action = { label: t.actShipping, to: "/shipping" };
      return outOfTen(verdict.worstRate) <= 0
        ? { tone: "warn", text: fmt(t.sayCourierNone, values), action }
        : { tone: "warn", text: fmt(t.sayCourier, { ...values, worstShare: tenth(t, verdict.worstRate) }), action };
    }

    case "delivery": {
      const lost = 100 - verdict.rate;
      const action = { label: t.actReturns, to: "/returns" };
      return outOfTen(lost) >= 10
        ? { tone: "bad", text: t.sayDeliveryNone, action }
        : { tone: "warn", text: fmt(t.sayDelivery, { lost: tenth(t, lost) }), action };
    }

    case "good": {
      const tail = verdict.wait === "onTheWay" ? t.sayTailOnTheWay : verdict.wait === "notShipped" ? t.sayTailNotShipped : null;
      if (verdict.confirmation !== null && verdict.delivery !== null) {
        return {
          tone: "good",
          text: fmt(t.sayGoodBoth, { confirmed: tenth(t, verdict.confirmation), delivered: tenth(t, verdict.delivery) }),
        };
      }
      if (verdict.confirmation !== null) {
        const text = fmt(t.sayGoodConfirm, { confirmed: tenth(t, verdict.confirmation) });
        return { tone: "good", text: tail ? `${text} ${tail}` : text };
      }
      return { tone: "good", text: fmt(t.sayGoodDelivery, { delivered: tenth(t, verdict.delivery ?? 0) }) };
    }

    case "early":
      return { tone: "info", text: verdict.wait === "onTheWay" ? t.sayTailOnTheWay : t.sayNoRates };
  }
}

/** The tab's ONE sentence: where the period's orders are lost, and what to do about it. */
export function JourneyTakeaway({ verdict }: { verdict: JourneyVerdict }) {
  const t = useJourneyT();
  const said = say(t, verdict);
  return (
    <ReportTakeaway tone={said.tone} action={said.action}>
      {said.text}
    </ReportTakeaway>
  );
}
