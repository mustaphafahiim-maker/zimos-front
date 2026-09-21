"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { BRAND_VAR_NAMES, brandVars, readPreviewTheme, type PreviewTheme } from "@/lib/brandTheme";

/**
 * The storefront half of the website editor's canvas. Rendered only by the
 * preview page (app/store/[workspaceId]/preview/[token]) — never on a page a
 * shopper can reach — and only when the editor asked for it.
 *
 * It talks to exactly one window: the dashboard that framed it, at the origin
 * the dashboard posted with the tree. Its counterpart is
 * merchant-dashboard/src/pages/website/editor/previewBridge.ts; the two sides
 * share no code, so the message shapes are spelled out in both.
 *
 * Frame → editor
 *   { type: "zimos:preview-ready", sectionIds }   after every (re)load
 *   { type: "zimos:select-section", sectionId }   a section was clicked
 *   { type: "zimos:insert-section", index }       "add a section here"
 *
 * Editor → frame
 *   { type: "zimos:editor-state", selectedId, labels, strings, theme }
 *   { type: "zimos:scroll-to-section", sectionId }
 *
 * Everything it draws (outlines, name labels, the + buttons) is a fixed layer
 * above the page, so the page's own markup and layout are left untouched.
 */

const SECTION_ATTR = "data-zimos-section";
const INDEX_ATTR = "data-zimos-index";
const OVERLAY_ATTR = "data-zimos-overlay";
const SERVER_THEME_ID = "zimos-preview-theme";
/** The editor's own blue, so outlines stay visible whatever the store's colours. */
const EDITOR_BLUE = "#2563eb";

interface Strings {
  addAbove: string;
  addBelow: string;
}

const DEFAULT_STRINGS: Strings = { addAbove: "Add a section here", addBelow: "Add a section here" };

function sectionEl(id: string): HTMLElement | null {
  return document.querySelector<HTMLElement>(`[${SECTION_ATTR}="${CSS.escape(id)}"]`);
}

function sectionIds(): string[] {
  return Array.from(document.querySelectorAll<HTMLElement>(`[${SECTION_ATTR}]`)).map(
    (el) => el.getAttribute(SECTION_ATTR) ?? ""
  );
}

/**
 * Lays the unsaved look over the store wrapper. `!important` inline values win
 * over both the layout's saved inline style and the server-rendered <style>
 * the preview page starts with (removed here once the bridge takes over).
 */
function applyTheme(theme: PreviewTheme | null) {
  const wrapper = document.querySelector<HTMLElement>(".brand-theme");
  if (!wrapper || !theme) return;
  document.getElementById(SERVER_THEME_ID)?.remove();
  const vars = brandVars(theme as Record<string, unknown>, { complete: true });
  for (const name of BRAND_VAR_NAMES) {
    if (name in vars) wrapper.style.setProperty(name, vars[name], "important");
    else wrapper.style.removeProperty(name);
  }
  applyLogo(theme.logoUrl);
}

/**
 * Swaps the header logo for an unsaved one (see StoreHeader). The header link
 * starts with either the merchant's saved logo (an <img>) or the ZIMOS
 * fallback (<span class="zimos-logo">); that node is hidden rather than
 * removed, so the saved state comes back when the merchant undoes the change.
 * No logo shows the ZIMOS fallback, as the live header does — or, when the
 * saved logo is what's being removed, just the store name.
 */
function applyLogo(logoUrl: string | null | undefined) {
  const link = document.querySelector<HTMLElement>("[data-store-logo]");
  if (!link) return;
  const savedImg = link.querySelector<HTMLElement>(":scope > img:not([data-zimos-logo])");
  const fallback = link.querySelector<HTMLElement>(":scope > .zimos-logo");
  let preview = link.querySelector<HTMLImageElement>(":scope > img[data-zimos-logo]");
  const show = (el: HTMLElement | null, visible: boolean) => {
    if (!el) return;
    if (visible) el.style.removeProperty("display");
    else el.style.setProperty("display", "none");
  };

  if (logoUrl === undefined) {
    preview?.remove();
    show(savedImg, true);
    show(fallback, true);
    return;
  }
  if (!logoUrl) {
    preview?.remove();
    show(savedImg, false);
    show(fallback, true);
    return;
  }
  if (!preview) {
    preview = document.createElement("img");
    preview.setAttribute("data-zimos-logo", "");
    preview.alt = "";
    preview.width = 40;
    preview.height = 40;
    preview.className = "h-10 w-10 shrink-0 rounded-xl object-contain";
    link.prepend(preview);
  }
  if (preview.src !== logoUrl) preview.src = logoUrl;
  show(savedImg, false);
  show(fallback, false);
}

