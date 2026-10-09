import { useSyncExternalStore } from "react";
import { useLocation, useNavigate, useSearchParams } from "react-router-dom";

/**
 * The sections of the Shipping page, in list order. The seven that were tabs
 * keep their old `?tab=` value, so every link written before still lands
 * where it did; `groups`, `weight` and `zones` used to share the "rates" tab
 * and now have a place of their own.
 */
export const SHIPPING_SECTIONS = [
  "rates",
  "places",
  "groups",
  "weight",
  "zones",
  "delivery",
  "pickup",
  "options",
  "carriers",
  "taxes",
] as const;
export type ShippingSection = (typeof SHIPPING_SECTIONS)[number];
/** The name the page used while these were tabs. */
export type ShippingTab = ShippingSection;

export function isShippingSection(value: string | null | undefined): value is ShippingSection {
  return (SHIPPING_SECTIONS as readonly string[]).includes(value ?? "");
}

/** Tailwind's `lg`, the width from which SettingsLayout stands the list and the pane side by side. */
const DESKTOP = "(min-width: 64rem)";

function subscribeDesktop(onChange: () => void): () => void {
  const query = window.matchMedia(DESKTOP);
  query.addEventListener("change", onChange);
  return () => query.removeEventListener("change", onChange);
}
function isDesktopNow(): boolean {
  return window.matchMedia(DESKTOP).matches;
}

/** Set on the history entry a phone pushes when it goes from the list into a section. */
interface ListState {
  shippingList?: boolean;
}

/**
 * The section in the URL (`?tab=`), for SettingsLayout.
 *
 * - No param: a desktop shows "rates" (the default, as before); a phone shows
 *   the list of sections.
 * - Choosing "rates" on a desktop removes the param, as the tab bar did. On a
 *   phone it is written (`?tab=rates`), because there "no param" is the list.
 * - A phone going from the list into a section PUSHES, so the browser's Back
 *   returns to the list; the back row then goes back in history instead of
 *   adding an entry. Every other change replaces, as the tab bar did.
 */
export function useShippingSection(): {
  section: ShippingSection | null;
  select: (next: ShippingSection | null) => void;
} {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const location = useLocation();
  const isDesktop = useSyncExternalStore(subscribeDesktop, isDesktopNow, () => true);

  const raw = params.get("tab");
  const named = isShippingSection(raw) ? raw : null;
  const section: ShippingSection | null = named ?? (isDesktop ? "rates" : null);
  const cameFromList = (location.state as ListState | null)?.shippingList === true;

  function select(next: ShippingSection | null) {
    const out = new URLSearchParams(location.search);
    if (next === null) {
      if (cameFromList) {
        navigate(-1);
        return;
      }
      out.delete("tab");
      const search = out.toString();
      navigate({ pathname: location.pathname, search: search ? `?${search}` : "" }, { replace: true });
      return;
    }
    const desktop = isDesktopNow();
    if (next === "rates" && desktop) out.delete("tab");
    else out.set("tab", next);
    const search = out.toString();
    const to = { pathname: location.pathname, search: search ? `?${search}` : "" };
    if (!desktop && named === null) navigate(to, { state: { shippingList: true } satisfies ListState });
    else navigate(to, { replace: true, state: location.state });
  }

  return { section, select };
}
