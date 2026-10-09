import { Fragment, type ReactNode } from "react";
import {
  isOnAccountOrder,
  orderGiftOptionsOf,
  orderPaymentDueAt,
  ordersMeta,
  type Order,
  type OrderSessionDetails,
  type ReturnRequest,
} from "@store-builder/api-client";
import { StatusBadge } from "@/components/StatusBadge";
import { fmt, getIntlLocale, useT, type Messages } from "@/i18n/LocaleContext";
import { formatDate, formatDateTime, formatMoney, parseMoney } from "@/lib/format";
import { formatRelative } from "@/lib/orderTimeline";
import { countOf, pluralOf } from "@/lib/plural";
import { providerName } from "@/lib/providers";
import { useRiskReasonLabel, type OrderRiskFields } from "@/pages/fraud/RiskBadge";
import { FINISHED_SHIPMENT_STATUSES, codAmountFor } from "@/pages/shipping/carriers";
import { useLastActionText } from "../components/OrderSessionDetails";
import { useOrderLabels } from "../orderLabels";
import { Ltr, fmtRich } from "./rich";
import type { ConfirmationGate } from "./useConfirmationGate";
import { PAYMENT_FLAGS, SHIPMENT_FLAG } from "./useSectionOpen";

const STRINGS = {
  en: {
    sep: " · ",
    noCallsYet: "No call yet",
    callbackAt: "next call {time}",
    noShipment: "No shipment yet",
    shipmentWith: "With {carrier} — {status}",
    shipments_one: "1 shipment",
    shipments_other: "{n} shipments",
    needsCheck: "Check with the courier",
    collectOnDelivery: "{amount} to collect on delivery",
    paidOf: "Paid {paid} of {total}",
    refunded: "refunded {amount}",
    leftToPay: "{amount} left to pay",
    dueOn: "due {date}",
    paidInFull: "Paid in full",
    overdue: "Overdue",
    returnsAwaiting_one: "1 return waits for your answer",
    returnsAwaiting_other: "{n} returns wait for your answer",
    returnsToRestock_one: "1 approved return to receive",
    returnsToRestock_other: "{n} approved returns to receive",
    returns_one: "1 return",
    returns_other: "{n} returns",
    waitingForYou: "Waiting for you",
    flags_one: "1 flag",
    flags_other: "{n} flags",
    altPhone: "Alt {phone}",
    saved: "{amount} off",
    firstOrder: "The customer's first order",
    orderNumberN: "The customer's order no. {n}",
    pages_one: "1 page seen before ordering",
    pages_other: "{n} pages seen before ordering",
    giftWrap: "Gift-wrap it",
    giftMessage: "has a message",
    giftNoPrices: "no prices in the parcel",
  },
  ar: {
    sep: " · ",
    noCallsYet: "لسه مفيش مكالمة",
    callbackAt: "المكالمة الجاية {time}",
    noShipment: "لسه مفيش شحنة",
    shipmentWith: "مع {carrier} — {status}",
    shipments_one: "شحنة واحدة",
    shipments_two: "شحنتين",
    shipments_few: "{n} شحنات",
    shipments_other: "{n} شحنة",
    needsCheck: "راجع شركة الشحن",
    collectOnDelivery: "هيتحصّل {amount} عند الاستلام",
    paidOf: "مدفوع {paid} من {total}",
    refunded: "اترجّع {amount}",
    leftToPay: "باقي {amount}",
    dueOn: "يستحق {date}",
    paidInFull: "مدفوع بالكامل",
    overdue: "متأخر",
    returnsAwaiting_one: "مرتجع واحد مستني موافقتك",
    returnsAwaiting_two: "مرتجعين مستنيين موافقتك",
    returnsAwaiting_few: "{n} مرتجعات مستنية موافقتك",
    returnsAwaiting_other: "{n} مرتجع مستني موافقتك",
    returnsToRestock_one: "مرتجع واحد موافَق عليه مستني يتستلم",
    returnsToRestock_two: "مرتجعين موافَق عليهم مستنيين يتستلموا",
    returnsToRestock_few: "{n} مرتجعات موافَق عليها مستنية تتستلم",
    returnsToRestock_other: "{n} مرتجع موافَق عليه مستني يتستلم",
    returns_one: "مرتجع واحد",
    returns_two: "مرتجعين",
    returns_few: "{n} مرتجعات",
    returns_other: "{n} مرتجع",
    waitingForYou: "مستني ردّك",
    flags_one: "علامة واحدة",
    flags_two: "علامتين",
    flags_few: "{n} علامات",
    flags_other: "{n} علامة",
    altPhone: "رقم بديل {phone}",
    saved: "خصم {amount}",
    firstOrder: "أول أوردر للعميل",
    orderNumberN: "الأوردر رقم {n} للعميل",
    pages_one: "شاف صفحة واحدة قبل ما يطلب",
    pages_two: "شاف صفحتين قبل ما يطلب",
    pages_few: "شاف {n} صفحات قبل ما يطلب",
    pages_other: "شاف {n} صفحة قبل ما يطلب",
    giftWrap: "يتغلّف هدية",
    giftMessage: "فيه رسالة",
    giftNoPrices: "من غير أسعار في الطرد",
  },
} satisfies Messages;

