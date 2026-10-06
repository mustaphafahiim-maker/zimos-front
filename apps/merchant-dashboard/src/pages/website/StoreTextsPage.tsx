import { useMemo, useState } from "react";
import { CheckCircle2, RotateCcw, Search, Type } from "lucide-react";
import { Alert, Button, Input } from "@store-builder/ui";
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
import { useWorkspace } from "@/context/WorkspaceContext";
import { fmt, useLocale, useT, type Messages } from "@/i18n/LocaleContext";
import { PageHeader } from "@/components/PageHeader";
import { DataState } from "@/components/DataState";
import { EmptyState } from "@/components/EmptyState";
import { FilterTabs } from "@/components/FilterTabs";
import { Section } from "@/components/Section";
import { Select } from "@/components/Select";
import { useToast } from "@/components/Toast";
import { STORE_TEXT_GROUPS, type StoreTextEntry, type StoreTextGroupId } from "./storeTextsCatalog";

const STRINGS = {
  en: {
    title: "Store texts",
    description: "Change the words shoppers see on buttons, forms, cart and checkout.",
    back: "Website",
    language: "Language",
    ar: "Arabic",
    en: "English",
    fr: "French",
    es: "Spanish",
    it: "Italian",
    de: "German",
    withCount: "{name} ({count})",
    search: "Search texts",
    section: "Section",
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
    reset: "Reset",
    resetAria: "Reset “{text}” to the default",
    placeholders: "Placeholders: {list}",
    placeholdersHint: "Keep these as written; the store fills them in.",
    changedOnly: "Show changed only",
    allDefault: "All texts use the default wording",
    allDefaultHint: "Write your own text next to any default to change it. Leave it empty to keep the default.",
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
    back: "الموقع",
    language: "اللغة",
    ar: "العربية",
    en: "الإنجليزية",
    fr: "الفرنسية",
    es: "الإسبانية",
    it: "الإيطالية",
    de: "الألمانية",
    withCount: "{name} ({count})",
    search: "دوّر في النصوص",
    section: "القسم",
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
    reset: "رجّع الافتراضي",
    resetAria: "رجّع «{text}» للنص الافتراضي",
    placeholders: "المتغيرات: {list}",
    placeholdersHint: "سيبها زي ما هي، المتجر بيحط مكانها القيمة.",
    changedOnly: "اعرض المتغيّر بس",
    allDefault: "كل النصوص على الكلام الافتراضي",
    allDefaultHint: "اكتب النص بتاعك جنب أي نص افتراضي علشان تغيّره. سيب الخانة فاضية علشان يفضل الافتراضي.",
    noMatch: "مفيش نصوص بالكلام ده",
    noMatchHint: "جرّب كلمة تانية أو قسم تاني، أو اعرض كل النصوص.",
    clearFilters: "اعرض كل النصوص",
    noInterface:
      "العميل بيشوف أزرار المتجر بالعربي أو الإنجليزي أو الفرنساوي دلوقتي. النصوص اللي تكتبها للغة دي بتتحفظ وهتظهر أول ما المتجر يدعمها.",
    unsaved: "عندك تغييرات لسه ماتحفظتش",
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
 */
export function StoreTextsPage() {
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
  const [saving, setSaving] = useState(false);
  // Problems from the last save, keyed "ar.checkout.place" (or "ar" for a whole language).
  const [problems, setProblems] = useState<Record<string, string>>({});

  const saved = useMemo(() => state.data?.texts ?? {}, [state.data]);
  const texts = draft ?? saved;
  const dirty = draft !== null && !sameTexts(draft, saved);
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

  const needle = query.trim().toLowerCase();
  const shown = STORE_TEXT_GROUPS.filter((g) => group === "all" || g.id === group)
    .map((g) => ({
      ...g,
      entries: g.entries.filter((entry) => {
        const value = current[entry.key] ?? "";
        if (changedOnly && !value.trim()) return false;
        if (!needle) return true;
        return [entry.key, defaultText(entry, locale), value].some((s) => s.toLowerCase().includes(needle));
      }),
    }))
    .filter((g) => g.entries.length > 0);

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
        // Then take the merchant to the first marked text.
        const row = paths.find((p) => p.startsWith(`${target}.`));
        if (row) {
          window.setTimeout(() => {
            const input = document.getElementById(`store-text-${row.slice(target.length + 1).replace(/\./g, "-")}`);
            input?.scrollIntoView({ block: "center" });
            input?.focus({ preventScroll: true });
          }, 0);
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
  const clearFilters = () => {
    setQuery("");
    setGroup("all");
    setChangedOnly(false);
  };

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

      <DataState loading={state.loading} error={state.error} onRetry={() => void state.refresh()}>
        <div className="space-y-4">
          <FilterTabs
            label={t.language}
            value={locale}
            onChange={(l) => setPicked(l)}
            tabs={locales.map((l) => {
              const count = changedIn(l);
              return { value: l, label: count > 0 ? fmt(t.withCount, { name: t[l], count }) : t[l] };
            })}
          />

          {!INTERFACE_LOCALES.has(locale) && <Alert>{t.noInterface}</Alert>}
          {languageProblem && <Alert variant="danger">{problemText(languageProblem)}</Alert>}

          <div className="flex flex-wrap items-center gap-3">
            <div className="relative min-w-[12rem] flex-1">
              <Search className="pointer-events-none absolute start-3 top-1/2 size-4 -translate-y-1/2 text-ink-soft" aria-hidden />
              <Input
                type="search"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder={t.search}
                aria-label={t.search}
                className="ps-9"
              />
            </div>
            <Select aria-label={t.section} className="w-auto" value={group} onChange={(e) => setGroup(e.target.value as GroupFilter)}>
              <option value="all">{t.allSections}</option>
              {STORE_TEXT_GROUPS.map((g) => (
                <option key={g.id} value={g.id}>
                  {t[g.id]}
                </option>
              ))}
            </Select>
            <label className="flex min-h-11 cursor-pointer items-center gap-2 text-sm text-ink">
              <input
                type="checkbox"
                className="size-4 accent-primary"
                checked={changedOnly}
                onChange={(e) => setChangedOnly(e.target.checked)}
              />
              {t.changedOnly}
            </label>
          </div>

          {changedHere === 0 && !changedOnly && (
            <p className="flex items-center gap-2 rounded-[var(--radius-card)] bg-paper-sunken px-4 py-3 text-sm text-ink-soft" role="status">
              <CheckCircle2 className="size-4 shrink-0 text-success" aria-hidden />
              {t.allDefault}
            </p>
          )}

          {shown.length === 0 ? (
            changedOnly && changedHere === 0 && !needle && group === "all" ? (
              <EmptyState icon={<Type aria-hidden />} title={t.allDefault} description={t.allDefaultHint} />
            ) : (
              <EmptyState
                icon={<Search aria-hidden />}
                title={t.noMatch}
                description={t.noMatchHint}
                action={
                  <Button variant="outline" onClick={clearFilters}>
                    {t.clearFilters}
                  </Button>
                }
              />
            )
          ) : (
            shown.map((g) => (
              <Section key={g.id} title={t[g.id]}>
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
              </Section>
            ))
          )}

          {dirty && (
            <div
              className="sticky bottom-[calc(4.75rem+env(safe-area-inset-bottom))] z-20 flex flex-wrap items-center justify-between gap-3 rounded-[var(--radius-card)] bg-paper-raised px-4 py-3 shadow-[var(--shadow-raised)] ring-1 ring-line md:bottom-4"
              role="region"
              aria-label={t.unsaved}
            >
              <p className="text-sm font-medium text-ink">{t.unsaved}</p>
              <div className="flex gap-2">
                <Button variant="outline" className="min-h-11 md:min-h-0" disabled={saving} onClick={discard}>
                  {t.discard}
                </Button>
                <Button className="min-h-11 md:min-h-0" disabled={saving} onClick={() => void save()}>
                  {saving ? t.saving : t.save}
                </Button>
              </div>
            </div>
          )}
        </div>
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
    <li className="grid gap-2 py-3 first:pt-0 last:pb-0 md:grid-cols-2 md:gap-4">
      <div className="min-w-0">
        <p className="text-xs text-ink-soft">{t.default}</p>
        {/* The developer key (common.continueShopping) stays out of sight; hovering the default shows it (re-audit N-14). */}
        <p className="mt-0.5 break-words text-sm text-ink" dir={dir} title={entry.key}>
          {fallback}
        </p>
      </div>
      <div className="min-w-0 space-y-1">
        <div className="flex items-center justify-between gap-2">
          <label htmlFor={id} className="text-xs text-ink-soft">
            {t.yours}
          </label>
          {changed && (
            <button
              type="button"
              disabled={disabled}
              onClick={() => onChange("")}
              aria-label={fmt(t.resetAria, { text: fallback })}
              className="inline-flex min-h-8 cursor-pointer items-center gap-1 text-xs font-medium text-primary hover:underline disabled:cursor-default disabled:opacity-50"
            >
              <RotateCcw className="size-3.5" aria-hidden />
              {t.reset}
            </button>
          )}
        </div>
        <Input
          id={id}
          dir={dir}
          value={value}
          maxLength={maxLength}
          disabled={disabled}
          aria-invalid={problem ? true : undefined}
          aria-describedby={problem || vars.length ? hintId : undefined}
          onChange={(e) => onChange(e.target.value)}
          className={problem ? "border-danger" : undefined}
        />
        {problem ? (
          <p id={hintId} className="text-xs font-medium text-danger">
            {problem}
          </p>
        ) : vars.length > 0 ? (
          <p id={hintId} className="text-xs text-ink-soft">
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
