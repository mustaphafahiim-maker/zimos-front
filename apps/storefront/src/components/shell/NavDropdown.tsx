"use client";

import { ShellLink } from "@/components/ShellLink";
import { resolveShellLinks, type ResolvedShellLink, type ShellLink as RawLink } from "@/lib/storeShell";

/**
 * A header menu link that opens a list of further links under it:
 *
 *   themeSettings.header.menu[i].children = [{ label, href }]
 *
 * The panel shows on hover and on keyboard focus (`:focus-within`), so it
 * needs no script. Wide screens only: the phone menu sheet keeps the flat
 * list of the top-level links.
 */

const MAX_CHILDREN = 12;

/**
 * The children of each menu link, keyed the way `resolveShellLinks` keys the
 * links themselves ("<index>:<href>"), read with the same filter as
 * `readHeaderShell` so the indexes line up.
 */
export function menuChildren(
  themeSettings: Record<string, unknown> | null | undefined,
  common: { home: string; cart: string; trackOrder: string }
): Map<number, ResolvedShellLink[]> {
  const out = new Map<number, ResolvedShellLink[]>();
  const header = themeSettings?.header;
  const menu = header && typeof header === "object" ? (header as Record<string, unknown>).menu : null;
  if (!Array.isArray(menu)) return out;

  let index = 0;
  for (const item of menu) {
    if (!item || typeof item !== "object" || Array.isArray(item)) continue;
    const o = item as Record<string, unknown>;
    if (typeof o.href !== "string" || !o.href.trim()) continue;
    if (Array.isArray(o.children)) {
      const raw: RawLink[] = [];
      for (const child of o.children) {
        if (!child || typeof child !== "object") continue;
        const c = child as Record<string, unknown>;
        if (typeof c.href !== "string" || !c.href.trim()) continue;
        raw.push({ label: typeof c.label === "string" ? c.label.trim().slice(0, 60) : "", href: c.href.trim().slice(0, 500) });
        if (raw.length >= MAX_CHILDREN) break;
      }
      const links = resolveShellLinks(raw, common);
      if (links.length) out.set(index, links);
    }
    index += 1;
  }
  return out;
}

export function NavDropdown({
  link,
  items,
  className,
}: {
  link: ResolvedShellLink;
  items: ResolvedShellLink[];
  className: string;
}) {
  return (
    <span className={`${className} zs-drop`}>
      <ShellLink link={link} className="zs-drop__link" />
      <svg className="zs-drop__caret" viewBox="0 0 24 24" aria-hidden>
        <path d="M7 10l5 5 5-5z" fill="currentColor" />
      </svg>
      <ul className="zs-drop__panel">
        {items.map((item) => (
          <li key={item.key}>
            <ShellLink link={item} className="zs-drop__item" />
          </li>
        ))}
      </ul>
    </span>
  );
}
