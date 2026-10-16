/**
 * How long an edit takes to show in the editor's preview, from the moment the
 * page tree changed to the moment the frame has painted it: a patch the frame
 * answers with `zimos:patched` once painted, or a render the frame announces
 * with `zimos:preview-ready`. Kept per kind of edit, the last 200 of each,
 * and readable as `window.__zimosPreviewLatency.report()` (p50 and p95 in ms)
 * — the numbers the preview's speed is judged by.
 */

export type EditKind = "text" | "colour" | "size" | "picture" | "render";

const KEEP = 200;
const samples: Record<EditKind, number[]> = { text: [], colour: [], size: [], picture: [], render: [] };

export function recordLatency(kind: EditKind, ms: number): void {
  if (!Number.isFinite(ms) || ms < 0) return;
  const list = samples[kind];
  list.push(Math.round(ms));
  if (list.length > KEEP) list.shift();
}

function percentile(sorted: number[], p: number): number {
  if (sorted.length === 0) return Number.NaN;
  return sorted[Math.min(sorted.length - 1, Math.ceil((p / 100) * sorted.length) - 1)];
}

export function latencyReport(): Record<EditKind, { n: number; p50: number; p95: number }> {
  const out = {} as Record<EditKind, { n: number; p50: number; p95: number }>;
  for (const kind of Object.keys(samples) as EditKind[]) {
    const sorted = [...samples[kind]].sort((a, b) => a - b);
    out[kind] = { n: sorted.length, p50: percentile(sorted, 50), p95: percentile(sorted, 95) };
  }
  return out;
}

if (typeof window !== "undefined") {
  (window as unknown as { __zimosPreviewLatency?: unknown }).__zimosPreviewLatency = { report: latencyReport, samples };
}
