"use client";

import { StoreLink } from "@/components/StoreRoute";
import type { ResolvedShellLink } from "@/lib/storeShell";

/**
 * One of the merchant's header or footer links. Store pages go through
 * StoreLink (which adds the store's prefix); an address on another site opens
 * in a new tab, so the shopper keeps their place in the store.
 */
export function ShellLink({ link, className }: { link: ResolvedShellLink; className: string }) {
  if (link.external) {
    return (
      <a href={link.href} target="_blank" rel="noopener noreferrer" className={className}>
        {link.label}
      </a>
    );
  }
  return (
    <StoreLink href={link.href} className={className}>
      {link.label}
    </StoreLink>
  );
}
