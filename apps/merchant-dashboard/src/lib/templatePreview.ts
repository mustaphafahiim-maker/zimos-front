import type { PageTree, WebsiteTemplateDetail } from "@store-builder/api-client";
import { apiClient } from "@/lib/apiClient";

/**
 * Plumbing for the template gallery's live previews (see
 * components/TemplateLivePreview.tsx): which tree to render, a cached fetch of
 * it, the preview token per template, and the queue that keeps only a few
 * storefront renders in flight at once.
 */

/**
 * The page a template's card shows: its home page, else the first page it
 * ships with. Null when the template has no renderable tree — the card then
 * keeps the placeholder rather than posting an empty page.
 */
export function homeTreeOf(detail: Pick<WebsiteTemplateDetail, "pages">): PageTree | null {
  const pages = detail.pages ?? [];
  const home = pages.find((p) => p.pageType === "home" || p.path === "/") ?? pages[0];
  const data = home?.builderData as PageTree | null | undefined;
  if (!data || typeof data !== "object" || !Array.isArray(data.sections) || data.sections.length === 0) {
    return null;
  }
  return data;
}

const homeTrees = new Map<string, Promise<PageTree | null>>();

/**
 * A template's home tree, fetched once per session. Templates are a published
 * catalogue, so the card and the full-size preview can share one request. A
 * failed fetch is forgotten, so opening the template again retries it.
 */
export function loadTemplateHome(templateId: string): Promise<PageTree | null> {
  let pending = homeTrees.get(templateId);
  if (!pending) {
    pending = apiClient.getWebsiteTemplate(templateId).then(homeTreeOf);
    pending.catch(() => homeTrees.delete(templateId));
    homeTrees.set(templateId, pending);
  }
  return pending;
}

const tokens = new Map<string, string>();

/**
 * One preview slot on the storefront per template (and workspace — the
 * storefront binds a token to the workspace it was first posted for), reused
 * for the whole session so browsing the gallery doesn't pile up entries.
 */
export function previewTokenFor(workspaceId: string, templateId: string): string {
  const key = `${workspaceId}:${templateId}`;
  let token = tokens.get(key);
  if (!token) {
    token = crypto.randomUUID();
    tokens.set(key, token);
  }
  return token;
}

let lastSessionCheck = 0;
let sessionCheck: Promise<void> | null = null;

/**
 * The storefront verifies the posted access token against the API. As in
 * StorefrontPreview, a cheap authenticated call first lets the client refresh
 * an expired one — shared here, so a screenful of cards makes one call.
 */
export function ensureFreshSession(): Promise<void> {
  if (Date.now() - lastSessionCheck < 60_000) return Promise.resolve();
  sessionCheck ??= apiClient
    .me()
    .then(
      () => {
        lastSessionCheck = Date.now();
      },
      () => {
        // The preview page explains a rejected session itself.
      }
    )
    .finally(() => {
      sessionCheck = null;
    });
  return sessionCheck;
}

export interface SlotQueue {
  /**
   * Calls `start` once fewer than `limit` jobs hold a slot. `start` receives
   * the function that frees the slot again. The returned function cancels a
   * job still waiting, or frees its slot if it already started — calling it
   * more than once (or after `release`) is harmless.
   */
  request(start: (release: () => void) => void): () => void;
  readonly active: number;
  readonly waiting: number;
}

/** First come, first served; each storefront render holds a slot until its frame loads. */
export function createSlotQueue(limit: number): SlotQueue {
  let active = 0;
  const queue: Array<{ run: () => void }> = [];

  function pump() {
    while (active < limit && queue.length > 0) {
      const job = queue.shift()!;
      active++;
      job.run();
    }
  }

  return {
    request(start) {
      let state: "waiting" | "running" | "done" = "waiting";
      const release = () => {
        if (state === "running") {
          state = "done";
          active--;
          pump();
        } else if (state === "waiting") {
          state = "done";
          const index = queue.indexOf(job);
          if (index >= 0) queue.splice(index, 1);
        }
      };
      const job = {
        run: () => {
          state = "running";
          start(release);
        },
      };
      queue.push(job);
      pump();
      return release;
    },
    get active() {
      return active;
    },
    get waiting() {
      return queue.length;
    },
  };
}

/**
 * Every card preview is a full server render of the storefront (plus two API
 * calls to verify the session), so only this many load at a time; the rest
 * wait their turn. Frames that have loaded stay, so scrolling back is free.
 */
export const MAX_LOADING_PREVIEWS = 2;
export const previewQueue = createSlotQueue(MAX_LOADING_PREVIEWS);
