/**
 * The campaign a visit came from, for the builder's display rules (handoff
 * 191): the first `utm_source` / `utm_medium` / `utm_campaign` seen in the
 * visit, kept in sessionStorage the way the attribution code keeps its own
 * (lib/visitor.ts), so a later page of the same visit — or a funnel step the
 * entry page moved on to — still answers "came from facebook".
 *
 * Browser only: on the server there is no visit and both calls do nothing.
 */

export type VisitUtm = Partial<Record<"source" | "medium" | "campaign", string>>;

const KEY = "zimos_display_utm";

function fromSearch(search: string): VisitUtm {
  const params = new URLSearchParams(search);
  const out: VisitUtm = {};
  for (const key of ["source", "medium", "campaign"] as const) {
    const value = params.get(`utm_${key}`)?.trim();
    if (value) out[key] = value.slice(0, 200);
  }
  return out;
}

function saved(): VisitUtm | null {
  try {
    const raw = window.sessionStorage.getItem(KEY);
    if (!raw) return null;
    const parsed: unknown = JSON.parse(raw);
    return parsed && typeof parsed === "object" ? (parsed as VisitUtm) : null;
  } catch {
    return null;
  }
}

/** Keeps this page's UTM values when the visit has none yet. */
export function rememberVisitUtm(search?: string): void {
  if (typeof window === "undefined" || saved()) return;
  const utm = fromSearch(search ?? window.location.search);
  if (Object.keys(utm).length === 0) return;
  try {
    window.sessionStorage.setItem(KEY, JSON.stringify(utm));
  } catch {
    /* storage blocked: the current address still answers below */
  }
}

/** The visit's UTM values: the first ones kept, else this page's own. */
export function visitUtm(): VisitUtm {
  if (typeof window === "undefined") return {};
  return saved() ?? fromSearch(window.location.search);
}
