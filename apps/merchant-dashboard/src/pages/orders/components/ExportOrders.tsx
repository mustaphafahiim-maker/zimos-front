import { useEffect, useMemo, useState } from "react";
import { Download } from "lucide-react";
import { Alert, Button, Spinner } from "@store-builder/ui";
import {
  exportFileStartOrders,
  orderExportPresetsList,
  type OrderExportCatalogue,
  type OrderExportParams,
  type OrderExportPreset,
} from "@store-builder/api-client";
import { apiClient } from "@/lib/apiClient";
import { useWorkspaceId } from "@/lib/useWorkspaceId";
import { useErrorMessage } from "@/lib/errorMessages";
import { fmt, useLocale, useT, type Messages } from "@/i18n/LocaleContext";
import { Modal } from "@/components/Modal";
import { useToast } from "@/components/Toast";
import { Select } from "@/components/Select";
import { CourierLayoutEditor } from "./CourierLayoutEditor";

const STRINGS = {
  en: {
    open: "Export",
    title: "Export orders",
    description: "A CSV file you can open in Excel or Google Sheets.",
    scopeFiltered: "Exports the orders matching your current search, dates and tab.",
    scopeSelected: "Exports the {count} orders you ticked.",
    scopeAll: "Exports every order in the store. Pick a tab or dates first to narrow it.",
    masked: "Phone numbers are partly hidden in the file unless your role may see customers' full numbers.",
    rowPer: "Rows",
    rowPerOrder: "One row per order",
    rowPerItem: "One row per product",
    columns: "Columns",
    selectAll: "Select all",
    reset: "Reset to default",
    perItemGroup: "Per product",
    none: "Pick at least one column.",
    limit: "A file holds up to {max} orders.",
    cancel: "Cancel",
    download: "Download CSV",
    downloading: "Preparing…",
    done: "Your orders file was downloaded.",
    prepare: "Prepare file",
    background: "The file is built in the background: the link arrives in your notifications and by email, and works for 7 days.",
    queued: "We're preparing your file. You'll get a notification with the link.",
    layout: "Layout",
    ownColumns: "Your columns (pick them below)",
    newLayout: "New courier layout",
    editLayout: "Edit this layout",
    layoutHint: "A courier layout writes the file with the courier's own titles, in its order.",
    layoutColumns: "Columns: {list}",
    layoutSaved: "Layout saved.",
  },
  ar: {
    open: "تصدير",
    title: "تصدير الطلبات",
    description: "ملف CSV يفتح في Excel أو Google Sheets.",
    scopeFiltered: "يصدّر الطلبات المطابقة للبحث والتواريخ والتبويب الحالي.",
    scopeSelected: "يصدّر الطلبات المحددة ({count}).",
    scopeAll: "يصدّر كل طلبات المتجر. اختر تبويبًا أو تواريخ أولًا لتحديد جزء منها.",
    masked: "أرقام الموبايل بتظهر مخفية جزئيًا في الملف إلا لو دورك يسمح بشوف أرقام العملاء كاملة.",
    rowPer: "الصفوف",
    rowPerOrder: "صف لكل طلب",
    rowPerItem: "صف لكل منتج",
    columns: "الأعمدة",
    selectAll: "تحديد الكل",
    reset: "الرجوع للافتراضي",
    perItemGroup: "لكل منتج",
    none: "اختر عمودًا واحدًا على الأقل.",
    limit: "الملف يحمل حتى {max} طلب.",
    cancel: "إلغاء",
    download: "تنزيل CSV",
    downloading: "بنجهّز…",
    done: "تم تنزيل ملف الطلبات.",
    prepare: "تجهيز الملف",
    background: "يُجهَّز الملف في الخلفية: يصلك الرابط في الإشعارات وبالبريد، ويعمل لمدة 7 أيام.",
    queued: "بنجهّز الملف. سيصلك إشعار بالرابط.",
    layout: "الشكل",
    ownColumns: "أعمدتك (اختارها تحت)",
    newLayout: "قالب شركة شحن جديد",
    editLayout: "عدّل القالب ده",
    layoutHint: "قالب شركة الشحن بيكتب الملف بأسامي أعمدة الشركة وبترتيبها.",
    layoutColumns: "الأعمدة: {list}",
    layoutSaved: "اتحفظ القالب.",
  },
} satisfies Messages;

type RowPer = "order" | "item";

/** The orders list's current filters, passed straight to the export. */
export type ExportOrdersFilters = Pick<OrderExportParams, "q" | "from" | "to" | "stage" | "sort"> & {
  /** Ticked orders, comma-separated (up to 100): the export takes only these. */
  ids?: string;
};

function saveBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

/**
 * The "Export" button of the orders list and its dialog: one row per order or
 * per product, and which columns. The file is the list as it is filtered now.
 */
