import { useState } from "react";
import { ArrowDown, ArrowUp, Plus, Trash2 } from "lucide-react";
import { Alert, Button, Input, Label } from "@store-builder/ui";
import {
  orderExportHeadersFromPaste,
  orderExportPresetDelete,
  orderExportPresetSave,
  type OrderExportCatalogue,
  type OrderExportPreset,
} from "@store-builder/api-client";
import { apiClient } from "@/lib/apiClient";
import { useWorkspaceId } from "@/lib/useWorkspaceId";
import { useErrorMessage } from "@/lib/errorMessages";
import { fmt, useLocale, useT, type Messages } from "@/i18n/LocaleContext";
import { Select } from "@/components/Select";
import { Textarea } from "@/components/Textarea";

const STRINGS = {
  en: {
    newTitle: "New courier layout",
    editTitle: "Edit courier layout",
    intro: "Lay the file out the way your courier's sample sheet is: its column titles, in its order. Each column takes one of your order fields, or the same value on every row.",
    name: "Layout name",
    namePlaceholder: "e.g. Courier X sheet",
    paste: "Paste the courier's header row",
    pasteHint: "Copy the title row from the courier's Excel file and paste it here. Each title becomes a column, with a guess at its field — check them.",
    usePaste: "Use these titles",
    columns: "Columns",
    header: "Column title",
    source: "Filled with",
    fixed: "The same value on every row",
    fixedValue: "Value",
    moveUp: "Move {name} up",
    moveDown: "Move {name} down",
    remove: "Remove {name}",
    add: "Add a column",
    rows: "Rows",
    perOrder: "One row per order",
    perItem: "One row per product",
    format: "File",
    save: "Save layout",
    saving: "Saving…",
    cancel: "Back",
    delete: "Delete layout",
    needName: "Name the layout.",
    needColumns: "Add at least one column with a title.",
  },
  ar: {
    newTitle: "قالب شركة شحن جديد",
    editTitle: "تعديل قالب شركة الشحن",
    intro: "رتّب الملف زي شيت شركة الشحن بالظبط: أسامي أعمدتها وبترتيبها. كل عمود بياخد حقل من بيانات الطلب، أو نفس القيمة في كل الصفوف.",
    name: "اسم القالب",
    namePlaceholder: "مثلًا: شيت شركة الشحن",
    paste: "الزق صف العناوين بتاع شركة الشحن",
    pasteHint: "انسخ صف العناوين من ملف Excel بتاع الشركة والزقه هنا. كل عنوان هيبقى عمود، ومعاه تخمين للحقل بتاعه — راجعه.",
    usePaste: "استخدم العناوين دي",
    columns: "الأعمدة",
    header: "عنوان العمود",
    source: "بيتملي بـ",
    fixed: "نفس القيمة في كل صف",
    fixedValue: "القيمة",
    moveUp: "حرّك {name} لفوق",
    moveDown: "حرّك {name} لتحت",
    remove: "شيل {name}",
    add: "ضيف عمود",
    rows: "الصفوف",
    perOrder: "صف لكل طلب",
    perItem: "صف لكل منتج",
    format: "الملف",
    save: "احفظ القالب",
    saving: "بنحفظ…",
    cancel: "رجوع",
    delete: "امسح القالب",
    needName: "سمّي القالب.",
    needColumns: "ضيف عمود واحد على الأقل بعنوان.",
  },
} satisfies Messages;

interface Row {
  header: string;
  /** A catalogue column key, or "" for a fixed value. */
  key: string;
  fixed: string;
}

/** A first guess at which field a courier's column title asks for; the merchant checks it. */
const GUESSES: Array<[RegExp, string]> = [
  [/(alternat|second|other|بديل|آخر|اخر|٢|2).*(phone|mobile|موبايل|هاتف|تليفون|جوال)|(phone|mobile|موبايل|هاتف|تليفون|جوال).*(2|٢|بديل|آخر|اخر)/i, "alternatePhone"],
  [/phone|mobile|موبايل|هاتف|تليفون|جوال|تلفون/i, "phone"],
  [/governorate|province|state|محافظ|منطقة|region/i, "region"],
  [/city|مدينة|مدينه|area|district|حي/i, "city"],
  [/address|عنوان/i, "fullAddress"],
  [/cod|collect|تحصيل|cash|المبلغ|قيمة|قيمه|amount|price|سعر/i, "codAmount"],
  [/qty|quantity|pieces|عدد|كمية|كميه/i, "itemsCount"],
  [/description|content|product|item|وصف|محتوى|منتج/i, "items"],
  [/note|comment|ملاحظ|تعليق/i, "notes"],
  [/reference|ref|order|مرجع|رقم الطلب|طلب/i, "orderNumber"],
  [/name|اسم|مستلم|receiver|consignee|customer|عميل/i, "customerName"],
];

