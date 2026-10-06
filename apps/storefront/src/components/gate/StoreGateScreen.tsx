"use client";

import { useEffect, useId, useRef, useState, type ReactNode } from "react";
import { useSelectedLayoutSegment } from "next/navigation";
import type { StoreGatePublic } from "@store-builder/api-client";
import { LanguageSwitch } from "@/components/LanguageSwitch";
import { PoweredByZimos } from "@/components/PoweredByZimos";
import { btnPrimary, btnSecondary, card } from "@/components/ui";
import { useStore } from "@/lib/StoreContext";
import { OPEN_SEGMENTS, rememberAgeConfirmed } from "@/lib/storeGate";
import { GateCountdown } from "./GateCountdown";
import { PasswordForm, SignupForm } from "./GateForms";
import { HourglassGlyph, LockGlyph, ShieldGlyph } from "./gateIcons";

/**
 * Picks what a visitor sees under a gated store (frontend-handoff 197), by
 * the route showing — the store layout can't know it on the server:
 *
 *  - a locked route (`locked`, and not one the API keeps open) → the password
 *    page or the coming-soon page, full screen, instead of the store (whose
 *    page the API refused anyway);
 *  - an open route (order tracking, payments…) → the store as it is;
 *  - with the age check on → «عندك ١٨ سنة أو أكتر؟» over the store, which
 *    stays in the page underneath (inert) — it is the shopper's own answer,
 *    not a lock. Yes is remembered for the session; No shows a sorry page
 *    that can go back to the question.
 *
 * Staff previewing the store see it straight away.
 */
export function StoreGateScreen({
  gate,
  locked,
  funnelsLocked,
  staff,
  ageConfirmed,
  showBranding,
  children,
}: {
  gate: StoreGatePublic;
  locked: boolean;
  funnelsLocked: boolean;
  staff: boolean;
  ageConfirmed: boolean;
  showBranding: boolean;
  children: ReactNode;
}) {
  const segment = useSelectedLayoutSegment();
  const [confirmed, setConfirmed] = useState(ageConfirmed);
  const open = segment !== null && OPEN_SEGMENTS.has(segment);
  const lockedHere = locked && !open && (segment !== "f" || funnelsLocked);

  if (lockedHere && gate.mode === "password") {
    return (
      <GateFrame icon={<LockGlyph size={24} />} title="passwordTitle" message={gate.message} showBranding={showBranding}>
        <PasswordForm />
        <div className="mt-8 border-t border-line pt-6">
          <NoPasswordSignup />
        </div>
      </GateFrame>
    );
  }
  if (lockedHere) {
    return (
      <GateFrame icon={<HourglassGlyph size={24} />} title="comingSoonTitle" message={gate.message} showBranding={showBranding}>
        {gate.opensAt && <GateCountdown opensAt={gate.opensAt} />}
        <NotifyHeading />
        <SignupForm />
      </GateFrame>
    );
  }
  if (!gate.ageCheck.enabled) return children;

  // The same tree whether the question shows or not, so answering it doesn't remount the page.
  const ask = !staff && !open && !confirmed;
  return (
    <>
      <div className="contents" inert={ask}>
        {children}
      </div>
      {ask && (
        <AgeCheck
          minAge={gate.ageCheck.minAge}
          message={gate.ageCheck.message}
          showBranding={showBranding}
          onYes={(storeId) => {
            rememberAgeConfirmed(storeId);
            setConfirmed(true);
          }}
        />
      )}
    </>
  );
}

function NoPasswordSignup() {
  const { t } = useStore();
  return (
    <>
      <h2 className="text-sm font-semibold text-ink">{t.storeGate.noPassword}</h2>
      <p className="mt-0.5 text-sm text-ink-soft">{t.storeGate.noPasswordHint}</p>
      <SignupForm secondary />
    </>
  );
}

function NotifyHeading() {
  const { t } = useStore();
  return <h2 className="mt-8 text-base font-semibold text-ink">{t.storeGate.notifyTitle}</h2>;
}

/**
 * The full-screen frame every gate page shares: the store's logo (or name),
 * one icon, the title, the merchant's message and the page's own content —
 * none of the store's header, menus or cart.
 */
