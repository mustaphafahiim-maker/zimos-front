/**
 * Where dialogs and drawers are drawn: an empty element the layout keeps
 * inside `.glass-app main` — so what is in a dialog (fields, buttons, tables)
 * takes the same look as on a page — but outside the page column, the toolbar
 * and the side menu. Those use an entrance transform or backdrop-filter, and
 * either one makes `position: fixed` follow that box instead of the window.
 * The merchant dashboard's mechanism (its components/overlayRoot.tsx).
 */
const ATTR = "data-overlay-root";

export function OverlayRoot() {
  return <div {...{ [ATTR]: "" }} />;
}

/** The layout's overlay root, or <body> where there is no layout (the sign-in page). */
export function overlayTarget(): HTMLElement {
  return document.querySelector<HTMLElement>(`[${ATTR}]`) ?? document.body;
}
