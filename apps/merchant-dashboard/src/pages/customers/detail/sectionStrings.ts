import type { Customer, CustomerNotesAndFollowups } from "@store-builder/api-client";
import { fmt, getIntlLocale, type Messages } from "@/i18n/LocaleContext";
import { formatDate, placeName } from "@/lib/format";
import { pluralOf } from "@/lib/plural";

/**
 * The names of the customer page's folding sections and the one line each
 * says while folded. Arabic is the merchant's Egyptian.
 */
export const SECTION_STRINGS = {
  en: {
    sections: "Everything about this customer",
    // notes and follow-ups
    notesTitle: "Notes & follow-ups",
    notesNone: "Nothing written yet",
    notes_one: "1 note",
    notes_other: "{n} notes",
    followupOverdue: "a follow-up is overdue",
    followupToday: "a follow-up today",
    followupOn: "a follow-up on {day}",
    followupLater: "a follow-up on {date}",
    openFollowups_one: "1 open follow-up",
    openFollowups_other: "{n} open follow-ups",
    // addresses
    addressesTitle: "Addresses",
    addressesNone: "No addresses on file",
    addresses_one: "1 address",
    addresses_other: "{n} addresses",
    // contact details
    contactTitle: "Contact details",
    contactHint: "Name, email, a second number",
    // timeline
    timelineTitle: "Timeline",
    timelineHint: "Orders, notes, reviews, points and credit — newest first",
    // tags and messages
    tagsTitle: "Tags & messages",
    tagsNone: "No tags yet",
    forms_one: "1 form message",
    forms_other: "{n} form messages",
    // duplicates
    duplicates_one: "1 customer may be the same person",
    duplicates_other: "{n} customers may be the same person",
    // the rest
    priceListsTitle: "Price lists",
    privacyHint: "Export their data, or erase it",
    listSep: " · ",
  },
  ar: {
    sections: "كل حاجة عن العميل ده",
    notesTitle: "ملاحظات ومتابعات",
    notesNone: "لسه مفيش حاجة مكتوبة",
    notes_one: "ملاحظة واحدة",
    notes_two: "ملاحظتين",
    notes_few: "{n} ملاحظات",
    notes_other: "{n} ملاحظة",
    followupOverdue: "متابعة متأخرة",
    followupToday: "متابعة النهارده",
    followupOn: "متابعة يوم {day}",
    followupLater: "متابعة يوم {date}",
    openFollowups_one: "متابعة واحدة مفتوحة",
    openFollowups_two: "متابعتين مفتوحين",
    openFollowups_few: "{n} متابعات مفتوحة",
    openFollowups_other: "{n} متابعة مفتوحة",
    addressesTitle: "العناوين",
    addressesNone: "مفيش عناوين متسجّلة",
    addresses_one: "عنوان واحد",
    addresses_two: "عنوانين",
    addresses_few: "{n} عناوين",
    addresses_other: "{n} عنوان",
    contactTitle: "بيانات التواصل",
    contactHint: "الاسم، الإيميل، ورقم تاني",
    timelineTitle: "كل اللي حصل",
    timelineHint: "الأوردرات، الملاحظات، التقييمات، النقط والرصيد — الأحدث الأول",
    tagsTitle: "الوسوم والرسائل",
    tagsNone: "مفيش وسوم لسه",
    forms_one: "رسالة نموذج واحدة",
    forms_two: "رسالتين نماذج",
    forms_few: "{n} رسايل نماذج",
    forms_other: "{n} رسالة نموذج",
    duplicates_one: "عميل واحد ممكن يكون نفس الشخص",
    duplicates_two: "عميلين ممكن يكونوا نفس الشخص",
    duplicates_few: "{n} عملاء ممكن يكونوا نفس الشخص",
    duplicates_other: "{n} عميل ممكن يكونوا نفس الشخص",
    priceListsTitle: "قوايم الأسعار",
    privacyHint: "نزّل بياناته أو امسحها",
    listSep: " · ",
  },
} satisfies Messages;

export type SectionStrings = Record<keyof (typeof SECTION_STRINGS)["en"], string>;

/** How the notes section's folded line and its count are told apart from the rest of the row. */
export interface NotesLine {
  /** «٣ ملاحظات · متابعة يوم الخميس», or that nothing is written yet. */
  summary: string;
  /** Follow-ups still open; the section's row shows the figure. */
  open: number;
  /** One of the open ones is past its time. */
  overdue: boolean;
}

function sameDay(a: Date, b: Date): boolean {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
}

/**
 * What the notes and follow-ups say in one line, from the answer the page
 * already has: how many notes, and the next follow-up still open — overdue,
 * today, by the name of its day within a week, by its date after that.
 */
export function notesLineOf(data: CustomerNotesAndFollowups | null, t: SectionStrings): NotesLine {
  if (!data) return { summary: "", open: 0, overdue: false };
  const open = data.followups.filter((followup) => !followup.doneAt);
  const overdue = open.some((followup) => followup.overdue);
  const parts: string[] = [];
  if (data.notes.length > 0) parts.push(pluralOf(t, "notes", data.notes.length));
  if (open.length > 0) {
    const next = [...open].sort((a, b) => a.dueAt.localeCompare(b.dueAt))[0];
    const due = new Date(next.dueAt);
    const now = new Date();
    const days = (due.getTime() - now.getTime()) / 86_400_000;
    if (overdue || Number.isNaN(due.getTime())) parts.push(t.followupOverdue);
    else if (sameDay(due, now)) parts.push(t.followupToday);
    else if (days < 7) parts.push(fmt(t.followupOn, { day: due.toLocaleDateString(getIntlLocale(), { weekday: "long" }) }));
    else parts.push(fmt(t.followupLater, { date: formatDate(next.dueAt) }));
  }
  return { summary: parts.length > 0 ? parts.join(t.listSep) : t.notesNone, open: open.length, overdue };
}

/** «٢ عناوين · القاهرة»: how many addresses, and where the default one (or the first) is. */
export function addressesLineOf(customer: Customer, t: SectionStrings): string {
  const addresses = customer.addresses ?? [];
  if (addresses.length === 0) return t.addressesNone;
  const main = addresses.find((address) => address.isDefault) ?? addresses[0];
  const place = placeName(main.province) || placeName(main.city);
  return [pluralOf(t, "addresses", addresses.length), place].filter(Boolean).join(t.listSep);
}

/** Left-to-right isolate and its end: an email or a number keeps its own direction inside an Arabic line. */
const LRI = String.fromCharCode(0x2066);
const PDI = String.fromCharCode(0x2069);

/** The email and the second number when there are any; otherwise what the form holds. */
export function contactLineOf(customer: Customer, t: SectionStrings): string {
  const parts = [customer.email, customer.alternatePhone].filter((part): part is string => Boolean(part?.trim()));
  // Both read left to right: each is isolated, so an Arabic line around them keeps its order.
  return parts.length > 0 ? parts.map((part) => LRI + part + PDI).join(t.listSep) : t.contactHint;
}
