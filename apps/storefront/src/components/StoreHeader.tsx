import Link from "next/link";
import type { StorefrontMeta } from "@store-builder/api-client";
import { getDictionary, type Locale } from "@/lib/i18n";
import { CartIcon } from "./CartIcon";
import { LanguageSwitch } from "./LanguageSwitch";
import { ThemeToggle } from "./ThemeToggle";
import { container } from "./ui";

/**
 * The store's masthead, rendered once by the store layout for every page. It
 * carries the merchant's identity (logo / name), never ZIMOS branding.
 */
export function StoreHeader({
  store,
  workspaceId,
  locale,
}: {
  store: StorefrontMeta;
  workspaceId: string;
  locale: Locale;
}) {
  const t = getDictionary(locale);

  return (
    <header className="sticky top-0 z-30 border-b border-line bg-paper-raised/95 backdrop-blur supports-[backdrop-filter]:bg-paper-raised/85">
      <div
        className="h-1 w-full"
        style={{ backgroundImage: "linear-gradient(to right, var(--brand-primary), var(--brand-secondary))" }}
        aria-hidden
      />
      <div className={`${container} flex h-16 items-center justify-between gap-3`}>
        <Link
          href={`/store/${workspaceId}`}
          className="flex min-h-11 min-w-0 items-center gap-3 rounded-lg transition-opacity hover:opacity-85"
        >
          {store.logoUrl ? (
            // Merchant logos are arbitrary remote URLs (no next/image allowlist).
            // eslint-disable-next-line @next/next/no-img-element
            <img src={store.logoUrl} alt="" width={40} height={40} className="h-10 w-10 shrink-0 rounded-xl object-contain" />
          ) : (
            <span
              aria-hidden
              className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary text-lg font-bold text-white"
            >
              {store.name.trim().charAt(0).toUpperCase()}
            </span>
          )}
          <span className="truncate text-lg font-bold text-ink">{store.name}</span>
        </Link>

        <nav aria-label={t.common.menu} className="flex items-center gap-2">
          <Link
            href={`/store/${workspaceId}/track`}
            className="hidden min-h-11 items-center rounded-xl px-3 text-sm font-medium text-ink-soft transition-colors hover:bg-primary-soft hover:text-primary sm:inline-flex"
          >
            {t.common.trackOrder}
          </Link>
          <LanguageSwitch />
          <ThemeToggle className="hidden sm:inline-flex" />
          <CartIcon workspaceId={workspaceId} />
        </nav>
      </div>
    </header>
  );
}
