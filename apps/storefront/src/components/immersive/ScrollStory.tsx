"use client";

import { useEffect, useRef, useState } from "react";
import { useImmersiveAllowed } from "./useImmersive";

export interface StoryStep {
  title: string;
  body: string;
  image: string;
}

/**
 * Tells a short story as the shopper scrolls: the text steps take turns being
 * the active one, and the picture beside them changes with each.
 *
 * Progress comes from an IntersectionObserver on the steps, not from a scroll
 * handler, so nothing runs while the section is off-screen. Every step's text
 * is in the document from the first paint — the effect changes emphasis, never
 * visibility, so a visitor with motion turned off still reads all of it.
 */
export function ScrollStory({ steps, title }: { steps: StoryStep[]; title?: string }) {
  const allowed = useImmersiveAllowed();
  const [active, setActive] = useState(0);
  const refs = useRef<(HTMLLIElement | null)[]>([]);

  useEffect(() => {
    if (!allowed) return;
    const nodes = refs.current.filter(Boolean) as HTMLLIElement[];
    if (nodes.length === 0 || typeof IntersectionObserver === "undefined") return;

    const io = new IntersectionObserver(
      (entries) => {
        const visible = entries.filter((e) => e.isIntersecting).sort((a, b) => b.intersectionRatio - a.intersectionRatio)[0];
        if (!visible) return;
        const i = nodes.indexOf(visible.target as HTMLLIElement);
        if (i >= 0) setActive(i);
      },
      { rootMargin: "-45% 0px -45% 0px", threshold: [0, 0.5, 1] }
    );
    nodes.forEach((n) => io.observe(n));
    return () => io.disconnect();
  }, [allowed, steps.length]);

  if (steps.length === 0) return null;
  const current = steps[Math.min(active, steps.length - 1)];

  return (
    <div className="grid gap-8 md:grid-cols-2 md:items-start">
      <div className={allowed ? "md:sticky md:top-24" : undefined}>
        <div className="aspect-[4/5] overflow-hidden rounded-[var(--radius-card)] border border-line bg-paper">
          {/* Merchant media are arbitrary remote URLs (no next/image allowlist). */}
          {/* eslint-disable-next-line @next/next/no-img-element */}
          {current.image ? (
            <img
              src={current.image}
              alt={current.title}
              width={800}
              height={1000}
              loading="lazy"
              className="h-full w-full object-cover transition-opacity duration-500"
              key={current.image}
            />
          ) : null}
        </div>
      </div>

      <div>
        {title ? <h2 className="mb-5 text-2xl font-bold text-ink">{title}</h2> : null}
        <ol className="flex flex-col gap-8">
          {steps.map((step, i) => (
            <li
              key={`${step.title}-${i}`}
              ref={(el) => {
                refs.current[i] = el;
              }}
              className={`border-s-2 ps-5 transition-colors duration-300 ${
                allowed && i === active ? "border-primary" : "border-line"
              }`}
            >
              <h3
                className={`text-lg font-semibold transition-colors duration-300 ${
                  allowed && i !== active ? "text-ink-soft" : "text-ink"
                }`}
              >
                {step.title}
              </h3>
              <p className="mt-1 text-ink-soft">{step.body}</p>
            </li>
          ))}
        </ol>
      </div>
    </div>
  );
}
