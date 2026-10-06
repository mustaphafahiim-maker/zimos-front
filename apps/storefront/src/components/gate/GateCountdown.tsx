"use client";

import { useEffect, useState } from "react";
import { formatNumber } from "@/lib/i18n";
import { useStore } from "@/lib/StoreContext";
import { useIsClient } from "@/lib/useIsClient";

/**
 * The coming-soon page's opening date and a countdown to it (frontend-handoff
 * 197). Drawn in the browser only — the date is the shopper's own clock, and
 * the seconds would never match the server's HTML. The store does not open by
 * itself at that moment, so at zero it says "any moment now" and stays.
 */
export function GateCountdown({ opensAt }: { opensAt: string }) {
  const { t, locale, intlLocale } = useStore();
  const g = t.storeGate;
  const isClient = useIsClient();
  const target = Date.parse(opensAt);
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    if (!(target > Date.now())) return;
    const id = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(id);
  }, [target]);

  // Same height as the countdown, so nothing jumps when it appears.
  if (!isClient) return <div className="mt-5 h-[6.75rem]" aria-hidden />;

  const left = target - now;
  if (!(left > 0)) return <p className="mt-5 text-sm font-medium text-ink">{g.openingNow}</p>;

  const total = Math.floor(left / 1000);
  const parts: Array<[number, string]> = [
    [Math.floor(total / 86400), g.days],
    [Math.floor((total % 86400) / 3600), g.hours],
    [Math.floor((total % 3600) / 60), g.minutes],
    [total % 60, g.seconds],
  ];
  const date = new Intl.DateTimeFormat(intlLocale, {
    weekday: "long",
    day: "numeric",
    month: "long",
    hour: "numeric",
    minute: "2-digit",
  }).format(target);

  return (
    <div className="mt-5">
      <p className="text-sm font-medium text-ink">{g.opensOn(date)}</p>
      {/* role=timer is polite-off: the seconds are not read out one by one. */}
      <div role="timer" aria-label={g.countdown} className="mt-3 grid grid-cols-4 gap-2">
        {parts.map(([value, unit]) => (
          <div key={unit} className="rounded-xl border border-line bg-paper px-1 py-2.5">
            <span className="block font-display text-2xl font-semibold tabular-nums text-ink">
              {formatNumber(value, locale).padStart(2, formatNumber(0, locale))}
            </span>
            <span className="block text-xs text-ink-soft">{unit}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
