import { memo, useCallback, useEffect, useImperativeHandle, useLayoutEffect, useMemo, useRef, useState, type Dispatch, type Ref } from "react";
import { useDroppable } from "@dnd-kit/core";
import { ArrowDown, ArrowUp, Copy, Eye, EyeOff, LayoutTemplate, Palette, Plus, Trash2 } from "lucide-react";
import { Button } from "@store-builder/ui";
import { PageRenderer, type NodePath, type RendererLocale, type ThemeSettings, type Tree } from "@store-builder/store-renderer";
import { resolvePath, sectionLabel, type EditorAction, type EditorPage } from "./editorState";
import { PreviewFrame } from "./PreviewFrame";
import { StoreFooterPreview, StoreHeaderPreview, buildPreviewContext, type CatalogData } from "./StoreChrome";
import { ELEMENT_LABELS } from "./elementLibrary";
import { useBuilderT } from "./strings";

export type Device = "desktop" | "tablet" | "mobile";
export const DEVICE_WIDTHS: Record<Device, number> = { desktop: 1280, tablet: 768, mobile: 390 };

export interface CanvasHandle {
  resolveDrop: (x: number, y: number, kind: "section" | "element") => { kind: "section"; index: number } | { kind: "element"; columnPath: string } | null;
}

interface Box {
  top: number;
  left: number;
  width: number;
  height: number;
}

type Indicator = { kind: "section"; index: number; box: Box } | { kind: "element"; columnPath: string; box: Box };

const BLUE = "#2563eb";

/** The page inside the iframe. Memoised: overlay/hover updates never re-render the store. */
const FrameContent = memo(function FrameContent({
  tree,
  theme,
  locale,
  selection,
  catalog,
  storeName,
  logoUrl,
  pages,
  onSelect,
  onInlineEdit,
  remountKey,
}: {
  tree: Tree;
  theme: ThemeSettings;
  locale: RendererLocale;
  selection: NodePath | null;
  catalog: CatalogData;
  storeName: string;
  logoUrl?: string | null;
  pages: EditorPage[];
  onSelect: (path: NodePath) => void;
  onInlineEdit: (path: NodePath, field: string, value: string) => void;
  remountKey: number;
}) {
  const ctx = useMemo(
    () => buildPreviewContext({ locale, catalog, editor: { enabled: true, selectedPath: selection, onSelect, onInlineEdit } }),
    [locale, catalog, selection, onSelect, onInlineEdit]
  );
  return (
    <>
      <StoreHeaderPreview theme={theme} storeName={storeName} logoUrl={logoUrl} locale={locale} pages={pages} />
      <main className="zb-main">
        <PageRenderer key={remountKey} tree={tree} ctx={ctx} />
      </main>
      <StoreFooterPreview theme={theme} storeName={storeName} locale={locale} />
    </>
  );
});

