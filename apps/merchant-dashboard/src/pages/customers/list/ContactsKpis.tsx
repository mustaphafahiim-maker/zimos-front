import type { ReactNode } from "react";
import { IconCustomers, IconMarketing, IconUser, IconUserAdd } from "@/components/icons";
import { KpiCard } from "@/components/KpiCard";
import { fmt, useT, type Messages } from "@/i18n/LocaleContext";
import type { ContactsData } from "./useContactsData";

const STRINGS = {
  en: {
    label: "Your contacts in numbers",
    all: "Contacts",
    allHint: "Everyone the store knows",
    customers: "Customers",
    customersHint: "Ordered at least once",
    leads: "Leads",
    leadsHint: "Haven't ordered yet",
    consent: "Accept marketing",
    consentHint: "Agreed to get your messages",
    unknown: "—",
  },
  ar: {
    label: "جهات الاتصال بالأرقام",
    all: "جهات الاتصال",
    allHint: "كل اللي المتجر يعرفهم",
    customers: "عملاء",
    customersHint: "طلبوا مرة على الأقل",
    leads: "عملاء محتملين",
    leadsHint: "لسه ما طلبوش",
    consent: "موافقين على التسويق",
    consentHint: "وافقوا يستقبلوا رسايلك",
    unknown: "—",
  },
} satisfies Messages;

/** One card of the row: a fixed share of the phone's width, so the next one peeks in; an equal column from sm. */
function Slot({ children }: { children: ReactNode }) {
  return <div className="w-[46%] min-w-40 shrink-0 snap-start sm:w-auto sm:min-w-0 sm:flex-1">{children}</div>;
}

/**
 * The four totals of the contacts list under its filter (they come with the
 * first page of GET /contacts): everyone, customers, leads, and who agreed to
 * marketing. ONE row: four equal cards from sm, a row that scrolls sideways
 * and snaps on a phone — about 120px instead of two rows of cards. While the
 * totals load the cards hold their own shape, so nothing moves when they
 * arrive; a total the answer does not carry is a dash, never a zero.
 */
export function ContactsKpis({ totals, loading }: { totals: ContactsData["totals"]; loading: boolean }) {
  const t = useT(STRINGS);
  const busy = loading && !totals;
  const figure = (n: number | undefined) => (n === undefined ? t.unknown : fmt("{n}", { n }));

  return (
    <section
      aria-label={t.label}
      data-slot="contacts-kpis"
      // The padding is room for the cards' shadow and focus ring, which the scroll box would cut; the margins take it back.
      className="-my-3 flex snap-x snap-mandatory gap-3 overflow-x-auto overscroll-x-contain py-3 [scrollbar-width:none] max-sm:-mx-4 max-sm:scroll-px-4 max-sm:px-4 sm:overflow-visible [&::-webkit-scrollbar]:hidden"
    >
      <Slot>
        <KpiCard label={t.all} value={figure(totals?.total)} hint={t.allHint} loading={busy} icon={<IconCustomers aria-hidden />} />
      </Slot>
      <Slot>
        <KpiCard label={t.customers} value={figure(totals?.customers)} hint={t.customersHint} loading={busy} icon={<IconUser aria-hidden />} />
      </Slot>
      <Slot>
        <KpiCard label={t.leads} value={figure(totals?.leads)} hint={t.leadsHint} loading={busy} icon={<IconUserAdd aria-hidden />} />
      </Slot>
      <Slot>
        <KpiCard label={t.consent} value={figure(totals?.consenting)} hint={t.consentHint} loading={busy} icon={<IconMarketing aria-hidden />} />
      </Slot>
    </section>
  );
}
