/**
 * Prefetching a page's code before it is asked for (docs/ux/REDESIGN_PROMPT.md
 * §4.3, §7): the side menu, the dock and ⌘K call `prefetchRoute(to)` on hover /
 * touch-start, so a code-split page's chunk is already here when the tap lands
 * and the page's frame shows in under 100ms.
 *
 * routes/prefetch.ts registers one loader per lazy page, with the same
 * `import()` App.tsx uses, so Vite serves the same chunk. A loader runs once.
 */
type Loader = () => Promise<unknown>;

const loaders: Array<{ prefix: string; load: Loader }> = [];
const done = new Set<string>();

export function registerPrefetch(prefix: string, load: Loader): void {
  loaders.push({ prefix, load });
}

function matches(prefix: string, to: string): boolean {
  return to === prefix || to.startsWith(`${prefix}/`);
}

/** Load the code for the page at `to`, if it is code-split and not loaded yet. */
export function prefetchRoute(to: string): void {
  const path = to.split(/[?#]/)[0] || "/";
  let best: { prefix: string; load: Loader } | undefined;
  for (const entry of loaders) {
    if (matches(entry.prefix, path) && (!best || entry.prefix.length > best.prefix.length)) best = entry;
  }
  if (!best || done.has(best.prefix)) return;
  done.add(best.prefix);
  // A failed prefetch is not an error: the route's own lazy() will try again.
  best.load().catch(() => done.delete(best!.prefix));
}

/**
 * Props for a link that prefetches its page: hover on a desktop, touch-start on
 * a phone (the ~100ms before the tap resolves is enough for a chunk from the
 * local cache).
 */
export function prefetchProps(to: string) {
  const go = () => prefetchRoute(to);
  return { onPointerEnter: go, onTouchStart: go, onFocus: go } as const;
}
