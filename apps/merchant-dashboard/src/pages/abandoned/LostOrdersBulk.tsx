import { useState } from "react";
import { Button } from "@store-builder/ui";
import { lostOrdersBulkDelete, type LostOrder } from "@store-builder/api-client";
import { apiClient } from "@/lib/apiClient";
import { useWorkspaceId } from "@/lib/useWorkspaceId";
import { useAsync } from "@/lib/useAsync";
import { useErrorMessage } from "@/lib/errorMessages";
import { fmt, useT, type Messages } from "@/i18n/LocaleContext";
import type { Column } from "@/components/DataTable";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { Field } from "@/components/Field";
import { Select } from "@/components/Select";
import { useToast } from "@/components/Toast";

const STRINGS = {
  en: {
    select: "Select {name}",
    selectAll: "Select all shown",
    selected: "{count} selected",
    clear: "Clear",
    remove: "Delete selected",
    removeTitle: "Delete {count} lost orders?",
    removeBody: "They are removed for good. Lost orders that became orders are kept.",
    cancel: "Cancel",
    working: "Deleting…",
    removed: "{count} lost orders deleted.",
    skipped: "{count} were kept: they became orders.",
    product: "Product",
    anyProduct: "Any product",
  },
  ar: {
    select: "تحديد {name}",
    selectAll: "تحديد كل الظاهر",
    selected: "اخترت {count}",
    clear: "إلغاء التحديد",
    remove: "حذف المحدد",
    removeTitle: "حذف {count} طلب مفقود؟",
    removeBody: "يُحذف نهائيًا. الطلبات المفقودة التي تحولت لطلبات تبقى.",
    cancel: "إلغاء",
    working: "بنمسح…",
    removed: "تم حذف {count} طلب مفقود.",
    skipped: "بقي {count} لأنها تحولت لطلبات.",
    product: "المنتج",
    anyProduct: "أي منتج",
  },
} satisfies Messages;

/** The ticked lost orders and the table's checkbox column (SPEC §6.3 bulk actions). */
export function useLostOrderSelection(rows: readonly LostOrder[]) {
  const t = useT(STRINGS);
  const [ids, setIds] = useState<Set<string>>(new Set());
  const toggle = (id: string, on: boolean) =>
    setIds((prev) => {
      const next = new Set(prev);
      if (on) next.add(id);
      else next.delete(id);
      return next;
    });
  const allOn = rows.length > 0 && rows.every((r) => ids.has(r.id));
  const column: Column<LostOrder> = {
    key: "select",
    header: (
      <input
        type="checkbox"
        className="size-4 accent-primary"
        aria-label={t.selectAll}
        checked={allOn}
        onChange={(e) => setIds(e.target.checked ? new Set(rows.map((r) => r.id)) : new Set())}
      />
    ),
    cell: (s) => (
      <input
        type="checkbox"
        className="size-4 accent-primary"
        aria-label={fmt(t.select, { name: s.customerName || s.id })}
        checked={ids.has(s.id)}
        onClick={(e) => e.stopPropagation()}
        onChange={(e) => toggle(s.id, e.target.checked)}
      />
    ),
  };
  return { ids: [...ids], column, clear: () => setIds(new Set()) };
}

/** "N selected · Delete selected", over the table while something is ticked. */
export function LostOrdersBulkBar({ selection, onDone }: { selection: ReturnType<typeof useLostOrderSelection>; onDone: () => void }) {
  const t = useT(STRINGS);
  const workspaceId = useWorkspaceId();
  const toast = useToast();
  const errorMessage = useErrorMessage();
  const [confirming, setConfirming] = useState(false);
  const count = selection.ids.length;
  if (count === 0) return null;

  return (
    <div className="mb-3 flex flex-wrap items-center gap-3 rounded-lg border border-line bg-paper-raised px-3 py-2 text-sm">
      <span className="font-medium text-ink">{fmt(t.selected, { count })}</span>
      <Button size="sm" variant="ghost" className="min-h-11" onClick={selection.clear}>
        {t.clear}
      </Button>
      <Button size="sm" variant="outline" className="min-h-11 text-danger" onClick={() => setConfirming(true)}>
        {t.remove}
      </Button>
      <ConfirmDialog
        open={confirming}
        title={fmt(t.removeTitle, { count })}
        description={t.removeBody}
        confirmLabel={t.remove}
        cancelLabel={t.cancel}
        busyLabel={t.working}
        destructive
        onCancel={() => setConfirming(false)}
        onConfirm={async () => {
          try {
            const result = await lostOrdersBulkDelete(apiClient, workspaceId, selection.ids);
            toast.success(fmt(t.removed, { count: result.deleted }));
            if (result.skipped > 0) toast.success(fmt(t.skipped, { count: result.skipped }));
            selection.clear();
            onDone();
          } catch (err) {
            toast.error(errorMessage(err));
          } finally {
            setConfirming(false);
          }
        }}
      />
    </div>
  );
}

/** The product filter (GET /checkout-sessions?productId=). */
export function LostOrderProductFilter({ value, onChange }: { value: string; onChange: (productId: string) => void }) {
  const t = useT(STRINGS);
  const workspaceId = useWorkspaceId();
  const products = useAsync(
    () => apiClient.listProducts(workspaceId, { status: ["active", "draft"], limit: 200 }).then((r) => r.products).catch(() => []),
    [workspaceId]
  );
  return (
    <Field label={t.product}>
      {(props) => (
        <Select {...props} value={value} onChange={(e) => onChange(e.target.value)}>
          <option value="">{t.anyProduct}</option>
          {(products.data ?? []).map((p) => (
            <option key={p.id} value={p.id}>
              {p.name}
            </option>
          ))}
        </Select>
      )}
    </Field>
  );
}
