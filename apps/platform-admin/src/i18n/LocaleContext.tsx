/**
 * Platform admin localisation — Arabic (RTL) and English (LTR).
 *
 * Same pattern as the merchant dashboard: each page declares its own STRINGS
 * next to its code and reads them with `useT(STRINGS)`. `ar` must mirror `en`.
 */
import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";

export type Locale = "en" | "ar";
const STORAGE_KEY = "zimos.admin.locale";

function readStored(): Locale {
  try {
    const v = localStorage.getItem(STORAGE_KEY);
    if (v === "ar" || v === "en") return v;
  } catch {
    /* private mode */
  }
  return "en";
}

let activeLocale: Locale = readStored();

/** Active locale for non-hook helpers (formatters). */
export function getLocale(): Locale {
  return activeLocale;
}

export function getIntlLocale(): string {
  return activeLocale === "ar" ? "ar-EG" : "en-US";
}

interface LocaleState {
  locale: Locale;
  setLocale: (next: Locale) => void;
  toggleLocale: () => void;
}

const LocaleContext = createContext<LocaleState | null>(null);

export function LocaleProvider({ children }: { children: ReactNode }) {
  const [locale, setLocaleState] = useState<Locale>(readStored);
  activeLocale = locale;

  useEffect(() => {
    activeLocale = locale;
    document.documentElement.lang = locale;
    document.documentElement.dir = locale === "ar" ? "rtl" : "ltr";
  }, [locale]);

  const setLocale = useCallback((next: Locale) => {
    setLocaleState(next);
    try {
      localStorage.setItem(STORAGE_KEY, next);
    } catch {
      /* ignore */
    }
  }, []);

  const value = useMemo<LocaleState>(
    () => ({ locale, setLocale, toggleLocale: () => setLocale(locale === "ar" ? "en" : "ar") }),
    [locale, setLocale]
  );
  return <LocaleContext.Provider value={value}>{children}</LocaleContext.Provider>;
}

export function useLocale(): LocaleState {
  const ctx = useContext(LocaleContext);
  if (!ctx) throw new Error("useLocale must be used inside <LocaleProvider>");
  return ctx;
}

export type Messages<K extends string = string> = { en: Record<K, string>; ar: Record<K, string> };

export function useT<K extends string>(messages: { en: Record<K, string>; ar: Record<NoInfer<K>, string> }): Record<K, string> {
  const { locale } = useLocale();
  return messages[locale];
}

/** "Hello {name}" + { name } → "Hello Sara" */
export function fmt(template: string, values: Record<string, string | number>): string {
  return template.replace(/\{(\w+)\}/g, (_, k: string) => (k in values ? String(values[k]) : `{${k}}`));
}

export const COMMON = {
  en: {
    save: "Save",
    cancel: "Cancel",
    edit: "Edit",
    create: "Create",
    close: "Close",
    confirm: "Confirm",
    working: "Working…",
    refresh: "Refresh",
    loading: "Loading…",
    retry: "Try again",
    loadMore: "Load more",
    all: "All",
    status: "Status",
    actions: "Actions",
    yes: "Yes",
    no: "No",
    viewAll: "View all",
    empty: "Nothing here yet.",
    permission: "This account doesn't have platform admin access.",
    saved: "Saved.",
  },
  ar: {
    save: "حفظ",
    cancel: "إلغاء",
    edit: "تعديل",
    create: "إنشاء",
    close: "إغلاق",
    confirm: "تأكيد",
    working: "جاري التنفيذ…",
    refresh: "تحديث",
    loading: "جاري التحميل…",
    retry: "جرّب تاني",
    loadMore: "حمّل أكتر",
    all: "الكل",
    status: "الحالة",
    actions: "إجراءات",
    yes: "أيوه",
    no: "لأ",
    viewAll: "شوف الكل",
    empty: "مفيش حاجة هنا لسه.",
    permission: "الحساب ده مالوش صلاحية أدمن المنصة.",
    saved: "اتحفظ.",
  },
} satisfies Messages;

export function useCommon() {
  return useT(COMMON);
}
