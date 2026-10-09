"use client";

import { manualPaymentStoreMethod, type StorefrontPaymentMethod } from "@store-builder/api-client";
import { StoreMethodDetails, useStoreMethodText } from "@/components/payment/StoreMethodPay";
import { CardIcon, CashIcon, WalletIcon } from "@/components/Icons";
import { useStore } from "@/lib/StoreContext";
import { track } from "@/lib/track";
import { asTransferMethod, useTransferCopy } from "./TransferDetails";
import { PaymentAdjustmentNote } from "./PaymentAdjustmentNote";
import { useSaveCard } from "@/lib/saveCard";
import { usePaymentMethodText } from "@/lib/paymentMethodText";
import { PlanPaymentNote } from "@/components/product/BillingPlan";
// «ادفع آجل» for a signed-in shopper the store approved (handoff 229): its own row, with what is left of their limit.
import { OnAccountMethodRow, isOnAccountMethod } from "@/components/business/BusinessCheckout";

/**
 * The checkout's payment section. With cash on delivery as the only method
 * (every store until it connects a gateway) it is the same static block the
 * checkout always showed; with more, a radio list in the merchant's order.
 */
export function PaymentMethodPicker({
  methods,
  value,
  onChange,
  idPrefix,
  plan,
}: {
  methods: StorefrontPaymentMethod[];
  value: string;
  onChange: (id: string) => void;
  idPrefix: string;
  /** A product on a plan is in the order: card only, saved without a tick (product/BillingPlan). */
  plan?: { blocked: boolean; trialDays?: number } | null;
}) {
  const { t, store } = useStore();
  const workspaceId = store?.workspaceId ?? "";
  const transferCopy = useTransferCopy();
  const storeMethodText = useStoreMethodText();
  const chosenStoreMethod = manualPaymentStoreMethod(methods.find((m) => m.id === value));
  const more = usePaymentMethodText();
  const [saveCard, setSaveCard] = useSaveCard(workspaceId);
  const cardChosen = !plan && methods.some((m) => m.id === value && m.method === "card");
  const planNote = plan ? <PlanPaymentNote blocked={plan.blocked} trialDays={plan.trialDays} /> : null;

  const copy = (m: StorefrontPaymentMethod) =>
    manualPaymentStoreMethod(m)
      ? { title: manualPaymentStoreMethod(m)!.name, hint: <bdi>{storeMethodText.payTo(manualPaymentStoreMethod(m)!.accountNumber)}</bdi>, Icon: WalletIcon }
      : asTransferMethod(m)
      ? { title: asTransferMethod(m)!.name, hint: transferCopy.hint, Icon: WalletIcon }
      : m.method === "card"
      ? { title: t.payment.card, hint: t.payment.cardHint, Icon: CardIcon }
      : m.method === "wallet"
        ? { title: t.payment.wallet, hint: t.payment.walletHint, Icon: WalletIcon }
        : m.method === "valu"
          ? { title: more.valu, hint: more.valuHint, Icon: CardIcon }
          : m.method === "kiosk"
            ? { title: more.kiosk, hint: more.kioskHint, Icon: CashIcon }
            : (m.method as string) === "paypal" // handoff 183: also an express button at the top of checkout
              ? { title: t.express.paypal, hint: t.express.paypalHint, Icon: WalletIcon }
            : { title: t.checkout.cod, hint: t.checkout.codHint, Icon: CashIcon };

  if (methods.length === 1 && methods[0].method === "cod") {
    const { title, hint, Icon } = copy(methods[0]);
    return (
      <>
        <div className="mt-4 flex min-h-14 items-center gap-3 rounded-xl border-2 border-primary bg-primary-soft px-4 py-3">
          <Icon className="shrink-0 text-primary" />
          <p>
            <span className="block text-sm font-semibold text-ink">{title}</span>
            <span className="block text-xs text-ink-soft">{hint}</span>
          </p>
        </div>
        {planNote}
      </>
    );
  }

  return (
    <div role="radiogroup" aria-label={t.checkout.payment} className="mt-4 space-y-2">
      {methods.map((m) => {
        if (isOnAccountMethod(m)) return <OnAccountMethodRow key={m.id} method={m} checked={value === m.id} onChange={onChange} idPrefix={idPrefix} />;
        const { title, hint, Icon } = copy(m);
        const checked = value === m.id;
        return (
          <label
            key={m.id}
            htmlFor={`${idPrefix}-pay-${m.id}`}
            className={`flex min-h-14 cursor-pointer items-center gap-3 rounded-xl border-2 px-4 py-3 transition-colors has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-primary ${
              checked ? "border-primary bg-primary-soft" : "border-line bg-paper-raised hover:border-primary/50"
            }`}
          >
            <input
              id={`${idPrefix}-pay-${m.id}`}
              type="radio"
              name={`${idPrefix}-payment`}
              value={m.id}
              checked={checked}
              onChange={() => {
                // Choosing an online method is the ad platforms' AddPaymentInfo.
                if (m.method !== "cod") track("AddPaymentInfo");
                onChange(m.id);
              }}
              className="size-4 shrink-0 accent-primary"
            />
            <Icon className="shrink-0 text-primary" />
            <span className="min-w-0 flex-1">
              <span className="flex items-center gap-2 text-sm font-semibold text-ink">
                {title}
                {m.mode === "test" && (
                  <span className="rounded-full bg-accent-soft px-2 py-0.5 text-xs font-medium text-accent-dark">
                    {t.payment.testTag}
                  </span>
                )}
              </span>
              <span className="block text-xs text-ink-soft">{hint}</span>
              <PaymentAdjustmentNote method={m} />
            </span>
          </label>
        );
      })}
      {/* The store's InstaPay or wallet number (handoff 340): where to pay, before the order is placed; the screenshot is asked for after. */}
      {chosenStoreMethod && <StoreMethodDetails key={chosenStoreMethod.id} method={chosenStoreMethod} />}
      {cardChosen && (
        <label className="flex min-h-11 cursor-pointer items-start gap-2 px-1 pt-1 text-sm text-ink">
          <input
            type="checkbox"
            checked={saveCard}
            onChange={(e) => setSaveCard(e.target.checked)}
            className="mt-0.5 size-4 shrink-0 accent-primary"
          />
          <span>
            <span className="block">{t.payment.saveCard}</span>
            <span className="block text-xs text-ink-soft">{t.payment.saveCardHint}</span>
          </span>
        </label>
      )}
      {planNote}
    </div>
  );
}
