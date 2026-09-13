import { ExternalLink } from "lucide-react";
import { cn } from "@store-builder/ui";
import { CopyButton } from "@/components/CopyButton";
import { storeHost, storeUrl } from "@/lib/storeAddress";

/**
 * The live link to a store, for the dashboard chrome.
 *
 * Shown on every page beside the store it belongs to, so a merchant never has
 * to go looking for their own address — and so switching stores visibly
 * switches the link with it.
 *
 * The host is what is drawn, not the full URL: the scheme is noise at this
 * size, and the host is the part a merchant reads back to a customer.
 */
export function StoreLinkBar({ slug, className }: { slug: string; className?: string }) {
  const url = storeUrl(slug);

  return (
    <div className={cn("flex min-w-0 items-center gap-1", className)}>
      <a
        href={url}
        target="_blank"
        rel="noreferrer"
        title={`Open ${url}`}
        className="inline-flex min-w-0 items-center gap-1.5 rounded-[0.5rem] px-2 py-1 text-xs font-medium text-ink-soft transition-colors hover:bg-paper hover:text-primary"
      >
        <ExternalLink className="size-3.5 shrink-0" aria-hidden />
        <span className="truncate">{storeHost(slug)}</span>
      </a>
      <CopyButton value={url} label="Copy link" labelClassName="hidden lg:inline" className="shrink-0" />
    </div>
  );
}
