import { useEffect, useId, useMemo, useRef, useState } from "react";
import { Button, Input, cn } from "@store-builder/ui";
import type { ShippingGovernorate } from "@store-builder/api-client";
import { IconClose, IconSearch } from "@/components/icons";
import { formatMoney, majorToMinor } from "@/lib/format";
import { fmt, useLocale, useT, type Messages } from "@/i18n/LocaleContext";

const STRINGS = {
  en: {
    search: "Search governorates…",
    searchRegional: "Search regions…",
    searchLabel: "Filter the list by name",
    clearSearch: "Clear search",
    nothing: "Nothing by that name.",
    colName: "Governorate",
    colNameRegional: "Region",
    colPrice: "Price ({currency})",
    colOff: "Don't deliver",
    selectAll: "Select all shown",
    selectOne: "Select {name}",
    priceFor: "Shipping price for {name}",
    offFor: "Don't deliver to {name}",
    inherits: "Default price: {price}",
    inheritsFree: "Default price: free",
    free: "Ships free",
    off: "Not delivering here",
    changed: "Changed, not saved yet",
    bulkPrice: "One price",
    bulkPriceLabel: "A price to apply to several rows",
    applyAll: "Apply to all",
    applySelected: "Apply to selected",
    clearSelected: "Use the default",
    stopSelected: "Stop delivery",
    startSelected: "Resume delivery",
    unselect: "Clear selection",
    selected: "Selected: {n}",
    bulkHint: "Tick rows to change only those. Nothing is saved until you press Save.",
    hiddenCount: "{count} hidden: customers can't choose them at checkout.",
  },
  ar: {
    search: "دوّر على محافظة…",
    searchRegional: "دوّر على منطقة…",
    searchLabel: "فلتر القايمة بالاسم",
    clearSearch: "امسح البحث",
    nothing: "مفيش حاجة بالاسم ده.",
    colName: "المحافظة",
    colNameRegional: "المنطقة",
    colPrice: "السعر ({currency})",
    colOff: "مش بنوصّل",
    selectAll: "حدّد كل اللي ظاهر",
    selectOne: "حدّد {name}",
    priceFor: "سعر الشحن لـ {name}",
    offFor: "مش بنوصّل {name}",
    inherits: "السعر الأساسي: {price}",
    inheritsFree: "السعر الأساسي: مجاني",
    free: "شحن مجاني",
    off: "مش بنوصّل هنا",
    changed: "اتغيّر ولسه ما اتحفظش",
    bulkPrice: "سعر واحد",
    bulkPriceLabel: "سعر يتطبّق على كذا صف",
    applyAll: "طبّق على الكل",
    applySelected: "طبّق على المحدّد",
    clearSelected: "رجّعه للأساسي",
    stopSelected: "وقّف التوصيل",
    startSelected: "شغّل التوصيل",
    unselect: "الغي التحديد",
    selected: "المحدّد: {n}",
    bulkHint: "علّم على صفوف عشان تغيّرها هي بس. مفيش حاجة بتتحفظ غير لما تدوس حفظ.",
    hiddenCount: "{count} مخفية: العميل مش هيقدر يختارها في صفحة الدفع.",
  },
} satisfies Messages;

/** "" -> null; a valid amount -> minor units; anything else -> "invalid". */
export function parseAmount(input: string): number | null | "invalid" {
  if (input.trim() === "") return null;
  const minor = majorToMinor(input);
  return Number.isFinite(minor) && minor >= 0 ? minor : "invalid";
}

/**
 * Lower-case, without Arabic diacritics or tatweel, and with the letters
 * people type interchangeably folded together (أ إ آ → ا, ة → ه, ى → ي), so
 * «اسكندريه» finds «الإسكندرية» — the same folding as the section search.
 */
function fold(text: string): string {
  return text
    .toLowerCase()
    .replace(/[\p{Mn}ـ]/gu, "")
    .replace(/[أإآٱ]/g, "ا")
    .replace(/ة/g, "ه")
    .replace(/ى/g, "ي")
    .trim();
}

export interface GovernorateTableProps {
  governorates: ShippingGovernorate[];
  /** Saudi stores price by region: only the words change. */
  regional: boolean;
  currency: string;
  /** Major-unit text per code, as typed. "" = the default price. */
  rates: Record<string, string>;
  hidden: ReadonlySet<string>;
  /** As last saved, to mark the rows that changed since. */
  savedRates: Record<string, string>;
  savedHidden: ReadonlySet<string>;
  /** The default price as typed, for the "inherits" mark and the placeholder. */
  defaultRate: string;
  /** The amount problem of a row, by governorate code. */
  errors: Record<string, string>;
  disabled?: boolean;
  onRatesChange: (update: (prev: Record<string, string>) => Record<string, string>) => void;
  onHiddenChange: (update: (prev: Set<string>) => Set<string>) => void;
}

