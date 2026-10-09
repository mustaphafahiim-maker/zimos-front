import { cn } from "@store-builder/ui";
import { AD_LINK_SOURCES, adPlatformName } from "@/lib/adPlatforms";
import { fmt, useT, type Messages } from "@/i18n/LocaleContext";
import { AdPlatformMark } from "@/components/AdPlatformMark";

const STRINGS = {
  en: {
    label: "Ad platform",
    hint: "Pick where the ad runs and we fill in utm_source.",
    needsSource: "{name} adds no click ID to its links. Keep utm_source={source} on every {name} ad link, or its orders can't be credited to it.",
  },
  ar: {
    label: "منصة الإعلان",
    hint: "اختار الإعلان شغال فين وإحنا نكتب utm_source.",
    needsSource: "{name} مش بتضيف كود نقرة للينكات بتاعتها. سيب utm_source={source} في كل لينك إعلان على {name}، وإلا أوردراتها مش هتتنسب لها.",
  },
} satisfies Messages;

/**
 * The tracked-link builder's platform shortcuts (handoff 254): one tap writes
 * the utm_source the sales-sources report credits to that platform — taboola,
 * outbrain, kwai, reddit, x and bing beside the older ones. Outbrain and Kwai
 * get a reminder: their links carry no click id, so utm_source is the only
 * thing that names them.
 */
export function UtmSourceSuggestions({ source, onPick }: { source: string; onPick: (source: string) => void }) {
  const t = useT(STRINGS);
  const current = source.trim().toLowerCase();
  const picked = AD_LINK_SOURCES.find((s) => s.source === current);
  return (
    <div>
      <p className="text-sm font-medium text-ink">{t.label}</p>
      <p className="mt-0.5 text-xs text-ink-soft">{t.hint}</p>
      <div role="group" aria-label={t.label} className="mt-2 flex flex-wrap gap-2">
        {AD_LINK_SOURCES.map((s) => (
          <button
            key={s.platform}
            type="button"
            aria-pressed={s.source === current}
            onClick={() => onPick(s.source)}
            className={cn(
              "zimos-chip inline-flex h-10 cursor-pointer items-center gap-1.5 rounded-full px-3 text-sm font-medium select-none transition-[scale,background-color,color] duration-[var(--dur-fade)] ease-[var(--ease-out)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary active:scale-[0.97] motion-reduce:transition-none motion-reduce:active:scale-100 pointer-coarse:h-11",
              s.source === current ? "bg-primary text-primary-foreground" : "bg-paper-raised text-ink ring-1 ring-line hover:bg-paper-sunken"
            )}
          >
            <AdPlatformMark platform={s.platform} decorative className="h-5 w-7 text-[0.5625rem]" />
            {adPlatformName(s.platform)}
          </button>
        ))}
      </div>
      {picked?.needsSource && (
        <p role="status" className="mt-2 rounded-2xl bg-accent-soft px-4 py-2.5 text-[13px] leading-5 text-accent-dark">
          {fmt(t.needsSource, { name: adPlatformName(picked.platform), source: picked.source })}
        </p>
      )}
    </div>
  );
}
