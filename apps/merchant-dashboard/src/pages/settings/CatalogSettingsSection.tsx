import { useEffect, useId, useMemo, useState } from "react";
import { ArrowDown, ArrowUp } from "lucide-react";
import { Alert, Button, cn } from "@store-builder/ui";
import {
  ApiError,
  DEFAULT_CATALOG_SETTINGS,
  type CatalogDefaultSort,
  type CatalogFilter,
  type StorefrontCatalogSettings,
} from "@store-builder/api-client";
import { apiClient } from "@/lib/apiClient";
import { useWorkspaceId } from "@/lib/useWorkspaceId";
import { useAsync } from "@/lib/useAsync";
import { useErrorMessage } from "@/lib/errorMessages";
import { useWorkspace } from "@/context/WorkspaceContext";
import { fmt, useT, type Messages } from "@/i18n/LocaleContext";
import { Select } from "@/components/Select";
import { useToast } from "@/components/Toast";

/**
 * Role keys that can change it: the PATCH needs website.edit — the same
 * roles the checkout-fields card lets edit (see CheckoutSettingsSection).
 */
const EDITOR_ROLES: ReadonlySet<string> = new Set(["owner", "workspace_manager", "editor"]);

const SORTS: readonly CatalogDefaultSort[] = ["newest", "price_asc", "price_desc", "name", "position"];

const STRINGS = {
  en: {
    title: "Product listing in the store",
    description:
      "How shoppers browse your products on the storefront's product and collection pages: the filter sidebar, which filters it shows and in what order, and how products are sorted at first.",
    sidebar: "Show the filter sidebar",
    sidebarHint: "On phones it opens as a panel from the “Filter” button.",
    defaultSort: "Sort products by default by",
    sort_newest: "Newest first",
    sort_price_asc: "Price: low to high",
    sort_price_desc: "Price: high to low",
    sort_name: "Name",
    sort_position: "Featured (your collection order)",
    filters: "Filters in the sidebar",
    filtersHint: "Tick the filters to show; the arrows set their order.",
    filter_collections: "Collections",
    filter_price: "Price",
    filter_tags: "Tags",
    filter_options: "All product options",
    filter_optionsHint: "Every option your products use, such as size and colour.",
    filter_option: "Option: {name}",
    moveUp: "Move {name} up",
    moveDown: "Move {name} down",
    noOptions: "Options appear here once your products have variants with options such as size or colour.",
    readOnly: "Only the store owner, a workspace manager or an editor can change the product listing.",
    save: "Save listing settings",
    saving: "Saving…",
    reset: "Discard changes",
    saved: "Listing settings saved.",
  },
  ar: {
    title: "عرض المنتجات في المتجر",
    description:
      "طريقة تصفّح العملاء لمنتجاتك في صفحات المنتجات والمجموعات بالمتجر: الشريط الجانبي للتصفية، والمرشحات التي يعرضها وترتيبها، وترتيب المنتجات عند الفتح.",
    sidebar: "إظهار الشريط الجانبي للتصفية",
    sidebarHint: "على الهاتف يُفتح كلوحة من زر «تصفية».",
    defaultSort: "ترتيب المنتجات افتراضيًا حسب",
    sort_newest: "الأحدث أولًا",
    sort_price_asc: "السعر: من الأقل إلى الأعلى",
    sort_price_desc: "السعر: من الأعلى إلى الأقل",
    sort_name: "الاسم",
    sort_position: "المميزة (ترتيبك داخل المجموعة)",
    filters: "المرشحات في الشريط الجانبي",
    filtersHint: "حدّد المرشحات التي تظهر، واستخدم الأسهم لترتيبها.",
    filter_collections: "المجموعات",
    filter_price: "السعر",
    filter_tags: "الوسوم",
    filter_options: "كل خيارات المنتجات",
    filter_optionsHint: "كل خيار تستخدمه منتجاتك، مثل المقاس واللون.",
    filter_option: "الخيار: {name}",
    moveUp: "تحريك {name} لأعلى",
    moveDown: "تحريك {name} لأسفل",
    noOptions: "تظهر الخيارات هنا بعد إضافة متغيرات لمنتجاتك بخيارات مثل المقاس أو اللون.",
    readOnly: "يمكن لمالك المتجر أو مدير مساحة العمل أو المحرر فقط تغيير طريقة عرض المنتجات.",
    save: "حفظ إعدادات العرض",
    saving: "جارٍ الحفظ…",
    reset: "تجاهل التغييرات",
    saved: "تم حفظ إعدادات العرض.",
  },
} satisfies Messages;

