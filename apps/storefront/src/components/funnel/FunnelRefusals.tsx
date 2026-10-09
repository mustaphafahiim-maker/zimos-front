"use client";

import { StoreLink } from "@/components/StoreRoute";
import { focusRing } from "@/components/ui";
import { checkoutRefusalText } from "@/lib/checkoutRefusals";
import { useStore } from "@/lib/StoreContext";

/*
 * What a funnel's checkout shows when the server refuses the funnel itself
 * (frontend-handoff 355): the funnel is not published in this store or is
 * paused (FUNNEL_NOT_AVAILABLE, FUNNEL_PAUSED) — the form gives way to one
 * sentence, and what the shopper typed stays in the form's state — or it does
 * not sell one of the lines (FUNNEL_ITEM_NOT_OFFERED): the way back to the
 * funnel's first page.
 */

/** «العرض ده مش متاح دلوقتي», in place of the order form. */
export function FunnelOfferGone() {
  const { locale } = useStore();
  return (
    <p
      role="alert"
      data-funnel-refusal="gone"
      className="mx-auto max-w-xl rounded-2xl border border-dashed border-line-strong bg-paper-raised px-6 py-10 text-center text-sm font-medium text-ink"
    >
      {checkoutRefusalText(locale).funnelGone}
    </p>
  );
}

/** The link under «المنتج ده مش من العرض ده…»: back to the funnel's first page. */
export function FunnelBackToOffer({ funnelId }: { funnelId: string }) {
  const { locale } = useStore();
  return (
    <StoreLink
      href={`/f/${funnelId}`}
      data-funnel-refusal="item"
      className={`inline-flex min-h-11 items-center rounded-lg text-sm font-medium text-primary underline-offset-4 hover:underline ${focusRing}`}
    >
      {checkoutRefusalText(locale).funnelBack}
    </StoreLink>
  );
}

const ONE_CLICK = {
  en: "Your bank needs you to confirm — the extra order was not charged",
  ar: "محتاجين تأكيد من البنك — الطلب الإضافي ما اتدفعش",
};

/**
 * A one-click offer whose saved-card charge needs the shopper (frontend-handoff 380):
 * `payment: { status: "declined", code: "SAVED_METHOD_NEEDS_SHOPPER" }` — not a decline,
 * so it gets its own sentence. Null for any other answer (the caller keeps its "declined" line).
 */
export function oneClickNeedsShopper(followOnOrder: unknown, locale: string): string | null {
  const payment = (followOnOrder as { payment?: { status?: string; code?: string } } | null | undefined)?.payment;
  if (payment?.status !== "declined" || payment.code !== "SAVED_METHOD_NEEDS_SHOPPER") return null;
  return locale === "ar" ? ONE_CLICK.ar : ONE_CLICK.en;
}
