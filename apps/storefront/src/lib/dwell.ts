/**
 * How long the current page view has been on screen — the time the tab was
 * visible, not the time the page was open. The pure core of the visible-time
 * reports lib/analyticsEvents.ts sends (`page_dwell`, DWELL_TRACKING_ENABLED):
 * no imports and no browser globals, so it runs under the tests as it is.
 *
 *  - start()   a new page view: closes the one before and hands back its last
 *              reading, if it has one not reported yet;
 *  - pause()   the tab was hidden or the page is going away: stops counting and
 *              hands back the reading, if it grew since the last one reported;
 *  - resume()  the tab is visible again: counting goes on for the same page view;
 *  - setProduct()  the page turned out to show a product (its view_content).
 *
 * The API keeps the highest reading of each page view, so sending one again
 * after the tab comes back is how a long visit is measured in parts.
 */

export interface DwellReading {
  pageViewId: string;
  dwellMs: number;
  productId?: string;
}

interface PageClock {
  pageViewId: string;
  productId?: string;
  visibleMs: number;
  visibleSince: number | null;
  reportedMs: number;
}

export interface DwellClock {
  start(pageViewId: string, visible: boolean): DwellReading | null;
  pause(): DwellReading | null;
  resume(): void;
  setProduct(productId: string): void;
  /** The page view being measured, if any. */
  current(): string | null;
}

export function createDwellClock(now: () => number): DwellClock {
  let page: PageClock | null = null;

  function stop() {
    if (page && page.visibleSince !== null) {
      page.visibleMs += Math.max(0, now() - page.visibleSince);
      page.visibleSince = null;
    }
  }

  function unreported(): DwellReading | null {
    if (!page) return null;
    const dwellMs = Math.round(page.visibleMs);
    if (dwellMs <= page.reportedMs) return null;
    page.reportedMs = dwellMs;
    return { pageViewId: page.pageViewId, dwellMs, ...(page.productId ? { productId: page.productId } : {}) };
  }

  return {
    start(pageViewId, visible) {
      stop();
      const last = unreported();
      page = { pageViewId, visibleMs: 0, visibleSince: visible ? now() : null, reportedMs: 0 };
      return last;
    },
    pause() {
      stop();
      return unreported();
    },
    resume() {
      if (page && page.visibleSince === null) page.visibleSince = now();
    },
    setProduct(productId) {
      if (page && !page.productId) page.productId = productId;
    },
    current() {
      return page ? page.pageViewId : null;
    },
  };
}
