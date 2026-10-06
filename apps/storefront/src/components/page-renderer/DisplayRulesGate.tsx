"use client";

import { useEffect, useState, type ReactNode } from "react";
import {
  DISPLAY_DEVICES,
  evaluateDisplayRules,
  storefrontVisitorContext,
  type DisplayDevice,
  type ElementDisplayRules,
} from "@store-builder/api-client";
import { createStorefrontApiClient } from "@/lib/apiClient";
import { rememberVisitUtm, visitUtm } from "@/lib/visitUtm";

/**
 * Shows an element only to the visitors its display rules allow (handoff 191;
 * the rules are read in PageRenderer with the api-client's displayRulesOf).
 *
 * The page is the same for everyone in the cache, so this runs per visitor:
 *  - devices: CSS only — the element is hidden at the widths of the devices
 *    it is off for (phones < 640 px, tablets < 1024 px, the same breakpoints
 *    as the builder's per-device styles), so there is no flash either way;
 *  - country: GET /store/:ws/visitor-context, once per visit;
 *  - UTM: the visit's first campaign values (lib/visitUtm);
 *  - dates: the backend already leaves out an element whose window is closed;
 *    this also hides one whose window closes while the page is open.
 *
 * An element that depends on the country or the campaign stays hidden until
 * that is known, and a hidden element renders nothing — no gap.
 */

const HIDE_ON: Record<DisplayDevice, string> = {
  mobile: "max-sm:hidden",
  tablet: "sm:max-lg:hidden",
  desktop: "lg:hidden",
};

const COUNTRY_KEY = "zimos_visitor_country";
let countryLoad: { workspaceId: string; promise: Promise<string | null> } | null = null;

/** The visitor's country, asked once per visit and shared by every element on the page. */
function visitorCountry(workspaceId: string): Promise<string | null> {
  try {
    const saved = window.sessionStorage.getItem(COUNTRY_KEY);
    if (saved !== null) return Promise.resolve(saved || null);
  } catch {
    /* storage blocked: ask the API */
  }
  if (countryLoad?.workspaceId === workspaceId) return countryLoad.promise;
  const promise = storefrontVisitorContext(createStorefrontApiClient(), workspaceId).then(
    (ctx) => {
      const country = ctx.country ? ctx.country.toUpperCase() : null;
      try {
        window.sessionStorage.setItem(COUNTRY_KEY, country ?? "");
      } catch {
        /* asked again on the next page */
      }
      return country;
    },
    // Unknown: an "only in" list hides the element, an "except" list shows it.
    () => null
  );
  countryLoad = { workspaceId, promise };
  return promise;
}

export function DisplayRulesGate({
  rules,
  workspaceId,
  children,
}: {
  rules: ElementDisplayRules;
  workspaceId: string;
  children: ReactNode;
}) {
  const needsVisitor = !!rules.countries || !!rules.utm;
  const [visible, setVisible] = useState<boolean | null>(needsVisitor ? null : true);
  const key = JSON.stringify(rules);

  useEffect(() => {
    const current = JSON.parse(key) as ElementDisplayRules;
    let cancelled = false;
    rememberVisitUtm();
    // Devices are the CSS's job (below).
    const check = (country: string | null) => {
      if (!cancelled) setVisible(evaluateDisplayRules({ ...current, devices: undefined }, { country, utm: visitUtm() }));
    };
    if (current.countries) void visitorCountry(workspaceId).then(check);
    else check(null);

    // A window that closes while the shopper is on the page.
    let timer: ReturnType<typeof setTimeout> | undefined;
    const left = current.until ? Date.parse(current.until) - Date.now() : NaN;
    if (left > 0 && left < 2_147_483_647) timer = setTimeout(() => !cancelled && setVisible(false), left);
    return () => {
      cancelled = true;
      if (timer) clearTimeout(timer);
    };
  }, [key, workspaceId]);

  if (visible === false) return null;
  const hidden = rules.devices ? DISPLAY_DEVICES.filter((d) => !rules.devices?.includes(d)).map((d) => HIDE_ON[d]) : [];
  return <div className={[visible === null ? "hidden" : "contents", ...hidden].join(" ")}>{children}</div>;
}
