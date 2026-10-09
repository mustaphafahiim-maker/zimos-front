import { useEffect, useMemo, useState } from "react";
import { IconArrowDown, IconArrowUp, IconClose, IconDelete, IconPlus } from "@/components/icons";
import { Alert, Button, Dialog, DialogClose, DialogContent, DialogDescription, DialogHeader, DialogTitle, Input, Label } from "@store-builder/ui";
import {
  funnelsList,
  googleSheetsCreate,
  googleSheetsUpdate,
  resolveCheckoutForm,
  type GoogleSheetsOverview,
  type SheetColumn,
  type SheetColumnOption,
  type SheetConnection,
  type SheetDataType,
} from "@store-builder/api-client";
import { apiClient } from "@/lib/apiClient";
import { useWorkspaceId } from "@/lib/useWorkspaceId";
import { useAsync } from "@/lib/useAsync";
import { useErrorMessage } from "@/lib/errorMessages";
import { ExistingSpreadsheetField, isSpreadsheetRef, useSheetErrorOverrides } from "./googleSheetsReal";
import { fmt, useLocale, useT, type Messages } from "@/i18n/LocaleContext";
import { useWorkspace } from "@/context/WorkspaceContext";
import { Select } from "@/components/Select";
import { ProductChecklist, useStoreProducts } from "../offers/OfferRuleParts";

const STRINGS = {
  en: {
    newTitle: "Add a sheet",
    editTitle: "Edit {name}",
    intro: "A new Google sheet is created in the connected account. New rows are written as they happen; a change rewrites the same row.",
    close: "Close",
    name: "Sheet name",
    namePlaceholder: "e.g. Confirmation team",
    carries: "What it carries",
    orders: "Orders",
    ordersHint: "A row for each new order; its status, waybill and amounts stay up to date.",
    lost: "Lost orders",
    lostHint: "Checkouts left without an order, for the team to call.",
    leads: "Leads",
    leadsHint: "Sign-ups from your contact forms and funnel opt-in steps.",
    lang: "Language of dates and status words",
    arabic: "Arabic",
    english: "English",
    columns: "Columns",
    columnsHint: "In the order they appear in the sheet. A column takes a field, or the same value on every row.",
    header: "Column title",
    source: "Filled with",
    fixed: "The same value on every row",
    fixedValue: "Value",
    customField: "Checkout field: {name}",
    customFallback: "Custom field {n}",
    moveUp: "Move {name} up",
    moveDown: "Move {name} down",
    remove: "Remove {name}",
    add: "Add a column",
    defaults: "Use the default columns",
    group: "Group products into one row by order number",
    groupOn: "One row per order, its products together in one cell.",
    groupOff: "One row per product; the order's details repeat on each.",
    products: "Only orders with these products",
    productsLost: "Only checkouts with these products",
    funnels: "Only these funnels",
    filterHint: "Leave empty to take everything.",
    funnelSearch: "Search funnels",
    noFunnels: "No funnel matches",
    selected: "{count} selected",
    save: "Save sheet",
    create: "Create sheet",
    saving: "Saving…",
    needName: "Name the sheet.",
    needColumns: "Add at least one column with a title.",
    loading: "Loading…",
  },
  ar: {
    newTitle: "إضافة شيت",
    editTitle: "تعديل {name}",
    intro: "هيتعمل شيت جديد في حساب Google المربوط. الصفوف الجديدة بتتكتب أول ما تحصل، وأي تغيير بيتكتب على نفس الصف.",
    close: "إغلاق",
    name: "اسم الشيت",
    namePlaceholder: "مثلًا: فريق التأكيد",
    carries: "هيتكتب فيه إيه",
    orders: "الطلبات",
    ordersHint: "صف لكل طلب جديد، وحالته ورقم البوليصة والمبالغ بتتحدّث أول بأول.",
    lost: "الطلبات الضايعة",
    lostHint: "عمليات شراء اتسابت من غير طلب، علشان الفريق يكلّمهم.",
    leads: "العملاء المحتملين",
    leadsHint: "التسجيلات من نماذج التواصل وخطوات التسجيل في مسارات البيع.",
    lang: "لغة التواريخ وأسماء الحالات",
    arabic: "العربية",
    english: "الإنجليزية",
    columns: "الأعمدة",
    columnsHint: "بنفس ترتيبها في الشيت. كل عمود بياخد حقل، أو نفس القيمة في كل الصفوف.",
    header: "عنوان العمود",
    source: "بيتملي بـ",
    fixed: "نفس القيمة في كل صف",
    fixedValue: "القيمة",
    customField: "حقل من فورم الشراء: {name}",
    customFallback: "حقل إضافي {n}",
    moveUp: "حرّك {name} لفوق",
    moveDown: "حرّك {name} لتحت",
    remove: "شيل {name}",
    add: "إضافة عمود",
    defaults: "استخدم الأعمدة الافتراضية",
    group: "اجمع المنتجات في صف واحد برقم الطلب",
    groupOn: "صف واحد لكل طلب، ومنتجاته مع بعض في خانة واحدة.",
    groupOff: "صف لكل منتج، وبيانات الطلب بتتكرر في كل صف.",
    products: "الطلبات اللي فيها المنتجات دي بس",
    productsLost: "عمليات الشراء اللي فيها المنتجات دي بس",
    funnels: "مسارات البيع دي بس",
    filterHint: "سيبها فاضية علشان ياخد كل حاجة.",
    funnelSearch: "دوّر على مسار بيع",
    noFunnels: "مفيش مسار بيع مطابق",
    selected: "{count} متختار",
    save: "حفظ الشيت",
    create: "إنشاء الشيت",
    saving: "بنحفظ…",
    needName: "اكتب اسم للشيت.",
    needColumns: "ضيف عمود واحد على الأقل بعنوان.",
    loading: "بنحمّل…",
  },
} satisfies Messages;

