/**
 * The layout under the customer page's hero. The sections stand in the order
 * a cash-on-delivery merchant needs them — the orders, what the team wrote and
 * has to get back to, where the parcel goes, how to reach the customer,
 * everything that happened, then the rest — and that is also their order in
 * the page, so the keyboard walks them as the eye does.
 *
 * One list on a phone. From lg up, two columns: the orders and the rest in
 * the wide one, the notes open beside them. The split is CSS only (the three
 * wrappers are `contents` on a phone), so every section is mounted once and
 * loads once.
 */
export const SECTIONS_GRID =
  "flex flex-col gap-[var(--bento-gap)] lg:grid lg:grid-cols-[minmax(0,1.65fr)_minmax(0,1fr)] lg:grid-rows-[auto_1fr] lg:items-start";
/** The orders: the top of the wide column. */
export const SECTIONS_TOP = "contents lg:col-start-1 lg:row-start-1 lg:block lg:min-w-0";
/** The notes: second in the list on a phone, a column of their own from lg up (as tall as it needs, beside both rows). */
export const SECTIONS_SIDE = "contents lg:col-start-2 lg:row-span-2 lg:row-start-1 lg:block lg:min-w-0";
/** Everything else: the wide column under the orders. */
export const SECTIONS_REST =
  "contents lg:col-start-1 lg:row-start-2 lg:flex lg:min-w-0 lg:flex-col lg:gap-[var(--bento-gap)]";

/** The two sections a link can point at (`?tab=notes`, `?tab=timeline`): their element ids. */
export const NOTES_SECTION_ID = "customer-notes";
export const TIMELINE_SECTION_ID = "customer-timeline";

/** Where components/Accordion.tsx keeps what the merchant opened and folded, for the browser tab. */
const ACCORDION_STORE = "zimos.accordion.v1";

/**
 * What the merchant last did with a section in this browser tab, or null when
 * they have not touched it. Read by the sections the page opens itself (a
 * link to `?tab=notes`), which then cannot leave the memory to the accordion.
 */
export function readSectionOpen(persistKey: string): boolean | null {
  try {
    const map = JSON.parse(sessionStorage.getItem(ACCORDION_STORE) ?? "{}") as Record<string, boolean>;
    return typeof map[persistKey] === "boolean" ? map[persistKey] : null;
  } catch {
    return null;
  }
}

/** True from lg up, where the notes stand open in a column of their own. */
export function isWideScreen(): boolean {
  return typeof window.matchMedia === "function" && window.matchMedia("(min-width: 64rem)").matches;
}

/** Puts `value` on the clipboard; false when the browser would not. */
export async function copyText(value: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(value);
    return true;
  } catch {
    // No permission, or an origin without the clipboard API: the old selection way still works there.
    const field = document.createElement("textarea");
    field.value = value;
    field.setAttribute("readonly", "");
    field.style.position = "fixed";
    field.style.opacity = "0";
    document.body.appendChild(field);
    field.select();
    try {
      return document.execCommand("copy");
    } catch {
      return false;
    } finally {
      field.remove();
    }
  }
}
