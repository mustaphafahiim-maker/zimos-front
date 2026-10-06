import { Link } from "react-router-dom";
import { Gift } from "lucide-react";
import type { Payment } from "@store-builder/api-client";
import { useT } from "@/i18n/LocaleContext";

const STRINGS = {
  en: { name: "Gift card" },
  ar: { name: "كارت هدية" },
};

/** A gift card's part of an order: the checkout records it as a captured payment of provider `gift_card` (handoff 189). */
export function isGiftCardPayment(payment: Pick<Payment, "providerCode">): boolean {
  return payment.providerCode === "gift_card";
}

/**
 * The order page's name for a gift-card payment: «كارت هدية •••• T6FK», a
 * link to the card. The server writes `providerReference` as "cardId:orderId"
 * and `maskedDisplay` as "Gift card •••• T6FK" (English, so only its last 4
 * is read).
 */
export function GiftCardPaymentName({ payment }: { payment: Pick<Payment, "providerReference" | "maskedDisplay"> }) {
  const t = useT(STRINGS);
  const last4 = /([A-Z0-9]{4})\s*$/.exec(payment.maskedDisplay ?? "")?.[1] ?? null;
  const cardId = payment.providerReference?.split(":")[0] || null;
  const label = (
    <>
      {t.name}
      {last4 && (
        <>
          {" "}
          <bdi dir="ltr">•••• {last4}</bdi>
        </>
      )}
    </>
  );
  if (!cardId) return label;
  return (
    <Link to={`/gift-cards/${cardId}`} className="text-primary hover:underline">
      {label}
    </Link>
  );
}

/** Stands where a gateway's logo would, in the same 2:1 box as ProviderLogo's small size. */
export function GiftCardPaymentIcon() {
  return (
    <span
      aria-hidden
      className="inline-flex h-7 w-14 shrink-0 items-center justify-center rounded-[0.5rem] border border-line bg-paper text-ink-soft"
    >
      <Gift className="size-4" />
    </span>
  );
}
