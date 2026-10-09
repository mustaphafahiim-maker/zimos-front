import type { ReactNode } from "react";
import { cn } from "@store-builder/ui";
import { AD_PLATFORM_NAMES, adPlatformName, adPlatformOfSource } from "@/lib/adPlatforms";
import { ProviderLogo } from "./ProviderLogo";

/**
 * An ad platform's mark: the same box as the courier and gateway logos
 * (ProviderLogo). No brand artwork ships with the dashboard for these, so the
 * box holds a neutral lettermark; a "<platform>.png" dropped into
 * src/assets/providers later shows instead, with no change here.
 *
 * `decorative` hides it from screen readers where the platform's name is
 * written right beside it.
 */
export function AdPlatformMark({
  platform,
  size = "sm",
  decorative = false,
  className,
}: {
  platform: string;
  size?: "sm" | "md";
  decorative?: boolean;
  className?: string;
}) {
  const mark = <ProviderLogo code={platform} name={adPlatformName(platform)} size={size} className={className} />;
  return decorative ? (
    <span aria-hidden className="inline-flex shrink-0">
      {mark}
    </span>
  ) : (
    mark
  );
}

/** The small mark that fits a table row. */
const ROW_MARK = "h-5 w-7 text-[0.5625rem]";

/**
 * A platform's name in a list with its mark in front (ad spend, campaigns, ad
 * accounts). A value that is not a platform we know ("other") is the words alone.
 */
export function AdPlatformLabel({ platform, children, className }: { platform: string; children: ReactNode; className?: string }) {
  return (
    <span className={cn("inline-flex min-w-0 items-center gap-1.5", className)}>
      {AD_PLATFORM_NAMES[platform] && <AdPlatformMark platform={platform} decorative className={ROW_MARK} />}
      <span className="min-w-0">{children}</span>
    </span>
  );
}

/**
 * The mark of the ad platform behind a utm_source ("facebook" → Meta, "bing" →
 * Microsoft Ads), for the sales-sources table. Nothing for any other source.
 * Named for screen readers: the row only says the source as the link spelt it.
 */
export function AdSourceMark({ source }: { source: string | null | undefined }) {
  const platform = adPlatformOfSource(source);
  return platform ? <AdPlatformMark platform={platform} className={ROW_MARK} /> : null;
}
