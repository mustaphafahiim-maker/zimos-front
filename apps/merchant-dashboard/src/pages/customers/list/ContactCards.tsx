import type { Contact } from "@store-builder/api-client";
import { ContactActions } from "@/components/ContactActions";
import { ContextMenu, type ContextMenuItem } from "@/components/ContextMenu";
import { ListRowCard } from "@/components/list";
import { fmt, getIntlLocale, useT, type Messages } from "@/i18n/LocaleContext";
import { formatDate, formatMoney } from "@/lib/format";
import { formatRelative } from "@/lib/orderTimeline";
import { CONTACT_STRINGS } from "../contactStrings";
import { DeliveryRateBar } from "../DeliveryRateBar";
import { ContactChip, TagChips, contactName, contactPhone, hasOwnName } from "./contactRow";

const STRINGS = {
  en: {
    listLabel: "Contacts",
    selectOne: "Select {name}",
    menuLabel: "Actions for {name}",
    lastOrder: "Last order:",
    noOrders: "No orders yet",
  },
  ar: {
    listLabel: "جهات الاتصال",
    selectOne: "اختار {name}",
    menuLabel: "إجراءات {name}",
    lastOrder: "آخر أوردر:",
    noOrders: "لسه ما طلبش",
  },
} satisfies Messages;

type Strings = (typeof STRINGS)["en"];

export interface ContactCardsProps {
  rows: readonly Contact[];
  currency: string;
  selected: ReadonlySet<string>;
  onToggle: (contactId: string) => void;
  menuFor: (contact: Contact) => ContextMenuItem[];
  /** Quick Look. */
  onPeek: (contact: Contact) => void;
  /** The contact's own page. */
  onOpen: (contact: Contact) => void;
}

/**
 * The contacts on a phone: one card each (ListRowCard). Who and what they have
 * paid on the first line; how many of their parcels they received («٨ من ١٠»,
 * tinted by the rate), how long ago they last ordered, and call / WhatsApp on
 * the second. A contact who has not ordered yet says «عميل محتمل» where the
 * rate would be. A blocked one and the tags show under the two lines, only
 * when there is something to show.
 *
 * A tap opens Quick Look; a long press, the contact's menu; Enter on a focused
 * card, the customer's page. The tick box selects it for the bulk bar.
 */
export function ContactCards({ rows, currency, selected, onToggle, menuFor, onPeek, onOpen }: ContactCardsProps) {
  const t = useT(STRINGS);
  const now = Date.now();
  return (
    <ul aria-label={t.listLabel} className="flex flex-col gap-2.5">
      {rows.map((contact) => (
        <ContactCard
          key={contact.id}
          contact={contact}
          currency={currency}
          selected={selected.has(contact.id)}
          onToggle={onToggle}
          menu={menuFor(contact)}
          onPeek={onPeek}
          onOpen={onOpen}
          now={now}
          t={t}
        />
      ))}
    </ul>
  );
}

function ContactCard({
  contact,
  currency,
  selected,
  onToggle,
  menu,
  onPeek,
  onOpen,
  now,
  t,
}: {
  contact: Contact;
  currency: string;
  selected: boolean;
  onToggle: (contactId: string) => void;
  menu: ContextMenuItem[];
  onPeek: (contact: Contact) => void;
  onOpen: (contact: Contact) => void;
  now: number;
  t: Strings;
}) {
  const c = useT(CONTACT_STRINGS);
  const name = contactName(contact);
  const lead = contact.type === "lead";

  return (
    <ContextMenu items={menu} label={fmt(t.menuLabel, { name })}>
      <li data-contact-row={contact.id}>
        <ListRowCard
          title={
            <span data-vt-part="title">
              <bdi dir={hasOwnName(contact) ? undefined : "ltr"}>{name}</bdi>
            </span>
          }
          amount={contact.ordersCount > 0 ? <bdi>{formatMoney(contact.totalSpent, currency)}</bdi> : undefined}
          status={
            lead ? (
              <ContactChip tone="lead">{c.type_lead}</ContactChip>
            ) : contact.deliveryRate !== null ? (
              <DeliveryRateBar contact={contact} variant="chip" />
            ) : undefined
          }
          meta={
            contact.lastOrderAt ? (
              <time dateTime={contact.lastOrderAt} title={formatDate(contact.lastOrderAt)}>
                <span className="sr-only">{t.lastOrder} </span>
                {formatRelative(contact.lastOrderAt, now, getIntlLocale())}
              </time>
            ) : contact.ordersCount === 0 && !lead ? (
              t.noOrders
            ) : undefined
          }
          action={<ContactActions phone={contactPhone(contact)} name={contact.fullName} variant="icon" />}
          footer={
            contact.isBlacklisted || contact.tags.length > 0 ? (
              <>
                {contact.isBlacklisted && <ContactChip tone="danger">{c.blocked}</ContactChip>}
                {contact.tags.length > 0 && <TagChips tags={contact.tags} max={2} />}
              </>
            ) : undefined
          }
          selected={selected}
          onSelectedChange={() => onToggle(contact.id)}
          selectLabel={fmt(t.selectOne, { name })}
          onOpen={() => onPeek(contact)}
          aria-haspopup="dialog"
          onKeyDown={(e) => {
            // Space peeks (the card's own key); Enter, on the card itself, opens the customer's page.
            if (e.key !== "Enter" || e.target !== e.currentTarget || e.repeat || e.altKey || e.ctrlKey || e.metaKey) return;
            e.preventDefault();
            onOpen(contact);
          }}
        />
      </li>
    </ContextMenu>
  );
}