type Row = { header: string; key: string; fixed: string };
type Lang = "ar" | "en";

const LOST_DEFAULTS = ["date", "status", "reason", "customerName", "phone", "region", "city", "address", "items", "total"];
const LEAD_DEFAULTS = ["date", "form", "customerName", "phone", "email", "message"];

function toRows(columns: SheetColumn[]): Row[] {
  return columns.map((c) => ("key" in c ? { header: c.header, key: c.key, fixed: "" } : { header: c.header, key: "", fixed: c.fixed }));
}

/**
 * Creates or edits one Google sheet (backend sheets/sheetsRoutes.js): what it
 * carries, its columns in order (fields or fixed values), the "one row per
 * order" switch and the products / funnels it takes.
 */
export function GoogleSheetDialog({
  open,
  connection,
  overview,
  onClose,
  onSaved,
}: {
  open: boolean;
  connection: SheetConnection | null;
  overview: GoogleSheetsOverview;
  onClose: () => void;
  onSaved: (connection: SheetConnection, created: boolean) => void;
}) {
  const t = useT(STRINGS);
  const { locale } = useLocale();
  const workspaceId = useWorkspaceId();
  const errorMessage = useErrorMessage();
  const { currentWorkspace } = useWorkspace();
  const products = useStoreProducts();
  const funnels = useAsync(() => (open ? funnelsList(apiClient, workspaceId) : Promise.resolve([])), [workspaceId, open]);
  const catalogue = useAsync(() => (open ? apiClient.getOrderExportColumns(workspaceId) : Promise.resolve(null)), [workspaceId, open]);

  const [name, setName] = useState("");
  const [dataType, setDataType] = useState<SheetDataType>("orders");
  const [lang, setLang] = useState<Lang>(locale === "en" ? "en" : "ar");
  const [rows, setRows] = useState<Row[]>([]);
  const [groupByOrder, setGroupByOrder] = useState(true);
  const [productIds, setProductIds] = useState<string[]>([]);
  const [funnelIds, setFunnelIds] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // A spreadsheet to reuse, by link or id (new sheets only; handoff 393).
  const [existing, setExisting] = useState("");
  const sheetErrors = useSheetErrorOverrides();
  // Whether a new sheet has its default columns yet (the order fields load first).
  const [seeded, setSeeded] = useState(false);

  // A new sheet starts from the defaults of what it carries; an edit from what it has.
  useEffect(() => {
    if (!open) return;
    setError(null);
    setExisting("");
    setName(connection?.name ?? "");
    setDataType(connection?.dataType ?? "orders");
    setLang(connection?.filter.lang ?? (locale === "en" ? "en" : "ar"));
    setRows(connection ? toRows(connection.columns) : []);
    setGroupByOrder(connection?.groupByOrder ?? true);
    setProductIds(connection?.filter.productIds ?? []);
    setFunnelIds(connection?.filter.funnelIds ?? []);
    setSeeded(Boolean(connection));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, connection]);

  const customFields = useMemo<SheetColumnOption[]>(() => {
    const form = resolveCheckoutForm(currentWorkspace?.settings?.checkout_settings);
    return form.fields
      .filter((f) => f.custom && f.enabled)
      .map((f) => {
        const n = f.key.replace("custom_", "");
        const label = (l: Lang) => fmt(STRINGS[l].customField, { name: f.label[l] || f.label[l === "ar" ? "en" : "ar"] || fmt(STRINGS[l].customFallback, { n }) });
        return { key: `field:${f.key}`, label: { en: label("en"), ar: label("ar") } };
      });
  }, [currentWorkspace]);

  const options = useMemo<SheetColumnOption[]>(() => {
    if (dataType === "lost_orders") return overview.lostColumns;
    if (dataType === "leads") return overview.leadColumns;
    const fields = (catalogue.data?.columns ?? []).filter((c) => !groupByOrder || !c.perItem);
    return [...fields.map((c) => ({ key: c.key, label: c.label })), ...customFields];
  }, [dataType, overview, catalogue.data, groupByOrder, customFields]);

  const defaultsFor = (type: SheetDataType, language: Lang): Row[] => {
    const all = type === "orders" ? (catalogue.data?.columns ?? []) : type === "lost_orders" ? overview.lostColumns : overview.leadColumns;
    const keys = type === "orders" ? (catalogue.data?.defaults.order ?? []) : type === "lost_orders" ? LOST_DEFAULTS : LEAD_DEFAULTS;
    return keys.flatMap((key) => {
      const option = all.find((c) => c.key === key);
      return option ? [{ header: option.label[language], key, fixed: "" }] : [];
    });
  };

  // A new sheet gets the default columns once the order fields have loaded.
  useEffect(() => {
    if (!open || seeded || (dataType === "orders" && !catalogue.data)) return;
    setRows(defaultsFor(dataType, lang));
    setSeeded(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, seeded, catalogue.data, dataType]);

  const labelOf = (row: Row, i: number) => row.header || `${t.header} ${i + 1}`;
  const set = (i: number, patch: Partial<Row>) => setRows((list) => list.map((r, j) => (j === i ? { ...r, ...patch } : r)));
  const move = (i: number, by: number) =>
    setRows((list) => {
      const next = [...list];
      const [row] = next.splice(i, 1);
      next.splice(i + by, 0, row);
      return next;
    });

  function pickType(type: SheetDataType) {
    if (type === dataType) return;
    setDataType(type);
    setSeeded(false);
  }

  async function save() {
    const columns: SheetColumn[] = rows
      .filter((r) => r.header.trim())
      .map((r) => (r.key ? { header: r.header.trim(), key: r.key } : { header: r.header.trim(), fixed: r.fixed }));
    if (!name.trim()) return setError(t.needName);
    if (columns.length === 0) return setError(t.needColumns);
    const reuse = connection ? "" : existing.trim();
    if (reuse && !isSpreadsheetRef(reuse)) return;
    const filter = {
      ...(dataType !== "leads" ? { productIds } : {}),
      ...(dataType !== "lost_orders" ? { funnelIds } : {}),
    };
    setBusy(true);
    setError(null);
    try {
      const body = { name: name.trim(), filter, columns, lang, ...(dataType === "orders" ? { groupByOrder } : {}) };
      const saved = connection ? await googleSheetsUpdate(apiClient, workspaceId, connection.id, body) : await googleSheetsCreate(apiClient, workspaceId, { ...body, dataType, ...(reuse ? { spreadsheetId: reuse } : {}) });
      onSaved(saved, !connection);
    } catch (err) {
      setError(errorMessage(err, sheetErrors));
    } finally {
      setBusy(false);
    }
  }

  const types: { value: SheetDataType; label: string; hint: string }[] = [
    { value: "orders", label: t.orders, hint: t.ordersHint },
    { value: "lost_orders", label: t.lost, hint: t.lostHint },
    { value: "leads", label: t.leads, hint: t.leadsHint },
  ];

  return (
    <Dialog open={open} onOpenChange={(next) => !next && !busy && onClose()}>
      <DialogContent showCloseButton={false} className="flex max-h-[90vh] flex-col gap-4 sm:max-w-2xl">
        <DialogHeader className="flex-row items-start justify-between gap-2">
          <div className="space-y-1">
            <DialogTitle>{connection ? fmt(t.editTitle, { name: connection.name }) : t.newTitle}</DialogTitle>
            {!connection && <DialogDescription>{t.intro}</DialogDescription>}
          </div>
          <DialogClose render={<Button type="button" size="icon-sm" className="pointer-coarse:size-11" variant="ghost" aria-label={t.close} title={t.close} />}>
            <IconClose className="size-4" aria-hidden />
          </DialogClose>
        </DialogHeader>

        <div className="-mx-6 min-h-0 space-y-5 overflow-y-auto px-6 pb-1">
          <div className="space-y-1.5">
            <Label htmlFor="sheet-name">{t.name}</Label>
            <Input id="sheet-name" dir="auto" maxLength={80} value={name} placeholder={t.namePlaceholder} onChange={(e) => setName(e.target.value)} />
          </div>

          {!connection && <ExistingSpreadsheetField value={existing} onChange={setExisting} />}

          {!connection && (
            <fieldset className="space-y-2">
              <legend className="mb-1 text-sm font-medium text-ink">{t.carries}</legend>
              <div className="grid gap-2 sm:grid-cols-3">
                {types.map((type) => (
                  <label
                    key={type.value}
                    className="flex cursor-pointer gap-2 rounded-lg border border-line p-3 text-sm has-[:checked]:border-primary has-[:checked]:bg-primary-soft"
                  >
                    <input type="radio" name="sheet-type" className="mt-0.5 accent-primary" checked={dataType === type.value} onChange={() => pickType(type.value)} />
                    <span>
                      <span className="block font-medium text-ink">{type.label}</span>
                      <span className="mt-0.5 block text-xs text-ink-soft">{type.hint}</span>
                    </span>
                  </label>
                ))}
              </div>
            </fieldset>
          )}

          <div className="space-y-1.5 sm:max-w-xs">
            <Label htmlFor="sheet-lang">{t.lang}</Label>
            <Select id="sheet-lang" value={lang} onChange={(e) => setLang(e.target.value as Lang)}>
              <option value="ar">{t.arabic}</option>
              <option value="en">{t.english}</option>
            </Select>
          </div>

          {dataType === "orders" && (
            <label className="flex cursor-pointer items-start gap-2 text-sm text-ink">
              <input type="checkbox" className="mt-0.5 size-4 accent-primary" checked={groupByOrder} onChange={(e) => setGroupByOrder(e.target.checked)} />
              <span>
                <span className="block font-medium">{t.group}</span>
                <span className="block text-xs text-ink-soft">{groupByOrder ? t.groupOn : t.groupOff}</span>
              </span>
            </label>
          )}

          <fieldset className="space-y-2">
            <legend className="text-sm font-medium text-ink">{t.columns}</legend>
            <p className="text-xs text-ink-soft">{t.columnsHint}</p>
            {dataType === "orders" && catalogue.loading ? (
              <p className="text-sm text-ink-soft">{t.loading}</p>
            ) : (
              <>
                <ol className="space-y-2">
                  {rows.map((row, i) => (
                    <li key={i} className="grid gap-2 rounded-lg border border-line p-2 sm:grid-cols-[1fr_1fr_auto]">
                      <Input dir="auto" maxLength={80} aria-label={`${t.header} ${i + 1}`} placeholder={t.header} value={row.header} onChange={(e) => set(i, { header: e.target.value })} />
                      <div className="space-y-1">
                        <Select aria-label={`${t.source} — ${labelOf(row, i)}`} value={row.key} onChange={(e) => set(i, { key: e.target.value })}>
                          <option value="">{t.fixed}</option>
                          {row.key && !options.some((o) => o.key === row.key) && <option value={row.key}>{row.key}</option>}
                          {options.map((c) => (
                            <option key={c.key} value={c.key}>
                              {c.label[locale === "ar" ? "ar" : "en"]}
                            </option>
                          ))}
                        </Select>
                        {!row.key && (
                          <Input dir="auto" maxLength={200} aria-label={`${t.fixedValue} — ${labelOf(row, i)}`} placeholder={t.fixedValue} value={row.fixed} onChange={(e) => set(i, { fixed: e.target.value })} />
                        )}
                      </div>
                      <div className="flex items-start gap-0.5">
                        <Button type="button" size="icon-sm" className="pointer-coarse:size-11" variant="ghost" aria-label={fmt(t.moveUp, { name: labelOf(row, i) })} disabled={i === 0} onClick={() => move(i, -1)}>
                          <IconArrowUp className="size-4" aria-hidden />
                        </Button>
                        <Button type="button" size="icon-sm" className="pointer-coarse:size-11" variant="ghost" aria-label={fmt(t.moveDown, { name: labelOf(row, i) })} disabled={i === rows.length - 1} onClick={() => move(i, 1)}>
                          <IconArrowDown className="size-4" aria-hidden />
                        </Button>
                        <Button type="button" size="icon-sm" className="pointer-coarse:size-11" variant="ghost" aria-label={fmt(t.remove, { name: labelOf(row, i) })} onClick={() => setRows((list) => list.filter((_, j) => j !== i))}>
                          <IconDelete className="size-4 text-danger" aria-hidden />
                        </Button>
                      </div>
                    </li>
                  ))}
                </ol>
                <div className="flex flex-wrap gap-2">
                  <Button type="button" size="sm" className="pointer-coarse:min-h-11" variant="ghost" disabled={rows.length >= 60} onClick={() => setRows((list) => [...list, { header: "", key: "", fixed: "" }])}>
                    <IconPlus className="size-4" aria-hidden />
                    {t.add}
                  </Button>
                  <Button type="button" size="sm" className="pointer-coarse:min-h-11" variant="ghost" onClick={() => setRows(defaultsFor(dataType, lang))}>
                    {t.defaults}
                  </Button>
                </div>
              </>
            )}
          </fieldset>

          {dataType !== "leads" && (
            <ProductChecklist
              label={dataType === "orders" ? t.products : t.productsLost}
              hint={t.filterHint}
              products={products.data ?? []}
              value={productIds}
              onChange={setProductIds}
              max={200}
            />
          )}
          {dataType !== "lost_orders" && (
            <NameChecklist
              label={t.funnels}
              hint={t.filterHint}
              searchLabel={t.funnelSearch}
              emptyLabel={t.noFunnels}
              selectedLabel={t.selected}
              items={(funnels.data ?? []).map((f) => ({ id: f.id, name: f.name }))}
              value={funnelIds}
              onChange={setFunnelIds}
            />
          )}

          {error && <Alert variant="danger">{error}</Alert>}
        </div>

        <div className="flex flex-wrap justify-end gap-2 border-t border-line pt-3">
          <Button className="min-h-11" type="button" variant="outline" disabled={busy} onClick={onClose}>
            {t.close}
          </Button>
          <Button className="min-h-11" type="button" disabled={busy || (dataType === "orders" && catalogue.loading)} onClick={() => void save()}>
            {busy ? t.saving : connection ? t.save : t.create}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

/** A searchable list of checkboxes, for the funnels filter. */
function NameChecklist({
  label,
  hint,
  searchLabel,
  emptyLabel,
  selectedLabel,
  items,
  value,
  onChange,
}: {
  label: string;
  hint: string;
  searchLabel: string;
  emptyLabel: string;
  selectedLabel: string;
  items: { id: string; name: string }[];
  value: string[];
  onChange: (ids: string[]) => void;
}) {
  const [search, setSearch] = useState("");
  const q = search.trim().toLowerCase();
  const shown = items.filter((item) => !q || item.name.toLowerCase().includes(q));
  return (
    <fieldset className="space-y-1.5">
      <legend className="text-sm font-medium text-ink">
        {label}
        {value.length > 0 && <span className="ms-2 text-xs font-normal text-ink-soft">{fmt(selectedLabel, { count: value.length })}</span>}
      </legend>
      <p className="text-xs text-ink-soft">{hint}</p>
      <Input aria-label={searchLabel} placeholder={searchLabel} value={search} onChange={(e) => setSearch(e.target.value)} />
      <ul className="max-h-44 divide-y divide-line overflow-y-auto rounded-[0.5rem] border border-line">
        {shown.length === 0 && <li className="px-3 py-2 text-sm text-ink-soft">{emptyLabel}</li>}
        {shown.map((item) => {
          const checked = value.includes(item.id);
          return (
            <li key={item.id}>
              <label className="flex min-h-10 cursor-pointer items-center gap-3 px-3 py-1.5 text-sm text-ink hover:bg-paper">
                <input
                  type="checkbox"
                  className="size-4 accent-primary"
                  checked={checked}
                  onChange={() => onChange(checked ? value.filter((x) => x !== item.id) : [...value, item.id])}
                />
                <span className="min-w-0 truncate">{item.name}</span>
              </label>
            </li>
          );
        })}
      </ul>
    </fieldset>
  );
}
