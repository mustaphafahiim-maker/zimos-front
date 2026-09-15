import { useEffect, useMemo, useRef, useState, type ComponentType } from "react";
import { useNavigate } from "react-router-dom";
import { Building2, CornerDownLeft, Search } from "lucide-react";
import { Kbd, Spinner, cn } from "@store-builder/ui";
import { NAV_GROUPS } from "@/components/navConfig";
import { Status } from "@/components/StatusBadge";
import { adminApi, type AdminWorkspaceRow } from "@/lib/adminApi";
import { fmt, useLocale, useT } from "@/i18n/LocaleContext";

const STRINGS = {
  en: {
    workspaces: "Workspaces",
    pages: "Pages",
    dialog: "Command palette",
    placeholder: "Search pages or workspaces (name, id)…",
    command: "Command",
    loading: "Loading workspaces…",
    loadFailed: "Couldn't load workspaces — showing pages only.",
    noResults: "No results for “{q}”.",
    navigate: "navigate",
    open: "open",
  },
  ar: {
    workspaces: "مساحات العمل",
    pages: "الصفحات",
    dialog: "البحث السريع",
    placeholder: "دوّر على صفحة أو مساحة عمل (الاسم أو الـ id)…",
    command: "أمر",
    loading: "جاري تحميل مساحات العمل…",
    loadFailed: "مقدرناش نحمّل مساحات العمل — بنعرض الصفحات بس.",
    noResults: "مفيش نتايج لـ “{q}”.",
    navigate: "تنقّل",
    open: "افتح",
  },
};

interface PaletteItem {
  id: string;
  section: "workspaces" | "pages";
  label: string;
  hint?: string;
  icon: ComponentType<{ className?: string }>;
  status?: string;
  run: () => void;
}

