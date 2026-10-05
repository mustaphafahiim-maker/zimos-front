"use client";

import { useEffect } from "react";

/**
 * Item 95 on the canvas (SPEC §9.3): X-ray outlines and double-click text
 * editing. The editor says which elements' text may be edited
 * (`inlineText` on zimos:editor-state — never text bound to live data) and
 * whether the outlines are on; this frame draws and edits, and posts the
 * committed text back as { type: "zimos:edit-text", elementId, text }. The
 * editor changes the tree, which re-renders the page as any edit does.
 *
 * Editing makes the element's own text node editable in place — plain text
 * only, Enter commits a one-line text (a heading, a button), Escape puts the
 * old text back, leaving the element commits.
 */

const XRAY_STYLE_ID = "zimos-xray";
const XRAY_CSS = `
[data-zimos-section]{outline:1px dashed rgba(37,99,235,.6)!important;outline-offset:-1px}
[data-zimos-row]{outline:1px dashed rgba(16,185,129,.75)!important;outline-offset:-2px}
[data-zimos-column]{outline:1px dashed rgba(245,158,11,.85)!important;outline-offset:-3px}
[data-zimos-el]>*,[data-zimos-el]>[data-zs]>*{outline:1px dotted rgba(219,39,119,.8)!important;outline-offset:1px}
`;
const EDITABLE_CSS_ID = "zimos-inline-text";
const MULTILINE = new Set(["text", "rich_text"]);

/** The node that shows an element's text: its first box, past its style wrapper. */
function textNode(wrapper: HTMLElement): HTMLElement | null {
  let node = wrapper.firstElementChild as HTMLElement | null;
  if (node?.hasAttribute("data-zs")) node = node.firstElementChild as HTMLElement | null;
  return node;
}

export function useCanvasText({
  editable,
  xray,
  inlineText,
  hint,
  post,
}: {
  editable: boolean;
  xray: boolean;
  inlineText: string[];
  hint: string;
  post: (message: Record<string, unknown>) => void;
}) {
  // X-ray: one style tag, on or off.
  useEffect(() => {
    if (!editable) return;
    let style = document.getElementById(XRAY_STYLE_ID);
    if (xray && !style) {
      style = document.createElement("style");
      style.id = XRAY_STYLE_ID;
      style.textContent = XRAY_CSS;
      document.head.appendChild(style);
    } else if (!xray && style) {
      style.remove();
    }
  }, [editable, xray]);

  // The editable texts get a text cursor and a tooltip.
  useEffect(() => {
    if (!editable) return;
    const ids = new Set(inlineText);
    const marked: HTMLElement[] = [];
    for (const wrapper of Array.from(document.querySelectorAll<HTMLElement>("[data-zimos-el]"))) {
      if (!ids.has(wrapper.getAttribute("data-zimos-el") ?? "")) continue;
      const node = textNode(wrapper);
      if (!node) continue;
      node.setAttribute("data-zimos-text", "");
      if (hint) node.title = hint;
      marked.push(node);
    }
    let style = document.getElementById(EDITABLE_CSS_ID);
    if (!style) {
      style = document.createElement("style");
      style.id = EDITABLE_CSS_ID;
      style.textContent = `[data-zimos-text]{cursor:text}[data-zimos-text][contenteditable]{outline:2px solid #2563eb!important;outline-offset:2px;cursor:text;user-select:text}`;
      document.head.appendChild(style);
    }
    return () => {
      for (const node of marked) {
        node.removeAttribute("data-zimos-text");
        if (node.title === hint) node.removeAttribute("title");
      }
    };
  }, [editable, inlineText, hint]);

  // Double-click: edit in place.
  useEffect(() => {
    if (!editable) return;
    const ids = new Set(inlineText);

    function onDoubleClick(event: MouseEvent) {
      const target = event.target as Element | null;
      const wrapper = target?.closest<HTMLElement>("[data-zimos-el]");
      const elementId = wrapper?.getAttribute("data-zimos-el") ?? "";
      if (!wrapper || !ids.has(elementId)) return;
      const node = textNode(wrapper);
      if (!node || node.isContentEditable) return;
      event.preventDefault();
      event.stopPropagation();
      const multiline = MULTILINE.has(wrapper.getAttribute("data-zimos-type") ?? "");
      const before = node.innerText;
      let finished = false;

      const finish = (commit: boolean) => {
        if (finished) return;
        finished = true;
        node.removeEventListener("keydown", onKey);
        node.removeEventListener("blur", onBlur);
        node.removeAttribute("contenteditable");
        const text = node.innerText.replace(/ /g, " ");
        const value = multiline ? text.replace(/\n{3,}/g, "\n\n").trim() : text.replace(/\s+/g, " ").trim();
        if (!commit || !value || value === before.trim()) {
          node.innerText = before;
          return;
        }
        post({ type: "zimos:edit-text", elementId, text: value.slice(0, 4000) });
      };
      const onKey = (e: KeyboardEvent) => {
        e.stopPropagation();
        if (e.key === "Escape") {
          e.preventDefault();
          finish(false);
          node.blur();
        } else if (e.key === "Enter" && (!multiline || e.ctrlKey || e.metaKey)) {
          e.preventDefault();
          finish(true);
          node.blur();
        }
      };
      const onBlur = () => finish(true);

      node.setAttribute("contenteditable", "plaintext-only");
      // Browsers without plaintext-only fall back to plain contenteditable.
      if (node.contentEditable !== "plaintext-only") node.setAttribute("contenteditable", "true");
      node.addEventListener("keydown", onKey);
      node.addEventListener("blur", onBlur);
      node.focus();
      const range = document.createRange();
      range.selectNodeContents(node);
      const selection = window.getSelection();
      selection?.removeAllRanges();
      selection?.addRange(range);
    }

    document.addEventListener("dblclick", onDoubleClick, true);
    return () => document.removeEventListener("dblclick", onDoubleClick, true);
  }, [editable, inlineText, post]);
}
