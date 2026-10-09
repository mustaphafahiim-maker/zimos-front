import { useState, type FormEvent, type ReactNode } from "react";
import type { Contact, Order } from "@store-builder/api-client";
import { Button, Input, cn } from "@store-builder/ui";
import { ContactActions } from "@/components/ContactActions";
import { IconClose, IconPlus } from "@/components/icons";
import { QuickLook } from "@/components/QuickLook";
import { StatusBadge } from "@/components/StatusBadge";
import { ViewLink } from "@/components/ViewLink";
import { fmt, getIntlLocale, useT, type Messages } from "@/i18n/LocaleContext";
import { apiClient } from "@/lib/apiClient";
import { formatDate, formatMoney, formatPercentValue, placeName } from "@/lib/format";
import { formatRelative } from "@/lib/orderTimeline";
import { useAsync } from "@/lib/useAsync";
import { useWorkspaceId } from "@/lib/useWorkspaceId";
import { dialablePhone } from "@/pages/home/today/OrderQuickLook";
import { STAGE_TONE, useOrderLabels } from "@/pages/orders/orderLabels";
import { CONTACT_STRINGS, parseTagInput } from "../contactStrings";
import { DeliveryRateBar } from "../DeliveryRateBar";
import { ContactTypeChips, contactName, contactPhone, contactTo, hasOwnName } from "./contactRow";

const STRINGS = {
  en: {
    open: "Open the customer",
    reach: "Reach them",
    numbers: "Their orders",
    orders: "Orders",
    delivered: "Received",
    notDelivered: "Came back",
    spent: "Total spent",
    unknown: "—",
    rate: "Delivery rate",
    lastOrder: "Last order",
    lastOrderWhen: "{when} · {date}",
    leadNote: "Hasn't ordered from the store yet, so there are no delivery numbers.",
    noClosed: "No parcel has reached an end yet, so there is no delivery rate.",
    lastOrders: "Latest orders",
    openOrder: "Open order {number}",
    about: "About them",
    type: "Type",
    source: "Came from",
    marketing: "Marketing",
    added: "Added",
    tags: "Tags",
    noTags: "No tags yet.",
    addTag: "Add a tag",
    addTagPlaceholder: "e.g. vip, wholesale",
    add: "Add",
    removeTag: "Remove tag {tag}",
  },
  ar: {
    open: "افتح العميل",
    reach: "للتواصل",
    numbers: "أوردراته",
    orders: "الأوردرات",
    delivered: "استلم",
    notDelivered: "رجع",
    spent: "إجمالي المدفوع",
    unknown: "—",
    rate: "نسبة الاستلام",
    lastOrder: "آخر أوردر",
    lastOrderWhen: "{when} · {date}",
    leadNote: "لسه ما طلبش من المتجر، فمفيش أرقام استلام.",
    noClosed: "لسه مفيش شحنة وصلت لآخرها، فمفيش نسبة استلام.",
    lastOrders: "آخر الأوردرات",
    openOrder: "افتح الأوردر {number}",
    about: "عنه",
    type: "النوع",
    source: "جه منين",
    marketing: "التسويق",
    added: "اتضاف",
    tags: "الوسوم",
    noTags: "مفيش وسوم لسه.",
    addTag: "ضيف وسم",
    addTagPlaceholder: "مثال: vip، جملة",
    add: "ضيف",
    removeTag: "شيل الوسم {tag}",
  },
} satisfies Messages;

/** How many of the contact's latest orders the preview lists. */
const ORDERS_SHOWN = 3;

/** A small quiet label over a block of the preview. */
function BlockLabel({ children }: { children: ReactNode }) {
  return (
    <h3 data-slot="contact-peek-label" className="mb-2 text-xs leading-4 font-medium text-ink-soft">
      {children}
    </h3>
  );
}

function Rule() {
  return <div role="separator" data-slot="contact-peek-rule" className="h-px bg-line" />;
}

/** One figure of the contact: a small pane with a quiet label over a tabular number. */
function Stat({ label, tone, children }: { label: string; tone?: "danger"; children: ReactNode }) {
  return (
    <div data-slot="contact-stat" data-tone={tone} className={cn("min-w-0 rounded-[1rem] px-3 py-2.5 ring-1", tone === "danger" ? "bg-danger-soft ring-danger/20" : "bg-paper ring-line")}>
      <dt data-slot="contact-stat-label" className="truncate text-xs leading-4 text-ink-soft">
        {label}
      </dt>
      <dd data-slot="contact-stat-figure" className={cn("mt-1 truncate text-[17px] leading-6 font-semibold tabular-nums", tone === "danger" ? "text-danger" : "text-ink")}>
        {children}
      </dd>
    </div>
  );
}

