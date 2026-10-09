import { cn } from "@store-builder/ui";
import { orderGiftOptionsOf, type Order } from "@store-builder/api-client";
import { IconGift, IconWarning, type IconComponent } from "@/components/icons";
import { StatusBadge } from "@/components/StatusBadge";
import { useT, type Messages } from "@/i18n/LocaleContext";
import { pluralOf } from "@/lib/plural";
import { RiskBadge } from "@/pages/fraud/RiskBadge";
import { OrderMetaBadges } from "../components/OrderHeaderTools";
import { useOrderLabels } from "../orderLabels";
import { OrderPackedBadge } from "../packing/PackingEntryPoints";

const STRINGS = {
  en: {
    label: "Where the order stands",
    confirmation: "Confirmation",
    fulfillment: "Fulfillment",
    gift: "A gift",
    flags_one: "1 risk flag",
    flags_other: "{n} risk flags",
  },
  ar: {
    label: "الأوردر واصل لفين",
    confirmation: "التأكيد",
    fulfillment: "التنفيذ",
    gift: "هدية",
    flags_one: "علامة اشتباه واحدة",
    flags_two: "علامتين اشتباه",
    flags_few: "{n} علامات اشتباه",
    flags_other: "{n} علامة اشتباه",
  },
} satisfies Messages;

const CHIP_TONE = {
  danger: "bg-danger-soft text-danger",
  info: "bg-primary-soft text-primary-dark",
} as const;

/** A chip that leads to a folded section further down the page: pressing it opens that section and brings it into view. */
function SectionChip({ onPress, tone, icon: Icon, text }: { onPress: () => void; tone: keyof typeof CHIP_TONE; icon: IconComponent; text: string }) {
  return (
    <button
      type="button"
      onClick={onPress}
      // The pill is 24px; the button reaches 44px for a thumb without pushing the row apart.
      className="group/chip -my-2.5 inline-flex cursor-pointer items-center rounded-full py-2.5 focus-visible:outline-2 focus-visible:outline-offset-[-6px] focus-visible:outline-primary"
    >
      <span
        className={cn(
          "inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-semibold whitespace-nowrap underline-offset-2 group-hover/chip:underline",
          CHIP_TONE[tone]
        )}
      >
        <Icon className="size-3.5 shrink-0" weight="fill" aria-hidden />
        {text}
      </span>
    </button>
  );
}

/**
 * The order's states as a quiet row of chips at the foot of the hero: what
 * needs a look first (risk flags, the risk level, a gift — each a link to its
 * section), then confirmation, fulfilment, where the order came from, and
 * test / archived / packed. The payment state sits with the amount, and the
 * customer's history with the name, where each is read.
 */
export function OrderStateChips({
  order,
  onReveal,
  className,
}: {
  order: Order;
  /** Opens the customer block or the gift section and scrolls to it. */
  onReveal: (section: "customer" | "gift") => void;
  className?: string;
}) {
  const t = useT(STRINGS);
  const labels = useOrderLabels();
  const flags = order.riskFlags ?? [];
  return (
    <div role="group" aria-label={t.label} className={cn("flex flex-wrap items-center gap-2", className)}>
      {flags.length > 0 && (
        <SectionChip onPress={() => onReveal("customer")} tone="danger" icon={IconWarning} text={pluralOf(t, "flags", flags.length)} />
      )}
      <RiskBadge order={order} />
      {orderGiftOptionsOf(order) && <SectionChip onPress={() => onReveal("gift")} tone="info" icon={IconGift} text={t.gift} />}
      <StatusBadge label={t.confirmation} value={order.confirmationState} text={labels.confirmation(order.confirmationState)} />
      <StatusBadge label={t.fulfillment} value={order.fulfillmentState} text={labels.fulfillment(order.fulfillmentState)} />
      <OrderMetaBadges order={order} />
      <OrderPackedBadge order={order} />
    </div>
  );
}
