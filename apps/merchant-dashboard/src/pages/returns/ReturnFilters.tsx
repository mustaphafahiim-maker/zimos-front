import {
  RETURN_REASON_CODES,
  returnPhotosOf,
  returnSourceOf,
  type ReturnReasonCode,
  type ReturnRequest,
  type ReturnSource,
} from "@store-builder/api-client";
import { FilterChoice, FilterGroup, FilterSheet } from "@/components/list";
import { useT, type Messages } from "@/i18n/LocaleContext";
import { pluralOf } from "@/lib/plural";
import { splitReason, useReturnLabels } from "./returnLabels";
import type { ActiveFilter } from "./rowkit/ActiveFilters";

const STRINGS = {
  en: {
    source: "Who opened it",
    sourceShopper: "The customer",
    sourceMerchant: "The store",
    chipShopper: "From the customer",
    chipMerchant: "Opened by the store",
    reason: "Reason",
    photos: "Photos",
    withPhotos: "With photos",
    show_one: "Show 1 return",
    show_other: "Show {n} returns",
  },
  ar: {
    source: "مين فتحه",
    sourceShopper: "العميل",
    sourceMerchant: "المتجر",
    chipShopper: "من العميل",
    chipMerchant: "فتحه المتجر",
    reason: "السبب",
    photos: "الصور",
    withPhotos: "فيها صور",
    show_one: "اعرض مرتجع واحد",
    show_two: "اعرض مرتجعين",
    show_few: "اعرض {n} مرتجعات",
    show_other: "اعرض {n} مرتجع",
  },
} satisfies Messages;

/** What the Filters sheet of the returns queue can narrow by. All of it is on the rows already: nothing is asked of the server. */
export interface ReturnFilterState {
  source: ReturnSource | null;
  reason: ReturnReasonCode | null;
  photos: boolean;
}

export const NO_RETURN_FILTERS: ReturnFilterState = { source: null, reason: null, photos: false };

export function countReturnFilters(filters: ReturnFilterState): number {
  return (filters.source ? 1 : 0) + (filters.reason ? 1 : 0) + (filters.photos ? 1 : 0);
}

export function matchesReturnFilters(ret: ReturnRequest, filters: ReturnFilterState): boolean {
  if (filters.source && returnSourceOf(ret) !== filters.source) return false;
  if (filters.reason && splitReason(ret.reason).code !== filters.reason) return false;
  if (filters.photos && returnPhotosOf(ret).length === 0) return false;
  return true;
}

/** The filters in effect as removable chips, for the row under the toolbar. */
export function useReturnFilterChips(filters: ReturnFilterState, onChange: (next: ReturnFilterState) => void): ActiveFilter[] {
  const t = useT(STRINGS);
  const labels = useReturnLabels();
  const chips: ActiveFilter[] = [];
  if (filters.source) {
    chips.push({
      id: "source",
      label: filters.source === "shopper" ? t.chipShopper : t.chipMerchant,
      onRemove: () => onChange({ ...filters, source: null }),
    });
  }
  if (filters.reason) {
    chips.push({ id: "reason", label: labels.reason(filters.reason), onRemove: () => onChange({ ...filters, reason: null }) });
  }
  if (filters.photos) {
    chips.push({ id: "photos", label: t.withPhotos, onRemove: () => onChange({ ...filters, photos: false }) });
  }
  return chips;
}

interface ReturnFilterSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  value: ReturnFilterState;
  onChange: (next: ReturnFilterState) => void;
  /** How many returns the list shows with these filters, for the button that closes the sheet. */
  matching: number;
}

/**
 * The one Filters sheet of the returns queue: who opened the return, the
 * reason it names, and whether it carries photos. A filter takes effect as it
 * is pressed (the list behind is already the answer); pressing the chosen pill
 * again lets go of it.
 */
export function ReturnFilterSheet({ open, onOpenChange, value, onChange, matching }: ReturnFilterSheetProps) {
  const t = useT(STRINGS);
  const labels = useReturnLabels();
  return (
    <FilterSheet
      open={open}
      onOpenChange={onOpenChange}
      activeCount={countReturnFilters(value)}
      onReset={() => onChange(NO_RETURN_FILTERS)}
      applyLabel={pluralOf(t, "show", matching)}
    >
      <FilterGroup label={t.source}>
        <FilterChoice<ReturnSource>
          label={t.source}
          allowClear
          value={value.source}
          onChange={(source) => onChange({ ...value, source })}
          options={[
            { value: "shopper", label: t.sourceShopper },
            { value: "merchant", label: t.sourceMerchant },
          ]}
        />
      </FilterGroup>
      <FilterGroup label={t.reason}>
        <FilterChoice<ReturnReasonCode>
          label={t.reason}
          allowClear
          value={value.reason}
          onChange={(reason) => onChange({ ...value, reason })}
          options={RETURN_REASON_CODES.map((code) => ({ value: code, label: labels.reason(code) }))}
        />
      </FilterGroup>
      <FilterGroup label={t.photos}>
        <FilterChoice<"with">
          label={t.photos}
          allowClear
          value={value.photos ? "with" : null}
          onChange={(photos) => onChange({ ...value, photos: photos === "with" })}
          options={[{ value: "with", label: t.withPhotos }]}
        />
      </FilterGroup>
    </FilterSheet>
  );
}
