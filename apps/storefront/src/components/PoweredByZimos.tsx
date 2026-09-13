import { ZimosLogo } from "@store-builder/ui";

/** The only place ZIMOS appears inside a merchant's store. */
export function PoweredByZimos({ label }: { label: string }) {
  return (
    <a
      href="https://zimos.co"
      target="_blank"
      rel="noopener noreferrer"
      className="inline-flex min-h-11 items-center gap-2 rounded-lg px-1 text-xs text-ink-muted transition-opacity hover:opacity-80"
    >
      <span>{label}</span>
      <ZimosLogo height={18} />
    </a>
  );
}
