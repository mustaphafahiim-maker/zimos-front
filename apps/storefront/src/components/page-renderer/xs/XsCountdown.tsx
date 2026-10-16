"use client";

import { useEffect, useState } from "react";

/**
 * The time left until an offer ends, as four boxes — days, hours, minutes,
 * seconds. It counts to a real moment the merchant set (`endsAt`); with none
 * set, or once that moment has passed, it draws nothing rather than a row of
 * zeros or a timer that restarts for every visitor.
 */
export function XsCountdown({ endsAt, labels }: { endsAt: string; labels: [string, string, string, string] }) {
  const end = Date.parse(endsAt);
  const [left, setLeft] = useState<number | null>(null);

  useEffect(() => {
    if (!Number.isFinite(end)) return;
    const tick = () => setLeft(end - Date.now());
    tick();
    const id = window.setInterval(tick, 1000);
    return () => window.clearInterval(id);
  }, [end]);

  // Nothing on the server or before the first tick: the time left is the visitor's clock's to say.
  if (left === null || left <= 0) return null;
  const total = Math.floor(left / 1000);
  const values = [Math.floor(total / 86400), Math.floor((total % 86400) / 3600), Math.floor((total % 3600) / 60), total % 60];

  return (
    <div className="xs-countdown" dir="ltr" aria-live="off">
      {values.map((value, index) => (
        <div key={index} className="xs-countdown__unit">
          <span className="xs-countdown__value">{String(value).padStart(2, "0")}</span>
          <span className="xs-countdown__label">{labels[index]}</span>
        </div>
      ))}
    </div>
  );
}