/** One row of the filter list: a filter and whether it is shown. */
interface Row {
  filter: CatalogFilter;
  enabled: boolean;
}

const keyOf = (f: CatalogFilter) => (f.key === "option" ? `option:${f.name}` : f.key);

function readSettings(raw: unknown): StorefrontCatalogSettings {
  const value = raw && typeof raw === "object" ? (raw as Partial<StorefrontCatalogSettings>) : {};
  return {
    sidebar_enabled: typeof value.sidebar_enabled === "boolean" ? value.sidebar_enabled : DEFAULT_CATALOG_SETTINGS.sidebar_enabled,
    default_sort: SORTS.includes(value.default_sort as CatalogDefaultSort)
      ? (value.default_sort as CatalogDefaultSort)
      : DEFAULT_CATALOG_SETTINGS.default_sort,
    filters: Array.isArray(value.filters) ? value.filters : DEFAULT_CATALOG_SETTINGS.filters,
  };
}

/** The shown filters in their order, then every other one the store could show. */
function toRows(settings: StorefrontCatalogSettings, optionNames: string[]): Row[] {
  const all: CatalogFilter[] = [
    { key: "collections" },
    { key: "price" },
    { key: "options" },
    { key: "tags" },
    ...optionNames.map((name) => ({ key: "option" as const, name })),
  ];
  const enabled = settings.filters.filter((f) => all.some((a) => keyOf(a) === keyOf(f)) || f.key === "option");
  const shown = new Set(enabled.map(keyOf));
  return [
    ...enabled.map((filter) => ({ filter, enabled: true })),
    ...all.filter((f) => !shown.has(keyOf(f))).map((filter) => ({ filter, enabled: false })),
  ];
}