/** One line of the "about them" list; drawn only when it has something to say. */
function Fact({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex items-baseline justify-between gap-4 py-1">
      <dt className="shrink-0 text-xs leading-5 text-ink-soft">{label}</dt>
      <dd className="min-w-0 text-end text-[13px] leading-5 wrap-anywhere text-ink">{children}</dd>
    </div>
  );
}

/**
 * What to search the orders by to find this contact's own: the whole number
 * (the API then matches its last ten digits) — or, for a number the role is
 * sent masked, the digits after the mask when there are at least four. Null
 * when neither is there: then nothing is listed rather than guessed.
 */
function orderSearchTerm(contact: Contact): string | null {
  const whole = dialablePhone(contact.phoneNormalized) ?? dialablePhone(contact.phoneRaw);
  const ascii = (value: string) => value.replace(/[٠-٩]/g, (d) => String("٠١٢٣٤٥٦٧٨٩".indexOf(d)));
  if (whole) {
    const digits = ascii(whole).replace(/\D/g, "");
    return digits.length >= 4 ? digits : null;
  }
  const tail = /(\d{4,9})\D*$/.exec(ascii(contactPhone(contact)));
  return tail?.[1] ?? null;
}

/**
 * The contact's latest orders, for the preview. There is no per-customer order
 * list in the API, so this asks the orders list for the contact's number (one
 * request, the newest first) and keeps the orders that are really theirs. It
 * is read only while the preview is open, and only for someone who has
 * ordered; if it cannot be read the block is simply not drawn.
 */
function useLatestOrders(contact: Contact, open: boolean): Order[] {
  const workspaceId = useWorkspaceId();
  const term = open && contact.ordersCount > 0 ? orderSearchTerm(contact) : null;
  const latest = useAsync(async () => {
    if (!term) return { forId: contact.id, orders: [] as Order[] };
    const { orders } = await apiClient.listOrders(workspaceId, { q: term, limit: 20 });
    return { forId: contact.id, orders: orders.filter((order) => order.customerId === contact.id).slice(0, ORDERS_SHOWN) };
  }, [workspaceId, contact.id, term]);
  // While the next contact's orders are on their way, the last one's are not shown as theirs.
  return latest.data && latest.data.forId === contact.id && !latest.error ? latest.data.orders : [];
}

export interface ContactQuickLookProps {
  /** The contact being looked at; it stays here while the panel closes. */
  contact: Contact | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  currency: string;
  /** Add tags to the contact. Resolves true once they are saved (a failure has already been said). */
  onAddTags: (contact: Contact, tags: string[]) => Promise<boolean>;
  /** Take one tag off (the list offers Undo). */
  onRemoveTag: (contact: Contact, tag: string) => Promise<void>;
}

/**
 * Quick Look of a contact: who they are and how to reach them, what a
 * cash-on-delivery store asks before it ships to them again — orders, parcels
 * received and parcels that came back, what they paid, how long ago they last
 * ordered — their latest orders, where they came from, and their tags, which
 * can be changed here. «افتح العميل» goes to the customer's page; call and
 * WhatsApp sit in the footer, one tap away.
 */
export function ContactQuickLook({ contact, open, onOpenChange, currency, onAddTags, onRemoveTag }: ContactQuickLookProps) {
  const t = useT(STRINGS);
  if (!contact) return null;
  return (
    <QuickLook
      open={open}
      onOpenChange={onOpenChange}
      title={<bdi dir={hasOwnName(contact) ? undefined : "ltr"}>{contactName(contact)}</bdi>}
      status={contact.type === "lead" || contact.isBlacklisted ? <span className="flex flex-wrap items-center gap-1.5"><ContactTypeChips contact={contact} /></span> : undefined}
      to={contactTo(contact)}
      openLabel={t.open}
      actions={<ContactActions phone={contactPhone(contact)} name={contact.fullName} size="md" />}
    >
      <ContactPeekBody contact={contact} open={open} currency={currency} onAddTags={onAddTags} onRemoveTag={onRemoveTag} />
    </QuickLook>
  );
}

