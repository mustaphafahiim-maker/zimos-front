/**
 * Element props / node settings are free-form JSON: the backend only checks
 * they are objects. Everything is coerced, never trusted.
 */

export type Props = Record<string, unknown>;

export function str(props: Props | undefined, key: string, fallback = ""): string {
  const v = props?.[key];
  if (typeof v === "string") return v;
  if (typeof v === "number" && Number.isFinite(v)) return String(v);
  return fallback;
}

export function bool(props: Props | undefined, key: string, fallback = false): boolean {
  const v = props?.[key];
  return typeof v === "boolean" ? v : fallback;
}

export function num(props: Props | undefined, key: string, fallback: number, min: number, max: number): number {
  const raw = props?.[key];
  const n = typeof raw === "number" ? raw : typeof raw === "string" && raw.trim() !== "" ? Number(raw) : NaN;
  if (!Number.isFinite(n)) return fallback;
  return Math.min(max, Math.max(min, Math.round(n)));
}

export function oneOf<T extends string>(props: Props | undefined, key: string, allowed: readonly T[], fallback: T): T {
  const v = props?.[key];
  return typeof v === "string" && (allowed as readonly string[]).includes(v) ? (v as T) : fallback;
}

export function strList(props: Props | undefined, key: string): string[] {
  const v = props?.[key];
  if (!Array.isArray(v)) return [];
  return v.map((item) => (typeof item === "string" ? item : "")).filter((item) => item.trim() !== "");
}

export interface QaItem {
  q: string;
  a: string;
}

export function qaList(props: Props | undefined, key: string): QaItem[] {
  const v = props?.[key];
  if (!Array.isArray(v)) return [];
  return v
    .map((item) => {
      const o = (item ?? {}) as Props;
      return { q: str(o, "q"), a: str(o, "a") };
    })
    .filter((item) => item.q.trim() !== "" || item.a.trim() !== "");
}

export interface LinkItem {
  platform: string;
  url: string;
}

export function linkList(props: Props | undefined, key: string): LinkItem[] {
  const v = props?.[key];
  if (!Array.isArray(v)) return [];
  return v
    .map((item) => {
      const o = (item ?? {}) as Props;
      return { platform: str(o, "platform"), url: str(o, "url") };
    })
    .filter((item) => item.url.trim() !== "");
}

/** Only http(s) and root-relative URLs may go into src attributes. */
export function safeUrl(raw: string): string | null {
  const url = raw.trim();
  if (url === "") return null;
  if (/^https?:\/\//i.test(url)) return url;
  if (url.startsWith("/") && !url.startsWith("//")) return url;
  return null;
}

/** Links: http(s), mailto:, tel:, #anchor and site-relative paths. No javascript:. */
export function safeHref(raw: string): string | null {
  const href = raw.trim();
  if (href === "") return null;
  if (/^(https?:|mailto:|tel:)/i.test(href)) return href;
  if (href.startsWith("#")) return href;
  if (href.startsWith("//")) return null;
  if (href.startsWith("/")) return href;
  if (/^[a-z0-9][a-z0-9\-_/?=&#.]*$/i.test(href) && !href.includes(":")) return `/${href}`;
  return null;
}

/** "https://youtu.be/x" etc → an embeddable player URL, or null. */
export function videoEmbedUrl(url: string): string | null {
  try {
    const parsed = new URL(url);
    const host = parsed.hostname.replace(/^www\./, "");
    if (host === "youtube.com" || host === "m.youtube.com") {
      const id = parsed.searchParams.get("v");
      if (id) return `https://www.youtube-nocookie.com/embed/${encodeURIComponent(id)}`;
      if (parsed.pathname.startsWith("/embed/")) return url;
    }
    if (host === "youtu.be") {
      const id = parsed.pathname.slice(1);
      if (id) return `https://www.youtube-nocookie.com/embed/${encodeURIComponent(id)}`;
    }
    if (host === "vimeo.com") {
      const id = parsed.pathname.split("/").filter(Boolean)[0];
      if (id) return `https://player.vimeo.com/video/${encodeURIComponent(id)}`;
    }
  } catch {
    return null;
  }
  return null;
}

/** A valid future ISO date → epoch ms; otherwise null. */
export function futureTime(raw: string, now = Date.now()): number | null {
  if (!raw.trim()) return null;
  const t = Date.parse(raw);
  return Number.isFinite(t) && t > now ? t : null;
}
