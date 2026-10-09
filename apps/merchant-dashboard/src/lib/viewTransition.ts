import { useCallback, useLayoutEffect } from "react";
import { flushSync } from "react-dom";
import { useLocation, useNavigate, type NavigateOptions, type To } from "react-router-dom";

type ViewTransitionDocument = Document & {
  startViewTransition?: (update: () => void | Promise<void>) => { finished: Promise<void> };
};

/**
 * Page-to-page motion through the View Transitions API (docs/ux/REDESIGN_PROMPT.md
 * §4.3). The shell — side menu, toolbar, dock — stays still; the page inside the
 * pane fades out and the next one settles in; and any element that carries a
 * `view-transition-name` (a row's title, amount or status chip that also exists
 * in the detail header) travels between its two places. The CSS is in index.css
 * ("View transitions"). Where the API is missing, or the person asked for less
 * motion, the update simply runs and the page keeps its `page-in` fade.
 *
 * While a transition runs, `<html data-vt>` is set: it names the page for the
 * snapshot and stops `page-in` from playing a second time over it.
 */
function canTransition(): boolean {
  const doc = document as ViewTransitionDocument;
  return typeof doc.startViewTransition === "function" && !window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

function run(update: () => void | Promise<void>): void {
  const doc = document as ViewTransitionDocument;
  const root = doc.documentElement;
  root.dataset.vt = "";
  let transition: { finished: Promise<void> } | undefined;
  try {
    transition = doc.startViewTransition!(update);
  } catch {
    delete root.dataset.vt;
    void update();
    return;
  }
  transition.finished
    .catch(() => undefined)
    .finally(() => {
      delete root.dataset.vt;
      clearViewSource();
    });
}

/** A local state change (a tab, a view switch) inside a view transition. */
export function withViewTransition(update: () => void): void {
  if (!canTransition()) {
    update();
    return;
  }
  run(() => {
    flushSync(update);
  });
}

/*
 * A route change is committed by React later than the call to navigate():
 * react-router wraps it in a transition, and a code-split page holds that
 * commit until its chunk is here. <RouteCommitSignal /> says when the new
 * page is in the DOM, and the view transition waits for exactly that.
 */
let waiters: Array<() => void> = [];

function nextRouteCommit(timeoutMs: number): Promise<void> {
  return new Promise((resolve) => {
    const timer = window.setTimeout(resolve, timeoutMs);
    waiters.push(() => {
      window.clearTimeout(timer);
      resolve();
    });
  });
}

/** Mounted once inside the router (App.tsx). Renders nothing. */
export function RouteCommitSignal(): null {
  const location = useLocation();
  useLayoutEffect(() => {
    const pending = waiters;
    waiters = [];
    pending.forEach((fn) => fn());
  }, [location.key]);
  return null;
}

/** How long a transition holds the old page while the next one's code arrives. */
const COMMIT_WAIT_MS = 320;

function samePlace(to: To): boolean {
  const here = window.location.pathname + window.location.search + window.location.hash;
  if (typeof to === "string") return to === here;
  return (to.pathname ?? window.location.pathname) + (to.search ?? "") + (to.hash ?? "") === here;
}

/** `useNavigate`, with the page change wrapped in a view transition. */
export function useViewNavigate() {
  const navigate = useNavigate();
  return useCallback(
    (to: To, options?: NavigateOptions) => {
      if (!canTransition() || samePlace(to)) {
        navigate(to, options);
        return;
      }
      run(() => {
        const committed = nextRouteCommit(COMMIT_WAIT_MS);
        navigate(to, options);
        return committed;
      });
    },
    [navigate]
  );
}

/** Whether a click on a link should be handled in-app (plain left click, no modifier, same tab). */
export function isPlainNavigationClick(e: React.MouseEvent<HTMLAnchorElement>): boolean {
  return (
    e.button === 0 &&
    !e.metaKey &&
    !e.ctrlKey &&
    !e.shiftKey &&
    !e.altKey &&
    !e.defaultPrevented &&
    (!e.currentTarget.target || e.currentTarget.target === "_self")
  );
}

/*
 * Shared elements. A list row that is about to open its detail page marks
 * itself as the source; the parts inside it tagged `data-vt-part="title" |
 * "amount" | "status"` then travel into the detail header, whose wrapper is
 * tagged `data-vt-target` with the same parts inside (CSS: index.css, "View
 * transitions"). Only ONE row is ever named, so a list of fifty rows costs
 * three snapshots, not a hundred and fifty.
 *
 *   <tr data-vt-row onClick={(e) => { markViewSource(e.currentTarget); navigate(to); }}>
 *     <span data-vt-part="title">…</span> <span data-vt-part="amount">…</span>
 */
export function markViewSource(element: Element | null | undefined): void {
  clearViewSource();
  element?.setAttribute("data-vt-source", "");
}

function clearViewSource(): void {
  document.querySelectorAll("[data-vt-source]").forEach((el) => el.removeAttribute("data-vt-source"));
}
