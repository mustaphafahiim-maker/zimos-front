import type { ReactNode } from "react";
import type { Contact } from "@store-builder/api-client";
import { cn } from "@store-builder/ui";
import { fmt, useT } from "@/i18n/LocaleContext";
import { CONTACT_STRINGS } from "../contactStrings";

/** What a row of the contacts list is called: the name, or the number when no name was given. */
export function contactName(contact: Pick<Contact, "fullName" | "phoneRaw" | "phoneNormalized">): string {
  return contact.fullName?.trim() || contact.phoneRaw || contact.phoneNormalized;
}

/** Whether the contact has a name of its own (otherwise the number stands in for it, and is not said twice). */
export function hasOwnName(contact: Pick<Contact, "fullName">): boolean {
  return Boolean(contact.fullName?.trim());
}

/** The number as it was typed, else as it is stored. */
export function contactPhone(contact: Pick<Contact, "phoneRaw" | "phoneNormalized">): string {
  return contact.phoneRaw || contact.phoneNormalized;
}

/** The contact's own page. A contact's id is its customer id (GET /customers/:id). */
export function contactTo(contact: Pick<Contact, "id">): string {
  return `/customers/${contact.id}`;
}

/** The row (table) or card (phone) of a contact, as it is in the page now. */
export function contactRowElement(contactId: string): Element | null {
  return document.querySelector(`[data-contact-row="${contactId}"]`);
}

/** Things in a row that are pressed for themselves: a press on one is not a press on the row. */
const ROW_CONTROLS = "a, button, input, label, select, textarea, [role='button'], [role='menuitem']";

/** Whether a click that reached the row was meant for the row: inside it, not on one of its controls, not the end of a text selection. */
export function isRowPress(target: EventTarget, row: HTMLElement): boolean {
  if (!(target instanceof Element) || !row.contains(target)) return false;
  const control = target.closest(ROW_CONTROLS);
  if (control && control !== row && row.contains(control)) return false;
  return (window.getSelection()?.toString() ?? "") === "";
}

export type ContactChipTone = "lead" | "danger" | "neutral";

// The chip on its own (glass off): the soft token fills. glass/customers.css gives the tinted pane.
const CHIP_TONE: Record<ContactChipTone, string> = {
  lead: "bg-paper-sunken text-ink-soft",
  danger: "bg-danger-soft text-danger",
  neutral: "bg-paper-sunken text-ink-soft",
};

/** A small chip beside a contact's name. The word carries the meaning; the tint only helps. */
export function ContactChip({ tone, title, children }: { tone: ContactChipTone; title?: string; children: ReactNode }) {
  return (
    <span
      data-tone={tone}
      title={title}
      className={cn(
        "zimos-contact-chip inline-flex h-5 shrink-0 items-center rounded-full px-2 text-[11px] leading-none font-semibold whitespace-nowrap",
        CHIP_TONE[tone]
      )}
    >
      {children}
    </span>
  );
}

/**
 * What sets a contact apart from an ordinary customer: «عميل محتمل» (quiet)
 * for one who has not ordered yet — there is no customer history behind it —
 * and «محظور» (danger) for a blocked one. An ordinary customer gets no chip.
 */
export function ContactTypeChips({ contact }: { contact: Pick<Contact, "type" | "isBlacklisted"> }) {
  const c = useT(CONTACT_STRINGS);
  if (contact.type !== "lead" && !contact.isBlacklisted) return null;
  return (
    <>
      {contact.type === "lead" && <ContactChip tone="lead">{c.type_lead}</ContactChip>}
      {contact.isBlacklisted && <ContactChip tone="danger">{c.blocked}</ContactChip>}
    </>
  );
}

/** A contact's tags as small panes: the first `max`, then "+n" for the rest. A dash when there are none. */
export function TagChips({ tags, max = 3 }: { tags: string[]; max?: number }) {
  const c = useT(CONTACT_STRINGS);
  if (tags.length === 0) return <span className="text-ink-soft">—</span>;
  const hidden = tags.slice(max);
  return (
    <div className="flex min-w-0 flex-wrap items-center gap-1">
      {tags.slice(0, max).map((tag) => (
        <span
          key={tag}
          dir="auto"
          className="zimos-contact-tag inline-flex h-6 max-w-32 items-center rounded-full bg-paper px-2 text-xs leading-none text-ink ring-1 ring-line"
        >
          <span className="min-w-0 truncate">{tag}</span>
        </span>
      ))}
      {hidden.length > 0 && (
        <ContactChip tone="neutral" title={hidden.join(" · ")}>
          <span className="tabular-nums">{fmt(c.moreCount, { n: hidden.length })}</span>
        </ContactChip>
      )}
    </div>
  );
}
