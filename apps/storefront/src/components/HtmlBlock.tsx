"use client";

import { createContext, useContext, useEffect, useRef, type ReactNode } from "react";
import { injectCode, useCodeAllowed } from "./CustomCode";
import type { HtmlBlocksData } from "@/lib/htmlBlocks";

/**
 * Custom HTML blocks (SPEC §8.2 "HTML code", §8.4). The page tree only holds
 * an `html_block` element naming its block; the HTML comes with the page or
 * funnel step (`htmlBlocks`, backend customCode/htmlBlocks.js) — never in a
 * staff preview — and runs in place under the store's custom-code rules
 * (CustomCode.tsx): only on the store's own host, never on payment or preview
 * pages. The editor's canvas shows a placeholder instead.
 */

type Blocks = HtmlBlocksData;

const HtmlBlocksContext = createContext<Blocks>({});

export function HtmlBlocksProvider({ blocks, children }: { blocks: Blocks; children: ReactNode }) {
  return <HtmlBlocksContext.Provider value={blocks}>{children}</HtmlBlocksContext.Provider>;
}

export function HtmlBlock({ blockId, editable, label }: { blockId: string; editable?: boolean; label: string }) {
  const html = useContext(HtmlBlocksContext)[blockId] ?? "";
  const allowed = useCodeAllowed();
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el || !html || !allowed || editable) return;
    el.replaceChildren();
    injectCode(el, html);
    return () => el.replaceChildren();
  }, [html, allowed, editable]);

  if (editable) {
    return (
      <div className="flex min-h-16 items-center justify-center rounded-xl border-2 border-dashed border-line px-4 py-3 font-mono text-xs text-ink-soft" dir="ltr">
        {"</>"} {label}
      </div>
    );
  }
  if (!html || !allowed) return null;
  return <div ref={ref} data-zimos-html-block={blockId} />;
}
