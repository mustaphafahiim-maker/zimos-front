"use client";

import { useEffect, useState } from "react";

const pad = (n: number) => String(n).padStart(2, "0");

/**
 * Counts down to a REAL deadline the merchant set (`endsAt`). The first render
 * shows dashes so server HTML and hydration agree; it hides itself once the
 * deadline passes — no fake, resetting urgency timers.
 */
export function Countdown({
  endsAt,
  label,
  units,
}: {
  endsAt: number;
  label: string;
  units: [days: string, hours: string, minutes: string, seconds: string];
}) {
  const [left, setLeft] = useState<number | null>(null);

  useEffect(() => {
    const tick = () => setLeft(endsAt - Date.now());
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [endsAt]);

  if (left !== null && left <= 0) return null;

  const total = left === null ? null : Math.floor(left / 1000);
  const values =
    total === null
      ? null
      : [Math.floor(total / 86400), Math.floor((total % 86400) / 3600), Math.floor((total % 3600) / 60), total % 60];

  return (
    <div className="zr-countdown">
      {label.trim() && <p className="zr-countdown__label">{label}</p>}
      <div className="zr-countdown__units" dir="ltr" role="timer" aria-live="off">
        {units.map((unit, i) => (
          <div key={unit} className="zr-countdown__unit">
            <span className="zr-countdown__num">{values ? pad(values[i]) : "--"}</span>
            <span className="zr-countdown__cap">{unit}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