/** The columns of a row and of the head: tick, name, price, "don't deliver". */
const GRID = "grid grid-cols-[2.75rem_minmax(0,1fr)_6rem_3.5rem] items-center gap-x-1 sm:grid-cols-[2.75rem_minmax(0,1fr)_8rem_5.5rem] sm:gap-x-3";

/**
 * Every governorate's shipping price as one compact table: a tick, the name in
 * the screen's language, the price typed in the row, and «مش بنوصّل هنا» as a
 * switch — one 52px row each, on a phone too. Above it: a search that filters
 * as you type, and one price field that is applied to all rows or, once rows
 * are ticked, to those rows only.
 *
 * It only edits the draft it is given. Saving stays with the form around it,
 * which sends the whole map in one PATCH.
 */
export function GovernorateTable({
  governorates,
  regional,
  currency,
  rates,
  hidden,
  savedRates,
  savedHidden,
  defaultRate,
  errors,
  disabled = false,
  onRatesChange,
  onHiddenChange,
}: GovernorateTableProps) {
  const t = useT(STRINGS);
  const { locale } = useLocale();
  const bulkId = useId();
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState<ReadonlySet<string>>(() => new Set<string>());
  const [bulk, setBulk] = useState("");
  const allRef = useRef<HTMLInputElement>(null);

  const nameOf = (g: ShippingGovernorate) => g[locale] || g.en || g.ar;

  const shownRows = useMemo(() => {
    const words = fold(query).split(/\s+/).filter(Boolean);
    if (words.length === 0) return governorates;
    // Either language finds a row, whichever the screen is in.
    return governorates.filter((g) => {
      const text = fold(`${g.ar} ${g.en} ${g.code}`);
      return words.every((word) => text.includes(word));
    });
  }, [governorates, query]);

  const shownSelected = shownRows.filter((g) => selected.has(g.code)).length;
  const allShownSelected = shownRows.length > 0 && shownSelected === shownRows.length;
  useEffect(() => {
    if (allRef.current) allRef.current.indeterminate = shownSelected > 0 && !allShownSelected;
  }, [shownSelected, allShownSelected]);

  const bulkAmount = parseAmount(bulk);
  const bulkReady = bulkAmount !== null && bulkAmount !== "invalid";
  const count = selected.size;
  const anySelectedOff = [...selected].some((code) => hidden.has(code));
  const anySelectedOn = [...selected].some((code) => !hidden.has(code));

  const defaultAmount = parseAmount(defaultRate);
  const inheritsMark =
    defaultAmount === null || defaultAmount === "invalid"
      ? t.inheritsFree
      : fmt(t.inherits, { price: formatMoney(defaultAmount, currency) });

  function toggleRow(code: string, on: boolean) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (on) next.add(code);
      else next.delete(code);
      return next;
    });
  }

  function toggleAllShown(on: boolean) {
    setSelected((prev) => {
      const next = new Set(prev);
      for (const g of shownRows) {
        if (on) next.add(g.code);
        else next.delete(g.code);
      }
      return next;
    });
  }

  function setPriceOfSelected(value: string) {
    const codes = [...selected];
    onRatesChange((prev) => ({ ...prev, ...Object.fromEntries(codes.map((code) => [code, value])) }));
  }

  function setOffForSelected(off: boolean) {
    const codes = [...selected];
    onHiddenChange((prev) => {
      const next = new Set(prev);
      for (const code of codes) {
        if (off) next.add(code);
        else next.delete(code);
      }
      return next;
    });
  }

  return (
    <div
      data-slot="card"
      className="zimos-gov-table min-w-0 rounded-[var(--radius-card)] bg-card text-card-foreground shadow-[var(--shadow-card)] ring-1 ring-line [--radius-card:1.25rem]"
    >
      {/* Search, then the bulk tools. */}
      <div className="flex flex-col gap-3 p-3 sm:p-4">
        <label
          className={cn(
            "flex h-11 cursor-text items-center rounded-full bg-paper-sunken text-ink ring-1 ring-line",
            "has-[input:focus-visible]:outline-2 has-[input:focus-visible]:outline-primary"
          )}
        >
          <IconSearch className="ms-3.5 size-4 shrink-0 text-ink-soft" aria-hidden />
          <input
            type="search"
            inputMode="search"
            enterKeyHint="search"
            autoComplete="off"
            spellCheck={false}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => {
              // Enter in the search must not submit the prices form around the table.
              if (e.key === "Enter") e.preventDefault();
              if (e.key === "Escape" && query !== "") {
                e.preventDefault();
                e.stopPropagation();
                setQuery("");
              }
            }}
            placeholder={regional ? t.searchRegional : t.search}
            aria-label={t.searchLabel}
            className="h-full min-w-0 flex-1 appearance-none bg-transparent ps-2.5 pe-2 text-sm text-ink outline-none placeholder:text-ink-soft pointer-coarse:text-base [&::-webkit-search-cancel-button]:hidden [&::-webkit-search-decoration]:hidden"
          />
          {query !== "" && (
            <button
              type="button"
              aria-label={t.clearSearch}
              title={t.clearSearch}
              onClick={() => setQuery("")}
              className="relative me-1 flex size-8 shrink-0 cursor-pointer items-center justify-center rounded-full text-ink-soft transition-[scale,background-color,color] duration-[var(--dur-fade)] ease-[var(--ease-out)] before:absolute before:-inset-1.5 before:content-[''] hover:bg-ink/8 hover:text-ink focus-visible:outline-2 focus-visible:outline-primary active:scale-[0.97] motion-reduce:transition-none motion-reduce:active:scale-100"
            >
              <IconClose className="size-4" weight="bold" aria-hidden />
            </button>
          )}
        </label>

        <div
          className={cn(
            "flex flex-col gap-2 rounded-2xl p-2.5 transition-[background-color] duration-[var(--dur-fade)] ease-[var(--ease-out)] motion-reduce:transition-none",
            count > 0 ? "bg-primary-soft" : "bg-paper-sunken"
          )}
        >
          <div className="flex flex-wrap items-center gap-2">
            <label htmlFor={bulkId} className="sr-only">
              {t.bulkPriceLabel}
            </label>
            <div className="relative min-w-0 flex-[1_1_9rem] sm:max-w-48">
              <span className="pointer-events-none absolute inset-y-0 start-0 flex items-center ps-3 text-sm text-ink-soft">
                {currency}
              </span>
              <Input
                id={bulkId}
                inputMode="decimal"
                value={bulk}
                disabled={disabled}
                placeholder={t.bulkPrice}
                onChange={(e) => setBulk(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") e.preventDefault();
                }}
                aria-invalid={bulkAmount === "invalid" ? true : undefined}
                className={cn("h-11 bg-paper-raised ps-12", bulkAmount === "invalid" && "border-danger focus-visible:ring-danger/30")}
              />
            </div>
            {count > 0 ? (
              <Button
                type="button"
                className="min-h-11 flex-[1_1_auto] rounded-full px-4 sm:flex-none"
                disabled={disabled || !bulkReady}
                onClick={() => setPriceOfSelected(bulk.trim())}
              >
                {t.applySelected}
              </Button>
            ) : (
              <Button
                type="button"
                variant="outline"
                className="min-h-11 flex-[1_1_auto] rounded-full px-4 sm:flex-none"
                disabled={disabled || !bulkReady}
                // Every governorate, the ones filtered out and the stopped ones included — as it always did.
                onClick={() => onRatesChange(() => Object.fromEntries(governorates.map((g) => [g.code, bulk.trim()])))}
              >
                {t.applyAll}
              </Button>
            )}
          </div>

          {count > 0 ? (
            <div className="flex flex-wrap items-center gap-2">
              <p role="status" className="me-auto ps-1 text-sm font-semibold text-primary-dark tabular-nums">
                {fmt(t.selected, { n: count })}
              </p>
              <Button type="button" variant="outline" className="min-h-11 rounded-full bg-paper-raised px-3.5" disabled={disabled} onClick={() => setPriceOfSelected("")}>
                {t.clearSelected}
              </Button>
              {anySelectedOn && (
                <Button type="button" variant="outline" className="min-h-11 rounded-full bg-paper-raised px-3.5" disabled={disabled} onClick={() => setOffForSelected(true)}>
                  {t.stopSelected}
                </Button>
              )}
              {anySelectedOff && (
                <Button type="button" variant="outline" className="min-h-11 rounded-full bg-paper-raised px-3.5" disabled={disabled} onClick={() => setOffForSelected(false)}>
                  {t.startSelected}
                </Button>
              )}
              <Button type="button" variant="ghost" className="min-h-11 rounded-full px-3.5" onClick={() => setSelected(new Set<string>())}>
                {t.unselect}
              </Button>
            </div>
          ) : (
            <p className="px-1 text-[13px] leading-5 text-ink-soft">{t.bulkHint}</p>
          )}
        </div>

        {hidden.size > 0 && <p className="px-1 text-[13px] leading-5 text-ink-soft">{fmt(t.hiddenCount, { count: hidden.size })}</p>}
      </div>

      {/* The head: what each column is, on a phone too — a bare switch must say what it switches. */}
      <div className={cn(GRID, "min-h-10 border-t border-line px-1 text-[11px] leading-4 font-semibold text-ink-soft sm:px-2 sm:text-xs")}>
        <label className="flex size-11 cursor-pointer items-center justify-center">
          <input
            ref={allRef}
            type="checkbox"
            className="size-[18px] cursor-pointer accent-[var(--color-primary)]"
            aria-label={t.selectAll}
            checked={allShownSelected}
            disabled={disabled || shownRows.length === 0}
            onChange={(e) => toggleAllShown(e.target.checked)}
          />
        </label>
        <span aria-hidden>{regional ? t.colNameRegional : t.colName}</span>
        <span aria-hidden>{fmt(t.colPrice, { currency })}</span>
        <span aria-hidden className="text-center">
          {t.colOff}
        </span>
      </div>

      {shownRows.length === 0 ? (
        <p role="status" className="border-t border-line px-4 py-8 text-center text-sm text-ink-soft">
          {t.nothing}
        </p>
      ) : (
        <ul role="list">
          {shownRows.map((g) => {
            const name = nameOf(g);
            const off = hidden.has(g.code);
            const value = rates[g.code] ?? "";
            const error = errors[g.code];
            const picked = selected.has(g.code);
            const changed = value.trim() !== (savedRates[g.code] ?? "").trim() || off !== savedHidden.has(g.code);
            const amount = parseAmount(value);
            const mark = off ? t.off : amount === null ? inheritsMark : amount === 0 ? t.free : null;
            return (
              <li
                key={g.code}
                className={cn(
                  GRID,
                  "min-h-13 border-t border-line px-1 last:rounded-b-[1.25rem] sm:px-2",
                  picked && "bg-primary-soft/60"
                )}
              >
                <label className="flex size-11 cursor-pointer items-center justify-center">
                  <input
                    type="checkbox"
                    className="size-[18px] cursor-pointer accent-[var(--color-primary)]"
                    aria-label={fmt(t.selectOne, { name })}
                    checked={picked}
                    disabled={disabled}
                    onChange={(e) => toggleRow(g.code, e.target.checked)}
                  />
                </label>

                <div className="min-w-0 py-1.5">
                  <p className={cn("flex items-center gap-1.5 text-sm leading-5 font-medium text-ink", off && "text-ink-soft")}>
                    <span className="truncate">{name}</span>
                    {changed && (
                      <span className="size-1.5 shrink-0 rounded-full bg-primary" role="img" aria-label={t.changed} title={t.changed} />
                    )}
                  </p>
                  {(error || mark) && (
                    <p
                      className={cn(
                        "truncate text-[11px] leading-4",
                        error ? "font-medium text-danger" : off ? "font-medium text-accent-dark" : "text-ink-soft"
                      )}
                    >
                      {error ?? mark}
                    </p>
                  )}
                </div>

                <Input
                  inputMode="decimal"
                  dir="ltr"
                  value={value}
                  disabled={disabled || off}
                  placeholder={defaultRate.trim() || "—"}
                  aria-label={fmt(t.priceFor, { name })}
                  aria-invalid={error ? true : undefined}
                  onChange={(e) => {
                    const next = e.target.value;
                    onRatesChange((prev) => ({ ...prev, [g.code]: next }));
                  }}
                  className={cn(
                    "h-10 px-2 text-end tabular-nums pointer-coarse:h-11",
                    error && "border-danger focus-visible:ring-danger/30"
                  )}
                />

                <button
                  type="button"
                  role="switch"
                  aria-checked={off}
                  aria-label={fmt(t.offFor, { name })}
                  title={t.off}
                  disabled={disabled}
                  onClick={() =>
                    onHiddenChange((prev) => {
                      const next = new Set(prev);
                      if (next.has(g.code)) next.delete(g.code);
                      else next.add(g.code);
                      return next;
                    })
                  }
                  className="group/off flex h-11 cursor-pointer items-center justify-center justify-self-center rounded-full px-1 focus-visible:outline-2 focus-visible:outline-primary disabled:cursor-not-allowed disabled:opacity-55"
                >
                  <span
                    aria-hidden
                    className={cn(
                      "zimos-settings-switch-track relative h-7 w-12 shrink-0 overflow-hidden rounded-full transition-[background-color] duration-[var(--dur-fade)] ease-[var(--ease-out)] motion-reduce:transition-none forced-colors:border forced-colors:border-[color:ButtonText]",
                      off ? "bg-primary forced-colors:bg-[color:Highlight]" : "bg-line-strong"
                    )}
                  >
                    <span
                      className={cn(
                        "zimos-settings-switch-thumb absolute start-0.5 top-0.5 size-6 rounded-full bg-white shadow-[0_1px_3px_rgb(0_0_0/0.3)] transition-transform duration-[var(--dur-pop)] ease-[var(--ease-pop)] motion-reduce:transition-none forced-colors:bg-[color:ButtonText]",
                        off && "translate-x-5 rtl:-translate-x-5"
                      )}
                    />
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
