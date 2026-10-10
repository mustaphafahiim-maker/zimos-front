import { useNavigate } from "react-router-dom";

/**
 * Where the ported screens change page or view. The page-to-page motion they
 * were written with (the View Transitions API) belongs to the app shell and is
 * not part of this build: a navigation here is a plain one, and a local state
 * change simply runs.
 */

/** `useNavigate`, under the name the ported screens call. */
export function useViewNavigate() {
  return useNavigate();
}

/** A local state change (a tab, a view switch). */
export function withViewTransition(update: () => void): void {
  update();
}

/** Whether a click on a link should be handled in-app (plain left click, no modifier, same tab). */
export function isPlainNavigationClick(e: React.MouseEvent<HTMLAnchorElement>): boolean {
  return e.button === 0 && !e.metaKey && !e.ctrlKey && !e.shiftKey && !e.altKey && !e.defaultPrevented && (!e.currentTarget.target || e.currentTarget.target === "_self");
}