/** What a folded section says on its one row: a line of words, and maybe a small figure or chip at the row's end. */
export interface SectionLine {
  summary?: ReactNode;
  badge?: ReactNode;
}

export interface OrderSummaries {
  confirmation: SectionLine;
  shipments: SectionLine;
  payments: SectionLine;
  onAccount: SectionLine;
  returns: SectionLine;
  timeline: SectionLine;
  customer: SectionLine;
  tags: SectionLine;
  discounts: SectionLine;
  risk: SectionLine;
  session: SectionLine;
  gift: SectionLine;
}

/** Parts on one line with the middle dot between them; nothing at all when there are none. */
function joined(parts: ReactNode[], sep: string): ReactNode {
  const shown = parts.filter((part) => part !== null && part !== undefined && part !== false && part !== "");
  if (shown.length === 0) return undefined;
  return shown.map((part, i) => (
    <Fragment key={i}>
      {i > 0 && sep}
      {part}
    </Fragment>
  ));
}

/**
 * The one-line summaries of the order page's folded sections
 * (docs/ux/REDESIGN_PROMPT.md §6: a folded section says what is inside).
 *
 * Every line is read off data the page already holds — the order itself, its
 * session details, and the returns list its own card has loaded. Where there
 * is nothing to read, there is no line: a summary is never made up.
 */
