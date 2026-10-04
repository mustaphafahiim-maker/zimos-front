"use client";

import { createContext, useContext, useEffect, useRef, type ReactNode } from "react";
import { usePathname } from "next/navigation";
import type { CustomCodeSlotKey } from "@store-builder/api-client";
import { useStoreBasePath } from "./StoreRoute";

/**
 * The merchant's own code (dashboard → store settings → custom code), placed
 * in the store's fixed slots.
 *
 * Where it may run is decided here, on top of what the API already withholds
 * from a staff preview:
 *   - only on the store's own host. On the shared platform host every store
 *     shares one origin, so one merchant's script could read another store's
 *     cart or a staff preview token — there the slots stay empty;
 *   - never on the payment pages (`/pay/…`) or the preview routes.
 *
 * The code is inserted with a contextual fragment so that <script> tags in it
 * run, both on the first load and after a client-side navigation.
 */

type Slots = Partial<Record<CustomCodeSlotKey, string>>;

const CustomCodeContext = createContext<Slots>({});

export function CustomCodeProvider({ slots, children }: { slots: Slots; children: ReactNode }) {
  return <CustomCodeContext.Provider value={slots}>{children}</CustomCodeContext.Provider>;
}

/** Whether merchant code may run on this page at all. */
export function useCodeAllowed(): boolean {
  const basePath = useStoreBasePath();
  const pathname = usePathname() ?? "";
  // An empty base path means the store is being served at the root of its own host.
  if (basePath !== "") return false;
  return !/^\/(pay|preview)(\/|$)/.test(pathname);
}

export function injectCode(target: Element, code: string): Node[] {
  const fragment = document.createRange().createContextualFragment(code);
  const nodes = Array.from(fragment.childNodes);
  target.appendChild(fragment);
  return nodes;
}

/** One UI block slot. Renders nothing at all when the slot is empty or not allowed. */
export function CodeSlot({ name }: { name: CustomCodeSlotKey }) {
  const code = useContext(CustomCodeContext)[name];
  const allowed = useCodeAllowed();
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el || !code || !allowed) return;
    el.replaceChildren();
    injectCode(el, code);
    return () => el.replaceChildren();
  }, [code, allowed]);

  if (!code || !allowed) return null;
  return <div ref={ref} data-zimos-slot={name} />;
}

/** The head code, the stylesheet and the script — once per store, in <head>. */
export function CustomCodeHead() {
  const slots = useContext(CustomCodeContext);
  const allowed = useCodeAllowed();
  const { head, css, js } = slots;

  useEffect(() => {
    if (!allowed) return;
    const added: Node[] = [];
    if (head) added.push(...injectCode(document.head, head));
    if (css) {
      const style = document.createElement("style");
      style.setAttribute("data-zimos-slot", "css");
      style.textContent = css;
      document.head.appendChild(style);
      added.push(style);
    }
    if (js) {
      const script = document.createElement("script");
      script.setAttribute("data-zimos-slot", "js");
      script.textContent = js;
      document.head.appendChild(script);
      added.push(script);
    }
    return () => {
      for (const node of added) node.parentNode?.removeChild(node);
    };
  }, [allowed, head, css, js]);

  return null;
}
