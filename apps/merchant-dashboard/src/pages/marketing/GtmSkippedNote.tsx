import { IconInfo } from "@/components/icons";
import { useT, type Messages } from "@/i18n/LocaleContext";

/**
 * Marketing → Tracking tools → "Ready-made container" (handoff item 303): the
 * store's own GA4 / Google Ads ids already run on the storefront as Zimos
 * pixels, so the container file leaves them out — a copy in GTM would count
 * everything twice. The download names them in `X-Zimos-Skipped-Ids`; before a
 * download (and where the header can't be read) they are the store's own
 * active Google pixels, the same picks the server makes.
 */

const STRINGS = {
  en: {
    skipped: "{ids} already run from Zimos — left out of the file so nothing counts twice",
    runsFromZimos: "Runs from Zimos — not in the file",
  },
  ar: {
    skipped: "{ids} شغالين من زيموس مباشرة — مش هنحطهم في الملف عشان ميتحسبوش مرتين",
    runsFromZimos: "شغال من زيموس — مش في الملف",
  },
} satisfies Messages;

/** Beside one of the store's own Google tags, in place of "From your pixels". */
export function useGtmOwnTagSource(): string {
  return useT(STRINGS).runsFromZimos;
}

export function GtmSkippedNote({ ids }: { ids: readonly string[] }) {
  const t = useT(STRINGS);
  if (ids.length === 0) return null;
  const [before, after] = t.skipped.split("{ids}");
  return (
    <p role="status" className="mt-3 flex items-start gap-2 rounded-2xl bg-paper-sunken px-4 py-3 text-sm text-ink">
      <IconInfo className="mt-0.5 size-4 shrink-0 text-ink-soft" aria-hidden />
      <span>
        {before}
        <bdi dir="ltr" className="font-mono text-xs font-medium">
          {ids.join(", ")}
        </bdi>
        {after}
      </span>
    </p>
  );
}
