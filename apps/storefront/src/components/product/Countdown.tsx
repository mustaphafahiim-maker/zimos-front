"use client";

import { useEffect, useState } from "react";

/**
 * The product page's optional offer countdown (`themeSettings.productCountdownHours`).
 * The deadline is computed in the browser on mount — never on the server,
 * where it would be frozen into cached HTML.
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
