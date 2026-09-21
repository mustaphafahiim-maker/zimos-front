import type { StorefrontMeta } from "@store-builder/api-client";
import { StoreLink } from "@/components/StoreRoute";
import { ZimosLogo } from "@/components/ZimosLogo";
import { getDictionary, type Locale } from "@/lib/i18n";
import { CartIcon } from "./CartIcon";
import { LanguageSwitch } from "./LanguageSwitch";
import { ThemeToggle } from "./ThemeToggle";
import { container } from "./ui";

/**
 * The store's masthead, rendered once by the store layout for every page — so a
 * page the merchant built in the website editor ("About us") sits under the
 * same branding and keeps the cart within reach instead of looking orphaned.
 *
 * It carries the merchant's identity — their logo when they have uploaded one,
 * and their name either way. A store that has not uploaded a logo yet falls
 * back to the ZIMOS lockup, which is otherwise confined to the footer's
 * "Powered by" line.
 */
export function StoreHeader({ store, locale }: { store: StorefrontMeta; locale: Locale }) {
  const t = getDictionary(locale);

  return (
    <header className="sticky top-0 z-30 border-b border-line bg-paper-raised/95 backdrop-blur supports-[backdrop-filter]:bg-paper-raised/85">
      {/* Brand bar — the merchant's two colours, edge to edge. */}
      <div
        className="h-1 w-full"
        style={{
          backgroundImage:
            "linear-gradient(to right, var(--brand-primary), var(--brand-secondary))",
        }}
        aria-hidden
      />
      <div className={`${container} flex h-16 items-center justify-between gap-3`}>
        {/* data-store-logo lets the editor preview swap in an unsaved logo; it
            changes nothing about how the header renders. */}
        <StoreLink
          href="/"
          data-store-logo=""
          className="flex min-h-11 min-w-0 items-center gap-3 rounded-lg transition-opacity hover:opacity-85"
        >
          {store.logoUrl ? (
            // Merchant logos are arbitrary remote URLs (no next/image allowlist).
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={store.logoUrl}
              alt=""
              width={40}
              height={40}
              className="h-10 w-10 shrink-0 rounded-xl object-contain"
            />
          ) : (
            <ZimosLogo height={32} surface="auto" className="shrink-0" />
          )}
          <span className="truncate font-display text-lg font-bold text-ink">{store.name}</span>
        </StoreLink>

        <nav aria-label={t.common.menu} className="flex items-center gap-2">
          <StoreLink
            href="/track"
            className="hidden min-h-11 items-center rounded-xl px-3 text-sm font-medium text-ink-soft transition-colors hover:bg-primary-soft hover:text-primary sm:inline-flex"
          >
            {t.common.trackOrder}
          </StoreLink>
          <LanguageSwitch />
          <ThemeToggle className="hidden sm:inline-flex" />
          <CartIcon />
        </nav>
      </div>
    </header>
  );
}