function GateFrame({
  icon,
  title,
  message,
  showBranding,
  children,
}: {
  icon: ReactNode;
  /** A locked page's title; null when the content brings its own heading (the age question). */
  title: "passwordTitle" | "comingSoonTitle" | null;
  message: string | null;
  showBranding: boolean;
  children: ReactNode;
}) {
  const { t, store } = useStore();
  const name = store?.name ?? "";
  return (
    <div className="flex min-h-[100svh] flex-1 flex-col bg-paper" data-testid="store-gate">
      {title && (
        <>
          {/* React puts these in <head>: a locked page names itself and stays out of search results. */}
          <title>{name ? `${t.storeGate[title]} — ${name}` : t.storeGate[title]}</title>
          <meta name="robots" content="noindex" />
        </>
      )}
      <div className="flex justify-end px-4 pt-3">
        <LanguageSwitch />
      </div>
      <main className="flex flex-1 flex-col items-center justify-center px-4 pb-10 pt-4">
        <div className="w-full max-w-md text-center">
          {store?.logoUrl ? (
            // eslint-disable-next-line @next/next/no-img-element -- the merchant's own logo, any host
            <img src={store.logoUrl} alt={name} className="mx-auto h-14 w-auto max-w-48 object-contain" />
          ) : (
            <p className="font-display text-xl font-semibold text-ink">{name}</p>
          )}
          <div className={`${card} mt-6 px-5 py-7 sm:px-8`}>
            <span className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-primary-soft text-primary">{icon}</span>
            {title && <h1 className="mt-4 font-display text-2xl font-semibold text-ink">{t.storeGate[title]}</h1>}
            {/* The merchant wrote it in one language: its own direction, whatever the page's. */}
            {message && (
              <p dir="auto" className="mt-2 whitespace-pre-line text-sm leading-relaxed text-ink-soft">
                {message}
              </p>
            )}
            {children}
          </div>
        </div>
      </main>
      {showBranding && (
        <footer className="flex justify-center pb-6">
          <PoweredByZimos label={t.footer.poweredBy} />
        </footer>
      )}
    </div>
  );
}

/** «عندك ١٨ سنة أو أكتر؟» over the store — a modal: the page behind is inert and doesn't scroll. */
function AgeCheck({
  minAge,
  message,
  showBranding,
  onYes,
}: {
  minAge: number;
  message: string | null;
  showBranding: boolean;
  onYes: (storeId: string) => void;
}) {
  const { t, store } = useStore();
  const g = t.storeGate;
  const [refused, setRefused] = useState(false);
  const heading = useRef<HTMLHeadingElement>(null);
  const headingId = useId();

  // Focus starts on the question, and follows it to the sorry page and back.
  useEffect(() => {
    heading.current?.focus();
  }, [refused]);

  // The store behind stays put while the question is up.
  useEffect(() => {
    const root = document.documentElement;
    const previous = root.style.overflow;
    root.style.overflow = "hidden";
    return () => {
      root.style.overflow = previous;
    };
  }, []);

  return (
    <div role="dialog" aria-modal="true" aria-labelledby={headingId} className="fixed inset-0 z-[70] overflow-y-auto overscroll-contain bg-paper">
      <GateFrame icon={<ShieldGlyph size={24} />} title={null} message={null} showBranding={showBranding}>
        <h1 ref={heading} id={headingId} tabIndex={-1} className="mt-4 font-display text-2xl font-semibold text-ink outline-none">
          {refused ? g.sorryTitle : g.ageQuestion(minAge)}
        </h1>
        <p dir={!refused && message ? "auto" : undefined} className="mt-2 whitespace-pre-line text-sm leading-relaxed text-ink-soft">
          {refused ? g.sorryBody(minAge) : (message ?? g.ageWhy)}
        </p>
        {refused ? (
          <button type="button" className={`${btnSecondary} mt-6 w-full`} onClick={() => setRefused(false)}>
            {g.answeredWrong}
          </button>
        ) : (
          <div className="mt-6 grid grid-cols-2 gap-3">
            <button type="button" className={btnPrimary} onClick={() => store && onYes(store.id)}>
              {g.yes}
            </button>
            <button type="button" className={btnSecondary} onClick={() => setRefused(true)}>
              {g.no}
            </button>
          </div>
        )}
      </GateFrame>
    </div>
  );
}
