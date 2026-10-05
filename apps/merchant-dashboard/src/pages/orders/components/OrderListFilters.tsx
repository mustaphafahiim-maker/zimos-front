import { useId, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { ArrowDown, ArrowUp, Columns3, Filter, X } from "lucide-react";
import { Button, Input, cn } from "@store-builder/ui";
import { ORDER_SOURCES, funnelsList, ordersListTags, type OrderListFilters, type OrderSource } from "@store-builder/api-client";
import { apiClient } from "@/lib/apiClient";
import { useWorkspaceId } from "@/lib/useWorkspaceId";
import { useAsync } from "@/lib/useAsync";
import { fmt, useT, type Messages } from "@/i18n/LocaleContext";
import { Select } from "@/components/Select";
import { Modal } from "@/components/Modal";
import { useOrderLabels } from "../orderLabels";
import { useSavedOrderViews } from "./useSavedOrderViews";

const STRINGS = {
  en: {
    filters: "Filters",
    filtersCount: "Filters ({count})",
    clearAll: "Clear filters",
    any: "Any",
    tag: "Tag",
    source: "Source",
    payment: "Payment method",
    governorate: "Governorate",
    governoratePlaceholder: "e.g. Cairo",
    carrier: "Courier",
    carrierPlaceholder: "Courier name",
    seen: "Seen",
    seen_true: "Seen",
    seen_false: "Not seen yet",
    test: "Test orders",
    test_true: "Only test orders",
    test_false: "Hide test orders",
    archived: "Archive",
    archived_exclude: "Hide archived",
    archived_only: "Archived only",
    archived_include: "Include archived",
    source_store: "Store",
    source_funnel: "Funnel",
    source_manual: "Manual",
    source_api: "API",
    source_import: "Import",
    source_upsell: "Upsell",
    remove: "Remove filter {name}",
    perPage: "Per page",
    columns: "Columns",
    columnsTitle: "Choose columns",
    columnsHint: "Tick the columns to show and move them into the order you want. Saved on this device for your account.",
    done: "Done",
    col_customer: "Customer",
    col_products: "Products",
    col_total: "Total",
    col_payment: "Payment",
    col_stage: "Stage",
    col_timeline: "Placed / confirmed",
    col_tags: "Tags",
    col_source: "Source",
    col_governorate: "Governorate",
    col_address: "Address",
    col_shipping: "Shipping",
    col_ipCountry: "IP country",
    col_dataQuality: "Data quality",
    moveUp: "Move {name} up",
    moveDown: "Move {name} down",
    views: "Saved views",
    viewsNone: "Saved views",
    saveView: "Save this view…",
    saveTitle: "Save this view",
    saveHint: "Keeps the current tab, search, dates, filters and sort under a name.",
    viewName: "Name",
    viewNamePlaceholder: "e.g. Cairo, not seen",
    save: "Save",
    cancel: "Cancel",
    deleteView: "Delete “{name}”",
    product: "Product",
    funnel: "Funnel",
    dataQuality: "Data quality",
    dq_good: "Good",
    dq_low: "Poor",
    ipCountry: "IP country",
    ipCountryPlaceholder: "e.g. EG",
    discountCode: "Discount code",
    discountCodePlaceholder: "e.g. SAVE10",
    utmSource: "UTM source",
    utmSourcePlaceholder: "e.g. facebook",
    utmCampaign: "UTM campaign",
    utmCampaignPlaceholder: "Campaign name",
  },
  ar: {
    filters: "الفلاتر",
    filtersCount: "الفلاتر ({count})",
    clearAll: "مسح الفلاتر",
    any: "الكل",
    tag: "التاج",
    source: "المصدر",
    payment: "طريقة الدفع",
    governorate: "المحافظة",
    governoratePlaceholder: "مثلًا Cairo",
    carrier: "شركة الشحن",
    carrierPlaceholder: "اسم شركة الشحن",
    seen: "المشاهدة",
    seen_true: "تمت مشاهدته",
    seen_false: "لم يُشاهد بعد",
    test: "الأوردرات التجريبية",
    test_true: "التجريبية فقط",
    test_false: "إخفاء التجريبية",
    archived: "الأرشيف",
    archived_exclude: "إخفاء المؤرشفة",
    archived_only: "المؤرشفة فقط",
    archived_include: "إظهار المؤرشفة أيضًا",
    source_store: "المتجر",
    source_funnel: "فانل",
    source_manual: "يدوي",
    source_api: "API",
    source_import: "استيراد",
    source_upsell: "عرض إضافي",
    remove: "إزالة فلتر {name}",
    perPage: "في الصفحة",
    columns: "الأعمدة",
    columnsTitle: "اختيار الأعمدة",
    columnsHint: "اختر الأعمدة الظاهرة ورتّبها كما تريد. تُحفظ على هذا الجهاز لحسابك.",
    done: "تم",
    col_customer: "العميل",
    col_products: "المنتجات",
    col_total: "الإجمالي",
    col_payment: "الدفع",
    col_stage: "المرحلة",
    col_timeline: "الطلب / التأكيد",
    col_tags: "التاجز",
    col_source: "المصدر",
    col_governorate: "المحافظة",
    col_address: "العنوان",
    col_shipping: "الشحن",
    col_ipCountry: "دولة الـ IP",
    col_dataQuality: "جودة البيانات",
    moveUp: "تحريك {name} لأعلى",
    moveDown: "تحريك {name} لأسفل",
    views: "العروض المحفوظة",
    viewsNone: "العروض المحفوظة",
    saveView: "حفظ هذا العرض…",
    saveTitle: "حفظ هذا العرض",
    saveHint: "يحفظ التبويب والبحث والتواريخ والفلاتر والترتيب الحالية باسم.",
    viewName: "الاسم",
    viewNamePlaceholder: "مثلًا: القاهرة، غير مشاهَد",
    save: "حفظ",
    cancel: "إلغاء",
    deleteView: "حذف «{name}»",
    product: "المنتج",
    funnel: "الفانل",
    dataQuality: "جودة البيانات",
    dq_good: "جيدة",
    dq_low: "ضعيفة",
    ipCountry: "دولة الـ IP",
    ipCountryPlaceholder: "مثلًا EG",
    discountCode: "كود الخصم",
    discountCodePlaceholder: "مثلًا SAVE10",
    utmSource: "مصدر UTM",
    utmSourcePlaceholder: "مثلًا facebook",
    utmCampaign: "حملة UTM",
    utmCampaignPlaceholder: "اسم الحملة",
  },
} satisfies Messages;

// ---------------------------------------------------------------- filters --

const FILTER_KEYS = [
  "tag",
  "source",
  "paymentMethod",
  "governorate",
  "carrier",
  "seen",
  "test",
  "archived",
  "productId",
  "funnelId",
  "dataQuality",
  "ipCountry",
  "discountCode",
  "utmSource",
  "utmCampaign",
] as const;
type FilterKey = (typeof FILTER_KEYS)[number];
const PAYMENT_METHODS = ["cod", "card", "wallet", "valu", "kiosk", "bank_transfer"] as const;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * The list's SPEC §4.3 filters, kept in the URL next to stage / q / from / to
 * so a filtered list can be shared, saved as a view and survives a refresh.
 * Anything malformed in a hand-edited URL is dropped, never sent.
 */
export function useOrderExtraFilters() {
  const [params, setParams] = useSearchParams();

  const values = useMemo(() => {
    const text = (key: string, max: number) => (params.get(key) ?? "").trim().slice(0, max);
    const oneOf = <T extends string>(key: string, allowed: readonly T[]): T | "" => {
      const v = params.get(key);
      return v !== null && (allowed as readonly string[]).includes(v) ? (v as T) : "";
    };
    const matching = (key: string, pattern: RegExp) => {
      const v = (params.get(key) ?? "").trim();
      return pattern.test(v) ? v : "";
    };
    return {
      tag: text("tag", 40),
      source: oneOf("source", ORDER_SOURCES),
      paymentMethod: oneOf("paymentMethod", PAYMENT_METHODS),
      governorate: text("governorate", 100),
      carrier: text("carrier", 100),
      seen: oneOf("seen", ["true", "false"] as const),
      test: oneOf("test", ["true", "false"] as const),
      archived: oneOf("archived", ["only", "include"] as const),
      productId: matching("productId", UUID),
      funnelId: matching("funnelId", UUID),
      dataQuality: oneOf("dataQuality", ["good", "low"] as const),
      ipCountry: matching("ipCountry", /^[A-Za-z]{2}$/).toUpperCase(),
      discountCode: text("discountCode", 100),
      utmSource: text("utmSource", 100),
      utmCampaign: text("utmCampaign", 200),
    };
  }, [params]);

  const query: OrderListFilters = useMemo(
    () => ({
      tag: values.tag || undefined,
      source: (values.source || undefined) as OrderSource | undefined,
      paymentMethod: values.paymentMethod || undefined,
      governorate: values.governorate || undefined,
      carrier: values.carrier || undefined,
      seen: values.seen ? values.seen === "true" : undefined,
      test: values.test ? values.test === "true" : undefined,
      archived: values.archived || undefined,
      productId: values.productId || undefined,
      funnelId: values.funnelId || undefined,
      dataQuality: values.dataQuality || undefined,
      ipCountry: values.ipCountry || undefined,
      discountCode: values.discountCode || undefined,
      utmSource: values.utmSource || undefined,
      utmCampaign: values.utmCampaign || undefined,
    }),
    [values]
  );

  function update(patch: Partial<Record<FilterKey, string | null>>) {
    setParams(
      (prev) => {
        const next = new URLSearchParams(prev);
        for (const [key, value] of Object.entries(patch)) {
          if (value) next.set(key, value);
          else next.delete(key);
        }
        return next;
      },
      { replace: true }
    );
  }

  const active = FILTER_KEYS.filter((key) => values[key]);
  return {
    values,
    query,
    /** Stable string of the active filters, for effect dependencies. */
    key: active.map((k) => `${k}=${values[k]}`).join("&"),
    active,
    update,
    clear: () => update(Object.fromEntries(FILTER_KEYS.map((k) => [k, null]))),
  };
}

export type OrderExtraFilters = ReturnType<typeof useOrderExtraFilters>;

// ---------------------------------------------------- columns, page size --

export const OPTIONAL_COLUMNS = [
  "customer",
  "products",
  "total",
  "payment",
  "stage",
  "timeline",
  "tags",
  "source",
  "governorate",
  "address",
  "shipping",
  "ipCountry",
  "dataQuality",
] as const;
export type OrderColumn = (typeof OPTIONAL_COLUMNS)[number];
const DEFAULT_COLUMNS: OrderColumn[] = ["customer", "products", "total", "payment", "stage", "timeline"];
export const PAGE_SIZES = [25, 50, 100] as const;

function readJson<T>(key: string, fallback: T): T {
  try {
    const raw = window.localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}
function writeJson(key: string, value: unknown) {
  try {
    window.localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // Storage blocked: the choice lasts for this page only.
  }
}

/** Which columns the table shows and how many rows a page holds, per workspace on this device. */
export function useOrderListPrefs() {
  const workspaceId = useWorkspaceId();
  const columnsKey = `zimos.orders.columns.${workspaceId}`;
  const sizeKey = `zimos.orders.pageSize.${workspaceId}`;
  const [columns, setColumnsState] = useState<OrderColumn[]>(() =>
    readJson<OrderColumn[]>(columnsKey, DEFAULT_COLUMNS).filter((c) => OPTIONAL_COLUMNS.includes(c))
  );
  const [pageSize, setPageSizeState] = useState<number>(() => {
    const stored = readJson<number>(sizeKey, 50);
    return (PAGE_SIZES as readonly number[]).includes(stored) ? stored : 50;
  });
  return {
    columns,
    setColumns: (next: OrderColumn[]) => {
      // In the merchant's order (the chooser moves them); unknown ones dropped.
      const ordered = next.filter((c, i) => OPTIONAL_COLUMNS.includes(c) && next.indexOf(c) === i);
      setColumnsState(ordered);
      writeJson(columnsKey, ordered);
    },
    pageSize,
    setPageSize: (next: number) => {
      setPageSizeState(next);
      writeJson(sizeKey, next);
    },
  };
}

export type OrderListPrefs = ReturnType<typeof useOrderListPrefs>;

// ------------------------------------------------------------ saved views --

// Per teammate, on the server (useSavedOrderViews.ts).
const useSavedViews = useSavedOrderViews;

// -------------------------------------------------------------------- bar --

export function useColumnLabel() {
  const t = useT(STRINGS);
  return (column: OrderColumn) => t[`col_${column}`];
}

export function useSourceLabel() {
  const t = useT(STRINGS);
  return (source: OrderSource) => t[`source_${source}`];
}

/**
 * The row under the search box: Filters (a panel of the SPEC §4.3 filters),
 * the active filters as removable chips, saved views, the column chooser and
 * the page size.
 */
export function OrderFilterBar({ filters, prefs }: { filters: OrderExtraFilters; prefs: OrderListPrefs }) {
  const t = useT(STRINGS);
  const labels = useOrderLabels();
  const workspaceId = useWorkspaceId();
  const [params, setParams] = useSearchParams();
  const [open, setOpen] = useState(filters.active.length > 0);
  const [choosingColumns, setChoosingColumns] = useState(false);
  const [savingView, setSavingView] = useState(false);
  const [viewName, setViewName] = useState("");
  const saved = useSavedViews();
  const tags = useAsync(() => ordersListTags(apiClient, workspaceId), [workspaceId]);
  // For the product and funnel pickers and their chips; a failure leaves the picker with what is in the URL.
  const products = useAsync(
    () => apiClient.listProducts(workspaceId, { limit: 100 }).then((r) => r.products.map((p) => ({ id: p.id, name: p.name }))),
    [workspaceId]
  );
  const funnels = useAsync(() => funnelsList(apiClient, workspaceId).then((list) => list.map((f) => ({ id: f.id, name: f.name }))), [workspaceId]);
  const productName = (id: string) => (products.data ?? []).find((p) => p.id === id)?.name ?? id.slice(0, 8);
  const funnelName = (id: string) => (funnels.data ?? []).find((f) => f.id === id)?.name ?? id.slice(0, 8);
  const ids = { size: useId(), views: useId(), tag: useId(), source: useId(), pay: useId(), gov: useId(), carrier: useId(), seen: useId(), test: useId(), arch: useId(), name: useId(), product: useId(), funnel: useId(), dq: useId(), ip: useId(), code: useId(), utmS: useId(), utmC: useId() };
  const { values, update } = filters;

  const chipText: Record<FilterKey, () => string> = {
    tag: () => `${t.tag}: ${values.tag}`,
    source: () => `${t.source}: ${values.source ? t[`source_${values.source}`] : ""}`,
    paymentMethod: () => `${t.payment}: ${values.paymentMethod ? labels.paymentMethod(values.paymentMethod) : ""}`,
    governorate: () => `${t.governorate}: ${values.governorate}`,
    carrier: () => `${t.carrier}: ${values.carrier}`,
    seen: () => (values.seen === "true" ? t.seen_true : t.seen_false),
    test: () => (values.test === "true" ? t.test_true : t.test_false),
    archived: () => (values.archived === "only" ? t.archived_only : t.archived_include),
    productId: () => `${t.product}: ${productName(values.productId)}`,
    funnelId: () => `${t.funnel}: ${funnelName(values.funnelId)}`,
    dataQuality: () => `${t.dataQuality}: ${values.dataQuality === "low" ? t.dq_low : t.dq_good}`,
    ipCountry: () => `${t.ipCountry}: ${values.ipCountry}`,
    discountCode: () => `${t.discountCode}: ${values.discountCode}`,
    utmSource: () => `${t.utmSource}: ${values.utmSource}`,
    utmCampaign: () => `${t.utmCampaign}: ${values.utmCampaign}`,
  };

  const currentQuery = params.toString();
  const currentView = saved.views.find((v) => v.query === currentQuery)?.name ?? "";
  const label = "mb-1 block text-xs text-ink-soft";

  return (
    <div className="mb-4">
      <div className="flex flex-wrap items-center gap-2">
        <Button
          variant="outline"
          size="sm"
          className="min-h-11 gap-1.5"
          aria-expanded={open}
          onClick={() => setOpen((v) => !v)}
        >
          <Filter className="size-4" aria-hidden />
          {filters.active.length ? fmt(t.filtersCount, { count: filters.active.length }) : t.filters}
        </Button>

        {filters.active.map((key) => (
          <span
            key={key}
            className="inline-flex items-center gap-1 rounded-full border border-primary/30 bg-primary-soft py-0.5 ps-2.5 pe-1 text-sm text-primary-dark dark:text-primary"
          >
            {chipText[key]()}
            <button
              type="button"
              onClick={() => update({ [key]: null })}
              aria-label={fmt(t.remove, { name: chipText[key]() })}
              className="inline-flex size-6 cursor-pointer items-center justify-center rounded-full hover:bg-paper-raised focus-visible:outline-2 focus-visible:outline-primary"
            >
              <X className="size-3.5" aria-hidden />
            </button>
          </span>
        ))}
        {filters.active.length > 0 && (
          <Button variant="ghost" size="sm" className="min-h-11" onClick={filters.clear}>
            {t.clearAll}
          </Button>
        )}

        <div className="ms-auto flex flex-wrap items-center gap-2">
          <label htmlFor={ids.views} className="sr-only">
            {t.views}
          </label>
          <Select
            id={ids.views}
            value={currentView}
            className="h-11 w-auto min-w-40"
            onChange={(e) => {
              const choice = e.target.value;
              if (choice === "__save") {
                setViewName("");
                setSavingView(true);
                return;
              }
              const view = saved.views.find((v) => v.name === choice);
              if (view) setParams(new URLSearchParams(view.query), { replace: true });
            }}
          >
            <option value="">{t.viewsNone}</option>
            {saved.views.map((v) => (
              <option key={v.name} value={v.name}>
                {v.name}
              </option>
            ))}
            <option value="__save">{t.saveView}</option>
          </Select>
          {currentView && (
            <Button
              variant="ghost"
              size="sm"
              className="min-h-11"
              aria-label={fmt(t.deleteView, { name: currentView })}
              title={fmt(t.deleteView, { name: currentView })}
              onClick={() => saved.remove(currentView)}
            >
              <X className="size-4" aria-hidden />
            </Button>
          )}

          <Button variant="outline" size="sm" className="min-h-11 gap-1.5" onClick={() => setChoosingColumns(true)}>
            <Columns3 className="size-4" aria-hidden />
            {t.columns}
          </Button>

          <label htmlFor={ids.size} className="text-sm text-ink-soft">
            {t.perPage}
          </label>
          <Select
            id={ids.size}
            value={prefs.pageSize}
            onChange={(e) => prefs.setPageSize(Number(e.target.value))}
            className="h-11 w-auto"
          >
            {PAGE_SIZES.map((n) => (
              <option key={n} value={n}>
                {n}
              </option>
            ))}
          </Select>
        </div>
      </div>

      {open && (
        <div className="mt-3 grid gap-3 rounded-[var(--radius-card)] border border-line bg-paper-raised p-4 sm:grid-cols-2 lg:grid-cols-4">
          <div>
            <label htmlFor={ids.tag} className={label}>
              {t.tag}
            </label>
            <Select id={ids.tag} value={values.tag} onChange={(e) => update({ tag: e.target.value || null })} className="h-11">
              <option value="">{t.any}</option>
              {values.tag && !(tags.data ?? []).some((x) => x.tag === values.tag) && <option value={values.tag}>{values.tag}</option>}
              {(tags.data ?? []).map((x) => (
                <option key={x.tag} value={x.tag}>
                  {x.tag} ({x.count})
                </option>
              ))}
            </Select>
          </div>
          <div>
            <label htmlFor={ids.source} className={label}>
              {t.source}
            </label>
            <Select id={ids.source} value={values.source} onChange={(e) => update({ source: e.target.value || null })} className="h-11">
              <option value="">{t.any}</option>
              {ORDER_SOURCES.map((s) => (
                <option key={s} value={s}>
                  {t[`source_${s}`]}
                </option>
              ))}
            </Select>
          </div>
          <div>
            <label htmlFor={ids.pay} className={label}>
              {t.payment}
            </label>
            <Select
              id={ids.pay}
              value={values.paymentMethod}
              onChange={(e) => update({ paymentMethod: e.target.value || null })}
              className="h-11"
            >
              <option value="">{t.any}</option>
              {PAYMENT_METHODS.map((m) => (
                <option key={m} value={m}>
                  {labels.paymentMethod(m)}
                </option>
              ))}
            </Select>
          </div>
          <DebouncedText
            id={ids.gov}
            label={t.governorate}
            placeholder={t.governoratePlaceholder}
            value={values.governorate}
            onCommit={(v) => update({ governorate: v || null })}
          />
          <DebouncedText
            id={ids.carrier}
            label={t.carrier}
            placeholder={t.carrierPlaceholder}
            value={values.carrier}
            onCommit={(v) => update({ carrier: v || null })}
          />
          <div>
            <label htmlFor={ids.seen} className={label}>
              {t.seen}
            </label>
            <Select id={ids.seen} value={values.seen} onChange={(e) => update({ seen: e.target.value || null })} className="h-11">
              <option value="">{t.any}</option>
              <option value="false">{t.seen_false}</option>
              <option value="true">{t.seen_true}</option>
            </Select>
          </div>
          <div>
            <label htmlFor={ids.test} className={label}>
              {t.test}
            </label>
            <Select id={ids.test} value={values.test} onChange={(e) => update({ test: e.target.value || null })} className="h-11">
              <option value="">{t.any}</option>
              <option value="false">{t.test_false}</option>
              <option value="true">{t.test_true}</option>
            </Select>
          </div>
          <div>
            <label htmlFor={ids.arch} className={label}>
              {t.archived}
            </label>
            <Select
              id={ids.arch}
              value={values.archived}
              onChange={(e) => update({ archived: e.target.value || null })}
              className="h-11"
            >
              <option value="">{t.archived_exclude}</option>
              <option value="only">{t.archived_only}</option>
              <option value="include">{t.archived_include}</option>
            </Select>
          </div>
          <div>
            <label htmlFor={ids.product} className={label}>
              {t.product}
            </label>
            <Select id={ids.product} value={values.productId} onChange={(e) => update({ productId: e.target.value || null })} className="h-11">
              <option value="">{t.any}</option>
              {values.productId && !(products.data ?? []).some((p) => p.id === values.productId) && (
                <option value={values.productId}>{productName(values.productId)}</option>
              )}
              {(products.data ?? []).map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </Select>
          </div>
          <div>
            <label htmlFor={ids.funnel} className={label}>
              {t.funnel}
            </label>
            <Select id={ids.funnel} value={values.funnelId} onChange={(e) => update({ funnelId: e.target.value || null })} className="h-11">
              <option value="">{t.any}</option>
              {values.funnelId && !(funnels.data ?? []).some((f) => f.id === values.funnelId) && (
                <option value={values.funnelId}>{funnelName(values.funnelId)}</option>
              )}
              {(funnels.data ?? []).map((f) => (
                <option key={f.id} value={f.id}>
                  {f.name}
                </option>
              ))}
            </Select>
          </div>
          <div>
            <label htmlFor={ids.dq} className={label}>
              {t.dataQuality}
            </label>
            <Select id={ids.dq} value={values.dataQuality} onChange={(e) => update({ dataQuality: e.target.value || null })} className="h-11">
              <option value="">{t.any}</option>
              <option value="good">{t.dq_good}</option>
              <option value="low">{t.dq_low}</option>
            </Select>
          </div>
          <DebouncedText
            id={ids.ip}
            label={t.ipCountry}
            placeholder={t.ipCountryPlaceholder}
            value={values.ipCountry}
            onCommit={(v) => update({ ipCountry: /^[A-Za-z]{2}$/.test(v) ? v.toUpperCase() : null })}
          />
          <DebouncedText
            id={ids.code}
            label={t.discountCode}
            placeholder={t.discountCodePlaceholder}
            value={values.discountCode}
            onCommit={(v) => update({ discountCode: v || null })}
          />
          <DebouncedText
            id={ids.utmS}
            label={t.utmSource}
            placeholder={t.utmSourcePlaceholder}
            value={values.utmSource}
            onCommit={(v) => update({ utmSource: v || null })}
          />
          <DebouncedText
            id={ids.utmC}
            label={t.utmCampaign}
            placeholder={t.utmCampaignPlaceholder}
            value={values.utmCampaign}
            onCommit={(v) => update({ utmCampaign: v || null })}
          />
        </div>
      )}

      <Modal
        open={choosingColumns}
        onClose={() => setChoosingColumns(false)}
        title={t.columnsTitle}
        description={t.columnsHint}
        footer={
          <Button className="min-h-11" onClick={() => setChoosingColumns(false)}>
            {t.done}
          </Button>
        }
      >
        <ul className="grid gap-1">
          {/* Shown ones first, in table order (movable), then the rest. */}
          {[...prefs.columns, ...OPTIONAL_COLUMNS.filter((c) => !prefs.columns.includes(c))].map((column) => {
            const checked = prefs.columns.includes(column);
            const at = prefs.columns.indexOf(column);
            const move = (by: number) => {
              const next = [...prefs.columns];
              next.splice(at, 1);
              next.splice(at + by, 0, column);
              prefs.setColumns(next);
            };
            return (
              <li key={column} className="flex items-center gap-1">
                {checked && (
                  <>
                    <Button
                      variant="ghost"
                      size="icon-sm"
                      className="size-11"
                      disabled={at === 0}
                      aria-label={fmt(t.moveUp, { name: t[`col_${column}`] })}
                      onClick={() => move(-1)}
                    >
                      <ArrowUp className="size-4" aria-hidden />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon-sm"
                      className="size-11"
                      disabled={at === prefs.columns.length - 1}
                      aria-label={fmt(t.moveDown, { name: t[`col_${column}`] })}
                      onClick={() => move(1)}
                    >
                      <ArrowDown className="size-4" aria-hidden />
                    </Button>
                  </>
                )}
                <label className={cn("flex min-h-11 flex-1 cursor-pointer items-center gap-2 text-sm text-ink", !checked && "ps-[5.75rem]")}>
                  <input
                    type="checkbox"
                    className="size-4 accent-primary"
                    checked={checked}
                    onChange={() =>
                      prefs.setColumns(checked ? prefs.columns.filter((c) => c !== column) : [...prefs.columns, column])
                    }
                  />
                  {t[`col_${column}`]}
                </label>
              </li>
            );
          })}
        </ul>
      </Modal>

      <Modal open={savingView} onClose={() => setSavingView(false)} title={t.saveTitle} description={t.saveHint}>
        <form
          className="space-y-4"
          onSubmit={(e) => {
            e.preventDefault();
            const name = viewName.trim();
            if (!name) return;
            saved.save(name, currentQuery);
            setSavingView(false);
          }}
        >
          <div>
            <label htmlFor={ids.name} className={label}>
              {t.viewName}
            </label>
            <Input
              id={ids.name}
              value={viewName}
              maxLength={40}
              autoFocus
              placeholder={t.viewNamePlaceholder}
              onChange={(e) => setViewName(e.target.value)}
              className="h-11"
            />
          </div>
          <div className="flex justify-end gap-3">
            <Button type="button" variant="outline" className="min-h-11" onClick={() => setSavingView(false)}>
              {t.cancel}
            </Button>
            <Button type="submit" className="min-h-11" disabled={!viewName.trim()}>
              {t.save}
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}

/** A text filter that reaches the URL when the merchant stops typing or leaves the field. */
function DebouncedText({
  id,
  label,
  placeholder,
  value,
  onCommit,
}: {
  id: string;
  label: string;
  placeholder: string;
  value: string;
  onCommit: (value: string) => void;
}) {
  const [draft, setDraft] = useState(value);
  const [synced, setSynced] = useState(value);
  if (value !== synced) {
    setSynced(value);
    if (draft.trim() !== value) setDraft(value);
  }
  const commit = () => {
    if (draft.trim() !== value) onCommit(draft.trim());
  };
  return (
    <div>
      <label htmlFor={id} className={cn("mb-1 block text-xs text-ink-soft")}>
        {label}
      </label>
      <Input
        id={id}
        value={draft}
        maxLength={100}
        placeholder={placeholder}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={commit}
        onKeyDown={(e) => {
          if (e.key === "Enter") commit();
        }}
        className="h-11"
      />
    </div>
  );
}