export function CatalogSettingsSection() {
  const t = useT(STRINGS);
  const workspaceId = useWorkspaceId();
  const toast = useToast();
  const errorMessage = useErrorMessage();
  const { currentWorkspace, applySavedWorkspace } = useWorkspace();
  const sortId = useId();
  const sidebarId = useId();
  const optionNames = useAsync(() => apiClient.listCatalogOptionNames(workspaceId), [workspaceId]);

  const stored = useMemo(
    () => readSettings(currentWorkspace?.settings?.storefront_catalog),
    [currentWorkspace?.settings?.storefront_catalog]
  );
  const names = useMemo(() => (optionNames.data ?? []).map((o) => o.name), [optionNames.data]);
  const [saved, setSaved] = useState(stored);
  const [sidebar, setSidebar] = useState(stored.sidebar_enabled);
  const [sort, setSort] = useState<CatalogDefaultSort>(stored.default_sort);
  const [rows, setRows] = useState<Row[]>(() => toRows(stored, []));
  const [forbidden, setForbidden] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Option names arrive after the first render: add them to the list without undoing edits.
  useEffect(() => {
    setRows((current) => {
      const present = new Set(current.map((r) => keyOf(r.filter)));
      const extra = names.filter((n) => !present.has(`option:${n}`)).map((name) => ({
        filter: { key: "option" as const, name },
        enabled: false,
      }));
      return extra.length > 0 ? [...current, ...extra] : current;
    });
  }, [names]);

  const editable = EDITOR_ROLES.has(currentWorkspace?.role ?? "") && !forbidden;
  const draft: StorefrontCatalogSettings = {
    sidebar_enabled: sidebar,
    default_sort: sort,
    filters: rows.filter((r) => r.enabled).map((r) => r.filter),
  };
  const dirty = JSON.stringify(draft) !== JSON.stringify(saved);

  const label = (f: CatalogFilter) => (f.key === "option" ? fmt(t.filter_option, { name: f.name }) : t[`filter_${f.key}`]);

  function move(index: number, to: number) {
    setRows((current) => {
      if (to < 0 || to >= current.length) return current;
      const next = [...current];
      const [row] = next.splice(index, 1);
      next.splice(to, 0, row);
      return next;
    });
  }

  function reset() {
    setSidebar(saved.sidebar_enabled);
    setSort(saved.default_sort);
    setRows(toRows(saved, names));
    setError(null);
  }

  async function save() {
    setSaving(true);
    setError(null);
    try {
      const workspace = await apiClient.updateWorkspace(workspaceId, { settings: { storefront_catalog: draft } });
      const next = readSettings(workspace.settings?.storefront_catalog);
      setSaved(next);
      setRows(toRows(next, names));
      applySavedWorkspace(workspace);
      toast.success(t.saved);
    } catch (err) {
      if (err instanceof ApiError && err.status === 403) {
        setForbidden(true);
        reset();
      } else {
        setError(errorMessage(err));
      }
    } finally {
      setSaving(false);
    }
  }

  return (
    <section className="rounded-[var(--radius-card)] border border-line p-5">
      <h2 className="font-display text-lg font-medium text-ink">{t.title}</h2>
      <p className="mt-1 text-sm text-ink-soft">{t.description}</p>

      <div className="mt-4 space-y-5">
        {!editable && <Alert>{t.readOnly}</Alert>}

        <label htmlFor={sidebarId} className="flex min-h-11 cursor-pointer items-start gap-3">
          <input
            id={sidebarId}
            type="checkbox"
            className="mt-1 size-4 shrink-0 accent-primary"
            checked={sidebar}
            disabled={!editable || saving}
            onChange={(e) => setSidebar(e.target.checked)}
          />
          <span>
            <span className="block text-sm font-medium text-ink">{t.sidebar}</span>
            <span className="block text-sm text-ink-soft">{t.sidebarHint}</span>
          </span>
        </label>

        <div className="space-y-1.5">
          <label htmlFor={sortId} className="text-sm font-medium text-ink">
            {t.defaultSort}
          </label>
          <Select
            id={sortId}
            value={sort}
            disabled={!editable || saving}
            onChange={(e) => setSort(e.target.value as CatalogDefaultSort)}
            className="h-11 w-full sm:w-auto sm:min-w-64"
          >
            {SORTS.map((key) => (
              <option key={key} value={key}>
                {t[`sort_${key}`]}
              </option>
            ))}
          </Select>
        </div>

        <fieldset className={cn("space-y-2", !sidebar && "opacity-70")} disabled={!editable || saving}>
          <legend className="text-sm font-medium text-ink">{t.filters}</legend>
          <p className="text-sm text-ink-soft">{t.filtersHint}</p>
          <ul className="divide-y divide-line rounded-[0.5rem] border border-line">
            {rows.map((row, index) => {
              const name = label(row.filter);
              return (
                <li key={keyOf(row.filter)} className="flex items-center gap-2 ps-3 pe-1">
                  <label className="flex min-h-11 flex-1 cursor-pointer items-center gap-3 text-sm text-ink">
                    <input
                      type="checkbox"
                      className="size-4 shrink-0 accent-primary"
                      checked={row.enabled}
                      onChange={(e) =>
                        setRows((current) => current.map((r, i) => (i === index ? { ...r, enabled: e.target.checked } : r)))
                      }
                    />
                    <span>
                      {name}
                      {row.filter.key === "options" && (
                        <span className="block text-xs text-ink-soft">{t.filter_optionsHint}</span>
                      )}
                    </span>
                  </label>
                  <button
                    type="button"
                    className="inline-flex size-11 cursor-pointer items-center justify-center rounded-[0.5rem] text-ink-soft hover:bg-paper hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 disabled:cursor-not-allowed disabled:opacity-40"
                    aria-label={fmt(t.moveUp, { name })}
                    disabled={index === 0}
                    onClick={() => move(index, index - 1)}
                  >
                    <ArrowUp className="size-4" aria-hidden />
                  </button>
                  <button
                    type="button"
                    className="inline-flex size-11 cursor-pointer items-center justify-center rounded-[0.5rem] text-ink-soft hover:bg-paper hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 disabled:cursor-not-allowed disabled:opacity-40"
                    aria-label={fmt(t.moveDown, { name })}
                    disabled={index === rows.length - 1}
                    onClick={() => move(index, index + 1)}
                  >
                    <ArrowDown className="size-4" aria-hidden />
                  </button>
                </li>
              );
            })}
          </ul>
          {optionNames.data && optionNames.data.length === 0 && <p className="text-xs text-ink-soft">{t.noOptions}</p>}
        </fieldset>

        {error && <Alert variant="danger">{error}</Alert>}

        {editable && (
          <div className="flex flex-wrap justify-end gap-2">
            {dirty && (
              <Button variant="outline" className="min-h-11" disabled={saving} onClick={reset}>
                {t.reset}
              </Button>
            )}
            <Button className="min-h-11" disabled={saving || !dirty} onClick={() => void save()}>
              {saving ? t.saving : t.save}
            </Button>
          </div>
        )}
      </div>
    </section>
  );
}
