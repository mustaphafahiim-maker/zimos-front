import { useState, type Ref } from "react";
import { isOnAccountOrder, orderGiftOptionsOf, type Order, type OrderSessionDetails, type ReturnRequest } from "@store-builder/api-client";
import { AccordionSection } from "@/components/Accordion";
import {
  IconAttribution,
  IconChecklist,
  IconClock,
  IconCoins,
  IconConfirm,
  IconCourier,
  IconDigital,
  IconDiscounts,
  IconFactory,
  IconGift,
  IconPayments,
  IconReturns,
  IconShield,
  IconStore,
  IconTag,
  IconUser,
  IconWebAnalytics,
} from "@/components/icons";
import { Section } from "@/components/Section";
import { useT, type Messages } from "@/i18n/LocaleContext";
import { countOf } from "@/lib/plural";
import { OrderOnAccountCard } from "@/pages/b2b/OrderOnAccountCard";
import { OrderDigitalSection } from "@/pages/digital/OrderDigitalSection";
import { OrderProtectionSection } from "@/pages/fraud/OrderProtectionSection";
import { OrderShipsFrom } from "@/pages/inventory/OrderShipsFrom";
import { OrderAttributionSection } from "@/pages/marketing/OrderAttributionSection";
import { OrderSurveyAnswers } from "@/pages/survey/OrderSurveyAnswers";
import { ConfirmationPanel, type ConfirmationPanelHandle } from "../components/ConfirmationPanel";
import { OrderDiscountsCard } from "../components/OrderDiscountsCard";
import { OrderGiftCard } from "../components/OrderGiftCard";
import { OrderNotesCard } from "../components/OrderNotesCard";
import { OrderSessionCard } from "../components/OrderSessionDetails";
import { OrderSummary } from "../components/OrderSummary";
import { OrderSupplierCard } from "../components/OrderSupplierCard";
import { OrderTagsCard } from "../components/OrderTagsCard";
import { OrderTimelineSection } from "../components/OrderTimelineSection";
import { PaymentsSection } from "../components/PaymentsSection";
import { ReturnsSection } from "../components/ReturnsSection";
import { ShipmentsSection } from "../components/ShipmentsSection";
import type { ConfirmationGate } from "./useConfirmationGate";
import { useOrderSummaries } from "./useOrderSummaries";
import { ORDER_SECTION_ELEMENT, type OrderSectionControl } from "./useSectionOpen";

const STRINGS = {
  en: {
    items: "Items",
    money: "Money",
    paymentDetails: "Payments",
    confirmation: "Confirmation",
    confirmationHistory: "Confirmation history",
    shipments: "Shipments",
    payments: "Payments and refunds",
    returns: "Returns",
    timeline: "Timeline",
    customer: "Customer details",
    tags: "Tags",
    discounts: "Coupon and discounts",
    risk: "Risk and origin",
    traffic: "Traffic source",
    session: "Session details",
    digital: "Digital delivery",
    survey: "Post-purchase survey",
    supplier: "Supplier",
    shipsFrom: "Ships from",
    gift: "This order is a gift",
    onAccount: "Pay on account",
  },
  ar: {
    items: "المنتجات",
    money: "الحساب",
    paymentDetails: "المدفوعات",
    confirmation: "التأكيد",
    confirmationHistory: "سجل التأكيد",
    shipments: "الشحنات",
    payments: "المدفوعات والاستردادات",
    returns: "المرتجعات",
    timeline: "سجل الأوردر",
    customer: "بيانات العميل",
    tags: "التاجز",
    discounts: "الكوبون والخصومات",
    risk: "الخطورة والمصدر",
    traffic: "مصدر الزيارة",
    session: "تفاصيل الجلسة",
    digital: "التسليم الرقمي",
    survey: "استبيان بعد الشراء",
    supplier: "المورّد",
    shipsFrom: "بيتشحن من",
    gift: "الأوردر ده هدية",
    onAccount: "الدفع الآجل",
  },
} satisfies Messages;

/**
 * A section whose card decides for itself whether it has anything to show
 * (it asks the server first, then draws nothing): the body is kept mounted so
 * the card can ask, and the whole row leaves the page while the body is empty.
 */
const GONE_WHEN_EMPTY = "has-[>.zimos-accordion-body:empty]:hidden";

// On a phone the two columns dissolve into one list, sorted by each child's `order-*`;
// from lg up each is a column of its own and the same numbers sort it.
const COLUMN = "contents lg:flex lg:min-w-0 lg:flex-col lg:gap-[var(--bento-gap)]";

