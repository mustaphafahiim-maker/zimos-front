import Link from "next/link";
import type { StorefrontMeta } from "@store-builder/api-client";
import { getDictionary, type Locale } from "@/lib/i18n";
import { PoweredByZimos } from "./PoweredByZimos";
import { container } from "./ui";

export function StoreFooter({
  store,
  workspaceId,
  locale,
}: {
  store: StorefrontMeta;
  workspaceId: string;
  locale: Locale;
}) {
  const t = getDictionary(locale);
  const base = `/store/${workspaceId}`;
  const link =
    "inline-flex min-h-11 items-center text-sm text-ink-soft transition-colors hover:text-primary sm:min-h-9";

  return (
    <footer className="mt-auto border-t border-line bg-paper-raised">
      <div className={`${container} grid gap-8 py-10 sm:grid-cols-3`}>
        <div>
          <p className="text-base font-bold text-ink">{store.name}</p>
          {store.tagline && <p className="mt-2 max-w-xs text-sm leading-relaxed text-ink-soft">{store.tagline}</p>}
        </div>

        <nav aria-label={t.footer.links}>
          <p className="text-sm font-semibold text-ink">{t.footer.links}</p>
          <ul className="mt-2">
            <li><Link href={base} className={link}>{t.common.home}</Link></li>
            <li><Link href={`${base}/cart`} className={link}>{t.common.cart}</Link></li>
            <li><Link href={`${base}/track`} className={link}>{t.common.trackOrder}</Link></li>
            <li><Link href={`${base}/my-orders`} className={link}>{t.myOrders.nav}</Link></li>
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
          <p className="text-xs text-ink-muted">{t.footer.rights(store.name, new Date().getFullYear())}</p>
          <PoweredByZimos label={t.footer.poweredBy} />
        </div>
      </div>
    </footer>
  );
}