interface Box {
  id: string;
  index: number;
  top: number;
  left: number;
  width: number;
  height: number;
}

function measure(id: string | null): Box | null {
  if (!id) return null;
  const el = sectionEl(id);
  if (!el) return null;
  const rect = el.getBoundingClientRect();
  return {
    id,
    index: Number(el.getAttribute(INDEX_ATTR) ?? 0),
    top: rect.top,
    left: rect.left,
    width: rect.width,
    height: rect.height,
  };
}

export function PreviewBridge({
  parentOrigin,
  editable,
  token,
  initialTheme,
}: {
  parentOrigin: string;
  editable: boolean;
  token: string;
  initialTheme: PreviewTheme | null;
}) {
  const [hovered, setHovered] = useState<string | null>(null);
  const [selected, setSelected] = useState<string | null>(null);
  const [labels, setLabels] = useState<Record<string, string>>({});
  const [strings, setStrings] = useState<Strings>(DEFAULT_STRINGS);
  // Bumped on scroll/resize so the fixed outlines follow their sections.
  const [, setTick] = useState(0);
  const frame = useRef(0);

  const post = useCallback(
    (message: Record<string, unknown>) => {
      if (window.parent === window) return;
      window.parent.postMessage(message, parentOrigin);
    },
    [parentOrigin]
  );

  // Theme, scroll restore and the ready handshake — once per load.
  useEffect(() => {
    applyTheme(initialTheme);

    // Every edit reloads the frame; keep the merchant where they were.
    const key = `zimos-preview-scroll:${token}`;
    try {
      const y = Number(sessionStorage.getItem(key));
      if (y > 0) window.scrollTo(0, y);
    } catch {
      // Storage blocked — the preview just starts at the top.
    }
    const remember = () => {
      try {
        sessionStorage.setItem(key, String(Math.round(window.scrollY)));
      } catch {
        // ignore
      }
    };

    const remeasure = () => {
      cancelAnimationFrame(frame.current);
      frame.current = requestAnimationFrame(() => setTick((n) => n + 1));
    };
    const onScroll = () => {
      remember();
      remeasure();
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", remeasure);
    // Images and client blocks settle after hydration and move sections about.
    const observer = typeof ResizeObserver !== "undefined" ? new ResizeObserver(remeasure) : null;
    observer?.observe(document.body);

    post({ type: "zimos:preview-ready", sectionIds: sectionIds() });

    return () => {
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", remeasure);
      observer?.disconnect();
      cancelAnimationFrame(frame.current);
    };
  }, [initialTheme, post, token]);

  // Messages from the editor. Anything not from the framing dashboard is ignored.
  useEffect(() => {
    function onMessage(event: MessageEvent) {
      if (event.source !== window.parent || event.origin !== parentOrigin) return;
      const data = event.data as Record<string, unknown> | null;
      if (!data || typeof data !== "object") return;

      if (data.type === "zimos:editor-state") {
        setSelected(typeof data.selectedId === "string" ? data.selectedId : null);
        if (data.labels && typeof data.labels === "object") {
          const next: Record<string, string> = {};
          for (const [id, label] of Object.entries(data.labels as Record<string, unknown>)) {
            if (typeof label === "string") next[id] = label.slice(0, 80);
          }
          setLabels(next);
        }
        if (data.strings && typeof data.strings === "object") {
          const s = data.strings as Record<string, unknown>;
          setStrings({
            addAbove: typeof s.addAbove === "string" ? s.addAbove : DEFAULT_STRINGS.addAbove,
            addBelow: typeof s.addBelow === "string" ? s.addBelow : DEFAULT_STRINGS.addBelow,
          });
        }
        if ("theme" in data) applyTheme(readPreviewTheme(data.theme));
      } else if (data.type === "zimos:scroll-to-section" && typeof data.sectionId === "string") {
        const el = sectionEl(data.sectionId);
        if (!el) return;
        const header = document.querySelector("header")?.getBoundingClientRect().height ?? 0;
        const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
        window.scrollTo({
          top: el.getBoundingClientRect().top + window.scrollY - header - 8,
          behavior: reduce ? "auto" : "smooth",
        });
      }
    }
    window.addEventListener("message", onMessage);
    return () => window.removeEventListener("message", onMessage);
  }, [parentOrigin]);

  // Clicks select; links and forms stay put so the frame never leaves the preview.
  useEffect(() => {
    if (!editable) return;

    function onClick(event: MouseEvent) {
      const target = event.target as Element | null;
      if (!target || target.closest(`[${OVERLAY_ATTR}]`)) return;
      // The empty page's own "add a section" button (see the preview page).
      const insert = target.closest<HTMLElement>("[data-zimos-insert]");
      if (insert) {
        post({ type: "zimos:insert-section", index: Number(insert.dataset.zimosInsert) || 0 });
        return;
      }
      if (target.closest("a[href]")) event.preventDefault();
      const section = target.closest<HTMLElement>(`[${SECTION_ATTR}]`);
      if (!section) return;
      const id = section.getAttribute(SECTION_ATTR) ?? "";
      setSelected(id);
      post({ type: "zimos:select-section", sectionId: id });
    }
    function onSubmit(event: SubmitEvent) {
      event.preventDefault();
    }
    function onOver(event: MouseEvent) {
      const target = event.target as Element | null;
      if (target?.closest(`[${OVERLAY_ATTR}]`)) return;
      const section = target?.closest<HTMLElement>(`[${SECTION_ATTR}]`);
      setHovered(section ? section.getAttribute(SECTION_ATTR) : null);
    }
    function onOut(event: MouseEvent) {
      if (!event.relatedTarget) setHovered(null);
    }

    document.addEventListener("click", onClick, true);
    document.addEventListener("submit", onSubmit, true);
    document.addEventListener("mouseover", onOver);
    document.addEventListener("mouseout", onOut);
    return () => {
      document.removeEventListener("click", onClick, true);
      document.removeEventListener("submit", onSubmit, true);
      document.removeEventListener("mouseover", onOver);
      document.removeEventListener("mouseout", onOut);
    };
  }, [editable, post]);

  if (!editable) return null;

  const boxes: Array<{ box: Box; active: boolean }> = [];
  const selectedBox = measure(selected);
  const hoveredBox = hovered !== selected ? measure(hovered) : null;
  if (hoveredBox) boxes.push({ box: hoveredBox, active: false });
  if (selectedBox) boxes.push({ box: selectedBox, active: true });

  return (
    <div data-zimos-overlay="">
      {boxes.map(({ box, active }) => (
        <SectionOutline
          key={`${box.id}-${active ? "selected" : "hover"}`}
          box={box}
          active={active}
          label={labels[box.id] ?? ""}
          strings={strings}
          onInsert={(index) => post({ type: "zimos:insert-section", index })}
        />
      ))}
    </div>
  );
}

function SectionOutline({
  box,
  active,
  label,
  strings,
  onInsert,
}: {
  box: Box;
  active: boolean;
  label: string;
  strings: Strings;
  onInsert: (index: number) => void;
}) {
  // The chip rides the top edge, but never scrolls out of view with a tall section.
  const chipTop = Math.min(Math.max(box.top, 0), box.top + box.height - 24);

  return (
    <>
      <div
        style={{
          position: "fixed",
          top: box.top,
          left: box.left,
          width: box.width,
          height: box.height,
          outline: `${active ? 2 : 1}px ${active ? "solid" : "dashed"} ${EDITOR_BLUE}`,
          outlineOffset: -2,
          background: active ? "transparent" : "rgba(37, 99, 235, 0.04)",
          pointerEvents: "none",
          zIndex: 2147483000,
        }}
      />
      {label && (
        <div
          style={{
            position: "fixed",
            top: chipTop,
            left: box.left,
            width: box.width,
            pointerEvents: "none",
            zIndex: 2147483001,
            display: "flex",
            paddingInline: 4,
          }}
        >
          <span
            style={{
              background: EDITOR_BLUE,
              color: "#fff",
              font: "500 11px/1.2 ui-sans-serif, system-ui, sans-serif",
              padding: "4px 8px",
              borderRadius: "0 0 6px 6px",
              maxWidth: "60%",
              overflow: "hidden",
              textOverflow: "ellipsis",
              whiteSpace: "nowrap",
            }}
          >
            {label}
          </span>
        </div>
      )}
      <InsertButton top={box.top} box={box} label={strings.addAbove} onClick={() => onInsert(box.index)} />
      <InsertButton
        top={box.top + box.height}
        box={box}
        label={strings.addBelow}
        onClick={() => onInsert(box.index + 1)}
      />
    </>
  );
}

function InsertButton({
  top,
  box,
  label,
  onClick,
}: {
  top: number;
  box: Box;
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      title={label}
      style={{
        position: "fixed",
        top: top - 14,
        left: box.left + box.width / 2 - 14,
        width: 28,
        height: 28,
        borderRadius: 999,
        border: "2px solid #fff",
        background: EDITOR_BLUE,
        color: "#fff",
        font: "600 18px/1 ui-sans-serif, system-ui, sans-serif",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        cursor: "pointer",
        boxShadow: "0 2px 6px rgba(0,0,0,0.25)",
        zIndex: 2147483002,
      }}
    >
      +
    </button>
  );
}