interface OrderSectionsProps {
  order: Order;
  /** Reloads the order after a card changed something. */
  reload: () => void | Promise<void>;
  session: OrderSessionDetails | null | undefined;
  /** Changes whenever the timeline has to be read again. */
  timelineKey: string;
  gate: ConfirmationGate;
  sections: OrderSectionControl;
  /** True while the page's hero holds the confirm button: the Confirmation card then draws none. */
  ownsConfirm: boolean;
  confirmRef: Ref<ConfirmationPanelHandle>;
}

/**
 * Everything under the hero.
 *
 * Three cards stay open — the items, the money, the notes — because they are
 * read or written on every order. The rest are the page's old cards, each in
 * a folding section that says in one line what is inside: the Confirmation
 * card (open while the order still waits on its call), the Shipments (open
 * from "ready to ship" until delivered), the Payments (open while waiting for
 * payment), then returns, the timeline, the rest of the customer block, tags,
 * discounts and the background cards — each only when it has something or
 * can do something, exactly as before.
 *
 * One list, in this order, on a phone. From lg up it is two columns: the work
 * on the wide side; notes, the customer, tags and where the order came from
 * beside it. The split is CSS only (`order-*` on the children, `contents` on
 * the two wrappers), so every card is mounted once and loads once.
 */
