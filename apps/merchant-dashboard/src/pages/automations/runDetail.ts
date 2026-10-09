import { fmt, type Messages } from "@/i18n/LocaleContext";

/**
 * The few run details the dashboard says in its own words; every other detail
 * is shown as the server (or the platform behind it) wrote it.
 *   - an email step to an address on the suppression list (handoff 386);
 *   - a «رسالة لقناة الفريق» step (handoff 378).
 */
export const RUN_DETAIL_STRINGS = {
  en: {
    suppressedBounce: "Address suppressed (bounce)",
    suppressedComplaint: "Address suppressed (spam complaint)",
    channelSent: "Sent to the team channel ({provider})",
    channelPaused: "The team channel “{name}” is paused",
    channelGone: "The team channel no longer exists",
  },
  ar: {
    suppressedBounce: "العنوان موقوف (ارتداد)",
    suppressedComplaint: "العنوان موقوف (شكوى)",
    channelSent: "اتبعتت لقناة الفريق ({provider})",
    channelPaused: "قناة الفريق «{name}» متوقفة",
    channelGone: "قناة الفريق اتمسحت",
  },
} satisfies Messages;

type Strings = Record<keyof (typeof RUN_DETAIL_STRINGS)["en"], string>;

const PROVIDER_NAME: Record<string, string> = { telegram: "Telegram", slack: "Slack", discord: "Discord" };

export function runDetailText(t: Strings, detail: string): string {
  const text = detail.trim();
  if (/^Suppressed:\s*hard_bounce$/i.test(text)) return t.suppressedBounce;
  if (/^Suppressed:\s*complaint$/i.test(text)) return t.suppressedComplaint;
  const sent = /^notify_channel\s+(\w+)$/.exec(text);
  if (sent) return fmt(t.channelSent, { provider: PROVIDER_NAME[sent[1]] ?? sent[1] });
  const paused = /team channel "(.+)" is paused/.exec(text);
  if (paused) return fmt(t.channelPaused, { name: paused[1] });
  if (/the team channel no longer exists/.test(text)) return t.channelGone;
  return detail;
}
