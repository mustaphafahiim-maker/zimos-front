import { parseFontRef } from "@store-builder/api-client";
import { fontAssets, fontStack } from "@/lib/storeFonts";
import type { PreviewTheme } from "@/lib/brandTheme";

/**
 * The editor's unsaved body and heading fonts on the preview (PreviewBridge's
 * applyTheme): the font variables on the store wrapper, and the font files
 * loaded under ids of their own so a later change replaces them.
 */
const LINK_ID = "zf-preview-link";
const FACES_ID = "zf-preview-faces";

export function applyFontPreview(theme: PreviewTheme) {
  const wrapper = document.querySelector<HTMLElement>(".brand-theme");
  if (!wrapper || (theme.bodyFont === undefined && theme.headingFont === undefined)) return;
  const body = parseFontRef(theme.bodyFont);
  const heading = parseFontRef(theme.headingFont);
  // brandVars has just set the look's own stacks; a chosen font goes over them.
  if (body) wrapper.style.setProperty("--font-sans", fontStack(body), "important");
  if (heading) wrapper.style.setProperty("--font-display", fontStack(heading), "important");

  const store = /^\/store\/([^/]+)\//.exec(window.location.pathname)?.[1] ?? "";
  const { href, faces } = fontAssets([body, heading], store);
  let link = document.getElementById(LINK_ID) as HTMLLinkElement | null;
  if (href) {
    if (!link) {
      link = document.createElement("link");
      link.id = LINK_ID;
      link.rel = "stylesheet";
      document.head.appendChild(link);
    }
    if (link.href !== href) link.href = href;
  } else link?.remove();
  let style = document.getElementById(FACES_ID);
  if (faces) {
    if (!style) {
      style = document.createElement("style");
      style.id = FACES_ID;
      document.head.appendChild(style);
    }
    style.textContent = faces;
  } else style?.remove();
}
