import { useEffect, useState } from "react";
import { ApiError, type SlugCheckResult } from "@store-builder/api-client";
import { apiClient } from "@/lib/apiClient";

/** What the address field is currently able to say about what's been typed. */
export type SlugCheckState =
  | { status: "empty" }
  | { status: "checking" }
  | { status: "available" }
  | { status: "unavailable"; result: SlugCheckResult }
  | { status: "error"; message: string };

/** A verdict, remembered together with the address it was about. */
type Settled = Exclude<SlugCheckState, { status: "empty" } | { status: "checking" }>;

const DEBOUNCE_MS = 400;

/**
 * Live availability for a store address as the merchant types it.
 *
 * Debounced, because this runs on every keystroke; and every check carries an
 * AbortSignal so a reply that a later keystroke has already superseded can
 * never land and overwrite a fresher verdict — two in-flight requests have no
 * guaranteed order, so cancelling is what keeps the answer honest rather than
 * merely saving a round trip.
 *
 * Only the settled verdict is state, and it is stored with the address it
 * judged. "Checking" is then derived — it is simply the gap between what has
 * been typed and what has been answered — which makes it impossible to show a
 * verdict belonging to text the merchant has already edited away.
 *
 * A failed request is reported as its own `error` state rather than as
 * "taken": the address might be perfectly free, and refusing to submit on the
 * strength of a network blip would strand the merchant. The backend checks
 * again on write, so letting them continue lets nothing unsafe through.
 */
export function useSlugCheck(slug: string): SlugCheckState {
  const [settled, setSettled] = useState<{ slug: string; state: Settled } | null>(null);

  useEffect(() => {
    if (slug.length === 0) return;

    const controller = new AbortController();
    const timer = window.setTimeout(async () => {
      try {
        const result = await apiClient.checkWorkspaceSlug(slug, controller.signal);
        if (controller.signal.aborted) return;
        setSettled({
          slug,
          state: result.available ? { status: "available" } : { status: "unavailable", result },
        });
      } catch (err) {
        if (controller.signal.aborted) return;
        // An aborted fetch surfaces as an AbortError in some browsers rather
        // than through the signal check above.
        if (err instanceof DOMException && err.name === "AbortError") return;
        setSettled({
          slug,
          state: {
            status: "error",
            message:
              err instanceof ApiError && err.status === 0
                ? "Couldn't check that address — check your connection."
                : "Couldn't check that address right now.",
          },
        });
      }
    }, DEBOUNCE_MS);

    return () => {
      window.clearTimeout(timer);
      controller.abort();
    };
  }, [slug]);

  if (slug.length === 0) return { status: "empty" };
  if (settled?.slug !== slug) return { status: "checking" };
  return settled.state;
}
