"use client";

import { useEffect, useId, useRef, useState, type KeyboardEvent, type ReactNode } from "react";

/**
 * The `product_cards` tabs: one tab per collection the merchant listed, one
 * grid of products per tab.
 *
 * Every grid is in the markup from the server (`panels`), so the first one
 * reads without JavaScript and choosing a tab only un-hides another: nothing
 * is fetched on a press. Arrow keys move between tabs the way a tab list
 * should (the other way round on an Arabic page), and on a phone the strip
 * scrolls sideways and keeps the chosen tab in view.
 */
export function ProductTabs({ tabs, panels, label, rtl }: { tabs: Array<{ key: string; label: string }>; panels: ReactNode[]; label: string; rtl: boolean }) {
  const [active, setActive] = useState(0);
  const id = useId();
  const tabRefs = useRef<Array<HTMLButtonElement | null>>([]);
  const mounted = useRef(false);
  const last = tabs.length - 1;

  // Keep the chosen tab in view inside its own strip — never by scrolling the page.
  useEffect(() => {
    if (!mounted.current) {
      mounted.current = true;
      return;
    }
    const tab = tabRefs.current[active];
    const strip = tab?.parentElement;
    if (!tab || !strip || strip.scrollWidth <= strip.clientWidth) return;
    const offset = tab.offsetLeft - strip.offsetLeft - (strip.clientWidth - tab.clientWidth) / 2;
    strip.scrollTo({ left: offset, behavior: "smooth" });
  }, [active]);

  function onKeyDown(e: KeyboardEvent<HTMLDivElement>) {
    const forward = rtl ? "ArrowLeft" : "ArrowRight";
    const back = rtl ? "ArrowRight" : "ArrowLeft";
    let next = active;
    if (e.key === forward) next = active === last ? 0 : active + 1;
    else if (e.key === back) next = active === 0 ? last : active - 1;
    else if (e.key === "Home") next = 0;
    else if (e.key === "End") next = last;
    else return;
    e.preventDefault();
    setActive(next);
    tabRefs.current[next]?.focus();
  }

  return (
    <>
      <div className="zs-pgrid__tabs" role="tablist" aria-label={label || undefined} onKeyDown={onKeyDown}>
        {tabs.map((tab, i) => (
          <button
            key={tab.key}
            ref={(node) => {
              tabRefs.current[i] = node;
            }}
            type="button"
            role="tab"
            id={`${id}-t-${i}`}
            className={`zs-pgrid__tab${i === active ? " is-on" : ""}`}
            aria-selected={i === active}
            aria-controls={`${id}-p-${i}`}
            tabIndex={i === active ? 0 : -1}
            onClick={() => setActive(i)}
          >
            {tab.label}
          </button>
        ))}
      </div>
      {panels.map((panel, i) => (
        <div key={tabs[i]?.key ?? i} className="zs-pgrid__panel" role="tabpanel" id={`${id}-p-${i}`} aria-labelledby={`${id}-t-${i}`} hidden={i !== active}>
          {panel}
        </div>
      ))}
    </>
  );
}
