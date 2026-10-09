import type { ReactNode } from "react";
import { cn } from "@store-builder/ui";
import type { Order, OrderSessionDetails } from "@store-builder/api-client";
import { IconCash, IconPlace, IconUser, type IconComponent } from "@/components/icons";
import { ContactActions } from "@/components/ContactActions";
import { StatusBadge } from "@/components/StatusBadge";
import { formatAddress, formatMoney, parseMoney, placeName } from "@/lib/format";
import { providerName } from "@/lib/providers";
import { useT, type Messages } from "@/i18n/LocaleContext";
import { codAmountFor } from "@/pages/shipping/carriers";
import { useOrderLabels } from "../orderLabels";
import { NextStepButton } from "../detail/OrderNextStep";
import { OrderStateChips } from "../detail/OrderStateChips";
import { Ltr, fmtRich } from "../detail/rich";
import type { NextStepTone, OrderNextStep } from "../detail/useOrderNextStep";
import { CustomerHistoryBadge } from "./OrderSessionDetails";
import { WhatsappConfirmButton } from "./WhatsappConfirmButton";
import { OrderLanguageTag } from "./OrderLanguage";

const STRINGS = {
  en: {
    hero: "The order at a glance",
    who: "Customer",
    howMuch: "Amount",
    where: "Address",
    noName: "No name",
    payment: "Payment",
    payOnDelivery: "Paid on delivery",
    toCollect: "{amount} to collect on delivery",
    paid: "{amount} paid",
    refunded: "{amount} refunded",
    next: "Next step",
    listSep: ", ",
  },
  ar: {
    hero: "الأوردر في نظرة",
    who: "العميل",
    howMuch: "المبلغ",
    where: "العنوان",
    noName: "من غير اسم",
    payment: "الدفع",
    payOnDelivery: "هيتدفع عند الاستلام",
    toCollect: "هيتحصّل {amount} عند الاستلام",
    paid: "اتدفع {amount}",
    refunded: "اترجّع {amount}",
    next: "الخطوة الجاية",
    listSep: "، ",
  },
} satisfies Messages;

// The strip that says what happens next takes the colour of how urgent it is. Soft token
// fills on their own; under the glass layer they let a little of the pane through.
const STEP_TONE: Record<NextStepTone, string> = {
  attention: "bg-accent-soft",
  primary: "bg-primary-soft",
  danger: "bg-danger-soft",
  success: "bg-success-soft",
  neutral: "bg-paper-sunken",
};

/** One of the hero's three facts: a quiet caption with its glyph, then the fact itself. */
function Fact({ icon: Icon, caption, first, children }: { icon: IconComponent; caption: string; first?: boolean; children: ReactNode }) {
  return (
    <div
      data-slot="order-fact"
      // Stacked rows with a hairline between them on a phone; columns with a hairline between them from lg up.
      className={cn("min-w-0 p-4 sm:p-5", !first && "border-t border-line lg:border-t-0 lg:border-s")}
    >
      <p className="zimos-order-caption mb-1.5 flex items-center gap-1.5 text-xs font-medium text-ink-soft">
        <Icon className="size-3.5 shrink-0" aria-hidden />
        {caption}
      </p>
      {children}
    </div>
  );
}

/**
 * The top of the order page, and on a phone its whole first screen: one pane
 * that says who ordered and how to reach them in one tap, how much it is and
 * what is still to collect, where it goes — and what happens next, as one
 * button (docs/ux/REDESIGN_PROMPT.md §6).
 *
 * These facts are said here and nowhere else on the page: the customer block
 * further down keeps only what the hero leaves out. The name and the total
 * carry `data-vt-part`, so a row opened from the orders list travels into
 * place (lib/viewTransition.ts; the stage chip in the header is the third
 * part, and the page wraps all three in `data-vt-target`).
 *
 * The next step is decided in `detail/useOrderNextStep.ts`. From md up its
 * button stands in this pane; on a phone the page shows the same button in
 * the bar above the dock instead, where the thumb is, and the pane keeps the
 * sentence. Structure only here — the pane's glass is glass/order-page.css.
 */