export function Canvas({
  tree,
  theme,
  locale,
  device,
  fit,
  selection,
  catalog,
  storeName,
  logoUrl,
  pages,
  dispatch,
  dragKind,
  dragPoint,
  handle,
  onKeyDown,
  onChooseTheme,
  onAddFirst,
  onAddBelow,
  onDelete,
  onInlineEdited,
}: {
  tree: Tree;
  theme: ThemeSettings;
  locale: RendererLocale;
  device: Device;
  fit: boolean;
  selection: NodePath | null;
  catalog: CatalogData;
  storeName: string;
  logoUrl?: string | null;
  pages: EditorPage[];
  dispatch: Dispatch<EditorAction>;
  dragKind: "section" | "element" | null;
  dragPoint: { x: number; y: number } | null;
  handle: Ref<CanvasHandle>;
  onKeyDown: (e: KeyboardEvent) => void;
  onChooseTheme: () => void;
  onAddFirst: () => void;
  onAddBelow: (sectionId: string) => void;
  onDelete: (path: NodePath) => void;
  onInlineEdited: () => void;
}) {
  const t = useBuilderT();
  const { setNodeRef } = useDroppable({ id: "canvas" });
  const areaRef = useRef<HTMLDivElement | null>(null);
  const frameRef = useRef<HTMLIFrameElement | null>(null);
  const [doc, setDoc] = useState<Document | null>(null);
  const [size, setSize] = useState({ w: 1000, h: 700 });
  const [hover, setHover] = useState<string | null>(null);
  const [boxes, setBoxes] = useState<{ hover?: Box; selected?: Box }>({});
  const [indicator, setIndicator] = useState<Indicator | null>(null);
  const [remountKey, setRemountKey] = useState(0);
  const keyRef = useRef(onKeyDown);
  keyRef.current = onKeyDown;
  const editedRef = useRef(onInlineEdited);
  editedRef.current = onInlineEdited;

  const width = DEVICE_WIDTHS[device];
  const scale = fit ? Math.min(1, Math.max(0.25, (size.w - 48) / width)) : 1;
  const frameHeight = Math.max(360, (size.h - 32) / scale);

  const setArea = useCallback(
    (node: HTMLDivElement | null) => {
      areaRef.current = node;
      setNodeRef(node);
    },
    [setNodeRef]
  );

  useEffect(() => {
    const el = areaRef.current;
    if (!el) return;
    const update = () => setSize({ w: el.clientWidth || 1000, h: el.clientHeight || 700 });
    update();
    if (typeof ResizeObserver === "undefined") return;
    const ro = new ResizeObserver(update);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const onSelect = useCallback((path: NodePath) => dispatch({ type: "select", path }), [dispatch]);
  const onInlineEdit = useCallback(
    (path: NodePath, field: string, value: string) => {
      dispatch({ type: "inlineEdit", path, field, value });
      editedRef.current();
    },
    [dispatch]
  );

  const toArea = useCallback(
    (r: DOMRect): Box | null => {
      const frame = frameRef.current;
      const area = areaRef.current;
      if (!frame || !area) return null;
      const fr = frame.getBoundingClientRect();
      const ar = area.getBoundingClientRect();
      return { top: fr.top - ar.top + r.top * scale, left: fr.left - ar.left + r.left * scale, width: r.width * scale, height: r.height * scale };
    },
    [scale]
  );

  const nodeEl = useCallback(
    (path: string | null): HTMLElement | null => {
      if (!doc || !path) return null;
      const el = doc.querySelector(`[data-zr-path="${path.replace(/["\\]/g, "")}"]`);
      if (!el) return null;
      // Elements use a display:contents wrapper — measure its first child.
      return (el.classList.contains("zr-edit") ? el.firstElementChild : el) as HTMLElement | null;
    },
    [doc]
  );

  const measure = useCallback(() => {
    const selEl = nodeEl(selection);
    const hovEl = hover && hover !== selection ? nodeEl(hover) : null;
    setBoxes({
      selected: selEl ? (toArea(selEl.getBoundingClientRect()) ?? undefined) : undefined,
      hover: hovEl ? (toArea(hovEl.getBoundingClientRect()) ?? undefined) : undefined,
    });
  }, [nodeEl, selection, hover, toArea]);

  useLayoutEffect(() => {
    measure();
  }, [measure, tree, size, device, theme, remountKey]);

  // Re-measure when the store scrolls or reflows (fonts, images).
  useEffect(() => {
    if (!doc?.defaultView) return;
    const win = doc.defaultView;
    let raf = 0;
    const schedule = () => {
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(measure);
    };
    win.addEventListener("scroll", schedule, { passive: true });
    win.addEventListener("resize", schedule);
    let ro: ResizeObserver | null = null;
    if (typeof ResizeObserver !== "undefined") {
      ro = new ResizeObserver(schedule);
      ro.observe(doc.body);
    }
    return () => {
      cancelAnimationFrame(raf);
      win.removeEventListener("scroll", schedule);
      win.removeEventListener("resize", schedule);
      ro?.disconnect();
    };
  }, [doc, measure]);

  // Store document behaviour in the builder: no navigation, plain-text paste, keyboard.
  useEffect(() => {
    if (!doc) return;
    const editableHost = (target: EventTarget | null) => {
      const el = target as HTMLElement | null;
      return el && typeof el.closest === "function" ? (el.closest("[contenteditable]") as HTMLElement | null) : null;
    };
    const onClickCapture = (e: MouseEvent) => {
      const el = e.target as Element | null;
      if (el?.closest?.("a")) e.preventDefault();
    };
    const onClick = (e: MouseEvent) => {
      const el = e.target as Element | null;
      if (!el?.closest?.("[data-zr-path]")) dispatch({ type: "select", path: null });
    };
    const onSubmit = (e: Event) => e.preventDefault();
    const onPaste = (e: ClipboardEvent) => {
      if (!editableHost(e.target)) return;
      e.preventDefault();
      const text = e.clipboardData?.getData("text/plain") ?? "";
      doc.execCommand("insertText", false, text);
    };
    const onKey = (e: KeyboardEvent) => {
      const host = editableHost(e.target);
      if (host) {
        if (e.key === "Enter") {
          e.preventDefault();
          // Headings and button labels are single-line; paragraphs keep a plain newline.
          if (host.matches("h1,h2,h3,h4,h5,h6") || host.closest(".zr-btn") || e.ctrlKey || e.metaKey) host.blur();
          else doc.execCommand("insertText", false, "\n");
          return;
        }
        if (e.key === "Escape") {
          e.preventDefault();
          host.blur();
          return;
        }
      }
      keyRef.current(e);
    };
    const onOver = (e: MouseEvent) => {
      const sec = (e.target as Element | null)?.closest?.('[data-zr-kind="section"]');
      setHover(sec?.getAttribute("data-zr-path") ?? null);
    };
    const onLeave = () => setHover(null);
    const onFocusOut = (e: FocusEvent) => {
      const el = e.target as HTMLElement | null;
      // The browser split an edited node into several DOM nodes: remount so React owns the DOM again.
      if (el?.isContentEditable && (el.childNodes.length > 1 || el.firstElementChild)) setRemountKey((k) => k + 1);
    };
    doc.addEventListener("click", onClickCapture, true);
    doc.addEventListener("click", onClick);
    doc.addEventListener("submit", onSubmit, true);
    doc.addEventListener("paste", onPaste);
    doc.addEventListener("keydown", onKey);
    doc.addEventListener("mouseover", onOver);
    doc.documentElement.addEventListener("mouseleave", onLeave);
    doc.addEventListener("focusout", onFocusOut);
    return () => {
      doc.removeEventListener("click", onClickCapture, true);
      doc.removeEventListener("click", onClick);
      doc.removeEventListener("submit", onSubmit, true);
      doc.removeEventListener("paste", onPaste);
      doc.removeEventListener("keydown", onKey);
      doc.removeEventListener("mouseover", onOver);
      doc.documentElement.removeEventListener("mouseleave", onLeave);
      doc.removeEventListener("focusout", onFocusOut);
    };
  }, [doc, dispatch]);

  // Selecting from the outline scrolls the preview to the node.
  useEffect(() => {
    const el = nodeEl(selection);
    const win = doc?.defaultView;
    if (!el || !win) return;
    const r = el.getBoundingClientRect();
    if ((r.top < 0 || r.bottom > win.innerHeight) && typeof el.scrollIntoView === "function") {
      el.scrollIntoView({ block: r.height > win.innerHeight ? "start" : "center", behavior: "smooth" });
    }
  }, [selection, doc, nodeEl]);

  const resolve = useCallback(
    (x: number, y: number, kind: "section" | "element"): Indicator | null => {
      const frame = frameRef.current;
      const area = areaRef.current;
      if (!frame || !area || !doc) return null;
      const ar = area.getBoundingClientRect();
      if (x < ar.left || x > ar.right || y < ar.top || y > ar.bottom) return null;
      const fr = frame.getBoundingClientRect();
      const iy = (y - fr.top) / scale;
      const ix = (x - fr.left) / scale;
      if (kind === "section") {
        const secs = Array.from(doc.querySelectorAll('[data-zr-kind="section"]'));
        let index = secs.length;
        let lineTop: number;
        if (secs.length === 0) lineTop = doc.querySelector(".zb-main")?.getBoundingClientRect().top ?? 0;
        else {
          lineTop = secs[secs.length - 1].getBoundingClientRect().bottom;
          for (let i = 0; i < secs.length; i += 1) {
            const r = secs[i].getBoundingClientRect();
            if (iy < r.top + r.height / 2) {
              index = i;
              lineTop = r.top;
              break;
            }
          }
        }
        return { kind: "section", index, box: { top: fr.top - ar.top + lineTop * scale - 2, left: fr.left - ar.left, width: fr.width, height: 4 } };
      }
      if (typeof doc.elementFromPoint !== "function") return null;
      const hit = doc.elementFromPoint(Math.max(0, ix), Math.max(0, iy));
      const column = hit?.closest('[data-zr-kind="column"]');
      const path = column?.getAttribute("data-zr-path");
      if (!column || !path) return null;
      const box = toArea(column.getBoundingClientRect());
      return box ? { kind: "element", columnPath: path, box } : null;
    },
    [doc, scale, toArea]
  );

  useImperativeHandle(
    handle,
    () => ({
      resolveDrop: (x, y, kind) => {
        const r = resolve(x, y, kind);
        if (!r) return null;
        return r.kind === "section" ? { kind: "section", index: r.index } : { kind: "element", columnPath: r.columnPath };
      },
    }),
    [resolve]
  );

  useEffect(() => {
    setIndicator(dragKind && dragPoint ? resolve(dragPoint.x, dragPoint.y, dragKind) : null);
  }, [dragKind, dragPoint, resolve]);

  const resolved = resolvePath(tree, selection);
  const sectionIndex = resolved.sectionIndex;
  const kindLabel = (kind: string | null) =>
    kind === "section" ? t.kindSection : kind === "row" ? t.kindRow : kind === "column" ? t.kindColumn : t.kindElement;
  const hoverSection = hover ? tree.sections.find((s) => s.id === hover) : undefined;
  const toolBtn = "flex size-7 cursor-pointer items-center justify-center rounded-md text-white hover:bg-white/20 disabled:cursor-not-allowed disabled:opacity-40";

  return (
    <div
      ref={setArea}
      className="relative min-w-0 flex-1 overflow-auto bg-[#e9edf2] dark:bg-[#0d1117]"
      onClick={(e) => {
        if (e.target === e.currentTarget) dispatch({ type: "select", path: null });
      }}
    >
      <div className="flex min-h-full justify-center px-6 py-4" onClick={(e) => e.target === e.currentTarget && dispatch({ type: "select", path: null })}>
        <div
          className="relative shrink-0 overflow-hidden rounded-xl bg-white shadow-[0_8px_40px_-12px_rgba(15,23,42,0.35)] ring-1 ring-black/5 transition-[width] duration-300 ease-out motion-reduce:transition-none"
          style={{ width: width * scale, height: frameHeight * scale }}
        >
          <div className="absolute left-0 top-0 origin-top-left" style={{ width, height: frameHeight, transform: `scale(${scale})` }}>
            <PreviewFrame
              title={t.previewTitle}
              theme={theme}
              dir={locale === "ar" ? "rtl" : "ltr"}
              lang={locale}
              iframeRef={frameRef}
              onDocument={setDoc}
              className="block size-full border-0 bg-white"
            >
              <FrameContent
                tree={tree}
                theme={theme}
                locale={locale}
                selection={selection}
                catalog={catalog}
                storeName={storeName}
                logoUrl={logoUrl}
                pages={pages}
                onSelect={onSelect}
                onInlineEdit={onInlineEdit}
                remountKey={remountKey}
              />
            </PreviewFrame>
          </div>
        </div>
      </div>

      {/* Overlay layer in dashboard coordinates */}
      <div className="pointer-events-none absolute inset-0 z-10" style={{ height: areaRef.current?.scrollHeight }}>
        {boxes.hover && hoverSection && !dragKind && (
          <div className="absolute rounded-sm" style={{ ...boxes.hover, boxShadow: `inset 0 0 0 1px ${BLUE}80` }}>
            <span className="absolute -top-0 start-0 rounded-ee-md px-1.5 py-0.5 text-[11px] font-semibold text-white" style={{ background: BLUE }}>
              {sectionLabel(hoverSection)}
            </span>
          </div>
        )}
        {boxes.selected && resolved.kind && !dragKind && (
          <div className="absolute" style={{ ...boxes.selected, boxShadow: `inset 0 0 0 2px ${BLUE}` }}>
            <div className="absolute -top-0 flex w-full justify-end p-1.5">
              <div role="toolbar" aria-label={kindLabel(resolved.kind)} className="pointer-events-auto flex items-center gap-0.5 rounded-lg px-1 py-0.5 shadow-lg" style={{ background: BLUE }}>
                <span className="px-1.5 text-[11px] font-semibold text-white/90">
                  {resolved.kind === "element" && resolved.element ? ELEMENT_LABELS[resolved.element.type][locale === "ar" ? "ar" : "en"] : kindLabel(resolved.kind)}
                </span>
                {resolved.kind === "section" && resolved.section && (
                  <>
                    <button type="button" className={toolBtn} title={t.moveUp} aria-label={t.moveUp} disabled={sectionIndex <= 0} onClick={() => dispatch({ type: "moveSection", from: sectionIndex, to: sectionIndex - 1 })}>
                      <ArrowUp className="size-4" aria-hidden />
                    </button>
                    <button type="button" className={toolBtn} title={t.moveDown} aria-label={t.moveDown} disabled={sectionIndex >= tree.sections.length - 1} onClick={() => dispatch({ type: "moveSection", from: sectionIndex, to: sectionIndex + 1 })}>
                      <ArrowDown className="size-4" aria-hidden />
                    </button>
                    <button type="button" className={toolBtn} title={t.duplicate} aria-label={t.duplicate} onClick={() => dispatch({ type: "duplicateSection", sectionId: resolved.section!.id })}>
                      <Copy className="size-4" aria-hidden />
                    </button>
                    <button type="button" className={toolBtn} title={resolved.section.settings?.hidden ? t.show : t.hide} aria-label={resolved.section.settings?.hidden ? t.show : t.hide} onClick={() => dispatch({ type: "toggleHidden", sectionId: resolved.section!.id })}>
                      {resolved.section.settings?.hidden ? <Eye className="size-4" aria-hidden /> : <EyeOff className="size-4" aria-hidden />}
                    </button>
                    <button type="button" className={toolBtn} title={t.addBelow} aria-label={t.addBelow} onClick={() => onAddBelow(resolved.section!.id)}>
                      <Plus className="size-4" aria-hidden />
                    </button>
                  </>
                )}
                {resolved.kind === "element" && selection && (
                  <>
                    <button type="button" className={toolBtn} title={t.moveUp} aria-label={t.moveUp} onClick={() => dispatch({ type: "moveElement", path: selection, delta: -1 })}>
                      <ArrowUp className="size-4" aria-hidden />
                    </button>
                    <button type="button" className={toolBtn} title={t.moveDown} aria-label={t.moveDown} onClick={() => dispatch({ type: "moveElement", path: selection, delta: 1 })}>
                      <ArrowDown className="size-4" aria-hidden />
                    </button>
                  </>
                )}
                {selection && (resolved.kind === "section" || resolved.kind === "element") && (
                  <button type="button" className={toolBtn} title={t.delete} aria-label={t.delete} onClick={() => onDelete(selection)}>
                    <Trash2 className="size-4" aria-hidden />
                  </button>
                )}
              </div>
            </div>
          </div>
        )}
        {indicator?.kind === "section" && (
          <div className="absolute" style={indicator.box}>
            <div className="h-1 w-full rounded-full" style={{ background: BLUE, boxShadow: `0 0 0 3px ${BLUE}33` }} />
            <span className="absolute start-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 rounded-full px-2.5 py-0.5 text-xs font-semibold text-white shadow rtl:translate-x-1/2" style={{ background: BLUE }}>
              {t.dropHere}
            </span>
          </div>
        )}
        {indicator?.kind === "element" && <div className="absolute rounded-md" style={{ ...indicator.box, background: `${BLUE}14`, boxShadow: `inset 0 0 0 2px ${BLUE}` }} />}
      </div>

      {tree.sections.length === 0 && !dragKind && (
        <div className="pointer-events-none absolute inset-0 z-10 flex items-center justify-center p-6">
          <div className="pointer-events-auto w-full max-w-sm rounded-2xl border border-line bg-paper-raised p-6 text-center shadow-pop">
            <span className="mx-auto mb-3 flex size-12 items-center justify-center rounded-full bg-primary-soft text-primary">
              <LayoutTemplate className="size-6" aria-hidden />
            </span>
            <h2 className="font-display text-lg font-semibold text-ink">{t.emptyPageTitle}</h2>
            <p className="mt-1 text-sm text-ink-soft">{t.emptyPageBody}</p>
            <div className="mt-4 flex flex-col gap-2">
              <Button type="button" onClick={onChooseTheme}>
                <Palette className="size-4" aria-hidden />
                {t.chooseTheme}
              </Button>
              <Button type="button" variant="outline" onClick={onAddFirst}>
                <Plus className="size-4" aria-hidden />
                {t.addFirstSection}
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* While dragging from the panel, keep pointer events in this document (the iframe would swallow them). */}
      {dragKind && <div className="absolute inset-0 z-20" style={{ height: areaRef.current?.scrollHeight }} />}
    </div>
  );
}
