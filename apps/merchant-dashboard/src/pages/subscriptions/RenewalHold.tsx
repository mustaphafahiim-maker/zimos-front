import type { ReactNode } from "react";
import { Link } from "react-router-dom";
import { cn } from "@store-builder/ui";
import {
  renewalHoldOf,
  subscriptionCancelReasonOf,
  type CustomerSubscription,
  type RenewalHold,
} from "@store-builder/api-client";
import { IconWarning } from "@/components/icons";
import { formatDate } from "@/lib/format";
import { useT, fmt, type Messages } from "@/i18n/LocaleContext";
import { FactChip, type FactRow } from "@/pages/quotes/kit/Facts";

/**
 * A renewal held by the store's side (handoff 394): the gateway, the product,
 * the store or its plan stood in the way, not the customer. The customer is
 * not told, it is retried every 6 hours and lapses after 14 days.
 */
const STRINGS = {
  en: {
    held: "Renewal on hold (store side)",
    heldLabel: "Renewal",
    lapses: "Lapses on {date}",
    gateway_connection: "The payment gateway refused the keys or isn't connected",
    gateway_unavailable: "The payment gateway didn't answer",
    waitingGateway: "Waiting for the gateway to confirm the order",
    out_of_stock: "Out of stock",
    product_unavailable: "Product not for sale",
    store_unavailable: "Store suspended or plan lapsed",
    plan_limit: "Plan limit reached",
    wallet: "Zimos balance too low",
    platform_error: "A temporary error on our side",
    openPayments: "Open Payments",
    openProduct: "Open the product",
    openBilling: "Open Subscription",
    openOrder: "Open the order",
    lapsed: "Lapsed: its renewal stayed on hold",
    endedLabel: "Ended",
    tile: "Renewals on hold",
    tileShowing: "Showing only renewals on hold",
    tileShow: "Show them",
    tileClear: "Show all",
  },
  ar: {
    held: "التجديد متوقف من جهة المتجر",
    heldLabel: "التجديد",
    lapses: "ينتهي يوم {date}",
    gateway_connection: "بوابة الدفع رفضت المفاتيح أو غير مربوطة",
    gateway_unavailable: "بوابة الدفع لم ترد",
    waitingGateway: "في انتظار تأكيد البوابة للطلب",
    out_of_stock: "المنتج نفد",
    product_unavailable: "المنتج غير معروض للبيع",
    store_unavailable: "المتجر موقوف أو الاشتراك منتهٍ",
    plan_limit: "تم بلوغ حد الباقة",
    wallet: "رصيد زيموس لا يكفي",
    platform_error: "خطأ مؤقت لدينا",
    openPayments: "افتح المدفوعات",
    openProduct: "افتح المنتج",
    openBilling: "افتح الاشتراك",
    openOrder: "افتح الطلب",
    lapsed: "انتهى لأن التجديد ظل متوقفًا",
    endedLabel: "انتهى",
    tile: "تجديدات متوقفة",
    tileShowing: "ظاهر التجديدات المتوقفة بس",
    tileShow: "اعرضها",
    tileClear: "اعرض الكل",
  },
} satisfies Messages;

type T = Record<keyof (typeof STRINGS)["en"], string>;

function causeText(t: T, hold: RenewalHold): string {
  const known = t[hold.cause as keyof T];
  return typeof known === "string" && hold.cause in STRINGS.en ? known : (hold.reason ?? hold.cause);
}

/** Where the cause is fixed: Payments, the product, Subscription. */
function fixLink(t: T, hold: RenewalHold, sub: CustomerSubscription): { to: string; label: string } | null {
  switch (hold.cause) {
    case "gateway_connection":
      return { to: "/payments", label: t.openPayments };
    case "out_of_stock":
    case "product_unavailable":
      return sub.productId ? { to: `/products/${sub.productId}`, label: t.openProduct } : null;
    case "store_unavailable":
    case "wallet":
      return { to: "/settings?tab=billing", label: t.openBilling };
    default:
      return null;
  }
}

const LINK = "font-medium text-primary underline-offset-2 hover:underline";

/** The warning pill beside a row's status. */
export function RenewalHoldChip({ sub }: { sub: CustomerSubscription }) {
  const t = useT(STRINGS);
  const hold = renewalHoldOf(sub);
  if (!hold) return null;
  return (
    <FactChip tone="attention" className="max-w-full">
      <span title={`${causeText(t, hold)} · ${fmt(t.lapses, { date: formatDate(hold.lapsesAt) })}`}>{t.held}</span>
    </FactChip>
  );
}

/** Quick Look's lines for a held renewal, and for a subscription that lapsed while held. */
export function useRenewalHoldFacts(sub: CustomerSubscription | null): FactRow[] {
  const t = useT(STRINGS);
  if (!sub) return [];
  const rows: FactRow[] = [];
  const hold = renewalHoldOf(sub);
  const ended = sub.status === "cancelled";
  if (hold && !ended) {
    const link = fixLink(t, hold, sub);
    const value: ReactNode = (
      <span className="block text-accent-dark">
        <span className="block font-medium">{t.held}</span>
        <span className="block text-ink">{causeText(t, hold)}</span>
        {hold.cause === "gateway_unavailable" && hold.outcomeUnknown && (
          <span className="block text-ink-soft">
            {t.waitingGateway}
            {hold.orderId && (
              <>
                {" · "}
                <Link to={`/orders/${hold.orderId}`} className={LINK}>
                  {t.openOrder}
                </Link>
              </>
            )}
          </span>
        )}
        <span className="block text-ink-soft">{fmt(t.lapses, { date: formatDate(hold.lapsesAt) })}</span>
        {link && (
          <Link to={link.to} className={cn(LINK, "inline-flex min-h-11 items-center")}>
            {link.label}
          </Link>
        )}
      </span>
    );
    rows.push({ label: t.heldLabel, value });
  }
  if (ended && subscriptionCancelReasonOf(sub) === "renewal_on_hold") rows.push({ label: t.endedLabel, value: t.lapsed });
  return rows;
}

/**
 * «تجديدات متوقفة»: how many renewals are held, as a toggle that narrows the
 * list to them. Nothing while none is held and the filter is off.
 */
export function RenewalHoldTile({ count, active, onToggle }: { count: number; active: boolean; onToggle: () => void }) {
  const t = useT(STRINGS);
  if (count <= 0 && !active) return null;
  return (
    <button
      type="button"
      aria-pressed={active}
      onClick={onToggle}
      data-testid="renewals-on-hold"
      className={cn(
        "flex min-h-11 w-full cursor-pointer flex-wrap items-center gap-x-3 gap-y-1 rounded-[1.25rem] border px-4 py-2 text-start text-sm transition-colors",
        count > 0 ? "border-accent/30 bg-accent-soft text-ink" : "border-line bg-paper-raised text-ink-soft"
      )}
    >
      <IconWarning weight="fill" className={cn("size-5 shrink-0", count > 0 ? "text-accent-dark" : "text-ink-soft")} aria-hidden />
      <span className="font-medium">{t.tile}</span>
      <span className="tabular-nums text-base font-semibold">{fmt("{n}", { n: count })}</span>
      <span className="ms-auto text-[13px] font-semibold text-primary">{active ? t.tileClear : t.tileShow}</span>
      {active && <span className="basis-full text-xs text-ink-soft">{t.tileShowing}</span>}
    </button>
  );
}