export function OrderHero({
  order,
  session,
  nextStep,
  onChanged,
  onReveal,
}: {
  order: Order;
  session: OrderSessionDetails | null | undefined;
  nextStep: OrderNextStep | null;
  onChanged: () => void;
  /** Opens a folded section further down (the customer block, the gift) and scrolls to it. */
  onReveal: (section: "customer" | "gift") => void;
}) {
  const t = useT(STRINGS);
  const labels = useOrderLabels();
  const contact = order.contactSnapshot;
  const address = order.shippingAddressSnapshot;

  const paid = parseMoney(order.amountPaid);
  const refunded = parseMoney(order.amountRefunded);
  const toCollect = codAmountFor(order);
  const money = (amount: number | string) => <Ltr>{formatMoney(amount, order.currency)}</Ltr>;

  // Where: the governorate and the city on one line (said once when they are the same), the street under them.
  const area = [placeName(address?.province), placeName(address?.city)].filter((part, i, all) => part && all.indexOf(part) === i);
  const street = [address?.addressLine, address?.postalCode, address?.country && address.country !== "EG" ? address.country : null].filter(
    (part): part is string => Boolean(part)
  );

  return (
    <section
      data-slot="order-hero"
      aria-label={t.hero}
      className="zimos-order-hero min-w-0 rounded-[1.75rem] bg-paper-raised shadow-[var(--shadow-card)] ring-1 ring-line"
    >
      <div className="grid lg:grid-cols-[minmax(0,1.25fr)_minmax(0,0.9fr)_minmax(0,1.25fr)]">
        <Fact icon={IconUser} caption={t.who} first>
          <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1">
            <p data-vt-part="title" className="inline-block max-w-full truncate text-[22px] leading-8 font-semibold text-ink">
              <bdi>{contact?.fullName?.trim() || t.noName}</bdi>
            </p>
            <CustomerHistoryBadge details={session} />
            {/* The language the shopper used, when it is not the store's own (handoff 383). */}
            <OrderLanguageTag locale={(order as { locale?: string | null }).locale} />
          </div>
          {contact?.phone && (
            <p className="mt-0.5 text-base text-ink-soft">
              <Ltr>{contact.phone}</Ltr>
            </p>
          )}
          {/* Call and WhatsApp share the row edge to edge on a phone (each already 44px tall), and sit at their own width from sm up. */}
          <ContactActions phone={contact?.phone} name={contact?.fullName} size="md" className="mt-3 [&>a]:flex-1 sm:[&>a]:flex-none" />
        </Fact>

        <Fact icon={IconCash} caption={t.howMuch}>
          <p data-vt-part="amount" className="inline-block text-[28px] leading-9 font-semibold text-ink tabular-nums">
            <bdi dir="ltr">{formatMoney(order.totalAmount, order.currency)}</bdi>
          </p>
          <p className="mt-0.5 text-sm text-ink-soft">
            {labels.paymentMethod(order.paymentMethod)}
            {order.paymentProvider && ` · ${providerName(order.paymentProvider)}`}
          </p>
          <div className="mt-2 flex flex-wrap items-center gap-x-2.5 gap-y-1.5">
            {/* Unpaid is the normal state of a cash-on-delivery order, not a warning (re-audit N-15). */}
            {order.paymentMethod === "cod" && order.financialState === "pending" ? (
              <StatusBadge label={t.payment} value="cod_pending" tone="neutral" text={t.payOnDelivery} />
            ) : (
              <StatusBadge label={t.payment} value={order.financialState} text={labels.financial(order.financialState)} />
            )}
          </div>
          {(paid > 0 || toCollect > 0 || refunded > 0) && (
            <ul className="mt-2 space-y-0.5 text-sm text-ink-soft">
              {paid > 0 && <li>{fmtRich(t.paid, { amount: money(paid) })}</li>}
              {toCollect > 0 && <li className="font-medium text-ink">{fmtRich(t.toCollect, { amount: money(toCollect) })}</li>}
              {refunded > 0 && <li>{fmtRich(t.refunded, { amount: money(refunded) })}</li>}
            </ul>
          )}
        </Fact>

        <Fact icon={IconPlace} caption={t.where}>
          {address ? (
            <>
              {area.length > 0 && <p className="text-[17px] leading-7 font-semibold text-ink">{area.join(" · ")}</p>}
              {street.length > 0 && (
                <p className="mt-0.5 text-sm leading-6 text-ink-soft">
                  <bdi>{street.join(t.listSep)}</bdi>
                </p>
              )}
            </>
          ) : (
            <p className="text-sm text-ink-soft">{formatAddress(null)}</p>
          )}
        </Fact>
      </div>

      <OrderStateChips order={order} onReveal={onReveal} className="border-t border-line px-4 py-3 sm:px-5" />

      {nextStep && (
        <div
          data-slot="order-step"
          data-tone={nextStep.tone}
          className={cn(
            "zimos-order-step flex flex-col gap-3 rounded-b-[1.75rem] border-t border-line p-4 sm:p-5 md:flex-row md:items-center md:justify-between",
            STEP_TONE[nextStep.tone]
          )}
        >
          <div className="min-w-0">
            <p className="zimos-order-caption text-xs font-medium text-ink-soft">{t.next}</p>
            <p className="mt-0.5 text-[15px] leading-6 font-semibold text-ink">{nextStep.sentence}</p>
            {nextStep.note && (
              <p role="status" className="mt-0.5 text-sm leading-6 text-ink-soft">
                {nextStep.note}
              </p>
            )}
          </div>
          {/* With nothing in it — or, on a phone, only the button that lives in the bar — the row takes no room. */}
          <div className="flex shrink-0 flex-wrap items-center gap-2 empty:hidden max-md:has-[>.zimos-order-next:only-child]:hidden">
            {/* The quiet second way: the store's WhatsApp confirmation. It shows itself only while the order can still be confirmed. */}
            <WhatsappConfirmButton order={order} onChanged={onChanged} />
            {/* On a phone the same button is the bar above the dock (the page draws it there). */}
            {nextStep.action && <NextStepButton action={nextStep.action} className="max-md:hidden" />}
          </div>
        </div>
      )}
    </section>
  );
}
