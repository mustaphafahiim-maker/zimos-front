"use client";

import { useEffect, useState } from "react";

/**
 * The `countdown` element counts down to a fixed date, the same for every
 * visitor (SPEC §9.3; §21: never a timer that restarts per visitor). The
 * server writes the date in when the page is published (`endsAt`; a duration
 * the merchant typed becomes "that many hours after publishing" —
 * pages/countdownDeadline.js). A draft not yet published only has
 * `endsInHours`: the editor's preview counts that down from now.
 *
 * The time left is worked out in the browser only: these pages are cached,
 * and a server render would freeze one moment into the HTML. Until then the
 * digits show dashes, so the server HTML and the first client render agree.
 */
function parts(msLeft: number) {
  const total = Math.max(0, Math.floor(msLeft / 1000));
  return {
    days: Math.floor(total / 86400),
    hours: Math.floor((total % 86400) / 3600),
    minutes: Math.floor((total % 3600) / 60),
    seconds: total % 60,
  };
}

const pad = (n: number) => String(n).padStart(2, "0");

export function Countdown({ label, endsAt, endsInHours }: { label: string; endsAt: string | null; endsInHours: number }) {
  const [left, setLeft] = useState<number | null>(null);

  useEffect(() => {
    const fixed = endsAt ? Date.parse(endsAt) : NaN;
    const end = Number.isFinite(fixed) ? fixed : Date.now() + endsInHours * 3600_000;
    const tick = () => setLeft(end - Date.now());
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [endsAt, endsInHours]);

  const p = left === null ? null : parts(left);
  // Days only while there is more than one left; hours keep counting past 24 otherwise.
  const units = p === null ? [null, null, null] : p.days > 0 ? [p.days, p.hours, p.minutes, p.seconds] : [p.hours, p.minutes, p.seconds];

  return (
    <div className="rounded-2xl border border-primary/20 bg-primary-soft px-5 py-4 text-center">
      {label && <p className="text-sm font-semibold text-ink">{label}</p>}
      <p className="mt-2 flex items-center justify-center gap-2" dir="ltr" aria-live="off">
        {units.map((value, i) => (
          <span key={i} className="flex items-center gap-2">
            <span className="min-w-12 rounded-xl bg-paper-raised px-2 py-1.5 text-2xl font-bold tabular-nums text-primary">
              {value === null ? "--" : pad(value)}
            </span>
            {i < units.length - 1 && <span className="text-xl font-bold text-primary/60">:</span>}
          </span>
        ))}
      </p>
    </div>
  );
}
