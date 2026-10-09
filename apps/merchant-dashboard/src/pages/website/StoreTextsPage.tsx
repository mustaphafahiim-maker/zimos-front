import { useMemo, useState } from "react";
import {
  IconCart,
  IconCelebrate,
  IconCourier,
  IconField,
  IconOffers,
  IconPanelBottom,
  IconProduct,
  IconReceipt,
  IconRotateBack,
  IconSearch,
  IconSuccess,
  IconText,
  IconTrendUp,
  type IconComponent,
} from "@/components/icons";
import { Alert, Button, Input, cn } from "@store-builder/ui";
import {
  STORE_LOCALES,
  storefrontTextsErrors,
  storefrontTextsGet,
  storefrontTextsSave,
  type StorefrontTexts,
} from "@store-builder/api-client";
import { apiClient } from "@/lib/apiClient";
import { useWorkspaceId } from "@/lib/useWorkspaceId";
import { useAsync } from "@/lib/useAsync";
import { useErrorMessage } from "@/lib/errorMessages";
import { pluralOf } from "@/lib/plural";
import { useWorkspace } from "@/context/WorkspaceContext";
import { fmt, useLocale, useT, type Messages } from "@/i18n/LocaleContext";
import { PageHeader } from "@/components/PageHeader";
import { DataState } from "@/components/DataState";
import { EmptyState } from "@/components/EmptyState";
import { AccordionGroup, AccordionSection } from "@/components/Accordion";
import { SaveBar } from "@/components/SaveBar";
import { ChipRow, FilterChoice, FilterGroup, FilterSheet, ListToolbar, type ChipItem } from "@/components/list";
import { useToast } from "@/components/Toast";
import { UnsavedGuardProvider, useReportDirty } from "@/lib/useUnsavedGuard";
import { ActiveFilters, type ActiveFilterChip } from "@/pages/orders/list/ActiveFilters";
import { STORE_TEXT_GROUPS, type StoreTextEntry, type StoreTextGroupId } from "./storeTextsCatalog";
import { normalizeSearch } from "./templateGallery";

