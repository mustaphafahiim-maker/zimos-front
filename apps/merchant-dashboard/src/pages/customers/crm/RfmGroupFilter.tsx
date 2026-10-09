import { useSearchParams } from "react-router-dom";
import { RFM_LABELS, isRfmLabel, type RfmLabel } from "@store-builder/api-client";
import { useT } from "@/i18n/LocaleContext";
import { FilterChoice } from "@/components/list";
import { RFM_STRINGS, rfmLabelName } from "./rfmStrings";

/**
 * The customers list's chosen RFM group, kept in the URL (`?group=champions`)
 * so a group can be linked to. Choosing one leaves the saved segment and any
 * other tab: a group is its own list.
 */
export function useRfmGroupParam(): [RfmLabel | null, (next: RfmLabel | null) => void] {
  const [searchParams, setSearchParams] = useSearchParams();
  const raw = searchParams.get("group");
  const group = isRfmLabel(raw) ? raw : null;
  const setGroup = (next: RfmLabel | null) =>
    setSearchParams(
      (prev) => {
        const params = new URLSearchParams(prev);
        if (next) {
          params.set("group", next);
          params.delete("segment");
          params.delete("tab");
        } else {
          params.delete("group");
        }
        return params;
      },
      { replace: true }
    );
  return [group, setGroup];
}

/**
 * Customers list → «المجموعة» (handoff 237): pick one of the nine RFM groups
 * as pills — the same pills as every other choice of the Filters sheet.
 * Pressing the chosen one again goes back to everyone. `onPicked` runs after a
 * choice (the sheet closes itself with it: a group swaps the list for its own).
 */
export function RfmGroupFilter({ onPicked }: { onPicked?: (group: RfmLabel | null) => void }) {
  const t = useT(RFM_STRINGS);
  const [group, setGroup] = useRfmGroupParam();
  return (
    <FilterChoice<RfmLabel>
      label={t.groupFilter}
      allowClear
      value={group}
      onChange={(next) => {
        setGroup(next);
        onPicked?.(next);
      }}
      options={RFM_LABELS.map((label) => ({ value: label, label: rfmLabelName(t, label) }))}
    />
  );
}
