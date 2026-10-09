import { useEffect, useMemo, useState, type ReactNode } from "react";
import type { Contact } from "@store-builder/api-client";
import { Button } from "@store-builder/ui";
import { DataState } from "@/components/DataState";
import { EmptyState } from "@/components/EmptyState";
import { IconPeople, IconSearch, IconUpload, IconUserAdd } from "@/components/icons";
import { ListSkeleton, ListToolbar } from "@/components/list";
import { LoadMore } from "@/components/LoadMore";
import { ViewLink } from "@/components/ViewLink";
import { useWorkspace } from "@/context/WorkspaceContext";
import { fmt, useT, type Messages } from "@/i18n/LocaleContext";
import { markViewSource, useViewNavigate } from "@/lib/viewTransition";
import { ActiveFilters } from "@/pages/orders/list/ActiveFilters";
import { useIsDesktop } from "@/pages/orders/list/useIsDesktop";
import { BulkTagSheet, ContactBulkBar, type BulkTagMode } from "./ContactBulkTags";
import { ContactCards } from "./list/ContactCards";
import { ContactQuickLook } from "./list/ContactQuickLook";
import { contactRowElement, contactTo } from "./list/contactRow";
import { ContactsFilterSheet, useContactFilterChips } from "./list/ContactsFilterSheet";
import { ContactsKpis } from "./list/ContactsKpis";
import { ContactsTable } from "./list/ContactsTable";
import { useContactMenu } from "./list/useContactMenu";
import { useContactsData } from "./list/useContactsData";
import type { ContactsQuery } from "./list/useContactsQuery";

// FormSubmissionsPage (and anything older) takes the tag chips from here.
export { TagChips } from "./list/contactRow";

const STRINGS = {
  en: {
    add: "Add contact",
    searchLabel: "Search contacts",
    searchPlaceholder: "Name, phone or email",
    emptyTitle: "No contacts yet",
    emptyDescription: "Everyone who orders or fills in a form on your store shows up here — with how many of their parcels they actually received. You can also add a contact by hand.",
    importSheet: "Import from a sheet",
    emptyFilteredTitle: "No contact matches this search and these filters",
    emptyFilteredBody: "Try another word, or take off one of the filters in effect.",
    clearFilters: "Clear search and filters",
    selectShown: "Select all {n} shown",
  },
  ar: {
    add: "إضافة جهة اتصال",
    searchLabel: "دوّر في جهات الاتصال",
    searchPlaceholder: "الاسم أو الموبايل أو الإيميل",
    emptyTitle: "لسه مفيش جهات اتصال",
    emptyDescription: "كل اللي يطلب أو يملا نموذج في متجرك بيظهر هنا — ومعاه استلم كام شحنة من اللي اتبعتتله. وتقدر تضيف جهة اتصال بإيدك.",
    importSheet: "استورد من شيت",
    emptyFilteredTitle: "مفيش جهة اتصال بالبحث والفلاتر دي",
    emptyFilteredBody: "جرّب كلمة تانية، أو شيل فلتر من اللي شغّالين.",
    clearFilters: "امسح البحث والفلاتر",
    selectShown: "اختار كل الـ {n} اللي ظاهرين",
  },
} satisfies Messages;

/**
 * Contacts → «الكل»: everyone the store knows, as the list pattern.
 *
 * Top to bottom: the four totals in one row, ONE toolbar (search and the
 * Filters button — the sheet holds type, tag, segment and the RFM group), the
 * chips of the filters in effect (only while any is), then the contacts: a
 * table on a sheet of glass from md up, cards on a phone. A row says what a
 * cash-on-delivery store asks before it ships again — orders, how many parcels
 * were received, the last order, what they paid — and ends in call / WhatsApp.
 *
 * A row opens Quick Look (tags are edited there); Enter on it opens the
 * customer's page. Ticking rows raises the bulk bar (add / remove tags). The
 * filters live in the URL (list/useContactsQuery.ts); the list is remembered
 * between visits and read again behind (list/useContactsData.ts). Export,
 * import and «إضافة جهة اتصال» are in the page's header (ContactsPage.tsx).
 */
