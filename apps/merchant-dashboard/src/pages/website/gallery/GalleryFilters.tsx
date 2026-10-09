import type { StarterTemplateLanguage, StarterTemplatePrice, StarterTemplateSort, WebsiteTemplateSummary } from "@store-builder/api-client";
import { Field } from "@/components/Field";
import { Select } from "@/components/Select";
import { useT, type Messages } from "@/i18n/LocaleContext";
import { pluralOf } from "@/lib/plural";

const STRINGS = {
  en: {
    group: "Sort and filter templates",
    sortBy: "Sort by",
    sort_name: "Name",
    sort_newest: "Newest",
    sort_most_used: "Most used",
    price: "Price",
    language: "Language",
    all: "All",
    free: "Free",
    paid: "Paid",
    arabic: "Arabic",
    english: "English",
    used_one: "Used once",
    used_other: "Used {n} times",
    isNew: "New",
    noMatchTitle: "No templates match these filters",
    clearFilters: "Clear filters",
  },
  ar: {
    group: "ترتيب وفلترة القوالب",
    sortBy: "ترتيب حسب",
    sort_name: "الاسم",
    sort_newest: "الأحدث",
    sort_most_used: "الأكثر استخدامًا",
    price: "السعر",
    language: "اللغة",
    all: "الكل",
    free: "مجاني",
    paid: "مدفوع",
    arabic: "عربي",
    english: "إنجليزي",
    used_one: "اتستخدم مرة واحدة",
    used_two: "اتستخدم مرتين",
    used_few: "اتستخدم {n} مرات",
    used_other: "اتستخدم {n} مرة",
    isNew: "جديد",
    noMatchTitle: "مفيش قوالب بالفلاتر دي",
    clearFilters: "امسح الفلاتر",
  },
} satisfies Messages;

/** What the gallery asks the catalogue for besides the category (handoff 401). */
export interface GalleryQuery {
  sort: StarterTemplateSort;
  price: StarterTemplatePrice | "all";
  language: Extract<StarterTemplateLanguage, "ar" | "en"> | "all";
}

export const DEFAULT_GALLERY_QUERY: GalleryQuery = { sort: "name", price: "all", language: "all" };

/** True when the price or the language narrows the catalogue (the sort never empties it). */
export function galleryQueryNarrows(query: GalleryQuery): boolean {
  return query.price !== "all" || query.language !== "all";
}

/** The wording of the gallery's "nothing fits" state. */
export function useGalleryFilterText() {
  const t = useT(STRINGS);
  return { noMatchTitle: t.noMatchTitle, clearFilters: t.clearFilters };
}

const SORTS: readonly StarterTemplateSort[] = ["name", "newest", "most_used"];
const FIELD = "h-11 w-full text-base md:h-9 md:text-sm";

/**
 * The template gallery's sort menu and its price and language filters (handoff
 * 401): three small selects in a row over the search, two to a row on a phone.
 * The catalogue is asked again on a change; the category chips stay put.
 */
export function GalleryFilters({ value, onChange }: { value: GalleryQuery; onChange: (next: GalleryQuery) => void }) {
  const t = useT(STRINGS);
  return (
    <div role="group" aria-label={t.group} data-slot="gallery-filters" className="mb-3 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:max-w-2xl">
      <Field label={t.sortBy} className="max-sm:col-span-2">
        {(field) => (
          <Select {...field} className={FIELD} value={value.sort} onChange={(e) => onChange({ ...value, sort: e.target.value as StarterTemplateSort })}>
            {SORTS.map((sort) => (
              <option key={sort} value={sort}>
                {t[`sort_${sort}`]}
              </option>
            ))}
          </Select>
        )}
      </Field>
      <Field label={t.price}>
        {(field) => (
          <Select {...field} className={FIELD} value={value.price} onChange={(e) => onChange({ ...value, price: e.target.value as GalleryQuery["price"] })}>
            <option value="all">{t.all}</option>
            <option value="free">{t.free}</option>
            <option value="paid">{t.paid}</option>
          </Select>
        )}
      </Field>
      <Field label={t.language}>
        {(field) => (
          <Select {...field} className={FIELD} value={value.language} onChange={(e) => onChange({ ...value, language: e.target.value as GalleryQuery["language"] })}>
            <option value="all">{t.all}</option>
            <option value="ar">{t.arabic}</option>
            <option value="en">{t.english}</option>
          </Select>
        )}
      </Field>
    </div>
  );
}

/** «اتستخدم ٣ مرات» under a card's kind; «جديد» for a template nobody has used yet. Nothing when the catalogue sent no count. */
export function TemplateUses({ template }: { template: WebsiteTemplateSummary }) {
  const t = useT(STRINGS);
  const uses = (template as { usesCount?: unknown }).usesCount;
  if (typeof uses !== "number") return null;
  return (
    <span data-slot="template-uses" className="block truncate text-xs leading-4 text-ink-soft">
      {uses > 0 ? pluralOf(t, "used", uses) : t.isNew}
    </span>
  );
}
