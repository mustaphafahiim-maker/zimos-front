"use client";

import type { PaymentRuleOnMethod, StorefrontPaymentMethod } from "@store-builder/api-client";
import { useStore } from "@/lib/StoreContext";

/**
 * The fee or discount a payment method carries (SPEC §11.4), as the store set
 * it: "+ EGP 10.00 Cash on delivery fee" or "5% off". The amount on the order
 * itself is priced by the server; this only states the rule.
 */
export function PaymentAdjustmentNote({ method, currency = "EGP" }: { method: StorefrontPaymentMethod; currency?: string }) {
  const { money, locale } = useStore();
  const rule = (method as StorefrontPaymentMethod & { adjustment?: PaymentRuleOnMethod }).adjustment;
  if (!rule) return null;
  const amount = rule.valueType === "percent" ? `${rule.value / 100}%` : money(rule.value, currency);
  const ar = locale === "ar";
  const text =
    rule.type === "fee"
      ? `+ ${amount}${rule.label ? ` · ${rule.label}` : ar ? " رسوم" : " fee"}`
      : `− ${amount}${rule.label ? ` · ${rule.label}` : ar ? " خصم" : " off"}`;
  return (
    <span className={`mt-0.5 block text-xs font-medium ${rule.type === "fee" ? "text-ink-soft" : "text-success"}`}>
      <bdi>{text}</bdi>
    </span>
  );
}