const STRINGS = {
  en: {
    title: "Store texts",
    description: "Change the words shoppers see on buttons, forms, cart and checkout.",
    back: "Store editor",
    language: "Language",
    ar: "Arabic",
    en: "English",
    fr: "French",
    es: "Spanish",
    it: "Italian",
    de: "German",
    search: "Search texts",
    searchPlaceholder: "Search the store's words",
    section: "Section",
    sectionChip: "Section: {name}",
    allSections: "All sections",
    common: "Buttons & common",
    product: "Product",
    form: "Form & errors",
    bump: "Order bump",
    cart: "Cart",
    checkout: "Checkout",
    upsell: "Upsell",
    thankYou: "Thank you",
    track: "Tracking",
    footer: "Footer",
    default: "Default",
    yours: "Your text",
    yoursFor: "Your text instead of “{text}”",
    changed: "Changed",
    reset: "Reset",
    resetAria: "Reset “{text}” to the default",
    placeholders: "Placeholders: {list}",
    placeholdersHint: "Keep these as written; the store fills them in.",
    show: "Show",
    everyText: "Every text",
    changedOnly: "Only what I changed",
    apply_one: "Show 1 text",
    apply_other: "Show {n} texts",
    groupCount: "{changed} of {total} changed",
    texts_one: "1 text",
    texts_other: "{n} texts",
    allDefault: "All texts use the default wording",
    allDefaultHint: "Write your own text under any default to change it. Leave it empty to keep the default.",
    noMatch: "No texts match your search",
    noMatchHint: "Try another word, another section, or show every text.",
    clearFilters: "Show every text",
    noInterface:
      "Shoppers see the store's buttons in Arabic, English or French today. Texts you write for this language are kept and show once the store speaks it.",
    unsaved: "You have unsaved changes",
    save: "Save",
    saving: "Saving…",
    discard: "Discard",
    saved: "Saved",
    fixRows: "Some texts need fixing — they are marked below.",
    tooLong: "Keep it to {max} characters or fewer.",
    badKey: "This text can't be changed.",
    checkText: "Check this text.",
  },
  ar: {
    title: "نصوص المتجر",
    description: "غيّر الكلام اللي العميل بيشوفه على الأزرار والفورم والسلة وصفحة الطلب.",
    back: "محرر المتجر",
    language: "اللغة",
    ar: "العربية",
    en: "الإنجليزية",
    fr: "الفرنسية",
    es: "الإسبانية",
    it: "الإيطالية",
    de: "الألمانية",
    search: "دوّر في النصوص",
    searchPlaceholder: "دوّر في كلام المتجر",
    section: "القسم",
    sectionChip: "القسم: {name}",
    allSections: "كل الأقسام",
    common: "الأزرار والنصوص العامة",
    product: "صفحة المنتج",
    form: "الفورم والأخطاء",
    bump: "إضافة الطلب",
    cart: "السلة",
    checkout: "إتمام الطلب",
    upsell: "عرض بعد الشراء",
    thankYou: "صفحة الشكر",
    track: "تتبع الطلب",
    footer: "الفوتر",
    default: "النص الافتراضي",
    yours: "النص بتاعك",
    yoursFor: "النص بتاعك بدل «{text}»",
    changed: "متغيّر",
    reset: "رجّع الافتراضي",
    resetAria: "رجّع «{text}» للنص الافتراضي",
    placeholders: "المتغيرات: {list}",
    placeholdersHint: "سيبها زي ما هي، المتجر بيحط مكانها القيمة.",
    show: "اعرض",
    everyText: "كل النصوص",
    changedOnly: "اللي غيّرته بس",
    apply_one: "اعرض نص واحد",
    apply_two: "اعرض نصين",
    apply_few: "اعرض {n} نصوص",
    apply_other: "اعرض {n} نص",
    groupCount: "اتغيّر {changed} من {total}",
    texts_one: "نص واحد",
    texts_two: "نصين",
    texts_few: "{n} نصوص",
    texts_other: "{n} نص",
    allDefault: "كل النصوص على الكلام الافتراضي",
    allDefaultHint: "اكتب النص بتاعك تحت أي نص افتراضي علشان تغيّره. سيب الخانة فاضية علشان يفضل الافتراضي.",
    noMatch: "مفيش نصوص بالكلام ده",
    noMatchHint: "جرّب كلمة تانية أو قسم تاني، أو اعرض كل النصوص.",
    clearFilters: "اعرض كل النصوص",
    noInterface:
      "العميل بيشوف أزرار المتجر بالعربي أو الإنجليزي أو الفرنساوي دلوقتي. النصوص اللي تكتبها للغة دي بتتحفظ وهتظهر أول ما المتجر يدعمها.",
    unsaved: "عندك تغييرات لسه ما اتحفظتش",
    save: "حفظ",
    saving: "بيحفظ…",
    discard: "تجاهل",
    saved: "اتحفظ",
    fixRows: "في نصوص محتاجة تتصلح — معلّم عليها تحت.",
    tooLong: "النص لازم يكون {max} حرف بالكتير.",
    badKey: "النص ده مينفعش يتغيّر.",
    checkText: "راجع النص ده.",
  },
} satisfies Messages;

type Locale = (typeof STORE_LOCALES)[number];
type GroupFilter = StoreTextGroupId | "all";

/** The languages the storefront has its own buttons in; the others read English. */
const INTERFACE_LOCALES = new Set<string>(["ar", "en", "fr"]);
const ARABIC_LETTER = /[؀-ۿ]/;

/** Where in the store a group's words are read — the glyph on its row. */
const GROUP_ICON: Record<StoreTextGroupId, IconComponent> = {
  common: IconText,
  product: IconProduct,
  form: IconField,
  bump: IconOffers,
  cart: IconCart,
  checkout: IconReceipt,
  upsell: IconTrendUp,
  thankYou: IconCelebrate,
  track: IconCourier,
  footer: IconPanelBottom,
};

function defaultText(entry: StoreTextEntry, locale: string): string {
  return locale === "ar" ? entry.ar : locale === "fr" ? entry.fr : entry.en;
}

/** Drops blank texts, so "changed" means the same on screen and on the server. */
function clean(texts: StorefrontTexts): StorefrontTexts {
  const out: StorefrontTexts = {};
  for (const [locale, entries] of Object.entries(texts)) {
    const kept: Record<string, string> = {};
    for (const [key, value] of Object.entries(entries ?? {})) {
      if (typeof value === "string" && value.trim()) kept[key] = value;
    }
    if (Object.keys(kept).length > 0) out[locale] = kept;
  }
  return out;
}

function sameTexts(a: StorefrontTexts, b: StorefrontTexts): boolean {
  const x = clean(a);
  const y = clean(b);
  const locales = new Set([...Object.keys(x), ...Object.keys(y)]);
  for (const locale of locales) {
    const ex = x[locale] ?? {};
    const ey = y[locale] ?? {};
    const keys = new Set([...Object.keys(ex), ...Object.keys(ey)]);
    for (const key of keys) if ((ex[key] ?? "").trim() !== (ey[key] ?? "").trim()) return false;
  }
  return true;
}

