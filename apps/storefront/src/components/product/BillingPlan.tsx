"use client";

import { useMemo } from "react";
import { billingPlanOf, type BillingInterval, type ProductBillingPlan, type StorefrontPaymentMethod } from "@store-builder/api-client";
import { useStore } from "@/lib/StoreContext";

/**
 * Subscription and installment products in the store (SPEC §18.1). The plan
 * is set in the dashboard (Subscriptions → product plans); the variant's price
 * is what each payment charges.
 *
 *  - BillingPlanNote: under the product's price, how often it is paid.
 *  - usePlanMethods: at checkout, only card methods for such a product — the
 *    server refuses anything else (PLAN_NEEDS_SAVED_CARD). With no card method
 *    the list is left as it is and the note says the product can't be ordered.
 *  - PlanPaymentNote: beside the payment methods, that the card is saved by
 *    the payment provider for the next payments.
 *  - PlanFormTitle: the product page's order form is not "pay on delivery".
 */

const TEXT = {
  ar: {
    every: (n: number, unit: BillingInterval) =>
      n === 1
        ? { week: "كل أسبوع", month: "كل شهر", year: "كل سنة" }[unit]
        : n === 2
          ? { week: "كل أسبوعين", month: "كل شهرين", year: "كل سنتين" }[unit]
          : `كل ${n} ${{ week: "أسابيع", month: "شهور", year: "سنين" }[unit]}`,
    subscription: (every: string) => `اشتراك، بيتجدد ${every}`,
    cancelAnytime: "تقدر تلغيه في أي وقت من اللينك اللي هيوصلك.",
    installments: (n: number, price: string, every: string) => `${n} دفعات، ${price} ${every}`,
    total: (total: string) => `الإجمالي ${total}`,
    cardOnly: "المنتج ده بيتدفع بالكارت بس.",
    cardSaved: "كارتك بيتحفظ عند مزوّد الدفع (مش عند المتجر) عشان الدفعات الجاية تتسحب منه تلقائيًا.",
    noCard: "المتجر مش بيقبل الدفع بالكارت دلوقتي، فمينفعش تطلب المنتج ده.",
    formTitle: "اطلب الآن — والدفع بالكارت",
  },
  en: {
    every: (n: number, unit: BillingInterval) =>
      n === 1 ? `every ${unit}` : `every ${n} ${unit}s`,
    subscription: (every: string) => `Subscription, renews ${every}`,
    cancelAnytime: "Cancel anytime from the link we send you.",
    installments: (n: number, price: string, every: string) => `${n} payments of ${price}, ${every}`,
    total: (total: string) => `${total} in total`,
    cardOnly: "This product is paid by card only.",
    cardSaved: "Your card is kept by the payment provider, never by the store, so the next payments are charged to it automatically.",
    noCard: "This store can't take card payments right now, so this product can't be ordered.",
    formTitle: "Order now — pay by card",
  },
};

function useText() {
  const { locale } = useStore();
  return TEXT[locale as keyof typeof TEXT] ?? TEXT.ar;
}

export function BillingPlanNote({ plan, unitMinor }: { plan: ProductBillingPlan | null; unitMinor: number }) {
  const text = useText();
  const { money } = useStore();
  if (!plan) return null;
  const every = text.every(plan.intervalCount ?? 1, plan.interval);
  return (
    <div className="zt-pdp-plan mt-2 rounded-xl border border-line bg-paper-raised px-4 py-3 text-sm text-ink">
      {plan.mode === "installments" ? (
        <>
          <p className="font-semibold">{text.installments(plan.payments, money(unitMinor), every)}</p>
          <p className="text-ink-soft">{text.total(money(unitMinor * plan.payments))}</p>
        </>
      ) : (
        <>
          <p className="font-semibold">{text.subscription(every)}</p>
          <p className="text-ink-soft">{text.cancelAnytime}</p>
        </>
      )}
    </div>
  );
}

/** The payment methods a checkout may offer, given whether it holds a product on a plan. */
export function usePlanMethods(methods: StorefrontPaymentMethod[], planned: boolean) {
  return useMemo(() => {
    if (!planned) return { methods, blocked: false };
    const cards = methods.filter((m) => m.method === "card");
    return cards.length > 0 ? { methods: cards, blocked: false } : { methods, blocked: true };
  }, [methods, planned]);
}

/** Whether any of these products is paid on a plan. */
export function hasPlan(products: Array<object | null | undefined>) {
  return products.some((p) => Boolean(p && billingPlanOf(p)));
}

export function PlanFormTitle() {
  return <>{useText().formTitle}</>;
}

export function PlanPaymentNote({ blocked }: { blocked: boolean }) {
  const text = useText();
  return (
    <div role={blocked ? "alert" : undefined} className={`mt-3 rounded-xl px-4 py-3 text-sm ${blocked ? "bg-danger-soft text-danger" : "bg-primary-soft text-ink"}`}>
      {blocked ? (
        <p>{text.noCard}</p>
      ) : (
        <>
          <p className="font-semibold">{text.cardOnly}</p>
          <p className="text-ink-soft">{text.cardSaved}</p>
        </>
      )}
    </div>
  );
}
