import type { StorefrontMeta } from "@store-builder/api-client";
import { StoreLink } from "@/components/StoreRoute";
import { getDictionary, type Locale } from "@/lib/i18n";
import { PoweredByZimos } from "./PoweredByZimos";
import { container } from "./ui";

export function StoreFooter({ store, locale }: { store: StorefrontMeta; locale: Locale }) {
  const t = getDictionary(locale);
  const link =
    "inline-flex min-h-11 items-center text-sm text-ink-soft transition-colors hover:text-primary sm:min-h-9";

  return (
    <footer className="mt-auto border-t border-line bg-paper-raised">
      <div className={`${container} grid gap-8 py-10 sm:grid-cols-3`}>
        <div>
          <p className="font-display text-base font-bold text-ink">{store.name}</p>
          {store.tagline && (
            <p className="mt-2 max-w-xs text-sm leading-relaxed text-ink-soft">{store.tagline}</p>
          )}
        </div>

        <nav aria-label={t.footer.links}>
          <p className="text-sm font-semibold text-ink">{t.footer.links}</p>
          <ul className="mt-2">
            <li><StoreLink href="/" className={link}>{t.common.home}</StoreLink></li>
            <li><StoreLink href="/cart" className={link}>{t.common.cart}</StoreLink></li>
            <li><StoreLink href="/track" className={link}>{t.common.trackOrder}</StoreLink></li>
          </ul>
        </nav>

        <div>
          <p className="text-sm font-semibold text-ink">{t.footer.help}</p>
          <ul className="mt-2 space-y-2 text-sm text-ink-soft">
            <li>{t.trust.cod}</li>
            <li>{t.trust.fast}</li>
            <li>{t.trust.returns}</li>
          </ul>
        </div>
      </div>

      <div className="border-t border-line">
        <div className={`${container} flex flex-col items-center justify-between gap-2 py-4 sm:flex-row`}>
          <p className="text-xs text-ink-soft">{t.footer.rights(store.name, new Date().getFullYear())}</p>
          <PoweredByZimos label={t.footer.poweredBy} />
        </div>
      </div>
    </footer>
  );
}
