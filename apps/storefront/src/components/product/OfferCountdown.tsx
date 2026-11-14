"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useStore } from "@/lib/StoreContext";
import { productPageText } from "./productPageText";

const pad = (n: number) => String(n).padStart(2, "0");

/**
 * The countdown of a real offer: it runs to the deadline the merchant set
 * (`pageSettings.countdown.ends_at`), the same for every visitor, and never
 * restarts. Once it reaches zero it disappears and the page is refreshed —
 * the server has stopped selling at the offer price by then.
 *
 * Nothing is drawn until the browser has mounted: the page is cached, so
 * time left computed on the server would be stale for later visitors.
 */
export function OfferCountdown({ endsAt }: { endsAt: string }) {
  const { locale } = useStore();
  const text = productPageText(locale);
  const router = useRouter();
  const end = new Date(endsAt).getTime();
  const [left, setLeft] = useState<number | null>(null);

  useEffect(() => {
    if (!Number.isFinite(end)) return;
    let done = false;
    const tick = () => {
      const ms = end - Date.now();
      setLeft(ms);
      if (ms <= 0 && !done) {
        done = true;
        clearInterval(id);
        router.refresh();
      }
    };
    const id = setInterval(tick, 1000);
    tick();
    return () => clearInterval(id);
  }, [end, router]);

  if (left === null || left <= 0) return null;

  const total = Math.floor(left / 1000);
  const days = Math.floor(total / 86400);
  const units: [number, string][] = [
    ...(days > 0 ? ([[days, text.days]] as [number, string][]) : []),
    [Math.floor((total % 86400) / 3600), text.hours],
    [Math.floor((total % 3600) / 60), text.minutes],
    [total % 60, text.seconds],
  ];

  return (
    <div className="rounded-2xl border border-primary/20 bg-primary-soft px-5 py-4 text-center">
      <p className="text-sm font-semibold text-ink">{text.offerEnds}</p>
      <p className="mt-2 flex items-start justify-center gap-2" dir="ltr" aria-live="off">
        {units.map(([value, label], i) => (
          <span key={label} className="flex items-start gap-2">
            <span className="flex flex-col items-center">
              <span className="min-w-12 rounded-xl bg-paper-raised px-2 py-1.5 text-2xl font-bold tabular-nums text-primary">
                {pad(value)}
              </span>
              <span className="mt-1 text-xs text-ink-soft">{label}</span>
            </span>
            {i < units.length - 1 && <span className="pt-1.5 text-xl font-bold text-primary/60">:</span>}
          </span>
        ))}
      </p>
    </div>
  );
}
