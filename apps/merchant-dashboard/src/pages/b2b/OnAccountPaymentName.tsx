import { IconPayout } from "@/components/icons";
import { ON_ACCOUNT_METHOD } from "@store-builder/api-client";
import { useT } from "@/i18n/LocaleContext";

const STRINGS = {
  en: {
    name: "On-account payment",
    reference: "Ref. {reference}",
    nothingPaid: "Paid later on account. No payment has been recorded yet, so there is nothing to refund.",
  },
  ar: {
    name: "دفعة آجل",
    reference: "مرجع {reference}",
    nothingPaid: "الدفع آجل. لسه مفيش دفعة اتسجّلت، فمفيش حاجة تترد.",
  },
};

/**
 * An on-account order nobody has paid anything on yet: like a cash-on-delivery
 * order before the courier collects, it has nothing to refund, whatever the
 * payments answer counts as refundable. Display only.
 */
export function isUnpaidOnAccountOrder(order: { paymentMethod?: string | null }, amountPaid: number | string | null | undefined): boolean {
  return order.paymentMethod === ON_ACCOUNT_METHOD && Number(amountPaid ?? 0) === 0;
}

/**
 * Whether an order can have transfers from its customer to review (a bank
 * transfer, a cash-on-delivery deposit). An on-account order cannot — and the
 * transfers list would answer its recorded payments, which the API also keeps
 * under provider `manual`, as if they were transfers waiting for a receipt.
 */
export function takesCustomerTransfers(order: { paymentMethod?: string | null }): boolean {
  return order.paymentMethod !== ON_ACCOUNT_METHOD;
}

/** What the payments card says for such an order, where the paid / refundable figures would be. */
export function OnAccountNothingPaid() {
  return <>{useT(STRINGS).nothingPaid}</>;
}

/** The fields of a payment this file reads (a `Payment`, whose `method` type predates on_account). */
interface PaymentBits {
  providerCode: string;
  method?: string | null;
  providerReference?: string | null;
}

/**
 * A payment the team recorded on an on-account order (handoff 229): the API
 * keeps it as a captured payment of provider `manual`, method `on_account`,
 * with the reference typed in `providerReference` and "On account" (English)
 * as its masked display.
 */
export function isOnAccountPayment(payment: PaymentBits): boolean {
  return payment.providerCode === "manual" && payment.method === ON_ACCOUNT_METHOD;
}

/** The order page's name for it: «دفعة آجل · مرجع TRX-88421». */
export function OnAccountPaymentName({ payment }: { payment: PaymentBits }) {
  const t = useT(STRINGS);
  const reference = payment.providerReference?.trim();
  if (!reference) return <>{t.name}</>;
  const [before, after] = t.reference.split("{reference}");
  return (
    <>
      {t.name} · {before}
      <bdi dir="auto">{reference}</bdi>
      {after}
    </>
  );
}

/** Stands where a gateway's logo would, in the same 2:1 box as ProviderLogo's small size. */
export function OnAccountPaymentIcon() {
  return (
    <span aria-hidden className="inline-flex h-7 w-14 shrink-0 items-center justify-center rounded-[0.5rem] border border-line bg-paper text-ink-soft">
      <IconPayout className="size-4" />
    </span>
  );
}