export function CommandPalette({ open, onClose }: { open: boolean; onClose: () => void }) {
  const navigate = useNavigate();
  const { locale } = useLocale();
  const t = useT(STRINGS);
  const [query, setQuery] = useState("");
  const [active, setActive] = useState(0);
  const [workspaces, setWorkspaces] = useState<AdminWorkspaceRow[] | null>(null);
  const [failed, setFailed] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLUListElement>(null);

  useEffect(() => {
    if (!open) return;
    setQuery("");
    setActive(0);
    window.setTimeout(() => inputRef.current?.focus(), 0);
    let cancelled = false;
    setFailed(false);
    adminApi
      .listWorkspaces()
      .then((rows) => !cancelled && setWorkspaces(rows))
      .catch(() => {
        if (cancelled) return;
        setWorkspaces([]);
        setFailed(true);
      });
    return () => {
      cancelled = true;
    };
  }, [open]);

  const items = useMemo<PaletteItem[]>(() => {
    const go = (to: string) => {
      onClose();
      navigate(to);
    };
    const q = query.trim().toLowerCase();
    const match = (s: string) => !q || s.toLowerCase().includes(q);
    const wsItems: PaletteItem[] = q
      ? (workspaces ?? [])
          .filter((w) => match(`${w.workspaceName} ${w.workspaceId} ${w.plan}`))
          .slice(0, 6)
          .map((w) => ({ id: `ws-${w.workspaceId}`, section: "workspaces", label: w.workspaceName, hint: `${w.plan} · ${w.workspaceId}`, icon: Building2, status: w.status, run: () => go(`/workspaces/${w.workspaceId}`) }))
      : [];
    const pages: PaletteItem[] = NAV_GROUPS.flatMap((g) =>
      g.items
        .filter((i) => match(`${i.label.en} ${i.label.ar} ${g.label?.en ?? ""} ${g.label?.ar ?? ""} ${i.keywords ?? ""}`))
        .map((i) => ({ id: `page-${i.to}`, section: "pages" as const, label: i.label[locale], hint: g.label?.[locale], icon: i.icon, run: () => go(i.to) }))
    );
    return [...wsItems, ...pages];
  }, [query, workspaces, locale, navigate, onClose]);

  useEffect(() => {
    setActive(0);
  }, [query]);

  useEffect(() => {
    listRef.current?.querySelector<HTMLElement>(`[data-index="${active}"]`)?.scrollIntoView({ block: "nearest" });
  }, [active]);

  if (!open) return null;

  let lastSection = "";

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center bg-zimos-navy/40 p-4 pt-[12vh] backdrop-blur-[2px]" onMouseDown={onClose}>
      <div
        role="dialog"
        aria-modal="true"
        aria-label={t.dialog}
        onMouseDown={(e) => e.stopPropagation()}
        className="animate-zimos-slide-up w-full max-w-xl overflow-hidden rounded-[var(--radius-modal)] border border-line bg-paper-raised shadow-[var(--shadow-pop)]"
      >
        <div className="flex items-center gap-2 border-b border-line px-4">
          <Search className="size-4 text-ink-muted" aria-hidden />
          <input
            ref={inputRef}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "ArrowDown") {
                e.preventDefault();
                setActive((i) => Math.min(i + 1, items.length - 1));
              } else if (e.key === "ArrowUp") {
                e.preventDefault();
                setActive((i) => Math.max(i - 1, 0));
              } else if (e.key === "Enter") {
                e.preventDefault();
                items[active]?.run();
              } else if (e.key === "Escape") {
                onClose();
              }
            }}
            placeholder={t.placeholder}
            aria-label={t.command}
            role="combobox"
            aria-expanded="true"
            aria-controls="palette-list"
            className="h-12 flex-1 bg-transparent text-sm text-ink outline-none placeholder:text-ink-muted"
          />
          <Kbd>Esc</Kbd>
        </div>
        {failed && query.trim() && <p className="border-b border-line px-4 py-2 text-xs text-warning">{t.loadFailed}</p>}
        {workspaces === null && query.trim() ? (
          <div className="flex items-center gap-2 px-4 py-6 text-sm text-ink-soft">
            <Spinner /> {t.loading}
          </div>
        ) : items.length === 0 ? (
          <p className="px-4 py-6 text-center text-sm text-ink-soft">{fmt(t.noResults, { q: query.trim() })}</p>
        ) : (
          <ul id="palette-list" ref={listRef} role="listbox" className="scroll-thin max-h-[60vh] overflow-y-auto py-2">
            {items.map((item, i) => {
              const header = item.section !== lastSection ? t[item.section] : null;
              lastSection = item.section;
              return (
                <li key={item.id} role="presentation">
                  {header && <p className="px-4 pt-2 pb-1 text-[11px] font-semibold tracking-wider text-ink-muted uppercase">{header}</p>}
                  <button
                    type="button"
                    role="option"
                    data-index={i}
                    aria-selected={i === active}
                    onMouseEnter={() => setActive(i)}
                    onClick={item.run}
                    className={cn("flex w-full cursor-pointer items-center gap-3 px-4 py-2 text-start text-sm", i === active && "bg-primary-soft")}
                  >
                    <item.icon className="size-4 shrink-0 text-ink-soft" />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate font-medium text-ink">{item.label}</span>
                      {item.hint && <span className="block truncate text-xs text-ink-soft">{item.hint}</span>}
                    </span>
                    {item.status && <Status value={item.status} />}
                    {i === active && <CornerDownLeft className="size-3.5 text-ink-muted rtl:-scale-x-100" aria-hidden />}
                  </button>
                </li>
              );
            })}
          </ul>
        )}
        <div className="flex items-center gap-3 border-t border-line px-4 py-2 text-xs text-ink-soft">
          <span>
            <Kbd>↑</Kbd> <Kbd>↓</Kbd> {t.navigate}
          </span>
          <span>
            <Kbd>Enter</Kbd> {t.open}
          </span>
        </div>
      </div>
    </div>
  );
}
