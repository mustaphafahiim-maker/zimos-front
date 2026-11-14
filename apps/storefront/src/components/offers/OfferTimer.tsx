"use client";

import { useEffect, useState } from "react";
import { useStore } from "@/lib/StoreContext";
import { pickText } from "@/lib/i18n";

const TEXT = {
  ar: { endsIn: "العرض بينتهي خلال", ended: "العرض ده انتهى." },
  en: { endsIn: "Offer ends in", ended: "This offer has ended." },
} as const;

/**
 * Whether a one-click offer's real countdown (SPEC §9.5; offers/offerCountdown.js)
 * has run out, and how much is left — ticking each second. Null `expiresAt`:
 * no countdown, never ends. Nothing ticks before hydration, so the server and
 * the first browser render agree.
 */
export function useOfferCountdown(expiresAt: string | null | undefined): { left: number | null; ended: boolean } {
  const end = expiresAt ? Date.parse(expiresAt) : NaN;
  const [now, setNow] = useState<number | null>(null);
  useEffect(() => {
    if (!Number.isFinite(end)) return;
    const tick = () => setNow(Date.now());
    const first = setTimeout(tick, 0);
    const timer = setInterval(tick, 1000);
    return () => {
      clearTimeout(first);
      clearInterval(timer);
    };
  }, [end]);
  if (!Number.isFinite(end) || now === null) return { left: null, ended: false };
  const left = Math.max(0, end - now);
  return { left, ended: left === 0 };
}

const two = (n: number) => String(n).padStart(2, "0");

/** "Offer ends in 09:41", or "This offer has ended." */
export function OfferTimer({ left, ended }: { left: number | null; ended: boolean }) {
  const { locale } = useStore();
  const text = pickText(TEXT, locale);
  if (left === null) return null;
  if (ended) {
    return (
      <p role="status" className="mt-3 rounded-xl bg-paper px-4 py-2 text-sm font-medium text-ink-soft">
        {text.ended}
      </p>
    );
  }
  const seconds = Math.ceil(left / 1000);
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  return (
    <p className="mt-3 inline-flex items-center gap-2 rounded-full bg-danger-soft px-4 py-1.5 text-sm font-semibold text-danger" aria-live="off">
      {text.endsIn}
      <span dir="ltr" className="font-mono tabular-nums">
        {h > 0 ? `${h}:${two(m)}:${two(s)}` : `${two(m)}:${two(s)}`}
      </span>
    </p>
  );
}
