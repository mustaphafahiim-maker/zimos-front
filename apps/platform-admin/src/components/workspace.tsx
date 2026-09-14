import type { ReactNode } from "react";
import { Info } from "lucide-react";
import { Status, StatusBadge } from "@/components/StatusBadge";
import { COUNTRIES } from "@/mock/constants";
import type { AdminWorkspace } from "@/mock/types";

import { LOCAL_ONLY_LABEL } from "@/mock/adminApi";

export { LOCAL_ONLY_LABEL, NOT_EXPOSED_MESSAGE } from "@/mock/adminApi";
export const UNKNOWN_HINT = "Not provided by the API yet";

export function WorkspaceStatus({ ws }: { ws: AdminWorkspace }) {
  if (ws.meta.suspended) return <Status value="suspended" />;
  if (ws.meta.subscriptionStatus) return <Status value={ws.meta.subscriptionStatus} />;
  if (ws.backend?.status) return <StatusBadge tone="neutral" dot>{ws.backend.status}</StatusBadge>;
  return <Unknown />;
}

/** Status value suitable for <Status>, falling back to the raw backend string. */
export function statusValue(ws: AdminWorkspace): string {
  if (ws.meta.suspended) return "suspended";
  return ws.meta.subscriptionStatus ?? ws.backend?.status ?? "unknown";
}

/** Known plan name, else the raw backend plan string, else null. */
export function planLabel(ws: AdminWorkspace): string | null {
  return ws.plan?.name ?? (ws.backend?.plan || null);
}

export function countryName(code: string | null): string | null {
  if (!code) return null;
  return COUNTRIES[code] ?? code;
}

/** Explicit "unknown" marker: an em dash with a tooltip, optionally a small muted hint. */
export function Unknown({ hint = false }: { hint?: boolean }) {
  return (
    <span className="text-ink-muted" title={UNKNOWN_HINT}>
      —{hint && <span className="ms-1.5 text-xs">{UNKNOWN_HINT}</span>}
    </span>
  );
}

/** Render `value` through `format`, or <Unknown /> when null/undefined. */
export function Known<T>({ value, format, hint }: { value: T | null | undefined; format: (v: T) => ReactNode; hint?: boolean }) {
  return value === null || value === undefined ? <Unknown hint={hint} /> : <>{format(value)}</>;
}

export function DemoBadge() {
  return (
    <StatusBadge tone="warning" dot>
      Demo data
    </StatusBadge>
  );
}

export function LocalOnlyNote({ children }: { children?: ReactNode }) {
  return (
    <p className="mb-3 flex items-center gap-1.5 text-xs text-ink-soft">
      <Info className="size-3.5" aria-hidden /> {children ?? `Admin actions here are ${LOCAL_ONLY_LABEL.charAt(0).toLowerCase()}${LOCAL_ONLY_LABEL.slice(1)}.`}
    </p>
  );
}

/** Sort comparator that always puts null/undefined last, regardless of direction. */
export function compareNullable(a: string | number | null | undefined, b: string | number | null | undefined, dir: "asc" | "desc"): number {
  const an = a === null || a === undefined;
  const bn = b === null || b === undefined;
  if (an || bn) return an === bn ? 0 : an ? 1 : -1;
  const r = typeof a === "number" && typeof b === "number" ? a - b : String(a).localeCompare(String(b));
  return dir === "asc" ? r : -r;
}
