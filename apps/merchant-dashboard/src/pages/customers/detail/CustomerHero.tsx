import type { ReactNode } from "react";
import { Button, cn } from "@store-builder/ui";
import type { Contact, Customer } from "@store-builder/api-client";
import { IconCash, IconDelivered, IconOrders, IconPackageFailed, IconUser, IconUserBlocked, type IconComponent } from "@/components/icons";
import { ContactActions } from "@/components/ContactActions";
import { SkeletonBar } from "@/components/DataState";
import { StatusBadge } from "@/components/StatusBadge";
import { fmt, useT, type Messages } from "@/i18n/LocaleContext";
import { formatDateTime, formatMoney } from "@/lib/format";
import { formatRelativeTime } from "@/lib/relativeTime";
import { deliveryRateTone } from "../contactStrings";

const STRINGS = {
  en: {
    hero: "The customer at a glance",
    noName: "Customer without a name",
    blocked: "Blocked",
    blockedPlain: "This customer is blocked and can't check out.",
    blockedReason: "This customer is blocked — {reason}.",
    unblock: "Remove the block",
    facts: "Their history with the store",
    statOrders: "Orders",
    lastOrder: "Last order {when}",
    noOrders: "Hasn't ordered yet",
    statDelivered: "Received",
    percent: "{n}%",
    deliveredOf: "{delivered} of {closed} received",
    deliveredNone: "No parcel has finished yet",
    statRejected: "Refused / returned",
    reliability: "Reliability score {score}",
    statSpent: "Total spent",
    unknown: "—",
  },
  ar: {
    hero: "العميل في نظرة",
    noName: "عميل من غير اسم",
    blocked: "محظور",
    blockedPlain: "العميل ده محظور ومش هيقدر يكمّل أي أوردر.",
    blockedReason: "العميل ده محظور — {reason}.",
    unblock: "شيل الحظر",
    facts: "تاريخه مع المتجر",
    statOrders: "الأوردرات",
    lastOrder: "آخر أوردر {when}",
    noOrders: "لسه ما طلبش",
    statDelivered: "نسبة الاستلام",
    percent: "{n}٪",
    deliveredOf: "{delivered} من {closed} استلموا",
    deliveredNone: "مفيش شحنات خلصت لسه",
    statRejected: "رفض / رجّع",
    reliability: "درجة الموثوقية {score}",
    statSpent: "إجمالي اللي دفعه",
    unknown: "—",
  },
} satisfies Messages;

type Tone = "primary" | "success" | "warning" | "danger" | "neutral";

// On their own (glass off) the chips are the soft token fills; under the glass layer
// (glass/customer-page.css, `[data-slot="customer-stat"]`) a drop of the tone over the pane.
const STAT_FILL: Record<Tone, string> = {
  primary: "bg-primary-soft",
  success: "bg-success-soft",
  warning: "bg-accent-soft",
  danger: "bg-danger-soft",
  neutral: "bg-paper-sunken",
};
const STAT_INK: Record<Tone, string> = {
  primary: "text-primary-dark",
  success: "text-success",
  warning: "text-accent-dark",
  danger: "text-danger",
  neutral: "text-ink-soft",
};
const METER_FILL: Record<Tone, string> = {
  primary: "bg-primary",
  success: "bg-success",
  warning: "bg-accent",
  danger: "bg-danger",
  neutral: "bg-ink-soft",
};

/**
 * One fact of the customer's history: a caption with its glyph, the figure,
 * and a quiet line under it. The chip keeps its height while its figure is
 * still on the way, so nothing moves when it arrives.
 */
function Stat({
  icon: Icon,
  caption,
  tone,
  loading,
  value,
  hint,
  children,
}: {
  icon: IconComponent;
  caption: string;
  tone: Tone;
  loading?: boolean;
  value: ReactNode;
  hint?: ReactNode;
  children?: ReactNode;
}) {
  return (
    <div data-slot="customer-stat" data-tone={tone} className={cn("flex min-h-[6.5rem] min-w-0 flex-col rounded-2xl p-3", STAT_FILL[tone])}>
      <dt className="zimos-customer-caption flex min-w-0 items-center gap-1.5 text-xs leading-4 font-medium text-ink-soft">
        <Icon data-slot="customer-stat-icon" className={cn("size-4 shrink-0", STAT_INK[tone])} aria-hidden />
        <span className="truncate">{caption}</span>
      </dt>
      <dd className="mt-1 min-w-0">
        {loading ? (
          <>
            <SkeletonBar className="mt-2 h-5 w-16" />
            <SkeletonBar className="mt-2.5 w-24 max-w-full" />
          </>
        ) : (
          <>
            <p className="truncate text-xl leading-7 font-semibold text-ink tabular-nums">{value}</p>
            {hint && <p className="zimos-customer-caption truncate text-xs leading-5 text-ink-soft">{hint}</p>}
            {children}
          </>
        )}
      </dd>
    </div>
  );
}

/**
 * The top of the customer page, and on a phone its first screen: who this is,
 * the number as digits that read left to right, call and WhatsApp one tap
 * away — and their history with the store as four facts a cash-on-delivery
 * merchant decides by: how many orders, how many of their parcels were
 * actually received, how many they refused, and what they have paid.
 *
 * Everything here is read from the two records the page already loads: the
 * customer (orders, refused, reliability, the block) and the contact
 * (received, spent, the last order). While the contact is on its way its two
 * chips hold their place; if it could not be read they say "—", never a guess.
 *
 * From md up call and WhatsApp stand in this pane; on a phone the page draws
 * them in the bar above the dock instead, where the thumb is. Structure only
 * here — the pane's glass is glass/customer-page.css.
 */
