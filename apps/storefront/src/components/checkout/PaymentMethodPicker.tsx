"use client";

import type { CheckoutPayload } from "@store-builder/api-client";
import type { OnlinePaymentOptions } from "@/lib/usePaymentOptions";
import { useStore } from "@/lib/StoreContext";
import { CardIcon, CashIcon, WalletIcon } from "../Icons";

export type PaymentChoice = Extract<CheckoutPayload["paymentMethod"], "cod" | "card" | "wallet">;

/**
 * How the shopper pays. Cash on delivery is always there and always first;
 * card and mobile wallet appear only when the store has Paymob connected
 * (lib/usePaymentOptions) — with `online` null this is a single, pre-chosen
 * row and nothing about paying online is mentioned anywhere.
 *
 * An online choice changes what happens after the order is placed: the
 * shopper is sent to Paymob's hosted page (see lib/placeOrder.onlinePaymentUrl).
 */
export function PaymentMethodPicker({
  online,
  value,
  onChange,
  idPrefix,
  disabled = false,
}: {
  online: OnlinePaymentOptions | null;
  value: PaymentChoice;
  onChange: (next: PaymentChoice) => void;
  idPrefix: string;
  disabled?: boolean;
}) {
  const { t } = useStore();
  const choices: { id: PaymentChoice; Icon: typeof CashIcon; title: string; hint: string }[] = [
    { id: "cod", Icon: CashIcon, title: t.checkout.cod, hint: t.checkout.codHint },
    ...(online?.card ? [{ id: "card" as const, Icon: CardIcon, title: t.shop.payCard, hint: t.shop.payCardHint }] : []),
    ...(online?.wallet
      ? [{ id: "wallet" as const, Icon: WalletIcon, title: t.shop.payWallet, hint: t.shop.payWalletHint }]
      : []),
  ];

  return (
    <fieldset disabled={disabled} className="space-y-2">
      <legend className={online ? "mb-2 text-sm font-semibold text-ink" : "sr-only"}>
        {online ? t.shop.paymentChoose : t.checkout.payment}
      </legend>
      {choices.map(({ id, Icon, title, hint }) => {
        const selected = value === id;
        return (
          <label
            key={id}
            htmlFor={`${idPrefix}-pay-${id}`}
            className={`flex min-h-14 cursor-pointer items-center gap-3 rounded-xl border-2 px-4 py-3 transition-colors has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-primary ${
              selected ? "border-primary bg-primary-soft" : "border-line bg-paper-raised hover:border-primary"
            }`}
          >
            <input
              id={`${idPrefix}-pay-${id}`}
              type="radio"
              name={`${idPrefix}-paymentMethod`}
              value={id}
              checked={selected}
              onChange={() => onChange(id)}
              className="h-5 w-5 shrink-0 cursor-pointer accent-primary"
            />
            <Icon className="shrink-0 text-primary" />
            <span className="min-w-0">
              <span className="block text-sm font-semibold text-ink">{title}</span>
              <span className="block text-xs text-ink-soft">{hint}</span>
            </span>
          </label>
        );
      })}
    </fieldset>
  );
}
