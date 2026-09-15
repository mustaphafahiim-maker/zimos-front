import { ZimosLogo } from "./ZimosLogo";

/**
 * The only place ZIMOS appears inside a merchant's store. The store's own
 * branding owns every other surface, so this stays deliberately quiet: small
 * type in the footer's bottom rule, next to the mark at nav size.
 */
export function PoweredByZimos({ label }: { label: string }) {
  return (
    <a
      href="https://zimos.co"
      target="_blank"
      rel="noopener noreferrer"
      className="inline-flex min-h-11 items-center gap-2 rounded-lg px-1 text-xs text-ink-soft transition-opacity hover:opacity-80"
    >
      <span>{label}</span>
      <ZimosLogo height={18} />
    </a>
  );
}
