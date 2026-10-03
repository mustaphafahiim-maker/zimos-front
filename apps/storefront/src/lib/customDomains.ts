import { hostnameOf, isRootDomainHost } from "./domains";

/**
 * Merchant-owned domains (`shop.example.com`). The proxy cannot tell from the
 * host alone which store one belongs to, so it asks the API —
 * GET /store/resolve-host?host= — and remembers the answer for a minute,
 * misses included, so an unknown host costs one lookup rather than one per
 * request.
 */

export interface ResolvedHost {
  slug: string;
  /** The funnel shown on the domain's root instead of the store home, if any. */
  homeFunnelRef: string | null;
}

const API_BASE = (process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:4000/api/v1").replace(/\/$/, "");
const TTL_MS = 60_000;
const MAX_ENTRIES = 5_000;
const cache = new Map<string, { at: number; value: ResolvedHost | null }>();

/** Hosts that can never be a merchant domain: no lookup is made for them. */
function isPlatformOrLocal(hostname: string): boolean {
  return (
    !hostname ||
    hostname === "localhost" ||
    hostname.endsWith(".localhost") ||
    /^\d{1,3}(\.\d{1,3}){3}$/.test(hostname) ||
    hostname.includes(":") ||
    hostname.startsWith("[") ||
    !hostname.includes(".") ||
    isRootDomainHost(hostname)
  );
}

export async function resolveCustomHost(host: string | null | undefined): Promise<ResolvedHost | null> {
  const hostname = hostnameOf(host);
  if (isPlatformOrLocal(hostname)) return null;

  const hit = cache.get(hostname);
  if (hit && Date.now() - hit.at < TTL_MS) return hit.value;

  let value: ResolvedHost | null = null;
  try {
    const res = await fetch(`${API_BASE}/store/resolve-host?host=${encodeURIComponent(hostname)}`, {
      headers: { accept: "application/json" },
    });
    if (res.ok) {
      const body = (await res.json()) as { store?: { slug?: unknown; homeFunnel?: { ref?: unknown } | null } };
      const slug = body.store?.slug;
      if (typeof slug === "string" && slug) {
        const ref = body.store?.homeFunnel?.ref;
        value = { slug, homeFunnelRef: typeof ref === "string" && ref ? ref : null };
      }
    } else if (res.status !== 404) {
      // The API is unwell: do not remember this as "unknown host".
      return hit?.value ?? null;
    }
  } catch {
    return hit?.value ?? null;
  }

  if (cache.size >= MAX_ENTRIES) cache.clear();
  cache.set(hostname, { at: Date.now(), value });
  return value;
}
