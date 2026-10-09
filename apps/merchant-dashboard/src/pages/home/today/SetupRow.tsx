import { useState } from "react";
import type { SetupGuide } from "@store-builder/api-client";
import { IconCaretLeft, IconClose } from "@/components/icons";
import { ViewLink } from "@/components/ViewLink";
import { useWorkspace } from "@/context/WorkspaceContext";
import { formatPercentValue } from "@/lib/format";
import { storeUrl } from "@/lib/storeAddress";
import { fmt, useT, type Messages } from "@/i18n/LocaleContext";
import { SETUP_GUIDE_STRINGS, SETUP_STEP_LINK, setupGuideHiddenKey } from "@/pages/home/SetupGuideCard";

const STRINGS = {
  en: {
    progress: "{title} — {done} of {total}",
    nextStep: "Next step: {step}",
  },
  ar: {
    progress: "{title} — {done} من {total}",
    nextStep: "الخطوة الجاية: {step}",
  },
} satisfies Messages;

/** The ring: 36px across, a 3.5px line. */
const RADIUS = 15;
const CIRCUMFERENCE = 2 * Math.PI * RADIUS;

function readHidden(workspaceId: string): boolean {
  try {
    return localStorage.getItem(setupGuideHiddenKey(workspaceId)) === "1";
  } catch {
    return false;
  }
}

/**
 * The setup guide once the store has its first order: no longer the first
 * thing on the page, but ONE slim row near the end — how far along the store
 * is, and the next step still to do, one tap away. Same step names, same
 * destinations and same "hide" memory as the full card (SetupGuideCard), so
 * hiding either hides both; gone by itself when every required step is done.
 *
 * The page gives it the guide it already fetched; give it `key={workspaceId}`
 * so another store reads its own "hidden" choice.
 */
export function SetupRow({ guide, workspaceId }: { guide: SetupGuide; workspaceId: string }) {
  const t = useT(STRINGS);
  const guideT = useT(SETUP_GUIDE_STRINGS);
  const { currentWorkspace } = useWorkspace();
  const [hidden, setHidden] = useState(() => readHidden(workspaceId));

  if (hidden || guide.done) return null;

  // As on the card: the next step is the first required one not done yet.
  const todo = (guide.steps ?? []).filter((step) => !step.done);
  const next = todo.find((step) => !step.optional) ?? todo[0] ?? null;
  const percent = Number.isFinite(guide.percent) ? Math.min(100, Math.max(0, guide.percent)) : 0;
  const title = fmt(t.progress, { title: guideT.title, done: guide.completed, total: guide.total });
  const storeLink = currentWorkspace?.slug ? storeUrl(currentWorkspace.slug) : null;

  function hide() {
    setHidden(true);
    try {
      localStorage.setItem(setupGuideHiddenKey(workspaceId), "1");
    } catch {
      /* private mode — hidden for this visit only */
    }
  }

  const nextClasses =
    "zimos-home-setup-next relative inline-flex max-w-full min-w-0 items-center gap-1 self-start text-[13px] leading-5 font-medium text-primary-dark focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary before:absolute before:inset-x-0 before:-inset-y-3 before:content-[''] sm:ms-auto sm:h-9 sm:shrink-0 sm:self-auto sm:rounded-full sm:bg-primary-soft sm:px-3.5 sm:before:-inset-y-1";
  const nextBody = next && (
    <>
      <span className="min-w-0 truncate">{fmt(t.nextStep, { step: guideT[next.key] })}</span>
      <IconCaretLeft className="size-3.5 shrink-0 ltr:rotate-180" weight="bold" aria-hidden />
    </>
  );

  return (
    <section
      aria-label={guideT.title}
      data-slot="home-setup-row"
      className="zimos-home-setup flex min-h-14 min-w-0 items-center gap-3 rounded-[var(--radius-card)] bg-paper-raised py-2 ps-3 pe-1.5 shadow-[var(--shadow-card)] ring-1 ring-line"
    >
      <span
        role="progressbar"
        aria-label={guideT.title}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={Math.round(percent)}
        className="relative flex size-9 shrink-0 items-center justify-center"
      >
        {/* Starts at twelve o'clock and runs clockwise in both directions: a dial does not flip. */}
        <svg viewBox="0 0 36 36" className="size-9 -rotate-90" aria-hidden>
          <circle cx="18" cy="18" r={RADIUS} fill="none" strokeWidth="3.5" className="zimos-home-setup-track stroke-paper-sunken" />
          {percent > 0 && (
            <circle
              cx="18"
              cy="18"
              r={RADIUS}
              fill="none"
              strokeWidth="3.5"
              strokeLinecap="round"
              strokeDasharray={CIRCUMFERENCE}
              strokeDashoffset={CIRCUMFERENCE * (1 - percent / 100)}
              className="zimos-home-setup-bar stroke-primary"
            />
          )}
        </svg>
        <span aria-hidden className="absolute text-[10px] leading-none font-semibold text-ink tabular-nums">
          <bdi>{formatPercentValue(percent / 100, 0)}</bdi>
        </span>
      </span>

      {/* Two short lines on a phone; one line from sm up, with the next step as a pill at the end. */}
      <div className="flex min-w-0 flex-1 flex-col gap-x-3 gap-y-0.5 sm:flex-row sm:items-center">
        <p className="min-w-0 truncate text-sm leading-5 font-semibold text-ink">{title}</p>
        {next &&
          // The test order is placed on the store itself, in a new tab — as on the card.
          (next.key === "order" && storeLink ? (
            <a href={storeLink} target="_blank" rel="noreferrer" className={nextClasses}>
              {nextBody}
            </a>
          ) : (
            <ViewLink to={SETUP_STEP_LINK[next.key]} className={nextClasses}>
              {nextBody}
            </ViewLink>
          ))}
      </div>

      <button
        type="button"
        onClick={hide}
        aria-label={guideT.hide}
        title={guideT.hide}
        className="flex size-11 shrink-0 cursor-pointer items-center justify-center rounded-full text-ink-soft transition-colors duration-[var(--dur-fade)] ease-[var(--ease-out)] hover:bg-paper-sunken hover:text-ink focus-visible:outline-2 focus-visible:outline-primary motion-reduce:transition-none"
      >
        <IconClose className="size-4" aria-hidden />
      </button>
    </section>
  );
}
