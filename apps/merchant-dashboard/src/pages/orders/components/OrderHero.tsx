import { ArrowDown, MapPin } from "lucide-react";
import { cn } from "@store-builder/ui";
import type { Order, OrderStage } from "@store-builder/api-client";
import { ContactActions } from "@/components/ContactActions";
import { formatAddress, formatMoney } from "@/lib/format";
import { useT, type Messages } from "@/i18n/LocaleContext";
import { useOrderLabels } from "../orderLabels";

const STRINGS = {
  en: {
    next: "Next step",
    go: "Go to it",
    awaiting_payment: "Waiting for the customer to pay online.",
    pending_confirmation: "Confirm the order with the customer before shipping it.",
    needs_follow_up: "The customer didn't answer or asked to wait. Call again.",
    ready_to_ship: "Confirmed. Book the courier and print the waybill.",
    shipped: "With the courier. Nothing to do until it is delivered.",
    out_for_delivery: "Out for delivery today.",
    delivery_failed: "Delivery failed. Call the customer and agree on a new time.",
    delivered: "Delivered. The cash arrives with the courier's settlement.",
    returned: "Came back as a return.",
    cancelled: "Cancelled.",
  },
  ar: {
    next: "الخطوة الجاية",
    go: "روح لها",
    awaiting_payment: "مستني العميل يدفع أونلاين.",
    pending_confirmation: "أكّد الأوردر مع العميل قبل ما تشحنه.",
    needs_follow_up: "العميل مردّش أو طلب يأجّل. كلّمه تاني.",
    ready_to_ship: "متأكد. احجز المندوب واطبع البوليصة.",
    shipped: "مع المندوب. مفيش حاجة تعملها لحد ما يتسلّم.",
    out_for_delivery: "خرج للتوصيل النهارده.",
    delivery_failed: "التوصيل فشل. كلّم العميل واتفقوا على ميعاد تاني.",
    delivered: "اتسلّم. الفلوس هتيجي مع تحصيل شركة الشحن.",
    returned: "رجع مرتجع.",
    cancelled: "اتلغى.",
  },
} satisfies Messages;

/** The section a stage's next step happens in (ids set on OrderDetailPage). */
const STAGE_TARGET: Partial<Record<OrderStage, string>> = {
  pending_confirmation: "order-confirmation",
  needs_follow_up: "order-confirmation",
  ready_to_ship: "order-shipments",
  delivery_failed: "order-shipments",
  awaiting_payment: "order-payments",
};

const STAGE_ACCENT: Partial<Record<OrderStage, string>> = {
  pending_confirmation: "bg-accent-soft text-accent-dark",
  needs_follow_up: "bg-accent-soft text-accent-dark",
  ready_to_ship: "bg-primary-soft text-primary-dark",
  delivery_failed: "bg-danger-soft text-danger",
  awaiting_payment: "bg-accent-soft text-accent-dark",
  delivered: "bg-success-soft text-success",
};

/**
 * The top of the order page (docs/ux/07-plan.md S5): who ordered, how to
 * reach them in one tap, what they owe, and the one thing to do next. The
 * detailed cards below are unchanged.
 */
export function OrderHero({ order }: { order: Order }) {
  const t = useT(STRINGS);
  const labels = useOrderLabels();
  const contact = order.contactSnapshot;
  const stage = order.stage;
  const target = stage ? STAGE_TARGET[stage] : undefined;
  const address = order.shippingAddressSnapshot ? formatAddress(order.shippingAddressSnapshot) : null;

  return (
    <section className="grid gap-[var(--bento-gap)] lg:grid-cols-3">
      <div className="rounded-[var(--radius-card)] bg-paper-raised p-4 shadow-[var(--shadow-card)] ring-1 ring-line sm:p-5 lg:col-span-2">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="truncate text-xl font-semibold text-ink">
              <bdi>{contact?.fullName || "—"}</bdi>
            </p>
            {contact?.phone && (
              <p className="mt-0.5 text-sm text-ink-soft">
                <bdi dir="ltr">{contact.phone}</bdi>
              </p>
            )}
          </div>
          <div className="text-end">
            <p className="text-2xl font-semibold text-ink tabular-nums">
              <bdi dir="ltr">{formatMoney(order.totalAmount, order.currency)}</bdi>
            </p>
            <p className="text-xs text-ink-soft">{labels.paymentMethod(order.paymentMethod)}</p>
          </div>
        </div>
        {address && (
          <p className="mt-3 flex items-start gap-1.5 text-sm text-ink-soft">
            <MapPin className="mt-0.5 size-4 shrink-0" aria-hidden />
            <bdi>{address}</bdi>
          </p>
        )}
        <ContactActions phone={contact?.phone} name={contact?.fullName} size="md" className="mt-4" />
      </div>

      {stage && (
        <div
          className={cn(
            "flex flex-col justify-between rounded-[var(--radius-card)] p-4 sm:p-5",
            STAGE_ACCENT[stage] ?? "bg-paper-sunken text-ink"
          )}
        >
          <div>
            <p className="text-[13px] font-medium opacity-90">
              {t.next} · {labels.stage(stage)}
            </p>
            <p className="mt-1 text-[15px] leading-6 font-semibold">{t[stage]}</p>
          </div>
          {target && (
            <a
              href={`#${target}`}
              onClick={(e) => {
                const el = document.getElementById(target);
                if (!el) return;
                e.preventDefault();
                el.scrollIntoView({ behavior: "smooth", block: "start" });
              }}
              className="mt-3 inline-flex min-h-11 items-center gap-1.5 self-start text-sm font-semibold underline-offset-4 hover:underline"
            >
              {t.go}
              <ArrowDown className="size-4" aria-hidden />
            </a>
          )}
        </div>
      )}
    </section>
  );
}