export function CustomerHero({
  customer,
  contact,
  contactLoading,
  currency,
  phoneText,
  phone,
  onUnblock,
}: {
  customer: Customer;
  /** The contact record of the same person, once the page has it. */
  contact: Contact | null;
  contactLoading: boolean;
  currency: string;
  /** The number as it is shown; null for an erased customer. */
  phoneText: string | null;
  /** The whole number, for the call and WhatsApp buttons; null when it can't be dialled. */
  phone: string | null;
  onUnblock: () => void;
}) {
  const t = useT(STRINGS);
  const name = customer.fullName?.trim() || "";
  const initial = name ? Array.from(name)[0].toLocaleUpperCase() : "";

  const rate = contact && contact.deliveryRate !== null ? Math.round(contact.deliveryRate) : null;
  const rateTone: Tone = rate === null ? "neutral" : deliveryRateTone(rate);
  const refused = customer.totalRejectedOrders;

  return (
    <section
      data-slot="customer-hero"
      aria-label={t.hero}
      className="zimos-customer-hero min-w-0 rounded-[1.75rem] bg-paper-raised shadow-[var(--shadow-card)] ring-1 ring-line"
    >
      <div className="flex flex-col gap-4 p-4 sm:p-5 md:flex-row md:items-center md:justify-between">
        <div className="flex min-w-0 items-center gap-3">
          <span
            aria-hidden
            data-slot="customer-avatar"
            className="flex size-14 shrink-0 items-center justify-center rounded-full bg-primary-soft text-xl leading-none font-semibold text-primary-dark"
          >
            {initial || <IconUser className="size-6" weight="duotone" />}
          </span>
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1">
              <h2 data-vt-part="title" className="inline-block max-w-full truncate text-[22px] leading-8 font-semibold text-ink">
                <bdi>{name || t.noName}</bdi>
              </h2>
              {/* Never the colour alone: the word says it too. */}
              {customer.isBlacklisted && <StatusBadge value="blocked" tone="danger" text={t.blocked} />}
            </div>
            {phoneText && (
              <p className="mt-0.5 text-base leading-6 text-ink-soft tabular-nums">
                <bdi dir="ltr">{phoneText}</bdi>
              </p>
            )}
          </div>
        </div>
        {/* On a phone the same two buttons are the bar above the dock (the page draws it there). */}
        <ContactActions phone={phone} name={customer.fullName} size="md" className="shrink-0 max-md:hidden" />
      </div>

      <dl aria-label={t.facts} className="grid grid-cols-2 gap-2 px-4 pb-4 sm:gap-3 sm:px-5 sm:pb-5 lg:grid-cols-4">
        <Stat
          icon={IconOrders}
          caption={t.statOrders}
          tone="primary"
          value={fmt("{n}", { n: customer.totalOrders })}
          hint={
            customer.totalOrders === 0 ? (
              t.noOrders
            ) : contact?.lastOrderAt ? (
              <time dateTime={contact.lastOrderAt} title={formatDateTime(contact.lastOrderAt)}>
                {fmt(t.lastOrder, { when: formatRelativeTime(contact.lastOrderAt) })}
              </time>
            ) : undefined
          }
        />

        <Stat
          icon={IconDelivered}
          caption={t.statDelivered}
          tone={rateTone}
          loading={contactLoading && !contact}
          value={rate === null ? t.unknown : fmt(t.percent, { n: rate })}
          hint={
            contact && rate !== null ? fmt(t.deliveredOf, { delivered: contact.deliveredCount, closed: contact.closedCount }) : contact ? t.deliveredNone : undefined
          }
        >
          {contact && rate !== null && (
            <div
              role="meter"
              aria-label={t.statDelivered}
              aria-valuemin={0}
              aria-valuemax={100}
              aria-valuenow={rate}
              aria-valuetext={fmt(t.deliveredOf, { delivered: contact.deliveredCount, closed: contact.closedCount })}
              data-slot="customer-meter"
              className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-line"
            >
              <div className={cn("h-full rounded-full", METER_FILL[rateTone])} style={{ width: `${Math.max(0, Math.min(100, rate))}%` }} />
            </div>
          )}
        </Stat>

        <Stat
          icon={IconPackageFailed}
          caption={t.statRejected}
          tone={refused > 0 ? "danger" : "neutral"}
          value={fmt("{n}", { n: refused })}
          hint={fmt(t.reliability, { score: customer.reliabilityScore })}
        />

        <Stat
          icon={IconCash}
          caption={t.statSpent}
          tone="success"
          loading={contactLoading && !contact}
          value={contact ? <bdi dir="ltr">{formatMoney(contact.totalSpent, currency)}</bdi> : t.unknown}
        />
      </dl>

      {customer.isBlacklisted && (
        <div
          role="status"
          data-slot="customer-blocked"
          className="zimos-customer-blocked flex flex-col gap-3 rounded-b-[1.75rem] border-t border-line bg-danger-soft p-4 sm:flex-row sm:items-center sm:justify-between sm:p-5"
        >
          <p className="flex min-w-0 items-start gap-2 text-sm leading-6 font-medium text-ink">
            <IconUserBlocked className="mt-1 size-4 shrink-0 text-danger" weight="fill" aria-hidden />
            <span dir="auto" className="min-w-0 break-words">
              {customer.blacklistReason ? fmt(t.blockedReason, { reason: customer.blacklistReason }) : t.blockedPlain}
            </span>
          </p>
          <Button type="button" variant="outline" className="min-h-11 shrink-0 rounded-full px-5" onClick={onUnblock}>
            {t.unblock}
          </Button>
        </div>
      )}
    </section>
  );
}
