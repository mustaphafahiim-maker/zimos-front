import type { Contact } from "@store-builder/api-client";
import { cn } from "@store-builder/ui";
import { ContactActions } from "@/components/ContactActions";
import { ContextMenu, type ContextMenuItem } from "@/components/ContextMenu";
import { useQuickLookRow } from "@/components/QuickLook";
import { fmt, getIntlLocale, useT, type Messages } from "@/i18n/LocaleContext";
import { formatDate, formatMoney, placeName } from "@/lib/format";
import { formatRelative } from "@/lib/orderTimeline";
import { DeliveryRateBar } from "../DeliveryRateBar";
import { ContactTypeChips, TagChips, contactName, contactPhone, contactTo, hasOwnName, isRowPress } from "./contactRow";

const STRINGS = {
  en: {
    caption: "Contacts",
    colContact: "Customer",
    colOrders: "Orders",
    colDelivery: "Received",
    colLastOrder: "Last order",
    colSpent: "Total spent",
    colTags: "Tags",
    colReach: "Call or WhatsApp",
    selectAll: "Select all contacts shown",
    selectOne: "Select {name}",
    phone: "Phone",
    menuLabel: "Actions for {name}",
    none: "—",
  },
  ar: {
    caption: "جهات الاتصال",
    colContact: "العميل",
    colOrders: "الأوردرات",
    colDelivery: "الاستلام",
    colLastOrder: "آخر أوردر",
    colSpent: "إجمالي المدفوع",
    colTags: "الوسوم",
    colReach: "اتصال أو واتساب",
    selectAll: "اختار كل جهات الاتصال اللي ظاهرة",
    selectOne: "اختار {name}",
    phone: "الموبايل",
    menuLabel: "إجراءات {name}",
    none: "—",
  },
} satisfies Messages;

type Strings = (typeof STRINGS)["en"];

export interface ContactsTableProps {
  rows: readonly Contact[];
  currency: string;
  selected: ReadonlySet<string>;
  onToggle: (contactId: string) => void;
  allSelected: boolean;
  onToggleAll: () => void;
  menuFor: (contact: Contact) => ContextMenuItem[];
  /** Quick Look. */
  onPeek: (contact: Contact) => void;
  /** The contact's own page. */
  onOpen: (contact: Contact) => void;
}

/**
 * The contacts as one table on a sheet of glass, from md up. A row says what a
 * cash-on-delivery store asks about a person before it ships to them again:
 * who (the name; under it the phone and the governorate), how many orders, how
 * many parcels they actually received («٨ من ١٠ استلموا», with a small bar — a
 * dash while none has reached an end), how long ago they last ordered, what
 * they have paid in all, their tags — and call / WhatsApp at the row's end.
 *
 * A row opens Quick Look (a click anywhere on it, or Space while it has
 * focus); Enter on it opens the customer's page, Ctrl / ⌘ + click opens it in
 * a new tab. Right-click gives the row's menu. The tick box selects it for the
 * bulk bar; a selected row tints.
 *
 * Material (the row under the pointer, the selected tint, the chips, the rate
 * bar) is in glass/customers.css; without the glass layer it is a solid raised
 * sheet.
 */
