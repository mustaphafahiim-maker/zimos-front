import { useCallback, useEffect, useLayoutEffect, useRef, useState, type CSSProperties, type ReactNode, type Ref } from "react";
import { createPortal } from "react-dom";
import { googleFontsHref, themeClassName, themeCssVariables, type ThemeSettings } from "@store-builder/store-renderer";
import rendererCss from "@store-builder/store-renderer/store-renderer.css?inline";
import { PREVIEW_CSS } from "./StoreChrome";

/**
 * An isolated document for the store: an <iframe> whose body React renders
 * into through a portal. Dashboard CSS (Tailwind preflight, tokens) can't
 * reach the store and store CSS can't reach the dashboard, and the store's
 * own media queries respond to the device width — so what the merchant sees
 * is what the storefront renders.
 *
 * No srcDoc: the initial about:blank document is available synchronously in
 * every engine (and jsdom). Browsers that swap it on "load" (Firefox) are
 * handled by re-initialising on that event.
 */
export function PreviewFrame({
  title,
  theme,
  dir,
  lang,
  children,
  className,
  style,
  iframeRef,
  onDocument,
  tabIndex,
}: {
  title: string;
  theme: ThemeSettings;
  dir: "rtl" | "ltr";
  lang: string;
  children: ReactNode;
  className?: string;
  style?: CSSProperties;
  iframeRef?: Ref<HTMLIFrameElement>;
  onDocument?: (doc: Document | null) => void;
  tabIndex?: number;
}) {
  const localRef = useRef<HTMLIFrameElement | null>(null);
  const [doc, setDoc] = useState<Document | null>(null);

  const setRef = useCallback(
    (node: HTMLIFrameElement | null) => {
      localRef.current = node;
      if (typeof iframeRef === "function") iframeRef(node);
      else if (iframeRef) (iframeRef as { current: HTMLIFrameElement | null }).current = node;
    },
    [iframeRef]
  );

  useLayoutEffect(() => {
    const frame = localRef.current;
    if (!frame) return;
    const init = () => {
      const d = frame.contentDocument;
      if (!d || !d.body) return;
      if (!d.getElementById("zb-base")) {
        const meta = d.createElement("meta");
        meta.name = "viewport";
        meta.content = "width=device-width, initial-scale=1";
        d.head.appendChild(meta);
        const css = d.createElement("style");
        css.id = "zb-base";
        css.textContent = `${rendererCss}\n${PREVIEW_CSS}`;
        d.head.appendChild(css);
      }
      setDoc((prev) => (prev === d ? prev : d));
    };
    init();
    frame.addEventListener("load", init);
    return () => frame.removeEventListener("load", init);
  }, []);

  const fontsHref = googleFontsHref(theme);
  useEffect(() => {
    if (!doc) return;
    let link = doc.getElementById("zb-fonts") as HTMLLinkElement | null;
    if (!link) {
      link = doc.createElement("link");
      link.id = "zb-fonts";
      link.rel = "stylesheet";
      doc.head.appendChild(link);
    }
    if (link.getAttribute("href") !== fontsHref) link.setAttribute("href", fontsHref);
  }, [doc, fontsHref]);

  useEffect(() => {
    if (!doc) return;
    doc.documentElement.dir = dir;
    doc.documentElement.lang = lang;
  }, [doc, dir, lang]);

  useEffect(() => {
    onDocument?.(doc);
  }, [doc, onDocument]);

  return (
    <>
      <iframe ref={setRef} title={title} className={className} style={style} tabIndex={tabIndex} />
      {doc &&
        createPortal(
          <div className={`${themeClassName(theme)} zb-root`} dir={dir} lang={lang} style={themeCssVariables(theme) as CSSProperties}>
            {children}
          </div>,
          doc.body
        )}
    </>
  );
}
