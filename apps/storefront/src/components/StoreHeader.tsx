"use client";

import type { StorefrontMeta } from "@store-builder/api-client";
import { StoreLink, useIsStoreHome } from "@/components/StoreRoute";
import { ZimosLogo } from "@/components/ZimosLogo";
import { getDictionary, type Locale } from "@/lib/i18n";
import { announcementOf } from "@/lib/storeAnnouncement";
import { AnnouncementBar } from "./AnnouncementBar";
import { CartIcon } from "./CartIcon";
import { LanguageSwitch } from "./LanguageSwitch";
import { MobileMenu } from "./MobileMenu";
import { StickyHeader } from "./StickyHeader";
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
 *
 * Above it, only when the store payload carries one, the merchant's
 * announcement line. The shell (StickyHeader) adds a shadow and trims the bar
 * once the page scrolls under it; on a phone the links move into a sheet.
 *
 * On the home page only, before the visitor scrolls, the whole bar goes
 * transparent-over-hero instead: `useIsStoreHome` reads which route is
 * showing (never what the page looks like) and hands that down as
 * `transparent`, and `data-overlay` — set by StickyHeader exactly when that
 * opt-in and "not scrolled yet" both hold — is what switches the logo and the
 * nav text to a light treatment below, the same way `data-scrolled` already
 * drives the bar's height.
 */
export function StoreHeader({ store, locale }: { store: StorefrontMeta; locale: Locale }) {
  const t = getDictionary(locale);
  const announcement = announcementOf(store);
  const isHome = useIsStoreHome();

  return (
    <StickyHeader transparent={isHome}>
      {announcement && <AnnouncementBar announcement={announcement} label={t.shop.announcement} />}
      {/* Brand bar — the merchant's two colours, edge to edge. Hidden while
          overlaid: a coloured hairline floating over a hero photo reads as a
          rendering glitch, not a brand touch. */}
      <div
        className="h-1 w-full transition-opacity duration-200 group-data-[overlay]/header:opacity-0 motion-reduce:transition-none"
        style={{
          backgroundImage:
            "linear-gradient(to right, var(--brand-primary), var(--brand-secondary))",
        }}
        aria-hidden
      />
      <div
        className={`${container} flex h-16 items-center justify-between gap-3 transition-[height] duration-200 group-data-[scrolled]/header:h-14 motion-reduce:transition-none`}
      >
        {/* data-store-logo lets the editor preview swap in an unsaved logo; it
            changes nothing about how the header renders. */}
        <StoreLink
          href="/"
          data-store-logo=""
          className="flex min-h-11 min-w-0 items-center gap-3 rounded-lg transition-opacity hover:opacity-85"
        >
          {store.logoUrl ? (
            // Merchant logos are arbitrary remote URLs (no next/image allowlist).
            // A small light chip keeps an arbitrary-coloured logo legible while
            // overlaid; it disappears the moment the bar solidifies.
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={store.logoUrl}
              alt=""
              width={40}
              height={40}
              className="h-10 w-10 shrink-0 rounded-xl object-contain transition-[background-color,box-shadow] duration-200 group-data-[overlay]/header:bg-white/90 group-data-[overlay]/header:p-1 group-data-[overlay]/header:shadow-sm motion-reduce:transition-none"
            />
          ) : (
            // `.zimos-logo[data-overlay ancestor]` forces the dark-surface
            // (light wordmark) export regardless of the `auto` surface prop —
            // see the header rules in globals.css.
            <ZimosLogo height={32} surface="auto" className="shrink-0" />
          )}
          <span className="truncate font-display text-lg font-bold text-ink transition-colors duration-200 group-data-[overlay]/header:text-white motion-reduce:transition-none">
            {store.name}
          </span>
        </StoreLink>

        <nav aria-label={t.common.menu} className="flex items-center gap-2">
          <StoreLink
            href="/track"
            className="hidden min-h-11 items-center rounded-xl px-3 text-sm font-medium text-ink-soft transition-colors hover:bg-primary-soft hover:text-primary sm:inline-flex group-data-[overlay]/header:text-white group-data-[overlay]/header:hover:bg-white/10 group-data-[overlay]/header:hover:text-white"
          >
            {t.common.trackOrder}
          </StoreLink>
          <LanguageSwitch />
          {/* On a phone the theme toggle lives in the menu sheet; a wrapper hides
              it here because the button's own recipe sets its display. */}
          <span className="hidden sm:contents">
            <ThemeToggle />
          </span>
          <CartIcon />
          <MobileMenu storeName={store.name} />
        </nav>
      </div>
    </StickyHeader>
  );
}
