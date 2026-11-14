import { getIntlLocale } from "@/i18n/LocaleContext";

/**
 * "3 minutes ago" / "منذ ٣ دقائق" — the reading a chat list and an
 * integration's "last checked" line want, where an absolute date reads as
 * noise. `lib/format.ts` covers the absolute forms (`formatDate`,
 * `formatDateTime`); this sits beside them rather than inside them so the
 * shared module keeps its current shape.
 *
 * `now` is injectable so tests do not have to freeze the clock.
 */
export function formatRelativeTime(iso: string | null | undefined, now: number = Date.now()): string {
  if (!iso) return "—";
  const t = new Date(iso).getTime();
  if (Number.isNaN(t)) return "—";
  const diffSec = Math.round((t - now) / 1000);
  const abs = Math.abs(diffSec);
  const rtf = new Intl.RelativeTimeFormat(getIntlLocale(), { numeric: "auto" });
  if (abs < 60) return rtf.format(diffSec, "second");
  if (abs < 3600) return rtf.format(Math.round(diffSec / 60), "minute");
  if (abs < 86400) return rtf.format(Math.round(diffSec / 3600), "hour");
  if (abs < 86400 * 30) return rtf.format(Math.round(diffSec / 86400), "day");
  if (abs < 86400 * 365) return rtf.format(Math.round(diffSec / (86400 * 30)), "month");
  return rtf.format(Math.round(diffSec / (86400 * 365)), "year");
}
