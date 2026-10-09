import { useState } from "react";
import { useSearchParams } from "react-router-dom";
import { Button } from "@store-builder/ui";
import { IconUserAdd } from "@/components/icons";
import { ChipRow, type ChipItem } from "@/components/list";
import { PageHeader } from "@/components/PageHeader";
import { useT, type Messages } from "@/i18n/LocaleContext";
import { ContactsAllTab } from "./ContactsAllTab";
import { SegmentsTab } from "./SegmentsTab";
// «متابعاتي», «تقسيم العملاء» and «طلبات الخصوصية» (handoffs 209, 237, 235), and the list of one RFM group.
import { ContactsCrmView, parseCrmTab, useCrmContactTabs, type CrmTab } from "./crm/contactsCrmTabs";
import { useRfmGroupParam } from "./crm/RfmGroupFilter";
import { AddContactSheet } from "./list/AddContactSheet";
import { ContactsHeaderTools } from "./list/ContactsHeaderTools";
import { useContactsQuery } from "./list/useContactsQuery";
// «حسابات الآجل» (handoff 229): who pays later, what they owe and what is late.
import { ON_ACCOUNT_TAB, OnAccountBalancesTab, isOnAccountTab, useOnAccountContactTab } from "@/pages/b2b/OnAccountBalancesTab";
// «عناوين موقوفة» (handoff 386): addresses no email goes to after a bounce or a spam complaint.
import { EmailSuppressionsTab, SUPPRESSED_TAB, isSuppressedTab, useSuppressedContactTab } from "./suppressions/EmailSuppressionsTab";

const STRINGS = {
  en: {
    title: "Contacts",
    tabs: "Contacts view",
    all: "All",
    segments: "Segments",
    add: "Add contact",
  },
  ar: {
    title: "جهات الاتصال",
    tabs: "طريقة عرض جهات الاتصال",
    all: "الكل",
    segments: "الشرائح",
    add: "إضافة جهة اتصال",
  },
} satisfies Messages;

type Tab = "all" | "segments" | CrmTab | typeof ON_ACCOUNT_TAB | typeof SUPPRESSED_TAB;

/**
 * Contacts (SPEC §18.4) — «جهات الاتصال»: everyone the store knows, leads and
 * customers.
 *
 * The header carries the page's one creation action («إضافة جهة اتصال»: in the
 * header from md up, in the bar above the dock on a phone; the form is a sheet
 * over the list) and an «أدوات» menu with what is reached for now and then —
 * import, the form submissions inbox, the CSV export. Under it, the tabs as
 * ONE row of chips with what waits behind them (overdue follow-ups, privacy
 * requests not decided yet), then the chosen tab.
 *
 * The tab lives in the URL (`?tab=`), with the saved segment (`?segment=`),
 * the RFM group (`?group=`) and the list's own filters (`?q=`, `?type=`,
 * `?tag=` — list/useContactsQuery.ts), so a filtered list can be linked to.
 * Changing tab starts that tab clean, as it always did.
 */
export function ContactsPage() {
  const t = useT(STRINGS);
  const [searchParams, setSearchParams] = useSearchParams();
  const rawTab = searchParams.get("tab");
  const tab: Tab = rawTab === "segments" ? "segments" : isOnAccountTab(rawTab) || isSuppressedTab(rawTab) ? rawTab : (parseCrmTab(rawTab) ?? "all");
  const [group] = useRfmGroupParam();
  const crm = useCrmContactTabs();
  const onAccountTab = useOnAccountContactTab();
  const suppressedTab = useSuppressedContactTab();
  const query = useContactsQuery();

  const [adding, setAdding] = useState(false);
  // Bumped when a contact was added: the list under «الكل» is read again.
  const [version, setVersion] = useState(0);

  const go = (next: { tab?: Tab; segment?: string }) => {
    const params = new URLSearchParams();
    if (next.tab && next.tab !== "all") params.set("tab", next.tab);
    if (next.segment) params.set("segment", next.segment);
    setSearchParams(params, { replace: true });
  };

  // «الكل» with no RFM group chosen is the contacts list itself: its main action is adding a contact,
  // and its filter is what the export writes.
  const onList = tab === "all" && !group;
  const items: ChipItem<Tab>[] = [{ value: "all", label: t.all }, { value: "segments", label: t.segments }, ...crm.tabs, onAccountTab, suppressedTab];

  return (
    <div className="max-w-6xl">
      <PageHeader
        title={t.title}
        actions={<ContactsHeaderTools exportFilter={onList ? query.filter : null} onAdd={onList ? undefined : () => setAdding(true)} />}
        primaryAction={
          onList ? (
            <Button className="min-h-11 rounded-full px-5" onClick={() => setAdding(true)}>
              <IconUserAdd className="size-4" weight="bold" aria-hidden />
              {t.add}
            </Button>
          ) : undefined
        }
      />

      <div className="flex flex-col gap-3">
        {/* Every tab stays in the row, with or without something waiting: a tab is a place, not a count. */}
        <ChipRow items={items} value={tab} onChange={(value) => go({ tab: value })} label={t.tabs} collapseEmpty={false} countsLoading={crm.countsLoading} />

        <ContactsCrmView tab={tab} onChanged={crm.refresh}>
          {tab === SUPPRESSED_TAB ? (
            <EmailSuppressionsTab />
          ) : tab === ON_ACCOUNT_TAB ? (
            <OnAccountBalancesTab onOpenCustomers={() => go({ tab: "all" })} />
          ) : tab === "all" ? (
            <ContactsAllTab query={query} version={version} onAdd={() => setAdding(true)} />
          ) : (
            <SegmentsTab onView={(id) => go({ segment: id })} />
          )}
        </ContactsCrmView>
      </div>

      <AddContactSheet
        open={adding}
        onClose={() => setAdding(false)}
        onAdded={() => {
          setAdding(false);
          // What is on screen stays while the list is read again behind it.
          setVersion((current) => current + 1);
        }}
      />
    </div>
  );
}
