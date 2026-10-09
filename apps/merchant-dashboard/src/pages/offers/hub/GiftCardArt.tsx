import { cn } from "@store-builder/ui";
import { IconGift } from "@/components/icons";
import { useT, type Messages } from "@/i18n/LocaleContext";

const STRINGS = {
  en: {
    giftCard: "Gift card",
    codePlaceholder: "XXXX-XXXX-XXXX",
    codeLabel: "The code",
    to: "To",
    from: "From",
  },
  ar: {
    giftCard: "كارت هدية",
    codePlaceholder: "XXXX-XXXX-XXXX",
    codeLabel: "الكود",
    to: "إلى",
    from: "من",
  },
} satisfies Messages;

/**
 * A gift card as the shopper receives it: the store's name, the value, the
 * code (a placeholder until the card exists — the real one is shown once,
 * after it is made) and how long it is good for.
 *
 * The card keeps the proportions of a bank card (aspect-[1.6]), so its box is
 * reserved before anything is typed. Material — the brand gradient and the
 * sheen across it — is in glass/offers.css (`.zimos-gift-art`); without the
 * glass layer it is a solid card in the store's colour.
 */
export function GiftCardArt({
  store,
  amount,
  code,
  expiry,
  recipient,
  className,
}: {
  store: string;
  /** Formatted; an empty value shows a dash in its place. */
  amount: string;
  /** Left out: the placeholder. */
  code?: string;
  /** «صالح لحد ٣١ ديسمبر» or «مالوش تاريخ انتهاء». */
  expiry: string;
  recipient?: string;
  className?: string;
}) {
  const t = useT(STRINGS);
  return (
    <div
      data-slot="gift-art"
      className={cn(
        "zimos-gift-art relative flex aspect-[1.6] w-full flex-col justify-between overflow-hidden rounded-[1.25rem] bg-primary p-4 text-primary-foreground shadow-[var(--shadow-raised)]",
        className
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="truncate text-sm font-semibold">
            <bdi>{store}</bdi>
          </p>
          <p className="text-xs opacity-85">{t.giftCard}</p>
        </div>
        <IconGift className="size-7 shrink-0 opacity-90" weight="duotone" aria-hidden />
      </div>

      <p className="text-[1.75rem] leading-none font-semibold tabular-nums">
        <bdi>{amount || "—"}</bdi>
      </p>

      <div className="flex items-end justify-between gap-3">
        <div className="min-w-0">
          <p className="text-[11px] leading-4 opacity-85">{recipient ? t.to : t.codeLabel}</p>
          {recipient && (
            <p className="truncate text-sm font-medium">
              <bdi>{recipient}</bdi>
            </p>
          )}
          <p dir="ltr" className="truncate font-mono text-sm tracking-wider rtl:text-end">
            {code ?? t.codePlaceholder}
          </p>
        </div>
        <p className="max-w-[45%] shrink-0 text-end text-[11px] leading-4 opacity-90">{expiry}</p>
      </div>
    </div>
  );
}
