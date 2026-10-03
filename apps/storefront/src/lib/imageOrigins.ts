/**
 * The origins whose photos Next's image optimizer may resize — the media
 * bucket's public address, e.g. "https://media.example.com". A comma-separated
 * list in NEXT_PUBLIC_STORE_IMAGE_ORIGINS, read at build time by both
 * next.config.ts (the optimizer's allowlist) and the components (which
 * images go through it).
 *
 * Unset or empty means none: every image stays a plain <img> of the original
 * file, exactly as before. Only listed origins are allowed, never a wildcard:
 * the optimizer fetches what it is asked to, so an open list would let anyone
 * use this server to fetch and re-encode any picture on the internet.
 */
export function parseImageOrigins(raw: string | undefined): URL[] {
  return (raw ?? "")
    .split(",")
    .map((entry) => entry.trim())
    .filter(Boolean)
    .flatMap((entry) => {
      try {
        const url = new URL(entry);
        return url.protocol === "https:" || url.protocol === "http:" ? [new URL(url.origin)] : [];
      } catch {
        return [];
      }
    });
}

const ORIGINS = parseImageOrigins(process.env.NEXT_PUBLIC_STORE_IMAGE_ORIGINS).map((url) => url.origin);

/** True when `src` is on one of the listed origins. */
export function isOptimizableImage(src: string, origins: readonly string[] = ORIGINS): boolean {
  if (origins.length === 0) return false;
  try {
    return origins.includes(new URL(src).origin);
  } catch {
    return false;
  }
}