/**
 * Website → Store texts (backend storefront/storefrontTexts.js, website.edit):
 * the storefront's own labels reworded per language. Each row shows the
 * default from the dashboard's copy of the storefront dictionary
 * (storeTextsCatalog.ts) beside the merchant's text; Save sends every
 * override at once.
 *
 * The list pattern: search first — one toolbar, with Filters for the section
 * and "only what I changed" — then the languages as one row of chips (each
 * with how many texts it has reworded), and the store's pages as sections
 * that fold to one row saying how many of their texts were changed. A text is
 * edited in its row: the field shows the default wording as its placeholder,
 * and a reworded text is marked and keeps its default in sight. The save bar
 * rides above the phone dock, and leaving with unsaved texts asks first.
 */
export function StoreTextsPage() {
  return (
    <UnsavedGuardProvider>
      <StoreTexts />
    </UnsavedGuardProvider>
  );
}

function StoreTexts() {
  const t = useT(STRINGS);
  const { locale: uiLocale } = useLocale();
  const workspaceId = useWorkspaceId();
  const toast = useToast();
  const errorMessage = useErrorMessage();
  const { currentWorkspace } = useWorkspace();
  const state = useAsync(() => storefrontTextsGet(apiClient, workspaceId), [workspaceId]);

  // The texts as typed, per language; null until the merchant edits something.
  const [draft, setDraft] = useState<StorefrontTexts | null>(null);
  const [picked, setPicked] = useState<Locale | null>(null);
  const [query, setQuery] = useState("");
  const [group, setGroup] = useState<GroupFilter>("all");
  const [changedOnly, setChangedOnly] = useState(false);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  // Problems from the last save, keyed "ar.checkout.place" (or "ar" for a whole language).
  const [problems, setProblems] = useState<Record<string, string>>({});

  const saved = useMemo(() => state.data?.texts ?? {}, [state.data]);
  const texts = draft ?? saved;
  const dirty = draft !== null && !sameTexts(draft, saved);
  // One save writes everything: closing the tab with unsaved texts asks first (re-audit N-19).
  // The guard arms the browser's own prompt while anything is unsaved, and stands down during a save.
  useReportDirty(dirty && !saving);
  const maxText = state.data?.limits.maxText ?? 500;

  // Arabic and English always; then the store's own language, the languages it
  // offers (Store settings → Languages) and any language that already has texts.
  const locales = useMemo<Locale[]>(() => {
    const allowed = new Set(state.data?.limits.locales ?? STORE_LOCALES);
    const settings = (currentWorkspace?.settings ?? {}) as Record<string, unknown>;
    const offered = Array.isArray(settings.store_languages) ? (settings.store_languages as unknown[]) : [];
    const own = (currentWorkspace?.defaultLocale ?? "").slice(0, 2).toLowerCase();
    const wanted = new Set<string>(["ar", "en", own, ...offered.map((l) => String(l).slice(0, 2).toLowerCase()), ...Object.keys(saved)]);
    return STORE_LOCALES.filter((l) => wanted.has(l) && allowed.has(l));
  }, [state.data, currentWorkspace, saved]);

  const locale: Locale = picked && locales.includes(picked) ? picked : (locales.find((l) => l === uiLocale) ?? locales[0] ?? "ar");
  const current = texts[locale] ?? {};
  const changedIn = (l: string) => Object.values(clean(texts)[l] ?? {}).length;
  const changedHere = changedIn(locale);

  // Arabic spellings fold (أ / ا, ة / ه, ى / ي), so a search finds the text however it was typed.
  const needle = normalizeSearch(query);
  const shown = STORE_TEXT_GROUPS.filter((g) => group === "all" || g.id === group)
    .map((g) => ({
      ...g,
      entries: g.entries.filter((entry) => {
        const value = current[entry.key] ?? "";
        if (changedOnly && !value.trim()) return false;
        if (!needle) return true;
        return [entry.key, defaultText(entry, locale), value].some((s) => normalizeSearch(s).includes(needle));
      }),
    }))
    .filter((g) => g.entries.length > 0);
  const shownCount = shown.reduce((sum, g) => sum + g.entries.length, 0);

  function edit(key: string, value: string) {
    setDraft((prev) => {
      const base = prev ?? saved;
      return { ...base, [locale]: { ...(base[locale] ?? {}), [key]: value } };
    });
    const path = `${locale}.${key}`;
    if (problems[path]) {
      setProblems((prev) => {
        const next = { ...prev };
        delete next[path];
        return next;
      });
    }
  }

  /** A server message in the dashboard's language: the known ones reworded, the rest kept when readable. */
  function problemText(message: string): string {
    const long = /at most (\d+) characters/i.exec(message);
    if (long) return fmt(t.tooLong, { max: long[1] });
    if (/^Key must/i.test(message)) return t.badKey;
    if (uiLocale === "ar" && !ARABIC_LETTER.test(message)) return t.checkText;
    return message || t.checkText;
  }

  async function save() {
    if (!draft) return;
    setSaving(true);
    try {
      const result = await storefrontTextsSave(apiClient, workspaceId, clean(draft));
      state.setData(result);
      setDraft(null);
      setProblems({});
      toast.success(t.saved);
    } catch (err) {
      const found = storefrontTextsErrors(err);
      setProblems(found);
      const paths = Object.keys(found);
      if (paths.length > 0) {
        // Open the language the first problem is in, so it is on screen.
        const first = paths.map((p) => p.split(".")[0]).find((l): l is Locale => (locales as string[]).includes(l));
        const target = first && !paths.some((p) => p.startsWith(`${locale}.`) || p === locale) ? first : locale;
        setPicked(target);
        setQuery("");
        setGroup("all");
        setChangedOnly(false);
        toast.error(t.fixRows);
        // Then take the merchant to the first marked text: its section opens by itself (a section
        // holding a marked text is never folded), so the field is there to scroll to.
        const row = paths.find((p) => p.startsWith(`${target}.`));
        if (row) {
          window.setTimeout(() => {
            const input = document.getElementById(`store-text-${row.slice(target.length + 1).replace(/\./g, "-")}`);
            input?.scrollIntoView({ block: "center" });
            input?.focus({ preventScroll: true });
          }, 60);
        }
      } else {
        toast.error(errorMessage(err));
      }
    } finally {
      setSaving(false);
    }
  }

  function discard() {
    setDraft(null);
    setProblems({});
  }

  const languageProblem = problems[locale];
  const resetFilters = () => {
    setGroup("all");
    setChangedOnly(false);
  };
  const clearFilters = () => {
    setQuery("");
    resetFilters();
  };
  const filterCount = (group !== "all" ? 1 : 0) + (changedOnly ? 1 : 0);

  const languageChips: ChipItem<Locale>[] = locales.map((l) => {
    const count = changedIn(l);
    // A language with nothing reworded carries no figure: a row of zeros says nothing.
    return { value: l, label: t[l], count: count > 0 ? count : undefined };
  });
  const sectionOptions: Array<{ value: GroupFilter; label: string }> = [
    { value: "all", label: t.allSections },
    ...STORE_TEXT_GROUPS.map((g) => ({ value: g.id, label: t[g.id] })),
  ];
  const showOptions: Array<{ value: "all" | "changed"; label: string }> = [
    { value: "all", label: t.everyText },
    { value: "changed", label: t.changedOnly },
  ];
  const activeChips: ActiveFilterChip[] = [
    ...(group !== "all"
      ? [{ id: "section", label: fmt(t.sectionChip, { name: t[group] }), onRemove: () => setGroup("all") }]
      : []),
    ...(changedOnly ? [{ id: "changed", label: t.changedOnly, onRemove: () => setChangedOnly(false) }] : []),
  ];

  return (
    <div className="max-w-5xl">
      <PageHeader
        title={t.title}
        description={t.description}
        back={{ to: "/website", label: t.back }}
        actions={
          state.data ? (
            <Button className="hidden md:inline-flex" disabled={!dirty || saving} onClick={() => void save()}>
              {saving ? t.saving : t.save}
            </Button>
          ) : undefined
        }
      />

      <DataState loading={state.loading} error={state.error} onRetry={() => void state.refresh()} skeleton="table">
        <div data-slot="store-texts" className="flex flex-col gap-3">
          <ListToolbar
            search={{ value: query, onChange: setQuery, placeholder: t.searchPlaceholder, label: t.search }}
            filters={{ count: filterCount, onOpen: () => setFiltersOpen(true) }}
          />
          <ChipRow
            items={languageChips}
            value={locale}
            onChange={(l) => setPicked(l)}
            label={t.language}
            collapseEmpty={false}
          />
          <ActiveFilters chips={activeChips} onClearAll={resetFilters} />

          {!INTERFACE_LOCALES.has(locale) && <Alert>{t.noInterface}</Alert>}
          {languageProblem && <Alert variant="danger">{problemText(languageProblem)}</Alert>}

          {changedHere === 0 && !changedOnly && (
            <p className="flex items-center gap-2 px-1 text-[13px] leading-5 text-ink-soft" role="status">
              <IconSuccess className="size-4 shrink-0 text-success" aria-hidden />
              {t.allDefault}
            </p>
          )}

          {shown.length === 0 ? (
            changedOnly && changedHere === 0 && !needle && group === "all" ? (
              <EmptyState
                icon={<IconText aria-hidden />}
                title={t.allDefault}
                description={t.allDefaultHint}
                action={
                  <Button variant="outline" className="rounded-full px-5" onClick={clearFilters}>
                    {t.clearFilters}
                  </Button>
                }
              />
            ) : (
              <EmptyState
                icon={<IconSearch aria-hidden />}
                title={t.noMatch}
                description={t.noMatchHint}
                action={
                  <Button variant="outline" className="rounded-full px-5" onClick={clearFilters}>
                    {t.clearFilters}
                  </Button>
                }
              />
            )
          ) : (
            // Each page of the store folds into one row with how much was changed there, so the
            // phone doesn't scroll through every text (re-audit N-19). Searching, a filter or a text
            // the last save refused opens them.
            <AccordionGroup>
              {shown.map((g) => {
                const total = STORE_TEXT_GROUPS.find((x) => x.id === g.id)?.entries.length ?? g.entries.length;
                const changed = g.entries.filter((entry) => (current[entry.key] ?? "").trim() !== "").length;
                const refused = g.entries.some((entry) => Boolean(problems[`${locale}.${entry.key}`]));
                const forceOpen = Boolean(needle) || changedOnly || group !== "all" || refused;
                return (
                  <AccordionSection
                    // A forced section is a fresh one: it opens, and is not remembered as the merchant's own choice.
                    key={`${g.id}-${forceOpen ? "open" : "folded"}`}
                    title={t[g.id]}
                    icon={GROUP_ICON[g.id]}
                    summary={changed > 0 ? fmt(t.groupCount, { changed, total }) : pluralOf(t, "texts", total)}
                    badge={
                      changed > 0 ? (
                        <span
                          data-slot="store-texts-count"
                          title={fmt(t.groupCount, { changed, total })}
                          className="zimos-texts-count inline-flex h-6 min-w-6 items-center justify-center rounded-full bg-primary-soft px-1.5 text-xs leading-none font-semibold text-primary-dark tabular-nums dark:text-primary"
                        >
                          {fmt("{n}", { n: changed })}
                        </span>
                      ) : undefined
                    }
                    defaultOpen={forceOpen}
                    persistKey={forceOpen ? undefined : `store-texts:${g.id}`}
                    flush
                  >
                    <ul className="divide-y divide-line">
                      {g.entries.map((entry) => (
                        <TextRow
                          key={entry.key}
                          entry={entry}
                          fallback={defaultText(entry, locale)}
                          dir={locale === "ar" ? "rtl" : "ltr"}
                          value={current[entry.key] ?? ""}
                          maxLength={maxText}
                          problem={problems[`${locale}.${entry.key}`] ? problemText(problems[`${locale}.${entry.key}`]) : undefined}
                          disabled={saving}
                          onChange={(value) => edit(entry.key, value)}
                          t={t}
                        />
                      ))}
                    </ul>
                  </AccordionSection>
                );
              })}
            </AccordionGroup>
          )}

          {/* Pinned above the phone dock (at the bottom edge from md up) while there is something to save. */}
          <SaveBar
            dirty={dirty}
            saving={saving}
            onSave={() => void save()}
            onDiscard={discard}
            message={t.unsaved}
            saveLabel={t.save}
            savingLabel={t.saving}
            discardLabel={t.discard}
          />
        </div>

        <FilterSheet
          open={filtersOpen}
          onOpenChange={setFiltersOpen}
          activeCount={filterCount}
          onReset={resetFilters}
          applyLabel={pluralOf(t, "apply", shownCount)}
        >
          <FilterGroup label={t.show}>
            <FilterChoice
              label={t.show}
              options={showOptions}
              value={changedOnly ? "changed" : "all"}
              onChange={(value) => setChangedOnly(value === "changed")}
            />
          </FilterGroup>
          <FilterGroup label={t.section}>
            <FilterChoice label={t.section} options={sectionOptions} value={group} onChange={(value) => setGroup(value ?? "all")} />
          </FilterGroup>
        </FilterSheet>
      </DataState>
    </div>
  );
}

