import type { PageTree } from "@store-builder/api-client";

/**
 * Draft page trees posted by the dashboard's live preview, held briefly in
 * memory so the preview page can render them with the real storefront
 * components. Nothing here is ever served to shoppers: a tree is only
 * reachable through its random token, and only for the workspace it was
 * posted for.
 *
 * Kept on `globalThis` because a route handler and a page can load separate
 * copies of this module (notably in `next dev`), and both must see one Map.
 * This is per process: a deployment with several storefront instances needs a
 * shared store here instead.
 */

export interface PreviewEntry {
  workspaceId: string;
  tree: PageTree;
  expiresAt: number;
}

const TTL_MS = 15 * 60 * 1000;
const MAX_ENTRIES = 200;

type Store = Map<string, PreviewEntry>;
const holder = globalThis as typeof globalThis & { __storefrontPreviewStore?: Store };

function store(): Store {
  holder.__storefrontPreviewStore ??= new Map();
  return holder.__storefrontPreviewStore;
}

function sweep(now: number) {
  const entries = store();
  for (const [token, entry] of entries) {
    if (entry.expiresAt <= now) entries.delete(token);
  }
  // Map iteration is insertion order, so the first key is the oldest.
  while (entries.size > MAX_ENTRIES) {
    const oldest = entries.keys().next().value;
    if (oldest === undefined) break;
    entries.delete(oldest);
  }
}

/** The workspace a live token belongs to, or null when the token is free. */
export function previewOwner(token: string): string | null {
  const entry = store().get(token);
  return entry && entry.expiresAt > Date.now() ? entry.workspaceId : null;
}

export function putPreview(token: string, workspaceId: string, tree: PageTree): void {
  const now = Date.now();
  const entries = store();
  // Re-insert so a refreshed preview counts as the newest entry.
  entries.delete(token);
  entries.set(token, { workspaceId, tree, expiresAt: now + TTL_MS });
  sweep(now);
}

export function getPreview(token: string, workspaceId: string): PreviewEntry | null {
  const entry = store().get(token);
  if (!entry || entry.workspaceId !== workspaceId || entry.expiresAt <= Date.now()) return null;
  return entry;
}
