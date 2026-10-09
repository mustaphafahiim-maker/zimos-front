import { useEffect, useRef, useState, type MouseEvent } from "react";
import { cn } from "@store-builder/ui";
import { useT } from "@/i18n/LocaleContext";
import { GROUP_ICONS, GROUP_KEYS, GROUP_STRINGS, revealGroup, type GroupKey } from "./groups";
import { useDirtyGroups } from "./saveQueue";

/** After a click the chosen row stays lit while the page travels to it (and when a short last group cannot reach the top). */
const CLICK_HOLD_MS = 900;

/**
 * The product page's index on desktop — the side list of System Settings: an
 * icon and a name per group, the one on screen lit, a click scrolls to it. It
 * stays beside the page while the groups scroll.
 *
 * Which group is "on screen" is read with an IntersectionObserver over a band
 * near the top of the window (under the toolbar, down to the middle): the
 * first group that crosses the band is the current one. No scroll listener.
 */
export function ProductSectionIndex({ className }: { className?: string }) {
  const t = useT(GROUP_STRINGS);
  const dirty = useDirtyGroups();
  const [active, setActive] = useState<GroupKey>(() => {
    const fromLink = window.location.hash.slice(1);
    return GROUP_KEYS.find((key) => key === fromLink) ?? GROUP_KEYS[0];
  });
  const heldUntil = useRef(0);

  useEffect(() => {
    if (typeof IntersectionObserver !== "function") return undefined;
    const inBand = new Set<string>();
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) inBand.add(entry.target.id);
          else inBand.delete(entry.target.id);
        }
        if (performance.now() < heldUntil.current) return;
        const first = GROUP_KEYS.find((key) => inBand.has(key));
        if (first) setActive(first);
      },
      // From just under the toolbar to a little above the middle of the window.
      { rootMargin: "-96px 0px -55% 0px", threshold: 0 }
    );
    for (const key of GROUP_KEYS) {
      const element = document.getElementById(key);
      if (element) observer.observe(element);
    }
    return () => observer.disconnect();
  }, []);

  function go(event: MouseEvent<HTMLAnchorElement>, group: GroupKey) {
    // A modified click (new tab, new window) is the browser's.
    if (event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
    event.preventDefault();
    heldUntil.current = performance.now() + CLICK_HOLD_MS;
    setActive(group);
    revealGroup(group);
  }

  return (
    <nav
      aria-label={t.indexLabel}
      data-slot="product-index"
      className={cn(
        "zimos-product-index sticky top-24 max-h-[calc(100dvh-7.5rem)] w-56 shrink-0 self-start overflow-y-auto rounded-[var(--radius-card)] bg-paper-raised p-2 shadow-[var(--shadow-card)] ring-1 ring-line",
        className
      )}
    >
      <ul className="flex flex-col gap-0.5">
        {GROUP_KEYS.map((group) => {
          const Icon = GROUP_ICONS[group];
          const current = group === active;
          return (
            <li key={group}>
              <a
                href={`#${group}`}
                aria-current={current ? "true" : undefined}
                onClick={(event) => go(event, group)}
                className={cn(
                  "flex min-h-10 items-center gap-2.5 rounded-full px-3 text-sm leading-5 font-medium select-none pointer-coarse:min-h-11",
                  "transition-[background-color,color,scale] duration-[var(--dur-fade)] ease-[var(--ease-out)] motion-reduce:transition-none",
                  "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary motion-safe:active:scale-[0.97]",
                  current ? "bg-primary text-primary-foreground" : "text-ink-soft hover:bg-primary-soft hover:text-ink"
                )}
              >
                <Icon className="size-[18px] shrink-0" weight={current ? "fill" : "regular"} aria-hidden />
                <span className="min-w-0 flex-1 truncate">{t[group]}</span>
                {dirty.has(group) && (
                  <span
                    role="img"
                    aria-label={t.unsaved}
                    title={t.unsaved}
                    className={cn("zimos-product-unsaved block size-2 shrink-0 rounded-full", current ? "bg-primary-foreground" : "bg-accent")}
                  />
                )}
              </a>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
