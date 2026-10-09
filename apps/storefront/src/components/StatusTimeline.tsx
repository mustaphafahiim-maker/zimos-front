"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import type { TrackStage } from "@store-builder/api-client";
import { CheckIcon } from "@phosphor-icons/react/dist/ssr/Check";
import { CopyIcon } from "@phosphor-icons/react/dist/ssr/Copy";
import { XIcon } from "@phosphor-icons/react/dist/ssr/X";
import { pickText } from "@/lib/i18n";
import { useStore } from "@/lib/StoreContext";
import { focusRing } from "./ui";

/*
 * The vertical timeline the after-order pages share: the thank-you page's
 * "what happens next", the tracking page's five steps and the account's order
 * page. One rail, a dot per step —
 *   done     filled, with a check;
 *   current  larger, with a pulse (it holds still under reduced motion);
 *   to come  hollow;
 *   problem  marked in the danger colour (cancelled, returned, delivery failed).
 *
 * The small pieces those pages also share live here, so each page imports one
 * light module: a time said in words, and a value copied with one tap.
 */

export type TimelineState = "done" | "current" | "todo" | "problem";

export function Timeline({ children }: { children: ReactNode }) {
  return <ol className="relative">{children}</ol>;
}

const DOT: Record<TimelineState, string> = {
  done: "h-7 w-7 bg-primary text-on-primary",
  current: "h-9 w-9 border-2 border-primary bg-primary-soft",
  todo: "h-7 w-7 border-2 border-line-strong bg-paper-raised",
  problem: "h-9 w-9 bg-danger text-paper-raised",
};

export function TimelineStep({
  state,
  title,
  last = false,
  lineDone = false,
  badge,
  srState,
  time,
  children,
}: {
  state: TimelineState;
  title: ReactNode;
  /** The last step draws no line under its dot. */
  last?: boolean;
  /** The line from this dot to the next is part of the way already covered. */
  lineDone?: boolean;
  /** A pill beside the title ("Current step"). */
  badge?: string;
  /** Read after the title by a screen reader ("Completed"). */
  srState?: string;
  /** When the step was reached, already in words. */
  time?: string;
  /** A hint, or what to do next. */
  children?: ReactNode;
}) {
  return (
    <li className="relative flex gap-3 pb-6 last:pb-0" aria-current={state === "current" ? "step" : undefined}>
      {/* From the centre of this dot to the centre of the next one; the dots sit over it. */}
      {!last && <span aria-hidden className={`absolute start-[1.0625rem] top-[1.125rem] h-full w-0.5 ${lineDone ? "bg-primary" : "bg-line"}`} />}
      <span className="relative z-10 flex h-9 w-9 shrink-0 items-center justify-center">
        {state === "current" && <span aria-hidden className="absolute inset-1 rounded-full bg-primary/40 motion-safe:animate-ping" />}
        <span className={`relative flex items-center justify-center rounded-full ${DOT[state]}`}>
          {state === "done" && <CheckIcon size={14} weight="bold" aria-hidden />}
          {state === "problem" && <XIcon size={16} weight="bold" aria-hidden />}
          {state === "current" && <span aria-hidden className="h-2.5 w-2.5 rounded-full bg-primary" />}
        </span>
      </span>
      <div className="min-w-0 flex-1 pt-1.5">
        <p className={`text-[0.9375rem] font-semibold leading-6 ${state === "todo" ? "text-ink-soft" : state === "problem" ? "text-danger" : "text-ink"}`}>
          {title}
          {badge && <span className="ms-2 inline-block rounded-full bg-primary-soft px-2 py-0.5 align-middle text-xs font-medium text-primary">{badge}</span>}
          {srState && <span className="sr-only"> — {srState}</span>}
        </p>
        {time && <p className="mt-0.5 text-[0.8125rem] text-ink-soft">{time}</p>}
        {children}
      </div>
    </li>
  );
}

/**
 * Placed → Confirmation → Shipped → Delivered. `stage` is the step currently in
 * progress; earlier steps render as done. The last step at stage 3 is done too.
 */
export function StatusTimeline({ stage }: { stage: TrackStage }) {
  const { t } = useStore();
  const steps = [
    { title: t.timeline.placed, hint: t.timeline.placedHint },
    { title: t.timeline.confirmation, hint: t.timeline.confirmationHint },
    { title: t.timeline.shipped, hint: t.timeline.shippedHint },
    { title: t.timeline.delivered, hint: t.timeline.deliveredHint },
  ];

  return (
    <Timeline>
      {steps.map((step, i) => {
        const done = i < stage || (stage === 3 && i === 3);
        const current = i === stage && !done;
        return (
          <TimelineStep
            key={step.title}
            state={done ? "done" : current ? "current" : "todo"}
            title={step.title}
            last={i === steps.length - 1}
            lineDone={done}
            badge={current ? t.timeline.current : undefined}
            srState={done ? t.timeline.done : undefined}
          >
            <p className="mt-0.5 text-sm text-ink-soft">{step.hint}</p>
          </TimelineStep>
        );
      })}
    </Timeline>
  );
}

