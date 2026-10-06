"use client";

import { useEffect } from "react";
import { injectCode, useCodeAllowed } from "@/components/CustomCode";

/**
 * The funnel's own scripts (SPEC §9.7: funnel settings → head code / body
 * code), on every step of the funnel, on top of the store's custom code. The
 * same rule as the store's code decides where they may run (CustomCode.tsx:
 * only on the store's own host, never on payment or preview pages).
 *
 * Inserted once while the shopper is in the funnel, and taken out when they
 * leave it. Taking it out waits a tick: a remount with the same code (a step
 * change, React's development double mount) keeps what is there instead of
 * running the scripts again.
 */

interface Placed {
  key: string;
  nodes: Node[];
  removal: ReturnType<typeof setTimeout> | null;
}

let placed: Placed | null = null;

function place(headCode: string | null | undefined, bodyCode: string | null | undefined) {
  const key = JSON.stringify([headCode ?? "", bodyCode ?? ""]);
  if (placed && placed.key === key) {
    if (placed.removal) clearTimeout(placed.removal);
    placed.removal = null;
    return;
  }
  takeOut();
  const nodes: Node[] = [];
  if (headCode) nodes.push(...injectCode(document.head, headCode));
  if (bodyCode) nodes.push(...injectCode(document.body, bodyCode));
  placed = { key, nodes, removal: null };
}

function takeOut() {
  if (!placed) return;
  if (placed.removal) clearTimeout(placed.removal);
  for (const node of placed.nodes) node.parentNode?.removeChild(node);
  placed = null;
}

export function FunnelCode({ headCode, bodyCode }: { headCode?: string | null; bodyCode?: string | null }) {
  const allowed = useCodeAllowed();

  useEffect(() => {
    if (!allowed || (!headCode && !bodyCode)) return;
    place(headCode, bodyCode);
    return () => {
      const current = placed;
      if (current) current.removal = setTimeout(() => placed === current && takeOut(), 0);
    };
  }, [allowed, headCode, bodyCode]);

  return null;
}
