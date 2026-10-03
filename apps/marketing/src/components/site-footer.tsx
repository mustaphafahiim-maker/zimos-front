import { SocialLinks } from "@store-builder/ui/social-links";
import type { Locale } from "@/i18n/config";
import type { Dictionary } from "@/i18n/dictionary";
import { companyDetails } from "@/lib/policies";
import { LocaleSwitcher } from "./locale-switcher";
import { container } from "./ui";
import { ZimosLogo } from "./zimos-logo";

/**
 * Logo, tagline, ZIMOS's social accounts (packages/ui/src/social-links), the
 * link columns — pricing, contact and the refund, terms and privacy pages
 * among them — the language switch, and the legal entity
 * (name and commercial registration, from src/content/policies.json). Every
 * link is prefixed with the active locale; `#section` links go to the home
 * page's sections. The © year is computed at render.
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
  const company = companyDetails(locale);

  return (
    <footer className="border-t border-line bg-paper-raised">
      <div className={`${container} py-14 sm:py-16`}>
        <div className="grid gap-12 lg:grid-cols-[minmax(0,1fr)_minmax(0,2fr)]">
          <div className="max-w-xs">
            <ZimosLogo height={32} />
            <p className="mt-6 text-sm leading-relaxed text-ink-soft">{brand.tomorrow}</p>
            <SocialLinks locale={locale} className="mt-6" />
            <div className="mt-6 flex items-center gap-3">
              <span className="text-sm text-ink-soft">{copy.languageLabel}</span>
              <LocaleSwitcher />
            </div>
          </div>

          <nav aria-label={copy.navLabel} className="grid grid-cols-2 gap-8 sm:grid-cols-3">
            {copy.columns.map((column) => (
              <div key={column.title}>
                <h2 className="text-sm font-semibold text-ink">{column.title}</h2>
                <ul className="mt-4 space-y-3">
                  {column.links.map((link) => (
                    <li key={link.href}>
                      <a
                        href={`/${locale}${link.href}`}
                        className="inline-flex min-h-11 items-center text-sm text-ink-soft transition-colors hover:text-primary sm:min-h-0"
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

        <div className="mt-12 flex flex-col gap-1 border-t border-line pt-6 text-sm text-ink-soft sm:flex-row sm:flex-wrap sm:justify-between">
          <p>
            © {year} {brand.name} · {copy.rights}
          </p>
          <p>
            {company.legalName} · {copy.registration}: <span dir="ltr">{company.registration}</span>
          </p>
        </div>
      </div>
    </footer>
  );
}
