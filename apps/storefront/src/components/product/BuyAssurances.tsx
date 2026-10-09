"use client";

import type { ReactNode } from "react";
import { useStore } from "@/lib/StoreContext";
import { deliveryGetText } from "@/lib/buyInfo";
import { EarnPointsNote } from "@/components/tenders/EarnPointsNote";
import { CashIcon, ReturnIcon, TruckIcon } from "../Icons";
import { DeliveryEstimateLine, useDeliveryEstimate, type DeliveryTarget } from "../DeliveryEstimateLine";
import { StoreLink } from "../StoreRoute";
import type { BuyPromises, PromiseLine } from "./buyPromises";
import { productPageText } from "./productPageText";

/**
 * The trust lines beside an order button: up to three short lines with small
 * icons, right where the shopper decides —
 *
 *   الدفع عند الاستلام      when the store takes cash on delivery;
 *   الاستبدال والاسترجاع    the store's own returns card, else a link to the
 *                           returns policy it wrote;
 *   مدة التوصيل             the window the API works out for the shopper's
 *                           place (DeliveryEstimateLine), and until it
 *                           answers — or when the store shows none — the
 *                           store's own shipping card.
 *
 * Every word is the store's or the API's: a store that wrote no cards, takes
 * no cash on delivery and shows no delivery window gets no lines at all. The
 * full cards stay lower on the page (StoreInfoCards).
 *
 * This is also where the buy box's late lines live. The delivery window and
 * «هتكسب … نقطة» are only known once the browser has asked, and here — under
 * the buttons — their arrival moves neither the price, the options nor the
 * buttons. The delivery window takes the shipping card's own line when the
 * store has one, so that line never changes height either.
 *
 * `promises: null` is a store that switched its trust badges off (purchase
 * form → show trust badges): only the delivery window, which is a setting of
 * its own, is said.
 */
export function BuyAssurances({
  cod,
  promises,
  target,
  earnUnit,
  quiet = false,
  className = "",
}: {
  /** The cash-on-delivery line, when the caller knows the store takes it; its words are the caller's. */
  cod: PromiseLine | null;
  promises: BuyPromises | null;
  /** Where the delivery window is asked for; null asks nothing (sold out, a pre-order). */
  target: DeliveryTarget | null;
  /** The chosen variant's unit price, for «هتكسب … نقطة» (a store with a points programme); left out under the form. */
  earnUnit?: number;
  /** The small grey type of a form's footnotes, centred. */
  quiet?: boolean;
  className?: string;
}) {
  const { t, locale, intlLocale, store } = useStore();
  const text = productPageText(locale);
  const estimate = useDeliveryEstimate(target);
  // The window in words; "" until the API has answered, and when the store shows none.
  const eta = estimate ? deliveryGetText(estimate, t.buyInfo, intlLocale) : "";

  const returns = promises?.returns ?? null;
  // No returns card, but a returns policy the store wrote: its name, as a link.
  const policy = promises && !returns && (store?.legal ?? []).includes("refund_policy");
  const shipping = promises?.shipping ?? null;

  const row = `flex min-w-0 items-center gap-1.5 ${quiet ? "justify-center text-xs text-ink-soft" : "text-sm text-ink"}`;
  const icon = quiet ? "shrink-0" : "shrink-0 text-primary";

  /** A card as one line: its title, then the store's first point in a softer voice, cut where the line ends. */
  const line = (Icon: typeof CashIcon, value: PromiseLine): ReactNode => (
    <li className={row}>
      <Icon size={16} className={icon} />
      <span className="min-w-0 truncate">
        <span className={quiet ? undefined : "font-medium"}>{value.title}</span>
        {value.point && <span className="ms-1.5 text-ink-soft">{value.point}</span>}
      </span>
    </li>
  );

  const any = Boolean(cod || returns || policy || eta || shipping);

  return (
    <div className={`flex flex-col empty:hidden ${className}`}>
      {any && (
        <ul aria-label={text.trust} className="grid gap-1.5">
          {cod && line(CashIcon, cod)}
          {returns
            ? line(ReturnIcon, returns)
            : policy && (
                <li className={row}>
                  <ReturnIcon size={16} className={icon} />
                  {/* One line tall, 44px to press: the link's own box reaches above and below it. */}
                  <StoreLink
                    href="/policies/refund-policy"
                    target="_blank"
                    className="relative rounded font-medium text-primary underline-offset-4 after:absolute after:inset-x-0 after:-inset-y-3 hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
                  >
                    {t.policies.refund_policy}
                  </StoreLink>
                </li>
              )}
          {eta ? (
            <li className="min-w-0">
              <DeliveryEstimateLine estimate={estimate} tone={quiet ? "quiet" : "plain"} className={quiet ? "justify-center" : ""} />
            </li>
          ) : (
            shipping && line(TruckIcon, shipping)
          )}
        </ul>
      )}
      {earnUnit !== undefined && <EarnPointsNote unitMinor={earnUnit} />}
    </div>
  );
}
