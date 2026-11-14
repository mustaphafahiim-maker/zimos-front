"use client";

import { useEffect, useId, useRef, useState, type KeyboardEvent, type ReactNode } from "react";

export interface NeedTab {
  key: string;
  icon: string;
  pain: string;
  name: string;
}

/** Line icons for a need, drawn on a 24px grid with the tab's own stroke. */
const ICONS: Record<string, ReactNode> = {
  moon: <path d="M20.5 14.5A8 8 0 0 1 9.5 3.5a8.5 8.5 0 1 0 11 11Z" />,
  bottle: (
    <>
      <path d="M9 3h6l-1 4h-4L9 3Z" />
      <path d="M9.5 7h5l1.5 5v7a2 2 0 0 1-2 2h-4a2 2 0 0 1-2-2v-7l1.5-5Z" />
    </>
  ),
  bag: (
    <>
      <path d="M6 8h12l1 11H5L6 8Z" />
      <path d="M9 8V6.5a3 3 0 0 1 6 0V8" />
    </>
  ),
  clock: (
    <>
      <circle cx="12" cy="12" r="8" />
      <path d="M12 8v4l2.5 2.5" />
    </>
  ),
  box: (
    <>
      <path d="M12 3.5 20 8v8l-8 4.5L4 16V8l8-4.5Z" />
      <path d="M4 8l8 4.5L20 8M12 12.5V20" />
    </>
  ),
  heart: <path d="M12 20s-7-4.4-7-9.6A4 4 0 0 1 12 8a4 4 0 0 1 7 2.4C19 15.6 12 20 12 20Z" />,
  star: <path d="m12 4 2.4 5 5.6.8-4 3.9.9 5.5L12 16.6l-4.9 2.6.9-5.5-4-3.9L9.6 9 12 4Z" />,
  gift: (
    <>
      <path d="M4 11h16v9H4zM3 7.5h18V11H3zM12 7.5V20" />
      <path d="M12 7.5C10.5 4 7 4.5 7.5 6.5 8 8 12 7.5 12 7.5Zm0 0C13.5 4 17 4.5 16.5 6.5 16 8 12 7.5 12 7.5Z" />
    </>
  ),
  home: (
    <>
      <path d="M4 11 12 4l8 7v8.5H4V11Z" />
      <path d="M9.5 19.5V14h5v5.5" />
    </>
  ),
  sun: (
    <>
      <circle cx="12" cy="12" r="4" />
      <path d="M12 3v2M12 19v2M3 12h2M19 12h2M5.6 5.6 7 7M17 17l1.4 1.4M18.4 5.6 17 7M7 17l-1.4 1.4" />
    </>
  ),
};

/**
 * The `need_picker` switcher: one tab per need, one card per tab.
 *
 * Every card is in the markup from the server (`cards`), so the first one
 * reads without JavaScript; choosing a tab only un-hides another. Arrow keys
 * move between tabs the way a tab list should, and on a phone the two round
 * arrows step through them while the strip scrolls the chosen tab into view.
 */
export function NeedTabs({
  tabs,
  cards,
  label,
  labels,
  rtl,
}: {
  tabs: NeedTab[];
  cards: ReactNode[];
  label: string;
  labels: { previous: string; next: string };
  rtl: boolean;
}) {
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
    if (e.key === forward) next = Math.min(last, active + 1);
    else if (e.key === back) next = Math.max(0, active - 1);
    else if (e.key === "Home") next = 0;
    else if (e.key === "End") next = last;
    else return;
    e.preventDefault();
    setActive(next);
    tabRefs.current[next]?.focus();
  }

  return (
    <>
      <div className="zs-need__selector">
        <button
          type="button"
          className="zs-need__nav zs-need__nav--prev"
          aria-label={labels.previous}
          disabled={active === 0}
          onClick={() => setActive((i) => Math.max(0, i - 1))}
        >
          <svg viewBox="0 0 24 24" aria-hidden>
            <path d="M15 18l-6-6 6-6" />
          </svg>
        </button>
        <div
          className="zs-need__tabs"
          role="tablist"
          aria-label={label}
          style={{ ["--zs-count" as string]: tabs.length }}
          onKeyDown={onKeyDown}
        >
          {tabs.map((tab, i) => (
            <button
              key={tab.key}
              ref={(node) => {
                tabRefs.current[i] = node;
              }}
              type="button"
              role="tab"
              id={`${id}-t-${i}`}
              className={`zs-need__tab${i === active ? " is-on" : ""}`}
              aria-selected={i === active}
              aria-controls={`${id}-c-${i}`}
              tabIndex={i === active ? 0 : -1}
              onClick={() => setActive(i)}
            >
              <span className="zs-need__tab-icon" aria-hidden>
                <svg viewBox="0 0 24 24">{ICONS[tab.icon] ?? ICONS.box}</svg>
              </span>
              {tab.pain ? <span className="zs-need__tab-pain">{tab.pain}</span> : null}
              <span className="zs-need__tab-name">{tab.name}</span>
            </button>
          ))}
        </div>
        <button
          type="button"
          className="zs-need__nav zs-need__nav--next"
          aria-label={labels.next}
          disabled={active === last}
          onClick={() => setActive((i) => Math.min(last, i + 1))}
        >
          <svg viewBox="0 0 24 24" aria-hidden>
            <path d="M9 18l6-6-6-6" />
          </svg>
        </button>
      </div>

      <div className="zs-need__stage">
        {cards.map((card, i) => (
          <article
            key={tabs[i]?.key ?? i}
            className="zs-need__card"
            role="tabpanel"
            id={`${id}-c-${i}`}
            aria-labelledby={`${id}-t-${i}`}
            hidden={i !== active}
          >
            {card}
          </article>
        ))}
      </div>
    </>
  );
}