export function ExportOrders({
  filters,
  label,
  size,
}: {
  filters: ExportOrdersFilters;
  label?: string;
  size?: "sm";
}) {
  const t = useT(STRINGS);
  const [open, setOpen] = useState(false);
  return (
    <>
      <Button variant="outline" size={size} className={size ? "min-h-11" : undefined} onClick={() => setOpen(true)}>
        <Download className="size-4" aria-hidden />
        {label ?? t.open}
      </Button>
      {open && <ExportOrdersDialog filters={filters} onClose={() => setOpen(false)} />}
    </>
  );
}

function ExportOrdersDialog({ filters, onClose }: { filters: ExportOrdersFilters; onClose: () => void }) {
  const workspaceId = useWorkspaceId();
  const t = useT(STRINGS);
  const { locale } = useLocale();
  const toast = useToast();
  const errorMessage = useErrorMessage();

  const [catalogue, setCatalogue] = useState<OrderExportCatalogue | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [rowPer, setRowPer] = useState<RowPer>("order");
  // CSV, or an Excel workbook (the API's `format`).
  const [format, setFormat] = useState<"csv" | "xlsx">("csv");
  const [selected, setSelected] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // Courier layouts (CourierLayoutEditor.tsx): the one chosen ("" = your own columns), and the one being edited.
  const [presets, setPresets] = useState<OrderExportPreset[]>([]);
  const [presetId, setPresetId] = useState("");
  const [editing, setEditing] = useState<OrderExportPreset | "new" | null>(null);
  const preset = presets.find((p) => p.id === presetId) ?? null;

  useEffect(() => {
    let cancelled = false;
    orderExportPresetsList(apiClient, workspaceId)
      .then((list) => {
        if (!cancelled) setPresets(list);
      })
      .catch(() => {
        /* no layouts to offer: the dialog works as before */
      });
    return () => {
      cancelled = true;
    };
  }, [workspaceId]);

  useEffect(() => {
    let cancelled = false;
    apiClient
      .getOrderExportColumns(workspaceId)
      .then((res) => {
        if (cancelled) return;
        setCatalogue(res);
        setSelected(res.defaults.order);
      })
      .catch((err) => {
        if (!cancelled) setLoadError(errorMessage(err));
      });
    return () => {
      cancelled = true;
    };
    // errorMessage is stable per locale; the catalogue is loaded once per open.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [workspaceId]);

  // Per-product columns only make sense on a row-per-product file.
  const visible = useMemo(
    () => (catalogue ? catalogue.columns.filter((c) => rowPer === "item" || !c.perItem) : []),
    [catalogue, rowPer]
  );

  function changeRowPer(next: RowPer) {
    setRowPer(next);
    if (catalogue) setSelected(catalogue.defaults[next]);
  }

  function toggle(key: string) {
    setSelected((current) => (current.includes(key) ? current.filter((k) => k !== key) : [...current, key]));
  }

  const background = !filters.ids;

  async function download() {
    if (!catalogue) return;
    setBusy(true);
    setError(null);
    try {
      // In the catalogue's order, whatever order the boxes were ticked in.
      const columns = visible.filter((c) => selected.includes(c.key)).map((c) => c.key);
      // A courier layout brings its own columns and rows (backend orders/exportPresets.js).
      const params = (
        preset
          ? { ...filters, preset: preset.id, lang: locale === "ar" ? "ar" : "en", format }
          : { ...filters, columns, rowPer, lang: locale === "ar" ? "ar" : "en", format }
      ) as unknown as Parameters<typeof apiClient.exportOrdersCsv>[1];
      // The whole list is built in the background (SPEC §4.3); ticked orders download now.
      if (background) {
        await exportFileStartOrders(apiClient, workspaceId, { ...params, format });
        toast.success(t.queued);
        onClose();
        return;
      }
      const blob = await apiClient.exportOrdersCsv(workspaceId, params);
      saveBlob(blob, `orders-${new Date().toISOString().slice(0, 10)}.${format}`);
      toast.success(t.done);
      onClose();
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  const filtered = Boolean(filters.q || filters.from || filters.to || filters.stage);
  const picked = filters.ids ? filters.ids.split(",").length : 0;
  const chosen = visible.filter((c) => selected.includes(c.key)).length;

  return (
    <Modal
      open
      onClose={busy ? () => undefined : onClose}
      title={t.title}
      description={t.description}
      footer={
        <>
          <Button variant="outline" onClick={onClose} disabled={busy}>
            {t.cancel}
          </Button>
          <Button onClick={download} disabled={busy || !catalogue || editing !== null || (!preset && chosen === 0)}>
            {busy ? t.downloading : background ? t.prepare : format === "xlsx" ? t.download.replace("CSV", "Excel") : t.download}
          </Button>
        </>
      }
    >
      {loadError ? (
        <Alert variant="destructive">{loadError}</Alert>
      ) : !catalogue ? (
        <div className="flex justify-center py-8">
          <Spinner />
        </div>
      ) : editing !== null ? (
        <CourierLayoutEditor
          catalogue={catalogue}
          preset={editing === "new" ? null : editing}
          onCancel={() => setEditing(null)}
          onSaved={(saved) => {
            setPresets((list) => (list.some((p) => p.id === saved.id) ? list.map((p) => (p.id === saved.id ? saved : p)) : [...list, saved]));
            setPresetId(saved.id);
            setFormat(saved.format);
            setEditing(null);
            toast.success(t.layoutSaved);
          }}
          onDeleted={(id) => {
            setPresets((list) => list.filter((p) => p.id !== id));
            setPresetId("");
            setEditing(null);
          }}
        />
      ) : (
        <div className="space-y-5">
          <p className="text-sm text-ink-soft">
            {picked ? fmt(t.scopeSelected, { count: picked }) : filtered ? t.scopeFiltered : t.scopeAll} {fmt(t.limit, { max: catalogue.maxOrders.toLocaleString() })}
          </p>
          {background && <p className="text-sm text-ink-soft">{t.background}</p>}
          <p className="text-xs text-ink-soft">{t.masked}</p>

          <div className="space-y-1.5">
            <label htmlFor="export-layout" className="text-sm font-medium text-ink">
              {t.layout}
            </label>
            <div className="flex flex-wrap items-center gap-2">
              <Select
                id="export-layout"
                className="w-auto min-w-56"
                value={presetId}
                onChange={(e) => {
                  setPresetId(e.target.value);
                  const next = presets.find((p) => p.id === e.target.value);
                  if (next) setFormat(next.format);
                }}
              >
                <option value="">{t.ownColumns}</option>
                {presets.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
              </Select>
              {preset && (
                <Button type="button" size="sm" variant="ghost" onClick={() => setEditing(preset)}>
                  {t.editLayout}
                </Button>
              )}
              <Button type="button" size="sm" variant="outline" onClick={() => setEditing("new")}>
                {t.newLayout}
              </Button>
            </div>
            <p className="text-xs text-ink-soft">
              {preset ? fmt(t.layoutColumns, { list: preset.columns.map((c) => c.header).join(" · ") }) : t.layoutHint}
            </p>
          </div>

          <fieldset>
            <legend className="mb-2 text-sm font-medium text-ink">{locale === "ar" ? "صيغة الملف" : "File format"}</legend>
            <div className="flex flex-wrap gap-x-6 gap-y-2">
              {(["csv", "xlsx"] as const).map((kind) => (
                <label key={kind} className="flex cursor-pointer items-center gap-2 text-sm text-ink">
                  <input type="radio" name="export-format" checked={format === kind} onChange={() => setFormat(kind)} />
                  {kind === "csv" ? "CSV" : "Excel (.xlsx)"}
                </label>
              ))}
            </div>
          </fieldset>

          {!preset && (
          <>
          <fieldset>
            <legend className="mb-2 text-sm font-medium text-ink">{t.rowPer}</legend>
            <div className="flex flex-wrap gap-x-6 gap-y-2">
              {(["order", "item"] as const).map((mode) => (
                <label key={mode} className="flex cursor-pointer items-center gap-2 text-sm text-ink">
                  <input type="radio" name="export-row-per" checked={rowPer === mode} onChange={() => changeRowPer(mode)} />
                  {mode === "order" ? t.rowPerOrder : t.rowPerItem}
                </label>
              ))}
            </div>
          </fieldset>

          <fieldset>
            <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
              <legend className="text-sm font-medium text-ink">{t.columns}</legend>
              <div className="flex gap-3 text-xs">
                <button type="button" className="text-primary hover:underline" onClick={() => setSelected(visible.map((c) => c.key))}>
                  {t.selectAll}
                </button>
                <button type="button" className="text-primary hover:underline" onClick={() => setSelected(catalogue.defaults[rowPer])}>
                  {t.reset}
                </button>
              </div>
            </div>
            <div className="grid max-h-64 grid-cols-1 gap-x-6 gap-y-1.5 overflow-y-auto rounded-lg border border-line p-3 sm:grid-cols-2">
              {visible.map((column) => (
                <label key={column.key} className="flex cursor-pointer items-center gap-2 text-sm text-ink">
                  <input type="checkbox" checked={selected.includes(column.key)} onChange={() => toggle(column.key)} />
                  <span>{locale === "ar" ? column.label.ar : column.label.en}</span>
                  {column.perItem && <span className="text-xs text-ink-soft">· {t.perItemGroup}</span>}
                </label>
              ))}
            </div>
            {chosen === 0 && <p className="mt-2 text-xs text-danger">{t.none}</p>}
          </fieldset>
          </>
          )}

          {error && <Alert variant="destructive">{error}</Alert>}
        </div>
      )}
    </Modal>
  );
}
