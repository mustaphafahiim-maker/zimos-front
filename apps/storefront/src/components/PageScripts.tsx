"use client";

import { useEffect } from "react";
import type { PageScriptsData } from "@/lib/pageScripts";
import { injectCode, useCodeAllowed } from "./CustomCode";

/**
 * Runs one page's own code — the head code in <head>, the other at the end
 * of <body> — under the store's custom-code rules (CustomCode.tsx): only on
 * the store's own host, never on payment or preview pages; the API sends none
 * to a staff preview. Removed again when the shopper leaves the page.
 */
export function PageScripts({ scripts }: { scripts: PageScriptsData }) {
  const allowed = useCodeAllowed();
  const head = scripts?.head ?? "";
  const body = scripts?.body ?? "";

  useEffect(() => {
    if (!allowed || (!head && !body)) return;
    const added = [...(head ? injectCode(document.head, head) : []), ...(body ? injectCode(document.body, body) : [])];
    return () => {
      for (const node of added) node.parentNode?.removeChild(node);
    };
  }, [allowed, head, body]);

  return null;
}