export function OrderSections({ order, reload, session, timelineKey, gate, sections, ownsConfirm, confirmRef }: OrderSectionsProps) {
  const t = useT(STRINGS);
  // The Returns card hands over what it loaded, so its folded row can say that one waits for an answer.
  const [returns, setReturns] = useState<ReturnRequest[] | null>(null);
  const lines = useOrderSummaries(order, { gate, session, returns });
  const attempts = order.confirmationTask?.attempts?.length ?? 0;
  const hasDiscounts = Array.isArray(order.discountsSnapshot) && order.discountsSnapshot.length > 0;

  return (
    <div className="flex flex-col gap-[var(--bento-gap)] lg:grid lg:grid-cols-[minmax(0,1.65fr)_minmax(0,1fr)] lg:items-start">
      <div className={COLUMN}>
        <Section
          title={t.items}
          className="order-1"
          actions={<span className="text-xs text-ink-soft tabular-nums">{countOf("item", order.items.length)}</span>}
        >
          <OrderSummary order={order} only="items" />
        </Section>

        <Section
          title={t.money}
          className="order-2"
          actions={
            <button
              type="button"
              onClick={() => sections.reveal("payments")}
              className="-my-2 inline-flex min-h-11 cursor-pointer items-center rounded-full px-2 text-[13px] font-medium text-primary underline-offset-4 hover:underline focus-visible:outline-2 focus-visible:outline-primary pointer-fine:min-h-9"
            >
              {t.paymentDetails}
            </button>
          }
        >
          <OrderSummary order={order} only="totals" />
        </Section>

        {(gate.open || attempts > 0) && (
          <AccordionSection
            id={ORDER_SECTION_ELEMENT.confirmation}
            className="order-4"
            title={gate.open ? t.confirmation : t.confirmationHistory}
            icon={IconConfirm}
            summary={lines.confirmation.summary}
            open={sections.isOpen("confirmation")}
            onOpenChange={(open) => sections.setOpen("confirmation", open)}
            persistKey="order:confirmation"
            keepMounted
          >
            <ConfirmationPanel order={order} onChanged={reload} frameless hideConfirm={ownsConfirm} actionRef={confirmRef} />
          </AccordionSection>
        )}

        <AccordionSection
          id={ORDER_SECTION_ELEMENT.shipments}
          className="order-5"
          title={t.shipments}
          icon={IconCourier}
          summary={lines.shipments.summary}
          badge={lines.shipments.badge}
          open={sections.isOpen("shipments")}
          onOpenChange={(open) => sections.setOpen("shipments", open)}
          persistKey="order:shipments"
          keepMounted
        >
          <ShipmentsSection order={order} onChanged={reload} frameless />
        </AccordionSection>

        <AccordionSection
          id={ORDER_SECTION_ELEMENT.payments}
          className="order-6"
          title={t.payments}
          icon={IconPayments}
          summary={lines.payments.summary}
          badge={lines.payments.badge}
          open={sections.isOpen("payments")}
          onOpenChange={(open) => sections.setOpen("payments", open)}
          persistKey="order:payments"
          keepMounted
        >
          <PaymentsSection order={order} onChanged={reload} frameless />
        </AccordionSection>

        <AccordionSection
          id="order-returns"
          className="order-7"
          title={t.returns}
          icon={IconReturns}
          summary={lines.returns.summary}
          badge={lines.returns.badge}
          persistKey="order:returns"
          keepMounted
        >
          <ReturnsSection order={order} onOrderMaybeChanged={reload} frameless onLoaded={setReturns} />
        </AccordionSection>

        {/* Read only when opened: the newest event is already on the row. */}
        <AccordionSection
          className="order-8"
          title={t.timeline}
          icon={IconClock}
          summary={lines.timeline.summary}
          badge={lines.timeline.badge}
          persistKey="order:timeline"
        >
          <OrderTimelineSection order={order} refreshKey={timelineKey} frameless />
        </AccordionSection>

        {hasDiscounts && (
          <AccordionSection className="order-11" title={t.discounts} icon={IconDiscounts} summary={lines.discounts.summary} persistKey="order:discounts">
            <OrderDiscountsCard order={order} frameless />
          </AccordionSection>
        )}

        <AccordionSection className={`order-15 ${GONE_WHEN_EMPTY}`} title={t.digital} icon={IconDigital} persistKey="order:digital" keepMounted>
          <OrderDigitalSection orderId={order.id} paid={order.financialState === "paid"} frameless />
        </AccordionSection>

        {/* What the shopper answered on the thank-you page; nothing when they did not. */}
        <AccordionSection className={`order-16 ${GONE_WHEN_EMPTY}`} title={t.survey} icon={IconChecklist} persistKey="order:survey" keepMounted>
          <OrderSurveyAnswers orderId={order.id} frameless />
        </AccordionSection>

        <AccordionSection className={`order-17 ${GONE_WHEN_EMPTY}`} title={t.supplier} icon={IconFactory} persistKey="order:supplier" keepMounted>
          <OrderSupplierCard order={order} onChanged={reload} frameless />
        </AccordionSection>

        <AccordionSection className={`order-18 ${GONE_WHEN_EMPTY}`} title={t.shipsFrom} icon={IconStore} persistKey="order:ships-from" keepMounted>
          <OrderShipsFrom order={order} onChanged={reload} frameless />
        </AccordionSection>

        {orderGiftOptionsOf(order) && (
          <AccordionSection
            id={ORDER_SECTION_ELEMENT.gift}
            className="order-19"
            title={t.gift}
            icon={IconGift}
            summary={lines.gift.summary}
            open={sections.isOpen("gift")}
            onOpenChange={(open) => sections.setOpen("gift", open)}
            persistKey="order:gift"
          >
            <OrderGiftCard order={order} frameless />
          </AccordionSection>
        )}

        {isOnAccountOrder(order) && (
          <AccordionSection
            className="order-20"
            title={t.onAccount}
            icon={IconCoins}
            summary={lines.onAccount.summary}
            badge={lines.onAccount.badge}
            persistKey="order:on-account"
            keepMounted
          >
            <OrderOnAccountCard order={order} onChanged={reload} frameless />
          </AccordionSection>
        )}
      </div>

      <div className={COLUMN}>
        {/* Written during the call: right under the money on a phone, at the top of the side column from lg up. */}
        <div className="order-3 min-w-0">
          <OrderNotesCard order={order} onChanged={reload} />
        </div>

        {/* What the hero does not say about the customer: the other contacts, the tools, billing, the internal note, risk flags. */}
        <AccordionSection
          id={ORDER_SECTION_ELEMENT.customer}
          className="order-9"
          title={t.customer}
          icon={IconUser}
          summary={lines.customer.summary}
          badge={lines.customer.badge}
          open={sections.isOpen("customer")}
          onOpenChange={(open) => sections.setOpen("customer", open)}
          persistKey="order:customer"
        >
          <OrderSummary order={order} onChanged={reload} only="customer" hideHeroFacts />
        </AccordionSection>

        <AccordionSection className="order-10" title={t.tags} icon={IconTag} summary={lines.tags.summary} persistKey="order:tags">
          <OrderTagsCard order={order} onChanged={reload} frameless />
        </AccordionSection>

        <AccordionSection
          className={`order-12 ${GONE_WHEN_EMPTY}`}
          title={t.risk}
          icon={IconShield}
          summary={lines.risk.summary}
          persistKey="order:risk"
          keepMounted
        >
          <OrderProtectionSection order={order} frameless />
        </AccordionSection>

        {/* Where the customer came from (first / last touch); nothing for an order without it. */}
        <AccordionSection className={`order-13 ${GONE_WHEN_EMPTY}`} title={t.traffic} icon={IconAttribution} persistKey="order:traffic" keepMounted>
          <OrderAttributionSection order={order} frameless />
        </AccordionSection>

        {session && (
          <AccordionSection className="order-14" title={t.session} icon={IconWebAnalytics} summary={lines.session.summary} persistKey="order:session">
            <OrderSessionCard details={session} frameless />
          </AccordionSection>
        )}
      </div>
    </div>
  );
}
