/** A page's or funnel step's own scripts, as the live store gets them (customCode/pageScripts.js). */
export type PageScriptsData = { head?: string; body?: string } | null | undefined;

/** Reads `scripts` off a page or step answer that carries it (server or client). */
export function scriptsOf(holder: unknown): PageScriptsData {
  const scripts = (holder as { scripts?: unknown } | null)?.scripts;
  return scripts && typeof scripts === "object" ? (scripts as { head?: string; body?: string }) : null;
}
