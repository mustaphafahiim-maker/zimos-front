"use client";

import { useEffect, useId, useRef, useState } from "react";
import type { Cart } from "@store-builder/api-client";
import { createStorefrontApiClient } from "@/lib/apiClient";
import { useShippingPlaces } from "@/lib/useShippingPlaces";
import { useShipTo } from "@/lib/shipTo";
import { useStore } from "@/lib/StoreContext";
import { useShippingQuote } from "@/lib/useShippingQuote";
import { useStoreCountry } from "@/lib/storeCountry";
import { input } from "@/components/ui";
import { FreeShippingHint, ShippingFee } from "./ShippingFee";
import { SupplierMinimumNotice, useSupplierMinimum } from "./SupplierMinimum";
import { DeliveryEstimateLine } from "../DeliveryEstimateLine";
import { arOrEn } from "@/lib/i18n";

/** The summary's bottom line as it reads on screen, for the cart page's bottom bar. */
export interface CartTotalText {
  label: string;
  value: string;
  /** The last total shown, while the next shipping quote is on its way. */
  stale: boolean;
}

/**
 * The money half of the cart (drawer and page): subtotal, shipping, and the
 * total once shipping is known — priced by the same quote the checkout and
 * the order use. The governorate picked here is the one checkout opens with
 * (lib/shipTo), so the shopper sees the real shipping before checkout.
 *
 * A store that prices no shipping keeps the cart exactly as it was:
 * "Calculated at checkout", no governorate picker, no total.
 *
 * `busy`: a cart change is still on its way to the server (lib/CartProvider).
 * The figures stay the last ones the server sent, dimmed and marked
 * aria-busy; nothing is worked out ahead of it. For the same reason, while a
 * new shipping quote is being fetched the last estimated total stays in its
 * row (dimmed) instead of leaving and coming back.
 */
export function CartShippingSummary({
  workspaceId,
  cart,
  enabled = true,
  busy = false,
  onTotal,
}: {
  workspaceId: string;
  cart: Cart;
  /** false asks the API nothing (a closed drawer). */
  enabled?: boolean;
  busy?: boolean;
  /** Told the bottom line whenever it changes: the estimated total as shown, or the subtotal while there is none. */
  onTotal?: (total: CartTotalText) => void;
}) {
  const { t, money, locale } = useStore();
  const [client] = useState(() => createStorefrontApiClient());
  const [shipTo, setShipTo] = useShipTo(workspaceId);
  const selectId = useId();
  const country = useStoreCountry();
  // The store's country's places it delivers to; a country without a list has no picker.
  const places = useShippingPlaces(country);
  const shipping = useShippingQuote({
    client,
    workspaceId,
    governorate: shipTo,
    country,
    lines: cart.items.map((l) => ({ variantId: l.variantId, offerId: l.offerId, quantity: l.quantity })),
    enabled,
  });

  const supplierMinimum = useSupplierMinimum(shipping.supplierMinimum, cart.currency);

  const unpriced = shipping.line.kind === "on_confirmation";
  const known = shipping.line.kind === "amount" || shipping.line.kind === "free";
  const calculating = shipping.line.kind === "calculating";
  const currency = cart.currency;

  // The estimated total exactly as its row prints it, read back from the row
  // rather than worked out a second time: kept on screen while the next quote
  // is on its way, and handed to the cart page's bottom bar.
  const totalCell = useRef<HTMLElement>(null);
  const [heldTotal, setHeldTotal] = useState<string | null>(null);
  const reported = useRef<string | null>(null);
  const totalLabel = t.checkout.totalEstimate;
  const subtotalLabel = t.cart.subtotal;
  const subtotalText = money(cart.subtotal, currency);
  useEffect(() => {
    const shown = known ? totalCell.current?.textContent || null : null;
    if (known) {
      if (shown !== heldTotal) setHeldTotal(shown);
    } else if (!calculating && heldTotal !== null) {
      setHeldTotal(null);
    }
    if (!onTotal) return;
    const next: CartTotalText =
      known && shown
        ? { label: totalLabel, value: shown, stale: false }
        : calculating && heldTotal
          ? { label: totalLabel, value: heldTotal, stale: true }
          : { label: subtotalLabel, value: subtotalText, stale: false };
    const signature = `${next.label}|${next.value}|${next.stale}`;
    if (reported.current === signature) return;
    reported.current = signature;
    onTotal(next);
  });

  return (
    <div className="space-y-3">
      {!unpriced && places.length > 0 && (
        <div className="flex items-center gap-2">
          <label htmlFor={selectId} className="shrink-0 text-sm text-ink-soft">
            {t.cart.shipTo}
          </label>
          {/* The field recipe as it is: 44px tall, 16px text (a smaller one makes iOS zoom the page on focus). */}
          <select
            id={selectId}
            value={shipTo}
            onChange={(e) => setShipTo(e.target.value)}
            className={`${input} min-w-0 cursor-pointer`}
          >
            <option value="">{t.cart.shipToPlaceholder}</option>
            {places.map((g) => (
              <option key={g.code} value={g.code}>
                {g[arOrEn(locale)]}
              </option>
            ))}
          </select>
        </div>
      )}

      <div
        aria-busy={busy || undefined}
        className={`space-y-3 transition-opacity duration-200 motion-reduce:transition-none ${busy ? "opacity-60" : ""}`}
      >
        <dl className="space-y-1.5 text-sm">
          <div className="flex justify-between gap-3">
            <dt className="text-ink-soft">{t.cart.subtotal}</dt>
            <dd className="font-semibold text-ink">{money(cart.subtotal, currency)}</dd>
          </div>
          <div className="flex justify-between gap-3">
            <dt className="text-ink-soft">{t.checkout.shippingFee}</dt>
            <dd className="text-end text-ink-soft">
              {unpriced ? t.cart.shippingAtCheckout : <ShippingFee line={shipping.line} currency={currency} />}
            </dd>
          </div>
          {known && (
            <div className="flex justify-between gap-3 border-t border-line pt-2 text-base font-bold text-ink">
              <dt>{t.checkout.totalEstimate}</dt>
              <dd ref={totalCell}>{money(Number(cart.subtotal) + shipping.amount, currency)}</dd>
            </div>
          )}
          {!known && calculating && heldTotal && (
            // The last total, held in its row while the new quote is fetched, so the row never leaves and comes back.
            <div aria-busy="true" className="flex justify-between gap-3 border-t border-line pt-2 text-base font-bold text-ink opacity-60">
              <dt>{t.checkout.totalEstimate}</dt>
              <dd>{heldTotal}</dd>
            </div>
          )}
        </dl>

        <DeliveryEstimateLine estimate={shipping.deliveryEstimate} />

        <FreeShippingHint progress={shipping.freeShipping} line={shipping.line} currency={currency} />
        {/* A supplier's minimum the cart does not reach yet (handoff 263): said here, before checkout. */}
        <SupplierMinimumNotice state={supplierMinimum} />
      </div>
    </div>
  );
}
