import { useCallback, useEffect, useState } from "react";
import { fmt, useT, type Messages } from "@/i18n/LocaleContext";
import { countOf, pluralOf } from "@/lib/plural";

const STRINGS = {
  en: {
    ago: "{span} ago",
    justNow: "just now",
    sec_one: "1 second",
    sec_other: "{n} seconds",
  },
  ar: {
    ago: "من {span}",
    justNow: "دلوقتي",
    sec_one: "ثانية واحدة",
    sec_two: "ثانيتين",
    sec_few: "{n} ثواني",
    sec_other: "{n} ثانية",
  },
} satisfies Messages;

/** Below this many seconds a moment is simply "just now". */
const JUST_NOW_SECONDS = 10;

/**
 * Re-renders the caller every `everyMs`, so «من ١٢ ثانية» keeps counting
 * between two snapshots (the old live panel did the same, every five seconds).
 */
export function useTick(everyMs: number): void {
  const [, setTick] = useState(0);
  useEffect(() => {
    const id = window.setInterval(() => setTick((n) => n + 1), everyMs);
    return () => window.clearInterval(id);
  }, [everyMs]);
}

/**
 * How long ago a moment was, in the dashboard's words: «دلوقتي», «من ٤٠ ثانية»,
 * «من ٤ دقايق», «من ساعتين». Measured against the browser's clock at the time
 * of the call; a moment in the future (a clock a little off) reads as now.
 *
 * `seconds(n)` is the counted word on its own («١٠ ثواني»).
 */
export function useAgo() {
  const t = useT(STRINGS);

  const seconds = useCallback((count: number): string => pluralOf(t, "sec", count), [t]);

  const ago = useCallback(
    (iso: string): string => {
      const at = new Date(iso).getTime();
      if (!Number.isFinite(at)) return "—";
      const elapsed = Math.max(0, Math.round((Date.now() - at) / 1000));
      if (elapsed < JUST_NOW_SECONDS) return t.justNow;
      if (elapsed < 60) return fmt(t.ago, { span: pluralOf(t, "sec", elapsed) });
      if (elapsed < 3600) return fmt(t.ago, { span: countOf("minute", Math.floor(elapsed / 60)) });
      if (elapsed < 86_400) return fmt(t.ago, { span: countOf("hour", Math.floor(elapsed / 3600)) });
      return fmt(t.ago, { span: countOf("day", Math.floor(elapsed / 86_400)) });
    },
    [t]
  );

  return { ago, seconds };
}
