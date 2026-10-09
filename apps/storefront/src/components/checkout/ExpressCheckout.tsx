"use client";

import { useId, useSyncExternalStore, type RefObject } from "react";
import { flushSync } from "react-dom";
import { expressWalletsOf, type ExpressWallet, type StorefrontPaymentMethod } from "@store-builder/api-client";
import { useStore } from "@/lib/StoreContext";
import { track } from "@/lib/track";
import { card } from "../ui";

/** Brand names: never translated. */
const WALLET_NAMES: Record<ExpressWallet, string> = {
  apple_pay: "Apple Pay",
  google_pay: "Google Pay",
  paypal: "PayPal",
};

// The wallets' own button colours (brand, not store theme): black for Apple Pay and Google Pay, PayPal's yellow.
const WALLET_LOOK: Record<ExpressWallet, string> = {
  apple_pay: "bg-black text-white hover:bg-neutral-800",
  google_pay: "bg-black text-white hover:bg-neutral-800",
  paypal: "bg-[#ffc439] text-[#003087] hover:bg-[#f0b72f]",
};

const noSubscribe = () => () => {};

/** Apple Pay only where the browser has it (Safari on Apple devices); false while server-rendering. */
function useApplePay(): boolean {
  return useSyncExternalStore(
    noSubscribe,
    () => "ApplePaySession" in window,
    () => false
  );
}

/**
 * Express checkout (handoff 183): at the top of checkout, a button per wallet
 * of each method that carries `express` — Apple Pay (only where the browser
 * has it) and Google Pay for Stripe's card, the yellow PayPal button for
 * PayPal — then «Or pay another way».
 *
 * A button is a shortcut, not a second checkout: it picks its method on the
 * page and submits the page's own form, so the contact and address fields are
 * validated first and the order goes out with paymentMethod / paymentProvider
 * / returnUrl and on to `payment.redirectUrl` exactly as a card order does.
 * Stripe's page offers Apple Pay / Google Pay on capable devices; PayPal's asks
 * the shopper to approve. Nothing renders when no method has `express`.
 *
 * `frame`: "page" is the block above the form, as it was. "inline" is the
 * same buttons without a frame of their own, for inside the payment section:
 * the wallets are only known once the payment methods have loaded, and a
 * block arriving above the form pushes every field down under the shopper
 * who has already started on them.
 */
export function ExpressCheckout({
  methods,
  onChoose,
  submitRef,
  busy,
  frame = "page",
}: {
  /** The methods the checkout offers (already filtered by currency and plan). */
  methods: StorefrontPaymentMethod[];
  /** Picks the method the order is placed with (the page's own choice). */
  onChoose: (methodId: string) => void;
  /** The page's order button: its form is the one submitted. */
  submitRef: RefObject<HTMLButtonElement | null>;
  busy: boolean;
  frame?: "page" | "inline";
}) {
  const { t } = useStore();
  const titleId = useId();
  const applePay = useApplePay();

  const buttons = methods.flatMap((method) =>
    expressWalletsOf(method)
      .filter((wallet) => wallet !== "apple_pay" || applePay)
      .map((wallet) => ({ wallet, method }))
  );
  if (buttons.length === 0) return null;

  function pay(methodId: string) {
    if (busy) return;
    // Choosing an online method is the ad platforms' AddPaymentInfo (as in the method list).
    track("AddPaymentInfo");
    // Committed first, so the submit below runs with this method chosen.
    flushSync(() => onChoose(methodId));
    submitRef.current?.form?.requestSubmit();
  }

  if (frame === "inline") {
    return (
      <section aria-labelledby={titleId} className="mt-4">
        <h3 id={titleId} className="text-sm font-semibold text-ink">
          {t.express.title}
        </h3>
        <div className="mt-2 grid gap-2 sm:grid-cols-[repeat(auto-fit,minmax(11rem,1fr))]">
          {buttons.map(({ wallet, method }) => (
            <button
              key={`${method.id}:${wallet}`}
              type="button"
              disabled={busy}
              onClick={() => pay(method.id)}
              data-express-wallet={wallet}
              className={`inline-flex min-h-12 w-full cursor-pointer items-center justify-center gap-2 rounded-xl px-4 py-3 text-base font-semibold transition-colors disabled:cursor-not-allowed disabled:opacity-60 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary ${WALLET_LOOK[wallet]}`}
            >
              {t.express.payWith(WALLET_NAMES[wallet])}
              {method.mode === "test" && (
                <span className="rounded-full bg-accent-soft px-2 py-0.5 text-xs font-medium text-accent-dark">{t.payment.testTag}</span>
              )}
            </button>
          ))}
        </div>
        <p className="mt-2 text-xs text-ink-soft">{t.express.hint}</p>
        <p className="mt-4 flex items-center gap-3 text-sm font-medium text-ink-soft">
          <span aria-hidden className="h-px flex-1 bg-line" />
          {t.express.or}
          <span aria-hidden className="h-px flex-1 bg-line" />
        </p>
      </section>
    );
  }

  return (
    <div className="mt-6 grid gap-8 lg:grid-cols-[1fr_24rem]">
      <section aria-labelledby={titleId}>
        <div className={`${card} p-4 sm:p-5`}>
          <h2 id={titleId} className="text-base font-semibold text-ink">
            {t.express.title}
          </h2>
          <div className="mt-3 grid gap-2 sm:grid-cols-[repeat(auto-fit,minmax(11rem,1fr))]">
            {buttons.map(({ wallet, method }) => (
              <button
                key={`${method.id}:${wallet}`}
                type="button"
                disabled={busy}
                onClick={() => pay(method.id)}
                data-express-wallet={wallet}
                className={`inline-flex min-h-12 w-full cursor-pointer items-center justify-center gap-2 rounded-xl px-4 py-3 text-base font-semibold transition-colors disabled:cursor-not-allowed disabled:opacity-60 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary ${WALLET_LOOK[wallet]}`}
              >
                {t.express.payWith(WALLET_NAMES[wallet])}
                {method.mode === "test" && (
                  <span className="rounded-full bg-accent-soft px-2 py-0.5 text-xs font-medium text-accent-dark">
                    {t.payment.testTag}
                  </span>
                )}
              </button>
            ))}
          </div>
          <p className="mt-3 text-xs text-ink-soft">{t.express.hint}</p>
        </div>
        <p className="mt-6 flex items-center gap-3 text-sm font-medium text-ink-soft">
          <span aria-hidden className="h-px flex-1 bg-line" />
          {t.express.or}
          <span aria-hidden className="h-px flex-1 bg-line" />
        </p>
      </section>
    </div>
  );
}