function guessKey(header: string, keys: Set<string>): string {
  for (const [pattern, key] of GUESSES) if (pattern.test(header) && keys.has(key)) return key;
  return "";
}

function toRows(preset: OrderExportPreset | null): Row[] {
  return (preset?.columns ?? []).map((c) => ("key" in c ? { header: c.header, key: c.key, fixed: "" } : { header: c.header, key: "", fixed: c.fixed }));
}

/**
 * Builds or edits one courier export layout (backend orders/exportPresets.js),
 * inside the export dialog.
 */
export function CourierLayoutEditor({
  catalogue,
  preset,
  onSaved,
  onDeleted,
  onCancel,
}: {
  catalogue: OrderExportCatalogue;
  preset: OrderExportPreset | null;
  onSaved: (preset: OrderExportPreset) => void;
  onDeleted: (id: string) => void;
  onCancel: () => void;
}) {
  const t = useT(STRINGS);
  const { locale } = useLocale();
  const workspaceId = useWorkspaceId();
  const errorMessage = useErrorMessage();
  const [name, setName] = useState(preset?.name ?? "");
  const [rows, setRows] = useState<Row[]>(toRows(preset));
  const [rowPer, setRowPer] = useState<"order" | "item">(preset?.rowPer ?? "order");
  const [format, setFormat] = useState<"csv" | "xlsx">(preset?.format ?? "xlsx");
  const [pasted, setPasted] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fields = catalogue.columns.filter((c) => rowPer === "item" || !c.perItem);
  const keys = new Set(fields.map((c) => c.key));
  const labelOf = (row: Row, i: number) => row.header || `${t.header} ${i + 1}`;
  const set = (i: number, patch: Partial<Row>) => setRows((list) => list.map((r, j) => (j === i ? { ...r, ...patch } : r)));
  const move = (i: number, by: number) =>
    setRows((list) => {
      const next = [...list];
      const [row] = next.splice(i, 1);
      next.splice(i + by, 0, row);
      return next;
    });

  async function save() {
    const columns = rows
      .filter((r) => r.header.trim())
      .map((r) => (r.key ? { header: r.header.trim(), key: r.key } : { header: r.header.trim(), fixed: r.fixed }));
    if (!name.trim()) return setError(t.needName);
    if (columns.length === 0) return setError(t.needColumns);
    setBusy(true);
    setError(null);
    try {
      onSaved(await orderExportPresetSave(apiClient, workspaceId, { ...(preset ? { id: preset.id } : {}), name: name.trim(), rowPer, format, columns }));
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  async function remove() {
    if (!preset) return;
    setBusy(true);
    setError(null);
    try {
      await orderExportPresetDelete(apiClient, workspaceId, preset.id);
      onDeleted(preset.id);
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-4">
      <div>
        <h3 className="font-medium text-ink">{preset ? t.editTitle : t.newTitle}</h3>
        <p className="mt-1 text-sm text-ink-soft">{t.intro}</p>
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="layout-name">{t.name}</Label>
        <Input id="layout-name" dir="auto" maxLength={60} value={name} placeholder={t.namePlaceholder} onChange={(e) => setName(e.target.value)} />
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="layout-paste">{t.paste}</Label>
        <Textarea id="layout-paste" dir="auto" rows={2} value={pasted} aria-describedby="layout-paste-hint" onChange={(e) => setPasted(e.target.value)} />
        <p id="layout-paste-hint" className="text-xs text-ink-soft">
          {t.pasteHint}
        </p>
        <Button
          type="button"
          size="sm"
          variant="outline"
          disabled={!pasted.trim()}
          onClick={() => {
            setRows(orderExportHeadersFromPaste(pasted).map((header) => ({ header, key: guessKey(header, keys), fixed: "" })));
            setPasted("");
          }}
        >
          {t.usePaste}
        </Button>
      </div>

      <fieldset className="space-y-2">
        <legend className="mb-1 text-sm font-medium text-ink">{t.columns}</legend>
        <ol className="space-y-2">
          {rows.map((row, i) => (
            <li key={i} className="grid gap-2 rounded-lg border border-line p-2 sm:grid-cols-[1fr_1fr_auto]">
              <Input dir="auto" maxLength={80} aria-label={`${t.header} ${i + 1}`} placeholder={t.header} value={row.header} onChange={(e) => set(i, { header: e.target.value })} />
              <div className="space-y-1">
                <Select aria-label={`${t.source} — ${labelOf(row, i)}`} value={row.key} onChange={(e) => set(i, { key: e.target.value })}>
                  <option value="">{t.fixed}</option>
                  {fields.map((c) => (
                    <option key={c.key} value={c.key}>
                      {locale === "ar" ? c.label.ar : c.label.en}
                    </option>
                  ))}
                </Select>
                {!row.key && (
                  <Input dir="auto" maxLength={200} aria-label={`${t.fixedValue} — ${labelOf(row, i)}`} placeholder={t.fixedValue} value={row.fixed} onChange={(e) => set(i, { fixed: e.target.value })} />
                )}
              </div>
              <div className="flex items-start gap-0.5">
                <Button type="button" size="icon-sm" variant="ghost" aria-label={fmt(t.moveUp, { name: labelOf(row, i) })} disabled={i === 0} onClick={() => move(i, -1)}>
                  <ArrowUp className="size-4" aria-hidden />
                </Button>
                <Button type="button" size="icon-sm" variant="ghost" aria-label={fmt(t.moveDown, { name: labelOf(row, i) })} disabled={i === rows.length - 1} onClick={() => move(i, 1)}>
                  <ArrowDown className="size-4" aria-hidden />
                </Button>
                <Button type="button" size="icon-sm" variant="ghost" aria-label={fmt(t.remove, { name: labelOf(row, i) })} onClick={() => setRows((list) => list.filter((_, j) => j !== i))}>
                  <Trash2 className="size-4 text-danger" aria-hidden />
                </Button>
              </div>
            </li>
          ))}
        </ol>
        <Button type="button" size="sm" variant="ghost" disabled={rows.length >= 60} onClick={() => setRows((list) => [...list, { header: "", key: "", fixed: "" }])}>
          <Plus className="size-4" aria-hidden />
          {t.add}
        </Button>
      </fieldset>

      <div className="flex flex-wrap gap-x-8 gap-y-3">
        <fieldset>
          <legend className="mb-1 text-sm font-medium text-ink">{t.rows}</legend>
          {(["order", "item"] as const).map((mode) => (
            <label key={mode} className="me-4 inline-flex cursor-pointer items-center gap-2 text-sm text-ink">
              <input type="radio" name="layout-row-per" checked={rowPer === mode} onChange={() => setRowPer(mode)} />
              {mode === "order" ? t.perOrder : t.perItem}
            </label>
          ))}
        </fieldset>
        <fieldset>
          <legend className="mb-1 text-sm font-medium text-ink">{t.format}</legend>
          {(["xlsx", "csv"] as const).map((kind) => (
            <label key={kind} className="me-4 inline-flex cursor-pointer items-center gap-2 text-sm text-ink">
              <input type="radio" name="layout-format" checked={format === kind} onChange={() => setFormat(kind)} />
              {kind === "csv" ? "CSV" : "Excel (.xlsx)"}
            </label>
          ))}
        </fieldset>
      </div>

      {error && <Alert variant="destructive">{error}</Alert>}
      <div className="flex flex-wrap justify-between gap-2">
        <div>
          {preset && (
            <Button type="button" variant="ghost" className="text-danger" disabled={busy} onClick={() => void remove()}>
              {t.delete}
            </Button>
          )}
        </div>
        <div className="flex gap-2">
          <Button type="button" variant="outline" disabled={busy} onClick={onCancel}>
            {t.cancel}
          </Button>
          <Button type="button" disabled={busy} onClick={() => void save()}>
            {busy ? t.saving : t.save}
          </Button>
        </div>
      </div>
    </div>
  );
}