export function ContactsTable({ rows, currency, selected, onToggle, allSelected, onToggleAll, menuFor, onPeek, onOpen }: ContactsTableProps) {
  const t = useT(STRINGS);
  // One clock for the whole list, so every row's "3 days ago" is counted from the same moment.
  const now = Date.now();
  const someSelected = rows.some((row) => selected.has(row.id));
  const head = "px-3 py-3 text-start font-medium whitespace-nowrap";

  return (
    <div
      data-slot="customers-table"
      className="zimos-customers-table overflow-x-auto rounded-[var(--radius-card)] bg-paper-raised shadow-[var(--shadow-card)] ring-1 ring-line"
    >
      <table className="zimos-customers-grid w-full min-w-[56rem] text-sm [&>tbody>tr>td]:py-2">
        <caption className="sr-only">{t.caption}</caption>
        <thead>
          <tr className="border-b border-line bg-paper-sunken/60 text-xs text-ink-soft">
            <th scope="col" className="w-11 py-1 ps-2 pe-0">
              <label className="flex size-11 cursor-pointer items-center justify-center">
                <input
                  type="checkbox"
                  className="size-4 cursor-pointer accent-primary"
                  checked={allSelected}
                  ref={(box) => {
                    // Some but not all: the box says so with a dash.
                    if (box) box.indeterminate = someSelected && !allSelected;
                  }}
                  onChange={onToggleAll}
                  aria-label={t.selectAll}
                />
              </label>
            </th>
            <th scope="col" className={head}>
              {t.colContact}
            </th>
            <th scope="col" className={head}>
              {t.colOrders}
            </th>
            <th scope="col" className={head}>
              {t.colDelivery}
            </th>
            <th scope="col" className={head}>
              {t.colLastOrder}
            </th>
            <th scope="col" className={head}>
              {t.colSpent}
            </th>
            <th scope="col" className={head}>
              {t.colTags}
            </th>
            <th scope="col" className="px-3 py-3">
              <span className="sr-only">{t.colReach}</span>
            </th>
          </tr>
        </thead>
        <tbody>
          {rows.map((contact) => (
            <ContactTableRow
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
        </tbody>
      </table>
    </div>
  );
}

function ContactTableRow({
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
  const name = contactName(contact);
  const phone = contactPhone(contact);
  const named = hasOwnName(contact);
  const place = placeName(contact.governorate);
  // Space on the focused row peeks; a key pressed on one of its controls is that control's.
  const peekProps = useQuickLookRow(() => onPeek(contact));

  return (
    <ContextMenu items={menu} label={fmt(t.menuLabel, { name })}>
      <tr
        data-contact-row={contact.id}
        data-selected={selected ? "" : undefined}
        tabIndex={peekProps.tabIndex}
        onKeyDown={(e) => {
          peekProps.onKeyDown(e);
          // Enter, on the row itself, opens the customer's page.
          if (e.key !== "Enter" || e.target !== e.currentTarget || e.defaultPrevented || e.repeat) return;
          e.preventDefault();
          onOpen(contact);
        }}
        onClick={(e) => {
          if (!isRowPress(e.target, e.currentTarget)) return;
          // Ctrl / ⌘ + click is "in a new tab", as on a link.
          if (e.metaKey || e.ctrlKey) {
            window.open(contactTo(contact), "_blank", "noopener");
            return;
          }
          onPeek(contact);
        }}
        className={cn(
          "zimos-customers-row group/row cursor-pointer border-b border-line outline-none last:border-b-0 focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-primary",
          selected && "bg-primary-soft/50"
        )}
      >
        {/* The start edge of a selected row carries the brand colour; the edge is always there, so nothing shifts when it lights. */}
        <td className="w-11 border-s-[3px] border-s-transparent ps-1.5 pe-0 group-data-[selected]/row:border-s-primary">
          <label className="flex size-11 cursor-pointer items-center justify-center">
            <input
              type="checkbox"
              className="size-4 cursor-pointer accent-primary"
              checked={selected}
              onChange={() => onToggle(contact.id)}
              aria-label={fmt(t.selectOne, { name })}
            />
          </label>
        </td>

        <td className="max-w-72 px-3">
          <div className="flex flex-wrap items-center gap-x-1.5 gap-y-1">
            <span data-vt-part="title" className="min-w-0 truncate text-[15px] leading-6 font-medium text-ink">
              {/* A contact with no name is called by its number, which reads left to right. */}
              <bdi dir={named ? undefined : "ltr"}>{name}</bdi>
            </span>
            <ContactTypeChips contact={contact} />
          </div>
          {(named || place) && (
            <div className="mt-0.5 flex min-w-0 items-center gap-1.5 text-xs leading-5 text-ink-soft">
              {named && (
                <span className="shrink-0 tabular-nums">
                  <span className="sr-only">{t.phone}: </span>
                  <bdi dir="ltr">{phone}</bdi>
                </span>
              )}
              {named && place && <span aria-hidden>·</span>}
              {place && (
                <span className="min-w-0 truncate">
                  <bdi>{place}</bdi>
                </span>
              )}
            </div>
          )}
        </td>

        <td className="px-3 whitespace-nowrap">
          <span className={cn("text-[15px] tabular-nums", contact.ordersCount > 0 ? "font-semibold text-ink" : "text-ink-soft")}>
            {fmt("{n}", { n: contact.ordersCount })}
          </span>
        </td>

        <td className="px-3">
          <DeliveryRateBar contact={contact} />
        </td>

        <td className="px-3 text-[13px] whitespace-nowrap text-ink-soft">
          {contact.lastOrderAt ? (
            <time dateTime={contact.lastOrderAt} title={formatDate(contact.lastOrderAt)}>
              {formatRelative(contact.lastOrderAt, now, getIntlLocale())}
            </time>
          ) : (
            t.none
          )}
        </td>

        <td className="px-3 whitespace-nowrap">
          {contact.ordersCount > 0 ? (
            <span className="inline-block text-[15px] font-semibold text-ink tabular-nums">
              <bdi>{formatMoney(contact.totalSpent, currency)}</bdi>
            </span>
          ) : (
            <span className="text-ink-soft">{t.none}</span>
          )}
        </td>

        <td className="max-w-48 px-3">
          <TagChips tags={contact.tags} max={2} />
        </td>

        <td className="w-px px-3">
          {/* One tap to call or message. */}
          <ContactActions phone={phone} name={contact.fullName} variant="icon" className="justify-end" />
        </td>
      </tr>
    </ContextMenu>
  );
}
