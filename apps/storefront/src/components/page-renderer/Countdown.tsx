"use client";

import { useEffect, useState } from "react";

/**
 * The `countdown` element stores only `endsInHours` — a duration, with no
 * anchor date anywhere in the tree. The only coherent reading is "ends N hours
 * from now", so the deadline is computed in the browser on mount. It
 * deliberately is *not* computed on the server: these pages are cached
 * (`revalidate`), and a server-side deadline would be frozen into the cached
 * HTML and drift for every later visitor.
 */
function parts(msLeft: number) {
  const total = Math.max(0, Math.floor(msLeft / 1000));
  return {
    hours: Math.floor(total / 3600),
    minutes: Math.floor((total % 3600) / 60),
    seconds: total % 60,
  };
}

const pad = (n: number) => String(n).padStart(2, "0");

export function Countdown({ label, endsInHours }: { label: string; endsInHours: number }) {
  // Seeded with the full duration so the server HTML and the first client
  // render agree; the interval below takes over a second later.
  const [left, setLeft] = useState(() => endsInHours * 3600_000);

  useEffect(() => {
    const end = Date.now() + endsInHours * 3600_000;
    const id = setInterval(() => setLeft(end - Date.now()), 1000);
    return () => clearInterval(id);
  }, [endsInHours]);

  const { hours, minutes, seconds } = parts(left);
  const units = [hours, minutes, seconds];

  return (
    <div className="rounded-2xl border border-primary/20 bg-primary-soft px-5 py-4 text-center">
      {label && <p className="text-sm font-semibold text-ink">{label}</p>}
      <p className="mt-2 flex items-center justify-center gap-2" dir="ltr" aria-live="off">
        {units.map((value, i) => (
          <span key={i} className="flex items-center gap-2">
            <span className="min-w-12 rounded-xl bg-paper-raised px-2 py-1.5 text-2xl font-bold tabular-nums text-primary shadow-card">
              {pad(value)}
            </span>
            {i < units.length - 1 && <span className="text-xl font-bold text-primary/60">:</span>}
          </span>
        ))}
      </p>
    </div>
  );
}