// ------------------------------------------------------------ time in words --

const DAY_WORDS = {
  en: { today: (time: string) => `Today, ${time}`, yesterday: (time: string) => `Yesterday, ${time}` },
  ar: { today: (time: string) => `النهارده ${time}`, yesterday: (time: string) => `إمبارح ${time}` },
  fr: { today: (time: string) => `Aujourd'hui, ${time}`, yesterday: (time: string) => `Hier, ${time}` },
};

/**
 * A moment as a shopper says it: «النهارده ٣:٢٠ م», «إمبارح ٣:٢٠ م», and the
 * date with its time for anything older — in the page's own date format.
 * "" for a date that cannot be read.
 */
export function useWhenInWords(): (iso: string | null | undefined) => string {
  const { locale, intlLocale } = useStore();
  const words = pickText(DAY_WORDS, locale);
  return (iso) => {
    if (!iso) return "";
    const date = new Date(iso);
    if (Number.isNaN(date.getTime())) return "";
    const dayStart = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
    const daysAgo = Math.round((dayStart(new Date()) - dayStart(date)) / 86400000);
    if (daysAgo === 0 || daysAgo === 1) {
      const time = new Intl.DateTimeFormat(intlLocale, { hour: "numeric", minute: "2-digit" }).format(date);
      return daysAgo === 0 ? words.today(time) : words.yesterday(time);
    }
    return new Intl.DateTimeFormat(intlLocale, { dateStyle: "medium", timeStyle: "short" }).format(date);
  };
}

// ------------------------------------------------------------- copy a value --

/** The clipboard, then the old selection way where the page may not write to it (an http origin, a blocked permission). */
async function copyText(value: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(value);
    return true;
  } catch {
    /* the old way below */
  }
  try {
    const area = document.createElement("textarea");
    area.value = value;
    area.setAttribute("readonly", "");
    area.style.position = "fixed";
    area.style.opacity = "0";
    document.body.appendChild(area);
    area.select();
    const ok = document.execCommand("copy");
    area.remove();
    return ok;
  } catch {
    return false;
  }
}

// `zt-chip` is the themes' hook for a chip's corners (components/ui.ts): sharp in a sharp theme, a pill in a round one.
const copyChip = `zt-chip inline-flex min-h-11 max-w-full cursor-pointer touch-manipulation items-center gap-2 rounded-xl border border-line bg-paper-raised px-3 text-sm font-semibold text-ink transition-colors hover:border-primary active:bg-primary-soft ${focusRing}`;

/**
 * One tap copies `value`; the button answers «اتنسخ» for a moment, said to a
 * screen reader too. `children` is the value as the page shows it (an order
 * number, a waybill) — left out, the button is only its label.
 */
export function CopyButton({
  value,
  copy,
  copied,
  onFail,
  className,
  children,
}: {
  /** What goes to the clipboard; a function when it is only known on the tap (a link built from the address bar). */
  value: string | (() => string);
  copy: string;
  copied: string;
  /** Nothing could be copied: the caller shows the value another way. */
  onFail?: (value: string) => void;
  className?: string;
  children?: ReactNode;
}) {
  const [done, setDone] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(
    () => () => {
      if (timer.current) clearTimeout(timer.current);
    },
    []
  );

  async function onClick() {
    const text = typeof value === "function" ? value() : value;
    if (!(await copyText(text))) return onFail?.(text);
    setDone(true);
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => setDone(false), 2200);
  }

  return (
    <>
      <button type="button" onClick={() => void onClick()} className={className ?? copyChip}>
        {children}
        <span className={`inline-flex min-w-12 items-center gap-1 text-[0.8125rem] font-medium ${done ? "text-success" : "text-primary"}`}>
          {done ? <CheckIcon size={16} weight="bold" aria-hidden /> : <CopyIcon size={16} aria-hidden />}
          {done ? copied : copy}
        </span>
      </button>
      {/* The answer to the tap, said once to a screen reader (a button's own label changing is not always read). */}
      <span role="status" className="sr-only">
        {done ? copied : ""}
      </span>
    </>
  );
}