export function useOrderSummaries(
  order: Order,
  {
    gate,
    session,
    returns,
  }: {
    gate: ConfirmationGate;
    session: OrderSessionDetails | null | undefined;
    /** The Returns card's own list, once it has loaded (null until then). */
    returns: ReturnRequest[] | null;
  }
): OrderSummaries {
  const t = useT(STRINGS);
  const labels = useOrderLabels();
  const reasonLabel = useRiskReasonLabel();
  const lastActionText = useLastActionText();
  const money = (amount: number | string) => <Ltr>{formatMoney(amount, order.currency)}</Ltr>;
  const flags = order.riskFlags ?? [];

  // Confirmation: how many calls so far, and when the next one is booked.
  const task = order.confirmationTask ?? null;
  const calls = gate.open ? (task?.attemptCount ?? 0) : (task?.attempts?.length ?? 0);
  const confirmation: SectionLine = {
    summary: joined(
      [
        calls > 0 ? countOf("call", calls) : gate.open ? t.noCallsYet : null,
        gate.open && task?.nextRetryAt && task.status === "queued" ? fmt(t.callbackAt, { time: formatDateTime(task.nextRetryAt) }) : null,
      ],
      t.sep
    ),
  };

  // Shipments: the one on its way, or the newest (the API lists them oldest first).
  const shipmentList = order.shipments ?? [];
  const current = shipmentList.find((s) => !FINISHED_SHIPMENT_STATUSES.has(s.status)) ?? shipmentList[shipmentList.length - 1];
  const shipments: SectionLine = {
    summary: current
      ? joined(
          [
            shipmentList.length > 1 ? pluralOf(t, "shipments", shipmentList.length) : null,
            fmt(t.shipmentWith, { carrier: providerName(current.carrierCode), status: labels.shipment(current.status) }),
          ],
          t.sep
        )
      : t.noShipment,
    badge: flags.includes(SHIPMENT_FLAG) ? <StatusBadge value="check" tone="danger" text={t.needsCheck} /> : undefined,
  };

  // Payments: what is in, out of what; for cash on delivery, what the courier still collects.
  const paid = parseMoney(order.amountPaid);
  const refundedAmount = parseMoney(order.amountRefunded);
  const toCollect = codAmountFor(order);
  const paymentFlag = flags.find((flag) => PAYMENT_FLAGS.has(flag));
  const payments: SectionLine = {
    summary: joined(
      [
        order.paymentMethod === "cod" && paid === 0 && toCollect > 0
          ? fmtRich(t.collectOnDelivery, { amount: money(toCollect) })
          : fmtRich(t.paidOf, { paid: money(paid), total: money(order.totalAmount) }),
        refundedAmount > 0 ? fmtRich(t.refunded, { amount: money(refundedAmount) }) : null,
      ],
      t.sep
    ),
    badge: paymentFlag ? <StatusBadge value={paymentFlag} tone="danger" text={labels.riskFlag(paymentFlag)} /> : undefined,
  };

  // Pay on account: what is left and when it is due — the card's own arithmetic.
  let onAccount: SectionLine = {};
  if (isOnAccountOrder(order)) {
    const left = Math.max(0, parseMoney(order.totalAmount) - paid);
    const dueAt = orderPaymentDueAt(order);
    const overdue = !order.cancelledAt && left > 0 && dueAt !== null && new Date(dueAt).getTime() < Date.now();
    onAccount = {
      summary:
        left > 0
          ? joined([fmtRich(t.leftToPay, { amount: money(left) }), dueAt ? fmt(t.dueOn, { date: formatDate(dueAt) }) : null], t.sep)
          : t.paidInFull,
      badge: overdue ? <StatusBadge value="overdue" tone="danger" text={t.overdue} /> : undefined,
    };
  }

  // Returns: the ones that wait for the merchant come first.
  let returnsLine: SectionLine = {};
  if (returns && returns.length > 0) {
    const awaiting = returns.filter((r) => r.status === "requested").length;
    const toRestock = returns.filter((r) => r.status === "approved" && !r.restockedAt).length;
    returnsLine = {
      summary:
        awaiting > 0
          ? pluralOf(t, "returnsAwaiting", awaiting)
          : toRestock > 0
            ? pluralOf(t, "returnsToRestock", toRestock)
            : pluralOf(t, "returns", returns.length),
      badge: awaiting > 0 ? <StatusBadge value="requested" tone="warning" text={t.waitingForYou} /> : undefined,
    };
  }

  // Timeline: the newest thing that happened, and how long ago.
  const lastAction = session?.lastAction ?? null;
  const timeline: SectionLine = lastAction
    ? {
        summary: lastActionText(lastAction) ?? undefined,
        badge: <span className="text-xs whitespace-nowrap text-ink-soft">{formatRelative(lastAction.at, Date.now(), getIntlLocale())}</span>,
      }
    : {};

  // Customer details: its risk flags first (they must not hide in a folded section), else what else is on file.
  const contact = order.contactSnapshot;
  const customer: SectionLine =
    flags.length > 0
      ? {
          summary: <span className="text-danger">{flags.map((flag) => labels.riskFlag(flag)).join(t.sep)}</span>,
          badge: <StatusBadge value="flags" tone="danger" text={pluralOf(t, "flags", flags.length)} />,
        }
      : {
          summary: joined(
            [
              contact?.alternatePhone ? fmtRich(t.altPhone, { phone: <Ltr>{contact.alternatePhone}</Ltr> }) : null,
              contact?.email ? <Ltr className="">{contact.email}</Ltr> : null,
            ],
            t.sep
          ),
        };

  const tagList = ordersMeta(order).tags;
  const tags: SectionLine = { summary: tagList.length > 0 ? tagList.join(t.sep) : undefined };

  // Coupon and discounts: the codes, and what they took off (the card's own sum).
  const entries = Array.isArray(order.discountsSnapshot) ? order.discountsSnapshot : [];
  const codes = entries.flatMap((entry) => (typeof entry.code === "string" && entry.code ? [entry.code] : []));
  const savedAmount = entries.reduce((sum, entry) => sum + (Number(entry.amount) || 0), 0);
  const discounts: SectionLine = {
    summary: joined(
      [
        ...codes.map((code, i) => (
          <Ltr key={i} className="">
            {code}
          </Ltr>
        )),
        savedAmount > 0 ? fmtRich(t.saved, { amount: money(savedAmount) }) : null,
      ],
      t.sep
    ),
  };

  // Risk and origin: the reasons the protection gave, when it gave any.
  const reasons = (order as Order & OrderRiskFields).riskReasons ?? [];
  const risk: SectionLine = { summary: reasons.length > 0 ? reasons.slice(0, 3).map(reasonLabel).join(t.sep) : undefined };

  // Session details: which of the customer's orders this is, and how much of the store they saw first.
  const history = session?.customer;
  const sessionLine: SectionLine = session
    ? {
        summary: joined(
          [
            history && history.orderSequence !== null
              ? history.orderSequence === 1
                ? t.firstOrder
                : fmt(t.orderNumberN, { n: history.orderSequence })
              : null,
            session.tracked && session.pageViews > 0 ? pluralOf(t, "pages", session.pageViews) : null,
          ],
          t.sep
        ),
      }
    : {};

  const giftOptions = orderGiftOptionsOf(order);
  const gift: SectionLine = giftOptions
    ? {
        summary: joined(
          [giftOptions.wrapped ? t.giftWrap : null, giftOptions.message ? t.giftMessage : null, giftOptions.hidePrices ? t.giftNoPrices : null],
          t.sep
        ),
      }
    : {};

  return {
    confirmation,
    shipments,
    payments,
    onAccount,
    returns: returnsLine,
    timeline,
    customer,
    tags,
    discounts,
    risk,
    session: sessionLine,
    gift,
  };
}
