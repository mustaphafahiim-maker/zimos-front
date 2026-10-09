import { useId, useMemo, useState } from "react";
import { IconArrowDown, IconArrowUp } from "@/components/icons";
import { Alert, cn } from "@store-builder/ui";
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
import { SaveBar } from "@/components/SaveBar";
import { SettingsGroup, SettingsRow, SettingsSwitch } from "@/components/settings";
import { useToast } from "@/components/Toast";
import { useReportDirty } from "@/lib/useUnsavedGuard";
// What the lists do with sold-out products (handoff 390).
import { soldOutModeOf, type SoldOutMode } from "@store-builder/api-client";
import { SoldOutSetting } from "./SoldOutSetting";

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
    sidebar: "اعرض فلاتر جنب المنتجات",
    sidebarHint: "على الموبايل بتفتح من زرار «تصفية».",
    defaultSort: "رتّب المنتجات في الأول حسب",
    sort_newest: "الأحدث الأول",
    sort_price_asc: "السعر: من الأقل للأعلى",
    sort_price_desc: "السعر: من الأعلى للأقل",
    sort_name: "الاسم",
    sort_position: "المميزة (ترتيبك داخل المجموعة)",
    filters: "الفلاتر اللي بتظهر",
    filtersHint: "علّم على الفلاتر اللي تظهر، ورتّبها بالأسهم.",
    filter_collections: "المجموعات",
    filter_price: "السعر",
    filter_tags: "التاجات",
    filter_options: "كل خيارات المنتجات",
    filter_optionsHint: "كل اختيار في منتجاتك، زي المقاس واللون.",
    filter_option: "الخيار: {name}",
    moveUp: "طلّع {name} لفوق",
    moveDown: "نزّل {name} لتحت",
    noOptions: "الاختيارات هتظهر هنا لما منتجاتك يبقى ليها مقاسات أو ألوان.",
    readOnly: "صاحب المتجر أو المدير أو المحرر بس اللي يقدروا يغيّروا عرض المنتجات.",
    save: "احفظ إعدادات العرض",
    saving: "بنحفظ…",
    reset: "تجاهل",
    saved: "إعدادات العرض اتحفظت.",
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
    // Kept beside the typed keys so the card's "changed?" check and its save carry it.
    ...{ sold_out: soldOutModeOf(raw) },
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
  const optionNames = useAsync(() => apiClient.listCatalogOptionNames(workspaceId), [workspaceId]);

  const stored = useMemo(
    () => readSettings(currentWorkspace?.settings?.storefront_catalog),
    [currentWorkspace?.settings?.storefront_catalog]
  );
  const names = useMemo(() => (optionNames.data ?? []).map((o) => o.name), [optionNames.data]);
  const [saved, setSaved] = useState(stored);
  const [sidebar, setSidebar] = useState(stored.sidebar_enabled);
  const [sort, setSort] = useState<CatalogDefaultSort>(stored.default_sort);
  const [soldOut, setSoldOut] = useState<SoldOutMode>(soldOutModeOf(stored));
  const [rows, setRows] = useState<Row[]>(() => toRows(stored, []));
  const [forbidden, setForbidden] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Option names arrive after the first render: add them to the list without undoing edits.
  const [namesSeen, setNamesSeen] = useState<string[]>([]);
  if (names !== namesSeen) {
    setNamesSeen(names);
    const present = new Set(rows.map((r) => keyOf(r.filter)));
    const extra = names.filter((n) => !present.has(`option:${n}`)).map((name) => ({
      filter: { key: "option" as const, name },
      enabled: false,
    }));
    if (extra.length > 0) setRows([...rows, ...extra]);
  }

  const editable = EDITOR_ROLES.has(currentWorkspace?.role ?? "") && !forbidden;
  const draft: StorefrontCatalogSettings = {
    sidebar_enabled: sidebar,
    default_sort: sort,
    filters: rows.filter((r) => r.enabled).map((r) => r.filter),
    ...{ sold_out: soldOut },
  };
  const dirty = JSON.stringify(draft) !== JSON.stringify(saved);
  useReportDirty(dirty && editable);

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
    setSoldOut(soldOutModeOf(saved));
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
    <>
      {!editable && <Alert>{t.readOnly}</Alert>}

      <SettingsGroup>
        <SettingsSwitch
          label={t.sidebar}
          hint={t.sidebarHint}
          checked={sidebar}
          disabled={!editable || saving}
          onChange={setSidebar}
        />
        <SettingsRow
          label={t.defaultSort}
          htmlFor={sortId}
          control={
            <Select
              id={sortId}
              value={sort}
              disabled={!editable || saving}
              onChange={(e) => setSort(e.target.value as CatalogDefaultSort)}
              className="h-11 text-base sm:text-sm"
            >
              {SORTS.map((key) => (
                <option key={key} value={key}>
                  {t[`sort_${key}`]}
                </option>
              ))}
            </Select>
          }
        />
        <SoldOutSetting value={soldOut} onChange={setSoldOut} disabled={!editable || saving} />
      </SettingsGroup>

      <SettingsGroup title={t.filters} description={t.filtersHint} className={cn(!sidebar && "opacity-70")}>
        <fieldset disabled={!editable || saving} className="min-w-0">
          <legend className="sr-only">{t.filters}</legend>
          <ul className="divide-y divide-line">
            {rows.map((row, index) => {
              const name = label(row.filter);
              return (
                <li key={keyOf(row.filter)} className="flex items-center gap-1 ps-4 pe-1.5">
                  <label className="flex min-h-13 flex-1 cursor-pointer items-center gap-3 py-1.5 text-sm font-medium text-ink">
                    <input
                      type="checkbox"
                      className="size-5 shrink-0 cursor-pointer accent-primary"
                      checked={row.enabled}
                      onChange={(e) =>
                        setRows((current) => current.map((r, i) => (i === index ? { ...r, enabled: e.target.checked } : r)))
                      }
                    />
                    <span>
                      {name}
                      {row.filter.key === "options" && (
                        <span className="block text-[13px] leading-5 font-normal text-ink-soft">{t.filter_optionsHint}</span>
                      )}
                    </span>
                  </label>
                  <button
                    type="button"
                    className="inline-flex size-11 cursor-pointer items-center justify-center rounded-full text-ink-soft transition-[background-color,scale] duration-[var(--dur-fade)] hover:bg-ink/5 hover:text-ink focus-visible:outline-2 focus-visible:outline-primary active:scale-[0.97] motion-reduce:transition-none motion-reduce:active:scale-100 disabled:cursor-not-allowed disabled:opacity-40"
                    aria-label={fmt(t.moveUp, { name })}
                    disabled={index === 0}
                    onClick={() => move(index, index - 1)}
                  >
                    <IconArrowUp className="size-4" aria-hidden />
                  </button>
                  <button
                    type="button"
                    className="inline-flex size-11 cursor-pointer items-center justify-center rounded-full text-ink-soft transition-[background-color,scale] duration-[var(--dur-fade)] hover:bg-ink/5 hover:text-ink focus-visible:outline-2 focus-visible:outline-primary active:scale-[0.97] motion-reduce:transition-none motion-reduce:active:scale-100 disabled:cursor-not-allowed disabled:opacity-40"
                    aria-label={fmt(t.moveDown, { name })}
                    disabled={index === rows.length - 1}
                    onClick={() => move(index, index + 1)}
                  >
                    <IconArrowDown className="size-4" aria-hidden />
                  </button>
                </li>
              );
            })}
          </ul>
          {optionNames.data && optionNames.data.length === 0 && (
            <p className="border-t border-line px-4 py-3 text-[13px] leading-5 text-ink-soft">{t.noOptions}</p>
          )}
        </fieldset>
      </SettingsGroup>

      {error && <Alert variant="danger">{error}</Alert>}

      {editable && (
        <SaveBar
          dirty={dirty}
          saving={saving}
          saveLabel={t.save}
          savingLabel={t.saving}
          discardLabel={t.reset}
          onSave={() => void save()}
          onDiscard={reset}
        />
      )}
    </>
  );
}
