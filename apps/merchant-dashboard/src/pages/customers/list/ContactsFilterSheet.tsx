import type { ContactSegment, ContactTagCount, ContactType } from "@store-builder/api-client";
import { FilterChoice, FilterGroup, FilterSheet } from "@/components/list";
import { fmt, useT, type Messages } from "@/i18n/LocaleContext";
import { pluralOf } from "@/lib/plural";
import type { ActiveFilterChip } from "@/pages/orders/list/ActiveFilters";
import { CONTACT_STRINGS } from "../contactStrings";
import { RfmGroupFilter } from "../crm/RfmGroupFilter";
import type { ContactsQuery } from "./useContactsQuery";

const STRINGS = {
  en: {
    type: "Type",
    typeHint: "A lead becomes a customer with their first order.",
    everyone: "Everyone",
    tag: "Tag",
    tagHint: "Contacts that carry this tag.",
    tagWithCount: "{tag} · {count}",
    noTags: "No tags in use yet. Add one from a contact's quick look.",
    segment: "Segment",
    segmentHint: "A saved filter — make one in the Segments tab.",
    noSegments: "No saved segments yet.",
    group: "Customer group",
    groupHint: "A group lists customers with a delivered order only, so the search and the other filters don't apply to it.",
    show_one: "Show 1 contact",
    show_other: "Show {n} contacts",
    showAny: "Show the contacts",
    chipType: "Type: {value}",
    chipTag: "Tag: {value}",
    chipSegment: "Segment: {value}",
    chipSegmentUnknown: "A saved segment",
  },
  ar: {
    type: "النوع",
    typeHint: "العميل المحتمل بيبقى عميل مع أول أوردر.",
    everyone: "الكل",
    tag: "الوسم",
    tagHint: "جهات الاتصال اللي عليها الوسم ده.",
    tagWithCount: "{tag} · {count}",
    noTags: "لسه مفيش وسوم مستخدمة. ضيف وسم من النظرة السريعة لأي جهة اتصال.",
    segment: "الشريحة",
    segmentHint: "فلتر محفوظ — اعمل واحد من تبويب الشرائح.",
    noSegments: "لسه مفيش شرائح محفوظة.",
    group: "مجموعة العميل",
    groupHint: "المجموعة بتعرض العملاء اللي اتسلّملهم أوردر بس، عشان كده البحث وباقي الفلاتر مش بتشتغل عليها.",
    show_one: "اعرض جهة اتصال واحدة",
    show_two: "اعرض جهتين اتصال",
    show_few: "اعرض {n} جهات اتصال",
    show_other: "اعرض {n} جهة اتصال",
    showAny: "اعرض جهات الاتصال",
    chipType: "النوع: {value}",
    chipTag: "الوسم: {value}",
    chipSegment: "الشريحة: {value}",
    chipSegmentUnknown: "شريحة محفوظة",
  },
} satisfies Messages;

type TypeChoice = "all" | ContactType;

/**
 * The filters in effect as removable chips, for the row under the toolbar
 * (pages/orders/list/ActiveFilters.tsx draws them).
 */
export function useContactFilterChips(query: ContactsQuery, segments: readonly ContactSegment[]): ActiveFilterChip[] {
  const t = useT(STRINGS);
  const c = useT(CONTACT_STRINGS);
  const chips: ActiveFilterChip[] = [];
  if (query.type) {
    chips.push({ id: "type", label: fmt(t.chipType, { value: c[`type_${query.type}`] }), onRemove: () => query.setType(null) });
  }
  if (query.tag) {
    chips.push({ id: "tag", label: fmt(t.chipTag, { value: query.tag }), onRemove: () => query.setTag("") });
  }
  if (query.segmentId) {
    const segment = segments.find((item) => item.id === query.segmentId);
    chips.push({
      id: "segment",
      label: segment ? fmt(t.chipSegment, { value: segment.name }) : t.chipSegmentUnknown,
      onRemove: () => query.setSegment(""),
    });
  }
  return chips;
}

/**
 * The one place the contacts list is filtered: type (everyone / customers /
 * leads), tag (the tags in use, each with how many carry it), a saved segment,
 * and the RFM group — every filter the page had as four separate selects.
 * Filters take effect as they change; the main button says how many contacts
 * are waiting behind the sheet. Choosing a group closes the sheet: it swaps the
 * list for that group's customers.
 */
export function ContactsFilterSheet({
  open,
  onOpenChange,
  query,
  tagOptions,
  segmentOptions,
  total,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  query: ContactsQuery;
  tagOptions: readonly ContactTagCount[];
  segmentOptions: readonly ContactSegment[];
  /** How many contacts match now; undefined while it is not known. */
  total: number | undefined;
}) {
  const t = useT(STRINGS);
  const c = useT(CONTACT_STRINGS);
  // A tag in the link that is no longer in use still shows as chosen, so it can be let go of.
  const tags = query.tag && !tagOptions.some((option) => option.tag === query.tag) ? [{ tag: query.tag, count: 0 }, ...tagOptions] : tagOptions;

  return (
    <FilterSheet
      open={open}
      onOpenChange={onOpenChange}
      activeCount={query.activeCount}
      onReset={query.clearFilters}
      applyLabel={total === undefined ? t.showAny : pluralOf(t, "show", total)}
    >
      <FilterGroup label={t.type} hint={t.typeHint}>
        <FilterChoice<TypeChoice>
          label={t.type}
          value={query.type ?? "all"}
          onChange={(next) => query.setType(next === null || next === "all" ? null : next)}
          options={[
            { value: "all", label: t.everyone },
            { value: "customer", label: c.type_customer },
            { value: "lead", label: c.type_lead },
          ]}
        />
      </FilterGroup>

      <FilterGroup label={t.tag} hint={tags.length > 0 ? t.tagHint : undefined}>
        {tags.length === 0 ? (
          <p className="text-sm leading-6 text-ink-soft">{t.noTags}</p>
        ) : (
          // Many tags: the group scrolls inside itself rather than pushing the other filters out of reach.
          <div className="-m-1 max-h-48 overflow-y-auto overscroll-contain p-1">
            <FilterChoice
              label={t.tag}
              allowClear
              value={query.tag || null}
              onChange={(next) => query.setTag(next ?? "")}
              options={tags.map((option) => ({
                value: option.tag,
                label: option.count > 0 ? fmt(t.tagWithCount, { tag: option.tag, count: option.count }) : option.tag,
              }))}
            />
          </div>
        )}
      </FilterGroup>

      <FilterGroup label={t.segment} hint={t.segmentHint}>
        {segmentOptions.length === 0 ? (
          <p className="text-sm leading-6 text-ink-soft">{t.noSegments}</p>
        ) : (
          <div className="-m-1 max-h-48 overflow-y-auto overscroll-contain p-1">
            <FilterChoice
              label={t.segment}
              allowClear
              value={query.segmentId || null}
              onChange={(next) => query.setSegment(next ?? "")}
              options={segmentOptions.map((segment) => ({ value: segment.id, label: segment.name }))}
            />
          </div>
        )}
      </FilterGroup>

      {/* «المجموعة» (handoff 237): choosing an RFM group swaps this list for that group's customers. */}
      <FilterGroup label={t.group} hint={t.groupHint} collapsible>
        <RfmGroupFilter onPicked={(group) => group && onOpenChange(false)} />
      </FilterGroup>
    </FilterSheet>
  );
}
