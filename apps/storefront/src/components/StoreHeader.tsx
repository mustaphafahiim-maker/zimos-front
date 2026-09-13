import type { StorefrontMeta } from "@store-builder/api-client";
import { CartIcon } from "@/components/CartIcon";
import { StoreLink } from "@/components/StoreRoute";
import { ThemeToggle } from "@/components/ThemeToggle";

/**
 * The store's masthead. Shared by the home page and by any page the merchant
 * built in the website editor, so a custom page ("About us") sits under the
 * same branding and keeps the cart within reach instead of looking orphaned.
 */
export function StoreHeader({
  store,
  /** The home page is its own destination — don't link the title to itself. */
  linkHome = true,
}: {
  store: StorefrontMeta;
  linkHome?: boolean;
}) {
  const title = (
    <h1 className="font-display text-3xl font-medium" style={{ color: "var(--brand-primary)" }}>
      {store.name}
    </h1>
  );

  return (
    <header className="relative border-b border-line bg-paper-raised px-6 py-10 text-center">
      {/* Brand bar — the merchant's two colours, edge to edge. */}
      <div
        className="absolute inset-x-0 top-0 h-1"
        style={{
          backgroundImage:
            "linear-gradient(to right, var(--brand-primary), var(--brand-secondary))",
        }}
        aria-hidden
      />
      <div className="absolute right-4 top-4 flex items-center gap-2 sm:right-6 sm:top-6">
        <ThemeToggle />
        <CartIcon />
      </div>
      {store.logoUrl && (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={store.logoUrl} alt={store.name} className="mx-auto mb-4 h-10" />
      )}
      {linkHome ? (
        <StoreLink href="/" className="inline-block transition-opacity hover:opacity-80">
          {title}
        </StoreLink>
      ) : (
        title
      )}
      {store.tagline && <p className="mt-2 text-sm text-ink-soft">{store.tagline}</p>}
    </header>
  );
}
