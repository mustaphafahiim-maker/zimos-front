"use client";

import { createContext, useContext, useMemo, useState, type ReactNode } from "react";
import type { StorefrontMeta } from "@store-builder/api-client";
import { announcementOf, type StoreAnnouncement } from "./storeAnnouncement";
import {
  readFooterShell,
  readHeaderShell,
  type FooterShell,
  type HeaderShell,
  type ShellOverride,
} from "./storeShell";

export type { ShellOverride };

interface ShellOverrideState {
  override: ShellOverride | null;
  setOverride: (next: ShellOverride | null) => void;
}

const ShellOverrideContext = createContext<ShellOverrideState | null>(null);

/**
 * Holds the website editor's unsaved header/footer settings while its preview
 * is open (see ShellOverride in lib/storeShell.ts). Only the preview bridge
 * (components/preview/PreviewBridge) ever sets one; on a shopper's page it
 * stays null and the header and footer render from the store's saved
 * themeSettings, exactly as before.
 */
export function StoreShellProvider({ children }: { children: ReactNode }) {
  const [override, setOverride] = useState<ShellOverride | null>(null);
  const value = useMemo(() => ({ override, setOverride }), [override]);
  return <ShellOverrideContext value={value}>{children}</ShellOverrideContext>;
}

const noop = () => {};

/** For the preview bridge: show these (unsaved) settings instead of the saved ones. */
export function useSetShellOverride(): (next: ShellOverride | null) => void {
  return useContext(ShellOverrideContext)?.setOverride ?? noop;
}

export interface StoreShell {
  header: HeaderShell;
  footer: FooterShell;
  announcement: StoreAnnouncement | null;
}

/** The header, footer and announcement bar this store shows right now. */
export function useStoreShell(store: StorefrontMeta): StoreShell {
  const override = useContext(ShellOverrideContext)?.override ?? null;
  return useMemo(() => {
    if (!override) {
      return {
        header: readHeaderShell(store.themeSettings),
        footer: readFooterShell(store.themeSettings),
        announcement: announcementOf(store),
      };
    }
    const themeSettings: Record<string, unknown> = { ...(store.themeSettings ?? {}) };
    if (override.header) themeSettings.header = override.header;
    else delete themeSettings.header;
    if (override.footer) themeSettings.footer = override.footer;
    else delete themeSettings.footer;
    return {
      header: readHeaderShell(themeSettings),
      footer: readFooterShell(themeSettings),
      // Through announcementOf itself, so the preview keeps its precedence rules.
      announcement: announcementOf({ ...store, themeSettings }),
    };
  }, [store, override]);
}
