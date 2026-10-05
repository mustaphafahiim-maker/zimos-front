"use client";

import type { ReactNode } from "react";
import { rememberPageTag } from "@/lib/pageTags";

/**
 * Wraps a website page's buy button or order form that adds tags to the
 * customer (lib/pageTags.ts): pressing it, or starting to fill it in, is
 * remembered so the next order carries it. Adds no box of its own.
 */
export function PageTagScope({ workspaceId, pageId, elementId, children }: { workspaceId: string; pageId: string; elementId: string; children: ReactNode }) {
  const remember = () => rememberPageTag(workspaceId, pageId, elementId);
  return (
    <div className="contents" onClickCapture={remember} onFocusCapture={remember}>
      {children}
    </div>
  );
}
