"use client";

import { useEffect, useId, useRef, useSyncExternalStore, type KeyboardEvent, type ReactNode } from "react";
import type { CookieConsentSettings } from "@store-builder/api-client";
import { StoreLink } from "@/components/StoreRoute";
import { useStore } from "@/lib/StoreContext";
import {
  INITIAL_CONSENT,
  bannerOpen,
  chooseConsent,
  configureConsentMode,
  consentSnapshot,
  markPixelsLoaded,
  marketingAllowed,
  reopenConsent,
  startConsent,
  subscribeConsent,
  type ConsentChoice,
} from "@/lib/cookieConsent";
import { btnPrimary } from "./ui";

/**
 * The cookie banner, the gate in front of the ad pixels and the footer's
 * "Cookie settings" (frontend-handoff 196; the state is lib/cookieConsent.ts).
 * A store that leaves consent off renders exactly what it rendered before.
 */

const serverSnapshot = () => INITIAL_CONSENT;
/** The "Cookie settings" button that re-opened the banner: focus goes back to it. */
let opener: HTMLElement | null = null;

function useConsent() {
  return useSyncExternalStore(subscribeConsent, consentSnapshot, serverSnapshot);
}

/** Starts the shopper's state for this store once the page is in the browser. */
function useStartConsent(consent: CookieConsentSettings) {
  const { store } = useStore();
  // Before any page effect sends an event (lib/track.ts holds ad-pixel events on a store that asks first).
  configureConsentMode(consent.mode);
  const key = JSON.stringify(consent);
  useEffect(() => {
    if (store && consent.mode !== "off") startConsent(store.id, store.workspaceId, JSON.parse(key) as CookieConsentSettings);
  }, [store, key, consent.mode]);
  return store?.id ?? null;
}

/**
 * Wraps components/TrackingPixels. Off and notice: the pixels render as they
 * always did. Ask first: nothing renders until the shopper accepts (or is not
 * asked, by country) — then the pixels load and send their first page view.
 */
export function ConsentGate({ consent, children }: { consent: CookieConsentSettings; children: ReactNode }) {
  const storeId = useStartConsent(consent);
  const s = useConsent();
  const asksFirst = consent.mode === "opt_in";
  const allowed = asksFirst && s.storeId === storeId && s.settings.mode === "opt_in" && marketingAllowed(s);
  useEffect(() => {
    if (allowed) markPixelsLoaded();
  }, [allowed]);
  if (!asksFirst) return <>{children}</>;
  return allowed ? <>{children}</> : null;
}

// The phone bars the banner rests on — a page's own order bar while it shows, the theme's bottom
// toolbar — are the store wrapper's to know: globals.css lifts `[data-cookie-banner]` by
// `--sf-bars-h` ("The bottom of the screen on a store page"), so nothing is measured here.

/**
 * The banner, at the bottom of every page: one "OK" for a notice, "Accept" and
 * "Reject" (equal buttons) when the store asks first. Placed first in the
 * store's markup so the keyboard reaches it before the page, announced
 * politely when it appears, and a non-modal region: the store stays usable
 * behind it. Re-opened from the footer, it takes focus, closes on Escape and
 * gives focus back.
 */
export function CookieConsentBanner({ consent }: { consent: CookieConsentSettings }) {
  const { t, locale } = useStore();
  const storeId = useStartConsent(consent);
  const s = useConsent();
  const titleId = useId();
  const messageId = useId();
  const firstButton = useRef<HTMLButtonElement>(null);
  const open = consent.mode !== "off" && s.storeId === storeId && bannerOpen(s);

  useEffect(() => {
    if (s.reopened) firstButton.current?.focus();
  }, [s.reopened]);

  if (consent.mode === "off") return null;

  const own = consent.texts[locale];
  const asksFirst = consent.mode === "opt_in";
  const message = own?.message || t.cookies.message;

  function choose(choice: ConsentChoice) {
    const back = s.reopened ? opener : null;
    chooseConsent(choice);
    back?.focus();
  }

  function onKeyDown(e: KeyboardEvent<HTMLDivElement>) {
    if (e.key !== "Escape" || !s.reopened) return;
    e.stopPropagation();
    reopenConsent(false);
    opener?.focus();
  }

  const policy = consent.policyUrl;
  const policyClass = "whitespace-nowrap font-semibold text-primary underline underline-offset-2 hover:no-underline";
  const button = `${btnPrimary} flex-1 sm:min-w-28 sm:flex-none`;

  return (
    <>
      {/* Polite: read once when the banner appears, without moving focus. */}
      <p className="sr-only" aria-live="polite">
        {open && !s.reopened ? message : ""}
      </p>
      {open && (
        <div
          role="region"
          aria-labelledby={titleId}
          aria-describedby={messageId}
          data-cookie-banner=""
          onKeyDown={onKeyDown}
          className="pointer-events-none fixed inset-x-0 bottom-0 z-[45] px-3 pb-[calc(0.75rem+env(safe-area-inset-bottom))] sm:px-4 sm:pb-4"
        >
          <div className="zt-card pointer-events-auto mx-auto flex max-w-3xl flex-col gap-3 rounded-2xl border border-line bg-paper-raised p-4 shadow-xl sm:flex-row sm:items-center sm:gap-4">
            <h2 id={titleId} className="sr-only">
              {t.cookies.label}
            </h2>
            <p id={messageId} className="min-w-0 flex-1 text-sm leading-relaxed text-ink">
              {message}
              {policy && (
                <>
                  {" "}
                  {policy.startsWith("/") ? (
                    <StoreLink href={policy} className={policyClass}>
                      {t.cookies.policy}
                    </StoreLink>
                  ) : (
                    <a href={policy} target="_blank" rel="noopener noreferrer" className={policyClass}>
                      {t.cookies.policy}
                    </a>
                  )}
                </>
              )}
            </p>
            <div className="flex shrink-0 gap-2">
              {asksFirst ? (
                <>
                  <button ref={firstButton} type="button" className={button} onClick={() => choose("accepted")}>
                    {own?.accept || t.cookies.accept}
                  </button>
                  <button type="button" className={button} onClick={() => choose("rejected")}>
                    {own?.reject || t.cookies.reject}
                  </button>
                </>
              ) : (
                <button ref={firstButton} type="button" className={button} onClick={() => choose("noticed")}>
                  {own?.accept || t.cookies.ok}
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
}

/** "Cookie settings" for the footers: opens the banner again to change the choice. */
export function CookieSettingsButton({ className = "" }: { className?: string }) {
  const { t, store } = useStore();
  const s = useConsent();
  if (!store || s.storeId !== store.id || s.settings.mode === "off") return null;
  return (
    <button
      type="button"
      aria-expanded={bannerOpen(s)}
      onClick={(e) => {
        opener = e.currentTarget;
        reopenConsent(true);
      }}
      className={`inline-flex min-h-11 cursor-pointer items-center rounded-lg px-1 text-xs underline-offset-2 hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary ${className}`.trimEnd()}
    >
      {t.cookies.settings}
    </button>
  );
}
