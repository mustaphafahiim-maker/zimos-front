"use client";

import { checkoutHardeningCouponQuantity, checkoutHardeningFreeShipping, type StorefrontCouponPreview } from "@store-builder/api-client";
import { checkoutRefusalText } from "@/lib/checkoutRefusals";
import type { Locale } from "@/lib/i18n";
import { useStore } from "@/lib/StoreContext";

/*
 * What the code box says about free-shipping and buy-X-get-Y codes
 * (frontend-handoff 353), from the server's preview (POST /coupon-preview):
 * «الشحن مجاني بالكود ده» for `freeShipping: true`, and «زوّد N قطعة كمان» when a
 * buy-X-get-Y code is short of units (DISCOUNT_QUANTITY_NOT_MET, `details[0]`).
 */

/** «مجاني» for the summary's shipping row when the applied code ships the order free; null otherwise. */
export function couponFreeShippingLabel(coupon: StorefrontCouponPreview | null, locale: Locale): string | null {
  return checkoutHardeningFreeShipping(coupon) ? checkoutRefusalText(locale).free : null;
}

/** Why a buy-X-get-Y code does not apply yet, in the shopper's words; null for any other preview. */
export function couponShortOfUnits(coupon: StorefrontCouponPreview | null, locale: Locale): string | null {
  const short = checkoutHardeningCouponQuantity(coupon);
  return short ? checkoutRefusalText(locale).moreUnits(short.remainingUnits) : null;
}

/** The line under an applied code: free shipping, or how many more units it needs. Nothing for any other code. */
export function CouponCodeNote({ coupon, className = "" }: { coupon: StorefrontCouponPreview | null; className?: string }) {
  const { locale } = useStore();
  const short = couponShortOfUnits(coupon, locale);
  if (short) {
    return (
      <p role="status" className={`text-xs font-medium text-danger ${className}`.trimEnd()}>
        {short}
      </p>
    );
  }
  if (!checkoutHardeningFreeShipping(coupon)) return null;
  return (
    <p role="status" className={`text-xs font-medium text-success ${className}`.trimEnd()}>
      {checkoutRefusalText(locale).freeShippingCode}
    </p>
  );
}