function ContactPeekBody({
  contact,
  open,
  currency,
  onAddTags,
  onRemoveTag,
}: {
  contact: Contact;
  open: boolean;
  currency: string;
  onAddTags: (contact: Contact, tags: string[]) => Promise<boolean>;
  onRemoveTag: (contact: Contact, tag: string) => Promise<void>;
}) {
  const t = useT(STRINGS);
  const c = useT(CONTACT_STRINGS);
  const labels = useOrderLabels();
  const orders = useLatestOrders(contact, open);
  const now = Date.now();
  const [draft, setDraft] = useState("");
  const [saving, setSaving] = useState(false);

  const phone = contactPhone(contact);
  const place = placeName(contact.governorate);
  const ordered = contact.ordersCount > 0;
  const closed = contact.closedCount > 0;
  const cameBack = Math.max(0, contact.closedCount - contact.deliveredCount);
  const sourceKey = `source_${contact.source}` as keyof typeof c;

  async function addTags(e: FormEvent) {
    e.preventDefault();
    const next = parseTagInput(draft);
    if (next.length === 0 || saving) return;
    setSaving(true);
    try {
      if (await onAddTags(contact, next)) setDraft("");
    } finally {
      setSaving(false);
    }
  }

  async function removeTag(tag: string) {
    if (saving) return;
    setSaving(true);
    try {
      await onRemoveTag(contact, tag);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div data-slot="contact-peek" className="flex flex-col gap-4">
      {/* ---- who, and how to reach them ---- */}
      <section>
        <BlockLabel>{t.reach}</BlockLabel>
        <p className="text-[17px] leading-7 font-semibold text-ink tabular-nums">
          <bdi dir="ltr">{phone}</bdi>
        </p>
        {(contact.email || place) && (
          <p data-slot="contact-peek-soft" className="mt-0.5 flex flex-wrap items-center gap-x-1.5 text-[13px] leading-5 text-ink-soft">
            {contact.email && (
              <a
                href={`mailto:${contact.email}`}
                className="rounded-sm underline underline-offset-4 hover:text-ink focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
              >
                <bdi dir="ltr">{contact.email}</bdi>
              </a>
            )}
            {contact.email && place && <span aria-hidden>·</span>}
            {place && <bdi>{place}</bdi>}
          </p>
        )}
      </section>

      <Rule />

      {/* ---- the numbers a cash-on-delivery store ships by ---- */}
      <section>
        <BlockLabel>{t.numbers}</BlockLabel>
        {ordered ? (
          <>
            <dl className="grid grid-cols-2 gap-2">
              <Stat label={t.orders}>{fmt("{n}", { n: contact.ordersCount })}</Stat>
              <Stat label={t.spent}>
                <bdi>{formatMoney(contact.totalSpent, currency)}</bdi>
              </Stat>
              {/* Unknown is a dash, never a zero: nothing has reached an end yet. */}
              <Stat label={t.delivered}>{closed ? fmt(c.deliveryRateCount, { delivered: contact.deliveredCount, closed: contact.closedCount }) : t.unknown}</Stat>
              <Stat label={t.notDelivered} tone={cameBack > 0 ? "danger" : undefined}>
                {closed ? fmt("{n}", { n: cameBack }) : t.unknown}
              </Stat>
            </dl>
            {closed && contact.deliveryRate !== null ? (
              <div className="mt-3 flex items-center justify-between gap-3">
                <span data-slot="contact-peek-soft" className="text-xs leading-5 text-ink-soft">
                  {t.rate}
                </span>
                <span className="flex min-w-0 items-center gap-2">
                  <DeliveryRateBar contact={contact} />
                  <span className="text-[13px] leading-5 font-semibold text-ink tabular-nums">
                    <bdi>{formatPercentValue(contact.deliveryRate / 100, 0)}</bdi>
                  </span>
                </span>
              </div>
            ) : (
              <p data-slot="contact-peek-soft" className="mt-3 text-xs leading-5 text-ink-soft">
                {t.noClosed}
              </p>
            )}
            {contact.lastOrderAt && (
              <div className="mt-1.5 flex items-baseline justify-between gap-3">
                <span data-slot="contact-peek-soft" className="text-xs leading-5 text-ink-soft">
                  {t.lastOrder}
                </span>
                <time dateTime={contact.lastOrderAt} className="min-w-0 text-end text-[13px] leading-5 text-ink">
                  {fmt(t.lastOrderWhen, {
                    when: formatRelative(contact.lastOrderAt, now, getIntlLocale()),
                    date: formatDate(contact.lastOrderAt),
                  })}
                </time>
              </div>
            )}
          </>
        ) : (
          <p className="text-sm leading-6 text-ink">{t.leadNote}</p>
        )}
      </section>

      {/* ---- their latest orders: only when they could be read ---- */}
      {orders.length > 0 && (
        <>
          <Rule />
          <section>
            <BlockLabel>{t.lastOrders}</BlockLabel>
            <ul className="-mx-2 flex flex-col">
              {orders.map((order) => (
                <li key={order.id}>
                  <ViewLink
                    to={`/orders/${order.id}`}
                    data-slot="contact-peek-order"
                    aria-label={fmt(t.openOrder, { number: order.orderNumber })}
                    className="flex min-h-11 items-center gap-2 rounded-[0.75rem] px-2 py-1.5 transition-[background-color] duration-[var(--dur-fade)] ease-[var(--ease-out)] hover:bg-paper-sunken focus-visible:outline-2 focus-visible:outline-primary motion-reduce:transition-none"
                  >
                    <span className="flex min-w-0 flex-1 flex-col">
                      <span className="flex min-w-0 items-center gap-2">
                        <span className="shrink-0 text-sm leading-5 font-medium text-ink tabular-nums">
                          <bdi dir="ltr">{order.orderNumber}</bdi>
                        </span>
                        {order.stage && <StatusBadge value={order.stage} tone={STAGE_TONE[order.stage]} text={labels.stage(order.stage)} />}
                      </span>
                      <time dateTime={order.createdAt} data-slot="contact-peek-soft" className="text-xs leading-5 text-ink-soft">
                        {formatRelative(order.createdAt, now, getIntlLocale())}
                      </time>
                    </span>
                    <span className="shrink-0 text-sm leading-5 font-semibold text-ink tabular-nums">
                      <bdi>{formatMoney(order.totalAmount, order.currency)}</bdi>
                    </span>
                  </ViewLink>
                </li>
              ))}
            </ul>
          </section>
        </>
      )}

      <Rule />

      {/* ---- where they came from ---- */}
      <section>
        <BlockLabel>{t.about}</BlockLabel>
        <dl>
          <Fact label={t.type}>{c[`type_${contact.type}`]}</Fact>
          {contact.source && <Fact label={t.source}>{c[sourceKey] ?? contact.source}</Fact>}
          <Fact label={t.marketing}>{contact.marketingConsent ? c.consentYes : c.consentNo}</Fact>
          <Fact label={t.added}>{formatDate(contact.createdAt)}</Fact>
        </dl>
      </section>

      <Rule />

      {/* ---- tags: taken off with the cross, added from the field ---- */}
      <section>
        <BlockLabel>{t.tags}</BlockLabel>
        {contact.tags.length === 0 ? (
          <p data-slot="contact-peek-soft" className="text-sm leading-6 text-ink-soft">
            {t.noTags}
          </p>
        ) : (
          <ul className="flex flex-wrap gap-2">
            {contact.tags.map((tag) => (
              <li
                key={tag}
                className="zimos-contact-tag inline-flex h-9 max-w-full items-center rounded-full bg-paper ps-3 pe-0.5 text-sm text-ink ring-1 ring-line pointer-coarse:h-11 pointer-coarse:pe-0"
              >
                <bdi className="min-w-0 truncate">{tag}</bdi>
                <button
                  type="button"
                  disabled={saving}
                  aria-label={fmt(t.removeTag, { tag })}
                  title={fmt(t.removeTag, { tag })}
                  onClick={() => void removeTag(tag)}
                  // 32px to the eye with a mouse, the full 44px under a finger.
                  className="zimos-contact-tag-remove flex size-8 shrink-0 cursor-pointer items-center justify-center rounded-full text-ink-soft transition-[scale,background-color,color] duration-[var(--dur-fade)] ease-[var(--ease-out)] hover:bg-paper-sunken hover:text-ink focus-visible:outline-2 focus-visible:outline-primary active:scale-[0.92] disabled:cursor-not-allowed disabled:opacity-50 motion-reduce:transition-none motion-reduce:active:scale-100 pointer-coarse:size-11"
                >
                  <IconClose className="size-3.5" weight="bold" aria-hidden />
                </button>
              </li>
            ))}
          </ul>
        )}
        <form onSubmit={addTags} className="mt-3 flex items-center gap-2">
          <Input
            dir="auto"
            aria-label={t.addTag}
            placeholder={t.addTagPlaceholder}
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            maxLength={200}
            className="h-11 min-w-0 flex-1"
          />
          <Button type="submit" variant="outline" className="h-11 shrink-0 rounded-full px-4" disabled={saving || !draft.trim()}>
            <IconPlus className="size-4" weight="bold" aria-hidden />
            {t.add}
          </Button>
        </form>
      </section>
    </div>
  );
}
