import { useEffect, useId, useMemo, useRef, useState, type KeyboardEvent as ReactKeyboardEvent } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import type { LucideIcon } from "lucide-react";
import {
  ArrowRight,
  Clock,
  CornerDownLeft,
  Headphones,
  Languages,
  Plus,
  Search,
  SearchX,
  Sparkles,
  SunMoon,
  Tag,
  Workflow,
} from "lucide-react";
import { cn } from "@store-builder/ui";
import { fmt, useLocale, useT } from "@/i18n/LocaleContext";
import { NAV_ITEMS, findNavItem, type LocalizedText } from "@/lib/navigation";
import { useLocalStorage } from "@/lib/useLocalStorage";
import { toggleTheme } from "@/components/ThemeToggle";

const STRINGS = {
  en: {
    title: "Command palette",
    placeholder: "Search pages and actions…",
    recent: "Recent",
    actions: "Quick actions",
    pages: "Go to",
    empty: "No results for “{query}”",
    emptyHint: "Try a page name like “Orders” or an action like “discount”.",
    navigate: "to navigate",
    open: "to open",
    close: "to close",
  },
  ar: {
    title: "لوحة الأوامر",
    placeholder: "ابحث في الصفحات والإجراءات…",
    recent: "الأخيرة",
    actions: "إجراءات سريعة",
    pages: "انتقل إلى",
    empty: "لا توجد نتائج لـ «{query}»",
    emptyHint: "جرّب اسم صفحة مثل «الطلبات» أو إجراء مثل «خصم».",
    navigate: "للتنقل",
    open: "للفتح",
    close: "للإغلاق",
  },
};

const RECENT_KEY = "zimos.nav.recent";
const MAX_RECENT = 5;

/** Records visited dashboard destinations (by nav route) and returns them, newest first. */
export function useRecentPages(): string[] {
  const location = useLocation();
  const [recent, setRecent] = useLocalStorage<string[]>(RECENT_KEY, []);
  useEffect(() => {
    const item = findNavItem(location.pathname);
    if (!item) return;
    setRecent((prev) => (prev[0] === item.to ? prev : [item.to, ...prev.filter((p) => p !== item.to)].slice(0, MAX_RECENT)));
  }, [location.pathname, setRecent]);
  return recent;
}

function isTypingTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  return target.isContentEditable || ["INPUT", "TEXTAREA", "SELECT"].includes(target.tagName);
}

/** Case-, diacritic- and hamza-insensitive text for matching Arabic and English. */
function normalize(s: string): string {
  return s
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f\u064b-\u065f\u0670\u0640]/g, "")
    .replace(/[أإآ]/g, "ا")
    .replace(/ى/g, "ي")
    .replace(/ة/g, "ه")
    .trim();
}

type Section = "recent" | "actions" | "pages";

interface Entry {
  id: string;
  section: Section;
  label: LocalizedText;
  hint?: string;
  icon: LucideIcon;
  run: () => void;
}

interface CommandPaletteProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  recent: string[];
}

export function CommandPalette({ open, onOpenChange, recent }: CommandPaletteProps) {
  const openRef = useRef(open);
  openRef.current = open;

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && !e.altKey && e.key.toLowerCase() === "k") {
        e.preventDefault();
        onOpenChange(!openRef.current);
        return;
      }
      if (e.key === "/" && !e.ctrlKey && !e.metaKey && !openRef.current && !isTypingTarget(e.target)) {
        e.preventDefault();
        onOpenChange(true);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onOpenChange]);

  if (!open) return null;
  return <PaletteDialog onClose={() => onOpenChange(false)} recent={recent} />;
}

