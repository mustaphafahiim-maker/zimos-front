"use client";

import { useEffect, useMemo, useRef } from "react";
import { usePathname } from "next/navigation";
import type { StorefrontStoreScript } from "@store-builder/api-client";
import { pageTypesOf, useStorePageMarks } from "@/lib/storePageType";
import { injectCode, useCodeAllowed } from "./CustomCode";

/**
 * The merchant's store scripts (dashboard → custom code → Scripts; backend
 * customCode/storeScripts.js): each in <head>, first in <body> or last in
 * <body>, on the kinds of page it names ("all", or home, collection, product,
 * page, funnel, cart, checkout, thank_you).
 *
 * Same rules as the custom code slots (CustomCode.tsx): only on the store's
 * own host, never on the payment or preview pages, and the API sends none to
 * a staff preview. Inserted the way the head slot is, so <script> tags in the
 * code run. A script stays in place while the shopper moves between pages it
 * applies to, so it runs once, and is taken out when they reach one it does
 * not.
 */
export function StoreScripts({ scripts }: { scripts: StorefrontStoreScript[] }) {
  const allowed = useCodeAllowed();
  const pathname = usePathname() ?? "";
  const marks = useStorePageMarks();
  const placed = useRef(new Map<string, { position: StorefrontStoreScript["position"]; nodes: Node[] }>());

  const wanted = useMemo(() => {
    if (!allowed) return [];
    const types = new Set<string>([...pageTypesOf(pathname), ...marks]);
    return scripts.filter((s) => s.code && (s.pages.includes("all") || s.pages.some((p) => types.has(p))));
  }, [allowed, pathname, marks, scripts]);

  useEffect(() => {
    const map = placed.current;
    const keep = new Set(wanted.map((s) => s.id));
    for (const [id, entry] of map) {
      if (keep.has(id)) continue;
      for (const node of entry.nodes) node.parentNode?.removeChild(node);
      map.delete(id);
    }
    for (const script of wanted) {
      if (map.has(script.id)) continue;
      map.set(script.id, { position: script.position, nodes: place(script, map) });
    }
  }, [wanted]);

  // Everything out when the store itself goes (another store, a full reload).
  useEffect(() => {
    const map = placed.current;
    return () => {
      for (const entry of map.values()) for (const node of entry.nodes) node.parentNode?.removeChild(node);
      map.clear();
    };
  }, []);

  return null;
}

function place(script: StorefrontStoreScript, placed: Map<string, { position: string; nodes: Node[] }>): Node[] {
  if (script.position === "head") return injectCode(document.head, script.code);
  const fragment = document.createRange().createContextualFragment(script.code);
  const nodes = Array.from(fragment.childNodes);
  if (script.position === "body_end") {
    document.body.appendChild(fragment);
    return nodes;
  }
  // body_start: first in <body>, after the body-start scripts already there, so they keep their order.
  let anchor: Node | null = document.body.firstChild;
  for (const entry of placed.values()) {
    if (entry.position !== "body_start") continue;
    const last = entry.nodes[entry.nodes.length - 1];
    if (last && last.parentNode === document.body) anchor = last.nextSibling;
  }
  document.body.insertBefore(fragment, anchor);
  return nodes;
}
