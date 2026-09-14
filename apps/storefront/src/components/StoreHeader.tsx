import Link from "next/link";
import type { StorefrontCollection, StorefrontMeta } from "@store-builder/api-client";
import type { ThemeSettings } from "@store-builder/store-renderer";
import { getDictionary, type Locale } from "@/lib/i18n";
import { HeaderSearchButton } from "./catalog/HeaderSearchButton";
import { CartIcon } from "./CartIcon";
import { LanguageSwitch } from "./LanguageSwitch";
import { MobileMenu, type MenuLink } from "./MobileMenu";
import { storeHref } from "./StoreRenderer";
import { container } from "./ui";

/**
 * The store's masthead: optional announcement bar, sticky header with logo,
 * desktop nav, search, language, cart badge, and a drawer menu on mobile.
 * Layout, stickiness, search and the announcement follow ThemeSettings.
 * Carries the merchant's identity only, never ZIMOS branding.
 */
export function StoreHeader({
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
  const centered = theme.header.layout === "logo-center";
  const announcement = theme.header.announcement;

  const nav: MenuLink[] = [
    { href: base, label: t.common.home },
    { href: `${base}?search=1#products`, label: t.store.allProducts },
    ...collections.slice(0, centered ? 2 : 3).map((c) => ({
      href: `${base}/collections/${encodeURIComponent(c.slug || c.id)}`,
      label: c.name,
    })),
    { href: `${base}/track`, label: t.common.trackOrder },
  ];
  const drawerLinks: MenuLink[] = [
    ...nav.slice(0, 2),
    ...collections.slice(0, 12).map((c) => ({ href: `${base}/collections/${encodeURIComponent(c.slug || c.id)}`, label: c.name })),
    { href: `${base}/track`, label: t.common.trackOrder },
    { href: `${base}/my-orders`, label: t.myOrders.nav },
    { href: `${base}/cart`, label: t.common.cart },
  ];

  const logo = (
    <Link
      href={base}
      className="flex min-h-11 min-w-0 items-center gap-2.5 rounded-lg transition-opacity hover:opacity-85 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
    >
      {store.logoUrl ? (
        // Merchant logos are arbitrary remote URLs (no next/image allowlist).
        // eslint-disable-next-line @next/next/no-img-element
        <img src={store.logoUrl} alt="" width={40} height={40} className="h-10 w-10 shrink-0 rounded-xl object-contain" />
      ) : (
        <span aria-hidden className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary text-lg font-extrabold text-primary-foreground">
          {store.name.trim().charAt(0).toUpperCase()}
        </span>
      )}
      <span className="truncate text-lg font-extrabold tracking-tight text-ink">{store.name}</span>
    </Link>
  );

  const desktopNav = (
    <nav aria-label={t.store.mainNav} className="hidden lg:block">
      <ul className="flex items-center gap-0.5">
        {nav.map((link) => (
          <li key={link.href + link.label}>
            <Link
              href={link.href}
              className="inline-flex min-h-11 items-center rounded-xl px-3 text-sm font-semibold text-ink-soft transition-colors hover:bg-primary-soft hover:text-primary focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
            >
              {link.label}
            </Link>
          </li>
        ))}
      </ul>
    </nav>
  );

  const actions = (
    <div className="flex items-center gap-1.5 sm:gap-2">
      {theme.header.showSearch && <HeaderSearchButton workspaceId={workspaceId} />}
      <LanguageSwitch />
      <CartIcon workspaceId={workspaceId} />
    </div>
  );

  const menu = (
    <MobileMenu
      links={drawerLinks}
      storeName={store.name}
      labels={{ open: t.store.openMenu, close: t.store.closeMenu, nav: t.store.mainNav }}
    />
  );

  return (
    <>
      {announcement.enabled && announcement.text && (
        <div className="zr-announce">
          <div className="zr-announce__inner">
            {announcement.href ? (
              <Link href={storeHref(announcement.href, workspaceId)} className="inline-flex min-h-9 items-center underline-offset-4 hover:underline">
                {announcement.text}
              </Link>
            ) : (
              <p className="m-0">{announcement.text}</p>
            )}
          </div>
        </div>
      )}
      <header
        className={`${theme.header.sticky ? "sticky top-0" : "relative"} z-30 border-b border-line bg-paper-raised/90 backdrop-blur-md supports-[backdrop-filter]:bg-paper-raised/80`}
      >
        {centered ? (
          <div className={`${container} grid h-16 grid-cols-[1fr_auto_1fr] items-center gap-3 md:h-[4.5rem]`}>
            <div className="flex min-w-0 items-center gap-1">
              {menu}
              {desktopNav}
            </div>
            <div className="min-w-0 justify-self-center">{logo}</div>
            <div className="justify-self-end">{actions}</div>
          </div>
        ) : (
          <div className={`${container} flex h-16 items-center justify-between gap-3 md:h-[4.5rem]`}>
            <div className="flex min-w-0 items-center gap-2 lg:gap-6">
              {menu}
              {logo}
              {desktopNav}
            </div>
            {actions}
          </div>
        )}
      </header>
    </>
  );
}