function TextRow({
  entry,
  fallback,
  dir,
  value,
  maxLength,
  problem,
  disabled,
  onChange,
  t,
}: {
  entry: StoreTextEntry;
  fallback: string;
  /** The direction of the language being edited. */
  dir: "rtl" | "ltr";
  value: string;
  maxLength: number;
  problem?: string;
  disabled: boolean;
  onChange: (value: string) => void;
  t: Record<keyof (typeof STRINGS)["en"], string>;
}) {
  const id = `store-text-${entry.key.replace(/\./g, "-")}`;
  const changed = value.trim() !== "";
  const vars = entry.vars ?? [];
  const hintId = `${id}-hint`;
  const [varsBefore, varsAfter = ""] = t.placeholders.split("{list}");

  return (
    <li
      data-slot="store-text"
      data-changed={changed ? "" : undefined}
      className={cn(
        "zimos-text-row relative grid gap-2 px-4 py-3 sm:px-5 md:grid-cols-2 md:gap-4 md:py-3.5",
        // A reworded text carries the brand on its leading edge — and the word «متغيّر», never the colour alone.
        changed &&
          "before:absolute before:inset-y-3 before:start-0 before:w-[3px] before:rounded-e-full before:bg-primary before:content-['']"
      )}
    >
      {/* On a phone an untouched text is one field — its placeholder is the default wording; once it is
          reworded the default comes back over the field, to compare with. From md up it is always beside it. */}
      <div className={cn("min-w-0", !changed && "max-md:hidden")}>
        <p className="text-xs text-ink-soft">{t.default}</p>
        {/* The developer key (common.continueShopping) stays out of sight; hovering the default shows it (re-audit N-14). */}
        <p className="mt-0.5 break-words text-sm leading-6 text-ink" dir={dir} title={entry.key}>
          {fallback}
        </p>
      </div>
      <div className="min-w-0 space-y-1">
        <div className={cn("flex min-h-6 items-center justify-between gap-2", !changed && "max-md:hidden")}>
          <span className="flex min-w-0 items-center gap-2">
            <label htmlFor={id} aria-hidden className="text-xs text-ink-soft">
              {t.yours}
            </label>
            {changed && (
              <span
                data-slot="store-text-changed"
                className="zimos-text-changed inline-flex h-5 items-center rounded-full bg-primary-soft px-2 text-[11px] leading-none font-semibold text-primary-dark dark:text-primary"
              >
                {t.changed}
              </span>
            )}
          </span>
          {changed && (
            <button
              type="button"
              disabled={disabled}
              onClick={() => onChange("")}
              aria-label={fmt(t.resetAria, { text: fallback })}
              className="-my-2.5 inline-flex min-h-11 shrink-0 cursor-pointer items-center gap-1 rounded-full px-2 text-xs font-medium text-primary hover:underline focus-visible:outline-2 focus-visible:outline-primary disabled:cursor-default disabled:opacity-50 pointer-fine:-my-1 pointer-fine:min-h-8"
            >
              <IconRotateBack className="size-3.5" aria-hidden />
              {t.reset}
            </button>
          )}
        </div>
        <Input
          id={id}
          dir={dir}
          value={value}
          // The default wording, in the field itself: what shoppers read until something is typed over it.
          placeholder={fallback}
          aria-label={fmt(t.yoursFor, { text: fallback })}
          enterKeyHint="done"
          maxLength={maxLength}
          disabled={disabled}
          aria-invalid={problem ? true : undefined}
          aria-describedby={problem || vars.length ? hintId : undefined}
          onChange={(e) => onChange(e.target.value)}
          // 16px at every width: a phone never zooms into the field, and the text being typed reads like the store's.
          className={cn("h-11 text-base md:text-base", problem && "border-danger")}
        />
        {problem ? (
          <p id={hintId} className="text-xs font-medium text-danger">
            {problem}
          </p>
        ) : vars.length > 0 ? (
          <p id={hintId} className="text-xs leading-5 text-ink-soft">
            {varsBefore}
            <bdi dir="ltr" className="font-mono">
              {vars.map((v) => `{${v}}`).join(" ")}
            </bdi>
            {varsAfter}
            {" · "}
            {t.placeholdersHint}
          </p>
        ) : null}
      </div>
    </li>
  );
}
