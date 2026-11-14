import { socialLinksOf, textIn } from "@store-builder/ui/platform-info";
import { SocialLinks } from "@store-builder/ui/social-links";
import type { Locale } from "@/i18n/config";
import type { Dictionary } from "@/i18n/dictionary";
import { getPlatformSettings } from "@/lib/platform-settings";
import { companyDetails } from "@/lib/policies";
import { LocaleSwitcher } from "./locale-switcher";
import { ThemeToggle } from "./theme-toggle";
import { ZimosLogo } from "./zimos-logo";

/**
 * Two slim rows. Logo and tagline, then the links — pricing, contact and the
 * refund, terms and privacy pages among them; below, the © line, the legal
 * entity (name and commercial registration from src/content/policies.json,
 * tax registration number from src/lib/policies.ts), ZIMOS's social accounts
 * (packages/ui/src/social-links), the language switch and the light/dark
 * switch (on a computer the header has neither). Every link is
 * prefixed with the active locale; `#section` links go to the home page's
 * sections. The © year is computed at render.
 *
 * With PLATFORM_SETTINGS_ENABLED on, the tagline, the social accounts, the
 * name in the © line, its words and the legal entity come from the console
 * (lib/platform-settings.ts), each falling back to the values above when it
 * was never saved or the API can't be reached.
 */
export async function SiteFooter({
  copy,
  brand,
  locale,
}: {
  copy: Dictionary["footer"];
  brand: Dictionary["brand"];
  locale: Locale;
}) {
  const year = new Date().getFullYear();
  const settings = await getPlatformSettings();
  const company = companyDetails(locale, settings);
  const tagline = textIn(settings?.footer?.tagline, locale, brand.tomorrow);
  const rights = textIn(settings?.footer?.rights, locale, copy.rights);
  const name = settings?.company?.platformName ?? brand.name;

  return (
    <footer className="lz-foot">
      <div className="lz-in">
        <div className="lz-foot__row">
          <div className="lz-foot__brand">
            <ZimosLogo height={26} />
            <span>{tagline}</span>
          </div>
          <span className="lz-foot__spacer" />
          <nav aria-label={copy.navLabel}>
            <ul>
              {copy.links.map((link) => (
                <li key={link.href}>
                  <a href={`/${locale}${link.href}`}>{link.label}</a>
                </li>
              ))}
            </ul>
          </nav>
        </div>

        <div className="lz-foot__row">
          <p className="m-0">
            © {year} {name} · {rights}
          </p>
          <p className="m-0">
            {company.legalName} · {copy.registration}: <span dir="ltr">{company.registration}</span> ·{" "}
            {copy.taxRegistration}: <span dir="ltr">{company.taxRegistration}</span>
          </p>
          <span className="lz-foot__spacer" />
          <SocialLinks locale={locale} links={socialLinksOf(settings)} />
          <LocaleSwitcher />
          <ThemeToggle />
        </div>
      </div>
    </footer>
  );
}