function PaletteDialog({ onClose, recent }: { onClose: () => void; recent: string[] }) {
  const t = useT(STRINGS);
  const { locale, toggleLocale } = useLocale();
  const navigate = useNavigate();
  const [query, setQuery] = useState("");
  const [active, setActive] = useState(0);
  const listId = useId();
  const optionPrefix = useId();
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const previouslyFocused = document.activeElement as HTMLElement | null;
    inputRef.current?.focus();
    return () => previouslyFocused?.focus?.();
  }, []);

  const entries = useMemo<Entry[]>(() => {
    const go = (to: string) => () => navigate(to);
    const actions: Entry[] = [
      { id: "a-funnel", section: "actions", label: { en: "Create funnel", ar: "إنشاء مسار بيع" }, icon: Workflow, run: go("/funnels") },
      { id: "a-product", section: "actions", label: { en: "Add product", ar: "إضافة منتج" }, icon: Plus, run: go("/catalog/new") },
      { id: "a-discount", section: "actions", label: { en: "Create discount", ar: "إنشاء خصم" }, icon: Tag, run: go("/discounts") },
      { id: "a-automation", section: "actions", label: { en: "New automation", ar: "أتمتة جديدة" }, icon: Sparkles, run: go("/automations") },
      { id: "a-callcenter", section: "actions", label: { en: "Open call center", ar: "فتح مركز الاتصال" }, icon: Headphones, run: go("/call-center") },
      { id: "a-theme", section: "actions", label: { en: "Toggle theme", ar: "تبديل المظهر" }, icon: SunMoon, run: toggleTheme },
      {
        id: "a-language",
        section: "actions",
        label: { en: "Switch language (العربية)", ar: "تغيير اللغة (English)" },
        icon: Languages,
        run: toggleLocale,
      },
    ];
    const recentEntries: Entry[] = recent
      .map((to) => NAV_ITEMS.find((i) => i.to === to))
      .filter((i): i is (typeof NAV_ITEMS)[number] => Boolean(i))
      .map((i) => ({ id: `r-${i.to}`, section: "recent", label: i.label, hint: i.to, icon: Clock, run: go(i.to) }));
    const pages: Entry[] = NAV_ITEMS.map((i) => ({
      id: `p-${i.to}`,
      section: "pages",
      label: i.label,
      hint: i.to,
      icon: i.icon,
      run: go(i.to),
    }));
    return [...recentEntries, ...actions, ...pages];
  }, [navigate, recent, toggleLocale]);

  const results = useMemo(() => {
    const q = normalize(query);
    if (!q) return entries;
    const tokens = q.split(/\s+/);
    return entries.filter((e) => {
      if (e.section === "recent") return false;
      const hay = normalize(`${e.label.en} ${e.label.ar} ${e.hint ?? ""}`);
      return tokens.every((tok) => hay.includes(tok));
    });
  }, [entries, query]);

  const safeActive = results.length === 0 ? -1 : Math.min(active, results.length - 1);
  const activeId = safeActive >= 0 ? `${optionPrefix}-${results[safeActive].id}` : undefined;

  useEffect(() => {
    if (activeId) document.getElementById(activeId)?.scrollIntoView({ block: "nearest" });
  }, [activeId]);

  function runEntry(entry: Entry) {
    onClose();
    entry.run();
  }

  function onKeyDown(e: ReactKeyboardEvent<HTMLInputElement>) {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      if (results.length) setActive((safeActive + 1) % results.length);
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      if (results.length) setActive((safeActive - 1 + results.length) % results.length);
    } else if (e.key === "Home") {
      e.preventDefault();
      setActive(0);
    } else if (e.key === "End") {
      e.preventDefault();
      setActive(Math.max(results.length - 1, 0));
    } else if (e.key === "Enter") {
      e.preventDefault();
      if (safeActive >= 0) runEntry(results[safeActive]);
    } else if (e.key === "Escape") {
      e.preventDefault();
      onClose();
    }
  }

  const sectionLabel: Record<Section, string> = { recent: t.recent, actions: t.actions, pages: t.pages };

  return (
    <div
      className="fixed inset-0 z-[55] flex items-start justify-center bg-zimos-navy/40 p-4 pt-[10vh]"
      onMouseDown={onClose}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label={t.title}
        className="animate-zimos-slide-up flex max-h-[75vh] w-full max-w-xl flex-col overflow-hidden rounded-[20px] border border-line bg-paper-raised shadow-[var(--shadow-pop)]"
        onMouseDown={(e) => e.stopPropagation()}
      >
        <div className="flex items-center gap-3 border-b border-line px-4">
          <Search className="size-[18px] shrink-0 text-ink-muted" aria-hidden />
          <input
            ref={inputRef}
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setActive(0);
            }}
            onKeyDown={onKeyDown}
            placeholder={t.placeholder}
            role="combobox"
            aria-expanded="true"
            aria-controls={listId}
            aria-activedescendant={activeId}
            aria-autocomplete="list"
            autoComplete="off"
            spellCheck={false}
            className="h-14 w-full bg-transparent text-[15px] text-ink outline-none placeholder:text-ink-muted"
          />
          <kbd className="hidden rounded-md border border-line px-1.5 py-0.5 text-[11px] text-ink-muted sm:inline" dir="ltr">
            Esc
          </kbd>
        </div>

        <div id={listId} role="listbox" aria-label={t.title} className="scroll-thin flex-1 overflow-y-auto p-2">
          {results.length === 0 ? (
            <div className="flex flex-col items-center px-6 py-10 text-center">
              <span className="mb-3 flex size-10 items-center justify-center rounded-2xl bg-primary-soft text-primary">
                <SearchX className="size-5" aria-hidden />
              </span>
              <p className="text-sm font-medium text-ink">{fmt(t.empty, { query })}</p>
              <p className="mt-1 text-xs text-ink-muted">{t.emptyHint}</p>
            </div>
          ) : (
            results.map((entry, index) => {
              const showHeading = index === 0 || results[index - 1].section !== entry.section;
              const selected = index === safeActive;
              return (
                <div key={entry.id} role="presentation">
                  {showHeading && (
                    <div
                      role="presentation"
                      className={cn(
                        "px-2.5 pb-1 text-[11px] font-semibold uppercase tracking-wider text-ink-muted rtl:tracking-normal",
                        index === 0 ? "pt-1" : "pt-3"
                      )}
                    >
                      {sectionLabel[entry.section]}
                    </div>
                  )}
                  <div
                    id={`${optionPrefix}-${entry.id}`}
                    role="option"
                    aria-selected={selected}
                    onMouseMove={() => index !== safeActive && setActive(index)}
                    onClick={() => runEntry(entry)}
                    className={cn(
                      "flex cursor-pointer items-center gap-3 rounded-[10px] px-2.5 py-2 text-sm",
                      selected ? "bg-primary-soft text-primary" : "text-ink"
                    )}
                  >
                    <span
                      className={cn(
                        "flex size-8 shrink-0 items-center justify-center rounded-[10px] border",
                        selected ? "border-primary/20 bg-paper-raised text-primary" : "border-line bg-paper text-ink-soft"
                      )}
                    >
                      <entry.icon className="size-4" aria-hidden />
                    </span>
                    <span className="min-w-0 flex-1 truncate font-medium">{entry.label[locale]}</span>
                    {entry.hint && (
                      <span className="hidden shrink-0 text-xs text-ink-muted sm:inline" dir="ltr">
                        {entry.hint}
                      </span>
                    )}
                    {selected && <ArrowRight className="size-4 shrink-0 rtl:-scale-x-100" aria-hidden />}
                  </div>
                </div>
              );
            })
          )}
        </div>

        <div className="hidden items-center gap-4 border-t border-line px-4 py-2.5 text-[11px] text-ink-muted sm:flex">
          <span className="flex items-center gap-1.5">
            <kbd className="rounded border border-line px-1" dir="ltr">
              ↑↓
            </kbd>
            {t.navigate}
          </span>
          <span className="flex items-center gap-1.5">
            <kbd className="flex items-center rounded border border-line px-1">
              <CornerDownLeft className="size-3" aria-hidden />
            </kbd>
            {t.open}
          </span>
          <span className="flex items-center gap-1.5">
            <kbd className="rounded border border-line px-1" dir="ltr">
              Esc
            </kbd>
            {t.close}
          </span>
        </div>
      </div>
    </div>
  );
}
