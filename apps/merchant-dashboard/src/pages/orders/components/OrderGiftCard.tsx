import type { ElementType } from "react";
import { IconEyeOff, IconGift, IconPackage } from "@/components/icons";
import { orderGiftOptionsOf } from "@store-builder/api-client";
import { useT, type Messages } from "@/i18n/LocaleContext";
import { CopyButton } from "@/components/CopyButton";

const STRINGS = {
  en: {
    badge: "Gift",
    title: "This order is a gift",
    wrapped: "Gift-wrap it before it ships — the wrap is a line in the items.",
    message: "Gift message",
    copy: "Copy message",
    printed: "The message prints on the waybill.",
    hidePrices: "Hide prices: no invoice or price tag in the parcel.",
  },
  ar: {
    badge: "هدية",
    title: "الأوردر ده هدية",
    wrapped: "غلّفه كهدية قبل الشحن — التغليف سطر في المنتجات.",
    message: "رسالة الإهداء",
    copy: "انسخ الرسالة",
    printed: "الرسالة بتتطبع على البوليصة.",
    hidePrices: "اخفي الأسعار: متحطش فاتورة ولا أي ورقة فيها سعر في الشحنة.",
  },
} satisfies Messages;

/**
 * Order page, above the items: the shopper's gift choice (handoff 214) for
 * whoever packs — wrap it, the message to put in, and whether the prices stay
 * out of the parcel. Nothing for an order that is not a gift.
 */
export function OrderGiftCard({ order, frameless }: { order: unknown; /** Inside a folding section: no card, no title row. */ frameless?: boolean }) {
  const t = useT(STRINGS);
  const gift = orderGiftOptionsOf(order);
  if (!gift) return null;
  const Frame: ElementType = frameless ? "div" : "section";
  const frame = frameless
    ? { className: "space-y-3" }
    : {
        "aria-labelledby": "order-gift-title",
        className: "space-y-3 rounded-[var(--radius-card)] bg-paper-raised p-4 shadow-[var(--shadow-card)] ring-1 ring-line sm:p-5",
      };
  return (
    <Frame {...frame}>
      {!frameless && (
        <div className="flex items-center gap-3">
          <span className="flex size-10 shrink-0 items-center justify-center rounded-2xl bg-primary-soft text-primary">
            <IconGift className="size-5" aria-hidden />
          </span>
          <h2 id="order-gift-title" className="min-w-0 flex-1 text-[15px] font-medium text-ink">
            {t.title}
          </h2>
          <span className="inline-flex items-center gap-1.5 rounded-full bg-primary-soft px-2.5 py-0.5 text-xs font-medium text-primary-dark dark:text-primary">
            <IconGift className="size-3.5" aria-hidden />
            {t.badge}
          </span>
        </div>
      )}
      {gift.wrapped && (
        <p className="flex items-start gap-2 text-sm text-ink">
          <IconPackage className="mt-0.5 size-4 shrink-0 text-ink-soft" aria-hidden />
          {t.wrapped}
        </p>
      )}
      {gift.message && (
        <div className="space-y-1.5">
          <div className="flex items-center justify-between gap-2">
            <h3 className="text-xs font-medium text-ink-soft">{t.message}</h3>
            <CopyButton value={gift.message} label={t.copy} className="min-h-11" />
          </div>
          <blockquote dir="auto" className="whitespace-pre-wrap break-words rounded-[var(--radius)] bg-paper-sunken px-3 py-2.5 text-sm text-ink">
            {gift.message}
          </blockquote>
          <p className="text-xs text-ink-soft">{t.printed}</p>
        </div>
      )}
      {gift.hidePrices && (
        <p className="flex items-start gap-2 rounded-[var(--radius)] bg-accent-soft px-3 py-2 text-sm font-medium text-accent-dark">
          <IconEyeOff className="mt-0.5 size-4 shrink-0" aria-hidden />
          {t.hidePrices}
        </p>
      )}
    </Frame>
  );
}
