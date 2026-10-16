/**
 * Where dialogs and menus are drawn: an empty element each layout keeps
 * outside every glass bar, sidebar and page wrapper (those use backdrop-filter
 * or an entrance transform, and either one makes `position: fixed` follow
 * them instead of the window — a dialog opened from the funnel editor's bar
 * was cut off at the bar's height). It still sits inside `.glass-app main` /
 * `.glass-editor`, so the overlays keep the same look as before.
 */
const ATTR = "data-overlay-root";

export function OverlayRoot() {
  return <div {...{ [ATTR]: "" }} />;
}

/** The layout's overlay root, or <body> where there is no layout (sign-in, tests). */
export function overlayTarget(): HTMLElement {
  return document.querySelector<HTMLElement>(`[${ATTR}]`) ?? document.body;
}