export function ContactsAllTab({
  query,
  version,
  onAdd,
}: {
  query: ContactsQuery;
  /** Bumped by the page after a contact was added: the list is read again. */
  version: number;
  /** Open the add-contact sheet (it lives with the header's button). */
  onAdd: () => void;
}) {
  const t = useT(STRINGS);
  const navigate = useViewNavigate();
  const desktop = useIsDesktop();
  const { currentWorkspace } = useWorkspace();
  const currency = currentWorkspace?.defaultCurrency ?? "EGP";

  const data = useContactsData(query, version);
  const { contacts } = data;
  const shownIds = useMemo(() => contacts.map((contact) => contact.id), [contacts]);

  // ---- selection: contacts ticked for bulk tagging; a different filter starts a fresh one ----
  const [selected, setSelected] = useState<Set<string>>(new Set());
  useEffect(() => {
    setSelected(new Set());
  }, [query.key]);
  const toggleSelected = (id: string) =>
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  const allSelected = shownIds.length > 0 && shownIds.every((id) => selected.has(id));
  const toggleAll = () => setSelected(allSelected ? new Set() : new Set(shownIds));
  const clearSelection = () => setSelected(new Set());
  const selectedIds = useMemo(() => [...selected], [selected]);

  const [filtersOpen, setFiltersOpen] = useState(false);
  const chips = useContactFilterChips(query, data.segmentOptions);

  // ---- Quick Look: the contact being looked at stays here while the panel closes ----
  const [peek, setPeek] = useState<{ contact: Contact; open: boolean } | null>(null);
  // The preview follows the list: a tag added or taken off shows in the open panel at once.
  const peeked = peek ? (contacts.find((contact) => contact.id === peek.contact.id) ?? peek.contact) : null;

  // The row is marked as the source before leaving (and when it is peeked at, for «افتح العميل»):
  // the name then travels into the customer page's hero.
  const peekContact = (contact: Contact) => {
    markViewSource(contactRowElement(contact.id));
    setPeek({ contact, open: true });
  };
  const openContact = (contact: Contact) => {
    markViewSource(contactRowElement(contact.id));
    navigate(contactTo(contact));
  };
  const setPeekOpen = (open: boolean) => {
    setPeek((current) => (current ? { ...current, open } : current));
    if (open) return;
    // Closed without going to the customer: the row is no longer the source of anything.
    window.setTimeout(() => {
      if (!("vt" in document.documentElement.dataset)) markViewSource(null);
    }, 0);
  };

  // ---- the tags sheet for ONE contact, from its row's menu ----
  const [tagging, setTagging] = useState<{ contact: Contact; mode: BulkTagMode } | null>(null);
  const [taggingOpen, setTaggingOpen] = useState(false);
  const menuFor = useContactMenu({
    onOpen: openContact,
    onPeek: peekContact,
    onTag: (contact, mode) => {
      setTagging({ contact, mode });
      setTaggingOpen(true);
    },
  });
  const taggingIds = useMemo(() => (tagging ? [tagging.contact.id] : []), [tagging]);

  const pill = "min-h-11 rounded-full px-5";
  const empty = contacts.length === 0;

  let body: ReactNode;
  if (data.loading) {
    // Cards on a phone, the table's sheet from md up: the shape of what is coming.
    body = <ListSkeleton rows={8} />;
  } else if (data.error != null) {
    // What happened and a way to try again; for a role without customers, who can grant it.
    body = (
      <DataState loading={false} error={data.error} onRetry={data.reload}>
        {null}
      </DataState>
    );
  } else if (empty && query.narrowed) {
    body = (
      <EmptyState
        icon={<IconSearch aria-hidden />}
        title={t.emptyFilteredTitle}
        description={t.emptyFilteredBody}
        action={
          <Button variant="outline" className={pill} onClick={query.clearAll}>
            {t.clearFilters}
          </Button>
        }
      />
    );
  } else if (empty) {
    body = (
      <EmptyState
        icon={<IconPeople aria-hidden />}
        title={t.emptyTitle}
        description={t.emptyDescription}
        action={
          <div className="flex flex-wrap justify-center gap-2">
            <Button className={pill} onClick={onAdd}>
              <IconUserAdd className="size-4" weight="bold" aria-hidden />
              {t.add}
            </Button>
            <Button asChild variant="outline" className={pill}>
              <ViewLink to="/customers/import">
                <IconUpload className="size-4" weight="bold" aria-hidden />
                {t.importSheet}
              </ViewLink>
            </Button>
          </div>
        }
      />
    );
  } else {
    body = (
      <>
        {desktop ? (
          <ContactsTable
            rows={contacts}
            currency={currency}
            selected={selected}
            onToggle={toggleSelected}
            allSelected={allSelected}
            onToggleAll={toggleAll}
            menuFor={menuFor}
            onPeek={peekContact}
            onOpen={openContact}
          />
        ) : (
          <ContactCards
            rows={contacts}
            currency={currency}
            selected={selected}
            onToggle={toggleSelected}
            menuFor={menuFor}
            onPeek={peekContact}
            onOpen={openContact}
          />
        )}
        <LoadMore hasMore={data.hasMore} loading={data.loadingMore} onClick={data.loadMore} />
      </>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      <ContactsKpis totals={data.totals} loading={data.loading} />

      <ListToolbar
        search={{ value: query.search, onChange: query.setSearch, placeholder: t.searchPlaceholder, label: t.searchLabel }}
        filters={{ count: query.activeCount, onOpen: () => setFiltersOpen(true) }}
      />

      <ActiveFilters chips={chips} onClearAll={query.clearFilters} />

      {/* Fixed to the foot of the page; written here so Tab reaches it before the rows. */}
      <ContactBulkBar
        selectedIds={selectedIds}
        tagOptions={data.tagOptions}
        onClear={clearSelection}
        onDone={() => {
          clearSelection();
          data.refreshQuietly();
        }}
        // A phone has no table head to tick: the way to take every contact shown is here.
        extra={
          !allSelected && shownIds.length > 1 ? (
            <button
              type="button"
              onClick={() => setSelected(new Set(shownIds))}
              className="inline-flex min-h-11 cursor-pointer items-center rounded-full px-3 text-[13px] font-medium text-primary underline-offset-4 hover:underline focus-visible:outline-2 focus-visible:outline-primary"
            >
              {fmt(t.selectShown, { n: shownIds.length })}
            </button>
          ) : undefined
        }
      />

      <div aria-busy={data.refreshing || undefined} className="min-w-0">
        {body}
      </div>

      <ContactsFilterSheet
        open={filtersOpen}
        onOpenChange={setFiltersOpen}
        query={query}
        tagOptions={data.tagOptions}
        segmentOptions={data.segmentOptions}
        total={data.loading ? undefined : data.totals?.total}
      />

      <ContactQuickLook
        contact={peeked}
        open={Boolean(peek?.open)}
        onOpenChange={setPeekOpen}
        currency={currency}
        onAddTags={data.addTags}
        onRemoveTag={data.removeTag}
      />

      {/* The same sheet as the bulk bar's, for the one contact whose menu asked for it. */}
      <BulkTagSheet
        mode={taggingOpen && tagging ? tagging.mode : null}
        selectedIds={taggingIds}
        tagOptions={data.tagOptions}
        onClose={() => setTaggingOpen(false)}
        onDone={() => {
          setTaggingOpen(false);
          data.refreshQuietly();
        }}
      />
    </div>
  );
}
