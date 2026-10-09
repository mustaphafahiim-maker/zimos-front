import { useCallback, useEffect, useState } from "react";
import { liveGetSnapshot, type LiveSnapshot } from "@store-builder/api-client";
import { apiClient } from "@/lib/apiClient";
import { isPermissionError } from "@/lib/errors";
import { useCachedAsync } from "@/lib/useCachedAsync";
import { useLiveView } from "@/pages/analytics/LiveView";

/** How often the snapshot is asked for while the stream is down — the old realtime screen's ten seconds. */
export const FALLBACK_POLL_MS = 10_000;

export interface LiveSnapshotState {
  /** The newest snapshot for the chosen store / funnel, from the stream or from the request. */
  snapshot: LiveSnapshot | null;
  /** Whether the server's stream is connected (it pushes a snapshot whenever something changes). */
  connected: boolean;
  /** Nothing to show yet. */
  loading: boolean;
  /** Why there is nothing to show (a 403: this tab is not for this role). Null while a snapshot is on screen. */
  error: unknown;
  /** The stream is down and the last refresh failed: the numbers on screen are the last ones that arrived. */
  refreshFailed: boolean;
  retry: () => void;
}

/** When the server took a snapshot, in ms; 0 when it does not say. */
function takenAt(snapshot: LiveSnapshot | null): number {
  const iso = snapshot?.realtime.timestamp;
  const ms = iso ? new Date(iso).getTime() : Number.NaN;
  return Number.isFinite(ms) ? ms : 0;
}

/**
 * The live data of the "now" tab, as the old realtime screen kept it moving:
 *
 * 1. **The stream** — `useLiveView` (pages/analytics/LiveView.tsx, untouched):
 *    Server-Sent Events opened with a one-use ticket, reopened with a fresh
 *    ticket and a backoff of up to 30 s when it drops.
 * 2. **The request** — `liveGetSnapshot`, the same payload without the stream:
 *    asked once on arrival (so the tab has its numbers before the stream
 *    connects, and from the session's memory when coming back to the tab),
 *    then every ten seconds **only while the stream is not connected**.
 *    The old screen fell back to `getWebAnalyticsRealtime`, which has no
 *    "today" block and ignores the funnel filter; this one carries both.
 * 3. **Visibility** — the fallback does not ask while the browser tab is
 *    hidden, and asks at once on coming back when the numbers are older than
 *    the interval (the live map's rule).
 *
 * A snapshot is only shown for the funnel it was taken for, and of the two
 * sources the newer one wins: when the stream drops, its last snapshot must
 * not hide the fresher ones the fallback brings.
 *
 * A 403 on the request means the role may not read analytics: the stream is
 * not asked for a ticket again and the tab shows its no-permission state.
 */
export function useLiveSnapshot(workspaceId: string, funnelId: string): LiveSnapshotState {
  const wanted = funnelId || null;

  const polled = useCachedAsync<LiveSnapshot>(
    workspaceId ? `report:now:${workspaceId}:${funnelId}` : null,
    () => liveGetSnapshot(apiClient, workspaceId, funnelId || undefined),
    [workspaceId, funnelId]
  );
  const { refresh } = polled;
  const denied = isPermissionError(polled.error);

  // An empty store id switches the stream hook off (it opens nothing without one).
  const stream = useLiveView(denied ? "" : workspaceId, funnelId);
  const connected = stream.connected && !denied;

  useEffect(() => {
    if (connected || denied || !workspaceId) return;
    let last = Date.now();
    const run = () => {
      last = Date.now();
      void refresh({ silent: true });
    };
    const id = window.setInterval(() => {
      if (document.visibilityState === "visible") run();
    }, FALLBACK_POLL_MS);
    const onVisibility = () => {
      if (document.visibilityState === "visible" && Date.now() - last >= FALLBACK_POLL_MS) run();
    };
    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      window.clearInterval(id);
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, [connected, denied, workspaceId, funnelId, refresh]);

  // Only a snapshot taken for the chosen funnel (or the whole store) is this tab's.
  const mine = (candidate: LiveSnapshot | null): LiveSnapshot | null =>
    candidate && (candidate.funnelId ?? null) === wanted ? candidate : null;
  const fromStream = mine(stream.snapshot);
  const fromRequest = mine(polled.data);

  let snapshot: LiveSnapshot | null;
  if (denied) snapshot = null;
  else if (!fromStream) snapshot = fromRequest;
  else if (!fromRequest) snapshot = fromStream;
  // Connected, the stream is the truth: it speaks whenever something changes.
  else snapshot = connected || takenAt(fromStream) >= takenAt(fromRequest) ? fromStream : fromRequest;

  // With nothing on screen, the request's answer decides: its error, or still loading.
  const error = !snapshot && !polled.loading && polled.error ? polled.error : null;
  const loading = !snapshot && !error;
  // A failed refresh stays "failed" while the next one is on its way, so its notice does not blink every ten seconds.
  const [failed, setFailed] = useState(false);
  useEffect(() => {
    if (polled.error) setFailed(true);
    else if (!polled.stale && !polled.loading) setFailed(false);
  }, [polled.error, polled.stale, polled.loading]);
  const refreshFailed = Boolean(snapshot) && !connected && failed;

  const retry = useCallback(() => {
    void refresh();
  }, [refresh]);

  return { snapshot, connected, loading, error, refreshFailed, retry };
}
