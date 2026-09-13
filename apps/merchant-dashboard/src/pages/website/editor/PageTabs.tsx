import { Home, Plus, X } from "lucide-react";
import { cn } from "@store-builder/ui";
import type { WebsitePage } from "@store-builder/api-client";
import { fmt, useT, type Messages } from "@/i18n/LocaleContext";

const STRINGS = {
  en: {
    homeDeleteHint:
      "The home page is protected from deletion — change its type first if you need to remove it.",
    deletePage: 'Delete "{title}"',
    newPage: "New page",
    pagesLabel: "Site pages",
  },
  ar: {
    homeDeleteHint:
      "الصفحة الرئيسية محمية من الحذف — غيّر نوعها أولًا إذا كنت تريد حذفها.",
    deletePage: "حذف «{title}»",
    newPage: "صفحة جديدة",
    pagesLabel: "صفحات الموقع",
  },
} satisfies Messages;

/**
 * Horizontal page switcher above the canvas. Each tab carries its own delete
 * button; the home page's is disabled, since the backend would happily delete
 * it and leave the site without an entry point.
 *
 * It is a plain flex row (no drag-and-drop), so it mirrors in RTL for free.
 */
export function PageTabs({
  pages,
  selectedId,
  onSelect,
  onDelete,
  onAdd,
}: {
  pages: WebsitePage[];
  selectedId: string | null;
  onSelect: (pageId: string) => void;
  onDelete: (page: WebsitePage) => void;
  onAdd: () => void;
}) {
  const t = useT(STRINGS);

  return (
    <nav
      aria-label={t.pagesLabel}
      className="flex items-center gap-2 overflow-x-auto border-b border-line bg-paper-raised px-4 py-2"
    >
      <ul className="flex min-w-0 items-center gap-1">
        {pages.map((page) => {
          const active = page.id === selectedId;
          // The home page is the site's entry point — deleting it would orphan
          // the site, so its delete button stays disabled.
          const home = page.pageType === "home";
          const deleteLabel = home ? t.homeDeleteHint : fmt(t.deletePage, { title: page.title });
          return (
            <li key={page.id} className="shrink-0">
              <div
                className={cn(
                  "group flex items-center gap-1 rounded-lg border ps-2.5 pe-1 transition-colors",
                  active
                    ? "border-primary bg-primary-soft"
                    : "border-transparent hover:border-line hover:bg-paper"
                )}
              >
                <button
                  type="button"
                  onClick={() => onSelect(page.id)}
                  aria-current={active ? "page" : undefined}
                  title={page.path}
                  className="cursor-pointer flex items-center gap-1.5 py-1.5 text-sm"
                >
                  {home && <Home className="size-3.5 shrink-0 text-ink-soft" aria-hidden />}
                  <span
                    dir="auto"
                    className={cn(
                      "max-w-40 truncate",
                      active ? "font-medium text-primary-dark" : "text-ink"
                    )}
                  >
                    {page.title}
                  </span>
                </button>
                <button
                  type="button"
                  onClick={() => onDelete(page)}
                  disabled={home}
                  title={deleteLabel}
                  aria-label={deleteLabel}
                  className={cn(
                    "rounded p-1 text-ink-soft transition-colors",
                    home
                      ? "cursor-not-allowed opacity-30"
                      : "cursor-pointer hover:bg-danger-soft hover:text-danger"
                  )}
                >
                  <X className="size-3.5" aria-hidden />
                </button>
              </div>
            </li>
          );
        })}
      </ul>

      <button
        type="button"
        onClick={onAdd}
        className="cursor-pointer ms-1 flex shrink-0 items-center gap-1 rounded-lg border border-dashed border-line px-2.5 py-1.5 text-sm font-medium text-ink-soft transition-colors hover:border-primary hover:text-primary"
      >
        <Plus className="size-3.5" aria-hidden />
        {t.newPage}
      </button>
    </nav>
  );
}
