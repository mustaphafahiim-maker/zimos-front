import Link from "next/link";
import type { StorefrontCollection, StorefrontMeta } from "@store-builder/api-client";
import { paymentBadgeList, type ThemeSettings } from "@store-builder/store-renderer";
import { getDictionary, type Locale } from "@/lib/i18n";
import { storePhone } from "@/lib/storeLocale";
import { CashIcon, PhoneIcon } from "./Icons";
import { PoweredByZimos } from "./PoweredByZimos";
import { container } from "./ui";

const GRID: Record<2 | 3 | 4, string> = {
  2: "sm:grid-cols-2",
  3: "sm:grid-cols-2 lg:grid-cols-[1.5fr_1fr_1fr]",
  4: "sm:grid-cols-2 lg:grid-cols-[1.5fr_1fr_1fr_1fr]",
};

export function StoreFooter({
  store,
  workspaceId,
  locale,
  theme,
  collections,
}: {
  store: StorefrontMeta;
  workspaceId: string;
  locale: Locale;
  theme: ThemeSettings;
  collections: StorefrontCollection[];
}) {
  const t = getDictionary(locale);
  const base = `/store/${workspaceId}`;
  const columns = theme.footer.columns;
  const phone = storePhone(store);
  const badges = paymentBadgeList(theme);
  const about = theme.footer.about || store.tagline || "";
  const social = theme.footer.showSocial ? theme.footer.social : [];
  const link =
    "inline-flex min-h-11 items-center text-sm text-ink-soft transition-colors hover:text-primary focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary sm:min-h-9";
  const heading = "text-sm font-bold text-ink";

  return (
    <footer className="mt-auto border-t border-line bg-paper-raised">
      <div className={`${container} grid gap-8 py-12 ${GRID[columns]}`}>
        <div className="max-w-sm">
          <p className="text-lg font-extrabold text-ink">{store.name}</p>
          {about && <p className="mt-2 text-sm leading-relaxed text-ink-soft">{about}</p>}
          {social.length > 0 && (
            <div className="mt-4">
              <h2 className="sr-only">{t.store.followUs}</h2>
              <ul className="flex flex-wrap gap-2">
                {social.map((s) => (
                  <li key={s.url}>
                    <a
                      href={s.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex min-h-11 items-center rounded-full border border-line px-4 text-sm font-medium text-ink-soft transition-colors hover:border-primary hover:text-primary"
                    >
                      {s.platform || s.url}
                    </a>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>

        {columns >= 3 && (
          <nav aria-labelledby="footer-shop">
            <h2 id="footer-shop" className={heading}>
              {t.store.shop}
            </h2>
            <ul className="mt-2">
              <li>
                <Link href={`${base}?search=1#products`} className={link}>
                  {t.store.allProducts}
                </Link>
              </li>
              {collections.slice(0, 5).map((c) => (
                <li key={c.id}>
                  <Link href={`${base}/collections/${encodeURIComponent(c.slug || c.id)}`} className={link}>
                    {c.name}
                  </Link>
                </li>
              ))}
            </ul>
          </nav>
        )}

        <nav aria-labelledby="footer-help">
          <h2 id="footer-help" className={heading}>
            {t.footer.help}
          </h2>
          <ul className="mt-2">
            <li><Link href={`${base}/track`} className={link}>{t.common.trackOrder}</Link></li>
            <li><Link href={`${base}/my-orders`} className={link}>{t.myOrders.nav}</Link></li>
            <li><Link href={`${base}/cart`} className={link}>{t.common.cart}</Link></li>
          </ul>
        </nav>

        {columns >= 4 && (
          <div>
            <h2 className={heading}>{t.store.contact}</h2>
            <ul className="mt-3 space-y-3 text-sm text-ink-soft">
              {phone && (
                <li>
                  <a href={`tel:${phone.replace(/[^\d+]/g, "")}`} dir="ltr" className="inline-flex min-h-11 items-center gap-2 transition-colors hover:text-primary sm:min-h-9">
                    <PhoneIcon size={18} />
                    {phone}
                  </a>
                </li>
              )}
              <li className="flex items-center gap-2">
                <CashIcon size={18} />
                {t.trust.cod}
              </li>
            </ul>
          </div>
        )}
      </div>

      <div className="border-t border-line">
        <div className={`${container} flex flex-col items-center justify-between gap-3 py-5 sm:flex-row`}>
          <p className="text-xs text-ink-muted">{theme.footer.copyright || t.footer.rights(store.name, new Date().getFullYear())}</p>
          {badges.length > 0 && (
            <ul aria-label={t.store.paymentMethods} className="flex flex-wrap items-center justify-center gap-2">
              {badges.map((b) => (
                <li key={b} className="rounded-md border border-line bg-paper px-2.5 py-1 text-xs font-semibold text-ink-soft">
                  {b}
                </li>
              ))}
            </ul>
          )}
          <PoweredByZimos label={t.footer.poweredBy} />
        </div>
      </div>
    </footer>
  );
}
