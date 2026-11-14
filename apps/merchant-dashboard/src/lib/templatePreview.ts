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

/** What a template's preview needs of the template: the page to draw and the styles it carries. */
export interface TemplatePreviewData {
  home: PageTree | null;
  globalStyles: Record<string, unknown>;
}

const previews = new Map<string, Promise<TemplatePreviewData>>();

/**
 * A template's home tree and its styles, fetched once per session. Templates
 * are a published catalogue, so the card and the full-size preview can share
 * one request. A failed fetch is forgotten, so opening the template again
 * retries it.
 */
export function loadTemplatePreview(templateId: string): Promise<TemplatePreviewData> {
  let pending = previews.get(templateId);
  if (!pending) {
    pending = apiClient
      .getWebsiteTemplate(templateId)
      .then((detail) => ({ home: homeTreeOf(detail), globalStyles: detail.globalStyles ?? {} }));
    pending.catch(() => previews.delete(templateId));
    previews.set(templateId, pending);
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
   *
   * `priority` is asked each time a slot frees up: the waiting job with the
   * lowest goes next (a card's distance from the middle of the screen, as it
   * is then), ties in the order they asked. Without it a job ranks 0.
   */
  request(start: (release: () => void) => void, priority?: () => number): () => void;
  readonly active: number;
  readonly waiting: number;
}

/**
 * Nearest first (by `priority`), else first come, first served; each
 * storefront render holds a slot until its frame loads.
 *
 * `schedule` runs the hand-out after a request: at once by default; the
 * gallery's queue waits a microtask, so the cards that ask in the same
 * render are all compared before any of them starts.
 */
export function createSlotQueue(limit: number, schedule: (pump: () => void) => void = (pump) => pump()): SlotQueue {
  let active = 0;
  const queue: Array<{ run: () => void; priority: () => number }> = [];

  function pump() {
    while (active < limit && queue.length > 0) {
      let next = 0;
      let best = queue[0].priority();
      for (let i = 1; i < queue.length; i++) {
        const rank = queue[i].priority();
        if (rank < best) {
          best = rank;
          next = i;
        }
      }
      const [job] = queue.splice(next, 1);
      active++;
      job.run();
    }
  }

  return {
    request(start, priority = () => 0) {
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
        priority,
      };
      queue.push(job);
      schedule(pump);
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
 * wait their turn, the one nearest the middle of the screen first. Frames that
 * have loaded stay, so scrolling back is free: one let go would load again.
 */
export const MAX_LOADING_PREVIEWS = 2;

/** How far outside the screen a gallery card already counts as on it: a little, so it starts just before it scrolls in. */
export const CARD_MARGIN = "48px 0px";
/** A gallery card asks for its render only once it has stayed on screen this long: one scrolled past is never loaded. */
export const SETTLE_MS = 300;
export const previewQueue = createSlotQueue(MAX_LOADING_PREVIEWS, (pump) => queueMicrotask(pump));
