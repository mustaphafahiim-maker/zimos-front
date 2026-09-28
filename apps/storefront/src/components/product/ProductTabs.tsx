"use client";

import { useId, useRef, useState, type KeyboardEvent, type ReactNode } from "react";
import { useStore } from "@/lib/StoreContext";
import { focusRing } from "../ui";

export interface ProductTab {
  id: string;
  label: string;
  content: ReactNode;
}

/**
 * Details / shipping & returns / FAQ under the buy box, as one row of tabs
 * instead of three stacked sections — the page gets shorter and the shopper
 * picks what to read. A real tablist: arrow keys move between tabs (flipped
 * in RTL), Home/End jump, and only the open panel is in the tab order.
 *
 * Tabs whose content is missing (a product with no description) are simply
 * not offered; with one tab left the row still renders so the section keeps
 * its heading.
 */
export function ProductTabs({ tabs, defaultTab }: { tabs: ProductTab[]; defaultTab?: string }) {
  const { t, dir } = useStore();
  const baseId = useId();
  const [active, setActive] = useState(() => tabs.find((x) => x.id === defaultTab)?.id ?? tabs[0]?.id ?? "");
  const tabRefs = useRef<Map<string, HTMLButtonElement>>(new Map());

  if (tabs.length === 0) return null;

  function focusTab(id: string) {
    setActive(id);
    tabRefs.current.get(id)?.focus();
  }

  function onKeyDown(e: KeyboardEvent<HTMLButtonElement>, index: number) {
    const forward = dir === "rtl" ? "ArrowLeft" : "ArrowRight";
    const backward = dir === "rtl" ? "ArrowRight" : "ArrowLeft";
    let next: number | null = null;
    if (e.key === forward) next = (index + 1) % tabs.length;
    else if (e.key === backward) next = (index - 1 + tabs.length) % tabs.length;
    else if (e.key === "Home") next = 0;
    else if (e.key === "End") next = tabs.length - 1;
    if (next === null) return;
    e.preventDefault();
    focusTab(tabs[next].id);
  }

  return (
    <section aria-label={t.shop.tabs}>
      <div role="tablist" aria-label={t.shop.tabs} className="-mx-4 flex gap-1 overflow-x-auto border-b border-line px-4 sm:mx-0 sm:px-0">
        {tabs.map((tab, i) => {
          const selected = tab.id === active;
          return (
            <button
              key={tab.id}
              ref={(el) => {
                if (el) tabRefs.current.set(tab.id, el);
                else tabRefs.current.delete(tab.id);
              }}
              type="button"
              role="tab"
              id={`${baseId}-tab-${tab.id}`}
              aria-selected={selected}
              aria-controls={`${baseId}-panel-${tab.id}`}
              tabIndex={selected ? 0 : -1}
              onClick={() => setActive(tab.id)}
              onKeyDown={(e) => onKeyDown(e, i)}
              className={`-mb-px inline-flex min-h-12 shrink-0 cursor-pointer items-center border-b-2 px-3 text-sm font-semibold transition-colors ${
                selected ? "border-primary text-primary" : "border-transparent text-ink-soft hover:text-ink"
              } ${focusRing} rounded-t-lg`}
            >
              {tab.label}
            </button>
          );
        })}
      </div>
      {tabs.map((tab) => (
        <div
          key={tab.id}
          role="tabpanel"
          id={`${baseId}-panel-${tab.id}`}
          aria-labelledby={`${baseId}-tab-${tab.id}`}
          hidden={tab.id !== active}
          tabIndex={0}
          className={`pt-5 ${focusRing} rounded-xl`}
        >
          {tab.content}
        </div>
      ))}
    </section>
  );
}
