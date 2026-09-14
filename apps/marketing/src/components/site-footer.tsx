import type { Locale } from "@/i18n/config";
import type { Dictionary } from "@/i18n/dictionary";
import { LocaleSwitcher } from "./locale-switcher";
import { container } from "./ui";
import { ZimosLogo } from "./zimos-logo";

/**
 * Logo, tagline, four link columns and the language switch. Every link is
 * prefixed with the active locale: `/pricing` → `/ar/pricing`, and home-page
 * anchors `#faq` → `/ar#faq` so they also work from inner pages.
 * The © year is computed at render.
 */
export function SiteFooter({
  copy,
  brand,
  locale,
}: {
  copy: Dictionary["footer"];
  brand: Dictionary["brand"];
  locale: Locale;
}) {
  const year = new Date().getFullYear();

  return (
    <footer className="border-t border-line bg-paper-raised">
      <div className={`${container} py-14 sm:py-16`}>
        <div className="grid gap-12 lg:grid-cols-[minmax(0,1fr)_minmax(0,2fr)]">
          <div className="max-w-xs">
            <ZimosLogo height={32} />
            <p className="mt-6 text-sm leading-relaxed text-ink-soft">{brand.tomorrow}</p>
            <div className="mt-6 flex items-center gap-3">
              <span className="text-sm text-ink-soft">{copy.languageLabel}</span>
              <LocaleSwitcher />
            </div>
          </div>

          <nav aria-label={copy.navLabel} className="grid grid-cols-2 gap-8 sm:grid-cols-4">
            {copy.columns.map((column) => (
              <div key={column.title}>
                <h2 className="text-sm font-semibold text-ink">{column.title}</h2>
                <ul className="mt-4 space-y-3">
                  {column.links.map((link) => (
                    <li key={link.href}>
                      <a
                        href={`/${locale}${link.href}`}
                        className="text-sm text-ink-soft transition-colors hover:text-primary"
                      >
                        {link.label}
                      </a>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </nav>
        </div>

        <p className="mt-12 border-t border-line pt-6 text-sm text-ink-soft">
          © {year} {brand.name} · {copy.rights}
        </p>
      </div>
    </footer>
  );
}
