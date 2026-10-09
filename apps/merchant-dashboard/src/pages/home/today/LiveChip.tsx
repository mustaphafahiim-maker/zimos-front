import { useEffect, useState } from "react";
import { cn } from "@store-builder/ui";
import { liveGetSnapshot, type LiveSnapshot } from "@store-builder/api-client";
import { apiClient } from "@/lib/apiClient";
import { isPermissionError } from "@/lib/errors";
import { useCachedAsync } from "@/lib/useCachedAsync";
import { pluralOf } from "@/lib/plural";
import { ViewLink } from "@/components/ViewLink";
import { fmt, useT, type Messages } from "@/i18n/LocaleContext";

/*
 * Plural forms follow lib/plural.ts (`<key>_one/_two/_few/_other`). English
 * only ever picks `_one` and `_other`; the other two are there so both
 * languages carry the same keys.
 */
const STRINGS = {
  en: {
    visitors_one: "1 visitor now",
    visitors_two: "{n} visitors now",
    visitors_few: "{n} visitors now",
    visitors_other: "{n} visitors now",
    checkout_one: "1 checking out",
    checkout_two: "{n} checking out",
    checkout_few: "{n} checking out",
    checkout_other: "{n} checking out",
    checkoutCap: "{n}+ checking out",
    both: "{visitors} · {checkout}",
    nobody: "No visitors right now",
    unknown: "Visitors right now",
    open: "Open the live view",
  },
  ar: {
    visitors_one: "زائر واحد دلوقتي",
    visitors_two: "زائرين دلوقتي",
    visitors_few: "{n} زوّار دلوقتي",
    visitors_other: "{n} زائر دلوقتي",
    checkout_one: "واحد بيكمّل الأوردر",
    checkout_two: "اتنين بيكمّلوا الأوردر",
    checkout_few: "{n} بيكمّلوا الأوردر",
    checkout_other: "{n} بيكمّلوا الأوردر",
    checkoutCap: "{n}+ بيكمّلوا الأوردر",
    both: "{visitors} · {checkout}",
    nobody: "مفيش زوّار دلوقتي",
    unknown: "الزوّار دلوقتي",
    open: "افتح المتابعة المباشرة",
  },
} satisfies Messages;

/** How often the chip asks again while the tab is on screen. */
const REFRESH_MS = 30_000;
/** The API lists at most this many checkouts in progress (docs/ux/needs-backend.md H14). */
const CHECKOUT_CAP = 20;

type State = "live" | "quiet" | "unknown";

/**
 * Who is on the store this minute, as a pill in the header of «اليوم»: a
 * green dot that breathes, the number of visitors and — when anyone is — how
 * many are filling in the checkout. One tap opens the live view.
 *
 * The first paint comes from the session cache (lib/useCachedAsync.ts), then
 * the chip asks again every 30 seconds while the tab is visible, and at once
 * when the merchant comes back to it. A role that may not read analytics gets
 * no chip at all; a failed request shows the link without a number, never an
 * old or an invented one.
 */
export function LiveChip({ workspaceId }: { workspaceId: string }) {
  const t = useT(STRINGS);
  // null: this role can't read it (403). Any other failure stays an error.
  const first = useCachedAsync<LiveSnapshot | null>(
    `home:live:${workspaceId}`,
    () =>
      liveGetSnapshot(apiClient, workspaceId).catch((err: unknown) => {
        if (isPermissionError(err)) return null;
        throw err;
      }),
    [workspaceId]
  );
  // The outcome of the latest poll; null until one has finished (the first load speaks until then).
  const [pollFailed, setPollFailed] = useState<boolean | null>(null);
  const { setData } = first;

  useEffect(() => {
    let current = true;
    setPollFailed(null);
    const ask = async () => {
      if (document.visibilityState !== "visible") return;
      try {
        const snapshot = await liveGetSnapshot(apiClient, workspaceId);
        if (!current) return;
        setData(snapshot);
        setPollFailed(false);
      } catch (err) {
        if (!current) return;
        if (isPermissionError(err)) {
          setData(null);
          setPollFailed(false);
        } else {
          setPollFailed(true);
        }
      }
    };
    const timer = window.setInterval(() => void ask(), REFRESH_MS);
    const onVisible = () => void ask();
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      current = false;
      window.clearInterval(timer);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [workspaceId, setData]);

  // Its room is held while the first answer is on its way, so the header does not jump.
  if (first.loading) {
    return (
      <span
        aria-hidden
        data-slot="home-live-skeleton"
        className="zimos-home-live-skeleton block h-9 w-36 shrink-0 animate-pulse rounded-full bg-paper-sunken motion-reduce:animate-none"
      />
    );
  }

  const failed = pollFailed ?? Boolean(first.error);
  const snapshot = first.data;
  // Not for this role: no chip, and no hole where it would have been.
  if (!failed && !snapshot) return null;

  // Read defensively: the chip sits in the header, and a snapshot of another shape must not take the page down.
  const visitors = snapshot?.realtime?.activeVisitors ?? 0;
  const checkingOut = snapshot?.live?.checkingOut?.length ?? 0;
  const state: State = failed ? "unknown" : visitors > 0 || checkingOut > 0 ? "live" : "quiet";

  const visitorsText = visitors > 0 ? pluralOf(t, "visitors", visitors) : null;
  const checkoutText =
    checkingOut >= CHECKOUT_CAP ? fmt(t.checkoutCap, { n: CHECKOUT_CAP }) : checkingOut > 0 ? pluralOf(t, "checkout", checkingOut) : null;
  const text =
    state === "unknown"
      ? t.unknown
      : state === "quiet"
        ? t.nobody
        : visitorsText && checkoutText
          ? fmt(t.both, { visitors: visitorsText, checkout: checkoutText })
          : (visitorsText ?? checkoutText ?? t.nobody);

  return (
    <ViewLink
      to="/analytics/now"
      data-slot="home-live"
      data-state={state}
      className={cn(
        "zimos-home-live relative inline-flex h-9 max-w-full min-w-0 items-center gap-2 rounded-full bg-paper-raised ps-3 pe-3.5 text-[13px] leading-5 font-medium ring-1 ring-line ring-inset",
        "transition-[scale,background-color] duration-[var(--dur-fade)] ease-[var(--ease-out)] hover:bg-paper-sunken active:scale-[0.97] motion-reduce:transition-none motion-reduce:active:scale-100",
        "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary",
        // 36px to the eye, 44px to the thumb.
        "before:absolute before:inset-x-0 before:-inset-y-1 before:content-['']",
        state === "live" ? "text-ink" : "text-ink-soft"
      )}
    >
      <span
        aria-hidden
        className={cn(
          "zimos-home-live-dot size-2 shrink-0 rounded-full",
          // Tailwind's pulse is the breath asked for: opacity only, two seconds, and still for reduced motion.
          state === "live" ? "animate-pulse bg-success motion-reduce:animate-none" : "bg-line-strong"
        )}
      />
      <span className="min-w-0 truncate tabular-nums">{text}</span>
      <span className="sr-only">{t.open}</span>
    </ViewLink>
  );
}
