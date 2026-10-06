import { useState } from "react";
import { Button } from "@store-builder/ui";
import type { OrderListParams } from "@store-builder/api-client";
import { apiClient } from "@/lib/apiClient";
import { useWorkspaceId } from "@/lib/useWorkspaceId";
import { useErrorMessage } from "@/lib/errorMessages";
import { fmt, useT, type Messages } from "@/i18n/LocaleContext";

const STRINGS = {
  en: {
    pageSelected: "All {count} orders on this page are selected.",
    selectAll: "Select all {total} orders in this list",
    selectFirst: "Select the first {max} of {total} orders in this list",
    selectAllUnknown: "Select every order in this list",
    loading: "Selecting…",
    allSelected: "All {count} orders in this list are selected.",
    capped: "Bulk actions take up to {max} orders at a time: the first {count} are selected.",
    clear: "Clear selection",
  },
  ar: {
    pageSelected: "تم تحديد كل الأوردرات في الصفحة دي ({count}).",
    selectAll: "حدّد كل الأوردرات في القائمة ({total})",
    selectFirst: "حدّد أول {max} من {total} أوردر في القائمة",
    selectAllUnknown: "حدّد كل الأوردرات في القائمة",
    loading: "بنحدد…",
    allSelected: "تم تحديد كل الأوردرات في القائمة ({count}).",
    capped: "الإجراء الجماعي بياخد {max} أوردر بالكتير في المرة: تم تحديد أول {count}.",
    clear: "إلغاء التحديد",
  },
} satisfies Messages;

/** The most orders one bulk action takes (POST /orders/bulk). */
const MAX = 500;

/**
 * "All filter results" (SPEC §4.3): once every order on the page is ticked
 * and the list has more, offers to tick every order the current tab, search
 * and filters show — fetched from the list itself, in its order, up to the
 * bulk limit. Every bulk tool (actions, printing, the extras) then works on
 * them as on any selection.
 */
export function SelectAllMatching({
  params,
  pageCount,
  selectedCount,
  allPageSelected,
  hasMore,
  total,
  onSelect,
  onClear,
}: {
  /** The list's own query: tab, sort, search and filters. */
  params: OrderListParams;
  pageCount: number;
  selectedCount: number;
  allPageSelected: boolean;
  hasMore: boolean;
  /** How many orders the list holds, when the counts are in. */
  total: number | undefined;
  onSelect: (ids: string[]) => void;
  onClear: () => void;
}) {
  const workspaceId = useWorkspaceId();
  const t = useT(STRINGS);
  const errorMessage = useErrorMessage();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // How many "select all" ticked: the message stays only while the selection is that one.
  const [matched, setMatched] = useState<number | null>(null);

  const showingAll = matched !== null && matched === selectedCount && selectedCount > pageCount;
  if (!showingAll && !(allPageSelected && hasMore)) return null;

  async function selectAll() {
    setBusy(true);
    setError(null);
    try {
      const ids: string[] = [];
      let cursor: string | undefined;
      do {
        const page = await apiClient.listOrders(workspaceId, { ...params, cursor, limit: 200 });
        ids.push(...page.orders.map((o) => o.id));
        cursor = page.nextCursor ?? undefined;
      } while (cursor && ids.length < MAX);
      const chosen = [...new Set(ids)].slice(0, MAX);
      setMatched(chosen.length);
      onSelect(chosen);
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  const capped = showingAll && total !== undefined && total > selectedCount;

  return (
    <div className="mb-3 flex flex-wrap items-center gap-x-3 gap-y-1 rounded-md border border-line bg-paper-raised px-3 py-2 text-sm" role="status">
      {showingAll ? (
        <>
          <span className="text-ink">
            {capped ? fmt(t.capped, { max: MAX, count: selectedCount }) : fmt(t.allSelected, { count: selectedCount })}
          </span>
          <Button
            variant="ghost"
            size="sm"
            className="min-h-11"
            onClick={() => {
              setMatched(null);
              onClear();
            }}
          >
            {t.clear}
          </Button>
        </>
      ) : (
        <>
          <span className="text-ink">{fmt(t.pageSelected, { count: pageCount })}</span>
          <Button variant="ghost" size="sm" className="min-h-11 text-primary" onClick={selectAll} disabled={busy}>
            {busy
              ? t.loading
              : total === undefined
                ? t.selectAllUnknown
                : total > MAX
                  ? fmt(t.selectFirst, { max: MAX, total })
                  : fmt(t.selectAll, { total })}
          </Button>
        </>
      )}
      {error && (
        <span className="text-danger" role="alert">
          {error}
        </span>
      )}
    </div>
  );
}
